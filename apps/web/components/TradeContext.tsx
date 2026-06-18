'use client'

import { useEffect, useState } from 'react'
import { API_URL } from '../lib/api'
import { TweetFeed, type FeedTweet, type TickerSearch } from './TweetFeed'

type ScorecardTweets = {
  tweets: FeedTweet[]
}

export function TradeContext({ handle, tickerSearch }: { handle: string, tickerSearch?: TickerSearch | null }) {
  const [tweets, setTweets] = useState<FeedTweet[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`${API_URL}/api/users/${encodeURIComponent(handle)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Could not load trade context.')
        return res.json() as Promise<ScorecardTweets>
      })
      .then((data) => {
        if (alive) setTweets(data.tweets ?? [])
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load trade context.')
      })
    return () => {
      alive = false
    }
  }, [handle])

  if (error) return <p className="status-line">{error}</p>
  if (!tweets) return <p className="status-line">Loading trade context...</p>
  return <TweetFeed tweets={tweets} tickerSearch={tickerSearch} />
}
