import {
  candidatesFromTweets,
  classifyCandidates,
  filterIgnoredCashtags,
  getPostsSince,
  getPriceSeries,
  mapWithConcurrency,
  type Tweet,
  type XUser,
} from '@called-it/core'
import {
  createOrReuseScanJob,
  getStaleSeries,
  getStoredClassifiedTweets,
  getTrackedAccounts,
  hasRecentRefreshJob,
  markScanned,
  persistScorecard,
  queueStaleRescores,
} from '@called-it/db'
import { scoreAccount } from './worker'

const POLL_MINUTES = Number(process.env.FEED_POLL_MINUTES ?? 15)
// X's search can list a post a little after it was written, so each read reaches back past the last one.
const OVERLAP_MS = 5 * 60 * 1000
// An account not read for this long is caught up by an ordinary scan job; the shared read would otherwise re-read
// that whole gap for every account.
const MAX_GAP_MS = 6 * 60 * 60 * 1000
const SEEN_TTL_MS = 60 * 60 * 1000
// Every account is rescored at least this often, a few each read so they do not all price at once.
const RESCORE_AFTER_HOURS = 24
const RESCORES_PER_READ = 10
// Stored prices older than this are brought up to date in the background, a batch each read, so a scan or a
// rescore finds most of what it needs already there.
const PRICES_STALE_MINUTES = 180
const PRICES_PER_READ = 60
const PRICE_REFRESH_CONCURRENCY = 4
let refreshingPrices = false

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
      // Rescoring needs no provider credits, so it runs even when reading new posts fails.
      const rescoring = await queueStaleRescores({ afterHours: RESCORE_AFTER_HOURS, limit: RESCORES_PER_READ })
      if (rescoring.length) console.log(`[feed-poll] rescoring=${rescoring.length}`)
      void refreshStalePrices()
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
  for (const { user } of stale) await catchUp(user.handle)
  if (!fresh.length) return

  const since = new Date(Math.min(...fresh.map((account) => Date.parse(account.lastScannedAt))) - OVERLAP_MS)
  const { posts, truncated } = await getPostsSince(fresh.map((account) => account.user.handle), since)
  for (const [id, at] of seen) if (now - at > SEEN_TTL_MS) seen.delete(id)

  // A search cut off at its page limit left older posts unread. Its accounts keep their old read time and are caught
  // up by a scan, which reads the whole gap; marking them read here would skip those posts for good.
  const cutOff = new Set(truncated.map((handle) => handle.toLowerCase()))
  for (const handle of cutOff) await catchUp(handle)

  const read: string[] = []
  let found = 0
  let calls = 0
  for (const { user } of fresh) {
    const tweets = postsReadFor(user.handle, posts, cutOff)
    if (!tweets) continue
    const unseen = tweets.filter((tweet) => !seen.has(tweet.id))
    try {
      calls += await ingest(user, unseen)
      for (const tweet of unseen) seen.set(tweet.id, now)
      read.push(user.handle)
      found += unseen.length
    } catch (error) {
      // Left unmarked, so the next read covers these posts again.
      console.error(`feed poll failed for @${user.handle}`, error)
    }
  }
  await markScanned(read, new Date(now).toISOString())
  console.log(`[feed-poll] accounts=${fresh.length} read=${read.length} behind=${stale.length + cutOff.size} posts=${found} calls=${calls}`)
}

// Queues an ordinary scan for an account the shared read cannot cover, at most once per refresh cooldown.
async function catchUp(handle: string) {
  if (!(await hasRecentRefreshJob(handle, 'full_scan'))) await createOrReuseScanJob({ handle })
}

// getPostsSince keys its posts and its cut-off list with lowercase handles. The stored handle can differ in case.
// A cut-off account returns null so its read time stays put; any other account returns the posts found for it.
export function postsReadFor<T extends { id: string }>(handle: string, posts: Map<string, T[]>, cutOff: Set<string>): T[] | null {
  const key = handle.toLowerCase()
  if (cutOff.has(key)) return null
  return posts.get(key) ?? []
}

// Brings the oldest stored price histories up to date. It runs beside the read of new posts and never holds it up.
async function refreshStalePrices() {
  if (refreshingPrices) return
  refreshingPrices = true
  try {
    const stale = await getStaleSeries({ olderThanMinutes: PRICES_STALE_MINUTES, limit: PRICES_PER_READ })
    await mapWithConcurrency(stale, PRICE_REFRESH_CONCURRENCY, (row: any) => (
      getPriceSeries({ symbol: row.source_id, assetClass: row.asset_class, sourceId: row.source_id, name: null }, row.since)
    ))
    if (stale.length) console.log(`[feed-poll] prices refreshed=${stale.length}`)
  } catch (error) {
    console.error('refreshing stored prices failed', error)
  } finally {
    refreshingPrices = false
  }
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
  const { calls, finish } = await scoreAccount(user.handle, [...stored, ...classified], { resolveMissing: true })
  await persistScorecard({ user, classifiedTweets: classified, calls })
  finish?.().catch((error) => console.error(`pricing tokens failed for @${user.handle}`, error))
  return classified.length
}
