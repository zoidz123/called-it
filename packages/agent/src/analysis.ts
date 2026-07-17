import { candidatesFromTweets, classifyCandidates, filterIgnoredCashtags, scoreCalls } from '@called-it/core'
import type { AgentStore } from './store'
import type { AccountAnalysis } from './report'

export async function analyzeStoredPosts(store: AgentStore, handles: string[], from: string, to: string, onProgress?: (stage: 'classifying' | 'pricing', handle: string) => void): Promise<AccountAnalysis[]> {
  const rows = store.getPosts(handles, from, to) as Array<{
    id: string
    account_handle: string
    text: string
    created_at: string
    url: string
    excluded_reason: string | null
    current_revision: number
    deletion_state: string
  }>
  const analyses: AccountAnalysis[] = []
  for (const handle of handles) {
    const posts = rows.filter((row) => row.account_handle === handle && !row.excluded_reason)
    const tweets = posts.map((post) => ({ id: post.id, text: post.text, createdAt: post.created_at, url: post.url }))
    onProgress?.('classifying', handle)
    const candidates = candidatesFromTweets(tweets)
    const classified = filterIgnoredCashtags(handle, await classifyCandidates(candidates))
    onProgress?.('pricing', handle)
    const { calls, stats } = await scoreCalls(handle, classified)
    store.saveAnalysis(classified, calls, new Date().toISOString())
    analyses.push({
      handle,
      stats,
      calls,
      notableComments: classified.slice(0, 5).map((tweet) => ({ postId: tweet.id, createdAt: tweet.createdAt, text: tweet.text, url: tweet.url })),
      callEvidence: classified.map((tweet) => {
        const row = posts.find((post) => post.id === tweet.id)
        const revision = row?.current_revision ?? 1
        return { postId: tweet.id, revision, status: row?.deletion_state === 'deleted' ? 'deleted' as const : revision > 1 ? 'edited' as const : 'present' as const }
      }),
    })
  }
  return analyses
}
