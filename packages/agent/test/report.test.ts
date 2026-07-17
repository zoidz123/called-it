import { expect, test } from 'bun:test'
import { assembleReport, refreshEvidenceStatuses, renderMarkdown, type AccountAnalysis } from '../src/report'

test('omits incomplete handles from ranking and renders coverage caveats', () => {
  const accounts: AccountAnalysis[] = [account('complete', 0.75, 4), account('partial', 1, 1)]
  const report = assembleReport({
    id: 'report-fixture',
    generatedAt: '2026-07-17T00:00:00.000Z',
    requestedFrom: '2026-01-01T00:00:00.000Z',
    requestedTo: '2026-07-17T00:00:00.000Z',
    accounts,
    coverage: [
      coverage('complete', 'best_effort', 'lookback_reached'),
      coverage('partial', 'partial', 'rate_limited'),
    ],
    scanResults: [
      { handle: 'complete', status: 'complete', stopReason: 'lookback_reached', committedPages: 2, committedPosts: 20, retries: 0 },
      { handle: 'partial', status: 'rate_paused', stopReason: 'rate_limited', committedPages: 1, committedPosts: 10, retries: 1 },
    ],
  })
  expect(report.ranking.map((row) => row.handle)).toEqual(['complete'])
  expect(report.partialHandles).toEqual([{ handle: 'partial', state: 'rate_paused', reason: 'rate_limited', retries: 1 }])
  const markdown = renderMarkdown(report)
  expect(markdown).toContain('Reliability')
  expect(markdown).toContain('Sample')
  expect(markdown).toContain('Requested window')
  expect(markdown).toContain('Partial and unavailable handles')
  expect(markdown).toContain('not financial advice')
  expect(markdown).not.toContain('fixture-auth-secret')
  expect(JSON.stringify(report)).not.toContain('fixture-ct0-secret')
})

test('marks historical report evidence superseded or deleted without changing its revision', () => {
  const report = assembleReport({
    id: 'historical',
    generatedAt: '2026-07-17T00:00:00.000Z',
    requestedFrom: '2026-01-01T00:00:00.000Z',
    requestedTo: '2026-07-17T00:00:00.000Z',
    accounts: [{ ...account('alpha', 1, 1), callEvidence: [{ postId: 'one', revision: 1, status: 'present' }, { postId: 'two', revision: 2, status: 'edited' }] }],
    coverage: [coverage('alpha', 'best_effort', 'lookback_reached')],
    scanResults: [{ handle: 'alpha', status: 'complete', stopReason: 'lookback_reached', committedPages: 2, committedPosts: 20, retries: 0 }],
  })
  const refreshed = refreshEvidenceStatuses(report, new Map([
    ['one', { revision: 2, deletionState: 'present' }],
    ['two', { revision: 2, deletionState: 'deleted' }],
  ]))
  expect(refreshed.accounts[0].callEvidence).toEqual([
    { postId: 'one', revision: 1, status: 'superseded' },
    { postId: 'two', revision: 2, status: 'deleted' },
  ])
})

function account(handle: string, hitRate: number, callsTotal: number): AccountAnalysis {
  return {
    handle,
    stats: { handle, hitRate, callsTotal, callsUp: Math.round(hitRate * callsTotal), avgReturn: 0.2, medianReturn: 0.1 },
    calls: [],
    notableComments: [],
    callEvidence: [],
  }
}

function coverage(handle: string, completeness: 'best_effort' | 'partial', stopReason: string) {
  return {
    run_id: 'run',
    account_handle: handle,
    requested_from: '2026-01-01T00:00:00.000Z',
    requested_to: '2026-07-17T00:00:00.000Z',
    observed_from: '2026-01-01T00:00:00.000Z',
    observed_to: '2026-07-16T00:00:00.000Z',
    completeness,
    stop_reason: stopReason,
    page_count: 2,
    post_count: 20,
  }
}
