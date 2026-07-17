import { candidatesFromTweets, filterIgnoredCashtags, scoreCalls, type ClassifiedTweet } from '@called-it/core'
import { z } from 'zod'
import type { AccountAnalysis } from './report'
import type { AgentStore, CoverageRecord } from './store'
import type { ScanAccountResult } from './x/bird-ingest'

const candidateSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  text: z.string(),
  createdAt: z.string().datetime(),
  url: z.string(),
  assets: z.array(z.string().regex(/^\$[A-Z][A-Z0-9]{1,9}$/)).min(1),
}).strict()

const coverageSchema = z.object({
  run_id: z.string(),
  account_handle: z.string(),
  requested_from: z.string(),
  requested_to: z.string(),
  observed_from: z.string().nullable(),
  observed_to: z.string().nullable(),
  completeness: z.enum(['best_effort', 'partial', 'error']),
  stop_reason: z.string(),
  page_count: z.number(),
  post_count: z.number(),
  updated_at: z.string(),
}).strict()

const scanResultSchema = z.object({
  handle: z.string(),
  status: z.enum(['complete', 'partial', 'needs_auth', 'rate_paused', 'tool_incompatible', 'unavailable']),
  stopReason: z.string(),
  committedPages: z.number(),
  committedPosts: z.number(),
  retries: z.number(),
  retryNotBefore: z.string().optional(),
}).strict()

export const hostClassificationRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  requestedFrom: z.string().datetime(),
  requestedTo: z.string().datetime(),
  handles: z.array(z.string().min(1)).min(1),
  coverage: z.array(coverageSchema),
  scanResults: z.array(scanResultSchema),
  candidates: z.array(candidateSchema),
}).strict()

export const hostClassificationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().uuid(),
  reviewedCandidateCount: z.number().int().nonnegative(),
  results: z.array(z.object({
    id: z.string().min(1),
    stances: z.array(z.object({
      asset: z.string().regex(/^\$[A-Z][A-Z0-9]{1,9}$/),
      direction: z.enum(['BULL', 'BEAR', 'NONE']),
      conviction: z.number().min(0).max(1),
    }).strict()),
  }).strict()),
}).strict()

export type HostClassificationRequest = z.infer<typeof hostClassificationRequestSchema>
export type HostClassificationResponse = z.infer<typeof hostClassificationResponseSchema>

export function buildHostClassificationRequest(input: {
  requestId: string
  store: AgentStore
  handles: string[]
  requestedFrom: string
  requestedTo: string
  coverage: CoverageRecord[]
  scanResults: ScanAccountResult[]
}): HostClassificationRequest {
  const rows = storedPostRows(input.store, input.handles, input.requestedFrom, input.requestedTo)
  const candidates = input.handles.flatMap((handle) => {
    const tweets = rows
      .filter((post) => post.account_handle === handle && !post.excluded_reason)
      .map((post) => ({ id: post.id, text: post.text, createdAt: post.created_at, url: post.url }))
    return candidatesFromTweets(tweets).map((candidate) => ({ ...candidate, handle }))
  })
  return hostClassificationRequestSchema.parse({
    schemaVersion: 1,
    requestId: input.requestId,
    requestedFrom: input.requestedFrom,
    requestedTo: input.requestedTo,
    handles: input.handles,
    coverage: input.coverage,
    scanResults: input.scanResults,
    candidates,
  })
}

export async function analyzeStoredPostsWithHost(
  store: AgentStore,
  requestInput: unknown,
  responseInput: unknown,
  onProgress?: (stage: 'pricing', handle: string) => void,
): Promise<AccountAnalysis[]> {
  const request = hostClassificationRequestSchema.parse(requestInput)
  const response = hostClassificationResponseSchema.parse(responseInput)
  validateHostResponse(request, response)
  const rows = storedPostRows(store, request.handles, request.requestedFrom, request.requestedTo)
  const responseById = new Map(response.results.map((result) => [result.id, result]))
  const analyses: AccountAnalysis[] = []

  for (const handle of request.handles) {
    const candidates = request.candidates.filter((candidate) => candidate.handle === handle)
    const classified: ClassifiedTweet[] = candidates.map((candidate) => ({
      id: candidate.id,
      text: candidate.text,
      createdAt: candidate.createdAt,
      url: candidate.url,
      assets: candidate.assets,
      stances: (responseById.get(candidate.id)?.stances ?? [])
        .filter((stance) => stance.direction !== 'NONE' && stance.conviction >= 0.7)
        .map((stance) => ({ asset: stance.asset, direction: stance.direction as 'BULL' | 'BEAR', conviction: stance.conviction })),
    }))
    const callsOnly = filterIgnoredCashtags(handle, classified).filter((candidate) => candidate.stances.length > 0)
    onProgress?.('pricing', handle)
    const { calls, stats } = await scoreCalls(handle, callsOnly, { allowLlmAssetResolution: false })
    store.saveAnalysis(callsOnly, calls, new Date().toISOString())
    analyses.push({
      handle,
      stats,
      calls,
      notableComments: callsOnly.slice(0, 5).map((tweet) => ({ postId: tweet.id, createdAt: tweet.createdAt, text: tweet.text, url: tweet.url })),
      callEvidence: callsOnly.map((tweet) => {
        const row = rows.find((post) => post.id === tweet.id)
        const revision = row?.current_revision ?? 1
        return { postId: tweet.id, revision, status: row?.deletion_state === 'deleted' ? 'deleted' as const : revision > 1 ? 'edited' as const : 'present' as const }
      }),
    })
  }
  return analyses
}

export function emptyHostClassificationResponse(request: HostClassificationRequest): HostClassificationResponse {
  return { schemaVersion: 1, requestId: request.requestId, reviewedCandidateCount: request.candidates.length, results: [] }
}

function validateHostResponse(request: HostClassificationRequest, response: HostClassificationResponse) {
  if (response.requestId !== request.requestId) throw new Error('Classification response requestId does not match the request.')
  if (response.reviewedCandidateCount !== request.candidates.length) throw new Error('Classification response reviewedCandidateCount does not match the request.')
  const candidates = new Map(request.candidates.map((candidate) => [candidate.id, candidate]))
  const resultIds = response.results.map((result) => result.id)
  if (new Set(resultIds).size !== resultIds.length) throw new Error('Classification response contains duplicate candidate IDs.')
  if (resultIds.some((id) => !candidates.has(id))) throw new Error('Classification response contains an unknown candidate ID.')
  for (const result of response.results) {
    const candidate = candidates.get(result.id)
    if (!candidate) throw new Error(`Unknown classification candidate: ${result.id}`)
    if (result.stances.some((stance) => !candidate.assets.includes(stance.asset))) {
      throw new Error(`Classification response used an asset not present in candidate ${result.id}.`)
    }
  }
}

function storedPostRows(store: AgentStore, handles: string[], from: string, to: string) {
  return store.getPosts(handles, from, to) as Array<{
    id: string
    account_handle: string
    text: string
    created_at: string
    url: string
    excluded_reason: string | null
    current_revision: number
    deletion_state: string
  }>
}
