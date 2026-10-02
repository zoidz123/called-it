import Fastify from 'fastify'
import cors from '@fastify/cors'
import { createHash } from 'node:crypto'
import { migrate } from '@called-it/db/migrate'
import {
  countVisitorScans,
  createAssetFeedback,
  createOrReuseScanJob,
  getAssetThread,
  getFeed,
  getFeedSummaries,
  getLeaderboard,
  getScanJob,
  getUserScorecard,
  hasScorecard,
  listInstruments,
  maybeEnqueueStaleRefreshes,
  saveFeedSummary,
} from '@called-it/db'
import { dayKey, directionalReturn, getDailyBars, getLiveMids, getXUser, liveQuote, loadLocalEnv, mapWithConcurrency, parseXHandle, summariesAreConfigured, summarizeIdea, type Bar, type SummaryPost } from '@called-it/core'
import { startPollLoop } from './poller'
import { describeRegistry, startWorkerLoop } from './worker'
import { corsOrigin, scanIsConfigured, visitorAddress } from './config'

loadLocalEnv()

const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 3001)
// New scans one visitor, and every visitor together, may start in a day. Each scan costs provider credits, and
// every scanned account is then read for new posts from then on.
const SCAN_MAX_PER_VISITOR = clampNumber(process.env.SCAN_MAX_PER_VISITOR, 3, 1, 1000)
const SCAN_MAX_PER_DAY = clampNumber(process.env.SCAN_MAX_PER_DAY, 100, 1, 100_000)
const FEEDBACK_MAX_PER_HOUR = clampNumber(process.env.FEEDBACK_MAX_PER_HOUR, 20, 1, 100)
const FEEDBACK_RATE_WINDOW_MS = 60 * 60 * 1000
const FEEDBACK_DUPLICATE_WINDOW_MS = 10 * 60 * 1000
const PRICE_CACHE_TTL_MS = 10 * 60 * 1000
const FEED_CHART_DAYS = 14
const FEED_PRICE_WAIT_MS = 2500
const CHART_PRICE_WAIT_MS = 12_000
const LIVE_MIDS_TTL_MS = 5000
let liveMids: { expiresAt: number; mids: Promise<Record<string, number>> } | null = null
const SUMMARY_CONCURRENCY = 4
// Feed rows whose summary is being written, so concurrent feed loads do not each ask the model.
const summaryJobs = new Set<string>()
const priceCache = new Map<string, { expiresAt: number; bars: Promise<Bar[]> }>()
const feedbackBuckets = new Map<string, { count: number; resetAt: number; fingerprints: Map<string, number> }>()

export async function buildServer() {
  await migrate()
  const app = Fastify({ logger: true })
  await app.register(cors, { origin: corsOrigin() })

  app.get('/health', async () => ({ ok: true, service: 'called-it-api' }))

  app.get('/api/leaderboard', async (request: any) => {
    const limit = clampNumber(request.query?.limit, 100, 1, 100)
    const offset = clampNumber(request.query?.offset, 0, 0, 10_000)
    return {
      leaderboard: await getLeaderboard({
        horizon: request.query?.sort === '7d' ? 7 : request.query?.sort === '90d' ? 90 : 30,
        limit,
        offset,
      }),
      limit,
      offset,
    }
  })

  app.get('/api/feed', async (request: any) => {
    const horizon = request.query?.h === '7' ? 7 : request.query?.h === '90' ? 90 : 30
    // A row of the feed is a ticker as one instrument. Accounts can mean different instruments by the same ticker,
    // and a call is only ever priced against the one its own entry price came from.
    const feed = await getFeed({ horizon })
    const { accounts } = feed
    const stored = feed.calls.map((call: any) => ({ ...call, idea: `${call.asset} ${call.asset_class}:${call.source_id}` }))
    const sources = [...new Map(stored.map((call: any) => [call.idea, call])).values()]
    const from = new Date(Date.now() - FEED_CHART_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const mids = await currentMids()
    // Daily closes per row for its price line, as [time, close].
    const prices: Record<string, [number, number][]> = {}
    // Where each row's instrument trades now: Hyperliquid's live mid where it quotes it, else the last close.
    // `coin` names the Hyperliquid feed the page can follow from there.
    const live: Record<string, { coin: string | null; price: number }> = {}
    await Promise.all(sources.map(async (source: any) => {
      // On-chain prices come through a slow, rate-limited API. The feed does not wait for them: a row goes without
      // its price line this once, and the fetch carries on into the cache for the next load.
      const bars = await within(assetPrices(source, from), FEED_PRICE_WAIT_MS)
      const lastClose = bars.at(-1)?.close
      const quote = liveQuote(source, mids, lastClose)
      prices[source.idea] = bars.map((bar) => [bar.t, bar.close])
      const price = quote?.price ?? lastClose
      if (price) live[source.idea] = { coin: quote?.coin ?? null, price }
    }))
    // The move since each call is measured to that price, not to the price stored at the account's last scan.
    const calls = stored.map((call: any) => (
      live[call.idea] ? { ...call, return_pct: directionalReturn(call.direction, call.entry_price, live[call.idea].price) } : call
    ))
    return { horizon, calls, accounts, prices, live, summaries: await feedSummaries(calls, accounts) }
  })

  // Every instrument a ticker is priced against across accounts, and which one is its default.
  app.get('/api/instruments', async (request: any, reply) => {
    const ticker = normalizeAsset(request.query?.ticker)
    if (!ticker) return reply.code(400).send({ error: 'A ticker is required.' })
    return { ticker, instruments: await listInstruments(ticker) }
  })

  app.get('/api/users/:handle', async (request: any, reply) => {
    const scorecard = await getUserScorecard(parseXHandle(request.params.handle), {
      includeTweets: request.query?.tweets !== '0',
    })
    if (!scorecard) return reply.code(404).send({ error: 'Scorecard not found' })
    const refresh = await maybeEnqueueStaleRefreshes(scorecard.user.handle)
    return { ...scorecard, refresh }
  })

  app.get('/api/users/:handle/assets/:asset', async (request: any, reply) => {
    const asset = normalizeAsset(request.params.asset)
    if (!asset) return reply.code(400).send({ error: 'Asset is required.' })
    const thread = await getAssetThread(parseXHandle(request.params.handle), asset)
    if (!thread.source || !thread.callouts.length) return reply.code(404).send({ error: 'Asset row not found.' })
    return { asset, callouts: thread.callouts, prices: await within(assetPrices(thread.source, thread.callouts[0].created_at), CHART_PRICE_WAIT_MS) }
  })

  app.post('/api/users/:handle/asset-feedback', async (request: any, reply) => {
    const handle = parseXHandle(request.params.handle)
    const body = request.body ?? {}
    const asset = normalizeAsset(body.asset)
    const suggestedCorrection = normalizeFeedbackText(body.suggestedCorrection)
    const displayedDirection = normalizeDirection(body.displayedDirection)
    const displayedAction = displayedDirection ? directionToAction(displayedDirection) : normalizeAction(body.displayedAction)

    if (!asset) return reply.code(400).send({ error: 'Asset is required.' })
    if (!suggestedCorrection) return reply.code(400).send({ error: 'Tell us what this should be.' })

    const scorecard = await getUserScorecard(handle, { includeTweets: false })
    if (!scorecard) return reply.code(404).send({ error: 'Scorecard not found.' })
    if (!scorecardHasAsset(scorecard, asset)) return reply.code(404).send({ error: 'Asset row not found.' })

    const feedbackGate = checkFeedbackGate(request, handle, asset, suggestedCorrection)
    if (!feedbackGate.ok) return reply.code(feedbackGate.status).send(feedbackGate.body)

    try {
      const feedback = await createAssetFeedback({
        handle,
        asset,
        displayedDirection,
        displayedAction,
        suggestedCorrection,
        rowContext: sanitizeRowContext(body.rowContext),
        userAgent: normalizeOptionalText(request.headers['user-agent'], 300),
      })
      return reply.code(201).send({ ok: true, feedback })
    } catch (error: any) {
      if (error?.code === '23503') return reply.code(404).send({ error: 'Scorecard not found.' })
      throw error
    }
  })

  app.get('/api/jobs/:id', async (request: any, reply) => {
    const job = await getScanJob(request.params.id)
    if (!job) return reply.code(404).send({ error: 'Job not found' })
    return { job }
  })

  app.get('/api/scan/:handle/precheck', async (request: any, reply) => {
    const handle = parseXHandle(request.params.handle)
    const scorecard = await getUserScorecard(handle, { includeTweets: false })
    if (scorecard) {
      const refresh = await maybeEnqueueStaleRefreshes(scorecard.user.handle)
      return { ok: true, handle: scorecard.user.handle, cached: true, freeToView: true, refresh }
    }
    if (!scanIsConfigured()) return reply.code(503).send({ error: 'Scanning is not configured.' })
    const user = await getXUser(handle)
    return {
      ok: true,
      handle: user.handle,
      cached: false,
      profile: user,
      message: 'Ready to scan the past year of tweets.',
    }
  })

  app.post('/api/scan/:handle', async (request: any, reply) => {
    if (!scanIsConfigured()) return reply.code(503).send({ error: 'Scanning is not configured.' })
    const handle = parseXHandle(request.params.handle)
    // An account that is already scored is kept up to date by the worker; asking again does not rescan it.
    if (await hasScorecard(handle)) return { handle, cached: true }
    const visitor = visitorKey(request)
    const scans = await countVisitorScans(visitor)
    if (scans.mine >= SCAN_MAX_PER_VISITOR) {
      return reply.code(429).send({ error: `You have used your ${SCAN_MAX_PER_VISITOR} scans for today. Try again tomorrow.` })
    }
    if (scans.everyone >= SCAN_MAX_PER_DAY) {
      return reply.code(429).send({ error: 'The site has reached its limit on new scans for today. Try again tomorrow.' })
    }
    const job = await createOrReuseScanJob({ handle, requestedBy: visitor })
    return { jobId: job.id, handle, status: job.status }
  })

  return app
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function normalizeAsset(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/^\$+/, '').toUpperCase()
  if (!/^[A-Z0-9._-]{1,32}$/.test(normalized)) return null
  return `$${normalized}`
}

function scorecardHasAsset(scorecard: any, asset: string) {
  const assets = [
    ...(Array.isArray(scorecard.calls) ? scorecard.calls.map((call: any) => call.asset) : []),
    ...(Array.isArray(scorecard.assets) ? scorecard.assets.map((row: any) => row.asset) : []),
  ]
  return assets.some((value) => normalizeAsset(value) === asset)
}

function normalizeFeedbackText(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length < 3) return null
  return normalized.slice(0, 1000)
}

function normalizeDirection(value: unknown): 'BULL' | 'BEAR' | null {
  return value === 'BULL' || value === 'BEAR' ? value : null
}

function normalizeAction(value: unknown): 'BUY' | 'SELL' | null {
  return value === 'BUY' || value === 'SELL' ? value : null
}

function directionToAction(direction: 'BULL' | 'BEAR') {
  return direction === 'BEAR' ? 'SELL' : 'BUY'
}

function checkFeedbackGate(request: any, handle: string, asset: string, suggestedCorrection: string) {
  const now = Date.now()
  const clientKey = hashValue(`${readClientIp(request)}|${normalizeOptionalText(request.headers['user-agent'], 120) ?? ''}`)
  let bucket = feedbackBuckets.get(clientKey)

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + FEEDBACK_RATE_WINDOW_MS, fingerprints: new Map() }
    feedbackBuckets.set(clientKey, bucket)
  }

  for (const [fingerprint, expiresAt] of bucket.fingerprints) {
    if (expiresAt <= now) bucket.fingerprints.delete(fingerprint)
  }

  const feedbackFingerprint = hashValue(`${handle.toLowerCase()}|${asset}|${suggestedCorrection.toLowerCase()}`)
  const duplicateUntil = bucket.fingerprints.get(feedbackFingerprint)
  if (duplicateUntil && duplicateUntil > now) {
    return {
      ok: false,
      status: 202,
      body: { ok: true, duplicate: true, message: 'Flag already received. Thanks.' },
    }
  }

  if (bucket.count >= FEEDBACK_MAX_PER_HOUR) {
    return {
      ok: false,
      status: 429,
      body: { error: 'Too many flags from this browser. Try again later.' },
    }
  }

  bucket.count += 1
  bucket.fingerprints.set(feedbackFingerprint, now + FEEDBACK_DUPLICATE_WINDOW_MS)
  pruneFeedbackBuckets(now)
  return { ok: true as const }
}

function readClientIp(request: any) {
  return visitorAddress(request.headers['x-forwarded-for'], request.ip ?? request.socket?.remoteAddress)
}

// A visitor, for counting their scans. The address is hashed with a secret, so what is stored cannot be turned back
// into an address.
function visitorKey(request: any) {
  // Shows how the host's proxy reports addresses, for checking the limit keys on the right one.
  if (process.env.DEBUG_VISITOR === '1') {
    console.log(`[visitor] ${JSON.stringify({ forwardedFor: request.headers['x-forwarded-for'], realIp: request.headers['x-real-ip'], ip: request.ip, envoy: request.headers['x-envoy-external-address'] })}`)
  }
  return hashValue(`${readClientIp(request)}|${process.env.DATABASE_URL ?? ''}`).slice(0, 32)
}

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function pruneFeedbackBuckets(now: number) {
  if (feedbackBuckets.size < 1000) return
  for (const [key, bucket] of feedbackBuckets) {
    if (bucket.resetAt <= now) feedbackBuckets.delete(key)
  }
}

// The bars if they arrive in time, else none. The fetch carries on into the cache either way.
function within(bars: Promise<Bar[]>, ms: number) {
  return Promise.race([bars, new Promise<Bar[]>((done) => setTimeout(() => done([]), ms))])
}

// Hyperliquid's mids, shared for a few seconds across feed loads. A failed fetch leaves every asset on its last close.
function currentMids() {
  if (!liveMids || liveMids.expiresAt <= Date.now()) {
    liveMids = { expiresAt: Date.now() + LIVE_MIDS_TTL_MS, mids: getLiveMids().catch(() => ({})) }
  }
  return liveMids.mids
}

type SummaryJob = { idea: string; asset: string; postsKey: string; posts: SummaryPost[] }

// The stored summary of each feed row that still matches its posts. A row whose posts changed gets a new summary
// written in the background, so the feed never waits on the model and shows it on a later load.
async function feedSummaries(calls: any[], accounts: any[]) {
  const names = new Map(accounts.map((account) => [account.handle, account.name]))
  const jobs = new Map<string, SummaryJob>()
  for (const call of calls) {
    const job: SummaryJob = jobs.get(call.idea) ?? { idea: call.idea, asset: call.asset, postsKey: '', posts: [] }
    job.posts.push({ name: names.get(call.handle) ?? call.handle, direction: call.direction, text: call.text })
    job.postsKey += `${call.tweet_id}:${call.direction},`
    jobs.set(call.idea, job)
  }
  for (const job of jobs.values()) job.postsKey = hashValue(job.postsKey).slice(0, 32)

  const stored = await getFeedSummaries([...jobs.keys()])
  const current = stored.filter((row: any) => jobs.get(row.asset)?.postsKey === row.posts_key)
  const done = new Set(current.map((row: any) => row.asset))
  const missing = [...jobs.values()].filter((job) => !done.has(job.idea) && !summaryJobs.has(job.idea))
  if (missing.length && summariesAreConfigured()) void writeSummaries(missing)
  return Object.fromEntries(current.map((row: any) => [row.asset, row.summary]))
}

async function writeSummaries(jobs: SummaryJob[]) {
  for (const job of jobs) summaryJobs.add(job.idea)
  await mapWithConcurrency(jobs, SUMMARY_CONCURRENCY, async (job) => {
    try {
      await saveFeedSummary({ asset: job.idea, postsKey: job.postsKey, summary: await summarizeIdea(job.asset, job.posts) })
    } catch (error) {
      console.error(`feed summary failed for ${job.idea}`, error)
    } finally {
      summaryJobs.delete(job.idea)
    }
  })
}

// Daily closes for a thread's chart, shared briefly across viewers so a popular profile is not one upstream fetch per open row.
function assetPrices(source: { asset_class: 'crypto' | 'stock'; source_id: string }, from: string) {
  const key = `${source.asset_class}:${source.source_id}:${dayKey(from)}`
  const cached = priceCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.bars
  const bars = getDailyBars({
    symbol: source.source_id,
    assetClass: source.asset_class,
    sourceId: source.source_id,
    name: null,
    provider: source.asset_class === 'crypto' ? 'hyperliquid' : 'yahoo',
  }, from).catch(() => [])
  priceCache.set(key, { expiresAt: Date.now() + PRICE_CACHE_TTL_MS, bars })
  return bars
}

function sanitizeRowContext(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  return {
    displayedAction: normalizeAction(input.displayedAction),
    displayedDirection: normalizeDirection(input.displayedDirection),
    mentions: clampNumber(input.mentions, 0, 0, 1_000_000),
    firstPitchAt: normalizeOptionalText(input.firstPitchAt, 80),
    returnPct: typeof input.returnPct === 'number' && Number.isFinite(input.returnPct) ? input.returnPct : null,
    stanceLabel: normalizeOptionalText(input.stanceLabel, 120),
  }
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized ? normalized.slice(0, maxLength) : null
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildServer()
  const worker = process.env.SCAN_WORKER_ENABLED === 'false' ? null : startWorkerLoop()
  // New posts are read by the same process that scans, so an API without a worker does not read them either.
  const poller = worker ? startPollLoop() : null
  if (worker) describeRegistry().catch((error) => console.error('describing the registry failed', error))
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' })
    console.log(`Called It API listening on http://localhost:${PORT}`)
  } catch (error) {
    worker?.stop()
    poller?.stop()
    throw error
  }
}
