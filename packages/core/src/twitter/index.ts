import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { optionalEnv, requiredEnv } from '../env'
import { extractCashtags, mapWithConcurrency } from '../classify'
import type { Tweet, TweetCandidate, XUser } from '../types'

type SearchPayload = { tweets: Tweet[]; nextToken?: string }
type Window = { start: Date; end: Date }

const BASE = optionalEnv('TWITTERAPI_IO_BASE_URL') ?? 'https://api.twitterapi.io'
const CREDIT_COOLDOWN_MS = 60 * 60 * 1000
const SPLIT_DURATIONS_MS = [24 * 60 * 60 * 1000, 6 * 60 * 60 * 1000, 60 * 60 * 1000]
const DEFAULT_DENSE_PROBE_PAGES = 4

export function parseXHandle(input: string): string {
  const trimmed = String(input ?? '').trim()
  if (!trimmed) throw new Error('Enter a valid X handle.')

  let candidate = trimmed
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'x.com' || host === 'twitter.com') {
      candidate = url.pathname.split('/').filter(Boolean)[0] ?? ''
    }
  } catch {
    candidate = trimmed
  }

  const handle = candidate
    .replace(/^@/, '')
    .replace(/[?#].*$/, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase()
  if (!handle) throw new Error('Enter a valid X handle.')
  if (!/^[a-z0-9_]{1,15}$/.test(handle)) throw new Error('Enter a valid X handle.')
  return handle
}

export async function getXUser(handleInput: string): Promise<XUser> {
  const handle = parseXHandle(handleInput)
  const cached = cachedProfile(handle)
  if (optionalEnv('USE_LOCAL_TWITTER_CACHE') === '1' && cached) return cached
  const payload = await callTwitterApi('/twitter/user/info', { userName: handle })
  const user = payload?.data ?? payload?.user ?? payload
  const metrics = user?.public_metrics ?? user?.metrics ?? {}
  const id = String(user?.id ?? user?.rest_id ?? '')
  if (!id) throw new Error(`@${handle} was not found on X.`)
  return {
    id,
    handle: String(user?.username ?? user?.userName ?? user?.screen_name ?? handle).toLowerCase(),
    name: String(user?.name ?? user?.username ?? user?.userName ?? handle),
    avatarUrl: highResAvatar(user?.profilePicture ?? user?.profile_image_url ?? user?.profileImageUrl ?? null),
    bio: String(user?.description ?? user?.bio ?? '').trim() || null,
    followers: Number(metrics.followers_count ?? user?.followers ?? user?.followers_count ?? 0),
    verified: Boolean(user?.verified ?? user?.isVerified ?? user?.isBlueVerified),
  }
}

export async function getAuthorTimeline(
  handleInput: string,
  {
    days = Number(optionalEnv('TWITTER_LOOKBACK_DAYS') ?? 365),
    daysPerWindow = Number(optionalEnv('TWITTER_WINDOW_DAYS') ?? 7),
    maxPagesPerWindow = Number(optionalEnv('TWITTER_MAX_PAGES_PER_WINDOW') ?? optionalEnv('TWITTER_MAX_PAGES') ?? 8),
    concurrency = defaultFetchConcurrency(),
    onPage,
  }: {
    days?: number
    daysPerWindow?: number
    maxPagesPerWindow?: number
    concurrency?: number
    onPage?: (tweets: Tweet[]) => void
  } = {},
): Promise<Tweet[]> {
  const handle = parseXHandle(handleInput)
  const cached = cachedTimeline(handle)
  if (optionalEnv('USE_LOCAL_TWITTER_CACHE') === '1' && cached.length) return cached
  const end = new Date()
  const start = new Date(end.getTime() - days * 86400_000)
  const windows = buildWindows({ start, end, daysPerWindow })
  const results = await mapWithConcurrency(windows, concurrency, (window) =>
    fetchAdaptiveWindow(handle, window, { maxPages: Math.max(1, maxPagesPerWindow), concurrency, onPage }),
  )
  return dedupeTweets(results.flatMap((result) => result.tweets))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function candidatesFromTweets(tweets: Tweet[]): TweetCandidate[] {
  return tweets
    .map((tweet) => ({ ...tweet, text: tidy(tweet.text), assets: extractCashtags(tweet.text) }))
    .filter((tweet) => tweet.assets.length > 0)
}

async function fetchAdaptiveWindow(
  handle: string,
  window: Window,
  { maxPages, concurrency, depth = 0, onPage }: { maxPages: number; concurrency: number; depth?: number; onPage?: (tweets: Tweet[]) => void },
): Promise<{ tweets: Tweet[]; hasMore: boolean; nextToken?: string; pageCount?: number }> {
  const probePages = Math.min(denseProbePages(), maxPages)
  const probe = await fetchWindowPages(handle, window, { maxPages: probePages, onPage })
  const shouldSplit = probe.hasMore && depth < SPLIT_DURATIONS_MS.length
  const splitWindows = shouldSplit ? splitWindow(window, SPLIT_DURATIONS_MS[depth]) : []
  if (splitWindows.length > 1) {
    const results = await mapWithConcurrency(splitWindows, concurrency, (child) =>
      fetchAdaptiveWindow(handle, child, { maxPages, concurrency, depth: depth + 1, onPage }),
    )
    return { tweets: dedupeTweets([...probe.tweets, ...results.flatMap((r) => r.tweets)]), hasMore: results.some((r) => r.hasMore) }
  }
  if (probe.hasMore && probe.nextToken && probe.tweets.length > 0 && probe.pageCount < maxPages) {
    const rest = await fetchWindowPages(handle, window, { maxPages: Math.max(0, maxPages - probe.pageCount), nextToken: probe.nextToken, onPage })
    return { tweets: [...probe.tweets, ...rest.tweets], hasMore: rest.hasMore, nextToken: rest.nextToken }
  }
  return probe
}

async function fetchWindowPages(
  handle: string,
  window: Window,
  { maxPages, nextToken, onPage }: { maxPages: number; nextToken?: string; onPage?: (tweets: Tweet[]) => void },
): Promise<{ tweets: Tweet[]; hasMore: boolean; nextToken?: string; pageCount: number }> {
  const tweets: Tweet[] = []
  let cursor = nextToken
  let pageCount = 0
  for (let page = 0; page < maxPages; page += 1) {
    const payload = await getAuthorSearchPage(handle, { window, nextToken: cursor })
    pageCount += 1
    tweets.push(...payload.tweets)
    onPage?.(payload.tweets)
    cursor = payload.nextToken
    if (!cursor) break
  }
  return { tweets, hasMore: Boolean(cursor), nextToken: cursor, pageCount }
}

async function getAuthorSearchPage(handle: string, { window, nextToken }: { window: Window; nextToken?: string }): Promise<SearchPayload> {
  const query = `from:${handle} -is:retweet -is:reply since_time:${unix(window.start)} until_time:${unix(window.end)}`
  const payload = await callTwitterApi('/twitter/tweet/advanced_search', {
    query,
    queryType: 'Latest',
    cursor: nextToken,
  })
  return normalizeSearchPayload(payload, handle)
}

function normalizeSearchPayload(payload: any, handle: string): SearchPayload {
  const arr = payload?.tweets ?? payload?.data ?? payload?.results ?? []
  const tweets = (Array.isArray(arr) ? arr : [])
    .map((tweet: any) => {
      const id = String(tweet.id ?? tweet.id_str ?? tweet.tweet_id ?? '')
      return {
        id,
        text: String(tweet.text ?? tweet.full_text ?? tweet.content ?? ''),
        createdAt: String(tweet.createdAt ?? tweet.created_at ?? tweet.created ?? ''),
        url: `https://x.com/${handle}/status/${id}`,
      }
    })
    .filter((tweet: Tweet) => tweet.id && tweet.text && tweet.createdAt)
  const rawCursor = payload?.next_cursor ?? payload?.meta?.next_token ?? payload?.next_token ?? payload?.cursor
  return { tweets, nextToken: rawCursor && String(rawCursor) !== '0' ? String(rawCursor) : undefined }
}

function buildWindows({ start, end, daysPerWindow }: { start: Date; end: Date; daysPerWindow: number }): Window[] {
  const windows: Window[] = []
  let cursor = new Date(start)
  while (cursor < end) {
    const next = new Date(Math.min(cursor.getTime() + daysPerWindow * 86400_000, end.getTime()))
    windows.push({ start: new Date(cursor), end: next })
    cursor = next
  }
  return windows
}

function splitWindow(window: Window, durationMs: number): Window[] {
  if (window.end.getTime() - window.start.getTime() <= durationMs) return []
  const windows: Window[] = []
  let cursor = new Date(window.start)
  while (cursor < window.end) {
    const next = new Date(Math.min(cursor.getTime() + durationMs, window.end.getTime()))
    windows.push({ start: new Date(cursor), end: next })
    cursor = next
  }
  return windows
}

function dedupeTweets(tweets: Tweet[]): Tweet[] {
  const seen = new Set<string>()
  const out: Tweet[] = []
  for (const tweet of tweets) {
    if (seen.has(tweet.id)) continue
    seen.add(tweet.id)
    out.push(tweet)
  }
  return out
}

function tidy(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function unix(date: Date): string {
  return String(Math.floor(date.getTime() / 1000))
}

function highResAvatar(url: string | null): string | null {
  if (!url) return null
  return String(url).replace('_normal.', '_400x400.')
}

function cachedTimeline(handle: string): Tweet[] {
  const path = resolve(process.cwd(), `.cache/twitter/${handle}.raw.json`)
  if (!existsSync(path)) return []
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'))
    return (raw.tweets ?? []).map((tweet: any) => ({
      id: String(tweet.id),
      text: String(tweet.text ?? ''),
      createdAt: String(tweet.createdAt ?? ''),
      url: `https://x.com/${handle}/status/${tweet.id}`,
    })).filter((tweet: Tweet) => tweet.id && tweet.text && tweet.createdAt)
  } catch {
    return []
  }
}

function cachedProfile(handle: string): XUser | null {
  const path = resolve(process.cwd(), `.cache/twitter/${handle}.raw.json`)
  if (!existsSync(path)) return null
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'))
    return {
      id: `cached:${handle}`,
      handle,
      name: raw.name ?? handle,
      avatarUrl: null,
      bio: null,
      followers: 0,
      verified: false,
    }
  } catch {
    return null
  }
}

function parseKeys(): string[] {
  const pool = optionalEnv('TWITTERAPI_IO_API_KEYS')?.split(',').map((key) => key.trim()).filter(Boolean) ?? []
  const single = optionalEnv('TWITTERAPI_IO_API_KEY')
  const fallback = optionalEnv('TWITTERAPI_IO_FALLBACK_API_KEY') ?? optionalEnv('TWITTERAPI_IO_API_KEY_4')
  return [...new Set([...pool, ...(single ? [single] : []), ...(fallback ? [fallback] : [])])]
}

function defaultFetchConcurrency() {
  const configured = optionalEnv('TWITTERAPI_IO_FETCH_CONCURRENCY') ?? optionalEnv('TWITTER_FETCH_CONCURRENCY')
  if (configured) return Math.max(1, Number(configured) || 1)
  return Math.max(50, parseKeys().length * 25)
}

function denseProbePages() {
  const configured = Number(optionalEnv('TWITTERAPI_IO_DENSE_PROBE_PAGES') ?? DEFAULT_DENSE_PROBE_PAGES)
  return Math.max(1, Number.isFinite(configured) ? configured : DEFAULT_DENSE_PROBE_PAGES)
}

const scheduler = createRequestScheduler(parseKeys(), {
  fallbackApiKey: optionalEnv('TWITTERAPI_IO_FALLBACK_API_KEY') ?? optionalEnv('TWITTERAPI_IO_API_KEY_4'),
  minIntervalMs: Number(optionalEnv('TWITTERAPI_IO_MIN_INTERVAL_MS') ?? 50),
})

let inFlightTwitterRequests = 0

async function callTwitterApi(path: string, params: Record<string, string | undefined>) {
  const url = new URL(path, BASE)
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value)
  let lastError: Error | undefined
  for (let attempt = 0; attempt < Math.max(3, scheduler.keyCount); attempt += 1) {
    const reservation = await scheduler.reserve()
    const startedAt = Date.now()
    inFlightTwitterRequests += 1
    debugTwitterFetch('start', {
      attempt: attempt + 1,
      keyId: reservation.keyId,
      path,
      inFlight: inFlightTwitterRequests,
    })
    let response: Response
    let text = ''
    try {
      response = await fetch(url, {
        headers: { 'X-API-Key': reservation.apiKey },
        cache: 'no-store',
        signal: AbortSignal.timeout(Number(optionalEnv('TWITTERAPI_TIMEOUT_MS') ?? 15_000)),
      })
      text = await response.text()
    } catch (error) {
      inFlightTwitterRequests -= 1
      debugTwitterFetch('failed', {
        attempt: attempt + 1,
        keyId: reservation.keyId,
        path,
        durationMs: Date.now() - startedAt,
        inFlight: inFlightTwitterRequests,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
    let payload: any
    try { payload = text ? JSON.parse(text) : {} } catch { payload = { error: text } }
    inFlightTwitterRequests -= 1
    debugTwitterFetch('complete', {
      attempt: attempt + 1,
      keyId: reservation.keyId,
      path,
      status: response.status,
      durationMs: Date.now() - startedAt,
      inFlight: inFlightTwitterRequests,
      tweets: Array.isArray(payload?.tweets) ? payload.tweets.length : Array.isArray(payload?.data) ? payload.data.length : undefined,
    })
    if (response.ok && payload?.status !== 'error') return payload
    const message = payload?.message ?? payload?.msg ?? payload?.error ?? `TwitterAPI.io ${response.status}`
    lastError = new Error(String(message))
    if (response.status !== 429 && response.status < 500 && payload?.status !== 'error') throw lastError
    const delay = retryDelay(response, attempt)
    if (isKeyExhaustion(response.status, message)) scheduler.coolDown(reservation.keyId, response.status === 429 ? delay : CREDIT_COOLDOWN_MS)
    await sleep(delay)
  }
  throw lastError ?? new Error('TwitterAPI.io request failed')
}

function debugTwitterFetch(event: 'start' | 'complete' | 'failed', fields: Record<string, unknown>) {
  if (optionalEnv('DEBUG_TWITTER_FETCH') !== '1') return
  console.log(`[twitter-fetch] ${event} ${JSON.stringify(fields)}`)
}

function createRequestScheduler(apiKeys: string[], { fallbackApiKey, minIntervalMs }: { fallbackApiKey?: string; minIntervalMs: number }) {
  const states = apiKeys.map((apiKey, index) => ({
    apiKey,
    keyId: `key_${index + 1}`,
    isFallback: Boolean(fallbackApiKey) && apiKey === fallbackApiKey,
    nextRequestAt: 0,
    coolDownUntil: 0,
  }))
  let chain: Promise<unknown> = Promise.resolve()
  return {
    get keyCount() { return states.length },
    reserve() {
      const scheduled = chain.then(async () => {
        if (!states.length) throw new Error('Missing TWITTERAPI_IO_API_KEY')
        const now = Date.now()
        const primary = states.filter((state) => !state.isFallback && state.coolDownUntil <= now)
        const candidates = primary.length ? primary : states
        const state = candidates.reduce((a, b) => a.nextRequestAt < b.nextRequestAt ? a : b)
        const wait = Math.max(0, state.nextRequestAt - now)
        state.nextRequestAt = Math.max(now, state.nextRequestAt) + minIntervalMs
        if (wait) await sleep(wait)
        return { apiKey: state.apiKey, keyId: state.keyId }
      })
      chain = scheduled.catch(() => {})
      return scheduled
    },
    coolDown(keyId: string, delayMs: number) {
      const state = states.find((candidate) => candidate.keyId === keyId)
      if (!state) return
      state.coolDownUntil = Math.max(state.coolDownUntil, Date.now() + delayMs)
      state.nextRequestAt = Math.max(state.nextRequestAt, state.coolDownUntil)
    },
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000
  return Math.min(5000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250)
}

function isKeyExhaustion(status: number, message: string) {
  return status === 429 || /\b(rate.?limit|too many|credit|quota|balance|insufficient|recharge)\b/i.test(message)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
