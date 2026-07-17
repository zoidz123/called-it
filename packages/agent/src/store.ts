import { createHash, randomUUID } from 'node:crypto'
import { chmodSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { Database } from 'bun:sqlite'
import { ensurePrivateDirectory, resolveAgentPaths } from './config'
import type { NormalizedPost } from './x/bird-parser'
import type { ClassifiedTweet, ScoredCall } from '@called-it/core'

export type ScanStream = 'head' | 'tail'
export type ScanStatus = 'ready' | 'partial' | 'needs_auth' | 'rate_paused' | 'tool_incompatible' | 'unavailable' | 'error'

export type CursorRecord = {
  account_handle: string
  stream: ScanStream
  opaque_tail_cursor: string | null
  cursor_generation: number
  oldest_post_at: string | null
  newest_post_at: string | null
  retry_not_before: string | null
  status: ScanStatus
  overlap_known_count: number
  overlap_consecutive_pages: number
}

export type CoverageRecord = {
  run_id: string
  account_handle: string
  requested_from: string
  requested_to: string
  observed_from: string | null
  observed_to: string | null
  completeness: 'best_effort' | 'partial' | 'error'
  stop_reason: string
  page_count: number
  post_count: number
}

export class AgentStore {
  readonly db: Database

  constructor(path = resolveAgentPaths().databaseFile) {
    const inMemory = path === ':memory:'
    if (!inMemory) ensurePrivateDirectory(dirname(path))
    const previousUmask = process.umask(0o077)
    try {
      this.db = new Database(path, { create: true, strict: true })
      this.db.run('PRAGMA journal_mode = WAL')
      this.db.run('PRAGMA foreign_keys = ON')
      this.migrate()
    } finally {
      process.umask(previousUmask)
    }
    if (!inMemory) {
      for (const databasePath of [path, `${path}-wal`, `${path}-shm`]) {
        if (existsSync(databasePath)) chmodSync(databasePath, 0o600)
      }
    }
  }

  close() {
    this.db.close()
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS accounts (
        handle TEXT PRIMARY KEY,
        author_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        account_handle TEXT NOT NULL,
        author_id TEXT,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        url TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        conversation_id TEXT,
        in_reply_to_status_id TEXT,
        is_quote INTEGER NOT NULL,
        excluded_reason TEXT,
        current_revision INTEGER NOT NULL DEFAULT 1,
        deletion_state TEXT NOT NULL DEFAULT 'present',
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS posts_account_created_idx ON posts(account_handle, created_at DESC);
      CREATE TABLE IF NOT EXISTS post_revisions (
        post_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        text TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        PRIMARY KEY(post_id, revision)
      );
      CREATE TABLE IF NOT EXISTS deletion_checks (
        post_id TEXT NOT NULL,
        checked_at TEXT NOT NULL,
        result TEXT NOT NULL,
        PRIMARY KEY(post_id, checked_at)
      );
      CREATE TABLE IF NOT EXISTS extracted_calls (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        evidence_revision INTEGER NOT NULL,
        asset TEXT NOT NULL,
        direction TEXT NOT NULL,
        conviction REAL NOT NULL,
        invalidated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS prices (
        id TEXT PRIMARY KEY,
        asset TEXT NOT NULL,
        source_id TEXT NOT NULL,
        price REAL NOT NULL,
        priced_at TEXT NOT NULL,
        observed_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS outcomes (
        id TEXT PRIMARY KEY,
        call_id TEXT NOT NULL,
        evidence_revision INTEGER NOT NULL,
        entry_price REAL NOT NULL,
        current_price REAL NOT NULL,
        return_pct REAL NOT NULL,
        priced_at TEXT NOT NULL,
        invalidated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        requested_from TEXT NOT NULL,
        requested_to TEXT NOT NULL,
        json TEXT NOT NULL,
        markdown TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scan_cursors (
        account_handle TEXT NOT NULL,
        stream TEXT NOT NULL,
        opaque_tail_cursor TEXT,
        bird_version TEXT NOT NULL,
        cursor_generation INTEGER NOT NULL DEFAULT 1,
        salted_principal_hash TEXT NOT NULL,
        newest_post_at TEXT,
        oldest_post_at TEXT,
        last_committed_page INTEGER NOT NULL DEFAULT 0,
        overlap_known_count INTEGER NOT NULL DEFAULT 0,
        overlap_consecutive_pages INTEGER NOT NULL DEFAULT 0,
        retry_not_before TEXT,
        status TEXT NOT NULL DEFAULT 'ready',
        updated_at TEXT NOT NULL,
        PRIMARY KEY(account_handle, stream)
      );
      CREATE TABLE IF NOT EXISTS scan_pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        account_handle TEXT NOT NULL,
        stream TEXT NOT NULL,
        cursor_generation INTEGER NOT NULL,
        input_cursor_hash TEXT,
        successful_output_cursor TEXT,
        attempt INTEGER NOT NULL,
        status TEXT NOT NULL,
        post_count INTEGER NOT NULL,
        duplicate_count INTEGER NOT NULL,
        newest_post_at TEXT,
        oldest_post_at TEXT,
        error_class TEXT,
        error_detail TEXT,
        committed_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scan_coverage (
        run_id TEXT NOT NULL,
        account_handle TEXT NOT NULL,
        requested_from TEXT NOT NULL,
        requested_to TEXT NOT NULL,
        observed_from TEXT,
        observed_to TEXT,
        completeness TEXT NOT NULL,
        stop_reason TEXT NOT NULL,
        page_count INTEGER NOT NULL,
        post_count INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(run_id, account_handle)
      );
      INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (1, datetime('now'));
    `)
  }

  startRun() {
    return randomUUID()
  }

  knownPostIds(handle: string): Set<string> {
    return new Set((this.db.query('SELECT id FROM posts WHERE account_handle = ?').all(handle) as { id: string }[]).map((row) => row.id))
  }

  getCursor(handle: string, stream: ScanStream): CursorRecord | null {
    return this.db.query('SELECT * FROM scan_cursors WHERE account_handle = ? AND stream = ?').get(handle, stream) as CursorRecord | null
  }

  initializeCursor(handle: string, stream: ScanStream, principalHash: string, cursor: string | null, now: string) {
    this.db.query(`
      INSERT INTO scan_cursors(account_handle, stream, opaque_tail_cursor, bird_version, salted_principal_hash, updated_at)
      VALUES (?, ?, ?, '0.8.0', ?, ?)
      ON CONFLICT(account_handle, stream) DO NOTHING
    `).run(handle, stream, cursor, principalHash, now)
  }

  commitPage(input: {
    runId: string
    handle: string
    stream: ScanStream
    inputCursor: string | null
    outputCursor: string | null
    attempt: number
    posts: NormalizedPost[]
    principalHash: string
    knownBefore: Set<string>
    overlapKnownCount: number
    overlapConsecutivePages: number
    requestedFrom: string
    requestedTo: string
    now: string
  }) {
    return this.db.transaction(() => {
      this.initializeCursor(input.handle, input.stream, input.principalHash, input.outputCursor, input.now)
      let duplicates = 0
      for (const post of input.posts) {
        const current = this.db.query('SELECT content_hash, current_revision FROM posts WHERE id = ?').get(post.id) as { content_hash: string; current_revision: number } | null
        if (current) {
          duplicates++
          if (current.content_hash !== post.contentHash) {
            const revision = current.current_revision + 1
            this.db.query('INSERT INTO post_revisions(post_id, revision, content_hash, text, observed_at) VALUES (?, ?, ?, ?, ?)')
              .run(post.id, revision, post.contentHash, post.text, input.now)
            this.db.query(`UPDATE posts SET text = ?, content_hash = ?, current_revision = ?, last_seen_at = ?, deletion_state = 'present' WHERE id = ?`)
              .run(post.text, post.contentHash, revision, input.now, post.id)
            this.db.query('UPDATE extracted_calls SET invalidated_at = ? WHERE post_id = ? AND invalidated_at IS NULL').run(input.now, post.id)
            this.db.query(`UPDATE outcomes SET invalidated_at = ? WHERE call_id IN (SELECT id FROM extracted_calls WHERE post_id = ?) AND invalidated_at IS NULL`).run(input.now, post.id)
          } else {
            this.db.query(`UPDATE posts SET last_seen_at = ?, deletion_state = 'present' WHERE id = ?`).run(input.now, post.id)
          }
        } else {
          this.db.query(`
            INSERT INTO posts(id, account_handle, author_id, text, created_at, url, content_hash, conversation_id, in_reply_to_status_id, is_quote, excluded_reason, first_seen_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(post.id, input.handle, post.authorId, post.text, post.createdAt, post.url, post.contentHash, post.conversationId, post.inReplyToStatusId, post.isQuote ? 1 : 0, post.excludedReason, input.now, input.now)
          this.db.query('INSERT INTO post_revisions(post_id, revision, content_hash, text, observed_at) VALUES (?, 1, ?, ?, ?)')
            .run(post.id, post.contentHash, post.text, input.now)
        }
      }
      const times = input.posts.map((post) => post.createdAt).sort()
      const oldest = times[0] ?? null
      const newest = times.at(-1) ?? null
      const cursor = this.getCursor(input.handle, input.stream)
      const generation = cursor?.cursor_generation ?? 1
      const pageState = cursor
        ? this.db.query('SELECT last_committed_page FROM scan_cursors WHERE account_handle = ? AND stream = ?').get(input.handle, input.stream) as { last_committed_page: number } | null
        : null
      const pageNumber = Number(pageState?.last_committed_page ?? 0) + 1
      this.db.query(`
        INSERT INTO scan_pages(run_id, account_handle, stream, cursor_generation, input_cursor_hash, successful_output_cursor, attempt, status, post_count, duplicate_count, newest_post_at, oldest_post_at, committed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'committed', ?, ?, ?, ?, ?)
      `).run(input.runId, input.handle, input.stream, generation, hashCursor(input.inputCursor), input.outputCursor, input.attempt, input.posts.length, duplicates, newest, oldest, input.now)
      this.db.query(`
        UPDATE scan_cursors SET opaque_tail_cursor = ?, newest_post_at = COALESCE(MAX(newest_post_at, ?), ?),
          oldest_post_at = COALESCE(MIN(oldest_post_at, ?), ?), last_committed_page = ?, overlap_known_count = ?,
          overlap_consecutive_pages = ?, status = 'ready', retry_not_before = NULL, updated_at = ?
        WHERE account_handle = ? AND stream = ?
      `).run(input.outputCursor, newest, newest, oldest, oldest, pageNumber, input.overlapKnownCount, input.overlapConsecutivePages, input.now, input.handle, input.stream)
      this.db.query(`
        INSERT INTO scan_coverage(run_id, account_handle, requested_from, requested_to, observed_from, observed_to, completeness, stop_reason, page_count, post_count, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'best_effort', 'scanning', 1, ?, ?)
        ON CONFLICT(run_id, account_handle) DO UPDATE SET
          observed_from = COALESCE(MIN(observed_from, excluded.observed_from), excluded.observed_from),
          observed_to = COALESCE(MAX(observed_to, excluded.observed_to), excluded.observed_to),
          page_count = page_count + 1, post_count = post_count + excluded.post_count, updated_at = excluded.updated_at
      `).run(input.runId, input.handle, input.requestedFrom, input.requestedTo, oldest, newest, input.posts.length, input.now)
      this.db.query(`INSERT INTO accounts(handle, author_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(handle) DO UPDATE SET author_id = COALESCE(excluded.author_id, author_id), updated_at = excluded.updated_at`)
        .run(input.handle, input.posts.find((post) => post.authorId)?.authorId ?? null, input.now)
      return { duplicateCount: duplicates, newCount: input.posts.length - duplicates, pageNumber }
    })()
  }

  markFailure(input: { runId: string; handle: string; stream: ScanStream; status: ScanStatus; reason: string; errorClass: string; errorDetail: string; requestedFrom: string; requestedTo: string; principalHash: string; retryNotBefore?: string | null; now: string }) {
    this.db.transaction(() => {
      this.initializeCursor(input.handle, input.stream, input.principalHash, null, input.now)
      const cursor = this.getCursor(input.handle, input.stream)
      this.db.query('UPDATE scan_cursors SET status = ?, retry_not_before = ?, updated_at = ? WHERE account_handle = ? AND stream = ?')
        .run(input.status, input.retryNotBefore ?? null, input.now, input.handle, input.stream)
      this.db.query(`INSERT INTO scan_pages(run_id, account_handle, stream, cursor_generation, attempt, status, post_count, duplicate_count, error_class, error_detail, committed_at) VALUES (?, ?, ?, ?, 1, 'failed', 0, 0, ?, ?, ?)`)
        .run(input.runId, input.handle, input.stream, cursor?.cursor_generation ?? 1, input.errorClass, input.errorDetail, input.now)
      this.finalizeCoverage(input.runId, input.handle, input.status === 'error' ? 'error' : 'partial', input.reason, input.requestedFrom, input.requestedTo, input.now)
    })()
  }

  finalizeCoverage(runId: string, handle: string, completeness: CoverageRecord['completeness'], reason: string, requestedFrom: string, requestedTo: string, now: string) {
    this.db.query(`
      INSERT INTO scan_coverage(run_id, account_handle, requested_from, requested_to, completeness, stop_reason, page_count, post_count, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)
      ON CONFLICT(run_id, account_handle) DO UPDATE SET completeness = excluded.completeness, stop_reason = excluded.stop_reason, updated_at = excluded.updated_at
    `).run(runId, handle, requestedFrom, requestedTo, completeness, reason, now)
  }

  restartCursor(handle: string, stream: ScanStream, now: string) {
    this.db.query(`UPDATE scan_cursors SET opaque_tail_cursor = NULL, cursor_generation = cursor_generation + 1, overlap_known_count = 0, overlap_consecutive_pages = 0, status = 'partial', updated_at = ? WHERE account_handle = ? AND stream = ?`)
      .run(now, handle, stream)
  }

  getCoverage(runId: string): CoverageRecord[] {
    return this.db.query('SELECT * FROM scan_coverage WHERE run_id = ? ORDER BY account_handle').all(runId) as CoverageRecord[]
  }

  getPosts(handles: string[], from: string, to: string) {
    if (!handles.length) return [] as Array<Record<string, unknown>>
    const placeholders = handles.map(() => '?').join(',')
    return this.db.query(`SELECT * FROM posts WHERE account_handle IN (${placeholders}) AND created_at >= ? AND created_at <= ? ORDER BY created_at`).all(...handles, from, to) as Array<Record<string, unknown>>
  }

  getRecentPostIds(handles: string[], since: string, limit = 10): string[] {
    if (!handles.length) return []
    const placeholders = handles.map(() => '?').join(',')
    return (this.db.query(`SELECT id FROM posts WHERE account_handle IN (${placeholders}) AND created_at >= ? AND deletion_state != 'deleted' ORDER BY created_at DESC LIMIT ?`).all(...handles, since, limit) as { id: string }[]).map((row) => row.id)
  }

  reconcilePost(post: NormalizedPost, observedAt: string) {
    return this.db.transaction(() => {
      const current = this.db.query('SELECT content_hash, current_revision FROM posts WHERE id = ?').get(post.id) as { content_hash: string; current_revision: number } | null
      if (!current) return { changed: false, revision: 0 }
      if (current.content_hash === post.contentHash) {
        this.db.query(`UPDATE posts SET last_seen_at = ?, deletion_state = 'present' WHERE id = ?`).run(observedAt, post.id)
        return { changed: false, revision: current.current_revision }
      }
      const revision = current.current_revision + 1
      this.db.query('INSERT INTO post_revisions(post_id, revision, content_hash, text, observed_at) VALUES (?, ?, ?, ?, ?)')
        .run(post.id, revision, post.contentHash, post.text, observedAt)
      this.db.query(`UPDATE posts SET text = ?, content_hash = ?, current_revision = ?, last_seen_at = ?, deletion_state = 'present' WHERE id = ?`)
        .run(post.text, post.contentHash, revision, observedAt, post.id)
      this.db.query('UPDATE extracted_calls SET invalidated_at = ? WHERE post_id = ? AND invalidated_at IS NULL').run(observedAt, post.id)
      this.db.query(`UPDATE outcomes SET invalidated_at = ? WHERE call_id IN (SELECT id FROM extracted_calls WHERE post_id = ?) AND invalidated_at IS NULL`).run(observedAt, post.id)
      return { changed: true, revision }
    })()
  }

  saveAnalysis(classified: ClassifiedTweet[], calls: ScoredCall[], observedAt: string) {
    this.db.transaction(() => {
      for (const tweet of classified) {
        const revision = (this.db.query('SELECT current_revision FROM posts WHERE id = ?').get(tweet.id) as { current_revision: number } | null)?.current_revision ?? 1
        for (const stance of tweet.stances) {
          const id = stableId('call', tweet.id, String(revision), stance.asset, stance.direction)
          this.db.query(`
            INSERT INTO extracted_calls(id, post_id, evidence_revision, asset, direction, conviction, invalidated_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL)
            ON CONFLICT(id) DO UPDATE SET conviction = excluded.conviction, invalidated_at = NULL
          `).run(id, tweet.id, revision, stance.asset, stance.direction, stance.conviction)
        }
      }
      for (const call of calls) {
        const revision = (this.db.query('SELECT current_revision FROM posts WHERE id = ?').get(call.firstTweetId) as { current_revision: number } | null)?.current_revision ?? 1
        const callId = stableId('call', call.firstTweetId, String(revision), call.asset, call.direction)
        const priceId = stableId('price', call.asset, call.sourceId, call.pricedAt, String(call.currentPrice))
        this.db.query(`INSERT OR IGNORE INTO prices(id, asset, source_id, price, priced_at, observed_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(priceId, call.asset, call.sourceId, call.currentPrice, call.pricedAt, observedAt)
        const outcomeId = stableId('outcome', callId, call.pricedAt)
        this.db.query(`
          INSERT INTO outcomes(id, call_id, evidence_revision, entry_price, current_price, return_pct, priced_at, invalidated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
          ON CONFLICT(id) DO UPDATE SET current_price = excluded.current_price, return_pct = excluded.return_pct, invalidated_at = NULL
        `).run(outcomeId, callId, revision, call.entryPrice, call.currentPrice, call.returnPct, call.pricedAt)
      }
    })()
  }

  confirmNotFound(postId: string, checkedAt: string) {
    this.db.query('INSERT INTO deletion_checks(post_id, checked_at, result) VALUES (?, ?, ?)').run(postId, checkedAt, 'not_found')
    const checks = this.db.query(`SELECT checked_at FROM deletion_checks WHERE post_id = ? AND result = 'not_found' ORDER BY checked_at`).all(postId) as { checked_at: string }[]
    const first = checks[0]
    const last = checks.at(-1)
    if (first && last && checks.length >= 2 && Date.parse(last.checked_at) - Date.parse(first.checked_at) >= 86_400_000) {
      this.db.query(`UPDATE posts SET deletion_state = 'deleted' WHERE id = ?`).run(postId)
      return true
    }
    return false
  }

  saveReport(id: string, requestedFrom: string, requestedTo: string, json: string, markdown: string, createdAt: string) {
    this.db.query('INSERT INTO reports(id, created_at, requested_from, requested_to, json, markdown) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, createdAt, requestedFrom, requestedTo, json, markdown)
  }

  getReport(id?: string): { id: string; json: string; markdown: string; created_at: string } | null {
    if (id) return this.db.query('SELECT id, json, markdown, created_at FROM reports WHERE id = ?').get(id) as { id: string; json: string; markdown: string; created_at: string } | null
    return this.db.query('SELECT id, json, markdown, created_at FROM reports ORDER BY created_at DESC LIMIT 1').get() as { id: string; json: string; markdown: string; created_at: string } | null
  }

  getPostStates(ids: string[]) {
    if (!ids.length) return new Map<string, { revision: number; deletionState: string }>()
    const placeholders = ids.map(() => '?').join(',')
    const rows = this.db.query(`SELECT id, current_revision, deletion_state FROM posts WHERE id IN (${placeholders})`).all(...ids) as Array<{ id: string; current_revision: number; deletion_state: string }>
    return new Map(rows.map((row) => [row.id, { revision: row.current_revision, deletionState: row.deletion_state }]))
  }
}

function hashCursor(cursor: string | null) {
  return cursor ? createHash('sha256').update(cursor).digest('hex') : null
}

function stableId(...parts: string[]) {
  return createHash('sha256').update(parts.join('\0')).digest('hex')
}
