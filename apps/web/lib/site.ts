const LOCAL_SITE_URL = 'http://127.0.0.1:3002'

export function resolveSiteUrl({
  configuredUrl = process.env.NEXT_PUBLIC_SITE_URL,
  nodeEnv = process.env.NODE_ENV,
}: {
  configuredUrl?: string
  nodeEnv?: string
} = {}): URL {
  const value = configuredUrl?.trim()
  if (!value) {
    if (nodeEnv === 'production') throw new Error('Missing NEXT_PUBLIC_SITE_URL')
    return new URL(LOCAL_SITE_URL)
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('NEXT_PUBLIC_SITE_URL must be a valid URL')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('NEXT_PUBLIC_SITE_URL must be an HTTP(S) URL without credentials')
  }
  return url
}

export const SITE_URL = resolveSiteUrl()
