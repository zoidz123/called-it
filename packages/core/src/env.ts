import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let loaded = false

export function loadLocalEnv() {
  if (loaded) return
  loaded = true

  for (const file of ['.env']) {
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index <= 0) continue
      const key = trimmed.slice(0, index)
      const value = trimmed.slice(index + 1).replace(/^["']|["']$/g, '')
      if (!(key in process.env)) process.env[key] = value
    }
  }
}

export function requiredEnv(name: string): string {
  loadLocalEnv()
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

export function optionalEnv(name: string): string | undefined {
  loadLocalEnv()
  return process.env[name]?.trim() || undefined
}

export function requiredAnyEnv(names: string[]): string {
  for (const name of names) {
    const value = optionalEnv(name)
    if (value) return value
  }
  throw new Error(`Missing one of: ${names.join(', ')}`)
}
