import { ImageResponse } from 'next/og'
import { apiGet } from '../../../../lib/api'
import { callResult, chartWindow, exitPrice, priceTicks, type ImageBar, type ImageCall } from '../../../../lib/callImage'
import { formatPct } from '../../../../lib/format'
import { formatDate, formatPrice, money, normalizeTicker, parseHorizon, type Horizon, type Scorecard } from '../../../../lib/scorecard'
import { COLORS, loadAvatar } from '../../../../lib/shareImage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Callout = ImageCall & { tweet_id: string; text: string }
type Thread = { callouts: Callout[]; prices: ImageBar[] }

// Drawn at 2x, the same as the scorecard image.
const SIZE = { width: 2400, height: 1260 }
const FRAME = { pad: 56, border: 3 }
const HEADER_HEIGHT = 124
const CAPTION_HEIGHT = 330
// The chart sits inside the frame, between the header and the caption.
const CHART = {
  width: SIZE.width - 2 * FRAME.pad - 2 * FRAME.border,
  height: SIZE.height - 2 * FRAME.pad - 2 * FRAME.border - HEADER_HEIGHT - CAPTION_HEIGHT,
}
// The plot leaves room above for the two flags, on the right for prices and underneath for dates.
const PLOT = { left: 28, top: 104, width: CHART.width - 28 - 176, height: CHART.height - 104 - 72 }
// Candles keep the chart's own green and red; the call's colours are the site's.
const CANDLE = { up: '#26a69a', down: '#ef5350' }
const SOFT = { good: '#e3f3e8', bad: '#fde7e5' }
// About three lines of the caption.
const MAX_TEXT = 150
const DAY_MS = 24 * 60 * 60 * 1000

// One post as an image: the price chart with every call by the account on it, this post's call picked out with
// what the price did next, and the post itself underneath.
export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const query = new URL(request.url).searchParams
  const asset = normalizeTicker(query.get('asset') ?? '')
  const horizon = parseHorizon(query.get('h') ?? undefined)

  const [thread, scorecard] = await Promise.all([
    apiGet<Thread>(`/api/users/${encodeURIComponent(handle)}/assets/${encodeURIComponent(asset)}`).catch(() => null),
    apiGet<Scorecard>(`/api/users/${encodeURIComponent(handle)}?tweets=0`).catch(() => null),
  ])
  const call = thread?.callouts.find((callout) => callout.tweet_id === query.get('post'))
  if (!thread || !scorecard || !call || thread.prices.length < 2) return new Response('Call not found', { status: 404 })

  const avatar = await loadAvatar(scorecard.user.avatar_url).catch(() => null)
  return new ImageResponse(
    <CallCard asset={asset} call={call} thread={thread} user={scorecard.user} avatar={avatar} horizon={horizon} />,
    { ...SIZE, headers: { 'cache-control': 'public, max-age=60, s-maxage=300' } },
  )
}

function CallCard({ asset, call, thread, user, avatar, horizon }: { asset: string; call: Callout; thread: Thread; user: Scorecard['user']; avatar: string | null; horizon: Horizon }) {
  const bull = call.direction === 'BULL'
  const result = callResult(call, horizon, thread.prices[thread.prices.length - 1].close)
  const won = result.value > 0
  const tone = won ? COLORS.green : result.value < 0 ? COLORS.red : COLORS.muted
  const text = call.text.replace(/\s*https:\/\/t\.co\/\w+/g, '').replace(/\s+/g, ' ').trim()

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', padding: FRAME.pad, backgroundColor: COLORS.yellow, color: COLORS.ink, fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', border: `${FRAME.border}px solid ${COLORS.edge}`, borderRadius: 10, backgroundColor: COLORS.paper, boxShadow: `8px 8px 0 ${COLORS.edge}`, overflow: 'hidden' }}>
        <div style={{ height: HEADER_HEIGHT, display: 'flex', alignItems: 'center', gap: 32, padding: '0 48px', borderBottom: `2px solid ${COLORS.paperSoft}` }}>
          <div style={{ display: 'flex', fontSize: 68, fontWeight: 700, letterSpacing: -1 }}>{asset}</div>
          <div style={{ display: 'flex', padding: '6px 22px', border: `3px solid ${bull ? COLORS.green : COLORS.red}`, borderRadius: 8, backgroundColor: bull ? SOFT.good : SOFT.bad, color: bull ? COLORS.green : COLORS.red, fontSize: 36, fontWeight: 600 }}>
            {bull ? 'Bullish post' : 'Bearish post'}
          </div>
          <div style={{ display: 'flex', color: COLORS.muted, fontSize: 38 }}>{`${formatDate(call.created_at)} at ${formatPrice(call.entry_price)}`}</div>
          <div style={{ display: 'flex', marginLeft: 'auto', fontSize: 56, fontWeight: 700, letterSpacing: -2 }}>Called It<span style={{ color: COLORS.accent }}>.</span></div>
        </div>

        <Chart call={call} thread={thread} result={result} />

        <div style={{ height: CAPTION_HEIGHT, display: 'flex', alignItems: 'center', gap: 40, padding: '0 48px', borderTop: `3px solid ${COLORS.edge}`, backgroundColor: COLORS.paperSoft }}>
          <div style={{ width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: `3px solid ${COLORS.edge}`, borderRadius: 10, backgroundColor: COLORS.paper }}>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" width={150} height={150} style={{ width: 150, height: 150, objectFit: 'cover' }} />
            ) : (
              <span style={{ display: 'flex', fontSize: 72, fontWeight: 600 }}>{(user.name || '?').slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
              <span style={{ display: 'flex', fontSize: 44, fontWeight: 700 }}>{fitText(user.name || user.handle, 26)}</span>
              <span style={{ display: 'flex', color: COLORS.muted, fontSize: 36 }}>{`@${user.handle}`}</span>
            </div>
            <div style={{ display: 'flex', fontSize: 46, lineHeight: 1.25 }}>{fitText(text, MAX_TEXT)}</div>
          </div>
          <div style={{ width: 560, display: 'flex', flexDirection: 'column', flexShrink: 0, gap: 6, paddingLeft: 44, borderLeft: `3px solid ${COLORS.edge}` }}>
            <span style={{ display: 'flex', color: COLORS.muted, fontSize: 32, letterSpacing: 3 }}>{result.days ? `${result.days} DAYS LATER` : 'SO FAR'}</span>
            <span style={{ display: 'flex', color: tone, fontSize: 124, fontWeight: 700, lineHeight: 1, letterSpacing: -3 }}>{formatPct(result.value)}</span>
            <span style={{ display: 'flex', fontSize: 36 }}>{`$1,000 became ${money(result.value)}`}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Chart({ call, thread, result }: { call: Callout; thread: Thread; result: { days: Horizon | null; value: number } }) {
  const entryAt = call.entry_at ?? call.created_at
  const shown = chartWindow(thread.prices, entryAt, result.days)
  const closed = exitPrice(call, result.value)
  const lows = [...shown.bars.map((bar) => bar.low), call.entry_price, closed]
  const highs = [...shown.bars.map((bar) => bar.high), call.entry_price, closed]
  const span = Math.max(...highs) - Math.min(...lows) || 1
  const low = Math.min(...lows) - span * 0.06
  const high = Math.max(...highs) + span * 0.06
  const slot = PLOT.width / shown.bars.length
  const x = (index: number) => PLOT.left + (index + 0.5) * slot
  const y = (price: number) => PLOT.top + ((high - price) / (high - low)) * PLOT.height
  const body = Math.max(4, slot * 0.62)
  const won = result.value > 0
  const tone = won ? COLORS.green : result.value < 0 ? COLORS.red : COLORS.muted

  const first = shown.bars[0].t
  const last = shown.bars[shown.bars.length - 1].t
  // Every other call by the account on this asset that falls on the drawn stretch, as a small dot.
  const others = thread.callouts.flatMap((other) => {
    const time = new Date(other.entry_at ?? other.created_at).getTime()
    if (other.tweet_id === call.tweet_id || time < first || time > last + DAY_MS) return []
    const index = shown.bars.findIndex((bar) => bar.t + DAY_MS > time)
    return index === -1 ? [] : [{ id: `${other.tweet_id}-${other.direction}`, cx: x(index), cy: y(other.entry_price), bull: other.direction === 'BULL' }]
  })

  const entry = { x: x(shown.entry), y: y(call.entry_price) }
  const exit = { x: x(shown.exit), y: y(closed) }
  const calledLabel = `Called here ${formatPrice(call.entry_price)}`
  const closedLabel = `${result.days ? `${result.days} days later` : 'Now'} ${formatPrice(closed)}`
  const dates = [0.08, 0.36, 0.64, 0.92].map((share) => Math.round(share * (shown.bars.length - 1)))

  return (
    <div style={{ position: 'relative', display: 'flex', width: CHART.width, height: CHART.height }}>
      <svg role="img" aria-label="Price chart" width={CHART.width} height={CHART.height} viewBox={`0 0 ${CHART.width} ${CHART.height}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        <rect x={entry.x} y={PLOT.top} width={Math.max(0, exit.x - entry.x)} height={PLOT.height} fill={won ? SOFT.good : SOFT.bad} opacity={0.6} />
        {priceTicks(low, high).map((tick) => (
          <line key={tick} x1={PLOT.left} x2={PLOT.left + PLOT.width} y1={y(tick)} y2={y(tick)} stroke={COLORS.paperSoft} strokeWidth={3} />
        ))}
        {shown.bars.map((bar, index) => {
          const color = bar.close >= bar.open ? CANDLE.up : CANDLE.down
          const top = y(Math.max(bar.open, bar.close))
          return (
            <g key={bar.t}>
              <line x1={x(index)} x2={x(index)} y1={y(bar.high)} y2={y(bar.low)} stroke={color} strokeWidth={3} />
              <rect x={x(index) - body / 2} y={top} width={body} height={Math.max(3, y(Math.min(bar.open, bar.close)) - top)} fill={color} />
            </g>
          )
        })}
        <line x1={entry.x} y1={entry.y} x2={exit.x} y2={exit.y} stroke={tone} strokeWidth={5} strokeDasharray="6 14" strokeLinecap="round" />
        {others.map((dot) => (
          <circle key={dot.id} cx={dot.cx} cy={dot.cy} r={13} fill={dot.bull ? '#12a150' : '#e5484d'} stroke={COLORS.paper} strokeWidth={5} />
        ))}
        <line x1={exit.x} y1={PLOT.top - 44} x2={exit.x} y2={exit.y} stroke={tone} strokeWidth={4} />
        <circle cx={exit.x} cy={exit.y} r={18} fill={COLORS.paper} stroke={tone} strokeWidth={8} />
        <line x1={entry.x} y1={entry.y - 78} x2={entry.x} y2={entry.y} stroke={COLORS.ink} strokeWidth={4} />
        <circle cx={entry.x} cy={entry.y} r={40} fill={call.direction === 'BULL' ? '#12a150' : '#e5484d'} opacity={0.22} />
        <circle cx={entry.x} cy={entry.y} r={25} fill={call.direction === 'BULL' ? '#12a150' : '#e5484d'} stroke={COLORS.ink} strokeWidth={8} />
      </svg>

      {priceTicks(low, high).map((tick) => (
        <div key={tick} style={{ position: 'absolute', left: PLOT.left + PLOT.width + 22, top: y(tick) - 21, display: 'flex', color: COLORS.muted, fontSize: 34 }}>{formatPrice(tick)}</div>
      ))}
      {dates.map((index) => (
        <div key={index} style={{ position: 'absolute', left: x(index) - 80, top: PLOT.top + PLOT.height + 18, width: 160, display: 'flex', justifyContent: 'center', color: COLORS.muted, fontSize: 34 }}>
          {new Date(shown.bars[index].t).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
        </div>
      ))}
      <Flag text={closedLabel} at={exit.x} top={PLOT.top - 96} color={tone} />
      <Flag text={calledLabel} at={entry.x} top={entry.y - 134} color={COLORS.ink} />
    </div>
  )
}

// A label over a point on the chart, kept inside the plot when the point is near an edge.
function Flag({ text, at, top, color }: { text: string; at: number; top: number; color: string }) {
  const width = text.length * 21 + 44
  const left = Math.min(PLOT.left + PLOT.width - width, Math.max(PLOT.left, at - width / 2))
  return (
    <div style={{ position: 'absolute', left, top: Math.max(4, top), width, height: 58, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: color, color: COLORS.paper, fontSize: 36, fontWeight: 600 }}>
      {text}
    </div>
  )
}

function fitText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}...` : value
}
