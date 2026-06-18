import { boolean, doublePrecision, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const users = pgTable('users', {
  handle: text('handle').primaryKey(),
  xId: text('x_id').notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  followers: integer('followers').notNull().default(0),
  verified: boolean('verified').notNull().default(false),
  lastScannedAt: timestamp('last_scanned_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const scanJobs = pgTable('scan_jobs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  handle: text('handle').notNull(),
  status: text('status').notNull(),
  stage: text('stage'),
  progress: integer('progress').notNull().default(0),
  progressMessage: text('progress_message'),
  paidTx: text('paid_tx'),
  amountUsd: numeric('amount_usd'),
  tweetsScanned: integer('tweets_scanned').notNull().default(0),
  candidates: integer('candidates').notNull().default(0),
  classified: integer('classified').notNull().default(0),
  callsFound: integer('calls_found').notNull().default(0),
  pricedCalls: integer('priced_calls').notNull().default(0),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: text('locked_by'),
})

export const tweets = pgTable('tweets', {
  tweetId: text('tweet_id').primaryKey(),
  handle: text('handle').notNull(),
  text: text('text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  url: text('url').notNull(),
  rawJson: jsonb('raw_json'),
})

export const tweetStances = pgTable('tweet_stances', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tweetId: text('tweet_id').notNull(),
  handle: text('handle').notNull(),
  asset: text('asset').notNull(),
  direction: text('direction').notNull(),
  conviction: doublePrecision('conviction').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const calls = pgTable('calls', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  handle: text('handle').notNull(),
  asset: text('asset').notNull(),
  assetClass: text('asset_class').notNull(),
  sourceId: text('source_id').notNull(),
  direction: text('direction').notNull(),
  firstPitchAt: timestamp('first_pitch_at', { withTimezone: true }).notNull(),
  firstTweetId: text('first_tweet_id').notNull(),
  entryPrice: doublePrecision('entry_price').notNull(),
  currentPrice: doublePrecision('current_price').notNull(),
  returnPct: doublePrecision('return_pct').notNull(),
  isUp: boolean('is_up').notNull(),
  mentions: integer('mentions').notNull(),
  bulls: integer('bulls').notNull(),
  bears: integer('bears').notNull(),
  pricedAt: timestamp('priced_at', { withTimezone: true }).notNull(),
})

export const userStats = pgTable('user_stats', {
  handle: text('handle').primaryKey(),
  avgReturn: doublePrecision('avg_return').notNull().default(0),
  medianReturn: doublePrecision('median_return').notNull().default(0),
  hitRate: doublePrecision('hit_rate').notNull().default(0),
  callsTotal: integer('calls_total').notNull().default(0),
  callsUp: integer('calls_up').notNull().default(0),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
})

