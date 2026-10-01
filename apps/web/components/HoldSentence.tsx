import { HORIZONS, type Horizon } from '../lib/scorecard'

// The what-if a timeframe answers, written out so the choice reads as a holding period and never as a lookback.
// It is a hypothetical: nothing is bought or sold.
export function HoldQuestion({ horizon, since }: { horizon: Horizon; since?: string }) {
  return (
    <p className="hold-question">
      What if you had put <b>$1,000</b> into every call {since ? <>posted since <b>{since}</b></> : 'an account posted'} and sold it <b>{horizon} days</b> later?
      <span className="scan-info">
        <button type="button" aria-label="How this is worked out">?</button>
        <span className="scan-info-popover hold-steps" role="tooltip">
          <span><b>1. They post a call.</b> Any public post that is bullish or bearish on a ticker. We read the past year when an account is first scanned, then keep adding new posts.</span>
          <span><b>2. Imagine $1,000 goes in.</b> Priced at the first price after the post, with a bearish call treated as a short. No real money is involved.</span>
          <span><b>3. It comes out later.</b> 7, 30 or 90 days after, and every call is added up. A call too recent to close is left out.</span>
        </span>
      </span>
    </p>
  )
}

export function HoldControl({ horizon, hrefFor }: { horizon: Horizon; hrefFor: (days: Horizon) => string }) {
  return (
    <div className="hold-control">
      <span className="label">Sold after</span>
      <nav className="sorts" aria-label="Sold after">
        {HORIZONS.map((days) => (
          <a key={days} href={hrefFor(days)} className={days === horizon ? 'active' : undefined} aria-current={days === horizon ? 'true' : undefined}>{days} days</a>
        ))}
      </nav>
    </div>
  )
}
