import { Leaderboard, type LeaderboardRow } from '../components/Leaderboard'
import { HoldControl, HoldQuestion } from '../components/HoldSentence'
import { parseHorizon } from '../lib/scorecard'
import { ScanBox } from '../components/ScanBox'
import { API_URL, apiGet } from '../lib/api'

export default async function Home({ searchParams }: { searchParams: Promise<{ sort?: string; q?: string }> }) {
  const params = await searchParams
  const horizon = parseHorizon(params.sort)
  const initialHandle = typeof params.q === 'string' ? params.q : ''
  const data = API_URL
    ? await apiGet<{ leaderboard: LeaderboardRow[] }>(`/api/leaderboard?sort=${horizon}d&limit=100&offset=0`).catch(() => ({ leaderboard: [] }))
    : { leaderboard: [] }
  return (
    <main className="home-page">
      <header className="home-header">
        <div className="home-hero-copy">
          <h1>Find the traders who spotted the move early.</h1>
          <p>Scan any X account to see what following its public ticker calls would have returned.</p>
        </div>
        <div id="scan" className="home-hero-scan">
          <ScanBox initialHandle={initialHandle} className="home-scan" title={null} helperText="" />
        </div>
      </header>

      <section className="home-board">
        <div className="home-board-head">
          <div>
            <h2>Leaderboard</h2>
            <HoldQuestion horizon={horizon} />
          </div>
          <HoldControl horizon={horizon} hrefFor={(days) => `/?sort=${days}d`} />
        </div>
        {!API_URL ? (
          <div className="empty home-empty">
            <p>Live data and scanning are unavailable in this preview.</p>
          </div>
        ) : data.leaderboard.length ? <Leaderboard key={horizon} initialRows={data.leaderboard} horizon={horizon} /> : (
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
