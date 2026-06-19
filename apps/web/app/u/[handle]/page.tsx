import type { Metadata } from 'next'
import { ProfileTradeContext } from '../../../components/ProfileTradeContext'
import { Avatar } from '../../../components/Avatar'
import { apiGet } from '../../../lib/api'
import { formatNumber, formatPct } from '../../../lib/format'
import { buildAssetRows, formatDate, topShareRows, type Scorecard, type ShareCallRow } from '../../../lib/scorecard'

const SITE_URL = 'https://www.calledit.site'
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params
  const scorecard = await loadScorecard(handle).catch(() => null)
  const displayHandle = scorecard?.user.handle ?? handle.replace(/^@/, '')
  const title = scorecard
    ? `${scorecard.user.name} (@${scorecard.user.handle}) on Called It`
    : `@${displayHandle} on Called It`
  const description = scorecard
    ? `${formatPct(scorecard.user.avg_return ?? 0)} avg move, ${Math.round((scorecard.user.hit_rate ?? 0) * 100)}% hit rate across public ticker calls.`
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

export default async function Profile({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const data = await loadScorecard(handle)
  data.calls ??= []
  const user = data.user
  const assetRows = buildAssetRows(data)
  const shareRows = topShareRows(assetRows, 3)

  return (
    <main className="calls-page">
      <header className="calls-header">
        <div className="profile-header-copy">
          <a className="calls-logo" href="/">Called It</a>
        </div>
      </header>

      <ShareImageCard data={data} rows={shareRows} />

      <ProfileTradeContext
        assetRows={assetRows}
        handle={user.handle}
        updatedLabel={data.scan?.finished_at ? `Updated ${formatDate(data.scan.finished_at)}` : 'Scanning 30D'}
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

function ShareImageCard({ data, rows }: { data: Scorecard; rows: ShareCallRow[] }) {
  const { user } = data
  const profileUrl = `${SITE_URL}/u/${encodeURIComponent(user.handle)}`
  const imageUrl = `/u/${encodeURIComponent(user.handle)}/opengraph-image?v=${shareImageVersion(data)}`
  const shareText = [
    `${user.name}'s Called It scorecard`,
    `${formatPct(user.avg_return ?? 0)} avg move · ${Math.round((user.hit_rate ?? 0) * 100)}% hit rate`,
    rows[0] ? `Best call: ${rows[0].action} ${rows[0].asset} ${formatPct(rows[0].returnPct)}` : null,
  ].filter(Boolean).join('\n')
  const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`

  return (
    <section className="share-image-shell" aria-label="Share card">
      <div className="share-image-copy">
        <div>
          <h2>Share card</h2>
          <p>Top stats and the best 3 calls, built for the X preview.</p>
        </div>
        <div className="share-image-actions">
          <a href={xShareUrl} target="_blank" rel="noreferrer">Share on X</a>
          <a href={imageUrl} download={`called-it-${user.handle}-scorecard-2x.png`}>Download image</a>
        </div>
      </div>
      <div className="share-image-card">
        <div className="share-card-brand">Called It</div>
        <div className="share-card-main">
          <div className="share-card-profile">
            <Avatar src={user.avatar_url} name={user.name} />
            <div>
              <h3>{user.name}</h3>
              <p>@{user.handle} · {formatNumber(user.followers)} followers</p>
            </div>
          </div>
          <div className="share-card-stats">
            <ShareStat label="Avg move" value={formatPct(user.avg_return ?? 0)} tone={(user.avg_return ?? 0) >= 0 ? 'good' : 'bad'} />
            <ShareStat label="Median" value={formatPct(user.median_return ?? 0)} tone={(user.median_return ?? 0) >= 0 ? 'good' : 'bad'} />
            <ShareStat label="Hit rate" value={`${Math.round((user.hit_rate ?? 0) * 100)}%`} />
            <ShareStat label="Hits" value={`${user.calls_up}/${user.calls_total}`} />
          </div>
        </div>
        <div className="share-card-calls">
          {rows.length ? rows.map((row, index) => (
            <div className="share-card-call" key={`${row.asset}-${row.direction}-${row.firstPitchAt}`}>
              <span className="share-card-rank">#{index + 1}</span>
              <span className={`share-card-action ${row.direction === 'BEAR' ? 'bear' : 'bull'}`}>{row.action}</span>
              <b>{row.asset}</b>
              <strong className={row.returnPct >= 0 ? 'good' : 'bad'}>{formatPct(row.returnPct)}</strong>
              <small>First mentioned {formatDate(row.firstPitchAt)}</small>
            </div>
          )) : (
            <p className="share-card-empty">No priced calls yet.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function ShareStat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div>
      <span>{label}</span>
      <b className={tone}>{value}</b>
    </div>
  )
}

function shareImageVersion(data: Scorecard | null) {
  if (!data) return 'pending'
  const { user } = data
  const stamp = user.computed_at ?? data.scan?.finished_at ?? 'pending'
  return encodeURIComponent([
    stamp,
    user.calls_up ?? 0,
    user.calls_total ?? 0,
    Math.round((user.avg_return ?? 0) * 10000),
    Math.round((user.median_return ?? 0) * 10000),
  ].join(':'))
}
