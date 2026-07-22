import { Leaderboard, type LeaderboardRow } from '../components/Leaderboard'
import { ScanBox } from '../components/ScanBox'
import { API_URL, apiGet } from '../lib/api'

export default async function Home({ searchParams }: { searchParams: Promise<{ sort?: string; q?: string }> }) {
  const params = await searchParams
  const sort = params.sort === 'hitrate' ? 'hitrate' : 'return'
  const initialHandle = typeof params.q === 'string' ? params.q : ''
  const data = API_URL
    ? await apiGet<{ leaderboard: LeaderboardRow[] }>(`/api/leaderboard?sort=${sort}&limit=100&offset=0`).catch(() => ({ leaderboard: [] }))
    : { leaderboard: [] }
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

      <section className="home-description" aria-labelledby="project-description-title">
        <div className="home-description-copy">
          <p className="home-description-eyebrow">What Called It does</p>
          <h2 id="project-description-title">Turn public ticker calls into price-backed scorecards.</h2>
          <p>
            Called It is for anyone who wants to inspect how public bullish and bearish calls played out after they were posted.
          </p>
        </div>
        <ol className="home-description-steps">
          <li>
            <span aria-hidden="true">1</span>
            <div>
              <h3>Scan a public profile</h3>
              <p>Enter an X handle to review public stock and crypto ticker mentions from the past year.</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">2</span>
            <div>
              <h3>Identify the calls</h3>
              <p>Called It filters for high-conviction bullish or bearish stances and finds the supporting posts.</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">3</span>
            <div>
              <h3>Compare what happened</h3>
              <p>Price moves become direction-adjusted scorecards with call history and leaderboard placement.</p>
            </div>
          </li>
        </ol>
        <p className="home-description-note">
          A scorecard measures public directional calls, not a full portfolio, realized profit, or investment advice.
        </p>
      </section>

      <section className="home-board">
        <div className="home-board-head">
          <div>
            <h2>Leaderboard</h2>
            <p>Ranked by what happened after public ticker calls.</p>
          </div>
        </div>
        {!API_URL ? (
          <div className="empty home-empty">
            <p>Live data and scanning are unavailable in this preview.</p>
          </div>
        ) : data.leaderboard.length ? <Leaderboard initialRows={data.leaderboard} sort={sort} /> : (
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
