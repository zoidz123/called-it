const steps = [
  {
    title: 'Read the public record',
    detail: 'We look for stock and crypto ticker mentions in public posts.',
  },
  {
    title: 'Separate clear stances',
    detail: 'Bullish and bearish calls are grouped by asset and direction.',
  },
  {
    title: 'Show what followed',
    detail: 'Direction-adjusted price movement and the supporting posts make each scorecard easier to inspect.',
  },
]

export function AboutSection() {
  return (
    <section aria-labelledby="about-title" className="home-about">
      <div className="home-about-intro">
        <p className="home-about-kicker">About Called It</p>
        <h2 id="about-title">Public calls, checked against the price.</h2>
        <p>Called It turns public X/Twitter ticker stances into price-backed scorecards, so you can review a trader&apos;s calls in context.</p>
      </div>
      <ol className="home-about-steps">
        {steps.map((step) => (
          <li key={step.title}>
            <strong>{step.title}</strong>
            <span>{step.detail}</span>
          </li>
        ))}
      </ol>
      <p className="home-about-note">
        A scorecard measures public directional calls, not a complete trading record or investment advice.
      </p>
    </section>
  )
}
