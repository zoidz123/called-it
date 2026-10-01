export const HORIZONS = [7, 30, 90] as const
export type Horizon = (typeof HORIZONS)[number]

type HorizonUserStats = {
  [K in Horizon as `avg_return_${K}d` | `median_return_${K}d` | `hit_rate_${K}d` | `calls_${K}d`]: number
}

export type Scorecard = {
  user: {
    handle: string
    name: string
    avatar_url: string | null
    bio: string | null
    followers: number
    computed_at?: string
  } & HorizonUserStats
  refresh?: {
    price?: {
      oldestPricedAt?: string
      callsTotal?: number
      stale?: boolean
      ttlHours?: number
    } | null
    scan?: {
      lastScannedAt?: string
      stale?: boolean
      ttlHours?: number
    } | null
    jobs?: Record<string, unknown>
  }
  scan: null | {
    tweets_scanned: number
    candidates: number
    classified: number
    calls_found: number
    priced_calls: number
    finished_at: string
  }
  // One row per call: one post's stance on one asset.
  calls: {
    asset: string
    direction: 'BULL' | 'BEAR'
    asset_class: string
    first_pitch_at: string
    return_7d: number | null
    return_30d: number | null
    return_90d: number | null
    mentions: number
  }[]
  assets: {
    asset: string
    total: number
    bulls: number
    bears: number
    first_pitch_at: string
  }[]
}

export type AssetRow = {
  id: string
  asset: string
  callouts: number
  bulls: number
  bears: number
  firstPitchAt: string
  priced: boolean
  // How this asset's calls played out N days later, over the calls that have reached that horizon.
  horizons: Record<Horizon, CallRecord>
}

export type CallRecord = { wins: number; losses: number; avg: number | null }

export type ShareCallRow = {
  asset: string
  action: 'BUY' | 'SELL'
  direction: 'BULL' | 'BEAR'
  returnPct: number
  firstPitchAt: string
}

// One row per asset, busiest first. Assets with stances but no price history sit at the bottom as unpriced.
export function buildAssetRows(data: Scorecard): AssetRow[] {
  const callsByAsset = new Map<string, Scorecard['calls']>()
  for (const call of data.calls ?? []) {
    const ticker = normalizeTicker(call.asset)
    callsByAsset.set(ticker, [...(callsByAsset.get(ticker) ?? []), call])
  }

  const priced = [...callsByAsset.entries()].map(([ticker, calls]): AssetRow => {
    const posts = (direction: 'BULL' | 'BEAR') => calls
      .filter((call) => call.direction === direction)
      .reduce((sum, call) => sum + call.mentions, 0)
    return {
      id: ticker,
      asset: ticker,
      callouts: posts('BULL') + posts('BEAR'),
      bulls: posts('BULL'),
      bears: posts('BEAR'),
      firstPitchAt: calls.map((call) => call.first_pitch_at).sort()[0] ?? '',
      priced: true,
      horizons: {
        7: callRecord(calls.map((call) => call.return_7d)),
        30: callRecord(calls.map((call) => call.return_30d)),
        90: callRecord(calls.map((call) => call.return_90d)),
      },
    }
  })

  const unpriced = (data.assets ?? [])
    .filter((asset) => !callsByAsset.has(normalizeTicker(asset.asset)))
    .map((asset): AssetRow => ({
      id: `${normalizeTicker(asset.asset)}:UNPRICED`,
      asset: normalizeTicker(asset.asset),
      callouts: asset.total,
      bulls: asset.bulls,
      bears: asset.bears,
      firstPitchAt: asset.first_pitch_at,
      priced: false,
      horizons: { 7: callRecord([]), 30: callRecord([]), 90: callRecord([]) },
    }))

  const byActivity = (a: AssetRow, b: AssetRow) => b.callouts - a.callouts || a.asset.localeCompare(b.asset)
  return [...priced.sort(byActivity), ...unpriced.sort(byActivity)]
}

// The best calls by their move N days later.
export function topShareRows(calls: Scorecard['calls'], limit = 3, days: Horizon = 30): ShareCallRow[] {
  return calls
    .flatMap((call) => {
      const returnPct = call[`return_${days}d`]
      return returnPct === null ? [] : [{ call, returnPct }]
    })
    .sort((a, b) => b.returnPct - a.returnPct)
    .slice(0, limit)
    .map(({ call, returnPct }) => ({
      asset: normalizeTicker(call.asset),
      action: call.direction === 'BEAR' ? 'SELL' : 'BUY',
      direction: call.direction,
      returnPct,
      firstPitchAt: call.first_pitch_at,
    }))
}

export function parseHorizon(value: string | undefined): Horizon {
  return value === '7' || value === '7d' ? 7 : value === '90' || value === '90d' ? 90 : 30
}

export function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// Two decimals for ordinary prices, none for five-figure ones, and four significant digits below a dollar so a
// memecoin is not "$0.00".
export function formatPrice(value: number) {
  if (value >= 10000) return `$${Math.round(value).toLocaleString('en')}`
  if (value >= 1) return `$${value.toLocaleString('en', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
  return `$${value.toLocaleString('en', { maximumSignificantDigits: 4 })}`
}

export function normalizeTicker(value: string) {
  return `$${String(value ?? '').replace(/^\$+/, '').trim().toUpperCase()}`
}

export function callRecord(returns: (number | null)[]): CallRecord {
  const settled = returns.filter((value): value is number => value !== null)
  const wins = settled.filter((value) => value > 0).length
  return {
    wins,
    losses: settled.length - wins,
    avg: settled.length ? settled.reduce((sum, value) => sum + value, 0) / settled.length : null,
  }
}

export type Sentiment = { label: string; tone: 'bull' | 'bear' | 'neutral' }

// How one-sided an account's posts on an asset are. "Extremely" needs both a lopsided split and enough posts to mean it.
export function sentiment(bulls: number, bears: number): Sentiment {
  const total = bulls + bears
  const lean = total ? (bulls - bears) / total : 0
  if (Math.abs(lean) <= 0.2) return { label: 'Neutral', tone: 'neutral' }
  const extreme = Math.abs(lean) >= 0.6 && total >= 5
  return lean > 0
    ? { label: extreme ? 'Extremely bullish' : 'Bullish', tone: 'bull' }
    : { label: extreme ? 'Extremely bearish' : 'Bearish', tone: 'bear' }
}

// What $1,000 put into a call became.
export function money(returnPct: number) {
  return `$${Math.round(1000 * (1 + returnPct)).toLocaleString('en')}`
}

export type ResultPoint = { time: string; value: number; calls: number }

// The running result of putting $1,000 into every call. Calls are taken in the order they were posted; each point is
// the average of every call up to and including that day, as dollars. A call only counts once it is old enough to
// have been sold at this horizon, so the line stops that many days before today.
export function resultCurve(calls: Scorecard['calls'], days: Horizon): ResultPoint[] {
  const settled = calls
    .flatMap((call) => {
      const returnPct = call[`return_${days}d`]
      return returnPct === null ? [] : [{ day: new Date(call.first_pitch_at).toISOString().slice(0, 10), returnPct }]
    })
    .sort((a, b) => a.day.localeCompare(b.day))
  const points = new Map<string, ResultPoint>()
  let sum = 0
  settled.forEach((call, index) => {
    sum += call.returnPct
    points.set(call.day, { time: call.day, value: 1000 * (1 + sum / (index + 1)), calls: index + 1 })
  })
  return [...points.values()]
}

// Whether each of the latest settled calls went their way, oldest first.
export function recentResults(calls: Scorecard['calls'], days: Horizon, limit = 10): boolean[] {
  return calls
    .filter((call) => call[`return_${days}d`] !== null)
    .sort((a, b) => a.first_pitch_at.localeCompare(b.first_pitch_at))
    .slice(-limit)
    .map((call) => (call[`return_${days}d`] ?? 0) > 0)
}
