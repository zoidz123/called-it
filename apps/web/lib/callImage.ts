import type { Horizon } from './scorecard'

export type ImageBar = { t: number; open: number; high: number; low: number; close: number }
export type ImageCall = {
  direction: 'BULL' | 'BEAR'
  entry_at: string | null
  created_at: string
  entry_price: number
  return_7d: number | null
  return_30d: number | null
  return_90d: number | null
}

const DAY_MS = 24 * 60 * 60 * 1000
// Candles shown before the call, for context, and after the result, to show what came next.
const BARS_BEFORE = 15
const BARS_AFTER = 12

// The result a call's image leads with: the chosen holding period if the call is old enough for it, else the
// longest shorter one that has settled, else the move so far, to the latest price on the chart.
export function callResult(call: ImageCall, horizon: Horizon, latestPrice: number): { days: Horizon | null; value: number } {
  for (const days of ([90, 30, 7] as const).filter((candidate) => candidate <= horizon)) {
    const value = call[`return_${days}d`]
    if (value !== null) return { days, value }
  }
  const move = (latestPrice - call.entry_price) / call.entry_price
  return { days: null, value: call.direction === 'BULL' ? move : -move }
}

// The price the result was measured at. A bearish call is scored as a short, so a gain means the price fell.
export function exitPrice(call: Pick<ImageCall, 'direction' | 'entry_price'>, value: number) {
  return call.direction === 'BULL' ? call.entry_price * (1 + value) : call.entry_price * (1 - value)
}

// The stretch of daily bars an image draws: a little before the call, through the day its result was measured, and
// a little after. `entry` and `exit` are positions within that stretch; a result still open ends on the last bar.
export function chartWindow(bars: ImageBar[], entryAt: string, days: Horizon | null) {
  const entryTime = new Date(entryAt).getTime()
  const last = bars.length - 1
  const found = bars.findIndex((bar) => bar.t + DAY_MS > entryTime)
  const entryIndex = found === -1 ? last : found
  const exitTime = days === null ? Infinity : entryTime + days * DAY_MS
  const reached = bars.findIndex((bar) => bar.t + DAY_MS > exitTime)
  const exitIndex = reached === -1 ? last : reached
  const start = Math.max(0, entryIndex - BARS_BEFORE)
  const end = Math.min(last, exitIndex + BARS_AFTER)
  return { bars: bars.slice(start, end + 1), entry: entryIndex - start, exit: exitIndex - start }
}

// Round price levels for the axis: about `count` of them, spanning the range.
export function priceTicks(low: number, high: number, count = 5): number[] {
  const rough = (high - low) / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough) ?? rough
  const ticks: number[] = []
  for (let value = Math.ceil(low / step) * step; value <= high + step * 1e-9; value += step) ticks.push(Number(value.toPrecision(12)))
  return ticks
}
