import { ScanBox } from '../components/ScanBox'
import { apiGet } from '../lib/api'

type LeaderboardRow = {
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

export default async function Home({ searchParams }: { searchParams: Promise<{ sort?: string; q?: string }> }) {
  const params = await searchParams
  const sort = params.sort === 'hitrate' ? 'hitrate' : 'return'
  const initialHandle = typeof params.q === 'string' ? params.q : ''
  const data = await apiGet<{ leaderboard: LeaderboardRow[] }>(`/api/leaderboard?sort=${sort}`).catch(() => ({ leaderboard: [] }))
  return (
    <main className="home-page">
      <header className="home-header">
        <div className="home-hero-copy">
          <a className="home-logo" href="/">Called It</a>
          <h1>Find the traders who spotted the move early.</h1>
        </div>
        <div id="scan" className="home-hero-scan">
          <ScanBox initialHandle={initialHandle} className="home-scan" title={null} />
        </div>
      </header>

      <section className="home-board">
        <div className="home-board-head">
          <div>
            <h2>Leaderboard</h2>
            <p>Ranked by what happened after public ticker calls.</p>
          </div>
        </div>
        {data.leaderboard.length ? <Leaderboard rows={data.leaderboard} /> : (
          <div className="empty home-empty">
            <a href="#scan">No ranked traders yet.</a>
            <p>Run the first 30-day scan and get someone on the board.</p>
          </div>
        )}
      </section>
    </main>
  )
}

export function Header() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="site-title">Called It</h1>
          <p className="tagline">Post-mention price scorecards for public X ticker stances.</p>
        </div>
        <nav className="navlinks">
          <a href="/">Leaderboard</a>
        </nav>
      </header>
      <div className="ticker">$HYPE +24.1% &nbsp; $SOL -3.2% &nbsp; $SPCX +135.0% &nbsp; $NVDA +41.7% &nbsp; $BTC +18.4%</div>
    </>
  )
}

function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="leader-table-wrap">
      <table className="leader-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Trader</th>
            <th>Best mention</th>
            <th>Avg move</th>
            <th>Median move</th>
            <th>Mentions up</th>
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
                    <b>{row.name}</b>
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
                <span>Avg</span>
                <b className={row.avg_return >= 0 ? 'good' : 'bad'}>{formatPct(row.avg_return)}</b>
              </td>
              <td className="metric-cell">
                <span>Median</span>
                <b className={row.median_return >= 0 ? 'good' : 'bad'}>{formatPct(row.median_return)}</b>
              </td>
              <td className="hit-cell">
                <b>{row.calls_up}/{row.calls_total}</b>
                <span>mentions up ({formatWholePct(row.hit_rate)})</span>
                <i aria-hidden="true"><span style={{ width: `${hitRateWidth(row.hit_rate)}%` }} /></i>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Avatar({ src, name }: { src?: string | null; name: string }) {
  return <div className="avatar">{src ? <img src={src} alt="" /> : name.slice(0, 1).toUpperCase()}</div>
}

export function formatPct(value: number) {
  const pct = value * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

function formatWholePct(value: number) {
  return `${Math.round(value * 100)}%`
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(value || 0)
}

function normalizeTicker(value: string) {
  return `$${String(value ?? '').replace(/^\$+/, '').trim().toUpperCase()}`
}

function hitRateWidth(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value * 100)))
}
