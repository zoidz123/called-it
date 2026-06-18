'use client'

import { useState } from 'react'
import { TradeContext } from './TradeContext'
import type { TickerSearch } from './TweetFeed'

export type AssetRow = {
  id: string
  asset: string
  total: number
  stanceLabel: string
  firstPitchAt: string
  legs: PriceLeg[]
}

export type PriceLeg = {
  id: string
  direction: 'BULL' | 'BEAR'
  startAt: string
  endAt: string | null
  startPrice: number
  endPrice: number
  returnPct: number
  isCurrent: boolean
}

type ProfileTradeContextProps = {
  assetRows: AssetRow[]
  handle: string
  updatedLabel: string
}

export function ProfileTradeContext({ assetRows, handle, updatedLabel }: ProfileTradeContextProps) {
  const [tickerSearch, setTickerSearch] = useState<TickerSearch | null>(null)
  const featuredRows = assetRows
    .filter((row) => row.legs.length)
    .slice()
    .sort((a, b) => Math.abs(rowMove(b)) - Math.abs(rowMove(a)))
    .slice(0, 4)

  function searchTicker(ticker: string) {
    setTickerSearch({ ticker, id: Date.now() })
    document.getElementById('trade-context')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
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
            <p className="scoreboard-note">We measure what happened after public ticker mentions using the stance expressed at the time. If a trader flips on a ticker, the price move is shown as separate stance legs. This is not portfolio return or proof of entry or exit.</p>
          </div>
        </div>
        {featuredRows.length ? (
          <div className="move-spotlight" aria-label="Largest post-mention price moves">
            {featuredRows.map((row) => (
              <button
                type="button"
                key={row.id}
                onClick={() => searchTicker(row.asset)}
                className="spotlight-tile"
              >
                <span>{row.asset}</span>
                <b className={rowMove(row) >= 0 ? 'good' : 'bad'}>{formatPct(rowMove(row))}</b>
                <small>{row.total} mentions since {formatDate(row.firstPitchAt)}</small>
              </button>
            ))}
          </div>
        ) : null}
        <div className="move-board" role="table" aria-label="Scorecard">
          <div className="move-board-head" role="row">
            <span role="columnheader">Asset</span>
            <span role="columnheader">Signal</span>
            <span role="columnheader">Mentions</span>
            <span role="columnheader">Move Since Mention</span>
          </div>
          {assetRows.map((row) => (
            <article className="move-row" role="row" key={row.id}>
              <div className="move-asset-cell" role="cell">
                <button
                  type="button"
                  className="asset-link-button"
                  onClick={() => searchTicker(row.asset)}
                  aria-label={`Search tweets for ${row.asset}`}
                >
                  {row.asset}
                </button>
                <span>{formatDate(row.firstPitchAt)}</span>
              </div>
              <div className="move-stance-cell" role="cell">
                <StanceSequence label={row.stanceLabel} />
              </div>
              <div className="move-count-cell" role="cell">
                <b>{row.total}</b>
              </div>
              <div className="move-result-cell" role="cell">
                {row.legs.length === 0 ? (
                  <span className="muted">no chart yet</span>
                ) : (
                  <MoveLegs legs={row.legs} />
                )}
              </div>
            </article>
          ))}
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
  return (
    <div className="price-legs">
      {legs.map((leg) => {
        const move = rawMovePct(leg)
        return (
          <div className="price-leg" key={leg.id}>
            <div className="price-leg-top">
              <span className={`mini-stance ${leg.direction === 'BULL' ? 'bull' : 'bear'}`}>{leg.direction}</span>
              <b className={move >= 0 ? 'good' : 'bad'}>{formatPct(move)}</b>
              <span className="price-hop">
                <span>{formatPrice(leg.startPrice)}</span>
                <span aria-hidden="true">→</span>
                <span>{formatPrice(leg.endPrice)}</span>
              </span>
            </div>
            <div className="move-meter" aria-hidden="true">
              <span
                className={move >= 0 ? 'up' : 'down'}
                style={{ width: `${Math.min(100, Math.max(8, Math.abs(move) * 100))}%` }}
              />
            </div>
            <span className="muted">{formatDate(leg.startAt)} → {leg.isCurrent ? 'now' : formatDate(leg.endAt ?? '')}</span>
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

function rowMove(row: AssetRow) {
  if (!row.legs.length) return 0
  const first = row.legs[0]
  const last = row.legs[row.legs.length - 1]
  return (last.endPrice - first.startPrice) / first.startPrice
}

function rawMovePct(leg: PriceLeg) {
  return (leg.endPrice - leg.startPrice) / leg.startPrice
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatPct(value: number) {
  const pct = value * 100
  const sign = value > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function formatPrice(value: number) {
  return `$${value.toLocaleString('en', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
}
