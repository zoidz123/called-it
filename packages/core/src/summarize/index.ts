import { optionalEnv, requiredEnv } from '../env'

export type SummaryPost = { name: string; direction: 'BULL' | 'BEAR'; text: string }

const MAX_POSTS = 30
const MAX_POST_CHARS = 600
const MAX_ATTEMPTS = 3

const SYSTEM = `You write the one-line summary for a row in a feed of public stock and crypto calls from X accounts.
You are given one ticker and the posts tracked accounts made about it this week, each marked bullish or bearish.

Write one or two short sentences, 30 words at most, saying what these accounts are arguing about that ticker.
- Lead with the reasoning when there is one: the thesis, a catalyst, a valuation claim.
- Keep the one or two most concrete numbers they give: a price target, a level to hold or break, leverage.
- If the accounts disagree, say so and name the account on the other side.
- Posts fall into a few kinds: a thesis, a price prediction, or a short call like "buy the dip here". Summarize a short call as what it is. Do not remark on what a post leaves out.
- A post may cover several tickers. Use only what it says about the given ticker.
- Use only what the posts say. Add no facts, opinions, forecasts or advice of your own, and keep past trades in the past tense.
- Name an account when that makes clear whose view it is, using its name exactly as given. Never write "accounts" when there is only one.
- Write the ticker with its $ sign.

Reply with the summary alone: plain text, no quotation marks, emoji, hashtags or markdown.`

export function summariesAreConfigured() {
  return Boolean(optionalEnv('ANTHROPIC_API_KEY'))
}

export function summaryPrompt(asset: string, posts: SummaryPost[]) {
  const lines = posts.slice(0, MAX_POSTS).map((post, index) => (
    `${index + 1}. ${post.name} (${post.direction === 'BULL' ? 'bullish' : 'bearish'}): ${post.text.replace(/\s*https:\/\/t\.co\/\w+/g, '').slice(0, MAX_POST_CHARS)}`
  ))
  return `Ticker: ${asset}\n\nPosts:\n${lines.join('\n')}`
}

// One or two sentences on what the accounts behind an asset are saying about it this week.
export async function summarizeIdea(
  asset: string,
  posts: SummaryPost[],
  { apiKey = requiredEnv('ANTHROPIC_API_KEY'), model = optionalEnv('FEED_SUMMARY_MODEL') ?? 'claude-haiku-4-5-20251001' } = {},
): Promise<string> {
  const body = JSON.stringify({
    model,
    max_tokens: 160,
    system: SYSTEM,
    messages: [{ role: 'user', content: summaryPrompt(asset, posts) }],
  })
  for (let attempt = 1; ; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body,
    })
    if ((res.status === 429 || res.status === 529) && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(res.headers.get('retry-after'))
      await new Promise((done) => setTimeout(done, retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt))
      continue
    }
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 240)}`)
    const payload = await res.json()
    const text = (payload.content ?? []).filter((block: any) => block.type === 'text').map((block: any) => block.text).join(' ').replace(/\s+/g, ' ').trim()
    if (!text) throw new Error('Anthropic returned no summary')
    return text
  }
}
