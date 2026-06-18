import Fastify from 'fastify'
import cors from '@fastify/cors'
import { Mppx, tempo } from 'mppx/server'
import { migrate } from '@called-it/db/migrate'
import {
  createOrReuseScanJob,
  getLeaderboard,
  getScanJob,
  getUserScorecard,
  hasFreshScorecard,
} from '@called-it/db'
import { getXUser, loadLocalEnv, parseXHandle } from '@called-it/core'
import { startWorkerLoop } from './worker'

loadLocalEnv()

const PORT = Number(process.env.API_PORT ?? 3001)
const PRICE = process.env.SCAN_PRICE ?? '2.00'
const USDCE_MAINNET = '0x20c000000000000000000000b9537d11c60e8b50'
const RECIPIENT = process.env.RECIPIENT as `0x${string}` | undefined
const SECRET_KEY = process.env.MPP_SECRET_KEY

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
    return { leaderboard: await getLeaderboard({ sort: request.query?.sort === 'hitrate' ? 'hitrate' : 'return' }) }
  })

  app.get('/api/users/:handle', async (request: any, reply) => {
    const scorecard = await getUserScorecard(parseXHandle(request.params.handle), {
      includeTweets: request.query?.tweets !== '0',
    })
    if (!scorecard) return reply.code(404).send({ error: 'Scorecard not found' })
    return scorecard
  })

  app.get('/api/jobs/:id', async (request: any, reply) => {
    const job = await getScanJob(request.params.id)
    if (!job) return reply.code(404).send({ error: 'Job not found' })
    return { job }
  })

  app.get('/api/scan/:handle/precheck', async (request: any) => {
    const handle = parseXHandle(request.params.handle)
    const cached = await hasFreshScorecard(handle)
    if (cached) return { ok: true, handle, cached: true, freeToView: true }
    const user = await getXUser(handle)
    return {
      ok: true,
      handle: user.handle,
      cached: false,
      profile: user,
      message: 'Ready to scan the last 30 days of tweets.',
    }
  })

  app.post('/api/scan/:handle', async (request: any, reply) => {
    const handle = parseXHandle(request.params.handle)
    const isDevPaid = request.headers['x-dev-paid'] === 'true' || request.query?.dev === '1'
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
