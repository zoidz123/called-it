export type Scorecard = {
  user: {
    handle: string
    name: string
    avatar_url: string | null
    bio: string | null
    followers: number
    avg_return: number
    median_return: number
    hit_rate: number
    calls_total: number
    calls_up: number
    computed_at?: string
  }
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
  calls: {
    asset: string
    direction: 'BULL' | 'BEAR'
    asset_class: string
    first_pitch_at: string
    entry_price: number
    current_price: number
    return_pct: number
    mentions: number
    bulls: number
    bears: number
  }[]
  assets: {
    asset: string
    total: number
    bulls: number
    bears: number
    first_pitch_at: string
  }[]
  tweets: {
    tweet_id: string
    text: string
    created_at: string
    url: string
    stances: { asset: string; direction: 'BULL' | 'BEAR'; conviction: number }[]
  }[]
}

export type AssetRow = {
  id: string
  asset: string
  total: number
  stanceLabel: string
  firstPitchAt: string
  legs: PriceLeg[]
}

export type PriceLeg = {
  id: string
  direction: 'BULL' | 'BEAR'
  startAt: string
  endAt: string | null
  startPrice: number
  endPrice: number
  returnPct: number
  isCurrent: boolean
}

export type ShareCallRow = {
  asset: string
  action: 'BUY' | 'SELL'
  direction: 'BULL' | 'BEAR'
  returnPct: number
  mentions: number
  firstPitchAt: string
}

export function buildAssetRows(data: Scorecard): AssetRow[] {
  const callsByAsset = new Map<string, Scorecard['calls']>()
  for (const call of data.calls ?? []) {
    const ticker = normalizeTicker(call.asset)
    callsByAsset.set(ticker, [...(callsByAsset.get(ticker) ?? []), call])
  }

  const rowsFromCalls = [...callsByAsset.entries()].map(([ticker, calls]) => {
    const sortedCalls = calls
      .slice()
      .sort((a, b) => new Date(a.first_pitch_at).getTime() - new Date(b.first_pitch_at).getTime())
    const first = sortedCalls[0]
    return {
      id: ticker,
      asset: ticker,
      total: first?.mentions ?? 0,
      stanceLabel: sortedCalls.map((call) => call.direction).join(' -> '),
      firstPitchAt: first?.first_pitch_at ?? '',
      legs: buildPriceLegs(sortedCalls),
    }
  })

  const pricedAssets = new Set(rowsFromCalls.map((row) => row.asset))
  const unpricedRows = (data.assets ?? [])
    .filter((asset) => !pricedAssets.has(normalizeTicker(asset.asset)))
    .map((asset) => {
      const ticker = normalizeTicker(asset.asset)
      return {
        id: `${ticker}:UNPRICED`,
        asset: ticker,
        total: asset.total,
        stanceLabel: asset.bears > asset.bulls ? 'BEAR' : 'BULL',
        firstPitchAt: asset.first_pitch_at,
        legs: [],
      }
    })

  return [...rowsFromCalls, ...unpricedRows]
    .sort((a, b) => b.total - a.total || a.asset.localeCompare(b.asset))
}

export function buildPriceLegs(calls: Scorecard['calls']): PriceLeg[] {
  return calls.map((call, index) => {
    const next = calls[index + 1]
    const endPrice = next?.entry_price ?? call.current_price
    const returnPct = call.direction === 'BULL'
      ? (endPrice - call.entry_price) / call.entry_price
      : (call.entry_price - endPrice) / call.entry_price
    return {
      id: `${call.asset}:${call.direction}:${call.first_pitch_at}`,
      direction: call.direction,
      startAt: call.first_pitch_at,
      endAt: next?.first_pitch_at ?? null,
      startPrice: call.entry_price,
      endPrice,
      returnPct,
      isCurrent: !next,
    }
  })
}

export function topShareRows(assetRows: AssetRow[], limit = 3): ShareCallRow[] {
  return assetRows
    .slice()
    .filter((row) => row.legs.length > 0)
    .sort((a, b) => rowMove(b) - rowMove(a) || b.total - a.total)
    .slice(0, limit)
    .map((row) => ({
      asset: row.asset,
      action: rowAction(row),
      direction: rowDirection(row),
      returnPct: rowMove(row),
      mentions: row.total,
      firstPitchAt: row.firstPitchAt,
    }))
}

export function rowMove(row: AssetRow) {
  if (!row.legs.length) return 0
  const currentLeg = currentRowLeg(row)
  return currentLeg?.returnPct ?? 0
}

export function rowAction(row: AssetRow): 'BUY' | 'SELL' {
  return rowDirection(row) === 'BEAR' ? 'SELL' : 'BUY'
}

export function rowDirection(row: AssetRow): 'BULL' | 'BEAR' {
  const currentLeg = currentRowLeg(row)
  if (currentLeg) return currentLeg.direction
  return row.stanceLabel.includes('BEAR') && !row.stanceLabel.includes('BULL') ? 'BEAR' : 'BULL'
}

export function currentRowLeg(row: AssetRow) {
  return row.legs.find((leg) => leg.isCurrent) ?? row.legs[row.legs.length - 1] ?? null
}

export function rowImpact(row: AssetRow) {
  return Math.abs(rowMove(row)) * Math.log(row.total + 1)
}

export function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export function normalizeTicker(value: string) {
  return `$${String(value ?? '').replace(/^\$+/, '').trim().toUpperCase()}`
}
