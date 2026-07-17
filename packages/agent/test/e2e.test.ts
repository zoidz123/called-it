import { afterEach, describe, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { Database } from 'bun:sqlite'

const roots: string[] = []
const cli = resolve(import.meta.dir, '../src/cli.ts')

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('temporary-XDG end to end', () => {
  test('sets up, runs a secret-safe doctor, survives kill after a committed page, and resumes', async () => {
    const fixture = makeFixture()
    expect(run(fixture, ['setup', '--cookie-source', 'chrome', '--profile', 'Fixture Profile']).exitCode).toBe(0)
    const doctor = run(fixture, ['doctor', '--json', '--allow-unpinned-bird'])
    expect(doctor.exitCode).toBe(0)
    expect(doctor.stdout).toContain('"integrity": "verified"')
    expect(doctor.stdout).toContain('"status": "ready"')
    expect(doctor.stdout).not.toContain('fixture-auth-secret')
    expect(doctor.stdout).not.toContain('fixture-ct0-secret')

    const interrupted = Bun.spawn(['bun', cli, 'analyze', '@fixture_alpha', '--since', '2026-01-01', '--confirm-browser-access', '--allow-unpinned-bird', '--page-delay-ms', '1000'], {
      cwd: resolve(import.meta.dir, '../../..'),
      env: { ...fixture.env, FAKE_BIRD_SLOW: '1' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const database = join(fixture.data, 'called-it/called-it.sqlite')
    await waitForCommittedPage(database)
    interrupted.kill()
    await interrupted.exited

    const resume = run(fixture, ['resume', '@fixture_alpha', '--since', '2026-01-01', '--allow-unpinned-bird', '--page-delay-ms', '1000'])
    expect(resume.exitCode).toBe(0)
    const result = JSON.parse(resume.stdout)
    expect(result.partial).toBe(false)
    expect(readFileSync(result.markdownPath, 'utf8')).toContain('Requested window')

    const db = new Database(database, { readonly: true })
    const committed = (db.query(`SELECT COUNT(*) AS count FROM scan_pages WHERE status = 'committed'`).get() as { count: number }).count
    db.close()
    expect(committed).toBeGreaterThanOrEqual(2)
    expect(statSync(join(fixture.config, 'called-it/config.json')).mode & 0o777).toBe(0o600)
    expect(statSync(database).mode & 0o777).toBe(0o600)
    assertNoSecrets([join(fixture.config, 'called-it'), join(fixture.data, 'called-it')])
  }, 20_000)

  test('returns exit code 2 with a useful report on an induced 429', () => {
    const fixture = makeFixture()
    run(fixture, ['setup', '--cookie-source', 'firefox', '--profile', 'fixture-release'])
    const result = run(fixture, ['analyze', '@fixture_alpha', '--since', '2026-01-01', '--confirm-browser-access', '--allow-unpinned-bird'], { FAKE_BIRD_RATE: '1' })
    expect(result.exitCode).toBe(2)
    expect(result.stdout).toContain('"partial": true')
    expect(result.stderr).toContain('bird_rate_paused')
    assertNoSecrets([join(fixture.config, 'called-it'), join(fixture.data, 'called-it')])
  })
})

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'called-it-e2e-'))
  roots.push(root)
  const config = join(root, 'config')
  const data = join(root, 'data')
  const bird = join(root, 'fake-bird.js')
  writeFileSync(bird, `#!/usr/bin/env node
const args = process.argv.slice(2)
if (args.includes('whoami')) { console.log('Logged in as @fixture_alpha'); process.exit(0) }
if (args.includes('user-tweets')) {
  if (process.env.FAKE_BIRD_RATE === '1') { console.error('HTTP 429 Too Many Requests'); process.exit(1) }
  const cursorAt = args.indexOf('--cursor')
  if (cursorAt < 0) {
    console.log(JSON.stringify({tweets:[{id:'10001',text:'synthetic post without a cashtag',createdAt:'2026-07-15T12:00:00.000Z',username:'fixture_alpha'}],nextCursor:'fixture-cursor-2'}))
    process.exit(0)
  }
  const finish = () => console.log(JSON.stringify({tweets:[{id:'10002',text:'another synthetic post',createdAt:'2025-12-20T12:00:00.000Z',username:'fixture_alpha'}]}))
  if (process.env.FAKE_BIRD_SLOW === '1') setTimeout(finish, 30000); else finish()
  return
}
console.error('command not allowed'); process.exit(1)
`, { mode: 0o700 })
  chmodSync(bird, 0o700)
  return {
    root,
    config,
    data,
    env: {
      ...process.env,
      XDG_CONFIG_HOME: config,
      XDG_DATA_HOME: data,
      CALLED_IT_BIRD_PATH: bird,
      AUTH_TOKEN: 'fixture-auth-secret',
      CT0: 'fixture-ct0-secret',
    },
  }
}

function run(fixture: ReturnType<typeof makeFixture>, args: string[], extraEnv: Record<string, string> = {}) {
  const result = Bun.spawnSync(['bun', cli, ...args], {
    cwd: resolve(import.meta.dir, '../../..'),
    env: { ...fixture.env, ...extraEnv },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() }
}

async function waitForCommittedPage(path: string) {
  const deadline = Date.now() + 8_000
  while (Date.now() < deadline) {
    try {
      const db = new Database(path, { readonly: true })
      const count = (db.query(`SELECT COUNT(*) AS count FROM scan_pages WHERE status = 'committed'`).get() as { count: number }).count
      db.close()
      if (count >= 1) return
    } catch {
      // The database may not exist until setup and doctor complete in the child.
    }
    await Bun.sleep(50)
  }
  throw new Error('Timed out waiting for a committed Bird page')
}

function assertNoSecrets(directories: string[]) {
  for (const directory of directories) {
    for (const file of walk(directory)) {
      const bytes = readFileSync(file)
      expect(bytes.includes(Buffer.from('fixture-auth-secret')), file).toBe(false)
      expect(bytes.includes(Buffer.from('fixture-ct0-secret')), file).toBe(false)
    }
  }
}

function walk(directory: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walk(path))
    else files.push(path)
  }
  return files
}
