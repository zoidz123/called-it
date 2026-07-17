import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { verifyBirdBundle } from '../src/x/bird-runner'

const packageRoot = resolve(import.meta.dir, '..')

test('bundles exact Bird and sweet-cookie versions with integrity and licenses', () => {
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'dist/bird-manifest.json'), 'utf8'))
  const bundle = readFileSync(join(packageRoot, 'dist/bird.mjs'))
  expect(manifest).toMatchObject({ version: '0.8.0', sweetCookieVersion: '0.1.0', chromeExpiryCastApplied: false })
  expect(manifest.commands).toEqual(['whoami', 'user-tweets', 'read'])
  expect(manifest.sha256).toBe(createHash('sha256').update(bundle).digest('hex'))
  expect(readFileSync(join(packageRoot, 'dist/licenses/BIRD-MIT.txt'), 'utf8')).toContain('Copyright (c) 2025 Peter Steinberger')
  expect(readFileSync(join(packageRoot, 'dist/licenses/SWEET-COOKIE-MIT.txt'), 'utf8')).toContain('MIT License')
  expect(bundle.includes(Buffer.from('CAST(expires_utc AS TEXT)'))).toBe(false)
  expect(bundle.includes(Buffer.from('/Users/'))).toBe(false)
  expect(verifyBirdBundle(packageRoot)).toMatchObject({ ok: true, version: '0.8.0', detail: 'verified' })
})

test('bundle reports its pinned runtime version', () => {
  const result = Bun.spawnSync(['bun', join(packageRoot, 'dist/bird.mjs'), '--version'], { env: { ...process.env, BIRD_VERSION: '0.8.0' }, stdout: 'pipe', stderr: 'pipe' })
  expect(result.exitCode).toBe(0)
  expect(result.stdout.toString().trim()).toBe('0.8.0')
})

test('local agent source has no official or paid X provider implementation', () => {
  const files = walk(join(packageRoot, 'src'))
  const source = files.map((file) => readFileSync(file, 'utf8')).join('\n')
  expect(source).not.toMatch(/TWITTERAPI_IO|twitterapi\.io|api\.twitter\.com|generic provider/i)
  expect(source).not.toMatch(/playwright|puppeteer|selenium/i)
})

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}
