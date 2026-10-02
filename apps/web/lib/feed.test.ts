import { describe, expect, test } from 'bun:test'
import { buildIdeas, ordinal, rankIdeas, repeatLabel, timeAgo, weekSummary, type FeedCall } from './feed'

function call(fields: Partial<FeedCall> = {}): FeedCall {
  return {
    tweet_id: '1',
    handle: 'alice',
    asset: '$MU',
    direction: 'BULL',
    created_at: '2026-10-01T00:00:00.000Z',
    entry_price: 100,
    return_pct: 0,
    text: 'BUY $MU',
    url: 'https://x.com/alice/status/1',
    prior: 5,
    prior_same: 5,
    wins: 3,
    losses: 2,
    avg_return: 0.1,
    ...fields,
  }
}

describe('repeatLabel', () => {
  test('counts the posts on a heavily repeated ticker', () => {
    expect(repeatLabel(call({ prior: 72 }))).toBe('73rd post on $MU')
  })

  test('says nothing for a ticker the account rarely posts about', () => {
    expect(repeatLabel(call({ prior: 5 }))).toBeNull()
    expect(repeatLabel(call({ prior: 0 }))).toBeNull()
  })
})

describe('buildIdeas', () => {
  // Newest first, as the API returns them.
  const calls = [
    call({ tweet_id: '4', handle: 'alice', asset: '$QQQ', direction: 'BEAR', created_at: '2026-10-03T00:00:00.000Z', return_pct: 0.03, prior: 6, wins: 4, losses: 2, avg_return: 0.2 }),
    call({ tweet_id: '3', handle: 'bob', asset: '$QQQ', created_at: '2026-10-02T00:00:00.000Z', return_pct: -0.01, prior: 0, prior_same: 0, wins: 0, losses: 0, avg_return: null }),
    call({ tweet_id: '2', handle: 'carol', asset: '$QQQ', created_at: '2026-10-02T00:00:00.000Z', return_pct: 0.01, prior: 9, wins: 6, losses: 3, avg_return: 0.4 }),
    call({ tweet_id: '1', handle: 'alice', asset: '$QQQ', direction: 'BULL', created_at: '2026-10-01T00:00:00.000Z', return_pct: 0.01, prior: 5, wins: 3, losses: 2, avg_return: 0.1 }),
  ]
  const [idea] = buildIdeas(calls)

  test('makes one idea per asset with its span and average move', () => {
    expect(buildIdeas([...calls, call({ asset: '$MU' })]).map((item) => item.asset)).toEqual(['$QQQ', '$MU'])
    expect(idea.firstCallAt).toBe('2026-10-01T00:00:00.000Z')
    expect(idea.latestCallAt).toBe('2026-10-03T00:00:00.000Z')
    expect(idea.since).toBeCloseTo(0.01)
  })

  test('takes where an account stands from its latest call and its record from before the week', () => {
    expect(idea.callers.find((caller) => caller.handle === 'alice')).toEqual({ handle: 'alice', direction: 'BEAR', prior: 5, wins: 3, losses: 2, avgReturn: 0.1 })
    expect([idea.bulls, idea.bears]).toEqual([2, 1])
  })

  test('puts the best record on the asset first and accounts without one last', () => {
    expect(idea.callers.map((caller) => caller.handle)).toEqual(['carol', 'alice', 'bob'])
  })

  test('orders accounts without a record by how long they have posted about the asset', () => {
    const unsettled = { wins: 0, losses: 0, avg_return: null }
    const [zec] = buildIdeas([call({ handle: 'alice', prior: 0, prior_same: 0, ...unsettled }), call({ handle: 'bob', prior: 11, ...unsettled })])
    expect(zec.callers.map((caller) => caller.handle)).toEqual(['bob', 'alice'])
  })
})

describe('rankIdeas', () => {
  const ideas = buildIdeas([
    call({ handle: 'alice', asset: '$MU', created_at: '2026-10-03T00:00:00.000Z', prior: 0, prior_same: 0, wins: 0, losses: 0, avg_return: null }),
    call({ handle: 'alice', asset: '$QQQ', created_at: '2026-10-02T00:00:00.000Z', wins: 4, losses: 2, avg_return: 0.1 }),
    call({ handle: 'bob', asset: '$QQQ', direction: 'BEAR', created_at: '2026-10-02T00:00:00.000Z', wins: 1, losses: 1, avg_return: 0.9 }),
    call({ handle: 'carol', asset: '$ZEC', created_at: '2026-10-01T00:00:00.000Z', wins: 7, losses: 1, avg_return: 0.5 }),
  ])
  const assets = (rank: Parameters<typeof rankIdeas>[1]) => rankIdeas(ideas, rank).map((idea) => idea.asset)

  test('ranks by how many accounts called the asset', () => {
    expect(assets('called')).toEqual(['$QQQ', '$MU', '$ZEC'])
  })

  test('ranks by the best record behind it, ignoring records too thin to mean anything', () => {
    expect(assets('record')).toEqual(['$ZEC', '$QQQ'])
  })

  test('keeps only assets someone called for the first time', () => {
    expect(assets('new')).toEqual(['$MU'])
  })

  test('keeps only assets the accounts disagree on', () => {
    expect(assets('contested')).toEqual(['$QQQ'])
  })
})

describe('weekSummary', () => {
  test('counts accounts, assets and directions', () => {
    expect(weekSummary([
      call({ handle: 'alice', asset: '$QQQ' }),
      call({ handle: 'bob', asset: '$QQQ', direction: 'BEAR' }),
      call({ handle: 'bob', asset: '$MU' }),
    ])).toEqual({ accounts: 2, assets: 2, calls: 3, bullish: 2, bearish: 1 })
  })
})

describe('formatting', () => {
  test('writes the age of a post in the largest whole unit', () => {
    const now = Date.parse('2026-10-02T12:00:00.000Z')
    expect(timeAgo('2026-10-02T11:59:40.000Z', now)).toBe('now')
    expect(timeAgo('2026-10-02T11:15:00.000Z', now)).toBe('45m')
    expect(timeAgo('2026-10-02T02:00:00.000Z', now)).toBe('10h')
    expect(timeAgo('2026-09-29T12:00:00.000Z', now)).toBe('3d')
  })

  test('writes ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 73, 112].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '73rd', '112th'])
  })
})
