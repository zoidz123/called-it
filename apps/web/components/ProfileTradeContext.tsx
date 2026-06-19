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
  const sortedRows = assetRows
    .slice()
    .sort((a, b) => rowImpact(b) - rowImpact(a))
  const featuredRows = sortedRows
    .filter((row) => row.legs.length)
    .slice()
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
            <p className="scoreboard-note">This tracks public ticker mentions and the price move after each call. It is not a portfolio return estimate and should not be used to judge actual PnL, position sizing, entries, exits, or holding periods.</p>
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
            <span role="columnheader">Mentions</span>
            <span role="columnheader">Outcome</span>
          </div>
          {sortedRows.map((row) => (
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

function rowMove(row: AssetRow) {
  if (!row.legs.length) return 0
  const currentLeg = row.legs.find((leg) => leg.isCurrent) ?? row.legs[row.legs.length - 1]
  return currentLeg.returnPct
}

function rowImpact(row: AssetRow) {
  return Math.abs(rowMove(row)) * Math.log(row.total + 1)
}

function legMovePct(leg: PriceLeg) {
  return leg.returnPct
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
