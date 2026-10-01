import { describe, expect, test } from 'bun:test'
import { pricesAt, type Bar, type PriceSeries } from './index'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const at = (iso: string) => Date.parse(iso)
const series = (bars: Omit<Bar, 'high' | 'low'>[]): PriceSeries => ({
  bars: bars.map((bar) => ({ ...bar, high: Math.max(bar.open, bar.close), low: Math.min(bar.open, bar.close) })),
  current: { price: 0, pricedAt: '' },
})

describe('pricesAt', () => {
  // Two trading days of hourly bars, 14:00 to 16:00 UTC, with the market shut in between.
  const hours = (day: string, open: number) => [14, 15].map((hour, index) => ({
    t: at(`${day}T${hour}:00:00Z`), end: at(`${day}T${hour + 1}:00:00Z`), open: open + index, close: open + index + 1,
  }))
  const stock = series([...hours('2026-03-02', 100), ...hours('2026-03-03', 110), ...hours('2026-03-09', 120), ...hours('2026-03-10', 130)])
  const now = at('2026-06-01T00:00:00Z')

  test('a post inside a bar enters at that bar close, not at a price from before the post', () => {
    const prices = pricesAt(stock, '2026-03-02T14:20:00Z', now)
    expect(prices?.entry).toEqual({ price: 101, pricedAt: '2026-03-02T15:00:00.000Z' })
  })

  test('a post while the market is shut enters at the next open', () => {
    const prices = pricesAt(stock, '2026-03-02T20:00:00Z', now)
    expect(prices?.entry).toEqual({ price: 110, pricedAt: '2026-03-03T14:00:00.000Z' })
  })

  test('a horizon takes the last close known N days after the entry', () => {
    const prices = pricesAt(stock, '2026-03-02T14:20:00Z', now)
    // Entry at Mar 2 15:00, so 7 days later is Mar 9 15:00: the 14:00 bar has closed, the 15:00 bar has not.
    expect(prices?.horizons[7]).toEqual({ price: 121, pricedAt: '2026-03-09T15:00:00.000Z' })
  })

  test('a horizon is pending until N days have passed', () => {
    const prices = pricesAt(stock, '2026-03-02T14:20:00Z', at('2026-03-09T14:59:00Z'))
    expect(prices?.horizons[7]).toBeNull()
    expect(prices?.horizons[30]).toBeNull()
  })

  test('falls back to daily bars before the hourly ones begin', () => {
    const mixed = series([
      { t: at('2026-01-01T00:00:00Z'), end: at('2026-01-02T00:00:00Z'), open: 50, close: 55 },
      { t: at('2026-01-02T00:00:00Z'), end: at('2026-01-02T01:00:00Z'), open: 55, close: 56 },
    ])
    expect(pricesAt(mixed, '2026-01-01T09:00:00Z', now)?.entry.price).toBe(55)
    expect(pricesAt(mixed, '2026-01-02T00:10:00Z', now)?.entry.price).toBe(56)
  })

  test('returns nothing for a post after the last bar', () => {
    expect(pricesAt(stock, '2026-04-01T00:00:00Z', now)).toBeNull()
  })

  test('uses exactly N days for an asset that trades around the clock', () => {
    const perp = series(Array.from({ length: 24 * 10 }, (_, hour) => ({
      t: at('2026-03-01T00:00:00Z') + hour * HOUR, end: at('2026-03-01T00:00:00Z') + (hour + 1) * HOUR, open: hour, close: hour + 1,
    })))
    const prices = pricesAt(perp, '2026-03-01T00:30:00Z', now)
    expect(prices?.entry.price).toBe(1)
    expect(prices?.horizons[7]?.price).toBe(1 + 7 * 24)
    expect(Date.parse(prices?.horizons[7]?.pricedAt ?? '') - Date.parse(prices?.entry.pricedAt ?? '')).toBe(7 * DAY)
  })
})
