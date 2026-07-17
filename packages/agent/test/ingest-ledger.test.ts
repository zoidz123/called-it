import { describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AgentStore } from '../src/store'
import { BirdError } from '../src/x/bird-errors'
import { ingestHandles } from '../src/x/bird-ingest'
import { parseTimelinePage, type NormalizedPost } from '../src/x/bird-parser'
import type { BirdCommand, BirdRunner } from '../src/x/bird-runner'
import { reconcileRecentEvidence } from '../src/x/bird-reconcile'

describe('resumable scan ledger', () => {
  test('commits page N minus 1 before an authentication failure on page N', async () => withStore(async (store) => {
    const runner = queuedRunner([
      page([tweet('101', '2026-07-10')], 'tail-1'),
      new BirdError('auth', 'missing cookies'),
    ])
    const result = await ingestHandles(['alpha'], options(store, runner))
    expect(result.results[0]).toMatchObject({ status: 'needs_auth', committedPages: 1, committedPosts: 1 })
    expect(store.getPosts(['alpha'], '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z')).toHaveLength(1)
    expect(result.coverage[0]).toMatchObject({ completeness: 'partial', stop_reason: 'authentication_required', page_count: 1 })
  }))

  test('pauses the global queue for 15 minutes on 429 and preserves coverage', async () => withStore(async (store) => {
    const now = new Date('2026-07-17T12:00:00.000Z')
    const result = await ingestHandles(['alpha', 'beta'], {
      ...options(store, queuedRunner([new BirdError('rate_limit', '429')])),
      now: () => now,
    })
    expect(result.results).toHaveLength(1)
    expect(result.results[0].status).toBe('rate_paused')
    expect(result.results[0].retryNotBefore).toBe('2026-07-17T12:15:00.000Z')
    expect(store.getCursor('alpha', 'head')?.retry_not_before).toBe('2026-07-17T12:15:00.000Z')
  }))

  test('retries 5xx twice after 30 and 120 seconds with the identical cursor input', async () => withStore(async (store) => {
    const commands: BirdCommand[] = []
    const delays: number[] = []
    const queue: Array<string | Error> = [new BirdError('server', '503', true), new BirdError('server', '503', true), page([tweet('150', '2026-07-10')])]
    const runner: BirdRunner = {
      async run(command) {
        commands.push(command)
        const next = queue.shift()
        if (next instanceof Error) throw next
        if (next === undefined) throw new Error('Synthetic retry queue exhausted')
        return { stdout: next, stderr: '' }
      },
    }
    const result = await ingestHandles(['alpha'], { ...options(store, runner), sleep: async (ms) => { delays.push(ms) } })
    expect(result.results[0]).toMatchObject({ status: 'complete', retries: 2 })
    expect(delays).toEqual([30_000, 120_000])
    expect(commands.map((command) => command.type === 'user-tweets' ? command.cursor : 'other')).toEqual([undefined, undefined, undefined])
  }))

  test('continues after a protected target when scanning multiple handles', async () => withStore(async (store) => {
    const runner = queuedRunner([
      new BirdError('unavailable_account', 'protected'),
      page([tweet('201', '2026-07-10')]),
    ])
    const result = await ingestHandles(['alpha', 'beta'], options(store, runner))
    expect(result.results.map((item) => item.status)).toEqual(['unavailable', 'complete'])
  }))

  test('stops an unchanged rescan after known IDs overlap across two pages', async () => withStore(async (store) => {
    const firstTen = Array.from({ length: 10 }, (_, index) => normalized(`30${index}`, `2026-07-${String(16 - index).padStart(2, '0')}`))
    const secondTen = Array.from({ length: 10 }, (_, index) => normalized(`40${index}`, `2026-06-${String(28 - index).padStart(2, '0')}`))
    seedPosts(store, 'alpha', [...firstTen, ...secondTen])
    seedTailCoverage(store, 'alpha', normalized('299', '2025-12-31'))
    const result = await ingestHandles(['alpha'], options(store, queuedRunner([
      page(firstTen.map(raw), 'head-2'),
      page(secondTen.map(raw), 'head-3'),
    ])))
    expect(result.results[0]).toMatchObject({ status: 'complete', committedPages: 2, stopReason: 'lookback_reached' })
  }))

  test('stops repeated cursors and unexplained empty pages as resumable partial gaps', async () => {
    await withStore(async (store) => {
      const repeated = await ingestHandles(['alpha'], options(store, queuedRunner([page([tweet('450', '2026-07-10')], 'same'), page([tweet('451', '2026-07-09')], 'same')])))
      expect(repeated.results[0]).toMatchObject({ status: 'partial', stopReason: 'repeated_cursor', committedPages: 2 })
    })
    await withStore(async (store) => {
      const empty = await ingestHandles(['alpha'], options(store, queuedRunner([readFileSync(join(import.meta.dir, 'fixtures/bird/empty-with-cursor.json'), 'utf8')])))
      expect(empty.results[0]).toMatchObject({ status: 'tool_incompatible', committedPages: 0 })
    })
  })

  test('restarts a rejected tail cursor with a new generation and fast-forwards idempotently', async () => withStore(async (store) => {
    const knownA = Array.from({ length: 10 }, (_, index) => normalized(`50${index}`, '2026-07-15'))
    const knownB = Array.from({ length: 10 }, (_, index) => normalized(`60${index}`, '2026-07-14'))
    seedPosts(store, 'alpha', [...knownA, ...knownB])
    store.initializeCursor('alpha', 'tail', 'principal', 'stale-tail', '2026-07-17T00:00:00.000Z')
    const runner = queuedRunner([
      page(knownA.map(raw), 'head-next'),
      page(knownB.map(raw), 'head-overlap'),
      new BirdError('cursor_rejected', 'invalid cursor'),
      page([tweet('701', '2025-12-20')], 'tail-next'),
      page([tweet('702', '2025-12-19')]),
    ])
    const result = await ingestHandles(['alpha'], options(store, runner))
    expect(result.results[0]).toMatchObject({ status: 'complete', stopReason: 'lookback_reached', committedPages: 4 })
    expect(store.getCursor('alpha', 'tail')?.cursor_generation).toBe(2)
  }))

  test('records post revisions, invalidates dependent records, and requires two separated not-found reads for deletion', () => withStore((store) => {
    const post = normalized('801', '2026-07-10', '$BTC up')
    seedPosts(store, 'alpha', [post])
    const changed = normalized('801', '2026-07-10', '$BTC thesis withdrawn')
    seedPosts(store, 'alpha', [changed], 'run-2')
    const row = store.db.query('SELECT current_revision, text FROM posts WHERE id = ?').get('801') as { current_revision: number; text: string }
    expect(row).toEqual({ current_revision: 2, text: '$BTC thesis withdrawn' })
    expect(store.confirmNotFound('801', '2026-07-17T00:00:00.000Z')).toBe(false)
    expect(store.confirmNotFound('801', '2026-07-18T00:00:01.000Z')).toBe(true)
  }))

  test('reconciles changed targeted reads and ignores auth errors as deletion evidence', async () => withStore(async (store) => {
    seedPosts(store, 'alpha', [normalized('850', '2026-07-10', '$BTC original')])
    const changed = JSON.stringify({ id: '850', text: '$BTC edited', createdAt: '2026-07-10T12:00:00.000Z', username: 'alpha' })
    const first = await reconcileRecentEvidence({ runner: queuedRunner([changed]), store, handles: ['alpha'], since: '2026-07-01T00:00:00.000Z' })
    expect(first).toMatchObject({ checked: 1, changed: 1, tombstoned: 0 })
    const second = await reconcileRecentEvidence({ runner: queuedRunner([new BirdError('auth', 'expired')]), store, handles: ['alpha'], since: '2026-07-01T00:00:00.000Z' })
    expect(second).toMatchObject({ checked: 0, skippedErrors: 1, tombstoned: 0 })
    expect((store.db.query('SELECT deletion_state FROM posts WHERE id = ?').get('850') as { deletion_state: string }).deletion_state).toBe('present')
  }))

  test('does not persist credential-like fixture values in SQLite', () => withStore((store, path) => {
    seedPosts(store, 'alpha', [normalized('901', '2026-07-10', 'public synthetic text')])
    store.close()
    const bytes = readFileSync(path)
    expect(bytes.includes(Buffer.from('fixture-auth-secret'))).toBe(false)
    expect(bytes.includes(Buffer.from('fixture-ct0-secret'))).toBe(false)
  }, false))

  test('creates the SQLite database and auxiliary files with owner-only modes', () => withStore((store, path) => {
    seedPosts(store, 'alpha', [normalized('990', '2026-07-10')])
    expect(statSync(path).mode & 0o777).toBe(0o600)
    for (const auxiliary of [`${path}-wal`, `${path}-shm`]) {
      if (existsSync(auxiliary)) expect(statSync(auxiliary).mode & 0o777).toBe(0o600)
    }
  }))
})

function options(store: AgentStore, runner: BirdRunner) {
  return {
    runner,
    store,
    principalHash: 'salted-principal-hash',
    requestedFrom: '2026-01-01T00:00:00.000Z',
    requestedTo: '2026-07-17T00:00:00.000Z',
    sleep: async () => {},
    random: () => 0,
  }
}

function queuedRunner(queue: Array<string | Error>): BirdRunner {
  return {
    async run(_command: BirdCommand) {
      const next = queue.shift()
      if (next instanceof Error) throw next
      if (next === undefined) throw new Error('Synthetic Bird queue exhausted')
      return { stdout: next, stderr: '' }
    },
  }
}

function page(tweets: Array<Record<string, unknown>>, nextCursor?: string) {
  return JSON.stringify({ tweets, ...(nextCursor ? { nextCursor } : {}) })
}

function tweet(id: string, day: string, text = 'synthetic public post') {
  return { id, text, createdAt: `${day}T12:00:00.000Z`, username: 'alpha' }
}

function raw(post: NormalizedPost) {
  return { id: post.id, text: post.text, createdAt: post.createdAt, username: post.accountHandle }
}

function normalized(id: string, day: string, text = 'synthetic public post') {
  return parseTimelinePage(page([tweet(id, day, text)]), 'alpha').posts[0]
}

function seedPosts(store: AgentStore, handle: string, posts: NormalizedPost[], runId = 'seed-run') {
  store.commitPage({
    runId,
    handle,
    stream: 'head',
    inputCursor: null,
    outputCursor: null,
    attempt: 1,
    posts,
    principalHash: 'principal',
    knownBefore: store.knownPostIds(handle),
    overlapKnownCount: 0,
    overlapConsecutivePages: 0,
    requestedFrom: '2026-01-01T00:00:00.000Z',
    requestedTo: '2026-07-17T00:00:00.000Z',
    now: '2026-07-17T00:00:00.000Z',
  })
}

function seedTailCoverage(store: AgentStore, handle: string, post: NormalizedPost) {
  store.commitPage({
    runId: 'seed-tail-run',
    handle,
    stream: 'tail',
    inputCursor: 'seed-tail-input',
    outputCursor: 'seed-tail-output',
    attempt: 1,
    posts: [post],
    principalHash: 'principal',
    knownBefore: store.knownPostIds(handle),
    overlapKnownCount: 0,
    overlapConsecutivePages: 0,
    requestedFrom: '2026-01-01T00:00:00.000Z',
    requestedTo: '2026-07-17T00:00:00.000Z',
    now: '2026-07-17T00:00:00.000Z',
  })
}

async function withStore<T>(work: (store: AgentStore, path: string) => T | Promise<T>, close = true): Promise<T> {
  const directory = mkdtempSync(join(tmpdir(), 'called-it-ledger-'))
  const path = join(directory, 'test.sqlite')
  const store = new AgentStore(path)
  try {
    return await work(store, path)
  } finally {
    if (close) store.close()
    rmSync(directory, { recursive: true, force: true })
  }
}
