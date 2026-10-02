import type { Bar, CandidateStore, PriceStore } from '@called-it/core'
import { query, withTransaction } from './client'

// A history is kept a month to a row, so adding the latest bars rewrites one small row and not the whole history.
const monthOf = (time: number) => new Date(time).toISOString().slice(0, 7)

// Price histories shared by every account, one per instrument and interval.
export const priceStore: PriceStore = {
  async load(series, interval) {
    const meta = (await query(`SELECT from_ms, fetched_at FROM price_series WHERE series = $1 AND interval = $2`, [series, interval])).rows[0]
    if (!meta) return null
    const chunks = await query(`SELECT bars FROM price_chunks WHERE series = $1 AND interval = $2 ORDER BY month`, [series, interval])
    const bars = chunks.rows.flatMap((row: any) => (row.bars as number[][]).map(([t, end, open, high, low, close]): Bar => ({ t, end, open, high, low, close })))
    return { bars, from: Number(meta.from_ms), fetchedAt: new Date(meta.fetched_at).getTime() }
  },

  async save(series, interval, stored, changedFrom) {
    const firstMonth = changedFrom > 0 ? monthOf(changedFrom) : ''
    const months = new Map<string, number[][]>()
    for (const bar of stored.bars) {
      const month = monthOf(bar.t)
      if (month < firstMonth) continue
      months.set(month, [...(months.get(month) ?? []), [bar.t, bar.end, bar.open, bar.high, bar.low, bar.close]])
    }
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM price_chunks WHERE series = $1 AND interval = $2 AND month >= $3`, [series, interval, firstMonth])
      if (months.size) {
        await client.query(
          `INSERT INTO price_chunks (series, interval, month, bars)
           SELECT $1, $2, chunk.month, chunk.bars::jsonb FROM unnest($3::text[], $4::text[]) AS chunk(month, bars)`,
          [series, interval, [...months.keys()], [...months.values()].map((bars) => JSON.stringify(bars))],
        )
      }
      await client.query(
        `INSERT INTO price_series (series, interval, from_ms, fetched_at) VALUES ($1,$2,$3,$4)
         ON CONFLICT (series, interval) DO UPDATE SET from_ms = excluded.from_ms, fetched_at = excluded.fetched_at`,
        [series, interval, Math.round(stored.from), new Date(stored.fetchedAt).toISOString()],
      )
    })
  },
}

// What the searches found for each ticker, kept so the same ticker is not searched for again for every account.
export const candidateStore: CandidateStore = {
  async load(ticker) {
    const row = (await query(`SELECT found, fetched_at FROM ticker_searches WHERE ticker = $1`, [ticker])).rows[0]
    return row ? { ...row.found, fetchedAt: new Date(row.fetched_at).getTime() } : null
  },

  async save(ticker, search) {
    await query(
      `INSERT INTO ticker_searches (ticker, found, fetched_at) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (ticker) DO UPDATE SET found = excluded.found, fetched_at = excluded.fetched_at`,
      [ticker, JSON.stringify({ yahoo: search.yahoo, pools: search.pools }), new Date(search.fetchedAt).toISOString()],
    )
  },
}
