import type { ScoredCall, UserStats } from '@called-it/core'
import type { CoverageRecord } from './store'

export type AccountAnalysis = {
  handle: string
  stats: UserStats
  calls: ScoredCall[]
  notableComments: Array<{ postId: string; createdAt: string; text: string; url: string }>
  callEvidence: Array<{ postId: string; revision: number; status: 'present' | 'edited' | 'deleted' | 'superseded' }>
}

export type CalledItReport = {
  schemaVersion: 1
  id: string
  generatedAt: string
  disclaimer: string
  requestedWindow: { from: string; to: string }
  observedWindow: { from: string | null; to: string | null }
  coverage: CoverageRecord[]
  scanResults: Array<{ handle: string; status: string; stopReason: string; committedPages: number; committedPosts: number; retries: number; retryNotBefore?: string }>
  ranking: Array<{ rank: number; handle: string; hitRate: number; sampleSize: number; avgReturn: number; medianReturn: number }>
  accounts: AccountAnalysis[]
  partialHandles: Array<{ handle: string; state: string; reason: string; retries: number; retryNotBefore?: string }>
  limitations: string[]
}

export function assembleReport(input: {
  id: string
  generatedAt: string
  requestedFrom: string
  requestedTo: string
  coverage: CoverageRecord[]
  accounts: AccountAnalysis[]
  scanResults: Array<{ handle: string; status: string; stopReason: string; committedPages: number; committedPosts: number; retries: number; retryNotBefore?: string }>
}): CalledItReport {
  const comparable = new Set(input.coverage.filter((item) => item.completeness === 'best_effort').map((item) => item.account_handle))
  const ranking = input.accounts
    .filter((account) => comparable.has(account.handle) && account.stats.callsTotal > 0)
    .sort((a, b) => b.stats.hitRate - a.stats.hitRate || b.stats.callsTotal - a.stats.callsTotal || b.stats.avgReturn - a.stats.avgReturn)
    .map((account, index) => ({
      rank: index + 1,
      handle: account.handle,
      hitRate: account.stats.hitRate,
      sampleSize: account.stats.callsTotal,
      avgReturn: account.stats.avgReturn,
      medianReturn: account.stats.medianReturn,
    }))
  const observed = input.coverage.flatMap((item) => [item.observed_from, item.observed_to]).filter(Boolean) as string[]
  return {
    schemaVersion: 1,
    id: input.id,
    generatedAt: input.generatedAt,
    disclaimer: 'Historical best-effort evidence only. This is not financial advice.',
    requestedWindow: { from: input.requestedFrom, to: input.requestedTo },
    observedWindow: { from: observed.sort()[0] ?? null, to: observed.sort().at(-1) ?? null },
    coverage: input.coverage,
    scanResults: input.scanResults.map((result) => ({ ...result })),
    ranking,
    accounts: input.accounts,
    partialHandles: input.scanResults
      .filter((result) => result.status !== 'complete')
      .map((result) => ({ handle: result.handle, state: result.status, reason: result.stopReason, retries: result.retries, ...(result.retryNotBefore ? { retryNotBefore: result.retryNotBefore } : {}) })),
    limitations: [
      'Bird 0.8.0 reads X private web GraphQL through the selected browser session and may break without notice.',
      'Coverage is best effort and is never authoritative or proof of a complete timeline.',
      'Replies are excluded by inReplyToStatusId; obvious RT @ posts are excluded by heuristic; quote posts are retained.',
      'Timeline absence is not deletion proof. Two structured not-found reads at least 24 hours apart are required.',
      'Incomplete handles are omitted from the ranking instead of treating missing calls as zero calls.',
    ],
  }
}

export function renderMarkdown(report: CalledItReport): string {
  const lines = [
    '# Called It local reliability report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Requested window: ${report.requestedWindow.from} to ${report.requestedWindow.to}`,
    '',
    `Observed window: ${report.observedWindow.from ?? 'none'} to ${report.observedWindow.to ?? 'none'}`,
    '',
    `> ${report.disclaimer}`,
    '',
    '## Ranked accounts',
    '',
  ]
  if (!report.ranking.length) lines.push('No accounts have comparable priced-call samples yet.', '')
  else {
    lines.push('| Rank | Account | Reliability | Sample | Average return | Median return |', '| ---: | --- | ---: | ---: | ---: | ---: |')
    for (const row of report.ranking) lines.push(`| ${row.rank} | @${row.handle} | ${pct(row.hitRate)} | ${row.sampleSize} | ${pct(row.avgReturn)} | ${pct(row.medianReturn)} |`)
    lines.push('')
  }
  lines.push('## Coverage', '', '| Account | State | Observed | Pages | Posts | Retries | Stop reason |', '| --- | --- | --- | ---: | ---: | ---: | --- |')
  for (const coverage of report.coverage) {
    const scan = report.scanResults.find((item) => item.handle === coverage.account_handle)
    lines.push(`| @${coverage.account_handle} | ${coverage.completeness} | ${coverage.observed_from ?? 'none'} to ${coverage.observed_to ?? 'none'} | ${coverage.page_count} | ${coverage.post_count} | ${scan?.retries ?? 0} | ${coverage.stop_reason} |`)
  }
  lines.push('')
  for (const account of report.accounts) {
    lines.push(`## @${account.handle}`, '', `Reliability: ${pct(account.stats.hitRate)} (${account.stats.callsUp}/${account.stats.callsTotal})`, '')
    lines.push('### Top calls', '')
    if (!account.calls.length) lines.push('No priced calls in observed evidence.', '')
    for (const call of account.calls.slice(0, 5)) {
      const evidence = account.callEvidence.find((item) => item.postId === call.firstTweetId)
      lines.push(`- ${call.direction} ${call.asset}: ${pct(call.returnPct)} from ${call.firstPitchAt} (${call.firstTweetId}${evidence ? `, revision ${evidence.revision}, ${evidence.status}` : ''})`)
    }
    lines.push('', '### Notable comments', '')
    if (!account.notableComments.length) lines.push('No classified call comments.', '')
    for (const comment of account.notableComments.slice(0, 5)) lines.push(`- ${comment.createdAt}: ${singleLine(comment.text)} (${comment.url})`)
    lines.push('')
  }
  if (report.partialHandles.length) {
    lines.push('## Partial and unavailable handles', '')
    for (const item of report.partialHandles) lines.push(`- @${item.handle}: ${item.state}, ${item.reason}, retries ${item.retries}${item.retryNotBefore ? `, retry no earlier than ${item.retryNotBefore}` : ''}. Resume the same scan after the condition clears.`)
    lines.push('')
  }
  lines.push('## Limitations', '')
  for (const limitation of report.limitations) lines.push(`- ${limitation}`)
  lines.push('')
  return `${lines.join('\n')}\n`
}

export function refreshEvidenceStatuses(report: CalledItReport, current: Map<string, { revision: number; deletionState: string }>): CalledItReport {
  return {
    ...report,
    accounts: report.accounts.map((account) => ({
      ...account,
      callEvidence: account.callEvidence.map((evidence) => {
        const state = current.get(evidence.postId)
        if (!state) return evidence
        const status = state.deletionState === 'deleted'
          ? 'deleted' as const
          : state.revision > evidence.revision
            ? 'superseded' as const
            : evidence.revision > 1
              ? 'edited' as const
              : 'present' as const
        return { ...evidence, status }
      }),
    })),
  }
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function singleLine(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 240)
}
