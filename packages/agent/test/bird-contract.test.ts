import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rejectCredentialMaterial } from '../src/config'
import { classifyBirdError, redactBirdDetail } from '../src/x/bird-errors'
import { parseTargetedRead, parseTimelinePage, parseWhoami } from '../src/x/bird-parser'
import { buildBirdArgv, BundledBirdRunner, sanitizeBirdEnvironment, validateCommand } from '../src/x/bird-runner'

const fixtures = join(import.meta.dir, 'fixtures/bird')
const chrome = { cookieSource: 'chrome' as const, profile: 'Profile 2', profileDir: '/synthetic/chrome' }

describe('Bird command boundary', () => {
  test('builds exact one-page profile timeline argv', () => {
    expect(buildBirdArgv(chrome, { type: 'user-tweets', handle: '@fixture_alpha', cursor: 'opaque-synthetic' })).toEqual([
      '--cookie-source', 'chrome', '--chrome-profile', 'Profile 2', '--chrome-profile-dir', '/synthetic/chrome',
      '--plain', '--no-color', '--timeout', '30000', 'user-tweets', '@fixture_alpha', '-n', '20', '--max-pages', '1', '--json', '--cursor', 'opaque-synthetic',
    ])
  })

  test('allows only typed whoami, user-tweets, and targeted numeric reads', () => {
    expect(() => validateCommand({ type: 'read', id: '1000000000000000001' })).not.toThrow()
    expect(() => validateCommand({ type: 'read', id: 'https://x.com/a/status/1' })).toThrow('numeric post ID')
    expect(() => validateCommand({ type: 'home' } as never)).toThrow('not allowlisted')
    expect(buildBirdArgv({ cookieSource: 'firefox', profile: 'default-release' }, { type: 'whoami' })).toEqual([
      '--cookie-source', 'firefox', '--firefox-profile', 'default-release', '--plain', '--no-color', '--timeout', '30000', 'whoami',
    ])
  })

  test('strips cookie credentials from the child environment', () => {
    const sanitized = sanitizeBirdEnvironment({ NODE_ENV: 'test', AUTH_TOKEN: 'secret-a', TWITTER_AUTH_TOKEN: 'secret-b', CT0: 'secret-c', TWITTER_CT0: 'secret-d', KEEP: 'yes' })
    expect(sanitized).toEqual({ NODE_ENV: 'test', KEEP: 'yes', NO_COLOR: '1', BIRD_VERSION: '0.8.0' })
  })

  test('spawns through argv from a controlled directory with a sanitized environment', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'called-it-runner-'))
    let captured: { args: string[]; options: Record<string, unknown> } | undefined
    const runner = new BundledBirdRunner({
      browser: chrome,
      configDir: directory,
      env: { NODE_ENV: 'test', AUTH_TOKEN: 'secret-a', CT0: 'secret-b', KEEP: 'yes' },
      execute: (async (_file: string, args: string[], options: Record<string, unknown>) => {
        captured = { args, options }
        return { stdout: '{"tweets":[]}', stderr: '' }
      }) as never,
    })
    await runner.run({ type: 'user-tweets', handle: 'fixture_alpha' })
    expect(captured?.args).toContain('user-tweets')
    expect(captured?.options.cwd).toBe(directory)
    expect(captured?.options).toMatchObject({ timeout: 45_000, maxBuffer: 8 * 1024 * 1024 })
    expect(captured?.options.env).toEqual({ NODE_ENV: 'test', KEEP: 'yes', NO_COLOR: '1', BIRD_VERSION: '0.8.0' })
    rmSync(directory, { recursive: true, force: true })
  })

  test('rejects cookie credential configuration and argv', () => {
    expect(() => rejectCredentialMaterial({ auth_token: 'secret' })).toThrow('not accepted')
    expect(() => rejectCredentialMaterial(['--ct0', 'secret'])).toThrow('not accepted')
    expect(redactBirdDetail('auth_token=supersecretvalue')).not.toContain('supersecretvalue')
  })
})

describe('Bird schemas and errors', () => {
  test('parses array and pagination envelope variants', () => {
    const arrayPage = parseTimelinePage(read('page-array.json'), 'fixture_alpha')
    expect(arrayPage.posts).toHaveLength(1)
    expect(arrayPage.posts[0].createdAt).toBe('2026-07-16T12:00:00.000Z')
    expect(arrayPage.nextCursor).toBeUndefined()
    const envelope = parseTimelinePage(read('page-envelope.json'), 'fixture_alpha')
    expect(envelope.nextCursor).toBe('synthetic-cursor-page-2')
    expect(envelope.posts.map((post) => post.excludedReason)).toEqual([null, 'reply', 'retweet'])
    expect(envelope.posts[0].isQuote).toBe(true)
  })

  test('rejects malformed fields and validates targeted reads', () => {
    expect(() => parseTimelinePage(read('malformed.json'), 'fixture_alpha')).toThrow()
    const readPost = parseTargetedRead(read('target-read-changed.json'), '1000000000000000001')
    expect(readPost?.text).toContain('withdrawn')
    expect(parseWhoami('Logged in as @Fixture_Alpha')).toEqual({ username: 'fixture_alpha' })
  })

  test('classifies fixture errors without mistaking Safari warnings for auth', () => {
    const errors = JSON.parse(read('error-cases.json'))
    expect(classifyBirdError(errors.rateLimit).kind).toBe('rate_limit')
    expect(classifyBirdError(errors.server).kind).toBe('server')
    expect(classifyBirdError(errors.safariWarning).kind).toBe('server')
    expect(classifyBirdError(errors.missingCookies).kind).toBe('auth')
    expect(classifyBirdError(errors.protected).kind).toBe('unavailable_account')
    expect(classifyBirdError(errors.suspended).kind).toBe('unavailable_account')
    expect(classifyBirdError(errors.cursorRejected).kind).toBe('cursor_rejected')
    expect(classifyBirdError(errors.queryId).kind).toBe('tool_incompatible')
    expect(classifyBirdError(errors.timeout).kind).toBe('timeout')
    expect(classifyBirdError('Tweet not found or deleted').kind).toBe('not_found')
  })
})

function read(name: string) {
  return readFileSync(join(fixtures, name), 'utf8')
}
