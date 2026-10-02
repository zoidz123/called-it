import { afterEach, expect, mock, test } from 'bun:test'
import { getPriceSeries, hasFreshSeries, usePriceStore, type Bar, type PriceStore, type StoredSeries } from './index'

const realFetch = globalThis.fetch
const DAY = 24 * 60 * 60 * 1000
const asset = { symbol: '$MU', assetClass: 'stock' as const, sourceId: 'MU', name: null, provider: 'yahoo' as const }
const day = (iso: string, close: number): Bar => ({ t: Date.parse(iso), end: Date.parse(iso) + 6.5 * 60 * 60 * 1000, open: close, high: close, low: close, close })

afterEach(() => {
  globalThis.fetch = realFetch
  usePriceStore(null)
})

function memoryStore(initial: Record<string, StoredSeries> = {}) {
  const kept = new Map(Object.entries(initial))
  const saves: { key: string; changedFrom: number; bars: number }[] = []
  const store: PriceStore = {
    load: async (series, interval) => kept.get(`${series}|${interval}`) ?? null,
    save: async (series, interval, stored, changedFrom) => {
      kept.set(`${series}|${interval}`, stored)
      saves.push({ key: `${series}|${interval}`, changedFrom, bars: stored.bars.length })
    },
  }
  return { store, saves, kept }
}

// A Yahoo chart response holding these closes, one bar each.
function yahoo(bars: [string, number][]) {
  return new Response(JSON.stringify({ chart: { result: [{
    timestamp: bars.map(([iso]) => Date.parse(iso) / 1000),
    indicators: { quote: [{ open: bars.map(([, close]) => close), high: bars.map(([, close]) => close), low: bars.map(([, close]) => close), close: bars.map(([, close]) => close) }] },
  }] } }))
}

test('a recent stored history is used without asking the venue', async () => {
  const bars = [day('2026-09-01T13:30:00Z', 100), day('2026-09-02T13:30:00Z', 110)]
  const { store } = memoryStore({
    'stock:MU|1d': { bars, from: 0, fetchedAt: Date.now() },
    'stock:MU|1h': { bars: [], from: 0, fetchedAt: Date.now() },
  })
  usePriceStore(store)
  globalThis.fetch = mock(async () => { throw new Error('the venue must not be asked') }) as any

  const series = await getPriceSeries(asset, '2026-09-01T00:00:00Z')
  expect(series?.bars.map((bar) => bar.close)).toEqual([100, 110])
  expect(series?.current.price).toBe(110)
  expect(await hasFreshSeries(asset)).toBe(true)
})

test('an old stored history is topped up from its last bar and only the new part is saved', async () => {
  const stored = [day('2026-09-01T13:30:00Z', 100), day('2026-09-02T13:30:00Z', 110)]
  const { store, saves, kept } = memoryStore({
    'stock:MU|1d': { bars: stored, from: 0, fetchedAt: Date.now() - 2 * DAY },
    'stock:MU|1h': { bars: [], from: 0, fetchedAt: Date.now() },
  })
  usePriceStore(store)
  const asked: string[] = []
  globalThis.fetch = mock(async (url: any) => {
    asked.push(String(url))
    // The venue returns the last stored day again, now closed at a new price, and one new day.
    return yahoo([['2026-09-02T13:30:00Z', 112], ['2026-09-03T13:30:00Z', 120]])
  }) as any

  expect(await hasFreshSeries(asset)).toBe(false)
  const series = await getPriceSeries(asset, '2026-09-01T00:00:00Z')

  expect(asked).toHaveLength(1)
  expect(asked[0]).toContain(`period1=${Date.parse('2026-09-02T13:30:00Z') / 1000}`)
  expect(series?.bars.map((bar) => bar.close)).toEqual([100, 112, 120])
  expect(saves).toEqual([{ key: 'stock:MU|1d', changedFrom: Date.parse('2026-09-02T13:30:00Z'), bars: 3 }])
  expect(kept.get('stock:MU|1d')?.from).toBe(0)
})

test('a venue that does not answer leaves the stored history in use', async () => {
  const { store } = memoryStore({
    'stock:MU|1d': { bars: [day('2026-09-01T13:30:00Z', 100)], from: 0, fetchedAt: Date.now() - 2 * DAY },
    'stock:MU|1h': { bars: [], from: 0, fetchedAt: Date.now() },
  })
  usePriceStore(store)
  globalThis.fetch = mock(async () => new Response('busy', { status: 429 })) as any

  const series = await getPriceSeries(asset, '2026-09-01T00:00:00Z')
  expect(series?.current.price).toBe(100)
})

test('with nothing stored the whole stretch is fetched and saved', async () => {
  const { store, saves } = memoryStore()
  usePriceStore(store)
  globalThis.fetch = mock(async () => yahoo([['2026-09-01T13:30:00Z', 100], ['2026-09-02T13:30:00Z', 110]])) as any

  const series = await getPriceSeries(asset, '2026-09-01T00:00:00Z')
  expect(series?.bars.length).toBeGreaterThan(0)
  expect(saves.map((save) => [save.key, save.changedFrom])).toEqual([['stock:MU|1d', 0], ['stock:MU|1h', 0]])
})
