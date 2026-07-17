import { beforeAll, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import agentPackage from '../package.json' with { type: 'json' }

const packageRoot = resolve(import.meta.dir, '..')

beforeAll(() => {
  const result = Bun.spawnSync(['bun', 'run', 'build:distribution'], { cwd: packageRoot, stdout: 'pipe', stderr: 'pipe' })
  expect(result.exitCode, result.stderr.toString()).toBe(0)
})

test('package metadata is the canonical version for runtime, CLI, and installed skill', () => {
  const runtime = JSON.parse(readFileSync(join(packageRoot, 'dist/runtime-manifest.json'), 'utf8'))
  const skill = JSON.parse(readFileSync(join(packageRoot, 'dist/skill/called-it-manifest.json'), 'utf8'))
  const distribution = JSON.parse(readFileSync(join(packageRoot, 'dist/distribution-manifest.json'), 'utf8'))
  expect(runtime.version).toBe(agentPackage.version)
  expect(skill.version).toBe(agentPackage.version)
  expect(distribution.version).toBe(agentPackage.version)
  expect(agentPackage.calledItBundledLicenses).toEqual([
    'dist/licenses/CALLED-IT-MIT.txt',
    'dist/licenses/BIRD-MIT.txt',
    'dist/licenses/SWEET-COOKIE-MIT.txt',
  ])

  const cli = Bun.spawnSync(['bun', join(packageRoot, 'dist/runtime/called-it.mjs'), '--version'], { stdout: 'pipe', stderr: 'pipe' })
  expect(cli.exitCode, cli.stderr.toString()).toBe(0)
  expect(cli.stdout.toString().trim()).toBe(agentPackage.version)
})

test('release documentation binds the tag and GitHub release to the package version', () => {
  const release = readFileSync(resolve(packageRoot, '../../docs/releases/agent.md'), 'utf8')
  expect(release).toContain('VERSION=$(node -p "require(\'./packages/agent/package.json\').version")')
  expect(release).toContain('agent-v$' + '{VERSION}')
})
