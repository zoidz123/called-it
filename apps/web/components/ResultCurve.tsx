'use client'

import { BaselineSeries, ColorType, createChart } from 'lightweight-charts'
import { useEffect, useRef, useState } from 'react'
import { chartColors } from '../lib/chartTheme'
import { formatPct } from '../lib/format'
import { formatDate, type ResultPoint } from '../lib/scorecard'

type Hover = { point: ResultPoint; x: number; y: number }

const dollars = (value: number) => `$${Math.round(value).toLocaleString('en')}`

// The running result of putting $1,000 into every call, in TradingView's standard colours: green above the starting
// $1,000, red below it. Hovering shows the value on that day and how many calls it covers.
export function ResultCurve({ points }: { points: ResultPoint[] }) {
  const frame = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<Hover | null>(null)

  useEffect(() => {
    if (!frame.current || points.length < 2) return
    const c = chartColors()
    const byDay = new Map(points.map((point) => [point.time, point]))
    const chart = createChart(frame.current, {
      autoSize: true,
      handleScroll: false,
      handleScale: false,
      layout: { background: { type: ColorType.Solid, color: c.win }, textColor: c.mid, fontFamily: '"DM Mono", ui-monospace, monospace', fontSize: 11, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: c.soft } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { horzLine: { visible: false, labelVisible: false }, vertLine: { labelVisible: false } },
      localization: { priceFormatter: dollars },
    })
    const series = chart.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: 1000 },
      lineWidth: 2,
      priceLineVisible: false,
    })
    series.createPriceLine({ price: 1000, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, color: c.mid })
    series.setData(points.map(({ time, value }) => ({ time, value })))
    chart.timeScale().fitContent()

    chart.subscribeCrosshairMove((param) => {
      const point = typeof param.time === 'string' ? byDay.get(param.time) : undefined
      const y = point ? series.priceToCoordinate(point.value) : null
      setHover(point && param.point && y !== null ? { point, x: param.point.x, y } : null)
    })
    return () => chart.remove()
  }, [points])

  if (points.length < 2) return <p className="status-line">Not enough settled calls for a line yet.</p>
  const change = hover ? hover.point.value / 1000 - 1 : 0
  return (
    <div className="result-curve">
      <div className="result-curve-canvas" ref={frame} />
      {hover ? (
        <div
          className="chart-tip result-tip"
          style={{
            left: hover.x,
            top: hover.y,
            transform: `translate(${hover.x > (frame.current?.clientWidth ?? 0) / 2 ? 'calc(-100% - 24px)' : '0'}, ${hover.y > (frame.current?.clientHeight ?? 0) / 2 ? 'calc(-100% - 24px)' : '0'})`,
          }}
        >
          <header>{formatDate(hover.point.time)}</header>
          <p><b className={change >= 0 ? 'good' : 'bad'}>{dollars(hover.point.value)}</b> ({formatPct(change)} per call)</p>
          <footer>Average of the first {hover.point.calls} {hover.point.calls === 1 ? 'call' : 'calls'}</footer>
        </div>
      ) : null}
    </div>
  )
}
