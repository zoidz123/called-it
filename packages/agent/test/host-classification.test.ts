import { expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { analyzeStoredPostsWithHost, buildHostClassificationRequest } from '../src/analysis'
import { AgentStore } from '../src/store'
import { parseTimelinePage } from '../src/x/bird-parser'

test('uses a complete constrained host response without a model API key', async () => {
  const store = new AgentStore(':memory:')
  const post = parseTimelinePage(JSON.stringify({
    tweets: [{ id: '12345', text: '$BTC could be interesting', createdAt: '2026-07-15T12:00:00.000Z', username: 'alpha' }],
  }), 'alpha').posts[0]
  store.commitPage({
    runId: 'run',
    handle: 'alpha',
    stream: 'head',
    inputCursor: null,
    outputCursor: null,
    attempt: 1,
    posts: [post],
    principalHash: 'principal',
    knownBefore: new Set(),
    overlapKnownCount: 0,
    overlapConsecutivePages: 0,
    requestedFrom: '2026-01-01T00:00:00.000Z',
    requestedTo: '2026-07-17T00:00:00.000Z',
    now: '2026-07-17T00:00:00.000Z',
  })
  store.finalizeCoverage('run', 'alpha', 'best_effort', 'bird_exhausted', '2026-01-01T00:00:00.000Z', '2026-07-17T00:00:00.000Z', '2026-07-17T00:00:00.000Z')
  const request = buildHostClassificationRequest({
    requestId: randomUUID(),
    store,
    handles: ['alpha'],
    requestedFrom: '2026-01-01T00:00:00.000Z',
    requestedTo: '2026-07-17T00:00:00.000Z',
    coverage: store.getCoverage('run'),
    scanResults: [{ handle: 'alpha', status: 'complete', stopReason: 'bird_exhausted', committedPages: 1, committedPosts: 1, retries: 0 }],
  })
  expect(request.candidates).toHaveLength(1)

  const previousKey = process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY
  try {
    const accounts = await analyzeStoredPostsWithHost(store, request, {
      schemaVersion: 1,
      requestId: request.requestId,
      reviewedCandidateCount: 1,
      results: [],
    })
    expect(accounts[0].stats.callsTotal).toBe(0)
    await expect(analyzeStoredPostsWithHost(store, request, {
      schemaVersion: 1,
      requestId: request.requestId,
      reviewedCandidateCount: 0,
      results: [],
    })).rejects.toThrow('reviewedCandidateCount does not match')
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
    store.close()
  }
})
