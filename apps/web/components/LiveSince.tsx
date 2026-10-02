'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { formatPct } from '../lib/format'
import { formatPrice } from '../lib/scorecard'

export type LiveCall = { entry: number; direction: 'BULL' | 'BEAR' }

// Hyperliquid pushes every mid price in one message per venue: crypto, and stocks on its xyz venue as "xyz:TICKER".
const SOCKET_URL = 'wss://api.hyperliquid.xyz/ws'
const VENUES = [{ type: 'allMids' }, { type: 'allMids', dex: 'xyz' }]
const NOTIFY_MS = 1000
const RECONNECT_MS = 3000

// One socket for the whole page, open only while something on it is showing a live move.
const mids = new Map<string, number>()
const listeners = new Set<() => void>()
let socket: WebSocket | null = null
let notifying: ReturnType<typeof setTimeout> | null = null
let reconnecting: ReturnType<typeof setTimeout> | null = null

function connect() {
  reconnecting = null
  const opened = new WebSocket(SOCKET_URL)
  socket = opened
  opened.onopen = () => {
    for (const subscription of VENUES) opened.send(JSON.stringify({ method: 'subscribe', subscription }))
  }
  opened.onmessage = (event) => {
    let message: { channel?: string; data?: { mids?: Record<string, string> } }
    try { message = JSON.parse(String(event.data)) } catch { return }
    if (message.channel !== 'allMids' || !message.data?.mids) return
    for (const [coin, mid] of Object.entries(message.data.mids)) {
      const price = Number(mid)
      if (Number.isFinite(price) && price > 0) mids.set(coin, price)
    }
    // Prices arrive in bursts; the page repaints at most once a second.
    if (notifying) return
    notifying = setTimeout(() => {
      notifying = null
      for (const listener of listeners) listener()
    }, NOTIFY_MS)
  }
  opened.onclose = () => {
    if (socket !== opened) return
    socket = null
    if (listeners.size) reconnecting = setTimeout(connect, RECONNECT_MS)
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!socket && !reconnecting) connect()
  return () => {
    listeners.delete(listener)
    if (listeners.size) return
    if (reconnecting) clearTimeout(reconnecting)
    reconnecting = null
    const open = socket
    socket = null
    open?.close()
  }
}

// Hyperliquid's latest price for `coin`, once one has arrived.
function useLivePrice(coin?: string | null) {
  return useSyncExternalStore(subscribe, () => (coin ? mids.get(coin) : undefined), () => undefined)
}

// What the asset trades at now. Each time a new price comes in the figure flashes green or red for the direction it
// moved, which is what shows the number is live. An asset Hyperliquid does not quote keeps the price it loaded with.
export function LivePrice({ coin, fallback }: { coin?: string | null; fallback: number }) {
  const shown = formatPrice(useLivePrice(coin) ?? fallback)
  const last = useRef(shown)
  const [flash, setFlash] = useState<{ tone: 'up' | 'down'; count: number } | null>(null)
  useEffect(() => {
    if (shown === last.current) return
    const rose = Number(shown.replace(/[$,]/g, '')) > Number(last.current.replace(/[$,]/g, ''))
    last.current = shown
    setFlash((current) => ({ tone: rose ? 'up' : 'down', count: (current?.count ?? 0) + 1 }))
  }, [shown])
  // The key restarts the animation on every change, including two moves the same way in a row.
  return <span key={flash?.count ?? 0} className={`feed-price${flash ? ` ${flash.tone}` : ''}`}>{shown}</span>
}

// The average move since the calls, with a bearish call counted as a short. It follows Hyperliquid's price for `coin`
// once one arrives; until then, and for an asset Hyperliquid does not quote, it shows the move the server worked out.
export function LiveSince({ calls, coin, fallback }: { calls: LiveCall[]; coin?: string | null; fallback: number }) {
  const price = useLivePrice(coin)
  const moves = price ? calls.filter((call) => call.entry > 0).map((call) => (call.direction === 'BULL' ? price - call.entry : call.entry - price) / call.entry) : []
  const value = moves.length ? moves.reduce((sum, move) => sum + move, 0) / moves.length : fallback
  // Rounded first, so a move too small to show reads as flat and not as "-0.0%".
  const shown = Math.round(value * 1000) / 1000 || 0
  return <b className={`move ${shown > 0 ? 'good' : shown < 0 ? 'bad' : 'muted'}`}>{formatPct(shown)}</b>
}
