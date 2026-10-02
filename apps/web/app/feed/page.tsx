import type { Metadata } from 'next'
import { Avatar } from '../../components/Avatar'
import { HoldControl } from '../../components/HoldSentence'
import { LivePrice, LiveSince, type LiveCall } from '../../components/LiveSince'
import { API_URL, apiGet } from '../../lib/api'
import { buildIdeas, instrumentLabel, rankIdeas, repeatLabel, timeAgo, weekSummary, type FeedAccount, type FeedCall, type FeedCaller, type FeedIdea, type FeedRank } from '../../lib/feed'
import { money, parseHorizon, type Horizon } from '../../lib/scorecard'

export const metadata: Metadata = { title: 'Feed - Called It' }

const RANKS: { value: FeedRank; label: string }[] = [
  { value: 'called', label: 'Most called' },
  { value: 'record', label: 'Best record' },
  { value: 'new', label: 'New ideas' },
  { value: 'contested', label: 'Contested' },
]
const SPARK = { width: 132, height: 34, pad: 3 }

// Where an asset trades now, and the Hyperliquid coin that quotes it live, where there is one.
type FeedLive = { coin: string | null; price: number }
type View = { horizon: Horizon; rank: FeedRank }
// Daily closes as [time, close], oldest first.
type Prices = [number, number][]
// `summaries` holds what the accounts behind an asset are saying, where one has been written.
type FeedData = { calls: FeedCall[]; accounts: FeedAccount[]; prices: Record<string, Prices>; live?: Record<string, FeedLive>; summaries?: Record<string, string> }

export default async function Feed({ searchParams }: { searchParams: Promise<{ h?: string; rank?: string }> }) {
  const params = await searchParams
  const view: View = {
    horizon: parseHorizon(params.h),
    rank: RANKS.find((rank) => rank.value === params.rank)?.value ?? 'called',
  }
  const empty: FeedData = { calls: [], accounts: [], prices: {} }
  const data = API_URL ? await apiGet<FeedData>(`/api/feed?h=${view.horizon}`).catch(() => empty) : empty
  const accounts = new Map(data.accounts.map((account) => [account.handle, account]))
  const summary = weekSummary(data.calls)
  const everyIdea = buildIdeas(data.calls)
  const ideas = rankIdeas(everyIdea, view.rank)
  // Tickers that this week mean more than one instrument: their rows say which one they are.
  const shared = new Set(everyIdea.map((idea) => idea.asset).filter((asset, index, all) => all.indexOf(asset) !== index))
  const now = Date.now()

  return (
    <main className="home-page">
      <section className="home-board">
        <div className="home-board-head">
          <div>
            <h2>This week&apos;s calls</h2>
            <p className="hold-question">
              {summary.calls ? (
                <>
                  <b>{plural(summary.accounts, 'account')}</b> made <b>{plural(summary.calls, 'call')}</b> on <b>{plural(summary.assets, 'asset')}</b>: <b>{summary.bullish} bullish</b>, <b>{summary.bearish} bearish</b>.
                </>
              ) : 'What the accounts we track are calling this week, and how their calls on it have done before.'}
            </p>
          </div>
          <div className="feed-controls">
            <div className="hold-control">
              <span className="label">Rank by</span>
              <nav className="sorts" aria-label="Rank by">
                {RANKS.map(({ value, label }) => (
                  <a key={value} href={feedHref({ ...view, rank: value })} className={value === view.rank ? 'active' : undefined} aria-current={value === view.rank ? 'true' : undefined}>{label}</a>
                ))}
              </nav>
            </div>
            <HoldControl horizon={view.horizon} hrefFor={(days) => feedHref({ ...view, horizon: days })} />
          </div>
        </div>
        {!API_URL ? (
          <div className="empty home-empty"><p>Live data is unavailable in this preview.</p></div>
        ) : ideas.length ? ideas.map((idea, index) => (
          <Idea key={idea.key} idea={idea} rank={index + 1} accounts={accounts} prices={data.prices[idea.key] ?? []} live={data.live?.[idea.key]} summary={data.summaries?.[idea.key]} shared={shared.has(idea.asset)} horizon={view.horizon} now={now} />
        )) : (
          <div className="empty home-empty">
            <p>{summary.calls ? 'Nothing this week fits this ranking.' : 'No calls in the past week yet.'}</p>
          </div>
        )}
      </section>
    </main>
  )
}

function Idea({ idea, rank, accounts, prices, live, summary, shared, horizon, now }: { idea: FeedIdea; rank: number; accounts: Map<string, FeedAccount>; prices: Prices; live?: FeedLive; summary?: string; shared: boolean; horizon: Horizon; now: number }) {
  const name = (handle: string) => accounts.get(handle)?.name ?? handle
  // Until a summary is written the row quotes its best-placed caller: the one with the best record on this asset.
  const lead = idea.calls.find((call) => call.handle === idea.callers[0].handle) ?? idea.calls[0]
  const repeat = idea.callers.length === 1 ? repeatLabel(lead) : null
  return (
    <article className="feed-idea">
      <span className="feed-rank">{rank}</span>
      <div className="feed-idea-top">
        <b className="feed-ticker">{idea.asset}</b>
        {shared ? <span className="label">{instrumentLabel(idea)}</span> : null}
        <Lean idea={idea} />
        {repeat ? <span className="feed-flag">{repeat}</span> : null}
      </div>
      <Spark prices={prices} from={idea.firstCallAt} />
      <div className="feed-since">
        <LiveSince calls={idea.calls.map(liveCall)} coin={live?.coin} fallback={idea.since} />
        <small>{idea.calls.length === 1 ? 'since call' : 'since calls'}</small>
        {live ? <LivePrice coin={live.coin} fallback={live.price} /> : null}
      </div>
      {summary ? <p className="feed-quote">{cashtagged(summary)}</p> : (
        <blockquote className="feed-quote">
          {cashtagged(lead.text)}
          <cite>{name(lead.handle)}</cite>
        </blockquote>
      )}
      <div className="feed-callers">
        {idea.callers.map((caller) => <Caller key={caller.handle} caller={caller} account={accounts.get(caller.handle)} horizon={horizon} />)}
      </div>
      <details className="feed-posts">
        <summary>{plural(idea.calls.length, 'post')}</summary>
        {idea.calls.map((call) => (
          <div className="feed-post" key={call.tweet_id}>
            <b>{name(call.handle)}</b>
            <p>{cashtagged(call.text)}</p>
            <LiveSince calls={[liveCall(call)]} coin={live?.coin} fallback={call.return_pct} />
            <a href={call.url} target="_blank" rel="noreferrer" title={new Date(call.created_at).toUTCString()}>{timeAgo(call.created_at, now)} · View on X</a>
          </div>
        ))}
      </details>
    </article>
  )
}

// Which way the accounts behind the idea stand.
function Lean({ idea }: { idea: FeedIdea }) {
  const total = idea.callers.length
  if (idea.bulls && idea.bears) return <span className="stance-badge split">{idea.bulls} bullish, {idea.bears} bearish</span>
  const tone = idea.bulls ? 'bull' : 'bear'
  const word = idea.bulls ? 'bullish' : 'bearish'
  return <span className={`stance-badge ${tone}`}>{total === 1 ? word : `${total} of ${total} ${word}`}</span>
}

function Caller({ caller, account, horizon }: { caller: FeedCaller; account?: FeedAccount; horizon: Horizon }) {
  const bull = caller.direction === 'BULL'
  return (
    <a href={`/u/${caller.handle}?h=${horizon}`} className={`feed-chip ${bull ? 'bull' : 'bear'}`}>
      <Avatar src={account?.avatar_url} name={account?.name ?? caller.handle} />
      <b>{account?.name ?? caller.handle}</b>
      <i role="img" aria-label={bull ? 'bullish' : 'bearish'}>{bull ? '▲' : '▼'}</i>
      {caller.prior === 0 ? 'first call' : caller.avgReturn === null ? 'no result yet' : (
        <>
          {caller.wins}-{caller.losses} <span className={caller.avgReturn >= 0 ? 'good' : 'bad'}>{money(caller.avgReturn)}</span>
        </>
      )}
    </a>
  )
}

// Two weeks of closes: grey up to the first call, coloured after it by which way the price went, with a dot at the call.
function Spark({ prices, from }: { prices: Prices; from: string }) {
  if (prices.length < 2) return <span className="feed-spark" />
  const { width, height, pad } = SPARK
  const closes = prices.map(([, close]) => close)
  const low = Math.min(...closes)
  const span = Math.max(...closes) - low || 1
  const points = closes.map((close, index) => [
    pad + (index * (width - 2 * pad)) / (closes.length - 1),
    height - pad - ((close - low) / span) * (height - 2 * pad),
  ])
  const calledAt = new Date(from).getTime()
  const called = Math.max(0, prices.filter(([time]) => time <= calledAt).length - 1)
  const line = (part: number[][]) => part.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const rose = closes[closes.length - 1] >= closes[called]
  return (
    <svg className="feed-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Price ${rose ? 'up' : 'down'} since the first call`}>
      <polyline points={line(points.slice(0, called + 1))} className="before" />
      <polyline points={line(points.slice(called))} className={rose ? 'up' : 'down'} />
      <circle cx={points[called][0]} cy={points[called][1]} r="3" />
    </svg>
  )
}

function liveCall(call: FeedCall): LiveCall {
  return { entry: call.entry_price, direction: call.direction }
}

// The post with its tickers picked out. X's own shortened links are dropped: they point at media the feed does not show.
function cashtagged(text: string) {
  return text.replace(/\s*https:\/\/t\.co\/\w+/g, '').split(/(\$[A-Za-z][A-Za-z0-9._]{0,9})/).map((part, index) => (index % 2 ? <b key={`${index}-${part}`}>{part}</b> : part))
}

function plural(count: number, noun: string) {
  return `${count.toLocaleString('en')} ${noun}${count === 1 ? '' : 's'}`
}

function feedHref({ horizon, rank }: View) {
  const query = new URLSearchParams()
  if (rank !== 'called') query.set('rank', rank)
  if (horizon !== 30) query.set('h', String(horizon))
  const search = query.toString()
  return search ? `/feed?${search}` : '/feed'
}
