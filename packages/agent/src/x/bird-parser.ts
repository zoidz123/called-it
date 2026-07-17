import { createHash } from 'node:crypto'
import { z } from 'zod'

const identifier = z.union([z.string().min(1), z.number().int().nonnegative().transform(String)])
const authorSchema = z.object({
  id: identifier.optional(),
  username: z.string().optional(),
  name: z.string().optional(),
}).passthrough()

export const birdTweetSchema = z.object({
  id: identifier,
  text: z.string(),
  createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Expected a parseable post timestamp'),
  authorId: identifier.optional(),
  username: z.string().optional(),
  name: z.string().optional(),
  author: authorSchema.optional(),
  conversationId: identifier.optional(),
  inReplyToStatusId: identifier.nullish(),
  quotedTweet: z.unknown().optional(),
}).passthrough()

const envelopeSchema = z.union([
  z.array(birdTweetSchema).transform((tweets) => ({ tweets, nextCursor: undefined as string | undefined })),
  z.object({
    tweets: z.array(birdTweetSchema),
    nextCursor: z.string().min(1).nullish(),
    cursor: z.string().min(1).nullish(),
  }).passthrough().transform((value) => ({ tweets: value.tweets, nextCursor: value.nextCursor ?? value.cursor ?? undefined })),
])

export type NormalizedPost = {
  id: string
  accountHandle: string
  authorId: string | null
  text: string
  createdAt: string
  url: string
  contentHash: string
  conversationId: string | null
  inReplyToStatusId: string | null
  isQuote: boolean
  excludedReason: 'reply' | 'retweet' | null
}

export function parseTimelinePage(stdout: string, expectedHandle: string) {
  let raw: unknown
  try {
    raw = JSON.parse(stdout)
  } catch {
    throw new Error('malformed json')
  }
  const page = envelopeSchema.parse(raw)
  const normalized = page.tweets.map((tweet) => normalizeTweet(tweet, expectedHandle))
  return { posts: normalized, nextCursor: page.nextCursor }
}

export function parseTargetedRead(stdout: string, expectedId: string): NormalizedPost | null {
  let raw: unknown
  try {
    raw = JSON.parse(stdout)
  } catch {
    throw new Error('malformed json')
  }
  const candidate = Array.isArray(raw) ? raw[0] : raw
  const tweet = birdTweetSchema.parse(candidate)
  if (tweet.id !== expectedId) throw new Error('targeted read returned a different post')
  return normalizeTweet(tweet, tweet.author?.username ?? tweet.username ?? 'unknown')
}

export function parseWhoami(stdout: string): { username: string } {
  const match = stdout.match(/@([A-Za-z0-9_]{1,15})/)
  if (!match) throw new Error('whoami contract drift')
  return { username: match[1].toLowerCase() }
}

function normalizeTweet(tweet: z.infer<typeof birdTweetSchema>, expectedHandle: string): NormalizedPost {
  const handle = (tweet.author?.username ?? tweet.username ?? expectedHandle).replace(/^@/, '').toLowerCase()
  const text = tweet.text.replace(/\r\n/g, '\n')
  return {
    id: tweet.id,
    accountHandle: handle,
    authorId: tweet.authorId ?? tweet.author?.id ?? null,
    text,
    createdAt: new Date(tweet.createdAt).toISOString(),
    url: `https://x.com/${handle}/status/${tweet.id}`,
    contentHash: createHash('sha256').update(text).digest('hex'),
    conversationId: tweet.conversationId ?? null,
    inReplyToStatusId: tweet.inReplyToStatusId ?? null,
    isQuote: Boolean(tweet.quotedTweet),
    excludedReason: tweet.inReplyToStatusId ? 'reply' : /^RT\s+@/i.test(text) ? 'retweet' : null,
  }
}
