import { optionalEnv } from '../env'
import { HORIZON_DAYS, type AssetClass, type HorizonPrices, type PricePoint, type ResolvedAsset } from '../types'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
// Yahoo serves hourly bars for the last 730 days. Hyperliquid keeps only its most recent 5000 candles per interval.
const YAHOO_HOURLY_DAYS = 729
const STOCK_SESSION_MS = 6.5 * HOUR_MS

// One traded interval: it opens at `t` and its close is known at `end`.
export type Bar = { t: number; end: number; open: number; high: number; low: number; close: number }
// `bars` are hourly where the venue still serves them and daily before that, oldest first.
export type PriceSeries = { bars: Bar[]; current: PricePoint }

export async function getPriceSeries(asset: ResolvedAsset, from: string): Promise<PriceSeries | null> {
  try {
    return asset.provider === 'hyperliquid' || asset.assetClass === 'crypto'
      ? await hyperliquidSeries(cleanSymbol(asset.sourceId), from)
      : await yahooSeries(asset.sourceId, from)
  } catch (error) {
    if (cleanSymbol(asset.sourceId) === 'XYZ100') {
      try {
        return await yahooSeries('QQQ', from)
      } catch {
        // Fall through to the normal debug log and null return.
      }
    }
    if (optionalEnv('DEBUG_PRICING') === '1') {
      console.warn('pricing failed', asset.symbol, asset.sourceId, asset.provider, error)
    }
    return null
  }
}

// Daily candles only, for a chart. Scoring uses getPriceSeries, which also pulls hourly bars.
export async function getDailyBars(asset: ResolvedAsset, from: string): Promise<Bar[]> {
  return asset.provider === 'hyperliquid' || asset.assetClass === 'crypto'
    ? hyperliquidBars(cleanSymbol(asset.sourceId), Date.parse(`${dayKey(from)}T00:00:00.000Z`) - 10 * DAY_MS, '1d', DAY_MS)
    : yahooBars(asset.sourceId, new Date(from).getTime() - 10 * DAY_MS, '1d')
}

// What a follower could have got: the first price after the post, and the last price at each horizon after that entry.
// A post inside a bar enters at that bar's close; a post while the market is shut enters at the next open.
export function pricesAt(series: PriceSeries, date: string, now = Date.now()): { entry: PricePoint; horizons: HorizonPrices } | null {
  const postedAt = new Date(date).getTime()
  const bar = series.bars.find((item) => item.end > postedAt)
  if (!bar) return null
  const inBar = bar.t <= postedAt
  const entryAt = inBar ? bar.end : bar.t
  return {
    entry: { price: inBar ? bar.close : bar.open, pricedAt: new Date(entryAt).toISOString() },
    horizons: Object.fromEntries(HORIZON_DAYS.map((days) => [days, priceAsOf(series.bars, entryAt + days * DAY_MS, now)])) as HorizonPrices,
  }
}

// The last close known at `time`; null while `time` is still in the future.
function priceAsOf(bars: Bar[], time: number, now: number): PricePoint | null {
  if (time > now) return null
  let last: Bar | null = null
  for (const bar of bars) {
    if (bar.end > time) break
    last = bar
  }
  return last ? { price: last.close, pricedAt: new Date(last.end).toISOString() } : null
}

export function dayKey(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().slice(0, 10)
}

// Daily bars up to where the hourly ones begin, then the hourly ones.
function mergeBars(daily: Bar[], hourly: Bar[]): Bar[] {
  if (!hourly.length) return daily
  return [...daily.filter((bar) => bar.end <= hourly[0].t), ...hourly]
}

async function yahooSeries(symbol: string, from: string): Promise<PriceSeries> {
  const start = new Date(from).getTime() - 10 * DAY_MS
  const daily = await yahooBars(symbol, start, '1d')
  const last = daily.at(-1)
  if (!last) throw new Error(`Yahoo ${symbol} history missing`)
  const hourly = await yahooBars(symbol, Math.max(start, Date.now() - YAHOO_HOURLY_DAYS * DAY_MS), '1h').catch(() => [])
  return {
    bars: mergeBars(daily, hourly),
    current: { price: (hourly.at(-1) ?? last).close, pricedAt: new Date((hourly.at(-1) ?? last).t).toISOString() },
  }
}

async function yahooBars(symbol: string, start: number, interval: '1d' | '1h'): Promise<Bar[]> {
  const end = Date.now() + DAY_MS
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${Math.floor(start / 1000)}&period2=${Math.floor(end / 1000)}&interval=${interval}&includePrePost=true&events=history`,
    { headers: yahooHeaders() },
  )
  if (!response.ok) throw new Error(`Yahoo chart ${response.status}`)
  const json = await response.json()
  const result = json.chart?.result?.[0]
  const error = json.chart?.error
  if (!result || error) throw new Error(error?.description ?? 'Yahoo chart missing')
  const timestamps: number[] = result.timestamp ?? []
  const quote = result.indicators?.quote?.[0] ?? {}
  const rows = timestamps
    .map((timestamp, index) => ({
      t: timestamp * 1000,
      open: Number(quote.open?.[index]),
      high: Number(quote.high?.[index]),
      low: Number(quote.low?.[index]),
      close: Number(quote.close?.[index]),
    }))
    .filter((row) => Number.isFinite(row.close) && row.close > 0)
  return rows.map((row, index) => {
    // Sessions are shorter than their bar: a pre-market hour ends when the regular session opens.
    const span = interval === '1h' ? HOUR_MS : STOCK_SESSION_MS
    const next = rows[index + 1]?.t ?? Number.POSITIVE_INFINITY
    const open = row.open > 0 ? row.open : row.close
    return {
      t: row.t,
      end: Math.min(row.t + span, next),
      open,
      high: row.high > 0 ? row.high : Math.max(open, row.close),
      low: row.low > 0 ? row.low : Math.min(open, row.close),
      close: row.close,
    }
  })
}

async function hyperliquidSeries(symbol: string, from: string): Promise<PriceSeries> {
  const start = Date.parse(`${dayKey(from)}T00:00:00.000Z`)
  const daily = await hyperliquidBars(symbol, start, '1d', DAY_MS)
  const last = daily.at(-1)
  if (!last) throw new Error(`Hyperliquid ${symbol} history missing`)
  const hourly = await hyperliquidBars(symbol, start, '1h', HOUR_MS).catch(() => [])
  // The last candle is still forming, so its close is the live price.
  return {
    bars: mergeBars(daily, hourly),
    current: { price: (hourly.at(-1) ?? last).close, pricedAt: new Date().toISOString() },
  }
}

async function hyperliquidBars(symbol: string, start: number, interval: '1d' | '1h', span: number): Promise<Bar[]> {
  const candles = await hyperliquidInfo({
    type: 'candleSnapshot',
    req: { coin: symbol, interval, startTime: start, endTime: Date.now() },
  })
  if (!Array.isArray(candles)) throw new Error(`Hyperliquid ${symbol} history missing`)
  return candles
    .map((item: any) => ({
      t: Number(item?.t),
      end: Number(item?.t) + span,
      open: Number(item?.o),
      high: Number(item?.h),
      low: Number(item?.l),
      close: Number(item?.c),
    }))
    .filter((bar: Bar) => Number.isFinite(bar.close) && bar.close > 0)
}

async function hyperliquidInfo(body: Record<string, unknown>) {
  const response = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`Hyperliquid info ${response.status}`)
  return response.json()
}

function cleanSymbol(symbol: string) {
  return String(symbol ?? '').replace(/^\$+/, '').trim().toUpperCase()
}

function yahooHeaders(): HeadersInit {
  return { 'User-Agent': 'Mozilla/5.0' }
}

export function priceCacheKey(assetClass: AssetClass, sourceId: string, day: string) {
  return `${assetClass}:${sourceId}:${day}`
}
