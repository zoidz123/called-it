import { afterEach, expect, mock, test } from 'bun:test'
import { summarizeIdea, summaryPrompt } from './index'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

const posts = [
  { name: 'Gublo', direction: 'BULL' as const, text: 'BUY $MU. i see it at $1500 https://t.co/uMhVtVuNkC' },
  { name: 'Heisenberg', direction: 'BEAR' as const, text: '$MU double top' },
]

test('lists each post with its account and stance, without X short links', () => {
  expect(summaryPrompt('$MU', posts)).toBe('Ticker: $MU\n\nPosts:\n1. Gublo (bullish): BUY $MU. i see it at $1500\n2. Heisenberg (bearish): $MU double top')
})

test('asks the configured model and returns its text on one line', async () => {
  const calls: any[] = []
  globalThis.fetch = mock(async (url: any, init: any) => {
    calls.push({ url, body: JSON.parse(init.body), key: init.headers['x-api-key'] })
    return new Response(JSON.stringify({ content: [{ type: 'text', text: ' Gublo sees $1,500.\nHeisenberg calls a double top. ' }] }))
  }) as any

  const summary = await summarizeIdea('$MU', posts, { apiKey: 'test-key', model: 'test-model' })

  expect(summary).toBe('Gublo sees $1,500. Heisenberg calls a double top.')
  expect(calls).toHaveLength(1)
  expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages')
  expect(calls[0].key).toBe('test-key')
  expect(calls[0].body.model).toBe('test-model')
  expect(calls[0].body.messages).toEqual([{ role: 'user', content: summaryPrompt('$MU', posts) }])
})

test('fails on an error response instead of returning nothing', async () => {
  globalThis.fetch = mock(async () => new Response('{"error":{"message":"invalid x-api-key"}}', { status: 401 })) as any
  await expect(summarizeIdea('$MU', posts, { apiKey: 'bad', model: 'test-model' })).rejects.toThrow('Anthropic 401')
})
