import { describe, expect, test } from 'bun:test'
import { computeStats } from './index'
import type { ScoredCall } from '../types'

function call(return7d: number | null, return30d: number | null, return90d: number | null): ScoredCall {
  return {
    handle: 'trader', asset: '$TEST', assetClass: 'stock', sourceId: 'TEST', direction: 'BULL',
    firstPitchAt: '2026-03-02T00:00:00.000Z', firstTweetId: '1', entryPrice: 100, currentPrice: 150,
    returnPct: 0.5, return7d, return30d, return90d, isUp: true, mentions: 1, bulls: 1, bears: 0,
    pricedAt: '2026-06-01T00:00:00.000Z', evidence: [], callouts: [],
  }
}

describe('computeStats horizons', () => {
  test('averages each horizon over the calls that have settled it', () => {
    const stats = computeStats('trader', [call(0.1, 0.2, null), call(-0.3, null, null), call(0.2, 0.4, null)])
    expect(stats.horizons[7].calls).toBe(3)
    expect(stats.horizons[7].avgReturn).toBeCloseTo(0)
    expect(stats.horizons[7].hitRate).toBeCloseTo(2 / 3)
    expect(stats.horizons[30]).toEqual({ avgReturn: expect.closeTo(0.3), medianReturn: expect.closeTo(0.3), hitRate: 1, calls: 2 })
    expect(stats.horizons[90]).toEqual({ avgReturn: 0, medianReturn: 0, hitRate: 0, calls: 0 })
  })
})
