import Fastify from 'fastify'
import cors from '@fastify/cors'
import { createHash } from 'node:crypto'
import { migrate } from '@called-it/db/migrate'
import {
  createAssetFeedback,
  createOrReuseScanJob,
  getAssetThread,
  getFeed,
  getFeedSummaries,
  getLeaderboard,
  getScanJob,
  getUserScorecard,
  maybeEnqueueStaleRefreshes,
  saveFeedSummary,
} from '@called-it/db'
import { dayKey, directionalReturn, getDailyBars, getLiveMids, getXUser, liveQuote, loadLocalEnv, mapWithConcurrency, parseXHandle, summariesAreConfigured, summarizeIdea, type Bar, type SummaryPost } from '@called-it/core'
import { startWorkerLoop } from './worker'
import { corsOrigin, scanIsConfigured } from './config'

loadLocalEnv()

const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 3001)
const FEEDBACK_MAX_PER_HOUR = clampNumber(process.env.FEEDBACK_MAX_PER_HOUR, 20, 1, 100)
const FEEDBACK_RATE_WINDOW_MS = 60 * 60 * 1000
const FEEDBACK_DUPLICATE_WINDOW_MS = 10 * 60 * 1000
const PRICE_CACHE_TTL_MS = 10 * 60 * 1000
const FEED_CHART_DAYS = 14
const LIVE_MIDS_TTL_MS = 5000
let liveMids: { expiresAt: number; mids: Promise<Record<string, number>> } | null = null
const SUMMARY_CONCURRENCY = 4
// Assets whose summary is being written, so concurrent feed loads do not each ask the model.
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
    const { calls: stored, accounts, sources } = await getFeed({ horizon })
    const from = new Date(Date.now() - FEED_CHART_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const mids = await currentMids()
    // Daily closes per asset for the row's price line, as [time, close].
    const prices: Record<string, [number, number][]> = {}
    // Where each asset trades now: Hyperliquid's live mid where it quotes the asset, else the last exchange close.
    // `coin` names the Hyperliquid feed the page can follow from there.
    const live: Record<string, { coin: string | null; price: number }> = {}
    await Promise.all(sources.map(async (source: any) => {
      const bars = await assetPrices(source, from)
      const lastClose = bars.at(-1)?.close
      const quote = liveQuote(source, mids, lastClose)
      prices[source.asset] = bars.map((bar) => [bar.t, bar.close])
      const price = quote?.price ?? lastClose
      if (price) live[source.asset] = { coin: quote?.coin ?? null, price }
    }))
    // The move since each call is measured to that price, not to the price stored at the account's last scan.
    const calls = stored.map((call: any) => (
      live[call.asset] ? { ...call, return_pct: directionalReturn(call.direction, call.entry_price, live[call.asset].price) } : call
    ))
    return { horizon, calls, accounts, prices, live, summaries: await feedSummaries(calls, accounts) }
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
    return { asset, callouts: thread.callouts, prices: await assetPrices(thread.source, thread.callouts[0].created_at) }
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
    const job = await createOrReuseScanJob({ handle })
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
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim()
  if (Array.isArray(forwarded) && forwarded[0]) return String(forwarded[0]).split(',')[0].trim()
  return request.ip ?? request.socket?.remoteAddress ?? 'unknown'
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

// Hyperliquid's mids, shared for a few seconds across feed loads. A failed fetch leaves every asset on its last close.
function currentMids() {
  if (!liveMids || liveMids.expiresAt <= Date.now()) {
    liveMids = { expiresAt: Date.now() + LIVE_MIDS_TTL_MS, mids: getLiveMids().catch(() => ({})) }
  }
  return liveMids.mids
}

type SummaryJob = { asset: string; postsKey: string; posts: SummaryPost[] }

// The stored summary of each asset that still matches its posts. An asset whose posts changed gets a new summary
// written in the background, so the feed never waits on the model and shows it on a later load.
async function feedSummaries(calls: any[], accounts: any[]) {
  const names = new Map(accounts.map((account) => [account.handle, account.name]))
  const jobs = new Map<string, SummaryJob>()
  for (const call of calls) {
    const job: SummaryJob = jobs.get(call.asset) ?? { asset: call.asset, postsKey: '', posts: [] }
    job.posts.push({ name: names.get(call.handle) ?? call.handle, direction: call.direction, text: call.text })
    job.postsKey += `${call.tweet_id}:${call.direction},`
    jobs.set(call.asset, job)
  }
  for (const job of jobs.values()) job.postsKey = hashValue(job.postsKey).slice(0, 32)

  const stored = await getFeedSummaries([...jobs.keys()])
  const current = stored.filter((row: any) => jobs.get(row.asset)?.postsKey === row.posts_key)
  const done = new Set(current.map((row: any) => row.asset))
  const missing = [...jobs.values()].filter((job) => !done.has(job.asset) && !summaryJobs.has(job.asset))
  if (missing.length && summariesAreConfigured()) void writeSummaries(missing)
  return Object.fromEntries(current.map((row: any) => [row.asset, row.summary]))
}

async function writeSummaries(jobs: SummaryJob[]) {
  for (const job of jobs) summaryJobs.add(job.asset)
  await mapWithConcurrency(jobs, SUMMARY_CONCURRENCY, async (job) => {
    try {
      await saveFeedSummary({ asset: job.asset, postsKey: job.postsKey, summary: await summarizeIdea(job.asset, job.posts) })
    } catch (error) {
      console.error(`feed summary failed for ${job.asset}`, error)
    } finally {
      summaryJobs.delete(job.asset)
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
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' })
    console.log(`Called It API listening on http://localhost:${PORT}`)
  } catch (error) {
    worker?.stop()
    throw error
  }
}
