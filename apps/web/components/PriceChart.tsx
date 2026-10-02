'use client'

import { CandlestickSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts'
import { useEffect, useRef, useState } from 'react'
import { chartColors } from '../lib/chartTheme'
import { formatPct } from '../lib/format'
import { formatDate, formatPrice, money, type Horizon } from '../lib/scorecard'

export type ChartBar = { t: number; open: number; high: number; low: number; close: number }
export type ChartCallout = {
  tweet_id: string
  direction: 'BULL' | 'BEAR'
  created_at: string
  entry_at: string | null
  entry_price: number
  return_7d: number | null
  return_30d: number | null
  return_90d: number | null
  text: string
}

type Spot = { callout: ChartCallout; x: number; y: number }

const day = (time: number | string) => new Date(time).toISOString().slice(0, 10)
// Past this many posts the dots shrink so the candles stay visible.
const DENSE_POSTS = 40

// Daily candles with every post as a dot at the price it was scored from: green for a bullish post, red for a bearish one.
// Hovering a dot shows the post, and clicking it selects that post in the thread.
export function PriceChart({
  bars,
  callouts,
  horizon,
  selectedId,
  onSelect,
}: {
  bars: ChartBar[]
  callouts: ChartCallout[]
  horizon: Horizon
  selectedId: string | null
  onSelect: (tweetId: string) => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const chartRef = useRef<{ chart: IChartApi; series: ISeriesApi<'Candlestick'>; days: string[] } | null>(null)
  const [spots, setSpots] = useState<Spot[]>([])
  const [pane, setPane] = useState({ width: 0, height: 0 })
  const [hover, setHover] = useState<Spot | null>(null)
  const posts = useRef(callouts)

  // The dots are HTML over the canvas, so they are re-placed whenever the chart's scales move.
  const place = useRef(() => {})
  place.current = () => {
    const current = chartRef.current
    if (!current) return
    const { chart, series, days } = current
    setPane(chart.paneSize())
    setSpots(posts.current.flatMap((callout) => {
      // A post sits on the candle of the day its entry price traded, or the next trading day if the market was shut.
      const entryDay = day(callout.entry_at ?? callout.created_at)
      const x = chart.timeScale().timeToCoordinate((days.find((candidate) => candidate >= entryDay) ?? days[days.length - 1]) as Time)
      const y = series.priceToCoordinate(callout.entry_price)
      return x === null || y === null ? [] : [{ callout, x, y }]
    }))
  }

  useEffect(() => {
    if (!frame.current || bars.length < 2) return
    // One candle per calendar day; a venue's live row can repeat today's date, so the last one wins.
    const candles = [...new Map(bars.map((bar) => [day(bar.t), { time: day(bar.t) as Time, open: bar.open, high: bar.high, low: bar.low, close: bar.close }])).values()]
    const last = candles[candles.length - 1].close
    const precision = last >= 1 ? 2 : Math.min(8, 2 - Math.floor(Math.log10(last)))
    const c = chartColors()
    const chart = createChart(frame.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: c.win }, textColor: c.mid, fontFamily: '"DM Mono", ui-monospace, monospace', fontSize: 11 },
      grid: { vertLines: { color: c.soft }, horzLines: { color: c.soft } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      handleScale: { axisPressedMouseMove: { time: true, price: true } },
      localization: { priceFormatter: formatPrice },
    })
    // Candles keep TradingView's standard green and red.
    const series = chart.addSeries(CandlestickSeries, {
      borderVisible: false,
      priceLineVisible: false,
      priceFormat: { type: 'price', precision, minMove: 10 ** -precision },
    })
    series.setData(candles)
    chart.timeScale().fitContent()
    chartRef.current = { chart, series, days: candles.map((candle) => String(candle.time)) }

    const replace = () => requestAnimationFrame(() => place.current())
    chart.timeScale().subscribeVisibleLogicalRangeChange(replace)
    const observer = new ResizeObserver(replace)
    observer.observe(frame.current)
    // The price scale settles on the first paint, one frame after the data is set.
    const settle = setTimeout(replace, 60)

    // Dragging the price axis rescales it, and the chart reports no event for that. The dots follow the pointer for
    // as long as a drag that began on the chart lasts, even once it leaves the chart, and follow the wheel.
    const canvas = frame.current
    let dragging = false
    const down = () => { dragging = true }
    const move = () => { if (dragging) replace() }
    const up = () => {
      if (!dragging) return
      dragging = false
      replace()
    }
    // A double click on the price axis returns it to automatic, which lands a frame later.
    const reset = () => setTimeout(replace, 60)
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('wheel', replace, { passive: true })
    canvas.addEventListener('dblclick', reset)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      clearTimeout(settle)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('wheel', replace)
      canvas.removeEventListener('dblclick', reset)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      chartRef.current = null
      chart.remove()
    }
  }, [bars])

  useEffect(() => {
    posts.current = callouts
    place.current()
  }, [callouts])

  if (bars.length < 2) return <p className="status-line">No price history for this chart.</p>

  const result = hover ? hover.callout[`return_${horizon}d`] : null
  const dense = callouts.length > DENSE_POSTS
  return (
    <div className="price-chart">
      <div className="price-chart-canvas" ref={frame} />
      <div className="chart-marks" style={{ width: pane.width, height: pane.height }}>
        {spots.map((spot) => (
          <button
            key={`${spot.callout.tweet_id}-${spot.callout.direction}`}
            type="button"
            className={`chart-mark ${spot.callout.direction === 'BULL' ? 'bull' : 'bear'}${dense ? ' small' : ''}${spot.callout.tweet_id === selectedId ? ' selected' : ''}`}
            style={{ left: spot.x, top: spot.y }}
            aria-label={`${spot.callout.direction === 'BULL' ? 'Bullish' : 'Bearish'} post on ${formatDate(spot.callout.created_at)} at ${formatPrice(spot.callout.entry_price)}`}
            onMouseEnter={() => setHover(spot)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(spot)}
            onBlur={() => setHover(null)}
            onClick={() => onSelect(spot.callout.tweet_id)}
          />
        ))}
      </div>
      {hover ? (
        <div
          className="chart-tip"
          style={{
            left: hover.x,
            top: hover.y,
            // Opens away from the nearest edges so it is never cut off.
            transform: `translate(${hover.x > pane.width / 2 ? 'calc(-100% - 24px)' : '0'}, ${hover.y > pane.height / 2 ? 'calc(-100% - 24px)' : '0'})`,
          }}
        >
          <header>
            <span className={`stance-badge ${hover.callout.direction === 'BULL' ? 'bull' : 'bear'}`}>{hover.callout.direction === 'BULL' ? 'Bullish' : 'Bearish'}</span>
            <span>{formatDate(hover.callout.created_at)} at {formatPrice(hover.callout.entry_price)}</span>
          </header>
          <p>{hover.callout.text}</p>
          <footer>
            {result === null ? `Not ${horizon} days old yet` : (
              <>
                <b className={result > 0 ? 'good' : 'bad'}>{formatPct(result)}</b> {horizon} days later · $1,000 became {money(result)}
              </>
            )}
          </footer>
        </div>
      ) : null}
    </div>
  )
}
