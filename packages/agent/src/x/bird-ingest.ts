import type { AgentStore, ScanStatus, ScanStream } from '../store'
import { BirdError } from './bird-errors'
import { parseTimelinePage } from './bird-parser'
import type { BirdRunner } from './bird-runner'

export type ScanProgressStage = 'bird_auth' | 'bird_head' | 'bird_backfill' | 'bird_rate_paused'

export type ScanAccountResult = {
  handle: string
  status: 'complete' | 'partial' | 'needs_auth' | 'rate_paused' | 'tool_incompatible' | 'unavailable'
  stopReason: string
  committedPages: number
  committedPosts: number
  retries: number
  retryNotBefore?: string
}

export type IngestOptions = {
  runner: BirdRunner
  store: AgentStore
  principalHash: string
  requestedFrom: string
  requestedTo?: string
  maxPagesPerHandle?: number
  globalPageBudget?: number
  overlapKnownIds?: number
  minDelayMs?: number
  jitterMs?: number
  now?: () => Date
  sleep?: (ms: number) => Promise<void>
  random?: () => number
  onProgress?: (stage: ScanProgressStage, handle: string) => void
}

let globalBirdQueue: Promise<void> = Promise.resolve()

export async function ingestHandles(handles: string[], options: IngestOptions) {
  const normalized = [...new Set(handles.map(normalizeHandle))]
  const runId = options.store.startRun()
  const results: ScanAccountResult[] = []
  let remainingBudget = Math.max(1, options.globalPageBudget ?? 500)
  for (const [handleIndex, handle] of normalized.entries()) {
    if (remainingBudget <= 0) {
      const result = budgetResult(handle)
      results.push(result)
      options.store.finalizeCoverage(runId, handle, 'partial', result.stopReason, options.requestedFrom, requestedTo(options), nowIso(options))
      continue
    }
    const result = await scanAccount(runId, handle, Math.min(remainingBudget, options.maxPagesPerHandle ?? 100), options)
    remainingBudget -= result.committedPages
    results.push(result)
    if (result.status === 'rate_paused') break
    if (result.committedPages > 0 && handleIndex < normalized.length - 1 && remainingBudget > 0) await pace(options)
  }
  return { runId, results, coverage: options.store.getCoverage(runId) }
}

async function scanAccount(runId: string, handle: string, pageBudget: number, options: IngestOptions): Promise<ScanAccountResult> {
  const knownBefore = options.store.knownPostIds(handle)
  let committedPages = 0
  let committedPosts = 0
  let retries = 0
  let headCursor: string | null = null
  let firstHeadNextCursor: string | null = null
  let overlapKnownCount = 0
  let overlapConsecutivePages = 0
  options.onProgress?.('bird_head', handle)

  while (committedPages < pageBudget) {
    const outcome = await fetchAndCommit({ runId, handle, stream: 'head', cursor: headCursor, knownBefore, overlapKnownCount, overlapConsecutivePages, options })
    retries += outcome.retries
    if ('error' in outcome) return stopFromError(runId, handle, 'head', outcome.error, committedPages, committedPosts, retries, options)
    committedPages++
    committedPosts += outcome.posts
    if (committedPages === 1) firstHeadNextCursor = outcome.nextCursor
    overlapKnownCount = outcome.overlapKnownCount
    overlapConsecutivePages = outcome.overlapConsecutivePages
    if (outcome.duplicateOnly) return finalize('partial', 'duplicate_only_page', runId, handle, committedPages, committedPosts, retries, options)
    if (outcome.repeatedCursor) return finalize('partial', 'repeated_cursor', runId, handle, committedPages, committedPosts, retries, options)
    if (knownBefore.size === 0) break
    if (knownBefore.size > 0 && overlapKnownCount >= (options.overlapKnownIds ?? 20) && overlapConsecutivePages >= 2) {
      break
    }
    if (!outcome.nextCursor) {
      return finalize('complete', 'bird_exhausted', runId, handle, committedPages, committedPosts, retries, options)
    }
    headCursor = outcome.nextCursor
    await pace(options)
  }

  options.onProgress?.('bird_backfill', handle)
  let tail = options.store.getCursor(handle, 'tail')
  if (!tail) {
    options.store.initializeCursor(handle, 'tail', options.principalHash, firstHeadNextCursor, nowIso(options))
    tail = options.store.getCursor(handle, 'tail')
  }
  const tailCursorFromLedger = Boolean(tail)
  let tailCursor = tailCursorFromLedger ? tail?.opaque_tail_cursor ?? null : firstHeadNextCursor
  if (!tailCursor) return finalize('complete', 'bird_exhausted', runId, handle, committedPages, committedPosts, retries, options)
  await pace(options)
  let oldPages = 0

  while (committedPages < pageBudget) {
    const outcome = await fetchAndCommit({ runId, handle, stream: 'tail', cursor: tailCursor, knownBefore, overlapKnownCount: 0, overlapConsecutivePages: 0, options })
    retries += outcome.retries
    if ('error' in outcome) {
      if (outcome.error.kind === 'cursor_rejected') {
        options.store.restartCursor(handle, 'tail', nowIso(options))
        tailCursor = null
        oldPages = 0
        continue
      }
      return stopFromError(runId, handle, 'tail', outcome.error, committedPages, committedPosts, retries, options)
    }
    committedPages++
    committedPosts += outcome.posts
    if (outcome.allOlderThanBoundary) oldPages++
    else oldPages = 0
    if (outcome.duplicateOnly) return finalize('partial', 'duplicate_only_page', runId, handle, committedPages, committedPosts, retries, options)
    if (outcome.repeatedCursor) return finalize('partial', 'repeated_cursor', runId, handle, committedPages, committedPosts, retries, options)
    if (oldPages >= 2) return finalize('complete', 'lookback_reached', runId, handle, committedPages, committedPosts, retries, options)
    if (!outcome.nextCursor) return finalize('complete', 'bird_exhausted', runId, handle, committedPages, committedPosts, retries, options)
    tailCursor = outcome.nextCursor
    await pace(options)
  }
  return finalize('partial', 'page_budget', runId, handle, committedPages, committedPosts, retries, options)
}

async function fetchAndCommit(input: {
  runId: string
  handle: string
  stream: ScanStream
  cursor: string | null
  knownBefore: Set<string>
  overlapKnownCount: number
  overlapConsecutivePages: number
  options: IngestOptions
}): Promise<{
  posts: number
  nextCursor: string | null
  duplicateOnly: boolean
  repeatedCursor: boolean
  allOlderThanBoundary: boolean
  overlapKnownCount: number
  overlapConsecutivePages: number
  retries: number
} | { error: BirdError; retries: number }> {
  let retries = 0
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await serialized(() => input.options.runner.run({ type: 'user-tweets', handle: input.handle, cursor: input.cursor ?? undefined }))
      let page: ReturnType<typeof parseTimelinePage>
      try {
        page = parseTimelinePage(result.stdout, input.handle)
      } catch {
        return { error: new BirdError('tool_incompatible', 'Bird returned malformed or incompatible JSON.'), retries }
      }
      if (!page.posts.length && page.nextCursor) return { error: new BirdError('tool_incompatible', 'Bird returned an unexplained empty page.'), retries }
      const knownOnPage = page.posts.filter((post) => input.knownBefore.has(post.id)).length
      const consecutive = knownOnPage > 0 ? input.overlapConsecutivePages + 1 : 0
      const overlap = knownOnPage > 0 ? input.overlapKnownCount + knownOnPage : 0
      const committed = input.options.store.commitPage({
        runId: input.runId,
        handle: input.handle,
        stream: input.stream,
        inputCursor: input.cursor,
        outputCursor: page.nextCursor ?? null,
        attempt,
        posts: page.posts,
        principalHash: input.options.principalHash,
        knownBefore: input.knownBefore,
        overlapKnownCount: overlap,
        overlapConsecutivePages: consecutive,
        requestedFrom: input.options.requestedFrom,
        requestedTo: requestedTo(input.options),
        now: nowIso(input.options),
      })
      return {
        posts: page.posts.length,
        nextCursor: page.nextCursor ?? null,
        duplicateOnly: page.posts.length > 0 && committed.newCount === 0 && knownOnPage === 0,
        repeatedCursor: Boolean(input.cursor && page.nextCursor === input.cursor),
        allOlderThanBoundary: page.posts.length > 0 && page.posts.every((post) => post.createdAt < input.options.requestedFrom),
        overlapKnownCount: overlap,
        overlapConsecutivePages: consecutive,
        retries,
      }
    } catch (error) {
      const birdError = error instanceof BirdError ? error : new BirdError('unknown', 'Bird request failed.')
      if (!birdError.retryable || attempt === 3) return { error: birdError, retries }
      const delay = attempt === 1 ? 30_000 : 120_000
      retries++
      await (input.options.sleep ?? sleep)(delay)
    }
  }
  return { error: new BirdError('unknown', 'Bird request failed.'), retries }
}

function stopFromError(runId: string, handle: string, stream: ScanStream, error: BirdError, committedPages: number, committedPosts: number, retries: number, options: IngestOptions): ScanAccountResult {
  const mapping: Record<BirdError['kind'], { status: ScanAccountResult['status']; cursorStatus: ScanStatus; reason: string }> = {
    auth: { status: 'needs_auth', cursorStatus: 'needs_auth', reason: 'authentication_required' },
    rate_limit: { status: 'rate_paused', cursorStatus: 'rate_paused', reason: 'rate_limited' },
    unavailable_account: { status: 'unavailable', cursorStatus: 'unavailable', reason: 'account_unavailable' },
    not_found: { status: 'partial', cursorStatus: 'partial', reason: 'post_not_found' },
    tool_incompatible: { status: 'tool_incompatible', cursorStatus: 'tool_incompatible', reason: 'bird_incompatible' },
    cursor_rejected: { status: 'partial', cursorStatus: 'partial', reason: 'cursor_rejected' },
    network: { status: 'partial', cursorStatus: 'partial', reason: 'network_error' },
    server: { status: 'partial', cursorStatus: 'partial', reason: 'server_error' },
    timeout: { status: 'partial', cursorStatus: 'partial', reason: 'timeout' },
    unknown: { status: 'partial', cursorStatus: 'error', reason: 'bird_error' },
  }
  const mapped = mapping[error.kind]
  const retryNotBefore = error.kind === 'rate_limit' ? new Date((options.now?.() ?? new Date()).getTime() + 15 * 60_000).toISOString() : null
  if (error.kind === 'rate_limit') options.onProgress?.('bird_rate_paused', handle)
  options.store.markFailure({
    runId,
    handle,
    stream,
    status: mapped.cursorStatus,
    reason: mapped.reason,
    errorClass: error.kind,
    errorDetail: error.message,
    requestedFrom: options.requestedFrom,
    requestedTo: requestedTo(options),
    principalHash: options.principalHash,
    retryNotBefore,
    now: nowIso(options),
  })
  return { handle, status: mapped.status, stopReason: mapped.reason, committedPages, committedPosts, retries, ...(retryNotBefore ? { retryNotBefore } : {}) }
}

function finalize(status: 'complete' | 'partial', reason: string, runId: string, handle: string, committedPages: number, committedPosts: number, retries: number, options: IngestOptions): ScanAccountResult {
  options.store.finalizeCoverage(runId, handle, status === 'complete' ? 'best_effort' : 'partial', reason, options.requestedFrom, requestedTo(options), nowIso(options))
  return { handle, status, stopReason: reason, committedPages, committedPosts, retries }
}

function budgetResult(handle: string): ScanAccountResult {
  return { handle, status: 'partial', stopReason: 'global_page_budget', committedPages: 0, committedPosts: 0, retries: 0 }
}

async function serialized<T>(task: () => Promise<T>): Promise<T> {
  const previous = globalBirdQueue
  let release!: () => void
  globalBirdQueue = new Promise<void>((resolve) => { release = resolve })
  await previous
  try {
    return await task()
  } finally {
    release()
  }
}

async function pace(options: IngestOptions) {
  const floor = Math.max(1000, options.minDelayMs ?? 2000)
  const jitter = Math.max(0, Math.min(500, options.jitterMs ?? 500))
  await (options.sleep ?? sleep)(floor + Math.floor((options.random ?? Math.random)() * (jitter + 1)))
}

function requestedTo(options: IngestOptions) {
  return options.requestedTo ?? nowIso(options)
}

function nowIso(options: IngestOptions) {
  return (options.now?.() ?? new Date()).toISOString()
}

function normalizeHandle(handle: string) {
  const value = handle.replace(/^@/, '').trim().toLowerCase()
  if (!/^[a-z0-9_]{1,15}$/.test(value)) throw new Error(`Invalid X handle: ${handle}`)
  return value
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
