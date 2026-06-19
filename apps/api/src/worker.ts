import crypto from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { candidatesFromTweets, classifyCandidates, filterIgnoredCashtags, getAuthorTimeline, getXUser, refreshExistingCallPrices, scoreCalls } from '@called-it/core'
import {
  claimNextScanJob,
  completeScanJob,
  failScanJob,
  getCallsForPriceRefresh,
  persistScorecard,
  persistPriceRefresh,
  updateScanJob,
} from '@called-it/db'

const IDLE_DELAY_MS = 1500
const LOOKBACK_DAYS = Number(process.env.TWITTER_LOOKBACK_DAYS ?? 365)
const LATENCY_STAGES = ['profile_fetch', 'tweet_fetch', 'prefilter', 'classification', 'pricing_scoring', 'persistence'] as const

type LatencyStage = (typeof LATENCY_STAGES)[number]
type StageTiming = { stage: LatencyStage; durationMs: number; status: 'complete' | 'failed' }

export function startWorkerLoop({ concurrency = Number(process.env.SCAN_WORKER_CONCURRENCY ?? 1), workerId = crypto.randomUUID() } = {}) {
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

export async function processJob(job: any) {
  if (job.job_type === 'price_refresh') return processPriceRefreshJob(job)
  return processFullScanJob(job)
}

async function processPriceRefreshJob(job: any) {
  const handle = String(job.handle).toLowerCase()
  const latency = createScanLatencyLogger({ jobId: job.id, handle })
  try {
    await updateScanJob(job.id, { stage: 'pricing', progress: 20, progress_message: 'Refreshing prices' })
    const storedCalls = await getCallsForPriceRefresh(handle)
    const calls = await latency.measure('pricing_scoring', () => refreshExistingCallPrices(storedCalls.map(toScoredCall)))

    await updateScanJob(job.id, {
      stage: 'persisting',
      progress: 90,
      calls_found: storedCalls.length,
      priced_calls: calls.length,
      progress_message: 'Saving refreshed prices',
    })
    await latency.measure('persistence', () => persistPriceRefresh(handle, calls))

    await completeScanJob(job.id)
    latency.logSummary('done')
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

    let seenTweets = 0
    await updateScanJob(job.id, { stage: 'fetching_tweets', progress: 20, progress_message: `Scanning ${LOOKBACK_DAYS} days of tweets` })
    const tweets = await latency.measure('tweet_fetch', () => getAuthorTimeline(handle, {
      days: LOOKBACK_DAYS,
      onPage(page) {
        seenTweets += page.length
        updateScanJob(job.id, {
          stage: 'fetching_tweets',
          progress: Math.min(45, 20 + Math.floor(seenTweets / 100)),
          progress_message: `Scanning ${LOOKBACK_DAYS} days of tweets`,
          tweets_scanned: seenTweets,
        }).catch(() => {})
      },
    }))

    await updateScanJob(job.id, { stage: 'prefiltering', progress: 48, tweets_scanned: tweets.length, progress_message: 'Finding ticker mentions' })
    const candidates = await latency.measure('prefilter', () => candidatesFromTweets(tweets))
    await updateScanJob(job.id, { stage: 'classifying', progress: 55, candidates: candidates.length, progress_message: 'Classifying BULL and BEAR calls' })
    const classified = await latency.measure('classification', async () => filterIgnoredCashtags(user.handle, await classifyCandidates(candidates, {
      batchSize: Number(process.env.OPENAI_CLASSIFY_BATCH_SIZE ?? 12),
      concurrency: Number(process.env.OPENAI_CLASSIFY_CONCURRENCY ?? 4),
    })))

    await updateScanJob(job.id, { stage: 'pricing', progress: 75, classified: classified.length, progress_message: 'Pricing first calls' })
    const { calls, stats } = await latency.measure('pricing_scoring', () => scoreCalls(user.handle, classified))

    await updateScanJob(job.id, { stage: 'persisting', progress: 92, calls_found: calls.length, priced_calls: calls.length, progress_message: 'Saving scorecard' })
    await latency.measure('persistence', () => persistScorecard({ user, classifiedTweets: classified, calls, stats }))

    await completeScanJob(job.id)
    latency.logSummary('done')
  } catch (error) {
    await failScanJob(job.id, error)
    console.error('scan job failed', error)
    latency.logSummary('error', error)
  }
}

function toScoredCall(row: any) {
  return {
    handle: row.handle,
    asset: row.asset,
    assetClass: row.asset_class,
    sourceId: row.source_id,
    direction: row.direction,
    firstPitchAt: row.first_pitch_at,
    firstTweetId: row.first_tweet_id,
    entryPrice: row.entry_price,
    currentPrice: row.current_price,
    returnPct: row.return_pct,
    isUp: row.is_up,
    mentions: row.mentions,
    bulls: row.bulls,
    bears: row.bears,
    pricedAt: row.priced_at,
  }
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
