import type { AgentStore } from '../store'
import { BirdError } from './bird-errors'
import { parseTargetedRead } from './bird-parser'
import type { BirdRunner } from './bird-runner'

export async function reconcileRecentEvidence(input: {
  runner: BirdRunner
  store: AgentStore
  handles: string[]
  since: string
  limit?: number
  now?: () => Date
}) {
  const ids = input.store.getRecentPostIds(input.handles, input.since, input.limit ?? 10)
  const result = { checked: 0, changed: 0, tombstoned: 0, skippedErrors: 0 }
  for (const id of ids) {
    try {
      const response = await input.runner.run({ type: 'read', id })
      const post = parseTargetedRead(response.stdout, id)
      if (post && input.store.reconcilePost(post, nowIso(input)).changed) result.changed++
      result.checked++
    } catch (error) {
      if (error instanceof BirdError && error.kind === 'not_found') {
        if (input.store.confirmNotFound(id, nowIso(input))) result.tombstoned++
        result.checked++
      } else {
        result.skippedErrors++
      }
    }
  }
  return result
}

function nowIso(input: { now?: () => Date }) {
  return (input.now?.() ?? new Date()).toISOString()
}
