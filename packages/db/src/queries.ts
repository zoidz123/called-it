import type { ClassifiedTweet, ScoredCall, UserStats, XUser } from '@called-it/core/types'
import { query, serializeRow, withTransaction } from './client'

export async function createOrReuseScanJob({ handle, paidTx, amountUsd }: { handle: string; paidTx?: string; amountUsd?: number }) {
  const normalized = handle.toLowerCase()
  const existing = await findActiveScanJob(normalized)
  if (existing) return existing
  try {
    const { rows } = await query(
      `INSERT INTO scan_jobs (handle, status, stage, progress, progress_message, paid_tx, amount_usd)
       VALUES ($1, 'pending', 'paid', 5, 'Queued scan', $2, $3)
       RETURNING *`,
      [normalized, paidTx ?? null, amountUsd ?? null],
    )
    return serializeRow(rows[0])
  } catch (error: any) {
    if (error?.code !== '23505') throw error
    return findActiveScanJob(normalized)
  }
}

export async function findActiveScanJob(handle: string) {
  const { rows } = await query(
    `SELECT * FROM scan_jobs WHERE lower(handle) = lower($1) AND status IN ('pending','running') ORDER BY created_at ASC LIMIT 1`,
    [handle],
  )
  return rows[0] ? serializeRow(rows[0]) : null
}

export async function claimNextScanJob(workerId: string) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM scan_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
    )
    if (!rows[0]) return null
    const updated = await client.query(
      `UPDATE scan_jobs
       SET status = 'running', stage = 'fetching_profile', progress = 10,
         started_at = COALESCE(started_at, now()), locked_at = now(), locked_by = $2,
         progress_message = 'Reading X profile'
       WHERE id = $1 RETURNING *`,
      [rows[0].id, workerId],
    )
    return serializeRow(updated.rows[0])
  })
}

export async function getScanJob(id: string) {
  const { rows } = await query(`SELECT * FROM scan_jobs WHERE id = $1`, [id])
  return rows[0] ? serializeRow(rows[0]) : null
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

export async function persistScorecard({
  user,
  classifiedTweets,
  calls,
  stats,
}: {
  user: XUser
  classifiedTweets: ClassifiedTweet[]
  calls: ScoredCall[]
  stats: UserStats
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

    await client.query(`DELETE FROM call_tweets WHERE handle = $1`, [user.handle])
    await client.query(`DELETE FROM tweet_stances WHERE handle = $1`, [user.handle])
    await client.query(`DELETE FROM calls WHERE handle = $1`, [user.handle])
    await client.query(`DELETE FROM tweets WHERE handle = $1`, [user.handle])

    for (const tweet of classifiedTweets) {
      await client.query(
        `INSERT INTO tweets (tweet_id, handle, text, created_at, url, raw_json)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)
         ON CONFLICT(tweet_id) DO UPDATE SET text = excluded.text, created_at = excluded.created_at, url = excluded.url`,
        [tweet.id, user.handle, tweet.text, tweet.createdAt, tweet.url, JSON.stringify(tweet)],
      )
      for (const stance of tweet.stances) {
        await client.query(
          `INSERT INTO tweet_stances (tweet_id, handle, asset, direction, conviction)
           VALUES ($1,$2,$3,$4,$5)`,
          [tweet.id, user.handle, stance.asset, stance.direction, stance.conviction],
        )
      }
    }

    for (const call of calls) {
      await client.query(
        `INSERT INTO calls (
          handle, asset, asset_class, source_id, direction, first_pitch_at, first_tweet_id,
          entry_price, current_price, return_pct, is_up, mentions, bulls, bears, priced_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          call.handle, call.asset, call.assetClass, call.sourceId, call.direction, call.firstPitchAt, call.firstTweetId,
          call.entryPrice, call.currentPrice, call.returnPct, call.isUp, call.mentions, call.bulls, call.bears, call.pricedAt,
        ],
      )
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

    await client.query(
      `INSERT INTO user_stats (handle, avg_return, median_return, hit_rate, calls_total, calls_up, computed_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT(handle) DO UPDATE SET
        avg_return = excluded.avg_return, median_return = excluded.median_return,
        hit_rate = excluded.hit_rate, calls_total = excluded.calls_total,
        calls_up = excluded.calls_up, computed_at = now()`,
      [stats.handle, stats.avgReturn, stats.medianReturn, stats.hitRate, stats.callsTotal, stats.callsUp],
    )
  })
}

export async function getLeaderboard({ sort = 'return', limit = 100, offset = 0 } = {}) {
  const order = sort === 'hitrate'
    ? 's.hit_rate DESC, s.avg_return DESC, u.handle ASC'
    : 's.avg_return DESC, s.hit_rate DESC, u.handle ASC'
  const { rows } = await query(
    `SELECT u.handle, u.name, u.avatar_url, u.bio, u.followers, s.avg_return, s.median_return,
      s.hit_rate, s.calls_total, s.calls_up,
      c.asset AS featured_asset, c.direction AS featured_direction, c.return_pct AS featured_return
     FROM user_stats s
     JOIN users u ON u.handle = s.handle
     LEFT JOIN LATERAL (
      SELECT asset, direction, return_pct FROM calls WHERE calls.handle = u.handle ORDER BY return_pct DESC LIMIT 1
     ) c ON true
     WHERE s.calls_total >= 1
     ORDER BY ${order}
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  )
  return rows.map(serializeRow)
}

export async function getUserScorecard(handle: string, options: { includeTweets?: boolean } = {}) {
  const includeTweets = options.includeTweets ?? true
  const { rows } = await query(
    `SELECT u.*, s.avg_return, s.median_return, s.hit_rate, s.calls_total, s.calls_up, s.computed_at
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
