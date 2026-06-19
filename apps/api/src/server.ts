import Fastify from 'fastify'
import cors from '@fastify/cors'
import { createHash } from 'node:crypto'
import { Mppx, tempo } from 'mppx/server'
import { migrate } from '@called-it/db/migrate'
import {
  createAssetFeedback,
  createOrReuseScanJob,
  getLeaderboard,
  getScanJob,
  getUserScorecard,
} from '@called-it/db'
import { getXUser, loadLocalEnv, parseXHandle } from '@called-it/core'
import { startWorkerLoop } from './worker'

loadLocalEnv()

const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 3001)
const PRICE = process.env.SCAN_PRICE ?? '2.00'
const ALLOW_DEV_PAID_SCAN = process.env.ALLOW_DEV_PAID_SCAN === 'true'
const FEEDBACK_MAX_PER_HOUR = clampNumber(process.env.FEEDBACK_MAX_PER_HOUR, 20, 1, 100)
const FEEDBACK_RATE_WINDOW_MS = 60 * 60 * 1000
const FEEDBACK_DUPLICATE_WINDOW_MS = 10 * 60 * 1000
const USDCE_MAINNET = '0x20c000000000000000000000b9537d11c60e8b50'
const RECIPIENT = process.env.RECIPIENT as `0x${string}` | undefined
const SECRET_KEY = process.env.MPP_SECRET_KEY
const feedbackBuckets = new Map<string, { count: number; resetAt: number; fingerprints: Map<string, number> }>()

const mppx = RECIPIENT && SECRET_KEY ? Mppx.create({
  secretKey: SECRET_KEY,
  methods: [tempo.charge({ currency: USDCE_MAINNET, recipient: RECIPIENT })],
}) : null

export async function buildServer() {
  await migrate()
  const app = Fastify({ logger: true })
  await app.register(cors, { origin: true })

  app.get('/health', async () => ({ ok: true, service: 'called-it-api' }))

  app.get('/api/leaderboard', async (request: any) => {
    const limit = clampNumber(request.query?.limit, 100, 1, 100)
    const offset = clampNumber(request.query?.offset, 0, 0, 10_000)
    return {
      leaderboard: await getLeaderboard({
        sort: request.query?.sort === 'hitrate' ? 'hitrate' : 'return',
        limit,
        offset,
      }),
      limit,
      offset,
    }
  })

  app.get('/api/users/:handle', async (request: any, reply) => {
    const scorecard = await getUserScorecard(parseXHandle(request.params.handle), {
      includeTweets: request.query?.tweets !== '0',
    })
    if (!scorecard) return reply.code(404).send({ error: 'Scorecard not found' })
    return scorecard
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

  app.get('/api/scan/:handle/precheck', async (request: any) => {
    const handle = parseXHandle(request.params.handle)
    const scorecard = await getUserScorecard(handle, { includeTweets: false })
    if (scorecard) return { ok: true, handle: scorecard.user.handle, cached: true, freeToView: true }
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
    const handle = parseXHandle(request.params.handle)
    const isDevPaid = ALLOW_DEV_PAID_SCAN && (request.headers['x-dev-paid'] === 'true' || request.query?.dev === '1')
    if (!isDevPaid) {
      if (!mppx) return reply.code(500).send({ error: 'MPP is not configured.' })
      const webRequest = fastifyToRequest(request)
      const result = await mppx.charge({ amount: PRICE, description: `Called It scan for @${handle}` })(webRequest)
      if (result.status === 402) return sendWebResponse(reply, result.challenge)
      const job = await createOrReuseScanJob({ handle, paidTx: 'mpp-verified', amountUsd: Number(PRICE) })
      return sendWebResponse(reply, result.withReceipt(Response.json({ jobId: job.id, handle, status: job.status })))
    }
    const job = await createOrReuseScanJob({ handle, paidTx: 'dev-paid', amountUsd: Number(PRICE) })
    return { jobId: job.id, handle, status: job.status }
  })

  return app
}

function fastifyToRequest(request: any) {
  const proto = request.headers['x-forwarded-proto'] ?? 'http'
  const host = request.headers.host ?? `localhost:${PORT}`
  const url = `${proto}://${host}${request.raw.url}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(key, value.join(', '))
    else if (value != null) headers.set(key, String(value))
  }
  return new Request(url, { method: request.method, headers })
}

async function sendWebResponse(reply: any, response: Response) {
  reply.code(response.status)
  response.headers.forEach((value, key) => reply.header(key, value))
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return reply.send(await response.json())
  return reply.send(await response.text())
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
