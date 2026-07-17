const LOCAL_API_URL = 'http://127.0.0.1:3001'

export function resolveApiUrl({
  configuredUrl = process.env.NEXT_PUBLIC_API_URL,
  nodeEnv = process.env.NODE_ENV,
}: {
  configuredUrl?: string
  nodeEnv?: string
} = {}): string {
  const value = configuredUrl?.trim()
  if (!value) {
    if (nodeEnv === 'production') throw new Error('Missing NEXT_PUBLIC_API_URL')
    return LOCAL_API_URL
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('NEXT_PUBLIC_API_URL must be a valid URL')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('NEXT_PUBLIC_API_URL must be an HTTP(S) URL without credentials')
  }
  return value.replace(/\/+$/, '')
}

export const API_URL = resolveApiUrl()

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
