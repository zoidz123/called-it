import crypto from 'node:crypto'
import { performance } from 'node:perf_hooks'
import {
  candidatesFromTweets,
  classifyCandidates,
  describeInstrument,
  filterIgnoredCashtags,
  getAuthorTimeline,
  getXUser,
  requiredAnyEnv,
  requiredEnv,
  scoreCalls,
  settledKey,
  type ClassifiedTweet,
  type ResolvedAsset,
  type SettledCallout,
} from '@called-it/core'
import {
  claimNextScanJob,
  completeScanJob,
  dropAssetCalls,
  getAccountPins,
  getUndescribedInstruments,
  getTickerRegistry,
  recordInstruments,
  touchScanJob,
  failScanJob,
  getLastScannedAt,
  getSettledCallouts,
  getStoredAssetSources,
  getStoredClassifiedTweets,
  persistScorecard,
  persistRescore,
  updateScanJob,
} from '@called-it/db'
import { TWITTER_KEY_NAMES } from './config'

const IDLE_DELAY_MS = 1500
const DAY_MS = 24 * 60 * 60 * 1000
const LOOKBACK_DAYS = Number(process.env.TWITTER_LOOKBACK_DAYS ?? 365)
const LATENCY_STAGES = ['profile_fetch', 'tweet_fetch', 'prefilter', 'classification', 'pricing_scoring', 'persistence'] as const

type LatencyStage = (typeof LATENCY_STAGES)[number]
type StageTiming = { stage: LatencyStage; durationMs: number; status: 'complete' | 'failed' }

export function startWorkerLoop({ concurrency = Number(process.env.SCAN_WORKER_CONCURRENCY ?? 1), workerId = crypto.randomUUID() } = {}) {
  requiredEnv('TYPESAFE_API_KEY')
  requiredAnyEnv(TWITTER_KEY_NAMES)
  const controllers = Array.from({ length: Math.max(1, concurrency) }, () => ({ stopped: false }))
  for (const controller of controllers) runLoop({ controller, workerId })
  return { stop: () => controllers.forEach((controller) => { controller.stopped = true }) }
}

async function runLoop({ controller, workerId }: { controller: { stopped: boolean }; workerId: string }) {
  while (!controller.stopped) {
    try {
      const job = await claimNextScanJob(workerId)
      if (!job) {
        await sleep(IDLE_DELAY_MS)
        continue
      }
      await processJob(job)
    } catch (error) {
      console.error('worker loop failed', error)
      await sleep(IDLE_DELAY_MS)
    }
  }
}

// While a job runs it reports in, so that a job gone silent can be told from one that is merely slow and picked
// up again by another worker.
const HEARTBEAT_MS = 30_000

export async function processJob(job: any) {
  const heartbeat = setInterval(() => { touchScanJob(job.id).catch(() => {}) }, HEARTBEAT_MS)
  try {
    if (job.job_type === 'price_refresh') return await processPriceRefreshJob(job)
    return await processFullScanJob(job)
  } finally {
    clearInterval(heartbeat)
  }
}

// Scores an account without waiting on its on-chain tokens. Those are priced through a slow, rate limited venue, so
// when their prices are not already stored they are left for `finish`, which the caller runs after the scorecard is
// saved. Their calls from an earlier run stay in place until then.
export async function scoreAccount(
  handle: string,
  tweets: ClassifiedTweet[],
  { resolveMissing = false, onProgress }: { resolveMissing?: boolean; onProgress?: (done: number, total: number) => void } = {},
) {
  const { resolved, settled } = await scoringState(handle)
  const scored = await scoreCalls(handle, tweets, { resolved, settled, resolveMissing, registryFor: resolveMissing ? getTickerRegistry : undefined, deferSlow: true, onProgress })
  await recordInstruments(scored.instruments)
  const { deferred } = scored
  const finish = deferred.length ? async () => {
    const rest = await scoreCalls(handle, tweets, { resolved: scored.resolved, settled, only: deferred })
    if (rest.calls.length) await persistRescore(handle, rest.calls)
    console.log(`[scan-latency] tokens priced handle=@${handle} assets=${deferred.length} calls=${rest.calls.length}`)
  } : null
  return { calls: scored.calls, finish }
}

function runInBackground(handle: string, finish: (() => Promise<void>) | null) {
  finish?.().catch((error) => console.error(`pricing tokens failed for @${handle}`, error))
}

async function processPriceRefreshJob(job: any) {
  const handle = String(job.handle).toLowerCase()
  const latency = createScanLatencyLogger({ jobId: job.id, handle })
  try {
    await updateScanJob(job.id, { stage: 'pricing', progress: 20, progress_message: 'Refreshing prices' })
    const tweets = await getStoredClassifiedTweets(handle)
    const { calls, finish } = await latency.measure('pricing_scoring', () => scoreAccount(handle, tweets))

    await updateScanJob(job.id, {
      stage: 'persisting',
      progress: 90,
      calls_found: calls.length,
      priced_calls: calls.length,
      progress_message: 'Saving refreshed prices',
    })
    await latency.measure('persistence', () => persistRescore(handle, calls))

    await completeScanJob(job.id)
    latency.logSummary('done')
    runInBackground(handle, finish)
  } catch (error) {
    await failScanJob(job.id, error)
    console.error('price refresh job failed', error)
    latency.logSummary('error', error)
  }
}

async function processFullScanJob(job: any) {
  const handle = String(job.handle).toLowerCase()
  const latency = createScanLatencyLogger({ jobId: job.id, handle })
  try {
    await updateScanJob(job.id, { stage: 'fetching_profile', progress: 12, progress_message: 'Reading X profile' })
    const user = await latency.measure('profile_fetch', () => getXUser(handle))

    // A known account is only read since its last scan, with a day of overlap. Its earlier posts are already stored.
    const lastScannedAt = await getLastScannedAt(handle)
    const days = lastScannedAt
      ? Math.min(LOOKBACK_DAYS, Math.ceil((Date.now() - Date.parse(lastScannedAt)) / DAY_MS) + 1)
      : LOOKBACK_DAYS
    const stored = lastScannedAt ? await getStoredClassifiedTweets(handle) : []
    const storedIds = new Set(stored.map((tweet) => tweet.id))

    let seenTweets = 0
    await updateScanJob(job.id, { stage: 'fetching_tweets', progress: 20, progress_message: `Scanning ${days} days of tweets` })
    const tweets = await latency.measure('tweet_fetch', () => getAuthorTimeline(handle, {
      days,
      onPage(page) {
        seenTweets += page.length
        updateScanJob(job.id, {
          stage: 'fetching_tweets',
          progress: Math.min(45, 20 + Math.floor(seenTweets / 100)),
          progress_message: `Scanning ${days} days of tweets`,
          tweets_scanned: seenTweets,
        }).catch(() => {})
      },
    }))

    await updateScanJob(job.id, { stage: 'prefiltering', progress: 48, tweets_scanned: tweets.length, progress_message: 'Finding ticker mentions' })
    const candidates = await latency.measure('prefilter', () => candidatesFromTweets(tweets).filter((tweet) => !storedIds.has(tweet.id)))
    await updateScanJob(job.id, { stage: 'classifying', progress: 55, candidates: candidates.length, progress_message: 'Classifying BULL and BEAR calls' })
    const classified = await latency.measure('classification', async () => filterIgnoredCashtags(user.handle, await classifyCandidates(candidates)))

    await updateScanJob(job.id, { stage: 'pricing', progress: 75, classified: classified.length, progress_message: 'Pricing first calls' })
    const { calls, finish } = await latency.measure('pricing_scoring', () => scoreAccount(user.handle, [...stored, ...classified], {
      resolveMissing: true,
      onProgress(done, total) {
        updateScanJob(job.id, { progress: 75 + Math.floor((15 * done) / total), progress_message: `Pricing ${done} of ${total} assets` }).catch(() => {})
      },
    }))

    await updateScanJob(job.id, { stage: 'persisting', progress: 92, calls_found: calls.length, priced_calls: calls.length, progress_message: 'Saving scorecard' })
    await latency.measure('persistence', () => persistScorecard({ user, classifiedTweets: classified, calls }))

    await completeScanJob(job.id)
    latency.logSummary('done')
    runInBackground(handle, finish)
  } catch (error) {
    await failScanJob(job.id, error)
    console.error('scan job failed', error)
    latency.logSummary('error', error)
  }
}

// Fills in what each instrument in the registry is, for the ones entered before it recorded that. One whose venue
// does not answer is left as it is and tried again the next time the worker starts.
export async function describeRegistry() {
  for (const instrument of await getUndescribedInstruments()) {
    try {
      const described = await describeInstrument({ ticker: instrument.symbol, assetClass: instrument.assetClass, sourceId: instrument.sourceId })
      if (described) await recordInstruments([{ ...instrument, ...described }])
    } catch (error) {
      console.error(`could not describe ${instrument.symbol} ${instrument.sourceId}`, error)
    }
  }
}

// What an account is scored against: the instrument each of its tickers is priced on, and its results that are
// already final. A correction pinned by hand replaces the stored instrument, and that ticker's old rows and results
// go with it, since they belonged to the other instrument.
export async function scoringState(handle: string) {
  const [resolved, settled, pins] = await Promise.all([storedInstruments(handle), settledCallouts(handle), getAccountPins(handle)])
  const moved = [...pins].flatMap(([asset, pin]) => {
    const stored = resolved.get(asset)
    return stored && (stored.sourceId !== pin.sourceId || stored.assetClass !== pin.assetClass) ? [asset] : []
  })
  if (moved.length) {
    await dropAssetCalls(handle, moved)
    for (const key of [...settled.keys()]) if (moved.includes(key.split('|')[1])) settled.delete(key)
  }
  for (const [asset, pin] of pins) resolved.set(asset, { ...pin, resolvedBy: 'pin' })
  return { resolved, settled }
}

// The instrument each of a handle's assets was priced against at its last scan.
async function storedInstruments(handle: string) {
  const sources = await getStoredAssetSources(handle)
  return new Map(sources.map((row: any): [string, ResolvedAsset] => [row.asset, {
    symbol: row.asset,
    assetClass: row.asset_class,
    sourceId: row.source_id,
    name: null,
    provider: row.asset_class === 'crypto' ? 'hyperliquid' : 'yahoo',
  }]))
}

async function settledCallouts(handle: string) {
  const rows = await getSettledCallouts(handle)
  return new Map(rows.map((row: any): [string, SettledCallout] => [settledKey(row.tweet_id, row.asset, row.direction), {
    entryPrice: row.entry_price,
    entryAt: row.entry_at,
    return7d: row.return_7d,
    return30d: row.return_30d,
    return90d: row.return_90d,
  }]))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createScanLatencyLogger({ jobId, handle }: { jobId: string; handle: string }) {
  const startedAt = performance.now()
  const timings: StageTiming[] = []

  return {
    async measure<T>(stage: LatencyStage, work: () => T | Promise<T>): Promise<T> {
      const stageStartedAt = performance.now()
      let status: StageTiming['status'] = 'complete'
      try {
        return await work()
      } catch (error) {
        status = 'failed'
        throw error
      } finally {
        const durationMs = Math.round(performance.now() - stageStartedAt)
        timings.push({ stage, durationMs, status })
        console.log(`[scan-latency] stage ${status} job=${jobId} handle=@${handle} stage=${stage} durationMs=${durationMs}`)
      }
    },
    logSummary(status: 'done' | 'error', error?: unknown) {
      const totalMs = Math.round(performance.now() - startedAt)
      const longest = timings.reduce<StageTiming | null>((current, timing) => {
        if (!current || timing.durationMs > current.durationMs) return timing
        return current
      }, null)
      const stages = timings.map((timing) => `${timing.stage}:${timing.durationMs}ms:${timing.status}`).join(',')
      const errorMessage = error ? ` error=${JSON.stringify(error instanceof Error ? error.message : String(error))}` : ''
      console.log(`[scan-latency] job complete job=${jobId} handle=@${handle} status=${status} totalMs=${totalMs} longestStage=${longest?.stage ?? 'none'} longestStageMs=${longest?.durationMs ?? 0} stages=${stages || 'none'}${errorMessage}`)
    },
  }
}
