import { Leaderboard, type LeaderboardRow } from '../components/Leaderboard'
import { ScanBox } from '../components/ScanBox'
import { apiGet } from '../lib/api'

export default async function Home({ searchParams }: { searchParams: Promise<{ sort?: string; q?: string }> }) {
  const params = await searchParams
  const sort = params.sort === 'hitrate' ? 'hitrate' : 'return'
  const initialHandle = typeof params.q === 'string' ? params.q : ''
  const data = await apiGet<{ leaderboard: LeaderboardRow[] }>(`/api/leaderboard?sort=${sort}&limit=100&offset=0`).catch(() => ({ leaderboard: [] }))
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
        {data.leaderboard.length ? <Leaderboard initialRows={data.leaderboard} sort={sort} /> : (
          <div className="empty home-empty">
            <a href="#scan">No ranked traders yet.</a>
            <p>Run the first scan and get someone on the board.</p>
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
