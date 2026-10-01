'use client'

import { ExternalLink, Flag } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { API_URL } from '../lib/api'
import { formatPct } from '../lib/format'
import { formatDate, formatPrice, money, sentiment, type AssetRow, type Horizon } from '../lib/scorecard'
import { PriceChart, type ChartBar, type ChartCallout } from './PriceChart'

type Callout = ChartCallout & { url: string }

type Thread = { callouts: Callout[]; prices: ChartBar[] }
type FeedbackStatus = 'idle' | 'sending' | 'sent' | 'error'

const PAGE_SIZE = 15

// One row per asset. Opening a row loads its thread: the price chart with every callout on it, then the posts themselves.
export function AssetBoard({ assetRows, handle, horizon, updatedLabel }: { assetRows: AssetRow[]; handle: string; horizon: Horizon; updatedLabel: string }) {
  const [openId, setOpenId] = useState<string | null>(assetRows.find((row) => row.priced)?.id ?? null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const visibleRows = assetRows.slice(0, visibleCount)
  const hiddenCount = assetRows.length - visibleRows.length

  return (
    <section className="calls-ledger">
      <div className="calls-ledger-head">
        <div>
          <div className="scoreboard-title-row">
            <h2>Callouts</h2>
            <span>{updatedLabel}</span>
          </div>
          <p className="scoreboard-note">One row per asset. Open a row to see every post on the price chart.</p>
          <details className="scoreboard-method">
            <summary>How this is scored</summary>
            <p>Each post that makes a call is priced from the first price after it to the price {horizon} days later, as if $1,000 went into it. Every post counts, so repeating a call counts again. A post is a win when it made money. This is not a portfolio return and says nothing about position size, entries or exits.</p>
          </details>
        </div>
      </div>
      <div className="asset-board">
        <div className="asset-board-head">
          <span>Asset</span>
          <span>Wins-losses</span>
          <span>$1,000 became</span>
        </div>
        {visibleRows.map((row) => {
          const open = openId === row.id
          const mood = sentiment(row.bulls, row.bears)
          return (
            <article className="asset-row" key={row.id}>
              <button
                type="button"
                className="asset-row-summary"
                aria-expanded={open}
                disabled={!row.priced}
                onClick={() => setOpenId(open ? null : row.id)}
              >
                <span className="asset-row-name">
                  <b>{row.asset}</b>
                  <span className={`stance-badge ${mood.tone}`}>{mood.label}</span>
                  <small>{row.callouts} {row.callouts === 1 ? 'post' : 'posts'} · first called {formatDate(row.firstPitchAt)}</small>
                </span>
                <span className="asset-row-count">{row.priced ? `${row.horizons[horizon].wins}-${row.horizons[horizon].losses}` : ''}</span>
                {row.priced ? <Money value={row.horizons[horizon].avg} /> : <span className="muted">No price</span>}
              </button>
              {open ? <AssetThread handle={handle} row={row} horizon={horizon} /> : null}
            </article>
          )
        })}
      </div>
      {hiddenCount > 0 ? (
        <div className="scorecard-more-row">
          <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, hiddenCount)} more
          </button>
        </div>
      ) : null}
    </section>
  )
}

function AssetThread({ handle, row, horizon }: { handle: string; row: AssetRow; horizon: Horizon }) {
  const [thread, setThread] = useState<Thread | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    let alive = true
    fetch(`${API_URL}/api/users/${encodeURIComponent(handle)}/assets/${encodeURIComponent(row.asset)}`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('Could not load this thread.')
        return res.json() as Promise<Thread>
      })
      .then((data) => { if (alive) setThread(data) })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'Could not load this thread.') })
    return () => { alive = false }
  }, [handle, row.asset])

  function select(tweetId: string) {
    setSelectedId(tweetId)
    listRef.current?.querySelector(`[data-tweet="${tweetId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  if (error) return <div className="asset-thread"><p className="status-line">{error}</p></div>
  if (!thread) return <div className="asset-thread"><p className="status-line">Loading thread...</p></div>

  return (
    <div className="asset-thread">
      <div className="chart-legend">
        <span><i className="chart-mark bull" /> Bullish post</span>
        <span><i className="chart-mark bear" /> Bearish post</span>
      </div>
      <PriceChart bars={thread.prices} callouts={thread.callouts} horizon={horizon} selectedId={selectedId} onSelect={select} />
      <ol className="thread-list" ref={listRef}>
        {[...thread.callouts].reverse().map((callout) => (
          <li
            key={`${callout.tweet_id}-${callout.direction}`}
            data-tweet={callout.tweet_id}
            className={callout.tweet_id === selectedId ? 'thread-post selected' : 'thread-post'}
            onMouseEnter={() => setSelectedId(callout.tweet_id)}
          >
            <header>
              <Result value={callout[`return_${horizon}d`]} />
              <time>{formatDate(callout.created_at)}</time>
              <span>{callout.direction === 'BULL' ? '▲ Bullish' : '▼ Bearish'} at {formatPrice(callout.entry_price)}</span>
              <span className="thread-markout"><Outcome value={callout[`return_${horizon}d`]} horizon={horizon} /></span>
              <a href={callout.url} target="_blank" rel="noreferrer" aria-label="Open post">
                <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
              </a>
            </header>
            <p>{callout.text}</p>
          </li>
        ))}
      </ol>
      <AssetFeedback handle={handle} row={row} />
    </div>
  )
}

// What $1,000 in this call became, with the percentage beside it.
function Money({ value }: { value: number | null }) {
  if (value === null) return <em className="move">too early</em>
  return <b className={`move ${value >= 0 ? 'good' : 'bad'}`} title={formatPct(value)}>{money(value)}</b>
}

// A post's result in full: the move, when it was measured, and what $1,000 became.
function Outcome({ value, horizon }: { value: number | null; horizon: Horizon }) {
  if (value === null) return <em className="move">not {horizon} days old yet</em>
  return (
    <>
      <b className={`move ${value >= 0 ? 'good' : 'bad'}`}>{formatPct(value)}</b> {horizon} days later · $1,000 became {money(value)}
    </>
  )
}

function Result({ value }: { value: number | null }) {
  if (value === null) return <span className="result-badge">-</span>
  return <span className={`result-badge ${value > 0 ? 'won' : 'lost'}`}>{value > 0 ? 'W' : 'L'}</span>
}

function AssetFeedback({ handle, row }: { handle: string; row: AssetRow }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [status, setStatus] = useState<FeedbackStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const inputId = `asset-feedback-${row.id.replace(/[^a-z0-9_-]+/gi, '-')}`

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const suggestedCorrection = text.trim()
    if (!suggestedCorrection) {
      setStatus('error')
      setError('Tell us what this should be.')
      return
    }
    setStatus('sending')
    setError(null)
    const displayedDirection = row.bears > row.bulls ? 'BEAR' : 'BULL'
    const displayedAction = displayedDirection === 'BEAR' ? 'SELL' : 'BUY'
    try {
      const response = await fetch(`${API_URL}/api/users/${encodeURIComponent(handle)}/asset-feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          asset: row.asset,
          displayedDirection,
          displayedAction,
          suggestedCorrection,
          rowContext: {
            displayedDirection,
            displayedAction,
            mentions: row.callouts,
            firstPitchAt: row.firstPitchAt,
            returnPct: row.horizons[30],
            stanceLabel: sentiment(row.bulls, row.bears).label,
          },
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setStatus('error')
        setError(payload?.error ?? 'Could not send this flag. Try again.')
        return
      }
      setStatus('sent')
    } catch {
      setStatus('error')
      setError('Could not send this flag. Try again.')
    }
  }

  if (!open) {
    return (
      <button type="button" className="asset-flag-button" onClick={() => setOpen(true)}>
        <Flag size={12} strokeWidth={2.5} aria-hidden="true" /> Flag {row.asset} as wrong
      </button>
    )
  }

  return (
    <form className="asset-feedback-form" onSubmit={submit}>
      <label htmlFor={inputId}>What should {row.asset} be?</label>
      <textarea
        id={inputId}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          if (status !== 'idle') {
            setStatus('idle')
            setError(null)
          }
        }}
        maxLength={1000}
        placeholder="Add the correction here. Example: this should map to a different company, or the post was not making a call."
        rows={3}
        disabled={status === 'sending' || status === 'sent'}
      />
      <div className="asset-feedback-actions">
        <button type="submit" disabled={status === 'sending' || status === 'sent'}>
          {status === 'sending' ? 'Sending...' : status === 'sent' ? 'Sent' : 'Send flag'}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={status === 'sending'}>
          {status === 'sent' ? 'Close' : 'Cancel'}
        </button>
      </div>
      {status === 'sent' ? <p className="asset-feedback-status success" role="status">Flag sent. Thanks, this goes into the review queue.</p> : null}
      {error ? <p className="asset-feedback-status error" role="alert">{error}</p> : null}
    </form>
  )
}
