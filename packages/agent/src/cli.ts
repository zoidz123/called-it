#!/usr/bin/env bun
import { randomUUID } from 'node:crypto'
import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  analyzeStoredPostsWithHost,
  buildHostClassificationRequest,
  emptyHostClassificationResponse,
  hostClassificationRequestSchema,
  hostClassificationResponseSchema,
  type HostClassificationRequest,
  type HostClassificationResponse,
} from './analysis'
import { ensurePrivateDirectory, loadBrowserConfig, rejectCredentialMaterial, resolveAgentPaths, saveBrowserConfig } from './config'
import { runDoctor } from './doctor'
import { assembleReport, refreshEvidenceStatuses, renderMarkdown, type CalledItReport } from './report'
import { AgentStore } from './store'
import { ingestHandles } from './x/bird-ingest'
import { reconcileRecentEvidence } from './x/bird-reconcile'
import { BundledBirdRunner } from './x/bird-runner'
import agentPackage from '../package.json' with { type: 'json' }

const [command, ...args] = process.argv.slice(2)
const launcher = process.env.CALLED_IT_LAUNCHER || 'called-it'
rejectCredentialMaterial(process.argv.slice(2))

try {
  if (command === '--version' || command === '-v' || command === 'version') console.log(agentPackage.version)
  else if (command === 'setup') await setup(args)
  else if (command === 'doctor') await doctor(args)
  else if (command === 'analyze' || command === 'resume') await analyze(args)
  else if (command === 'report') await reportFromHost(args)
  else if (command === 'inspect') await inspect(args)
  else usage(command ? `Unknown command: ${command}` : undefined)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

async function setup(args: string[]) {
  const source = value(args, '--cookie-source')
  const profile = value(args, '--profile')
  const profileDir = optionalValue(args, '--profile-dir')
  if (!['safari', 'chrome', 'firefox'].includes(source)) usage('cookie source must be safari, chrome, or firefox')
  saveBrowserConfig({ cookieSource: source as 'safari' | 'chrome' | 'firefox', profile, profileDir })
  console.log(JSON.stringify({ configured: true, cookieSource: source, profile, credentialsStored: false }))
}

async function doctor(args: string[]) {
  const paths = resolveAgentPaths()
  const config = loadBrowserConfig(paths)
  const runner = config ? runnerFrom(config, args) : undefined
  const store = new AgentStore(paths.databaseFile)
  const resumablePartials = Number((store.db.query(`SELECT COUNT(*) AS count FROM scan_cursors WHERE status != 'ready'`).get() as { count: number }).count)
  store.close()
  const result = await runDoctor({ runner, paths, config: config ?? undefined, resumablePartials })
  console.log(has(args, '--json') ? JSON.stringify(result, null, 2) : doctorText(result))
  if (result.authentication.status !== 'ready' || result.bundle.integrity !== 'verified') process.exitCode = 2
}

async function analyze(args: string[]) {
  const handles = args.filter((arg) => arg.startsWith('@')).map((handle) => handle.slice(1).toLowerCase())
  if (!handles.length) usage('analyze requires one or more @handles')
  const since = value(args, '--since')
  if (Number.isNaN(Date.parse(since))) usage('analyze requires --since with an ISO date')
  const paths = resolveAgentPaths()
  const config = loadBrowserConfig(paths)
  if (!config) throw new Error('Run called-it setup with an explicit local browser profile first.')
  const runner = runnerFrom(config, args)
  console.error(JSON.stringify({ stage: 'bird_auth' }))
  const doctorResult = await runDoctor({ runner, paths, config })
  if (doctorResult.authentication.status !== 'ready') throw new Error('The selected browser profile could not authenticate to X. Log into x.com in that profile and rerun doctor.')
  const refreshed = loadBrowserConfig(paths)
  if (!refreshed?.principalHash) throw new Error('Doctor did not produce a local principal hash.')
  if (refreshed.confirmedPrincipalHash !== refreshed.principalHash) {
    if (!has(args, '--confirm-browser-access')) {
      throw new Error('First live scan confirmation required. Rerun with --confirm-browser-access after reviewing the local browser-session disclosure.')
    }
    saveBrowserConfig({ ...refreshed, confirmedPrincipalHash: refreshed.principalHash }, paths)
  }
  const store = new AgentStore(paths.databaseFile)
  const requestedFrom = new Date(since).toISOString()
  const requestedTo = new Date().toISOString()
  const requestedDelay = numberValue(args, '--page-delay-ms')
  if (requestedDelay !== undefined && requestedDelay < 1000) throw new Error('--page-delay-ms cannot be below 1000.')
  const scan = await ingestHandles(handles, {
    runner,
    store,
    principalHash: refreshed.principalHash,
    requestedFrom,
    requestedTo,
    minDelayMs: requestedDelay ?? 2000,
    maxPagesPerHandle: Math.min(100, numberValue(args, '--max-pages') ?? 100),
    globalPageBudget: numberValue(args, '--global-page-budget') ?? 500,
    onProgress(stage, handle) { console.error(JSON.stringify({ stage, handle: `@${handle}` })) },
  })
  await reconcileRecentEvidence({ runner, store, handles, since: new Date(Date.now() - 7 * 86_400_000).toISOString(), limit: 10 })
  const request = buildHostClassificationRequest({ requestId: randomUUID(), store, handles, requestedFrom, requestedTo, coverage: scan.coverage, scanResults: scan.results })
  ensurePrivateDirectory(paths.reportsDir)
  const requestPath = join(paths.reportsDir, `${request.requestId}.classification-request.json`)
  writePrivate(requestPath, `${JSON.stringify(request, null, 2)}\n`)
  if (request.candidates.length) {
    const responsePath = join(paths.reportsDir, `${request.requestId}.classification-response.json`)
    store.close()
    console.log(JSON.stringify({
      status: 'needs_host_classification',
      requestId: request.requestId,
      classificationRequestPath: requestPath,
      classificationResponsePath: responsePath,
      candidateCount: request.candidates.length,
      partial: scan.results.some((result) => result.status !== 'complete'),
      next: { command: launcher, args: ['report', '--request', requestPath, '--classifications', responsePath] },
    }, null, 2))
    return
  }
  await writeReport(store, request, emptyHostClassificationResponse(request))
}

async function reportFromHost(args: string[]) {
  const requestPath = value(args, '--request')
  const classificationsPath = value(args, '--classifications')
  const request = hostClassificationRequestSchema.parse(JSON.parse(readFileSync(requestPath, 'utf8')))
  const response = hostClassificationResponseSchema.parse(JSON.parse(readFileSync(classificationsPath, 'utf8')))
  await writeReport(new AgentStore(), request, response)
}

async function writeReport(store: AgentStore, request: HostClassificationRequest, response: HostClassificationResponse) {
  const paths = resolveAgentPaths()
  const accounts = await analyzeStoredPostsWithHost(store, request, response, (stage, handle) => console.error(JSON.stringify({ stage, handle: `@${handle}` })))
  console.error(JSON.stringify({ stage: 'reporting' }))
  const report = assembleReport({
    id: randomUUID(),
    generatedAt: new Date().toISOString(),
    requestedFrom: request.requestedFrom,
    requestedTo: request.requestedTo,
    coverage: request.coverage,
    accounts,
    scanResults: request.scanResults,
  })
  const json = `${JSON.stringify(report, null, 2)}\n`
  const markdown = renderMarkdown(report)
  ensurePrivateDirectory(paths.reportsDir)
  const jsonPath = join(paths.reportsDir, `${report.id}.json`)
  const markdownPath = join(paths.reportsDir, `${report.id}.md`)
  writePrivate(jsonPath, json)
  writePrivate(markdownPath, markdown)
  store.saveReport(report.id, request.requestedFrom, request.requestedTo, json, markdown, report.generatedAt)
  store.close()
  console.log(JSON.stringify({
    reportId: report.id,
    jsonPath,
    markdownPath,
    partial: report.partialHandles.length > 0,
    resume: report.partialHandles.length ? {
      command: launcher,
      args: ['resume', ...request.handles.map((handle) => `@${handle}`), '--since', request.requestedFrom],
    } : null,
  }, null, 2))
  if (report.partialHandles.length) process.exitCode = 2
}

async function inspect(args: string[]) {
  const store = new AgentStore()
  const saved = store.getReport(optionalValue(args, '--report'))
  if (!saved) {
    store.close()
    throw new Error('No saved report found.')
  }
  const parsed = JSON.parse(saved.json) as CalledItReport
  const postIds = parsed.accounts.flatMap((account) => account.callEvidence.map((evidence) => evidence.postId))
  const report = refreshEvidenceStatuses(parsed, store.getPostStates(postIds))
  store.close()
  console.log(has(args, '--json') ? JSON.stringify(report, null, 2) : renderMarkdown(report).trimEnd())
}

function runnerFrom(config: NonNullable<ReturnType<typeof loadBrowserConfig>>, args: string[]) {
  return new BundledBirdRunner({ browser: config, birdPath: process.env.CALLED_IT_BIRD_PATH, allowUnpinnedBird: has(args, '--allow-unpinned-bird') })
}

function doctorText(result: Awaited<ReturnType<typeof runDoctor>>) {
  return [
    `Bird bundle: ${result.bundle.version} (${result.bundle.integrity})`,
    `Runtime: Bun ${result.runtime.bun} (${result.runtime.supported ? 'supported' : 'unsupported'})`,
    `Browser: ${result.browser.configured ? `${result.browser.source}/${result.browser.profile}` : 'not configured'}`,
    `Authentication: ${result.authentication.status}`,
    `Cookie permission: ${result.cookiePermission}`,
    `Resumable partial scans: ${result.resumablePartials}`,
  ].join('\n')
}

function writePrivate(path: string, content: string) {
  writeFileSync(path, content, { mode: 0o600 })
  chmodSync(path, 0o600)
}

function has(args: string[], flag: string) {
  return args.includes(flag)
}

function value(args: string[], flag: string) {
  const result = optionalValue(args, flag)
  if (!result) usage(`${flag} requires a value`)
  return result
}

function optionalValue(args: string[], flag: string) {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}

function numberValue(args: string[], flag: string) {
  const raw = optionalValue(args, flag)
  if (raw === undefined) return undefined
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) usage(`${flag} requires a non-negative number`)
  return parsed
}

function usage(error?: string): never {
  if (error) console.error(error)
  console.error('Usage: called-it setup|doctor|analyze|resume|report|inspect|--version [options]')
  process.exit(1)
}
