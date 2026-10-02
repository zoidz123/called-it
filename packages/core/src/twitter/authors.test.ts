import { expect, test } from 'bun:test'
import { authorGroups, authorsQuery, postsByAuthor } from './index'

test('asks for every account in one query', () => {
  expect(authorsQuery(['alice', 'bob'], new Date('2026-10-02T00:00:00.000Z')))
    .toBe('(from:alice OR from:bob) -is:retweet -is:reply since_time:1790899200')
})

test('splits a long list of accounts into queries under the length limit', () => {
  const handles = Array.from({ length: 10 }, (_, index) => `account_${index}`)
  const groups = authorGroups(handles, 60)
  expect(groups.flat()).toEqual(handles)
  expect(groups.length).toBeGreaterThan(1)
  for (const group of groups) expect(group.map((handle) => `from:${handle} OR `).join('').length).toBeLessThanOrEqual(60)
})

test('keeps one group when everything fits', () => {
  expect(authorGroups(['alice', 'bob'])).toEqual([['alice', 'bob']])
  expect(authorGroups([])).toEqual([])
})

test('files each post under the account that wrote it and drops anyone else', () => {
  const payload = {
    tweets: [
      { id: '1', text: 'BUY $MU', createdAt: 'Thu Oct 01 00:29:00 +0000 2026', author: { userName: 'Alice' } },
      { id: '2', text: '$QQQ double top', createdAt: 'Thu Oct 01 00:30:00 +0000 2026', author: { userName: 'bob' } },
      { id: '3', text: 'quoted by a stranger', createdAt: 'Thu Oct 01 00:31:00 +0000 2026', author: { userName: 'mallory' } },
      { id: '4', text: '', createdAt: 'Thu Oct 01 00:32:00 +0000 2026', author: { userName: 'bob' } },
    ],
  }
  const posts = postsByAuthor(payload, ['alice', 'bob'])
  expect([...posts.keys()]).toEqual(['alice', 'bob'])
  expect(posts.get('alice')).toEqual([{ id: '1', text: 'BUY $MU', createdAt: 'Thu Oct 01 00:29:00 +0000 2026', url: 'https://x.com/alice/status/1' }])
  expect(posts.get('bob')?.map((tweet) => tweet.id)).toEqual(['2'])
})
