import type { Metadata } from 'next'
import { AssetBoard } from '../../../components/AssetBoard'
import { ProfileAutoRefresh } from '../../../components/ProfileAutoRefresh'
import { Avatar } from '../../../components/Avatar'
import { apiGet } from '../../../lib/api'
import { formatNumber, formatPct } from '../../../lib/format'
import { buildAssetRows, formatDate, HORIZONS, money, parseHorizon, recentResults, resultCurve, type Horizon, type Scorecard } from '../../../lib/scorecard'
import { HoldControl, HoldQuestion } from '../../../components/HoldSentence'
import { ResultCurve } from '../../../components/ResultCurve'
import { Streak } from '../../../components/Streak'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params
  const scorecard = await loadScorecard(handle).catch(() => null)
  const displayHandle = scorecard?.user.handle ?? handle.replace(/^@/, '')
  const title = scorecard
    ? `${scorecard.user.name} (@${scorecard.user.handle}) on Called It`
    : `@${displayHandle} on Called It`
  const description = scorecard
    ? `$1,000 into each public call became ${money(scorecard.user.avg_return_30d ?? 0)} 30 days later.`
    : 'Find the traders who spotted the move early.'
  const image = `/u/${encodeURIComponent(displayHandle)}/opengraph-image?v=${shareImageVersion(scorecard)}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      images: [{ url: image, width: 2400, height: 1260, alt: `${title} share card` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

export default async function Profile({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ h?: string }> }) {
  const { handle } = await params
  const horizon = parseHorizon((await searchParams).h)
  const data = await loadScorecard(handle)
  data.calls ??= []
  const user = data.user

  return (
    <main className="calls-page">
      <ProfileHead data={data} horizon={horizon} />

      <AssetBoard
        assetRows={buildAssetRows(data)}
        handle={user.handle}
        horizon={horizon}
        updatedLabel={data.scan?.finished_at ? `Updated ${formatDate(data.scan.finished_at)}` : 'Scanning'}
      />
      <ProfileAutoRefresh
        handle={user.handle}
        computedAt={user.computed_at ?? null}
        enabled={shouldAutoRefresh(data)}
      />
    </main>
  )
}

async function loadScorecard(handle: string) {
  const data = await apiGet<Scorecard>(`/api/users/${encodeURIComponent(handle)}?tweets=0`)
  data.calls ??= []
  data.assets ??= []
  return data
}

// The one-glance answer: what following this account's calls returned at this horizon.
function ProfileHead({ data, horizon }: { data: Scorecard; horizon: Horizon }) {
  const { user } = data
  const calls = user[`calls_${horizon}d`] ?? 0
  const wins = Math.round((user[`hit_rate_${horizon}d`] ?? 0) * calls)
  const avg = user[`avg_return_${horizon}d`] ?? 0
  const firstCall = data.calls.map((call) => call.first_pitch_at).sort()[0]
  const since = firstCall ? new Date(firstCall).toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : undefined

  return (
    <section className="profile-head" aria-label="Profile">
      <div className="profile-id">
        <Avatar src={user.avatar_url} name={user.name} />
        <div>
          <h1>{user.name}</h1>
          <p>@{user.handle} · {formatNumber(user.followers)} followers</p>
        </div>
      </div>
      <div className="profile-hold">
        <HoldQuestion horizon={horizon} since={since} />
        <HoldControl horizon={horizon} hrefFor={(days) => `/u/${user.handle}?h=${days}`} />
      </div>
      <div className="profile-hero">
        <div className="profile-result">
          <div>
            <span className="label">$1,000 became, after {horizon} days</span>
            {calls > 0 ? (
              <>
                <b className={`profile-money ${avg >= 0 ? 'good' : 'bad'}`}>{money(avg)}</b>
                <span className={`profile-delta ${avg >= 0 ? 'good' : 'bad'}`}>{formatPct(avg)} per call</span>
              </>
            ) : (
              <>
                <b className="profile-money">-</b>
                <p>No call is {horizon} days old yet.</p>
              </>
            )}
          </div>
          <dl className="profile-figures">
            <div>
              <dt>Wins-losses</dt>
              <dd>{calls > 0 ? `${wins}-${calls - wins}` : '-'}</dd>
            </div>
            <div>
              <dt>Win rate</dt>
              <dd>{calls > 0 ? `${Math.round((wins / calls) * 100)}%` : '-'}</dd>
            </div>
          </dl>
          <div>
            <span className="label">Last 10 calls</span>
            <Streak results={recentResults(data.calls, horizon)} />
          </div>
        </div>
        <div className="profile-curve">
          <span className="label">Running result after each call</span>
          <ResultCurve points={resultCurve(data.calls, horizon)} />
        </div>
      </div>
    </section>
  )
}

function shareImageVersion(data: Scorecard | null) {
  if (!data) return 'pending'
  const { user } = data
  return encodeURIComponent([
    user.computed_at ?? data.scan?.finished_at ?? 'pending',
    ...HORIZONS.flatMap((days) => [user[`calls_${days}d`] ?? 0, Math.round((user[`avg_return_${days}d`] ?? 0) * 10000)]),
  ].join(':'))
}

function shouldAutoRefresh(data: Scorecard) {
  return Boolean(data.refresh?.price?.stale || data.refresh?.jobs?.priceRefresh || data.refresh?.jobs?.fullScan)
}
