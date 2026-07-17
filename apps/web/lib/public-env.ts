const LOCAL_API_URL = 'http://127.0.0.1:3001'
const LOCAL_SITE_URL = 'http://127.0.0.1:3002'

type PublicUrlOptions = {
  configuredUrl?: string
  nodeEnv?: string
  vercelEnv?: string
}

type SiteUrlOptions = PublicUrlOptions & {
  vercelUrl?: string
}

export function resolvePublicSiteUrl({ configuredUrl, nodeEnv, vercelEnv, vercelUrl }: SiteUrlOptions): URL {
  const value = configuredUrl?.trim()
  if (value) return parseHttpUrl(value, 'NEXT_PUBLIC_SITE_URL')

  if (vercelEnv === 'preview') return previewSiteUrl(vercelUrl)
  if (nodeEnv === 'production') throw new Error('Missing NEXT_PUBLIC_SITE_URL')
  return new URL(LOCAL_SITE_URL)
}

export function resolvePublicApiUrl({ configuredUrl, nodeEnv, vercelEnv }: PublicUrlOptions): string | null {
  const value = configuredUrl?.trim()
  if (value) return normalizeApiUrl(parseHttpUrl(value, 'NEXT_PUBLIC_API_URL'))

  if (vercelEnv === 'preview') return null
  if (nodeEnv === 'production') throw new Error('Missing NEXT_PUBLIC_API_URL')
  return LOCAL_API_URL
}

function previewSiteUrl(vercelUrl?: string): URL {
  const hostname = vercelUrl?.trim().toLowerCase()
  if (!hostname) throw new Error('Missing VERCEL_URL for preview deployment')
  if (hostname.length > 253 || !hostname.endsWith('.vercel.app') || !isValidHostname(hostname)) {
    throw new Error('VERCEL_URL must be a valid vercel.app hostname')
  }
  return new URL(`https://${hostname}`)
}

function isValidHostname(hostname: string): boolean {
  return hostname.split('.').every((label) => {
    return label.length > 0
      && label.length <= 63
      && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  })
}

function parseHttpUrl(value: string, name: 'NEXT_PUBLIC_API_URL' | 'NEXT_PUBLIC_SITE_URL'): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid URL`)
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${name} must be an HTTP(S) URL without credentials`)
  }
  return url
}

function normalizeApiUrl(url: URL): string {
  return url.toString().replace(/\/+$/, '')
}
