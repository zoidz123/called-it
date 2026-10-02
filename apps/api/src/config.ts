export const TWITTER_KEY_NAMES = [
  'TWITTERAPI_IO_API_KEYS',
  'TWITTERAPI_IO_API_KEY',
  'TWITTERAPI_IO_FALLBACK_API_KEY',
  'TWITTERAPI_IO_API_KEY_4',
]

export function scanIsConfigured(env: Readonly<Record<string, string | undefined>> = process.env) {
  return env.SCAN_WORKER_ENABLED !== 'false'
    && Boolean(env.TYPESAFE_API_KEY?.trim())
    && TWITTER_KEY_NAMES.some((name) => Boolean(env[name]?.trim()))
}

// The address a request came from. Railway's edge sets X-Real-IP to the visitor's address and overwrites any value
// the visitor sends, so that header is the one to trust. Its X-Forwarded-For ends with the edge server's own
// address, which changes from request to request, so it cannot tell visitors apart. With no proxy in front, as in
// local development, the connection's address is used.
export function visitorAddress(headers: Record<string, string | string[] | undefined>, fallback: string | undefined) {
  const realIp = headers['x-real-ip']
  return (Array.isArray(realIp) ? realIp[0] : realIp)?.trim() || fallback || 'unknown'
}

export function corsOrigin(env: Readonly<Record<string, string | undefined>> = process.env): true | string[] {
  const configured = env.CORS_ORIGIN?.trim()
  if (configured) return configured.split(',').map((origin) => origin.trim()).filter(Boolean)
  if (env.NODE_ENV === 'production') throw new Error('Missing CORS_ORIGIN')
  return true
}
