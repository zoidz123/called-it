'use client'

import { useState } from 'react'
import { Avatar } from './Avatar'
import { API_URL } from '../lib/api'
import { formatNumber, formatPct, formatWholePct } from '../lib/format'

export type LeaderboardRow = {
  handle: string
  name: string
  avatar_url: string | null
  followers: number
  avg_return: number
  median_return: number
  hit_rate: number
  calls_total: number
  calls_up: number
  featured_asset: string | null
  featured_direction: string | null
  featured_return: number | null
}

const PAGE_SIZE = 100

export function Leaderboard({ initialRows, sort }: { initialRows: LeaderboardRow[]; sort: 'return' | 'hitrate' }) {
  const [rows, setRows] = useState(initialRows)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(initialRows.length === PAGE_SIZE)

  async function showMore() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const url = `${API_URL}/api/leaderboard?sort=${sort}&limit=${PAGE_SIZE}&offset=${rows.length}`
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
              <th>Rank</th>
              <th>Trader</th>
              <th>Best mention</th>
              <th>Avg move</th>
              <th>Median move</th>
              <th>Hit rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr className={index < 3 ? 'leader-row podium' : 'leader-row'} key={row.handle}>
                <td className="rank-cell"><span>#{index + 1}</span></td>
                <td>
                  <a href={`/u/${row.handle}`} className="trader-cell">
                    <Avatar src={row.avatar_url} name={row.name} />
                    <span>
                      <b title={row.name}>{row.name}</b>
                      <em>@{row.handle}</em>
                      <small>{formatNumber(row.followers)} followers</small>
                    </span>
                  </a>
                </td>
                <td>
                  {row.featured_asset ? (
                    <a href={`/u/${row.handle}`} className="best-call">
                      <span>{row.featured_direction === 'BEAR' ? 'SELL' : 'BUY'} {normalizeTicker(row.featured_asset)}</span>
                      <b className={row.featured_return && row.featured_return < 0 ? 'bad' : 'good'}>{formatPct(row.featured_return ?? 0)}</b>
                    </a>
                  ) : (
                    <span className="muted">No clean read yet</span>
                  )}
                </td>
                <td className="metric-cell">
                  <b className={row.avg_return >= 0 ? 'good' : 'bad'}>{formatPct(row.avg_return)}</b>
                </td>
                <td className="metric-cell">
                  <b className={row.median_return >= 0 ? 'good' : 'bad'}>{formatPct(row.median_return)}</b>
                </td>
                <td className="hit-cell">
                  <b>{formatWholePct(row.hit_rate)}</b>
                  <span>{row.calls_up}/{row.calls_total} mentions up</span>
                  <i aria-hidden="true"><span style={{ width: `${hitRateWidth(row.hit_rate)}%` }} /></i>
                </td>
              </tr>
            ))}
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

function normalizeTicker(value: string) {
  return `$${String(value ?? '').replace(/^\$+/, '').trim().toUpperCase()}`
}

function hitRateWidth(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value * 100)))
}
