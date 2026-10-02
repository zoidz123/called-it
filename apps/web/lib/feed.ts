// One call in the feed: one post's stance on one asset, with what its account had posted on that asset before it.
export type FeedCall = {
  tweet_id: string
  handle: string
  asset: string
  // The instrument this account's calls on the asset are priced against, and the feed row that puts the call in:
  // the ticker as that instrument. Accounts can mean different instruments by one ticker.
  asset_class: 'crypto' | 'stock'
  source_id: string
  idea: string
  direction: 'BULL' | 'BEAR'
  created_at: string
  entry_price: number
  // The move since the call, with a bearish call counted as a short.
  return_pct: number
  text: string
  url: string
  // Earlier posts by this account on this asset, and how many of them went the same way as this one.
  prior: number
  prior_same: number
  // How those earlier posts did at the chosen holding period. Posts too recent to have settled are in neither count.
  wins: number
  losses: number
  avg_return: number | null
}

export type FeedAccount = { handle: string; name: string; avatar_url: string | null }

// One account behind an idea: where it stands now, and its record on the asset before this week.
export type FeedCaller = {
  handle: string
  direction: 'BULL' | 'BEAR'
  prior: number
  wins: number
  losses: number
  avgReturn: number | null
}

// One asset, as one instrument, and everything the tracked accounts said about it this week.
export type FeedIdea = {
  key: string
  asset: string
  assetClass: 'crypto' | 'stock'
  sourceId: string
  // Best record on the asset first; accounts with no settled calls on it last, longest history first.
  callers: FeedCaller[]
  bulls: number
  bears: number
  // The average move since each call.
  since: number
  firstCallAt: string
  latestCallAt: string
  // Newest first.
  calls: FeedCall[]
}

export type FeedRank = 'called' | 'record' | 'new' | 'contested'

// A ticker an account has posted about this often is habit more than news.
const REPEAT_POSTS = 25
// A record on an asset needs this many settled calls before an idea is ranked by it.
const RANKED_RECORD_CALLS = 5

// How often the account has posted about the asset, once that is often enough to be habit. A plain count: it does
// not depend on how any post was classified.
export function repeatLabel(call: FeedCall) {
  return call.prior >= REPEAT_POSTS ? `${ordinal(call.prior + 1)} post on ${call.asset}` : null
}

const record = (caller: FeedCaller) => caller.avgReturn ?? Number.NEGATIVE_INFINITY

// Groups the week's calls by the instrument they are priced against, so a ticker two accounts mean differently
// makes two rows. `calls` must be newest first.
export function buildIdeas(calls: FeedCall[]): FeedIdea[] {
  const byIdea = new Map<string, FeedCall[]>()
  for (const call of calls) byIdea.set(call.idea, [...(byIdea.get(call.idea) ?? []), call])

  return [...byIdea.entries()].map(([key, assetCalls]) => {
    const { asset, asset_class: assetClass, source_id: sourceId } = assetCalls[0]
    const byHandle = new Map<string, FeedCall[]>()
    for (const call of assetCalls) byHandle.set(call.handle, [...(byHandle.get(call.handle) ?? []), call])
    const callers = [...byHandle.entries()].map(([handle, own]): FeedCaller => {
      // The latest call is where the account stands. The earliest carries its record from before this week.
      const earliest = own[own.length - 1]
      return { handle, direction: own[0].direction, prior: earliest.prior, wins: earliest.wins, losses: earliest.losses, avgReturn: earliest.avg_return }
    }).sort((a, b) => record(b) - record(a) || b.prior - a.prior || a.handle.localeCompare(b.handle))
    const bulls = callers.filter((caller) => caller.direction === 'BULL').length
    return {
      key,
      asset,
      assetClass,
      sourceId,
      callers,
      bulls,
      bears: callers.length - bulls,
      since: assetCalls.reduce((sum, call) => sum + call.return_pct, 0) / assetCalls.length,
      firstCallAt: assetCalls[assetCalls.length - 1].created_at,
      latestCallAt: assetCalls[0].created_at,
      calls: assetCalls,
    }
  })
}

// The best record on the asset among callers with enough settled calls for it to mean something.
function bestRecord(idea: FeedIdea) {
  const records = idea.callers.filter((caller) => caller.avgReturn !== null && caller.wins + caller.losses >= RANKED_RECORD_CALLS)
  return records.length ? Math.max(...records.map((caller) => caller.avgReturn ?? 0)) : null
}

export function rankIdeas(ideas: FeedIdea[], rank: FeedRank): FeedIdea[] {
  const byCalled = (a: FeedIdea, b: FeedIdea) => b.callers.length - a.callers.length || b.calls.length - a.calls.length || a.asset.localeCompare(b.asset)
  if (rank === 'record') {
    return ideas
      .flatMap((idea) => { const best = bestRecord(idea); return best === null ? [] : [{ idea, best }] })
      .sort((a, b) => b.best - a.best || byCalled(a.idea, b.idea))
      .map(({ idea }) => idea)
  }
  if (rank === 'new') {
    return ideas
      .filter((idea) => idea.callers.some((caller) => caller.prior === 0))
      .sort((a, b) => b.latestCallAt.localeCompare(a.latestCallAt) || byCalled(a, b))
  }
  if (rank === 'contested') return ideas.filter((idea) => idea.bulls > 0 && idea.bears > 0).sort(byCalled)
  return [...ideas].sort(byCalled)
}

// What kind of instrument a row is, for telling apart two rows that share a ticker.
export function instrumentLabel(idea: Pick<FeedIdea, 'assetClass' | 'sourceId'>) {
  if (idea.sourceId.startsWith('gt:')) return `token on ${idea.sourceId.split(':')[1]}`
  return idea.assetClass === 'crypto' ? 'crypto' : 'stock'
}

export function weekSummary(calls: FeedCall[]) {
  const bullish = calls.filter((call) => call.direction === 'BULL').length
  return {
    accounts: new Set(calls.map((call) => call.handle)).size,
    assets: new Set(calls.map((call) => call.asset)).size,
    calls: calls.length,
    bullish,
    bearish: calls.length - bullish,
  }
}

export function timeAgo(value: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60_000))
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h`
  return `${Math.floor(minutes / (24 * 60))}d`
}

export function ordinal(value: number) {
  const tens = value % 100
  if (tens >= 11 && tens <= 13) return `${value}th`
  return `${value}${['th', 'st', 'nd', 'rd'][value % 10] ?? 'th'}`
}
