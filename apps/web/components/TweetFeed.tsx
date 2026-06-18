'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'

type Stance = {
  asset: string
  direction: 'BULL' | 'BEAR'
  conviction: number
}

export type FeedTweet = {
  tweet_id: string
  text: string
  created_at: string
  url: string
  stances: Stance[]
}

export type TickerSearch = {
  ticker: string
  id: number
}

export function TweetFeed({ tweets, tickerSearch }: { tweets: FeedTweet[], tickerSearch?: TickerSearch | null }) {
  const [direction, setDirection] = useState<'ALL' | 'BULL' | 'BEAR'>('ALL')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(48)
  const [expandedTweets, setExpandedTweets] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (tickerSearch) {
      setQuery(normalizeTicker(tickerSearch.ticker))
    }
  }, [tickerSearch])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tweets.filter((tweet) => {
      const directionMatch = direction === 'ALL' || tweet.stances.some((stance) => stance.direction === direction)
      if (!directionMatch) return false
      if (!q) return true
      const tickerQuery = normalizeMaybeTicker(q)
      if (tickerQuery) {
        return tweet.stances.some((stance) => normalizeTicker(stance.asset) === tickerQuery) || hasCashtag(tweet.text, tickerQuery)
      }
      const haystack = `${tweet.text} ${tweet.stances.map((stance) => normalizeTicker(stance.asset)).join(' ')}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [direction, query, tweets])

  useEffect(() => {
    setVisibleCount(48)
  }, [direction, query])

  const visibleTweets = filtered.slice(0, visibleCount)
  const hiddenCount = filtered.length - visibleTweets.length

  return (
    <section className="feed-panel">
      <div className="feed-tools">
        {(['ALL', 'BULL', 'BEAR'] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={direction === item}
            onClick={() => setDirection(item)}
          >
            {item === 'ALL' ? 'All' : item === 'BULL' ? 'Bull' : 'Bear'}
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="search text or $ASSET"
          aria-label="Search tweets"
          suppressHydrationWarning
        />
        <span>{filtered.length}/{tweets.length} posts on tape</span>
      </div>

      <div className="tweet-feed">
        {visibleTweets.map((tweet) => {
          const tone = tweet.stances.some((stance) => stance.direction === 'BEAR') && !tweet.stances.some((stance) => stance.direction === 'BULL')
            ? 'bear'
            : 'bull'
          const isExpanded = expandedTweets.has(tweet.tweet_id)
          const preview = getTweetPreview(tweet.text)
          const isTruncated = preview !== tweet.text
          return (
            <article className={`feed-card ${tone}`} key={tweet.tweet_id}>
              <header>
                <div className="stance-chips">
                  {tweet.stances.map((stance) => (
                    <span className={`stance-chip ${stance.direction === 'BULL' ? 'bull' : 'bear'}`} key={`${tweet.tweet_id}-${stance.asset}-${stance.direction}`}>
                      {normalizeTicker(stance.asset)} {stance.direction === 'BULL' ? '▲' : '▼'}
                    </span>
                  ))}
                </div>
                <time>{formatDateTime(tweet.created_at)}</time>
              </header>
              <p>
                {isExpanded || !isTruncated ? tweet.text : preview}
                {isTruncated ? (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="read-more-button"
                      onClick={() => toggleExpandedTweet(tweet.tweet_id, setExpandedTweets)}
                    >
                      {isExpanded ? 'read less' : 'read more'}
                    </button>
                  </>
                ) : null}
              </p>
              <a className="post-link-icon" href={tweet.url} target="_blank" rel="noreferrer" aria-label="Open post">
                <ExternalLink size={16} strokeWidth={2.25} aria-hidden="true" />
              </a>
            </article>
          )
        })}
      </div>
      {hiddenCount > 0 ? (
        <button className="show-more-posts" type="button" onClick={() => setVisibleCount((count) => count + 48)}>
          Show more posts
        </button>
      ) : null}
    </section>
  )
}

function getTweetPreview(text: string) {
  const limit = 220
  if (text.length <= limit) return text
  const trimmed = text.slice(0, limit)
  const lastSpace = trimmed.lastIndexOf(' ')
  return `${trimmed.slice(0, lastSpace > 160 ? lastSpace : limit).trim()}...`
}

function toggleExpandedTweet(tweetId: string, setExpandedTweets: React.Dispatch<React.SetStateAction<Set<string>>>) {
  setExpandedTweets((current) => {
    const next = new Set(current)
    if (next.has(tweetId)) {
      next.delete(tweetId)
    } else {
      next.add(tweetId)
    }
    return next
  })
}

function normalizeTicker(value: string) {
  return `$${String(value ?? '').replace(/^\$+/, '').trim().toUpperCase()}`
}

function normalizeMaybeTicker(value: string) {
  const raw = value.replace(/^\$+/, '').trim()
  if (!/^[a-z0-9]{2,12}$/i.test(raw)) return null
  return `$${raw.toUpperCase()}`
}

function hasCashtag(text: string, ticker: string) {
  const raw = ticker.replace(/^\$+/, '')
  return new RegExp(`\\$${escapeRegExp(raw)}\\b`, 'i').test(text)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()} ${hour}:${minute} UTC`
}
