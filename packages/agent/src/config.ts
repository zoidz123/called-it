import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'

export const cookieSourceSchema = z.enum(['safari', 'chrome', 'firefox'])
export type CookieSource = z.infer<typeof cookieSourceSchema>

export const browserConfigSchema = z.object({
  cookieSource: cookieSourceSchema,
  profile: z.string().trim().min(1),
  profileDir: z.string().trim().min(1).optional(),
  principalHash: z.string().optional(),
  confirmedPrincipalHash: z.string().optional(),
})

export type BrowserConfig = z.infer<typeof browserConfigSchema>

export type AgentPaths = {
  configDir: string
  dataDir: string
  configFile: string
  databaseFile: string
  reportsDir: string
  saltFile: string
}

export function resolveAgentPaths(env: NodeJS.ProcessEnv = process.env): AgentPaths {
  const home = env.HOME || process.cwd()
  const configDir = resolve(env.CALLED_IT_CONFIG_DIR || join(env.XDG_CONFIG_HOME || join(home, '.config'), 'called-it'))
  const dataDir = resolve(env.CALLED_IT_DATA_DIR || join(env.XDG_DATA_HOME || join(home, '.local', 'share'), 'called-it'))
  return {
    configDir,
    dataDir,
    configFile: join(configDir, 'config.json'),
    databaseFile: join(dataDir, 'called-it.sqlite'),
    reportsDir: join(dataDir, 'reports'),
    saltFile: join(configDir, 'principal-salt'),
  }
}

export function ensurePrivateDirectory(path: string) {
  mkdirSync(path, { recursive: true, mode: 0o700 })
  chmodSync(path, 0o700)
}

export function writePrivateFile(path: string, contents: string) {
  writeFileSync(path, contents, { mode: 0o600 })
  chmodSync(path, 0o600)
}

export function loadBrowserConfig(paths = resolveAgentPaths()): BrowserConfig | null {
  try {
    return browserConfigSchema.parse(JSON.parse(readFileSync(paths.configFile, 'utf8')))
  } catch {
    return null
  }
}

export function saveBrowserConfig(config: BrowserConfig, paths = resolveAgentPaths()) {
  rejectCredentialMaterial(config)
  ensurePrivateDirectory(paths.configDir)
  writePrivateFile(paths.configFile, `${JSON.stringify(browserConfigSchema.parse(config), null, 2)}\n`)
}

export function rejectCredentialMaterial(value: unknown) {
  const text = JSON.stringify(value).toLowerCase()
  if (text.includes('auth_token') || text.includes('auth-token') || text.includes('twitter_auth_token') || /(^|[^a-z])ct0([^a-z]|$)/.test(text)) {
    throw new Error('Cookie values and credential flags are not accepted. Select a local browser profile instead.')
  }
}
