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

// The address a request came from. The host's proxy appends the address it saw to X-Forwarded-For, so the last
// entry is the visitor's; anything before it was sent by the visitor and cannot be trusted.
export function visitorAddress(forwardedFor: string | string[] | undefined, fallback: string | undefined) {
  const forwarded = (Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor ?? '').split(',').map((entry) => entry.trim()).filter(Boolean)
  return forwarded.at(-1) ?? fallback ?? 'unknown'
}

export function corsOrigin(env: Readonly<Record<string, string | undefined>> = process.env): true | string[] {
  const configured = env.CORS_ORIGIN?.trim()
  if (configured) return configured.split(',').map((origin) => origin.trim()).filter(Boolean)
  if (env.NODE_ENV === 'production') throw new Error('Missing CORS_ORIGIN')
  return true
}
