import { afterEach, expect, mock, test } from 'bun:test'
import { classifyCandidates } from './index'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
  delete process.env.TYPESAFE_API_KEY
})

const candidate = { id: '1', text: 'Loading up on $NVDA, $AMD is just the comp', createdAt: '2026-03-02T00:00:00.000Z', url: '', assets: ['$NVDA', '$AMD'] }
const answers = {
  $NVDA: { type: 'choice', choice: 'bull', probabilities: { bull: 0.91, bear: 0.02, none: 0.07 }, confidence: 0.87 },
  $AMD: { type: 'choice', choice: 'none', probabilities: { bull: 0.2, bear: 0.05, none: 0.75 }, confidence: 0.6 },
}

test('classifies each ticker with one Jev choice question and keeps confident calls', async () => {
  process.env.TYPESAFE_API_KEY = 'test-key'
  const calls: any[] = []
  globalThis.fetch = mock(async (url: any, init: any) => {
    calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization })
    return new Response(JSON.stringify({ model: 'jev-1.13.0', answers }))
  }) as any

  const classified = await classifyCandidates([candidate])

  expect(calls).toHaveLength(1)
  expect(calls[0].url).toBe('https://api.typesafe.ai/v1/systemone')
  expect(calls[0].auth).toBe('Bearer test-key')
  expect(calls[0].body.state).toEqual({ tweet: candidate.text })
  expect(Object.keys(calls[0].body.questions)).toEqual(['$NVDA', '$NVDA:sarcasm', '$AMD', '$AMD:sarcasm'])
  expect(calls[0].body.questions.$NVDA.instructions.ticker).toBe('$NVDA')
  expect(Object.keys(calls[0].body.questions.$NVDA.criteria)).toEqual(['bull', 'bear', 'none'])
  expect(classified).toEqual([{ ...candidate, stances: [{ asset: '$NVDA', direction: 'BULL', conviction: 0.91 }] }])
})

test('drops a directional answer below the conviction floor', async () => {
  process.env.TYPESAFE_API_KEY = 'test-key'
  globalThis.fetch = mock(async () => new Response(JSON.stringify({
    answers: { ...answers, $NVDA: { type: 'choice', choice: 'bull', probabilities: { bull: 0.55, bear: 0.05, none: 0.4 }, confidence: 0.3 } },
  }))) as any
  expect(await classifyCandidates([candidate])).toEqual([])
})

test('drops a confident call when the post is sarcastic', async () => {
  process.env.TYPESAFE_API_KEY = 'test-key'
  globalThis.fetch = mock(async () => new Response(JSON.stringify({
    answers: { ...answers, '$NVDA:sarcasm': { type: 'noul', noul: 0.57 }, '$AMD:sarcasm': { type: 'noul', noul: 0.1 } },
  }))) as any
  expect(await classifyCandidates([candidate])).toEqual([])
})

test('retries when rate limited', async () => {
  process.env.TYPESAFE_API_KEY = 'test-key'
  let attempts = 0
  globalThis.fetch = mock(async () => {
    attempts += 1
    if (attempts === 1) return new Response('slow down', { status: 429, headers: { 'retry-after': '0.01' } })
    return new Response(JSON.stringify({ answers }))
  }) as any
  expect((await classifyCandidates([candidate]))[0].stances[0].direction).toBe('BULL')
  expect(attempts).toBe(2)
})
