import { optionalEnv } from '../env'
import { timedFetch } from '../http'
import { spacedQueue } from '../spaced'
import { HORIZON_DAYS, type AssetClass, type HorizonPrices, type PricePoint, type ResolvedAsset } from '../types'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
// Yahoo serves hourly bars for the last 730 days. Hyperliquid keeps only its most recent 5000 candles per interval.
const YAHOO_HOURLY_DAYS = 729
const STOCK_SESSION_MS = 6.5 * HOUR_MS
// The longest a post waits for its first price: a market shut over a long weekend, with room to spare.
const MAX_ENTRY_WAIT_MS = 5 * DAY_MS

// One traded interval: it opens at `t` and its close is known at `end`.
export type Bar = { t: number; end: number; open: number; high: number; low: number; close: number }
// `bars` are hourly where the venue still serves them and daily before that, oldest first.
export type PriceSeries = { bars: Bar[]; current: PricePoint }

type Interval = '1d' | '1h'
// A price history as it is kept between runs. `from` is how far back it was asked to reach, which can be earlier
// than its first bar when the instrument is younger than that.
export type StoredSeries = { bars: Bar[]; from: number; fetchedAt: number }
// Where price histories are kept, one per instrument and interval, shared by every account that calls it.
export type PriceStore = {
  load(series: string, interval: Interval): Promise<StoredSeries | null>
  // `changedFrom` is the open time of the earliest bar that differs from what was stored; zero replaces it all.
  save(series: string, interval: Interval, stored: StoredSeries, changedFrom: number): Promise<void>
}

// A stored history this recent is used as it is, with no request to the venue.
const STORE_TTL_MS = 30 * 60 * 1000
let priceStore: PriceStore | null = null
// One load at a time per history, so two accounts scored together fetch a shared instrument once.
const loading = new Map<string, Promise<unknown>>()

export function usePriceStore(store: PriceStore | null) {
  priceStore = store
}

export function seriesKey(asset: Pick<ResolvedAsset, 'assetClass' | 'sourceId'>) {
  return `${asset.assetClass}:${asset.sourceId}`
}

export async function getPriceSeries(asset: ResolvedAsset, from: string): Promise<PriceSeries | null> {
  try {
    return await loadSeries(asset, from)
  } catch (error) {
    if (cleanSymbol(asset.sourceId) === 'XYZ100') {
      try {
        return await loadSeries({ symbol: asset.symbol, assetClass: 'stock', sourceId: 'QQQ', name: null, provider: 'yahoo' }, from)
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

// Whether an instrument's history can be read without asking its venue: it is stored, and recent.
export async function hasFreshSeries(asset: ResolvedAsset) {
  const stored = await priceStore?.load(seriesKey(asset), '1d').catch(() => null)
  return Boolean(stored && Date.now() - stored.fetchedAt < STORE_TTL_MS)
}

function venueOf(asset: ResolvedAsset): 'geckoterminal' | 'hyperliquid' | 'yahoo' {
  if (isOnchainSource(asset.sourceId)) return 'geckoterminal'
  return asset.provider === 'hyperliquid' || asset.assetClass === 'crypto' ? 'hyperliquid' : 'yahoo'
}

// How far back a history must reach for calls from `from` on: ten days of lead, so a call has a price before it.
// A pool's history is always asked for whole.
function seriesStart(asset: ResolvedAsset, from: string) {
  return venueOf(asset) === 'geckoterminal' ? 0 : Date.parse(`${dayKey(from)}T00:00:00.000Z`) - 10 * DAY_MS
}

async function loadSeries(asset: ResolvedAsset, from: string): Promise<PriceSeries> {
  const start = seriesStart(asset, from)
  const daily = await loadBars(asset, '1d', start)
  const last = daily.at(-1)
  if (!last) throw new Error(`${seriesKey(asset)} history missing`)
  const hourly = await loadBars(asset, '1h', start).catch(() => [])
  const latest = hourly.at(-1) ?? last
  // A stock's last bar says when it traded. A venue that never shuts has its last candle still forming, so its
  // close is the price now.
  const pricedAt = venueOf(asset) === 'yahoo' ? new Date(latest.t).toISOString() : new Date().toISOString()
  return { bars: mergeBars(daily, hourly), current: { price: latest.close, pricedAt } }
}

function loadBars(asset: ResolvedAsset, interval: Interval, start: number): Promise<Bar[]> {
  const key = `${seriesKey(asset)}|${interval}`
  const run = (loading.get(key) ?? Promise.resolve()).catch(() => {}).then(() => readBars(asset, interval, start))
  loading.set(key, run)
  run.finally(() => { if (loading.get(key) === run) loading.delete(key) }).catch(() => {})
  return run
}

// The stored history when it is recent and reaches back far enough. Otherwise the venue is asked only for what is
// new since the last stored bar, or for the whole stretch when the store does not reach back that far.
async function readBars(asset: ResolvedAsset, interval: Interval, start: number): Promise<Bar[]> {
  const series = seriesKey(asset)
  const stored = (await priceStore?.load(series, interval).catch(() => null)) ?? null
  const covers = stored !== null && stored.from <= start
  if (covers && Date.now() - stored.fetchedAt < STORE_TTL_MS) return stored.bars
  try {
    // The last stored bar was still forming when it was saved, so it is fetched again.
    const since = covers && stored.bars.length ? stored.bars[stored.bars.length - 1].t : start
    const fresh = await fetchBars(asset, interval, since)
    const bars = covers ? [...stored.bars.filter((bar) => !fresh.length || bar.t < fresh[0].t), ...fresh] : fresh
    await priceStore?.save(series, interval, { bars, from: covers ? stored.from : start, fetchedAt: Date.now() }, covers ? fresh[0]?.t ?? since : 0)
      .catch((error) => console.error(`could not store prices for ${series}`, error))
    return bars
  } catch (error) {
    // A venue that does not answer leaves the stored history in use: a little old beats none.
    if (covers) return stored.bars
    throw error
  }
}

function fetchBars(asset: ResolvedAsset, interval: Interval, start: number): Promise<Bar[]> {
  const span = interval === '1d' ? DAY_MS : HOUR_MS
  const venue = venueOf(asset)
  if (venue === 'geckoterminal') return geckoBars(asset.sourceId, interval === '1d' ? 'day' : 'hour', span)
  if (venue === 'hyperliquid') return hyperliquidBars(cleanSymbol(asset.sourceId), start, interval, span)
  return yahooBars(asset.sourceId, interval === '1h' ? Math.max(start, Date.now() - YAHOO_HOURLY_DAYS * DAY_MS) : start, interval)
}

// Hyperliquid's venue for stocks, indices and commodities. Its coins are named "xyz:TICKER".
const STOCK_DEX = 'xyz'
// A stock quote on that venue further than this from the last exchange close is taken to be a different instrument
// sharing the ticker (xyz:GOLD is the metal, xyz:CL is crude oil), not a move in the stock.
const MAX_STOCK_GAP = 0.15

// Every mid price Hyperliquid quotes, in two requests: crypto by coin name, and the stock venue's as "xyz:TICKER".
export async function getLiveMids(): Promise<Record<string, number>> {
  const venues = await Promise.all([hyperliquidInfo({ type: 'allMids' }), hyperliquidInfo({ type: 'allMids', dex: STOCK_DEX })])
  const mids: Record<string, number> = {}
  for (const venue of venues) {
    for (const [coin, mid] of Object.entries(venue ?? {})) {
      const price = Number(mid)
      if (Number.isFinite(price) && price > 0) mids[coin] = price
    }
  }
  return mids
}

// The Hyperliquid coin that quotes an asset live, with its price. Null where Hyperliquid does not quote the asset,
// which leaves the caller on the last exchange close.
export function liveQuote(
  source: { asset_class: 'crypto' | 'stock'; source_id: string },
  mids: Record<string, number>,
  lastClose?: number,
): { coin: string; price: number } | null {
  const symbol = cleanSymbol(source.source_id)
  const stockCoin = `${STOCK_DEX}:${symbol}`
  if (source.asset_class === 'crypto') {
    const coin = mids[symbol] ? symbol : stockCoin
    return mids[coin] ? { coin, price: mids[coin] } : null
  }
  const price = mids[stockCoin]
  if (!price || !lastClose || Math.abs(price / lastClose - 1) > MAX_STOCK_GAP) return null
  return { coin: stockCoin, price }
}

// Daily candles only, for a chart. Scoring uses getPriceSeries, which also pulls hourly bars.
export async function getDailyBars(asset: ResolvedAsset, from: string): Promise<Bar[]> {
  const start = new Date(from).getTime() - 10 * DAY_MS
  return (await loadBars(asset, '1d', seriesStart(asset, from))).filter((bar) => bar.end > start)
}

// What a follower could have got: the first price after the post, and the last price at each horizon after that entry.
// A post inside a bar enters at that bar's close; a post while the market is shut enters at the next open.
export function pricesAt(series: PriceSeries, date: string, now = Date.now()): { entry: PricePoint; horizons: HorizonPrices } | null {
  const postedAt = new Date(date).getTime()
  const bar = series.bars.find((item) => item.end > postedAt)
  if (!bar) return null
  // A post from well before the series begins has no price: a token's history starts when its pool does, and a
  // call made before that cannot be entered at the launch price.
  if (bar.t - postedAt > MAX_ENTRY_WAIT_MS) return null
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

async function yahooBars(symbol: string, start: number, interval: '1d' | '1h'): Promise<Bar[]> {
  const end = Date.now() + DAY_MS
  const response = await timedFetch(
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

const ONCHAIN_PREFIX = 'gt:'
// GeckoTerminal's free API allows about 30 requests a minute and refuses more with a 429, so its requests go out one
// at a time, spaced apart. A refusal holds the whole line while it waits, longer each time.
const geckoQueue = spacedQueue(2100)
const GECKO_BACKOFF_MS = [10_000, 20_000, 40_000, 60_000]

// An on-chain token's price source: the GeckoTerminal network and pool it trades in, and the token's own address so
// the price is the token's whichever side of the pool it sits on.
export function onchainSource(network: string, pool: string, token: string) {
  return `${ONCHAIN_PREFIX}${network}:${pool}:${token}`
}

export function isOnchainSource(sourceId: string) {
  return sourceId.startsWith(ONCHAIN_PREFIX)
}

// The pool's latest 1000 candles, oldest first: its whole life in days, about six weeks in hours.
async function geckoBars(sourceId: string, timeframe: 'day' | 'hour', span: number): Promise<Bar[]> {
  const [network, pool, token] = sourceId.slice(ONCHAIN_PREFIX.length).split(':')
  const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${pool}/ohlcv/${timeframe}?limit=1000&currency=usd${token ? `&token=${token}` : ''}`
  const payload = await geckoGet(url)
  const rows: unknown[][] = payload?.data?.attributes?.ohlcv_list ?? []
  return rows
    .map((row) => ({ t: Number(row[0]) * 1000, end: Number(row[0]) * 1000 + span, open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]) }))
    .filter((bar) => Number.isFinite(bar.close) && bar.close > 0)
    .sort((a, b) => a.t - b.t)
}

function geckoGet(url: string): Promise<any> {
  return geckoQueue(async () => {
    for (let attempt = 0; ; attempt++) {
      const response = await timedFetch(url, { headers: { accept: 'application/json' } })
      if (response.status === 429 && attempt < GECKO_BACKOFF_MS.length) {
        await new Promise((done) => setTimeout(done, GECKO_BACKOFF_MS[attempt]))
        continue
      }
      if (!response.ok) throw new Error(`GeckoTerminal ${response.status}`)
      return response.json()
    }
  })
}

async function hyperliquidInfo(body: Record<string, unknown>) {
  const response = await timedFetch('https://api.hyperliquid.xyz/info', {
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
