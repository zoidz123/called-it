import { HORIZON_DAYS, type ClassifiedTweet, type HorizonDays, type ResolvedAsset, type ScoredCall, type XUser } from '@called-it/core/types'
import { query, serializeRow, withTransaction } from './client'

const PRICE_REFRESH_TTL_HOURS = Number(process.env.PRICE_REFRESH_TTL_HOURS ?? 1)
const FULL_RESCAN_TTL_HOURS = Number(process.env.FULL_RESCAN_TTL_HOURS ?? 24 * 7)
const REFRESH_JOB_COOLDOWN_MINUTES = Number(process.env.REFRESH_JOB_COOLDOWN_MINUTES ?? 60)

// `requestedBy` marks a scan a visitor asked for; scans the system queues for itself leave it out.
export async function createOrReuseScanJob({ handle, requestedBy }: { handle: string; requestedBy?: string }) {
  const normalized = handle.toLowerCase()
  const existing = await findActiveScanJob(normalized, 'full_scan')
  if (existing) return existing
  try {
    const { rows } = await query(
      `INSERT INTO scan_jobs (handle, job_type, status, stage, progress, progress_message, requested_by)
       VALUES ($1, 'full_scan', 'pending', 'queued', 5, 'Queued scan', $2)
       RETURNING *`,
      [normalized, requestedBy ?? null],
    )
    return serializeRow(rows[0])
  } catch (error: any) {
    if (error?.code !== '23505') throw error
    return findActiveScanJob(normalized, 'full_scan')
  }
}

// Scans visitors started in the past day that did not fail: by this visitor, and by everyone.
export async function countVisitorScans(requestedBy: string) {
  const { rows } = await query(
    `SELECT COUNT(*) FILTER (WHERE requested_by = $1)::int AS mine, COUNT(*)::int AS everyone
     FROM scan_jobs
     WHERE requested_by IS NOT NULL AND job_type = 'full_scan' AND status <> 'error'
       AND created_at > now() - interval '24 hours'`,
    [requestedBy],
  )
  return { mine: Number(rows[0].mine), everyone: Number(rows[0].everyone) }
}

export async function hasScorecard(handle: string) {
  const { rows } = await query(`SELECT 1 FROM users WHERE lower(handle) = lower($1) AND last_scanned_at IS NOT NULL`, [handle])
  return Boolean(rows[0])
}

// Queues a rescore for the accounts whose results were last worked out longest ago, a few at a time. An account that
// posts nothing new is otherwise never rescored, so its calls would reach their 7, 30 and 90 day marks unrecorded.
export async function queueStaleRescores({ afterHours, limit }: { afterHours: number; limit: number }) {
  const { rows } = await query(
    `INSERT INTO scan_jobs (handle, job_type, status, stage, progress, progress_message)
     SELECT s.handle, 'price_refresh', 'pending', 'queued', 5, 'Queued price refresh'
     FROM user_stats s
     WHERE s.computed_at < now() - ($1::int * interval '1 hour')
       AND EXISTS (SELECT 1 FROM calls WHERE calls.handle = s.handle)
       -- One that was tried lately is skipped, so an account whose rescore keeps failing does not hold up the rest.
       AND NOT EXISTS (
        SELECT 1 FROM scan_jobs j
        WHERE lower(j.handle) = lower(s.handle) AND j.job_type = 'price_refresh'
          AND j.created_at > now() - ($3::int * interval '1 minute')
       )
     ORDER BY s.computed_at
     LIMIT $2
     ON CONFLICT DO NOTHING
     RETURNING handle`,
    [afterHours, limit, REFRESH_JOB_COOLDOWN_MINUTES],
  )
  return rows.map((row: any) => row.handle as string)
}

export async function createOrReusePriceRefreshJob({ handle }: { handle: string }) {
  const normalized = handle.toLowerCase()
  const existing = await findActiveScanJob(normalized, 'price_refresh')
  if (existing) return existing
  try {
    const { rows } = await query(
      `INSERT INTO scan_jobs (handle, job_type, status, stage, progress, progress_message)
       VALUES ($1, 'price_refresh', 'pending', 'queued', 5, 'Queued price refresh')
       RETURNING *`,
      [normalized],
    )
    return serializeRow(rows[0])
  } catch (error: any) {
    if (error?.code !== '23505') throw error
    return findActiveScanJob(normalized, 'price_refresh')
  }
}

export async function findActiveScanJob(handle: string, jobType?: 'full_scan' | 'price_refresh') {
  const params = jobType ? [handle, jobType] : [handle]
  const { rows } = await query(
    `SELECT * FROM scan_jobs
     WHERE lower(handle) = lower($1)
       AND status IN ('pending','running')
       ${jobType ? 'AND job_type = $2' : ''}
     ORDER BY created_at ASC LIMIT 1`,
    params,
  )
  return rows[0] ? serializeRow(rows[0]) : null
}

// A running job reports in every half minute. One that has been silent this long lost its worker, usually to a
// restart, and is picked up again.
const JOB_SILENT_MINUTES = 3
// A job that keeps losing its worker is given up on after this long, so it cannot be retried for ever.
const JOB_GIVE_UP_MINUTES = 30

export async function claimNextScanJob(workerId: string) {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE scan_jobs
       SET status = 'error', stage = 'error', progress_message = 'Scan failed', error = 'Interrupted before it finished', finished_at = now()
       WHERE status = 'running' AND locked_at < now() - ($1::int * interval '1 minute')
         AND started_at < now() - ($2::int * interval '1 minute')`,
      [JOB_SILENT_MINUTES, JOB_GIVE_UP_MINUTES],
    )
    const { rows } = await client.query(
      `SELECT * FROM scan_jobs
       WHERE status = 'pending' OR (status = 'running' AND locked_at < now() - ($1::int * interval '1 minute'))
       ORDER BY CASE WHEN job_type = 'full_scan' THEN 0 ELSE 1 END, created_at ASC
       LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [JOB_SILENT_MINUTES],
    )
    if (!rows[0]) return null
    const updated = await client.query(
      `UPDATE scan_jobs
       SET status = 'running', stage = 'fetching_profile', progress = 10,
         started_at = COALESCE(started_at, now()), locked_at = now(), locked_by = $2,
         progress_message = CASE WHEN job_type = 'price_refresh' THEN 'Refreshing prices' ELSE 'Reading X profile' END
       WHERE id = $1 RETURNING *`,
      [rows[0].id, workerId],
    )
    return serializeRow(updated.rows[0])
  })
}

// Reports that a job's worker is still on it.
export async function touchScanJob(id: string) {
  await query(`UPDATE scan_jobs SET locked_at = now() WHERE id = $1 AND status = 'running'`, [id])
}

// Instruments in use whose stored prices are oldest, with how far back each one's calls go.
export async function getStaleSeries({ olderThanMinutes, limit }: { olderThanMinutes: number; limit: number }) {
  const { rows } = await query(
    `SELECT c.asset_class, c.source_id, MIN(c.first_pitch_at) AS since
     FROM calls c
     LEFT JOIN price_series p ON p.series = c.asset_class || ':' || c.source_id AND p.interval = '1d'
     WHERE p.fetched_at IS NULL OR p.fetched_at < now() - ($1::int * interval '1 minute')
     GROUP BY c.asset_class, c.source_id, p.fetched_at
     ORDER BY p.fetched_at NULLS FIRST
     LIMIT $2`,
    [olderThanMinutes, limit],
  )
  return rows.map(serializeRow)
}

export async function getScanJob(id: string) {
  const { rows } = await query(`SELECT * FROM scan_jobs WHERE id = $1`, [id])
  return rows[0] ? serializeRow(rows[0]) : null
}

export async function maybeEnqueueStaleRefreshes(handle: string) {
  const normalized = handle.toLowerCase()
  const [priceState, scanState] = await Promise.all([
    getPriceRefreshState(normalized),
    getFullScanRefreshState(normalized),
  ])
  const jobs: Record<string, any> = {}

  if (priceState?.stale && !(await hasRecentRefreshJob(normalized, 'price_refresh'))) {
    jobs.priceRefresh = await createOrReusePriceRefreshJob({ handle: normalized })
  }
  if (scanState?.stale && !(await hasRecentRefreshJob(normalized, 'full_scan'))) {
    jobs.fullScan = await createOrReuseScanJob({ handle: normalized })
  }

  return { price: priceState, scan: scanState, jobs }
}

async function getPriceRefreshState(handle: string) {
  const { rows } = await query(
    `SELECT MIN(priced_at) AS oldest_priced_at, COUNT(*)::int AS calls_total
     FROM calls WHERE lower(handle) = lower($1)`,
    [handle],
  )
  const row = serializeRow(rows[0])
  if (!row?.oldest_priced_at || Number(row.calls_total) < 1) return null
  const oldest = Date.parse(row.oldest_priced_at)
  return {
    oldestPricedAt: row.oldest_priced_at,
    callsTotal: Number(row.calls_total),
    stale: Number.isFinite(oldest) && Date.now() - oldest > PRICE_REFRESH_TTL_HOURS * 60 * 60 * 1000,
    ttlHours: PRICE_REFRESH_TTL_HOURS,
  }
}

async function getFullScanRefreshState(handle: string) {
  const { rows } = await query(
    `SELECT last_scanned_at FROM users WHERE lower(handle) = lower($1)`,
    [handle],
  )
  const row = rows[0] ? serializeRow(rows[0]) : null
  if (!row?.last_scanned_at) return null
  const lastScanned = Date.parse(row.last_scanned_at)
  return {
    lastScannedAt: row.last_scanned_at,
    stale: Number.isFinite(lastScanned) && Date.now() - lastScanned > FULL_RESCAN_TTL_HOURS * 60 * 60 * 1000,
    ttlHours: FULL_RESCAN_TTL_HOURS,
  }
}

export async function hasRecentRefreshJob(handle: string, jobType: 'full_scan' | 'price_refresh') {
  const { rows } = await query(
    `SELECT id FROM scan_jobs
     WHERE lower(handle) = lower($1)
       AND job_type = $2
       AND created_at > now() - ($3::int * interval '1 minute')
     LIMIT 1`,
    [handle, jobType, REFRESH_JOB_COOLDOWN_MINUTES],
  )
  return Boolean(rows[0])
}

export async function createAssetFeedback({
  handle,
  asset,
  displayedDirection,
  displayedAction,
  suggestedCorrection,
  rowContext,
  userAgent,
}: {
  handle: string
  asset: string
  displayedDirection?: 'BULL' | 'BEAR' | null
  displayedAction?: 'BUY' | 'SELL' | null
  suggestedCorrection: string
  rowContext?: Record<string, unknown> | null
  userAgent?: string | null
}) {
  const { rows } = await query(
    `INSERT INTO asset_feedback (
      handle, asset, displayed_direction, displayed_action, suggested_correction, row_context, user_agent
    ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
    RETURNING id, handle, asset, displayed_direction, displayed_action, suggested_correction, status, created_at`,
    [
      handle.toLowerCase(),
      asset,
      displayedDirection ?? null,
      displayedAction ?? null,
      suggestedCorrection,
      rowContext ? JSON.stringify(rowContext) : null,
      userAgent ?? null,
    ],
  )
  return serializeRow(rows[0])
}

export async function updateScanJob(id: string, fields: Record<string, any>) {
  const allowed = ['stage', 'progress', 'progress_message', 'tweets_scanned', 'candidates', 'classified', 'calls_found', 'priced_calls']
  const entries = Object.entries(fields).filter(([key]) => allowed.includes(key))
  if (!entries.length) return getScanJob(id)
  const set = entries.map(([key], index) => `${key} = $${index + 2}`).join(', ')
  const { rows } = await query(`UPDATE scan_jobs SET ${set}, locked_at = now() WHERE id = $1 RETURNING *`, [id, ...entries.map(([, value]) => value)])
  return rows[0] ? serializeRow(rows[0]) : null
}

export async function completeScanJob(id: string) {
  const { rows } = await query(
    `UPDATE scan_jobs SET status = 'done', stage = 'done', progress = 100, progress_message = 'Scorecard ready', finished_at = now(), error = null WHERE id = $1 RETURNING *`,
    [id],
  )
  return rows[0] ? serializeRow(rows[0]) : null
}

export async function failScanJob(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? 'Scan failed')
  const { rows } = await query(
    `UPDATE scan_jobs SET status = 'error', stage = 'error', progress_message = 'Scan failed', error = $2, finished_at = now() WHERE id = $1 RETURNING *`,
    [id, message],
  )
  return rows[0] ? serializeRow(rows[0]) : null
}

// Saves a scan. `classifiedTweets` are the posts this scan found; posts from earlier scans stay as they are.
// `calls` are the calls rescored over the whole stored history.
export async function persistScorecard({
  user,
  classifiedTweets,
  calls,
}: {
  user: XUser
  classifiedTweets: ClassifiedTweet[]
  calls: ScoredCall[]
}) {
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO users (handle, x_id, name, avatar_url, bio, followers, verified, last_scanned_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())
       ON CONFLICT(handle) DO UPDATE SET
        x_id = excluded.x_id, name = excluded.name, avatar_url = excluded.avatar_url,
        bio = excluded.bio, followers = excluded.followers, verified = excluded.verified,
        last_scanned_at = now(), updated_at = now()`,
      [user.handle, user.id, user.name, user.avatarUrl, user.bio, user.followers, user.verified],
    )

    for (const tweet of classifiedTweets) {
      await client.query(
        `INSERT INTO tweets (tweet_id, handle, text, created_at, url, raw_json)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)
         ON CONFLICT(tweet_id) DO UPDATE SET text = excluded.text, created_at = excluded.created_at, url = excluded.url`,
        [tweet.id, user.handle, tweet.text, tweet.createdAt, tweet.url, JSON.stringify(tweet)],
      )
      await client.query(`DELETE FROM tweet_stances WHERE tweet_id = $1`, [tweet.id])
      for (const stance of tweet.stances) {
        await client.query(
          `INSERT INTO tweet_stances (tweet_id, handle, asset, direction, conviction)
           VALUES ($1,$2,$3,$4,$5)`,
          [tweet.id, user.handle, stance.asset, stance.direction, stance.conviction],
        )
      }
    }

    await replaceCalls(client, user.handle, calls)
    for (const call of calls) {
      for (const tweet of call.evidence) {
        const stance = tweet.stances.find((item) => item.asset === call.asset)
        if (!stance) continue
        await client.query(
          `INSERT INTO call_tweets (handle, asset, tweet_id, text, created_at, stance, conviction, url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT(handle, asset, tweet_id) DO NOTHING`,
          [call.handle, call.asset, tweet.id, tweet.text, tweet.createdAt, stance.direction, stance.conviction, tweet.url],
        )
      }
    }
  })
}

// Calls and their callouts go in as two set-based statements, so a prolific account is not thousands of round trips.
async function insertCalls(client: { query: (text: string, params?: any[]) => Promise<unknown> }, calls: ScoredCall[]) {
  if (!calls.length) return
  await client.query(
    `INSERT INTO calls (
      handle, asset, asset_class, source_id, direction, first_pitch_at, first_tweet_id,
      entry_price, current_price, return_pct, is_up, mentions, bulls, bears, priced_at,
      return_7d, return_30d, return_90d
    )
    SELECT * FROM unnest(
      $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::timestamptz[], $7::text[],
      $8::float8[], $9::float8[], $10::float8[], $11::bool[], $12::int[], $13::int[], $14::int[], $15::timestamptz[],
      $16::float8[], $17::float8[], $18::float8[]
    )`,
    columns(calls, [
      (call) => call.handle, (call) => call.asset, (call) => call.assetClass, (call) => call.sourceId, (call) => call.direction,
      (call) => call.firstPitchAt, (call) => call.firstTweetId, (call) => call.entryPrice, (call) => call.currentPrice,
      (call) => call.returnPct, (call) => call.isUp, (call) => call.mentions, (call) => call.bulls, (call) => call.bears,
      (call) => call.pricedAt, (call) => call.return7d, (call) => call.return30d, (call) => call.return90d,
    ]),
  )
  const callouts = calls.flatMap((call) => call.callouts.map((callout) => ({ call, callout })))
  await client.query(
    `INSERT INTO callouts (
      handle, asset, direction, tweet_id, created_at, episode_start, conviction,
      entry_price, return_pct, return_7d, return_30d, return_90d, entry_at
    )
    SELECT * FROM unnest(
      $1::text[], $2::text[], $3::text[], $4::text[], $5::timestamptz[], $6::timestamptz[], $7::float8[],
      $8::float8[], $9::float8[], $10::float8[], $11::float8[], $12::float8[], $13::timestamptz[]
    )`,
    columns(callouts, [
      ({ call }) => call.handle, ({ call }) => call.asset, ({ call }) => call.direction, ({ callout }) => callout.tweetId,
      ({ callout }) => callout.createdAt, ({ call }) => call.firstPitchAt, ({ callout }) => callout.conviction,
      ({ callout }) => callout.entryPrice, ({ callout }) => callout.returnPct,
      ({ callout }) => callout.return7d, ({ callout }) => callout.return30d, ({ callout }) => callout.return90d,
      ({ callout }) => callout.entryAt,
    ]),
  )
}

function columns<T>(rows: T[], pick: ((row: T) => unknown)[]) {
  return pick.map((read) => rows.map(read))
}

// The stored posts and their stances, in the shape scoring takes, so a profile can be rescored without rescanning X.
export async function getStoredClassifiedTweets(handle: string): Promise<ClassifiedTweet[]> {
  const { rows } = await query(
    `SELECT t.tweet_id, t.text, t.created_at, t.url,
      json_agg(json_build_object('asset', s.asset, 'direction', s.direction, 'conviction', s.conviction)) AS stances
     FROM tweets t JOIN tweet_stances s ON s.tweet_id = t.tweet_id
     WHERE lower(t.handle) = lower($1)
     GROUP BY t.tweet_id, t.text, t.created_at, t.url`,
    [handle],
  )
  return rows.map(serializeRow).map((row: any) => ({
    id: row.tweet_id,
    text: row.text,
    createdAt: row.created_at,
    url: row.url,
    assets: row.stances.map((stance: any) => stance.asset),
    stances: row.stances,
  }))
}

// The instrument each asset was priced against at the last scan.
export async function getStoredAssetSources(handle: string) {
  const { rows } = await query(
    `SELECT DISTINCT asset, asset_class, source_id FROM calls WHERE lower(handle) = lower($1)`,
    [handle],
  )
  return rows.map(serializeRow)
}

// A ticker needs this many accounts on one instrument, and more than on any other, for that to be its default.
const DEFAULT_MIN_ACCOUNTS = 2
const DEFAULT_WINDOW_DAYS = 180

function toInstrument(row: any): ResolvedAsset {
  const onchain = String(row.source_id).startsWith('gt:')
  return {
    symbol: row.ticker,
    assetClass: row.asset_class,
    sourceId: row.source_id,
    name: row.name ?? null,
    kind: row.kind ?? undefined,
    venue: row.venue ?? null,
    provider: onchain ? 'geckoterminal' : row.asset_class === 'crypto' ? 'hyperliquid' : 'yahoo',
  }
}

// Records instruments in the registry, filling in what each one is where that is now known.
export async function recordInstruments(instruments: ResolvedAsset[]) {
  for (const instrument of instruments) {
    await query(
      `INSERT INTO instruments (ticker, asset_class, source_id, kind, name, venue)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (ticker, asset_class, source_id) DO UPDATE SET
        kind = COALESCE(excluded.kind, instruments.kind), name = COALESCE(excluded.name, instruments.name),
        venue = COALESCE(excluded.venue, instruments.venue), updated_at = now()`,
      [instrument.symbol, instrument.assetClass, instrument.sourceId, instrument.kind ?? null, instrument.name ?? null, instrument.venue ?? null],
    )
  }
}

// Instruments in the registry that have not been described yet.
export async function getUndescribedInstruments() {
  const { rows } = await query(`SELECT ticker, asset_class, source_id FROM instruments WHERE kind IS NULL ORDER BY ticker`)
  return rows.map(toInstrument)
}

// How many accounts' recent calls on each ticker are priced against each instrument, with what the instrument is.
async function instrumentUsage(tickers: string[]) {
  const { rows } = await query(
    `SELECT c.asset AS ticker, c.asset_class, c.source_id, i.kind, i.name, i.venue,
      COUNT(DISTINCT c.handle)::int AS accounts, COUNT(*)::int AS calls
     FROM calls c
     LEFT JOIN instruments i ON i.ticker = c.asset AND i.asset_class = c.asset_class AND i.source_id = c.source_id
     WHERE c.asset = ANY($1::text[]) AND c.first_pitch_at > now() - ($2::int * interval '1 day')
     GROUP BY c.asset, c.asset_class, c.source_id, i.kind, i.name, i.venue
     ORDER BY c.asset, accounts DESC, calls DESC`,
    [tickers, DEFAULT_WINDOW_DAYS],
  )
  return rows.map(serializeRow)
}

// What the registry knows about each ticker, for resolving it for another account.
// `defaults` is what the ticker means when an account's own posts do not settle it: the instrument pinned for
// everyone, else the one most accounts are priced against, if it is clearly ahead.
// `tokens` is the on-chain token the ticker is already priced as, so every account that means the token gets the
// same one.
export async function getTickerRegistry(tickers: string[]) {
  const defaults = new Map<string, ResolvedAsset>()
  const tokens = new Map<string, ResolvedAsset>()
  if (!tickers.length) return { defaults, tokens }
  const usage = await instrumentUsage(tickers)
  for (const ticker of tickers) {
    const rows = usage.filter((row: any) => row.ticker === ticker)
    const [first, second] = rows
    if (first && first.accounts >= DEFAULT_MIN_ACCOUNTS && first.accounts > (second?.accounts ?? 0)) defaults.set(ticker, toInstrument(first))
    const token = rows.find((row: any) => String(row.source_id).startsWith('gt:'))
    if (token) tokens.set(ticker, toInstrument(token))
  }
  const pins = await query(
    `SELECT p.ticker, p.asset_class, p.source_id, i.kind, i.name, i.venue
     FROM instrument_pins p
     LEFT JOIN instruments i ON i.ticker = p.ticker AND i.asset_class = p.asset_class AND i.source_id = p.source_id
     WHERE p.handle = '' AND p.ticker = ANY($1::text[])`,
    [tickers],
  )
  for (const row of pins.rows) defaults.set(row.ticker, toInstrument(row))
  return { defaults, tokens }
}

// The instruments pinned by hand for one account, by ticker.
export async function getAccountPins(handle: string): Promise<Map<string, ResolvedAsset>> {
  const { rows } = await query(
    `SELECT p.ticker, p.asset_class, p.source_id, i.kind, i.name, i.venue
     FROM instrument_pins p
     LEFT JOIN instruments i ON i.ticker = p.ticker AND i.asset_class = p.asset_class AND i.source_id = p.source_id
     WHERE p.handle <> '' AND lower(p.handle) = lower($1)`,
    [handle],
  )
  return new Map(rows.map((row: any) => [row.ticker, toInstrument(row)]))
}

// Removes an account's calls on these tickers, for when they were priced against an instrument it no longer means.
export async function dropAssetCalls(handle: string, assets: string[]) {
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM callouts WHERE lower(handle) = lower($1) AND asset = ANY($2::text[])`, [handle, assets])
    await client.query(`DELETE FROM calls WHERE lower(handle) = lower($1) AND asset = ANY($2::text[])`, [handle, assets])
  })
}

// Every instrument a ticker is priced against, most used first, with which one is its default.
export async function listInstruments(ticker: string) {
  const [usage, registry] = await Promise.all([instrumentUsage([ticker]), getTickerRegistry([ticker])])
  const usual = registry.defaults.get(ticker)
  return usage.map((row: any) => ({
    id: `${row.asset_class}:${row.source_id}`,
    ticker: row.ticker,
    assetClass: row.asset_class,
    sourceId: row.source_id,
    kind: row.kind,
    name: row.name,
    venue: row.venue,
    accounts: row.accounts,
    calls: row.calls,
    default: Boolean(usual && usual.assetClass === row.asset_class && usual.sourceId === row.source_id),
  }))
}

export async function persistRescore(handle: string, calls: ScoredCall[]) {
  await withTransaction((client) => replaceCalls(client, handle, calls))
}

// Replaces the calls of every asset that was repriced, then recomputes the handle's stats from what is stored.
// An asset whose prices could not be fetched keeps its old rows.
async function replaceCalls(client: { query: (text: string, params?: any[]) => Promise<unknown> }, handle: string, calls: ScoredCall[]) {
  const assets = [...new Set(calls.map((call) => call.asset))]
  await client.query(`DELETE FROM callouts WHERE lower(handle) = lower($1) AND asset = ANY($2::text[])`, [handle, assets])
  await client.query(`DELETE FROM calls WHERE lower(handle) = lower($1) AND asset = ANY($2::text[])`, [handle, assets])
  await insertCalls(client, calls)

  await client.query(
    `INSERT INTO user_stats (handle, avg_return, median_return, hit_rate, calls_total, calls_up,
      avg_return_7d, hit_rate_7d, calls_7d, median_return_7d, avg_return_30d, hit_rate_30d, calls_30d, median_return_30d, avg_return_90d, hit_rate_90d, calls_90d, median_return_90d, computed_at)
     SELECT
      $1,
      COALESCE(AVG(return_pct), 0),
      COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY return_pct), 0),
      COALESCE(AVG(CASE WHEN is_up THEN 1.0 ELSE 0.0 END), 0),
      COUNT(*)::int,
      COUNT(*) FILTER (WHERE is_up)::int,
      COALESCE(AVG(return_7d), 0),
      COALESCE(AVG(CASE WHEN return_7d > 0 THEN 1.0 WHEN return_7d IS NOT NULL THEN 0.0 END), 0),
      COUNT(return_7d)::int,
      COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY return_7d), 0),
      COALESCE(AVG(return_30d), 0),
      COALESCE(AVG(CASE WHEN return_30d > 0 THEN 1.0 WHEN return_30d IS NOT NULL THEN 0.0 END), 0),
      COUNT(return_30d)::int,
      COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY return_30d), 0),
      COALESCE(AVG(return_90d), 0),
      COALESCE(AVG(CASE WHEN return_90d > 0 THEN 1.0 WHEN return_90d IS NOT NULL THEN 0.0 END), 0),
      COUNT(return_90d)::int,
      COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY return_90d), 0),
      now()
     FROM calls
     WHERE lower(handle) = lower($1)
     ON CONFLICT(handle) DO UPDATE SET
      avg_return = excluded.avg_return, median_return = excluded.median_return,
      hit_rate = excluded.hit_rate, calls_total = excluded.calls_total,
      calls_up = excluded.calls_up,
      avg_return_7d = excluded.avg_return_7d, hit_rate_7d = excluded.hit_rate_7d, calls_7d = excluded.calls_7d, median_return_7d = excluded.median_return_7d,
      avg_return_30d = excluded.avg_return_30d, hit_rate_30d = excluded.hit_rate_30d, calls_30d = excluded.calls_30d, median_return_30d = excluded.median_return_30d,
      avg_return_90d = excluded.avg_return_90d, hit_rate_90d = excluded.hit_rate_90d, calls_90d = excluded.calls_90d, median_return_90d = excluded.median_return_90d,
      computed_at = now()`,
    [handle],
  )
}

// Callouts whose 7, 30 and 90 day results are all in. These are final and are carried forward as stored.
export async function getSettledCallouts(handle: string) {
  const { rows } = await query(
    `SELECT tweet_id, asset, direction, entry_price, entry_at, return_7d, return_30d, return_90d
     FROM callouts
     WHERE lower(handle) = lower($1) AND entry_at IS NOT NULL
       AND return_7d IS NOT NULL AND return_30d IS NOT NULL AND return_90d IS NOT NULL`,
    [handle],
  )
  return rows.map(serializeRow)
}

// Every account with a scorecard, in the scanner's profile shape, with when its posts were last read.
export async function getTrackedAccounts() {
  const { rows } = await query(
    `SELECT handle, x_id, name, avatar_url, bio, followers, verified, last_scanned_at
     FROM users WHERE last_scanned_at IS NOT NULL ORDER BY handle`,
  )
  return rows.map(serializeRow).map((row: any) => ({
    user: { id: row.x_id, handle: row.handle, name: row.name, avatarUrl: row.avatar_url, bio: row.bio, followers: row.followers, verified: row.verified } satisfies XUser,
    lastScannedAt: row.last_scanned_at as string,
  }))
}

// Records that these accounts' posts have been read up to `at`.
export async function markScanned(handles: string[], at: string) {
  await query(`UPDATE users SET last_scanned_at = $2 WHERE handle = ANY($1::text[]) AND last_scanned_at < $2`, [handles, at])
}

export async function getLastScannedAt(handle: string): Promise<string | null> {
  const { rows } = await query(`SELECT last_scanned_at FROM users WHERE lower(handle) = lower($1)`, [handle])
  return rows[0]?.last_scanned_at ? serializeRow(rows[0]).last_scanned_at : null
}

// One asset's thread: every callout with its post, oldest first.
export async function getAssetThread(handle: string, asset: string) {
  const { rows } = await query(
    `SELECT c.tweet_id, c.direction, c.created_at, c.episode_start, c.entry_price, c.entry_at,
      c.return_pct, c.return_7d, c.return_30d, c.return_90d, t.text, t.url
     FROM callouts c JOIN tweets t ON t.tweet_id = c.tweet_id
     WHERE lower(c.handle) = lower($1) AND c.asset = $2
     ORDER BY c.created_at ASC`,
    [handle, asset],
  )
  const source = (await query(
    `SELECT asset_class, source_id FROM calls WHERE lower(handle) = lower($1) AND asset = $2 LIMIT 1`,
    [handle, asset],
  )).rows[0]
  return { callouts: rows.map(serializeRow), source: source ? serializeRow(source) : null }
}

// Ranks by the average move N days after a call, over the calls that have reached that horizon: what putting the same
// amount into every call returned.
export async function getLeaderboard({ horizon = 30, limit = 100, offset = 0 }: { horizon?: HorizonDays; limit?: number; offset?: number } = {}) {
  const h = HORIZON_DAYS.includes(horizon) ? horizon : 30
  const { rows } = await query(
    `SELECT u.handle, u.name, u.avatar_url, u.bio, u.followers,
      s.avg_return_7d, s.hit_rate_7d, s.calls_7d, s.median_return_7d, s.avg_return_30d, s.hit_rate_30d, s.calls_30d, s.median_return_30d, s.avg_return_90d, s.hit_rate_90d, s.calls_90d, s.median_return_90d,
      c.recent
     FROM user_stats s
     JOIN users u ON u.handle = s.handle
     LEFT JOIN LATERAL (
      -- The latest ten settled calls, oldest first: true where the call went their way.
      SELECT array_agg(won ORDER BY first_pitch_at) AS recent FROM (
        SELECT first_pitch_at, return_${h}d > 0 AS won FROM calls
        WHERE calls.handle = u.handle AND return_${h}d IS NOT NULL
        ORDER BY first_pitch_at DESC LIMIT 10
      ) latest
     ) c ON true
     WHERE s.calls_${h}d >= 1
     ORDER BY s.avg_return_${h}d DESC, s.hit_rate_${h}d DESC, u.handle ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  )
  return rows.map(serializeRow)
}

// The calls posted in the past few days, newest first. Each carries what its account had already posted on that asset
// before it and how those earlier calls did N days later, and the instrument that account's calls on the asset are
// priced against: the same ticker can be a stock for one account and a token for another.
export async function getFeed({ horizon = 30, days = 7 }: { horizon?: HorizonDays; days?: number } = {}) {
  const h = HORIZON_DAYS.includes(horizon) ? horizon : 30
  const calls = (await query(
    `SELECT c.tweet_id, c.handle, c.asset, c.direction, c.created_at, c.entry_price, c.return_pct, t.text, t.url,
      e.prior, e.prior_same, e.wins, e.losses, e.avg_return, k.asset_class, k.source_id
     FROM callouts c
     JOIN tweets t ON t.tweet_id = c.tweet_id
     JOIN LATERAL (
      SELECT asset_class, source_id FROM calls WHERE calls.handle = c.handle AND calls.asset = c.asset LIMIT 1
     ) k ON true
     CROSS JOIN LATERAL (
      SELECT COUNT(*)::int AS prior,
        COUNT(*) FILTER (WHERE earlier.direction = c.direction)::int AS prior_same,
        COUNT(*) FILTER (WHERE earlier.return_${h}d > 0)::int AS wins,
        COUNT(*) FILTER (WHERE earlier.return_${h}d <= 0)::int AS losses,
        AVG(earlier.return_${h}d) AS avg_return
      FROM callouts earlier
      WHERE earlier.handle = c.handle AND earlier.asset = c.asset AND earlier.created_at < c.created_at
     ) e
     WHERE c.created_at > now() - ($1::int * interval '1 day')
     ORDER BY c.created_at DESC, c.asset ASC`,
    [days],
  )).rows.map(serializeRow)
  const accounts = (await query(
    `SELECT handle, name, avatar_url FROM users WHERE handle = ANY($1::text[])`,
    [[...new Set(calls.map((call: any) => call.handle))]],
  )).rows.map(serializeRow)
  return { calls, accounts }
}

// The stored summary of each feed row, with the key of the posts it was written from. The `asset` column holds the
// row's key: its ticker and the instrument it is priced against.
export async function getFeedSummaries(assets: string[]) {
  const { rows } = await query(`SELECT asset, posts_key, summary FROM feed_summaries WHERE asset = ANY($1::text[])`, [assets])
  return rows.map(serializeRow)
}

export async function saveFeedSummary({ asset, postsKey, summary }: { asset: string; postsKey: string; summary: string }) {
  await query(
    `INSERT INTO feed_summaries (asset, posts_key, summary) VALUES ($1,$2,$3)
     ON CONFLICT(asset) DO UPDATE SET posts_key = excluded.posts_key, summary = excluded.summary, created_at = now()`,
    [asset, postsKey, summary],
  )
}

export async function getUserScorecard(handle: string, options: { includeTweets?: boolean } = {}) {
  const includeTweets = options.includeTweets ?? true
  const { rows } = await query(
    `SELECT u.*, s.avg_return, s.median_return, s.hit_rate, s.calls_total, s.calls_up,
      s.avg_return_7d, s.hit_rate_7d, s.calls_7d, s.median_return_7d, s.avg_return_30d, s.hit_rate_30d, s.calls_30d, s.median_return_30d, s.avg_return_90d, s.hit_rate_90d, s.calls_90d, s.median_return_90d, s.computed_at
     FROM users u LEFT JOIN user_stats s ON s.handle = u.handle WHERE lower(u.handle) = lower($1)`,
    [handle],
  )
  const user = rows[0] ? serializeRow(rows[0]) : null
  if (!user) return null
  const calls = (await query(`SELECT * FROM calls WHERE lower(handle) = lower($1) ORDER BY return_pct DESC`, [handle])).rows.map(serializeRow)
  const assets = (await query(
    `SELECT
      s.asset,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE s.direction = 'BULL')::int AS bulls,
      COUNT(*) FILTER (WHERE s.direction = 'BEAR')::int AS bears,
      MIN(t.created_at) AS first_pitch_at
     FROM tweet_stances s
     JOIN tweets t ON t.tweet_id = s.tweet_id
     WHERE lower(s.handle) = lower($1)
     GROUP BY s.asset
     ORDER BY total DESC, s.asset ASC`,
    [handle],
  )).rows.map(serializeRow)
  const evidence = (await query(`SELECT * FROM call_tweets WHERE lower(handle) = lower($1) ORDER BY asset, created_at ASC`, [handle])).rows.map(serializeRow)
  const tweetRows = includeTweets ? (await query(
      `SELECT
        t.tweet_id,
        t.text,
        t.created_at,
        t.url,
        json_agg(
          json_build_object(
            'asset', s.asset,
            'direction', s.direction,
            'conviction', s.conviction
          )
          ORDER BY s.asset
        ) AS stances
       FROM tweets t
       JOIN tweet_stances s ON s.tweet_id = t.tweet_id
       WHERE lower(t.handle) = lower($1)
       GROUP BY t.tweet_id, t.text, t.created_at, t.url
       ORDER BY t.created_at DESC`,
      [handle],
    )).rows.map(serializeRow) : []
  const latestScan = (await query(
    `SELECT id, status, stage, tweets_scanned, candidates, classified, calls_found, priced_calls,
      created_at, started_at, finished_at
     FROM scan_jobs
     WHERE lower(handle) = lower($1) AND status = 'done'
     ORDER BY finished_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    [handle],
  )).rows[0]
  return {
    user,
    assets,
    calls: calls.map((call: any) => ({
      ...call,
      evidence: evidence.filter((tweet: any) => tweet.asset === call.asset).slice(0, 2),
    })),
    tweets: tweetRows.map((tweet: any) => ({
      ...tweet,
      stances: Array.isArray(tweet.stances) ? tweet.stances : [],
    })),
    scan: latestScan ? serializeRow(latestScan) : null,
  }
}

export async function hasFreshScorecard(handle: string, maxAgeHours = 24) {
  const { rows } = await query(
    `SELECT u.handle, u.last_scanned_at, s.calls_total
     FROM users u JOIN user_stats s ON s.handle = u.handle
     WHERE lower(u.handle) = lower($1)
       AND u.last_scanned_at > now() - ($2::int * interval '1 hour')`,
    [handle, maxAgeHours],
  )
  return rows[0] ? serializeRow(rows[0]) : null
}
