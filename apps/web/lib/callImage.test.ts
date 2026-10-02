import { describe, expect, test } from 'bun:test'
import { callResult, chartWindow, exitPrice, priceTicks, type ImageCall } from './callImage'

const DAY = 24 * 60 * 60 * 1000
const start = Date.parse('2026-08-01T00:00:00.000Z')
const bars = Array.from({ length: 80 }, (_, index) => ({ t: start + index * DAY, open: 1, high: 2, low: 0.5, close: 1.5 }))
const call = (fields: Partial<ImageCall> = {}): ImageCall => ({
  direction: 'BULL', entry_at: '2026-08-21T18:00:00.000Z', created_at: '2026-08-21T17:23:00.000Z', entry_price: 2,
  return_7d: 0.4, return_30d: 0.9, return_90d: null, ...fields,
})

describe('callResult', () => {
  test('leads with the chosen holding period when the call is old enough', () => {
    expect(callResult(call(), 30, 5)).toEqual({ days: 30, value: 0.9 })
    expect(callResult(call(), 7, 5)).toEqual({ days: 7, value: 0.4 })
  })

  test('falls back to the longest settled period, then to the move so far', () => {
    expect(callResult(call(), 90, 5)).toEqual({ days: 30, value: 0.9 })
    expect(callResult(call({ return_7d: null, return_30d: null }), 30, 2.2).value).toBeCloseTo(0.1)
    expect(callResult(call({ return_7d: null, return_30d: null, direction: 'BEAR' }), 30, 2.2).value).toBeCloseTo(-0.1)
  })
})

describe('exitPrice', () => {
  test('a bearish call gains when the price falls', () => {
    expect(exitPrice({ direction: 'BULL', entry_price: 2 }, 0.5)).toBe(3)
    expect(exitPrice({ direction: 'BEAR', entry_price: 2 }, 0.5)).toBe(1)
  })
})

describe('chartWindow', () => {
  test('frames the call and the day its result was measured', () => {
    const shown = chartWindow(bars, '2026-08-21T18:00:00.000Z', 30)
    expect(new Date(shown.bars[shown.entry].t).toISOString().slice(0, 10)).toBe('2026-08-21')
    expect(new Date(shown.bars[shown.exit].t).toISOString().slice(0, 10)).toBe('2026-09-20')
    expect(shown.entry).toBe(15)
    expect(shown.bars).toHaveLength(15 + 30 + 12 + 1)
  })

  test('a result still open runs to the last bar, and a call near the start keeps what history there is', () => {
    const shown = chartWindow(bars, '2026-08-03T10:00:00.000Z', null)
    expect(shown.entry).toBe(2)
    expect(shown.exit).toBe(shown.bars.length - 1)
    expect(shown.bars).toHaveLength(80)
  })
})

describe('priceTicks', () => {
  test('picks round levels inside the range', () => {
    expect(priceTicks(1.9, 6.1)).toEqual([2, 3, 4, 5, 6])
    expect(priceTicks(0.0052, 0.0121)).toEqual([0.006, 0.008, 0.01, 0.012])
  })
})
