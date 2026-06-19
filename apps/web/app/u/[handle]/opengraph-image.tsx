import { ImageResponse } from 'next/og'
import { apiGet } from '../../../lib/api'
import { formatNumber, formatPct } from '../../../lib/format'
import { buildAssetRows, formatDate, topShareRows, type Scorecard, type ShareCallRow } from '../../../lib/scorecard'

export const runtime = 'nodejs'
export const alt = 'Called It scorecard share card'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const COLORS = {
  yellow: '#ffc20f',
  ink: '#171717',
  paper: '#fffdf4',
  paperSoft: '#f7efe0',
  muted: '#6a6049',
  green: '#138d46',
  red: '#c0392b',
}

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const data = await loadScorecard(handle).catch(() => null)

  if (!data) {
    return new ImageResponse(<FallbackCard handle={handle} />, size)
  }

  const rows = topShareRows(buildAssetRows(data), 3)
  const avatar = await loadAvatar(data.user.avatar_url).catch(() => null)

  return new ImageResponse(<ShareCard data={data} rows={rows} avatar={avatar} />, {
    ...size,
    headers: {
      'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
    },
  })
}

async function loadScorecard(handle: string) {
  const data = await apiGet<Scorecard>(`/api/users/${encodeURIComponent(handle)}?tweets=0`)
  data.calls ??= []
  data.assets ??= []
  return data
}

async function loadAvatar(avatarUrl: string | null) {
  if (!avatarUrl) return null
  let url: URL
  try {
    url = new URL(avatarUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null

  const allowedHosts = new Set(['pbs.twimg.com', 'abs.twimg.com', 'ton.twimg.com', 'pbs.twimg.com.cdn.cloudflare.net'])
  if (!allowedHosts.has(url.hostname)) return null

  const response = await fetch(url.toString(), {
    headers: { accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
    cache: 'no-store',
  })
  if (!response.ok) return null
  const contentType = response.headers.get('content-type') ?? 'image/jpeg'
  if (!contentType.startsWith('image/')) return null
  const buffer = Buffer.from(await response.arrayBuffer())
  return `data:${contentType};base64,${buffer.toString('base64')}`
}

function ShareCard({ data, rows, avatar }: { data: Scorecard; rows: ShareCallRow[]; avatar: string | null }) {
  const user = data.user
  const displayName = fitText(user.name || user.handle, 28)

  return (
    <div style={rootStyle}>
      <div style={frameStyle}>
        <div style={topRowStyle}>
          <div style={brandStyle}>Called It</div>
          <div style={taglineStyle}>Find the traders who spotted the move early.</div>
        </div>

        <div style={profileRowStyle}>
          <AvatarBlock avatar={avatar} name={user.name} />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <div style={nameStyle}>{displayName}</div>
            <div style={handleStyle}>@{user.handle} · {formatNumber(user.followers)} followers</div>
          </div>
          <div style={statsGridStyle}>
            <Stat label="Avg move" value={formatPct(user.avg_return ?? 0)} tone={(user.avg_return ?? 0) >= 0 ? 'good' : 'bad'} />
            <Stat label="Median" value={formatPct(user.median_return ?? 0)} tone={(user.median_return ?? 0) >= 0 ? 'good' : 'bad'} />
            <Stat label="Hit rate" value={`${Math.round((user.hit_rate ?? 0) * 100)}%`} />
            <Stat label="Hits" value={`${user.calls_up}/${user.calls_total}`} />
          </div>
        </div>

        <div style={callsWrapStyle}>
          <div style={callsHeaderStyle}>Best public calls</div>
          <div style={callsListStyle}>
            {rows.length ? rows.map((row, index) => (
              <CallRow key={`${row.asset}-${row.firstPitchAt}`} index={index} row={row} />
            )) : (
              <div style={emptyStyle}>No priced calls yet.</div>
            )}
          </div>
        </div>

        <div style={footerStyle}>calledit.site/u/{user.handle}</div>
      </div>
    </div>
  )
}

function FallbackCard({ handle }: { handle: string }) {
  return (
    <div style={rootStyle}>
      <div style={frameStyle}>
        <div style={brandStyle}>Called It</div>
        <div style={{ display: 'flex', marginTop: 56, fontSize: 72, fontWeight: 900, lineHeight: 1.06 }}>
          @{handle.replace(/^@/, '')}
        </div>
        <div style={{ display: 'flex', marginTop: 18, color: COLORS.muted, fontSize: 32, fontWeight: 800 }}>
          Scorecard not found yet.
        </div>
      </div>
    </div>
  )
}

function AvatarBlock({ avatar, name }: { avatar: string | null; name: string }) {
  return (
    <div style={avatarStyle}>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" width={92} height={92} style={{ width: 92, height: 92, objectFit: 'cover' }} />
      ) : (
        <span style={{ display: 'flex', fontSize: 42, fontWeight: 900 }}>{(name || '?').slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? COLORS.green : tone === 'bad' ? COLORS.red : COLORS.ink
  return (
    <div style={statStyle}>
      <span style={statLabelStyle}>{label}</span>
      <b style={{ display: 'flex', color, fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{value}</b>
    </div>
  )
}

function CallRow({ index, row }: { index: number; row: ShareCallRow }) {
  const toneColor = row.returnPct >= 0 ? COLORS.green : COLORS.red
  return (
    <div style={callRowStyle}>
      <div style={rankStyle}>#{index + 1}</div>
      <div style={{
        ...actionStyle,
        color: row.direction === 'BEAR' ? COLORS.red : COLORS.green,
        backgroundColor: row.direction === 'BEAR' ? '#fde8e5' : '#e1f7e9',
      }}>{row.action}</div>
      <div style={tickerStyle}>{row.asset}</div>
      <div style={{ display: 'flex', marginLeft: 'auto', color: toneColor, fontSize: 36, fontWeight: 900 }}>
        {formatPct(row.returnPct)}
      </div>
      <div style={dateStyle}>First mentioned {formatDate(row.firstPitchAt)}</div>
    </div>
  )
}

function fitText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value
}

const rootStyle = {
  width: '100%',
  height: '100%',
  display: 'flex',
  padding: 28,
  backgroundColor: COLORS.yellow,
  color: COLORS.ink,
  fontFamily: 'Arial, Helvetica, sans-serif',
} as const

const frameStyle = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  padding: '26px 38px 22px',
  border: `8px solid ${COLORS.ink}`,
  borderRadius: 30,
  backgroundColor: COLORS.paper,
  boxShadow: `10px 12px 0 ${COLORS.ink}`,
} as const

const topRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 22,
} as const

const brandStyle = {
  display: 'flex',
  padding: '8px 18px 6px',
  border: `5px solid ${COLORS.ink}`,
  borderRadius: 12,
  backgroundColor: COLORS.paper,
  fontSize: 38,
  fontWeight: 900,
  lineHeight: 1,
} as const

const taglineStyle = {
  display: 'flex',
  color: COLORS.muted,
  fontSize: 21,
  fontWeight: 900,
} as const

const profileRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  marginTop: 20,
  padding: 14,
  border: `4px solid ${COLORS.ink}`,
  borderRadius: 18,
  backgroundColor: COLORS.paperSoft,
} as const

const avatarStyle = {
  width: 92,
  height: 92,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  border: `4px solid ${COLORS.ink}`,
  borderRadius: 16,
  backgroundColor: COLORS.paper,
  flexShrink: 0,
} as const

const nameStyle = {
  display: 'flex',
  fontSize: 42,
  fontWeight: 900,
  lineHeight: 1,
  whiteSpace: 'nowrap',
} as const

const handleStyle = {
  display: 'flex',
  marginTop: 7,
  color: COLORS.muted,
  fontSize: 21,
  fontWeight: 900,
} as const

const statsGridStyle = {
  display: 'flex',
  width: 438,
  height: 92,
  border: `3px solid ${COLORS.ink}`,
  borderRadius: 14,
  overflow: 'hidden',
  backgroundColor: COLORS.paper,
  flexShrink: 0,
} as const

const statStyle = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  width: '25%',
  borderRight: `1px solid rgba(24,24,24,.24)`,
  gap: 7,
} as const

const statLabelStyle = {
  display: 'flex',
  color: COLORS.muted,
  fontSize: 13,
  fontWeight: 900,
  textTransform: 'uppercase',
} as const

const callsWrapStyle = {
  display: 'flex',
  flexDirection: 'column',
  marginTop: 16,
  border: `4px solid ${COLORS.ink}`,
  borderRadius: 18,
  overflow: 'hidden',
} as const

const callsHeaderStyle = {
  display: 'flex',
  padding: '10px 18px',
  backgroundColor: COLORS.ink,
  color: COLORS.paper,
  fontSize: 22,
  fontWeight: 900,
} as const

const callsListStyle = {
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: COLORS.paper,
} as const

const callRowStyle = {
  height: 68,
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '0 18px',
  borderTop: `2px solid rgba(24,24,24,.18)`,
} as const

const rankStyle = {
  width: 48,
  height: 38,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `3px solid ${COLORS.ink}`,
  borderRadius: 10,
  backgroundColor: COLORS.yellow,
  fontSize: 19,
  fontWeight: 900,
  flexShrink: 0,
} as const

const actionStyle = {
  minWidth: 70,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `3px solid currentColor`,
  borderRadius: 8,
  fontSize: 17,
  fontWeight: 900,
  flexShrink: 0,
} as const

const tickerStyle = {
  display: 'flex',
  color: COLORS.green,
  fontSize: 29,
  fontWeight: 900,
  minWidth: 126,
} as const

const dateStyle = {
  width: 238,
  display: 'flex',
  justifyContent: 'flex-end',
  color: COLORS.muted,
  fontSize: 17,
  fontWeight: 900,
  textAlign: 'right',
  flexShrink: 0,
} as const

const emptyStyle = {
  display: 'flex',
  padding: 28,
  color: COLORS.muted,
  fontSize: 25,
  fontWeight: 900,
} as const

const footerStyle = {
  display: 'flex',
  marginTop: 'auto',
  justifyContent: 'flex-end',
  color: COLORS.muted,
  fontSize: 16,
  fontWeight: 900,
} as const
