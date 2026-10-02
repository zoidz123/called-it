import {
  candidatesFromTweets,
  classifyCandidates,
  filterIgnoredCashtags,
  getPostsSince,
  scoreCalls,
  type Tweet,
  type XUser,
} from '@called-it/core'
import {
  createOrReuseScanJob,
  getStoredClassifiedTweets,
  getTrackedAccounts,
  hasRecentRefreshJob,
  markScanned,
  persistScorecard,
} from '@called-it/db'
import { settledCallouts, storedInstruments } from './worker'

const POLL_MINUTES = Number(process.env.FEED_POLL_MINUTES ?? 15)
// X's search can list a post a little after it was written, so each read reaches back past the last one.
const OVERLAP_MS = 5 * 60 * 1000
// An account not read for this long is caught up by an ordinary scan job; the shared read would otherwise re-read
// that whole gap for every account.
const MAX_GAP_MS = 6 * 60 * 60 * 1000
const SEEN_TTL_MS = 60 * 60 * 1000

type Tracked = { user: XUser; lastScannedAt: string }

// Posts already handled, so the overlap between reads is not classified twice.
const seen = new Map<string, number>()

// Reads every tracked account's new posts on a timer. Zero minutes turns it off.
export function startPollLoop({ minutes = POLL_MINUTES } = {}) {
  if (!(minutes > 0)) return { stop() {} }
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const tick = async () => {
    try {
      await pollOnce()
    } catch (error) {
      console.error('feed poll failed', error)
    }
    if (!stopped) timer = setTimeout(tick, minutes * 60 * 1000)
  }
  tick()
  return { stop() { stopped = true; clearTimeout(timer) } }
}

// One read: a shared search for every recently read account, then classification and rescoring for the accounts
// that posted a call. Accounts too far behind get a scan job instead.
export async function pollOnce(now = Date.now()) {
  const { fresh, stale } = splitByGap(await getTrackedAccounts(), now)
  for (const { user } of stale) {
    if (!(await hasRecentRefreshJob(user.handle, 'full_scan'))) await createOrReuseScanJob({ handle: user.handle })
  }
  if (!fresh.length) return

  const since = new Date(Math.min(...fresh.map((account) => Date.parse(account.lastScannedAt))) - OVERLAP_MS)
  const posts = await getPostsSince(fresh.map((account) => account.user.handle), since)
  for (const [id, at] of seen) if (now - at > SEEN_TTL_MS) seen.delete(id)

  const read: string[] = []
  let found = 0
  let calls = 0
  for (const { user } of fresh) {
    const tweets = (posts.get(user.handle) ?? []).filter((tweet) => !seen.has(tweet.id))
    try {
      calls += await ingest(user, tweets)
      for (const tweet of tweets) seen.set(tweet.id, now)
      read.push(user.handle)
      found += tweets.length
    } catch (error) {
      // Left unmarked, so the next read covers these posts again.
      console.error(`feed poll failed for @${user.handle}`, error)
    }
  }
  await markScanned(read, new Date(now).toISOString())
  console.log(`[feed-poll] accounts=${fresh.length} read=${read.length} behind=${stale.length} posts=${found} calls=${calls}`)
}

export function splitByGap(accounts: Tracked[], now: number) {
  const fresh = accounts.filter((account) => now - Date.parse(account.lastScannedAt) <= MAX_GAP_MS)
  return { fresh, stale: accounts.filter((account) => !fresh.includes(account)) }
}

// Classifies an account's new posts and, when any of them is a call, rescores the account over everything stored.
// Returns how many new posts were calls.
async function ingest(user: XUser, tweets: Tweet[]) {
  const candidates = candidatesFromTweets(tweets)
  if (!candidates.length) return 0
  const stored = await getStoredClassifiedTweets(user.handle)
  const storedIds = new Set(stored.map((tweet) => tweet.id))
  const classified = filterIgnoredCashtags(user.handle, await classifyCandidates(candidates.filter((tweet) => !storedIds.has(tweet.id))))
  if (!classified.length) return 0
  const [resolved, settled] = await Promise.all([storedInstruments(user.handle), settledCallouts(user.handle)])
  const { calls } = await scoreCalls(user.handle, [...stored, ...classified], { resolved, resolveMissing: true, settled })
  await persistScorecard({ user, classifiedTweets: classified, calls })
  return classified.length
}
