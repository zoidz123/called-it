import type { FeedTweet } from '../../../components/TweetFeed'
import { ProfileTradeContext, type AssetRow, type PriceLeg } from '../../../components/ProfileTradeContext'
import { apiGet } from '../../../lib/api'
import { Avatar, formatPct } from '../../page'

type Scorecard = {
  user: {
    handle: string
    name: string
    avatar_url: string | null
    bio: string | null
    followers: number
    avg_return: number
    median_return: number
    hit_rate: number
    calls_total: number
    calls_up: number
    computed_at?: string
  }
  scan: null | {
    tweets_scanned: number
    candidates: number
    classified: number
    calls_found: number
    priced_calls: number
    finished_at: string
  }
  calls: {
    asset: string
    direction: 'BULL' | 'BEAR'
    asset_class: string
    first_pitch_at: string
    entry_price: number
    current_price: number
    return_pct: number
    mentions: number
    bulls: number
    bears: number
  }[]
  assets: {
    asset: string
    total: number
    bulls: number
    bears: number
    first_pitch_at: string
  }[]
  tweets: FeedTweet[]
}

export default async function Profile({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const data = await apiGet<Scorecard>(`/api/users/${encodeURIComponent(handle)}?tweets=0`)
  data.calls ??= []
  const user = data.user
  const profileBio = normalizeBio(user.bio)
  const assetRows = buildAssetRows(data)

  return (
    <main className="calls-page">
      <header className="calls-header">
        <div>
          <a className="calls-logo" href="/">Called It</a>
          <p>Track what happens after public stock and crypto ticker mentions.</p>
        </div>
      </header>

      <section className="calls-profile">
        <div className="calls-person">
          <Avatar src={user.avatar_url} name={user.name} />
          <div>
            <h1>{user.name} <span>@{user.handle}</span></h1>
            {profileBio ? <p>{profileBio}</p> : null}
          </div>
        </div>
        <dl className="calls-stats">
          <div>
            <dt>Avg Move</dt>
            <dd className={user.avg_return >= 0 ? 'good' : 'bad'}>{formatPct(user.avg_return ?? 0)}</dd>
          </div>
          <div>
            <dt>Median Move</dt>
            <dd className={user.median_return >= 0 ? 'good' : 'bad'}>{formatPct(user.median_return ?? 0)}</dd>
          </div>
          <div>
            <dt>Hit Rate</dt>
            <dd>{Math.round((user.hit_rate ?? 0) * 100)}%</dd>
          </div>
          <div>
            <dt>Mentions Up</dt>
            <dd>{user.calls_up}/{user.calls_total}</dd>
          </div>
        </dl>
      </section>

      <ProfileTradeContext
        assetRows={assetRows}
        handle={user.handle}
        updatedLabel={data.scan?.finished_at ? `Updated ${formatDate(data.scan.finished_at)}` : 'Scanning 30D'}
      />
    </main>
  )
}

function buildAssetRows(data: Scorecard): AssetRow[] {
  const callsByAsset = new Map<string, Scorecard['calls']>()
  for (const call of data.calls) {
    const ticker = normalizeTicker(call.asset)
    callsByAsset.set(ticker, [...(callsByAsset.get(ticker) ?? []), call])
  }

  const rowsFromCalls = [...callsByAsset.entries()].map(([ticker, calls]) => {
    const sortedCalls = calls
      .slice()
      .sort((a, b) => new Date(a.first_pitch_at).getTime() - new Date(b.first_pitch_at).getTime())
    const first = sortedCalls[0]
    return {
      id: ticker,
      asset: ticker,
      total: first?.mentions ?? 0,
      stanceLabel: sortedCalls.map((call) => call.direction).join(' -> '),
      firstPitchAt: first?.first_pitch_at ?? '',
      legs: buildPriceLegs(sortedCalls),
    }
  })

  const pricedAssets = new Set(rowsFromCalls.map((row) => row.asset))
  const unpricedRows = (data.assets ?? [])
    .filter((asset) => !pricedAssets.has(normalizeTicker(asset.asset)))
    .map((asset) => {
      const ticker = normalizeTicker(asset.asset)
      return {
        id: `${ticker}:UNPRICED`,
        asset: ticker,
        total: asset.total,
        stanceLabel: asset.bears > asset.bulls ? 'BEAR' : 'BULL',
        firstPitchAt: asset.first_pitch_at,
        legs: [],
      }
    })

  return [...rowsFromCalls, ...unpricedRows]
    .sort((a, b) => b.total - a.total || a.asset.localeCompare(b.asset))
}

function buildPriceLegs(calls: Scorecard['calls']): PriceLeg[] {
  return calls.map((call, index) => {
    const next = calls[index + 1]
    const endPrice = next?.entry_price ?? call.current_price
    const returnPct = call.direction === 'BULL'
      ? (endPrice - call.entry_price) / call.entry_price
      : (call.entry_price - endPrice) / call.entry_price
    return {
      id: `${call.asset}:${call.direction}:${call.first_pitch_at}`,
      direction: call.direction,
      startAt: call.first_pitch_at,
      endAt: next?.first_pitch_at ?? null,
      startPrice: call.entry_price,
      endPrice,
      returnPct,
      isCurrent: !next,
    }
  })
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function normalizeBio(value: string | null) {
  if (!value || value.toLowerCase().includes('cached prototype profile')) {
    return null
  }
  return value
}

function normalizeTicker(value: string) {
  return `$${String(value ?? '').replace(/^\$+/, '').trim().toUpperCase()}`
}
