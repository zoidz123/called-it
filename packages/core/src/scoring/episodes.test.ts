import { describe, expect, test } from 'bun:test'
import { callsFromSeries, settledKey } from './index'
import type { PriceSeries } from '../pricing'
import type { ClassifiedTweet } from '../types'

const DAY = 24 * 60 * 60 * 1000
const start = Date.parse('2026-01-01T00:00:00.000Z')
const now = start + 200 * DAY
// A perp whose close rises by 1 every day: day N closes at 100 + N.
const series: PriceSeries = {
  bars: Array.from({ length: 200 }, (_, day) => ({ t: start + day * DAY, end: start + (day + 1) * DAY, open: 99 + day, high: 100 + day, low: 99 + day, close: 100 + day })),
  current: { price: 299, pricedAt: new Date(now).toISOString() },
}
const asset = { symbol: '$UP', assetClass: 'crypto' as const, sourceId: 'UP', name: null }
const tweet = (id: string, day: number, direction: 'BULL' | 'BEAR'): ClassifiedTweet => ({
  id, text: id, createdAt: new Date(start + day * DAY + 3600_000).toISOString(), url: '', assets: ['$UP'],
  stances: [{ asset: '$UP', direction, conviction: 0.9 }],
})

describe('callsFromSeries', () => {
  test('counts every post as its own call, scored from its own entry', () => {
    const calls = callsFromSeries('t', '$UP', asset, [tweet('a', 0, 'BULL'), tweet('b', 10, 'BULL')], series, now)
    expect(calls.map((call) => call.firstTweetId)).toEqual(['a', 'b'])
    expect(calls[0].return7d).toBeCloseTo(7 / 100)
    expect(calls[1].return7d).toBeCloseTo(7 / 110)
    expect(calls[1].entryPrice).toBe(110)
  })

  test('scores a bearish post as a gain when the price falls and a loss when it rises', () => {
    const [bull, bear] = callsFromSeries('t', '$UP', asset, [tweet('a', 0, 'BULL'), tweet('b', 5, 'BEAR')], series, now)
    expect(bull.direction).toBe('BULL')
    expect(bear.direction).toBe('BEAR')
    expect(bear.return30d).toBeCloseTo(-30 / 105)
  })

  test('leaves a horizon empty until the post is that old', () => {
    const calls = callsFromSeries('t', '$UP', asset, [tweet('a', 100, 'BULL'), tweet('b', 125, 'BULL')], series, now)
    expect(calls.map((call) => call.return90d === null)).toEqual([false, true])
  })

  test('carries a settled post forward as stored and never reprices it', () => {
    const settled = new Map([[settledKey('a', '$UP', 'BULL'), { entryPrice: 50, entryAt: '2026-01-01T01:00:00.000Z', return7d: 0.5, return30d: 0.6, return90d: 0.7 }]])
    const [first, second] = callsFromSeries('t', '$UP', asset, [tweet('a', 0, 'BULL'), tweet('b', 10, 'BULL')], series, now, settled)
    expect(first).toMatchObject({ entryPrice: 50, return7d: 0.5, return30d: 0.6, return90d: 0.7 })
    expect(first.returnPct).toBeCloseTo((299 - 50) / 50)
    expect(second.return7d).toBeCloseTo(7 / 110)
  })
})
