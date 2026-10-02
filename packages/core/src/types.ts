import { z } from 'zod'

export const directionSchema = z.enum(['BULL', 'BEAR'])
export type Direction = z.infer<typeof directionSchema>

export const rawStanceSchema = z.object({
  asset: z.string(),
  stance: z.enum(['bull', 'bear', 'none']),
  conviction: z.number().min(0).max(1).default(0),
})

export type RawStance = z.infer<typeof rawStanceSchema>

export type XUser = {
  id: string
  handle: string
  name: string
  avatarUrl: string | null
  bio: string | null
  followers: number
  verified: boolean
}

export type Tweet = {
  id: string
  text: string
  createdAt: string
  url: string
}

export type TweetCandidate = Tweet & {
  assets: string[]
}

export type ClassifiedTweet = TweetCandidate & {
  stances: {
    asset: string
    direction: Direction
    conviction: number
  }[]
}

export type AssetClass = 'crypto' | 'stock'

export type ResolvedAsset = {
  symbol: string
  assetClass: AssetClass
  sourceId: string
  name: string | null
  // An on-chain token is priced from its GeckoTerminal pool; its sourceId is "gt:network:pool:token".
  provider?: 'yahoo' | 'hyperliquid' | 'geckoterminal'
  resolvedBy?: 'common' | 'rule' | 'llm'
  confidence?: number
}

export type PricePoint = {
  price: number
  pricedAt: string
}

export const HORIZON_DAYS = [7, 30, 90] as const
export type HorizonDays = (typeof HORIZON_DAYS)[number]
export type HorizonPrices = Record<HorizonDays, PricePoint | null>

// One post that makes a call, with the move after it.
export type ScoredCallout = {
  tweetId: string
  createdAt: string
  conviction: number
  // The first price after the post, and when it traded.
  entryPrice: number
  entryAt: string
  returnPct: number
  return7d: number | null
  return30d: number | null
  return90d: number | null
}

// One call: one post's stance on one asset. `callouts` holds that single post's pricing.
export type ScoredCall = {
  handle: string
  asset: string
  assetClass: AssetClass
  sourceId: string
  direction: Direction
  firstPitchAt: string
  firstTweetId: string
  entryPrice: number
  currentPrice: number
  returnPct: number
  // Directional return N days after the post; null until that horizon has a settled price.
  return7d: number | null
  return30d: number | null
  return90d: number | null
  isUp: boolean
  mentions: number
  bulls: number
  bears: number
  pricedAt: string
  evidence: ClassifiedTweet[]
  callouts: ScoredCallout[]
}

export type UserStats = {
  handle: string
  avgReturn: number
  medianReturn: number
  hitRate: number
  callsTotal: number
  callsUp: number
  horizons: Record<HorizonDays, HorizonStats>
}

// Stats over the calls whose horizon has settled; calls counts those calls.
export type HorizonStats = {
  avgReturn: number
  medianReturn: number
  hitRate: number
  calls: number
}
