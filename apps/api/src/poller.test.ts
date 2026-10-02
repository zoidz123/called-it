import { expect, test } from 'bun:test'

// The poller's imports open a database pool on load, which needs a connection string but never connects here.
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test'
const { postsReadFor, splitByGap } = await import('./poller')

const account = (handle: string, lastScannedAt: string) => ({
  user: { id: '1', handle, name: handle, avatarUrl: null, bio: null, followers: 0, verified: false },
  lastScannedAt,
})

test('reads recently read accounts together and hands the ones far behind to a scan', () => {
  const now = Date.parse('2026-10-02T12:00:00.000Z')
  const { fresh, stale } = splitByGap([
    account('recent', '2026-10-02T11:45:00.000Z'),
    account('edge', '2026-10-02T06:00:00.000Z'),
    account('behind', '2026-10-01T12:00:00.000Z'),
  ], now)
  expect(fresh.map((item) => item.user.handle)).toEqual(['recent', 'edge'])
  expect(stale.map((item) => item.user.handle)).toEqual(['behind'])
})

test('reads shared-search posts with a lowercase handle and leaves a cut-off account unread', () => {
  const posts = new Map([['trader', [{ id: '1' }]]])
  const cutOff = new Set(['other'])
  expect(postsReadFor('Trader', posts, cutOff)?.map((tweet) => tweet.id)).toEqual(['1'])
  expect(postsReadFor('Missing', posts, cutOff)).toEqual([])
  expect(postsReadFor('Other', posts, cutOff)).toBeNull()
})
