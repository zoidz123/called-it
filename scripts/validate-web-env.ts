import { resolvePublicApiUrl, resolvePublicSiteUrl } from '../apps/web/lib/public-env'

resolvePublicSiteUrl({
  configuredUrl: process.env.NEXT_PUBLIC_SITE_URL,
  nodeEnv: 'production',
  vercelEnv: process.env.VERCEL_ENV,
  vercelUrl: process.env.VERCEL_URL,
})
resolvePublicApiUrl({
  configuredUrl: process.env.NEXT_PUBLIC_API_URL,
  nodeEnv: 'production',
  vercelEnv: process.env.VERCEL_ENV,
})
