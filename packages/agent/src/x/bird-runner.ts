import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import type { BrowserConfig } from '../config'
import { ensurePrivateDirectory, resolveAgentPaths } from '../config'
import { BirdError, classifyBirdError } from './bird-errors'

const execFileAsync = promisify(execFile)
const BIRD_VERSION = '0.8.0'
const MAX_BUFFER = 8 * 1024 * 1024
const CHILD_TIMEOUT_MS = 45_000
const FORBIDDEN_FLAGS = new Set(['--auth-token', '--ct0', '--json-full'])

export type BirdCommand =
  | { type: 'whoami' }
  | { type: 'user-tweets'; handle: string; cursor?: string }
  | { type: 'read'; id: string }

export type BirdRunResult = { stdout: string; stderr: string }

export interface BirdRunner {
  run(command: BirdCommand, signal?: AbortSignal): Promise<BirdRunResult>
}

export type BirdRunnerOptions = {
  browser: BrowserConfig
  configDir?: string
  birdPath?: string
  allowUnpinnedBird?: boolean
  env?: NodeJS.ProcessEnv
  execute?: typeof execFileAsync
}

export class BundledBirdRunner implements BirdRunner {
  private readonly configDir: string
  private readonly execute: typeof execFileAsync

  constructor(private readonly options: BirdRunnerOptions) {
    this.configDir = resolve(options.configDir ?? resolveAgentPaths(options.env).configDir)
    ensurePrivateDirectory(this.configDir)
    this.execute = options.execute ?? execFileAsync
    if (options.birdPath && !options.allowUnpinnedBird) {
      throw new Error('CALLED_IT_BIRD_PATH is unsupported unless --allow-unpinned-bird is explicit.')
    }
  }

  async run(command: BirdCommand, signal?: AbortSignal): Promise<BirdRunResult> {
    validateCommand(command)
    const executable = resolveBirdExecutable(this.options)
    const args = buildBirdArgv(this.options.browser, command)
    if (args.some((arg) => FORBIDDEN_FLAGS.has(arg.split('=')[0]))) throw new Error('Rejected forbidden Bird credential or raw-output flag.')
    try {
      const result = await this.execute(executable.file, [...executable.prefix, ...args], {
        cwd: this.configDir,
        env: sanitizeBirdEnvironment(this.options.env ?? process.env),
        timeout: CHILD_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        signal,
      })
      return { stdout: String(result.stdout), stderr: String(result.stderr) }
    } catch (error) {
      if (error instanceof BirdError) throw error
      const detail = error as { stderr?: string; stdout?: string; killed?: boolean; signal?: string; code?: string | number }
      throw classifyBirdError(String(detail.stderr ?? ''), String(detail.stdout ?? ''), Boolean(detail.killed || detail.signal === 'SIGTERM'))
    }
  }
}

export function buildBirdArgv(browser: BrowserConfig, command: BirdCommand): string[] {
  const browserArgs = ['--cookie-source', browser.cookieSource]
  if (browser.cookieSource === 'chrome') {
    browserArgs.push('--chrome-profile', browser.profile)
    if (browser.profileDir) browserArgs.push('--chrome-profile-dir', browser.profileDir)
  } else if (browser.cookieSource === 'firefox') {
    browserArgs.push('--firefox-profile', browser.profile)
  }
  const stable = ['--plain', '--no-color', '--timeout', '30000']
  if (command.type === 'whoami') return [...browserArgs, ...stable, 'whoami']
  if (command.type === 'read') return [...browserArgs, ...stable, 'read', command.id, '--json']
  const args = [...browserArgs, ...stable, 'user-tweets', `@${normalizeHandle(command.handle)}`, '-n', '20', '--max-pages', '1', '--json']
  if (command.cursor) args.push('--cursor', command.cursor)
  return args
}

export function sanitizeBirdEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const sanitized: NodeJS.ProcessEnv = { ...env, NO_COLOR: '1', BIRD_VERSION }
  for (const key of ['AUTH_TOKEN', 'TWITTER_AUTH_TOKEN', 'CT0', 'TWITTER_CT0']) delete sanitized[key]
  return sanitized
}

export function validateCommand(command: BirdCommand) {
  if (!['whoami', 'user-tweets', 'read'].includes(command.type)) throw new Error('Bird command is not allowlisted.')
  if (command.type === 'user-tweets') normalizeHandle(command.handle)
  if (command.type === 'read' && !/^\d{5,30}$/.test(command.id)) throw new Error('Targeted Bird reads require a numeric post ID.')
  if (command.type === 'user-tweets' && command.cursor && /[\r\n\0]/.test(command.cursor)) throw new Error('Invalid opaque cursor.')
}

export function verifyBirdBundle(packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')) {
  const manifestPath = join(packageRoot, 'dist', 'bird-manifest.json')
  const bundlePath = join(packageRoot, 'dist', 'bird.mjs')
  if (!existsSync(manifestPath) || !existsSync(bundlePath)) return { ok: false, version: BIRD_VERSION, detail: 'bundle_missing' as const }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version?: string; sha256?: string }
  const actual = new Bun.CryptoHasher('sha256').update(readFileSync(bundlePath)).digest('hex')
  return {
    ok: manifest.version === BIRD_VERSION && manifest.sha256 === actual,
    version: String(manifest.version ?? 'unknown'),
    detail: manifest.version === BIRD_VERSION && manifest.sha256 === actual ? 'verified' as const : 'integrity_mismatch' as const,
  }
}

function resolveBirdExecutable(options: BirdRunnerOptions): { file: string; prefix: string[] } {
  if (options.birdPath) return { file: resolve(options.birdPath), prefix: [] }
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const bundled = join(packageRoot, 'dist', 'bird.mjs')
  if (!existsSync(bundled)) throw new Error('Bundled Bird is missing. Run bun run --cwd packages/agent bundle:bird.')
  return { file: process.execPath, prefix: [bundled] }
}

function normalizeHandle(handle: string) {
  const value = handle.replace(/^@/, '').trim()
  if (!/^[A-Za-z0-9_]{1,15}$/.test(value)) throw new Error(`Invalid X handle: ${handle}`)
  return value
}
