import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Readable, Writable } from 'node:stream'
import agentPackage from '../package.json' with { type: 'json' }
import { confirmPurge } from '../src/purge-confirmation.mjs'

const packageRoot = resolve(import.meta.dir, '..')
const bootstrap = join(packageRoot, 'dist', 'bootstrap.mjs')
const roots: string[] = []

beforeAll(() => {
  const built = Bun.spawnSync(['bun', 'run', 'build:distribution'], { cwd: packageRoot, stdout: 'pipe', stderr: 'pipe' })
  expect(built.exitCode, built.stderr.toString()).toBe(0)
})

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('consumer distribution', () => {
  test('fresh installs Codex and Claude, repeats idempotently, and supports paths with spaces', () => {
    const fixture = makeFixture('called it distribution ')
    for (const target of ['codex', 'claude']) {
      const first = run(fixture, ['install', '--target', target])
      expect(first.exitCode, first.stderr).toBe(0)
      const repeat = run(fixture, ['install', '--target', target])
      expect(repeat.exitCode, repeat.stderr).toBe(0)
      const skill = skillDir(fixture, target)
      expect(readFileSync(join(skill, 'SKILL.md'), 'utf8')).toContain('CALLED_IT_CLI')
      expect(readFileSync(join(skill, 'called-it-manifest.json'), 'utf8')).toContain(`"version": "${agentPackage.version}"`)
      expect(statSync(skill).mode & 0o777).toBe(0o700)
      expect(statSync(join(skill, 'SKILL.md')).mode & 0o777).toBe(0o644)
    }
    const launcher = join(fixture.data, 'called-it/runtime/bin/called-it')
    expect(statSync(launcher).mode & 0o777).toBe(0o755)
    expect(Bun.spawnSync([launcher, '--version'], { env: fixture.env, stdout: 'pipe', stderr: 'pipe' }).stdout.toString().trim()).toBe(agentPackage.version)
  })

  test('updates an older compatible fixture and refuses a downgrade unless explicit', () => {
    const fixture = makeFixture()
    expect(run(fixture, ['install', '--target', 'codex']).exitCode).toBe(0)
    setInstalledVersion(fixture, 'codex', '0.0.9')
    expect(run(fixture, ['update', '--target', 'codex']).exitCode).toBe(0)
    expect(installedVersion(fixture, 'codex')).toBe(agentPackage.version)

    setInstalledVersion(fixture, 'codex', '9.0.0')
    const refused = run(fixture, ['update', '--target', 'codex'])
    expect(refused.exitCode).toBe(1)
    expect(refused.stderr).toContain(`Refusing downgrade from 9.0.0 to ${agentPackage.version}`)
    expect(run(fixture, ['update', '--target', 'codex', '--allow-downgrade']).exitCode).toBe(0)
    expect(installedVersion(fixture, 'codex')).toBe(agentPackage.version)
  })

  test('refuses modified skills and can preserve an explicit backup', () => {
    const fixture = makeFixture()
    expect(run(fixture, ['install', '--target', 'codex']).exitCode).toBe(0)
    writeFileSync(join(skillDir(fixture, 'codex'), 'notes.txt'), 'user modification\n')
    const refused = run(fixture, ['update', '--target', 'codex'])
    expect(refused.exitCode).toBe(1)
    expect(refused.stderr).toContain('Refusing to overwrite modified')
    const preserved = run(fixture, ['update', '--target', 'codex', '--backup-modified'])
    expect(preserved.exitCode, preserved.stderr).toBe(0)
    const backupLine = preserved.stdout.split('\n').find((line) => line.startsWith('Preserved modified skill backup: '))
    expect(backupLine).toBeDefined()
    if (!backupLine) throw new Error('Expected backup path in installer output.')
    expect(readFileSync(join(backupLine.slice('Preserved modified skill backup: '.length), 'notes.txt'), 'utf8')).toBe('user modification\n')
  })

  test('normal uninstall preserves configuration and SQLite data', () => {
    const fixture = makeFixture()
    expect(run(fixture, ['install', '--target', 'codex']).exitCode).toBe(0)
    const configFile = join(fixture.config, 'called-it/config.json')
    const database = join(fixture.data, 'called-it/called-it.sqlite')
    mkdirSync(resolve(configFile, '..'), { recursive: true })
    writeFileSync(configFile, '{"profile":"Default"}\n', { mode: 0o600 })
    writeFileSync(database, 'sqlite fixture', { mode: 0o600 })
    const result = run(fixture, ['uninstall', '--target', 'codex'])
    expect(result.exitCode, result.stderr).toBe(0)
    expect(existsSync(skillDir(fixture, 'codex'))).toBe(false)
    expect(readFileSync(configFile, 'utf8')).toContain('Default')
    expect(readFileSync(database, 'utf8')).toBe('sqlite fixture')
  })

  test('purge refuses non-interactive execution before deleting anything', () => {
    const fixture = makeFixture()
    expect(run(fixture, ['install', '--target', 'codex']).exitCode).toBe(0)
    const result = run(fixture, ['uninstall', '--target', 'codex', '--purge'])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('requires an interactive terminal')
    expect(existsSync(skillDir(fixture, 'codex'))).toBe(true)
  })

  test('purge requires the exact interactive confirmation word', async () => {
    await expect(confirmPurge({ input: ttyInput('cancel\n'), output: ttyOutput() })).rejects.toThrow('Purge cancelled')
    await expect(confirmPurge({ input: ttyInput('PURGE\n'), output: ttyOutput() })).resolves.toBeUndefined()
  })

  test('reports missing Bun and rejects invalid targets', () => {
    const fixture = makeFixture()
    const missing = run(fixture, ['install', '--target', 'codex'], { PATH: fixture.emptyPath })
    expect(missing.exitCode).toBe(1)
    expect(missing.stderr).toContain('Bun 1.x is required')
    const invalid = run(fixture, ['install', '--target', 'cursor'])
    expect(invalid.exitCode).toBe(1)
    expect(invalid.stderr).toContain('--target must be codex or claude')
  })

  test('rejects symlink escape attempts without touching the destination', () => {
    const fixture = makeFixture()
    const outside = join(fixture.root, 'outside')
    mkdirSync(outside)
    mkdirSync(fixture.codex, { recursive: true })
    symlinkSync(outside, join(fixture.codex, 'skills'))
    const result = run(fixture, ['install', '--target', 'codex'])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Refusing symlink in installation path')
    expect(readdirSync(outside)).toEqual([])
  })

  test('refuses package activation after payload tampering', () => {
    const fixture = makeFixture()
    const stagedPackage = join(fixture.root, 'tampered-package')
    mkdirSync(stagedPackage)
    for (const name of ['package.json', 'LICENSE', 'README.md']) cpSync(join(packageRoot, name), join(stagedPackage, name))
    cpSync(join(packageRoot, 'dist'), join(stagedPackage, 'dist'), { recursive: true })
    writeFileSync(join(stagedPackage, 'dist/skill/SKILL.md'), '\nunsafe replacement\n', { flag: 'a' })
    const result = Bun.spawnSync([process.execPath.replace(/bun$/, 'node'), join(stagedPackage, 'dist/bootstrap.mjs'), 'install', '--target', 'codex'], {
      env: fixture.env,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr.toString()).toContain('Checksum mismatch for dist/skill/SKILL.md')
    expect(existsSync(skillDir(fixture, 'codex'))).toBe(false)
  })

  test('verifies exact package inventory and executes an offline local tarball', () => {
    const fixture = makeFixture()
    const dryRun = Bun.spawnSync(['npm', 'pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: packageRoot, stdout: 'pipe', stderr: 'pipe' })
    expect(dryRun.exitCode, dryRun.stderr.toString()).toBe(0)
    const output = JSON.parse(dryRun.stdout.toString())[0]
    const actual = output.files.map(({ path }: { path: string }) => path).sort()
    expect(actual).toEqual(expectedTarballFiles())

    const packed = Bun.spawnSync(['npm', 'pack', packageRoot, '--json', '--ignore-scripts', '--pack-destination', fixture.root], { stdout: 'pipe', stderr: 'pipe' })
    expect(packed.exitCode, packed.stderr.toString()).toBe(0)
    const tarball = join(fixture.root, JSON.parse(packed.stdout.toString())[0].filename)
    const offline = Bun.spawnSync(['npm', 'exec', '--offline', '--yes', '--package', tarball, '--', 'called-it', '--version'], {
      env: { ...fixture.env, npm_config_cache: join(fixture.root, 'npm-cache') },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(offline.exitCode, offline.stderr.toString()).toBe(0)
    expect(offline.stdout.toString().trim()).toBe(agentPackage.version)
  }, 30_000)
})

function expectedTarballFiles() {
  return [
    'LICENSE',
    'README.md',
    'dist/bird-manifest.json',
    'dist/bird.mjs',
    'dist/bootstrap.mjs',
    'dist/distribution-manifest.json',
    'dist/licenses/BIRD-MIT.txt',
    'dist/licenses/CALLED-IT-MIT.txt',
    'dist/licenses/SWEET-COOKIE-MIT.txt',
    'dist/purge-confirmation.mjs',
    'dist/runtime-manifest.json',
    'dist/runtime/called-it.mjs',
    'dist/skill/SKILL.md',
    'dist/skill/called-it-manifest.json',
    'dist/skill/evals/evals.json',
    'dist/skill/references/classification.md',
    'dist/skill/references/reliability.md',
    'dist/skill/references/report-schema.md',
    'dist/skill/references/troubleshooting.md',
    'package.json',
  ].sort()
}

function makeFixture(prefix = 'called-it-distribution-') {
  const root = mkdtempSync(join(tmpdir(), prefix))
  roots.push(root)
  const home = join(root, 'home')
  const codex = join(root, 'codex home')
  const claude = join(root, 'claude home')
  const config = join(root, 'xdg config')
  const data = join(root, 'xdg data')
  const emptyPath = join(root, 'empty-bin')
  for (const path of [home, config, data, emptyPath]) mkdirSync(path, { recursive: true })
  return {
    root,
    home,
    codex,
    claude,
    config,
    data,
    emptyPath,
    env: { ...process.env, HOME: home, CODEX_HOME: codex, CLAUDE_HOME: claude, XDG_CONFIG_HOME: config, XDG_DATA_HOME: data },
  }
}

function run(fixture: ReturnType<typeof makeFixture>, args: string[], envOverrides: Record<string, string> = {}) {
  const result = Bun.spawnSync([process.execPath.replace(/bun$/, 'node'), bootstrap, ...args], {
    env: { ...fixture.env, ...envOverrides },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() }
}

function skillDir(fixture: ReturnType<typeof makeFixture>, target: string) {
  return join(target === 'codex' ? fixture.codex : fixture.claude, 'skills', 'called-it')
}

function installedVersion(fixture: ReturnType<typeof makeFixture>, target: string) {
  return JSON.parse(readFileSync(join(skillDir(fixture, target), 'called-it-manifest.json'), 'utf8')).version
}

function setInstalledVersion(fixture: ReturnType<typeof makeFixture>, target: string, version: string) {
  const path = join(skillDir(fixture, target), 'called-it-manifest.json')
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  manifest.version = version
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`)
  chmodSync(path, 0o644)
}

function ttyInput(text: string) {
  const input = Readable.from([text]) as Readable & { isTTY: boolean }
  input.isTTY = true
  return input
}

function ttyOutput() {
  const output = new Writable({ write(_chunk, _encoding, callback) { callback() } }) as Writable & { isTTY: boolean }
  output.isTTY = true
  return output
}
