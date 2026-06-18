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
        <table>
          <colgroup>
            <col className="asset-col" />
            <col className="stance-col" />
            <col className="first-pitch-col" />
            <col className="calls-col" />
            <col className="since-mention-col" />
          </colgroup>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Stance</th>
              <th>First Mention</th>
              <th>Mentions</th>
              <th>Post-Mention Moves</th>
            </tr>
          </thead>
          <tbody>
            {assetRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button
                    type="button"
                    className="asset-link-button"
                    onClick={() => searchTicker(row.asset)}
                    aria-label={`Search tweets for ${row.asset}`}
                  >
                    {row.asset}
                  </button>
                </td>
                <td><StanceSequence label={row.stanceLabel} /></td>
                <td>{formatDate(row.firstPitchAt)}</td>
                <td>{row.total}</td>
                <td className="since-mention-cell">
                  {row.legs.length === 0 ? (
                    <span className="muted">no chart yet</span>
                  ) : (
                    <div className="price-legs">
                      {row.legs.map((leg) => (
                        <div className="price-leg" key={leg.id}>
                          <span className={`mini-stance ${leg.direction === 'BULL' ? 'bull' : 'bear'}`}>{leg.direction}</span>
                          <span className={leg.returnPct >= 0 ? 'good' : 'bad'}>{formatPct(leg.returnPct)}</span>
                          <span className="price-hop">
                            <span>{formatPrice(leg.startPrice)}</span>
                            <span aria-hidden="true">→</span>
                            <span>{formatPrice(leg.endPrice)}</span>
                          </span>
                          <span className="muted">{formatDate(leg.startAt)} → {leg.isCurrent ? 'now' : formatDate(leg.endAt ?? '')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="calls-receipts" id="trade-context">
        <h2>Trade Receipts</h2>
        <p className="section-note">Filter by ticker to see how this trader talked about each setup over time.</p>
        <TradeContext handle={handle} tickerSearch={tickerSearch} />
      </section>
    </>
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
