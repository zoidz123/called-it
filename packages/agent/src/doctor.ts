import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { AgentPaths, BrowserConfig } from './config'
import { ensurePrivateDirectory, loadBrowserConfig, resolveAgentPaths, saveBrowserConfig, writePrivateFile } from './config'
import { parseWhoami } from './x/bird-parser'
import type { BirdRunner } from './x/bird-runner'
import { verifyBirdBundle } from './x/bird-runner'

export type DoctorResult = {
  bundle: { version: string; integrity: string }
  runtime: { bun: string; supported: boolean }
  browser: { configured: boolean; source: string | null; profile: string | null }
  authentication: { status: 'ready' | 'needs_auth' | 'not_configured'; principalChanged: boolean }
  cookiePermission: 'ready' | 'denied_or_unavailable' | 'not_checked'
  resumablePartials: number
}

export async function runDoctor(input: { runner?: BirdRunner; paths?: AgentPaths; config?: BrowserConfig; resumablePartials?: number }): Promise<DoctorResult> {
  const paths = input.paths ?? resolveAgentPaths()
  const config = input.config ?? loadBrowserConfig(paths)
  const bundle = verifyBirdBundle()
  const base: DoctorResult = {
    bundle: { version: bundle.version, integrity: bundle.detail },
    runtime: { bun: Bun.version, supported: Number(Bun.version.split('.')[0]) >= 1 },
    browser: { configured: Boolean(config), source: config?.cookieSource ?? null, profile: config?.profile ?? null },
    authentication: { status: config ? 'needs_auth' : 'not_configured', principalChanged: false },
    cookiePermission: 'not_checked',
    resumablePartials: input.resumablePartials ?? 0,
  }
  if (!config || !input.runner) return base
  try {
    const result = await input.runner.run({ type: 'whoami' })
    const identity = parseWhoami(result.stdout)
    const principalHash = hashPrincipal(identity.username, paths)
    const principalChanged = Boolean(config.principalHash && config.principalHash !== principalHash)
    saveBrowserConfig({ ...config, principalHash, confirmedPrincipalHash: principalChanged ? undefined : config.confirmedPrincipalHash }, paths)
    return { ...base, authentication: { status: 'ready', principalChanged }, cookiePermission: 'ready' }
  } catch {
    return { ...base, authentication: { status: 'needs_auth', principalChanged: false }, cookiePermission: 'denied_or_unavailable' }
  }
}

export function hashPrincipal(username: string, paths = resolveAgentPaths()) {
  ensurePrivateDirectory(paths.configDir)
  let salt: Buffer
  try {
    salt = Buffer.from(readFileSync(paths.saltFile, 'utf8'), 'hex')
  } catch {
    salt = randomBytes(32)
    writePrivateFile(paths.saltFile, salt.toString('hex'))
  }
  return createHash('sha256').update(salt).update('\0').update(username.toLowerCase()).digest('hex')
}
