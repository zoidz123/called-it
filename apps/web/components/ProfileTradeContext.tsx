'use client'

import { Flag } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'
import { API_URL } from '../lib/api'
import { formatDate, rowAction, rowDirection, rowImpact, rowMove, type AssetRow, type PriceLeg } from '../lib/scorecard'
import { TradeContext } from './TradeContext'
import type { TickerSearch } from './TweetFeed'

type ProfileTradeContextProps = {
  assetRows: AssetRow[]
  handle: string
  updatedLabel: string
}

const SCORECARD_PAGE_SIZE = 15
type FeedbackStatus = 'idle' | 'sending' | 'sent' | 'error'

export function ProfileTradeContext({ assetRows, handle, updatedLabel }: ProfileTradeContextProps) {
  const [tickerSearch, setTickerSearch] = useState<TickerSearch | null>(null)
  const [visibleRowCount, setVisibleRowCount] = useState(SCORECARD_PAGE_SIZE)
  const [feedbackRowId, setFeedbackRowId] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>('idle')
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const activeFeedbackRowRef = useRef<string | null>(null)
  const sortedRows = assetRows
    .slice()
    .sort((a, b) => rowImpact(b) - rowImpact(a))
  const visibleRows = sortedRows.slice(0, visibleRowCount)
  const hiddenRowCount = Math.max(0, sortedRows.length - visibleRows.length)
  const featuredRows = assetRows
    .slice()
    .filter((row) => row.legs.length && rowMove(row) > 0)
    .sort((a, b) => rowMove(b) - rowMove(a) || b.total - a.total)
    .slice(0, 4)

  function searchTicker(ticker: string) {
    setTickerSearch({ ticker, id: Date.now() })
    document.getElementById('trade-context')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  function toggleFeedback(row: AssetRow) {
    if (feedbackStatus === 'sending') return
    const nextRowId = feedbackRowId === row.id ? null : row.id
    activeFeedbackRowRef.current = nextRowId
    setFeedbackRowId(nextRowId)
    setFeedbackText('')
    setFeedbackStatus('idle')
    setFeedbackError(null)
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>, row: AssetRow) {
    event.preventDefault()
    const suggestedCorrection = feedbackText.trim()
    if (!suggestedCorrection) {
      setFeedbackStatus('error')
      setFeedbackError('Tell us what this should be.')
      return
    }
    setFeedbackStatus('sending')
    setFeedbackError(null)
    const submittedRowId = row.id
    activeFeedbackRowRef.current = submittedRowId
    const displayedDirection = rowDirection(row)
    const displayedAction = rowAction(row)
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
            mentions: row.total,
            firstPitchAt: row.firstPitchAt,
            returnPct: row.legs.length ? rowMove(row) : null,
            stanceLabel: row.stanceLabel,
          },
        }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        if (activeFeedbackRowRef.current !== submittedRowId) return
        setFeedbackStatus('error')
        setFeedbackError(error?.error ?? 'Could not send this flag. Try again.')
        return
      }
      if (activeFeedbackRowRef.current !== submittedRowId) return
      setFeedbackStatus('sent')
      setFeedbackError(null)
    } catch {
      if (activeFeedbackRowRef.current !== submittedRowId) return
      setFeedbackStatus('error')
      setFeedbackError('Could not send this flag. Try again.')
    }
  }

  return (
    <>
      <section className="calls-ledger">
        <div className="calls-ledger-head">
          <div>
            <div className="scoreboard-title-row">
              <h2>Scorecard</h2>
              <span>{updatedLabel}</span>
            </div>
            <p className="scoreboard-note">This tracks public ticker mentions and the price move after each call. It is not a portfolio return estimate and should not be used to judge actual PnL, position sizing, entries, exits, or holding periods.</p>
          </div>
        </div>
          {featuredRows.length ? (
          <div className="move-spotlight" aria-label="Top positive post-mention outcomes">
            {featuredRows.map((row) => (
              <button
                type="button"
                key={row.id}
                onClick={() => searchTicker(row.asset)}
                className="spotlight-tile"
              >
                <span className="spotlight-call">
                  <span className={`spotlight-action ${rowDirection(row) === 'BEAR' ? 'bear' : 'bull'}`}>{rowAction(row)}</span>
                  <span className="spotlight-ticker">{row.asset}</span>
                </span>
                <b className={rowMove(row) >= 0 ? 'good' : 'bad'}>{formatPct(rowMove(row))}</b>
                <small>{row.total} mentions since {formatDate(row.firstPitchAt)}</small>
              </button>
            ))}
          </div>
        ) : null}
        <div className="move-board">
          <div role="table" aria-label="Scorecard">
            <div className="move-board-head" role="row">
              <span role="columnheader">Asset</span>
              <span role="columnheader">Mentions</span>
              <span role="columnheader">Outcome</span>
            </div>
            {visibleRows.map((row) => {
              const isFeedbackOpen = feedbackRowId === row.id
              const feedbackInputId = feedbackInputIdFor(row)
              return (
                <article className={`move-row ${rowMove(row) >= 0 ? 'up' : 'down'}`} role="row" key={row.id}>
                  <div className="move-asset-cell" role="cell">
                    <div className="move-asset-main">
                      <button
                        type="button"
                        className="asset-link-button"
                        onClick={() => searchTicker(row.asset)}
                        aria-label={`Search tweets for ${row.asset}`}
                      >
                        {row.asset}
                      </button>
                      <StanceSequence label={row.stanceLabel} />
                      <button
                        type="button"
                        className="asset-flag-button"
                        aria-label={`Flag ${row.asset} as wrong`}
                        aria-expanded={isFeedbackOpen}
                        disabled={feedbackStatus === 'sending'}
                        title={`Flag ${row.asset}`}
                        onClick={() => toggleFeedback(row)}
                      >
                        <Flag size={12} strokeWidth={2.5} aria-hidden="true" />
                      </button>
                    </div>
                    <span>First mentioned {formatDate(row.firstPitchAt)}</span>
                  </div>
                  <div className="move-count-cell" role="cell">
                    <b>{row.total}</b>
                    <span>{row.total === 1 ? 'mention' : 'mentions'}</span>
                  </div>
                  <div className="move-result-cell" role="cell">
                    {row.legs.length === 0 ? (
                      <span className="muted">No pricing found</span>
                    ) : (
                      <MoveLegs legs={row.legs} />
                    )}
                  </div>
                  {isFeedbackOpen ? (
                    <div className="asset-feedback-panel" role="cell">
                      <form className="asset-feedback-form" onSubmit={(event) => submitFeedback(event, row)}>
                        <label htmlFor={feedbackInputId}>What should {row.asset} be?</label>
                        <textarea
                          id={feedbackInputId}
                          value={feedbackText}
                          onChange={(event) => {
                            setFeedbackText(event.target.value)
                            if (feedbackStatus !== 'idle') {
                              setFeedbackStatus('idle')
                              setFeedbackError(null)
                            }
                          }}
                          maxLength={1000}
                          placeholder="Add the correction here. Example: this should map to a different company, or the post was not making a call."
                          rows={3}
                          disabled={feedbackStatus === 'sending' || feedbackStatus === 'sent'}
                        />
                        <div className="asset-feedback-actions">
                          <button type="submit" disabled={feedbackStatus === 'sending' || feedbackStatus === 'sent'}>
                            {feedbackStatus === 'sending' ? 'Sending...' : feedbackStatus === 'sent' ? 'Sent' : 'Send flag'}
                          </button>
                          <button type="button" onClick={() => toggleFeedback(row)} disabled={feedbackStatus === 'sending'}>
                            {feedbackStatus === 'sent' ? 'Close' : 'Cancel'}
                          </button>
                        </div>
                        {feedbackStatus === 'sent' ? (
                          <p className="asset-feedback-status success" role="status">Flag sent. Thanks, this goes into the review queue.</p>
                        ) : null}
                        {feedbackError ? (
                          <p className="asset-feedback-status error" role="alert">{feedbackError}</p>
                        ) : null}
                      </form>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
          {hiddenRowCount ? (
            <div className="scorecard-more-row">
              <button
                type="button"
                onClick={() => setVisibleRowCount((count) => count + SCORECARD_PAGE_SIZE)}
              >
                Show {Math.min(SCORECARD_PAGE_SIZE, hiddenRowCount)} more
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="calls-receipts" id="trade-context">
        <h2>Trade Receipts</h2>
        <p className="section-note">Filter by ticker to see how this trader talked about each setup over time.</p>
        <TradeContext handle={handle} tickerSearch={tickerSearch} />
      </section>
    </>
  )
}

function MoveLegs({ legs }: { legs: PriceLeg[] }) {
  const showLegLabels = legs.length > 1
  return (
    <div className="price-legs">
      {legs.map((leg) => {
        const move = legMovePct(leg)
        return (
          <div className="price-leg" key={leg.id}>
            <div className="price-leg-top">
              {showLegLabels ? (
                <span className={`mini-stance ${leg.direction === 'BULL' ? 'bull' : 'bear'}`}>{leg.direction}</span>
              ) : null}
              <b className={`move-percent ${move >= 0 ? 'good' : 'bad'}`}>{formatPct(move)}</b>
              <span className="price-hop">
                <span>{formatPrice(leg.startPrice)}</span>
                <span aria-hidden="true">→</span>
                <span>{formatPrice(leg.endPrice)}</span>
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StanceSequence({ label }: { label: string }) {
  const parts = label.split(' -> ') as ('BULL' | 'BEAR')[]
  return (
    <div className="stance-sequence">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="stance-sequence-item">
          {index > 0 ? <span className="stance-arrow">→</span> : null}
          <span className={`stance-badge ${part === 'BULL' ? 'bull' : 'bear'}`}>{part}</span>
        </span>
      ))}
    </div>
  )
}

function legMovePct(leg: PriceLeg) {
  return leg.returnPct
}

function formatPct(value: number) {
  const pct = value * 100
  const sign = value > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function formatPrice(value: number) {
  return `$${value.toLocaleString('en', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
}

function feedbackInputIdFor(row: AssetRow) {
  return `asset-feedback-${row.id.replace(/[^a-z0-9_-]+/gi, '-')}`
}
