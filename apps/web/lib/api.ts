import { resolvePublicApiUrl } from './public-env'

export function resolveApiUrl({
  configuredUrl = process.env.NEXT_PUBLIC_API_URL,
  nodeEnv = process.env.NODE_ENV,
  vercelEnv = process.env.VERCEL_ENV,
}: {
  configuredUrl?: string
  nodeEnv?: string
  vercelEnv?: string
} = {}): string | null {
  return resolvePublicApiUrl({ configuredUrl, nodeEnv, vercelEnv })
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim()
  ? resolveApiUrl({ configuredUrl: process.env.NEXT_PUBLIC_API_URL })
  : null

export async function apiGet<T>(path: string): Promise<T> {
  const apiUrl = resolveApiUrl()
  if (!apiUrl) throw new Error('Called It API is unavailable in this preview')
  const res = await fetch(`${apiUrl}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
