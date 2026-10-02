import { withTransaction } from './client'

// Any fixed number: it names the lock that keeps two processes from migrating at once.
const MIGRATION_LOCK = 81520261002

const statements = [
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
  `CREATE TABLE IF NOT EXISTS users (
    handle TEXT PRIMARY KEY,
    x_id TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    followers INTEGER NOT NULL DEFAULT 0,
    verified BOOLEAN NOT NULL DEFAULT false,
    last_scanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS scan_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle TEXT NOT NULL,
    job_type TEXT NOT NULL DEFAULT 'full_scan',
    status TEXT NOT NULL CHECK (status IN ('pending','running','done','error')),
    stage TEXT,
    progress INTEGER NOT NULL DEFAULT 0,
    progress_message TEXT,
    paid_tx TEXT,
    amount_usd NUMERIC,
    tweets_scanned INTEGER NOT NULL DEFAULT 0,
    candidates INTEGER NOT NULL DEFAULT 0,
    classified INTEGER NOT NULL DEFAULT 0,
    calls_found INTEGER NOT NULL DEFAULT 0,
    priced_calls INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    locked_by TEXT
  )`,
  `ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS job_type TEXT NOT NULL DEFAULT 'full_scan'`,
  `DO $$
   BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'scan_jobs_job_type_check'
    ) THEN
      ALTER TABLE scan_jobs ADD CONSTRAINT scan_jobs_job_type_check CHECK (job_type IN ('full_scan','price_refresh'));
    END IF;
   END $$`,
  `CREATE TABLE IF NOT EXISTS tweets (
    tweet_id TEXT PRIMARY KEY,
    handle TEXT NOT NULL REFERENCES users(handle) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    url TEXT NOT NULL,
    raw_json JSONB
  )`,
  `CREATE TABLE IF NOT EXISTS tweet_stances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id TEXT NOT NULL REFERENCES tweets(tweet_id) ON DELETE CASCADE,
    handle TEXT NOT NULL REFERENCES users(handle) ON DELETE CASCADE,
    asset TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('BULL','BEAR')),
    conviction DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle TEXT NOT NULL REFERENCES users(handle) ON DELETE CASCADE,
    asset TEXT NOT NULL,
    asset_class TEXT NOT NULL CHECK (asset_class IN ('crypto','stock')),
    source_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('BULL','BEAR')),
    first_pitch_at TIMESTAMPTZ NOT NULL,
    first_tweet_id TEXT NOT NULL,
    entry_price DOUBLE PRECISION NOT NULL,
    current_price DOUBLE PRECISION NOT NULL,
    return_pct DOUBLE PRECISION NOT NULL,
    is_up BOOLEAN NOT NULL,
    mentions INTEGER NOT NULL,
    bulls INTEGER NOT NULL,
    bears INTEGER NOT NULL,
    priced_at TIMESTAMPTZ NOT NULL,
    UNIQUE(handle, asset)
  )`,
  `ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_handle_asset_key`,
  `DROP INDEX IF EXISTS calls_handle_asset_direction_idx`,
  `DROP INDEX IF EXISTS calls_handle_asset_direction_start_idx`,
  `CREATE UNIQUE INDEX IF NOT EXISTS calls_handle_asset_direction_tweet_idx ON calls(handle, asset, direction, first_tweet_id)`,
  `CREATE TABLE IF NOT EXISTS call_tweets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle TEXT NOT NULL REFERENCES users(handle) ON DELETE CASCADE,
    asset TEXT NOT NULL,
    tweet_id TEXT NOT NULL REFERENCES tweets(tweet_id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    stance TEXT NOT NULL CHECK (stance IN ('BULL','BEAR')),
    conviction DOUBLE PRECISION NOT NULL DEFAULT 0,
    url TEXT NOT NULL,
    UNIQUE(handle, asset, tweet_id)
  )`,
  `CREATE TABLE IF NOT EXISTS prices (
    asset TEXT NOT NULL,
    asset_class TEXT NOT NULL,
    source_id TEXT NOT NULL,
    day DATE NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    priced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(asset_class, source_id, day)
  )`,
  `CREATE TABLE IF NOT EXISTS user_stats (
    handle TEXT PRIMARY KEY REFERENCES users(handle) ON DELETE CASCADE,
    avg_return DOUBLE PRECISION NOT NULL DEFAULT 0,
    median_return DOUBLE PRECISION NOT NULL DEFAULT 0,
    hit_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    calls_total INTEGER NOT NULL DEFAULT 0,
    calls_up INTEGER NOT NULL DEFAULT 0,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE calls ADD COLUMN IF NOT EXISTS return_7d DOUBLE PRECISION`,
  `ALTER TABLE calls ADD COLUMN IF NOT EXISTS return_30d DOUBLE PRECISION`,
  `ALTER TABLE calls ADD COLUMN IF NOT EXISTS return_90d DOUBLE PRECISION`,
  `ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS avg_return_7d DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS hit_rate_7d DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS calls_7d INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS avg_return_30d DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS hit_rate_30d DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS calls_30d INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS avg_return_90d DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS hit_rate_90d DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS calls_90d INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS median_return_7d DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS median_return_30d DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS median_return_90d DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS callouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle TEXT NOT NULL REFERENCES users(handle) ON DELETE CASCADE,
    asset TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('BULL','BEAR')),
    tweet_id TEXT NOT NULL REFERENCES tweets(tweet_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,
    episode_start TIMESTAMPTZ NOT NULL,
    conviction DOUBLE PRECISION NOT NULL DEFAULT 0,
    entry_price DOUBLE PRECISION NOT NULL,
    return_pct DOUBLE PRECISION NOT NULL,
    return_7d DOUBLE PRECISION,
    return_30d DOUBLE PRECISION,
    return_90d DOUBLE PRECISION,
    UNIQUE(handle, asset, direction, tweet_id)
  )`,
  `ALTER TABLE callouts ADD COLUMN IF NOT EXISTS entry_at TIMESTAMPTZ`,
  `CREATE INDEX IF NOT EXISTS idx_callouts_handle_asset ON callouts(handle, asset, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_callouts_created ON callouts(created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS feed_summaries (
    asset TEXT PRIMARY KEY,
    posts_key TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS asset_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle TEXT NOT NULL REFERENCES users(handle) ON DELETE CASCADE,
    asset TEXT NOT NULL,
    displayed_direction TEXT CHECK (displayed_direction IN ('BULL','BEAR')),
    displayed_action TEXT CHECK (displayed_action IN ('BUY','SELL')),
    suggested_correction TEXT NOT NULL,
    row_context JSONB,
    user_agent TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `DROP INDEX IF EXISTS one_active_scan_per_handle`,
  `CREATE UNIQUE INDEX IF NOT EXISTS one_active_scan_per_handle_type
    ON scan_jobs (lower(handle), job_type)
    WHERE status IN ('pending','running')`,
  `CREATE INDEX IF NOT EXISTS idx_scan_jobs_status_created ON scan_jobs(status, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_users_stats_rank ON user_stats(avg_return DESC, hit_rate DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_calls_handle_return ON calls(handle, return_pct DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_call_tweets_handle_asset ON call_tweets(handle, asset)`,
  `CREATE INDEX IF NOT EXISTS idx_asset_feedback_created ON asset_feedback(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_asset_feedback_handle_asset ON asset_feedback(lower(handle), asset)`,
  // Price histories, shared by every account that calls an instrument. A history is kept a month to a row.
  `CREATE TABLE IF NOT EXISTS price_series (
    series TEXT NOT NULL,
    interval TEXT NOT NULL,
    from_ms BIGINT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (series, interval)
  )`,
  `CREATE TABLE IF NOT EXISTS price_chunks (
    series TEXT NOT NULL,
    interval TEXT NOT NULL,
    month TEXT NOT NULL,
    bars JSONB NOT NULL,
    PRIMARY KEY (series, interval, month)
  )`,
  // What the stock and token searches found for a ticker.
  `CREATE TABLE IF NOT EXISTS ticker_searches (
    ticker TEXT PRIMARY KEY,
    found JSONB NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // Who asked for a scan, as a hash of their address, so each visitor's scans in a day can be counted.
  `ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS requested_by TEXT`,
  // The registry: every instrument a ticker has been priced against, with what it is. One ticker can have several.
  `CREATE TABLE IF NOT EXISTS instruments (
    ticker TEXT NOT NULL,
    asset_class TEXT NOT NULL CHECK (asset_class IN ('crypto','stock')),
    source_id TEXT NOT NULL,
    kind TEXT,
    name TEXT,
    venue TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (ticker, asset_class, source_id)
  )`,
  // A correction made by hand. With a handle it fixes what that account means by the ticker; with an empty handle
  // it sets what the ticker means for any account whose own posts do not settle it.
  `CREATE TABLE IF NOT EXISTS instrument_pins (
    ticker TEXT NOT NULL,
    handle TEXT NOT NULL DEFAULT '',
    asset_class TEXT NOT NULL CHECK (asset_class IN ('crypto','stock')),
    source_id TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (ticker, handle)
  )`,
  // Instruments priced before the registry existed are entered from the calls that used them.
  `INSERT INTO instruments (ticker, asset_class, source_id)
   SELECT DISTINCT asset, asset_class, source_id FROM calls
   ON CONFLICT DO NOTHING`,
  // A scorecard stored before every post was scored on its own has calls but no callouts, which leaves it off the
  // leaderboard. Each one is queued for a rescore from its stored posts; once rescored it no longer matches.
  `INSERT INTO scan_jobs (handle, job_type, status, stage, progress, progress_message)
   SELECT u.handle, 'price_refresh', 'pending', 'queued', 5, 'Queued price refresh'
   FROM users u
   WHERE EXISTS (SELECT 1 FROM calls WHERE calls.handle = u.handle)
     AND NOT EXISTS (SELECT 1 FROM callouts WHERE callouts.handle = u.handle)
   ON CONFLICT DO NOTHING`,
]

// Runs as one transaction behind a lock, so two processes starting together do not both try to create a table.
export async function migrate() {
  await withTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock($1)`, [MIGRATION_LOCK])
    for (const statement of statements) await client.query(statement)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await migrate()
  console.log('Called It database migrated.')
}
