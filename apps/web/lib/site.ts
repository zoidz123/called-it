import { resolvePublicSiteUrl } from './public-env'

export function resolveSiteUrl({
  configuredUrl = process.env.NEXT_PUBLIC_SITE_URL,
  nodeEnv = process.env.NODE_ENV,
  vercelEnv = process.env.VERCEL_ENV,
  vercelUrl = process.env.VERCEL_URL,
}: {
  configuredUrl?: string
  nodeEnv?: string
  vercelEnv?: string
  vercelUrl?: string
} = {}): URL {
  return resolvePublicSiteUrl({ configuredUrl, nodeEnv, vercelEnv, vercelUrl })
}

export function getSiteUrl(): URL {
  return resolveSiteUrl()
}
