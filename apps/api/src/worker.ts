import crypto from 'node:crypto'
import { candidatesFromTweets, classifyCandidates, getAuthorTimeline, getXUser, scoreCalls } from '@called-it/core'
import {
  claimNextScanJob,
  completeScanJob,
  failScanJob,
  persistScorecard,
  updateScanJob,
} from '@called-it/db'

const IDLE_DELAY_MS = 1500
const LOOKBACK_DAYS = Number(process.env.TWITTER_LOOKBACK_DAYS ?? 30)

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
  try {
    const handle = String(job.handle).toLowerCase()
    await updateScanJob(job.id, { stage: 'fetching_profile', progress: 12, progress_message: 'Reading X profile' })
    const user = await getXUser(handle)

    let seenTweets = 0
    await updateScanJob(job.id, { stage: 'fetching_tweets', progress: 20, progress_message: `Scanning ${LOOKBACK_DAYS} days of tweets` })
    const tweets = await getAuthorTimeline(handle, {
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
    })

    await updateScanJob(job.id, { stage: 'prefiltering', progress: 48, tweets_scanned: tweets.length, progress_message: 'Finding ticker mentions' })
    const candidates = candidatesFromTweets(tweets)
    await updateScanJob(job.id, { stage: 'classifying', progress: 55, candidates: candidates.length, progress_message: 'Classifying BULL and BEAR calls' })
    const classified = await classifyCandidates(candidates, {
      batchSize: Number(process.env.OPENAI_CLASSIFY_BATCH_SIZE ?? 12),
      concurrency: Number(process.env.OPENAI_CLASSIFY_CONCURRENCY ?? 4),
    })

    await updateScanJob(job.id, { stage: 'pricing', progress: 75, classified: classified.length, progress_message: 'Pricing first calls' })
    const { calls, stats } = await scoreCalls(user.handle, classified)

    await updateScanJob(job.id, { stage: 'persisting', progress: 92, calls_found: calls.length, priced_calls: calls.length, progress_message: 'Saving scorecard' })
    await persistScorecard({ user, classifiedTweets: classified, calls, stats })

    await completeScanJob(job.id)
  } catch (error) {
    await failScanJob(job.id, error)
    console.error('scan job failed', error)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
