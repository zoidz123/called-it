import { ImageResponse } from 'next/og'
import { apiGet } from '../../../lib/api'
import { formatNumber, formatPct } from '../../../lib/format'
import { formatDate, money, topShareRows, type Scorecard, type ShareCallRow } from '../../../lib/scorecard'
import { getSiteUrl } from '../../../lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const alt = 'Called It scorecard share card'
export const size = { width: 2400, height: 1260 }
export const contentType = 'image/png'

// The Pluto desk palette, at the 2x scale this image renders at.
const COLORS = {
  yellow: '#e9e9e4',
  ink: '#121212',
  edge: '#45453f',
  paper: '#ffffff',
  paperSoft: '#f4f4f0',
  muted: '#8e8e88',
  accent: '#2f5bff',
  green: '#1d7a3a',
  red: '#b3261e',
}

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const data = await loadScorecard(handle).catch(() => null)

  if (!data) {
    return new ImageResponse(<FallbackCard handle={handle} />, {
      ...size,
      headers: imageHeaders(handle),
    })
  }

  const rows = topShareRows(data.calls, 3)
  const avatar = await loadAvatar(data.user.avatar_url).catch(() => null)

  return new ImageResponse(<ShareCard data={data} rows={rows} avatar={avatar} />, {
    ...size,
    headers: imageHeaders(data.user.handle),
  })
}

function imageHeaders(handle: string) {
  const safeHandle = handle.replace(/^@/, '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() || 'scorecard'
  return {
    'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
    'content-disposition': `inline; filename="called-it-${safeHandle}-scorecard-2x.png"`,
  }
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
  const calls = user.calls_30d ?? 0
  const wins = Math.round((user.hit_rate_30d ?? 0) * calls)
  const avg = user.avg_return_30d ?? 0

  return (
    <div style={rootStyle}>
      <div style={frameStyle}>
        <div style={topRowStyle}>
          <div style={brandStyle}>Called It<span style={{ color: COLORS.accent }}>.</span></div>
          <div style={taglineStyle}>Find the traders who spotted the move early.</div>
        </div>

        <div style={profileRowStyle}>
          <AvatarBlock avatar={avatar} name={user.name} />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <div style={nameStyle}>{displayName}</div>
            <div style={handleStyle}>@{user.handle} · {formatNumber(user.followers)} followers</div>
          </div>
          <div style={statsGridStyle}>
            <Stat label="$1,000 became" value={calls > 0 ? money(avg) : '-'} tone={calls > 0 ? (avg >= 0 ? 'good' : 'bad') : undefined} />
            <Stat label="Average call" value={calls > 0 ? formatPct(avg) : '-'} tone={calls > 0 ? (avg >= 0 ? 'good' : 'bad') : undefined} />
            <Stat label="Wins-losses" value={`${wins}-${calls - wins}`} />
          </div>
        </div>

        <div style={callsWrapStyle}>
          <div style={callsHeaderStyle}>Best calls, 30 days later</div>
          <div style={callsListStyle}>
            {rows.length ? rows.map((row, index) => (
              <CallRow key={`${row.asset}-${row.firstPitchAt}`} index={index} row={row} />
            )) : (
              <div style={emptyStyle}>No call is 30 days old yet.</div>
            )}
          </div>
        </div>

        <div style={footerStyle}>{getSiteUrl().host}/u/{user.handle}</div>
      </div>
    </div>
  )
}

function FallbackCard({ handle }: { handle: string }) {
  return (
    <div style={rootStyle}>
      <div style={frameStyle}>
        <div style={brandStyle}>Called It<span style={{ color: COLORS.accent }}>.</span></div>
        <div style={{ display: 'flex', marginTop: 56, fontSize: 72, fontWeight: 600, lineHeight: 1.06 }}>
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
        <img src={avatar} alt="" width={184} height={184} style={{ width: 184, height: 184, objectFit: 'cover' }} />
      ) : (
        <span style={{ display: 'flex', fontSize: 84, fontWeight: 600 }}>{(name || '?').slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? COLORS.green : tone === 'bad' ? COLORS.red : COLORS.ink
  return (
    <div style={statStyle}>
      <span style={statLabelStyle}>{label}</span>
      <b style={{ display: 'flex', color, fontSize: 56, fontWeight: 600, lineHeight: 1 }}>{value}</b>
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
        backgroundColor: row.direction === 'BEAR' ? '#fde7e5' : '#e3f3e8',
      }}>{row.action}</div>
      <div style={tickerStyle}>{row.asset}</div>
      <div style={{ display: 'flex', marginLeft: 'auto', color: toneColor, fontSize: 72, fontWeight: 600 }}>
        {formatPct(row.returnPct)}
      </div>
      <div style={dateStyle}>Called {formatDate(row.firstPitchAt)}</div>
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
  padding: 56,
  backgroundColor: COLORS.yellow,
  color: COLORS.ink,
  fontFamily: 'Arial, Helvetica, sans-serif',
} as const

const frameStyle = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  padding: '52px 76px 44px',
  border: `3px solid ${COLORS.edge}`,
  borderRadius: 10,
  backgroundColor: COLORS.paper,
  boxShadow: `8px 8px 0 ${COLORS.edge}`,
} as const

const topRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 44,
} as const

const brandStyle = {
  display: 'flex',
  fontSize: 76,
  letterSpacing: -2,
  fontWeight: 600,
  lineHeight: 1,
} as const

const taglineStyle = {
  display: 'flex',
  color: COLORS.muted,
  fontSize: 42,
  fontWeight: 600,
} as const

const profileRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 36,
  marginTop: 40,
  padding: 28,
  border: `3px solid ${COLORS.edge}`,
  borderRadius: 10,
  backgroundColor: COLORS.paperSoft,
} as const

const avatarStyle = {
  width: 184,
  height: 184,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  border: `3px solid ${COLORS.edge}`,
  borderRadius: 10,
  backgroundColor: COLORS.paper,
  flexShrink: 0,
} as const

const nameStyle = {
  display: 'flex',
  fontSize: 84,
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: 'nowrap',
} as const

const handleStyle = {
  display: 'flex',
  marginTop: 14,
  color: COLORS.muted,
  fontSize: 42,
  fontWeight: 600,
} as const

const statsGridStyle = {
  display: 'flex',
  width: 876,
  height: 184,
  border: `3px solid ${COLORS.edge}`,
  borderRadius: 10,
  overflow: 'hidden',
  backgroundColor: COLORS.paper,
  flexShrink: 0,
} as const

const statStyle = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  width: '33.34%',
  borderRight: `2px solid rgba(24,24,24,.24)`,
  gap: 14,
} as const

const statLabelStyle = {
  display: 'flex',
  color: COLORS.muted,
  fontSize: 26,
  fontWeight: 600,
  textTransform: 'uppercase',
} as const

const callsWrapStyle = {
  display: 'flex',
  flexDirection: 'column',
  marginTop: 32,
  border: `3px solid ${COLORS.edge}`,
  borderRadius: 10,
  overflow: 'hidden',
} as const

const callsHeaderStyle = {
  display: 'flex',
  padding: '20px 36px',
  backgroundColor: COLORS.paperSoft,
  color: COLORS.muted,
  fontSize: 34,
  letterSpacing: 3,
  textTransform: 'uppercase',
  fontWeight: 600,
} as const

const callsListStyle = {
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: COLORS.paper,
} as const

const callRowStyle = {
  height: 136,
  display: 'flex',
  alignItems: 'center',
  gap: 28,
  padding: '0 36px',
  borderTop: `4px solid rgba(24,24,24,.18)`,
} as const

const rankStyle = {
  width: 96,
  height: 76,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `3px solid ${COLORS.edge}`,
  borderRadius: 10,
  backgroundColor: COLORS.paperSoft,
  fontSize: 38,
  fontWeight: 600,
  flexShrink: 0,
} as const

const actionStyle = {
  minWidth: 140,
  height: 64,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `3px solid currentColor`,
  borderRadius: 10,
  fontSize: 34,
  fontWeight: 600,
  flexShrink: 0,
} as const

const tickerStyle = {
  display: 'flex',
  color: COLORS.ink,
  fontSize: 58,
  fontWeight: 600,
  minWidth: 252,
} as const

const dateStyle = {
  width: 476,
  display: 'flex',
  justifyContent: 'flex-end',
  color: COLORS.muted,
  fontSize: 34,
  fontWeight: 600,
  textAlign: 'right',
  flexShrink: 0,
} as const

const emptyStyle = {
  display: 'flex',
  padding: 56,
  color: COLORS.muted,
  fontSize: 50,
  fontWeight: 600,
} as const

const footerStyle = {
  display: 'flex',
  marginTop: 'auto',
  justifyContent: 'flex-end',
  color: COLORS.muted,
  fontSize: 32,
  fontWeight: 600,
} as const
