'use client'

import { useState } from 'react'
import { Avatar } from './Avatar'
import { Streak } from './Streak'
import { API_URL } from '../lib/api'
import { formatPct } from '../lib/format'
import { money, type Horizon } from '../lib/scorecard'

export type LeaderboardRow = {
  handle: string
  name: string
  avatar_url: string | null
  followers: number
  avg_return_7d: number
  hit_rate_7d: number
  calls_7d: number
  avg_return_30d: number
  hit_rate_30d: number
  calls_30d: number
  avg_return_90d: number
  hit_rate_90d: number
  calls_90d: number
  recent: boolean[] | null
}

const PAGE_SIZE = 100

export function Leaderboard({ initialRows, horizon }: { initialRows: LeaderboardRow[]; horizon: Horizon }) {
  const [rows, setRows] = useState(initialRows)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(initialRows.length === PAGE_SIZE)

  async function showMore() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const url = `${API_URL}/api/leaderboard?sort=${horizon}d&limit=${PAGE_SIZE}&offset=${rows.length}`
      const payload = await fetch(url, { cache: 'no-store' }).then((res) => {
        if (!res.ok) throw new Error('Could not load more traders.')
        return res.json()
      })
      const nextRows: LeaderboardRow[] = payload.leaderboard ?? []
      setRows((current) => [...current, ...nextRows])
      setHasMore(nextRows.length === PAGE_SIZE)
    } catch {
      setError('Could not load more traders. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="leader-table-wrap">
        <table className="leader-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Trader</th>
              <th>$1,000 became</th>
              <th>Wins-losses</th>
              <th>Last 10 calls</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const avg = row[`avg_return_${horizon}d`]
              const calls = row[`calls_${horizon}d`]
              const wins = Math.round(row[`hit_rate_${horizon}d`] * calls)
              return (
                <tr className="leader-row" key={row.handle}>
                  <td className="rank-cell">{index + 1}</td>
                  <td>
                    <a href={`/u/${row.handle}?h=${horizon}`} className="trader-cell">
                      <Avatar src={row.avatar_url} name={row.name} />
                      <span>
                        <b title={row.name}>{row.name}</b>
                        <em>@{row.handle}</em>
                      </span>
                    </a>
                  </td>
                  <td className="money-cell">
                    <div>
                      <b className={avg >= 0 ? 'good' : 'bad'}>{money(avg)}</b>
                      <span className={avg >= 0 ? 'good' : 'bad'}>{formatPct(avg)}</span>
                    </div>
                  </td>
                  <td className="record-cell">{wins}-{calls - wins}</td>
                  <td><Streak results={row.recent ?? []} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {hasMore ? (
        <div className="leader-more-row">
          <button type="button" onClick={showMore} disabled={loading}>
            {loading ? 'Loading...' : 'Show more'}
          </button>
          {error ? <p role="status">{error}</p> : null}
        </div>
      ) : null}
    </>
  )
}
