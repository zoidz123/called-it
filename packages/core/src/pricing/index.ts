import { optionalEnv } from '../env'
import type { AssetClass, PricePoint, ResolvedAsset } from '../types'

export async function getEntryAndCurrentPrices(asset: ResolvedAsset, date: string): Promise<{ entry: PricePoint; current: PricePoint } | null> {
  try {
    return asset.provider === 'hyperliquid' || asset.assetClass === 'crypto'
      ? await hyperliquidPerpPrices(cleanSymbol(asset.sourceId), date)
      : await yahooPrices(asset.sourceId, date)
  } catch (error) {
    if (cleanSymbol(asset.sourceId) === 'XYZ100') {
      try {
        return await yahooPrices('QQQ', date)
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

export function dayKey(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().slice(0, 10)
}

async function yahooPrices(symbol: string, date: string) {
  const day = dayKey(date)
  const start = Date.parse(`${day}T00:00:00.000Z`)
  const end = Math.max(Date.now() + 24 * 60 * 60 * 1000, start + 14 * 24 * 60 * 60 * 1000)
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${Math.floor(start / 1000)}&period2=${Math.floor(end / 1000)}&interval=1d&events=history`,
    { headers: yahooHeaders() },
  )
  if (!response.ok) throw new Error(`Yahoo chart ${response.status}`)
  const json = await response.json()
  const result = json.chart?.result?.[0]
  const error = json.chart?.error
  if (!result || error) throw new Error(error?.description ?? 'Yahoo chart missing')
  const timestamps = result.timestamp ?? []
  const closes = result.indicators?.quote?.[0]?.close ?? []
  const rows = timestamps
    .map((timestamp: number, index: number) => ({ timestamp, close: Number(closes[index]) }))
    .filter((row: { timestamp: number; close: number }) => Number.isFinite(row.close) && row.close > 0)
  const entryRow = rows.find((row: { timestamp: number }) => row.timestamp * 1000 >= start) ?? rows[0]
  const currentRow = rows.at(-1)
  if (!entryRow || !currentRow) return null
  return {
    entry: { price: entryRow.close, pricedAt: dayKey(new Date(entryRow.timestamp * 1000)) },
    current: { price: currentRow.close, pricedAt: new Date(currentRow.timestamp * 1000).toISOString() },
  }
}

async function hyperliquidPerpPrices(symbol: string, date: string) {
  const day = dayKey(date)
  const startTime = Date.parse(`${day}T00:00:00.000Z`)
  const candles = await hyperliquidInfo({
    type: 'candleSnapshot',
    req: {
      coin: symbol,
      interval: '1d',
      startTime,
      endTime: startTime + 2 * 24 * 60 * 60 * 1000,
    },
  })
  if (!Array.isArray(candles) || !candles.length) throw new Error(`Hyperliquid ${symbol} history missing`)
  const candle = candles.find((item: any) => Number(item?.t) >= startTime) ?? candles[0]
  const entry = Number(candle?.c ?? candle?.o)

  const mids = await hyperliquidInfo({ type: 'allMids' })
  const current = Number(mids?.[symbol])
  if (!entry || !current) throw new Error(`Hyperliquid ${symbol} price missing`)
  return {
    entry: { price: entry, pricedAt: day },
    current: { price: current, pricedAt: new Date().toISOString() },
  }
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
