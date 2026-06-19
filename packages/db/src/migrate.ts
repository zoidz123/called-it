import { query } from './client'

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
  `CREATE UNIQUE INDEX IF NOT EXISTS calls_handle_asset_direction_idx ON calls(handle, asset, direction)`,
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
]

export async function migrate() {
  for (const statement of statements) await query(statement)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await migrate()
  console.log('Called It database migrated.')
}
