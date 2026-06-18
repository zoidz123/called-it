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
  provider?: 'yahoo' | 'hyperliquid'
  resolvedBy?: 'common' | 'rule' | 'llm'
  confidence?: number
}

export type PricePoint = {
  price: number
  pricedAt: string
}

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
  isUp: boolean
  mentions: number
  bulls: number
  bears: number
  pricedAt: string
  evidence: ClassifiedTweet[]
}

export type UserStats = {
  handle: string
  avgReturn: number
  medianReturn: number
  hitRate: number
  callsTotal: number
  callsUp: number
}
