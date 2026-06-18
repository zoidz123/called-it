import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { optionalEnv, requiredEnv } from '../env'
import type { RawStance, TweetCandidate } from '../types'

export const STANCE_SYSTEM_PROMPT = `You classify financial tweets to find a person's HIGH-CONVICTION TRADE CALLS.

For each tweet, for EACH ticker ($CASHTAG) provided, output the AUTHOR'S OWN current directional stance on THAT ticker:
- "bull" = the author clearly expresses a current/future bullish investment view on this exact ticker: expects price/appreciation/upside, says to buy/own/long, says it is a core long, says dips should be bought, discloses ownership with positive thesis, or strongly defends a thesis with forward conviction.
- "bear" = the author clearly expresses a current/future bearish investment view on this exact ticker: expects downside, says to sell/avoid/short, says it is overvalued/doomed, discloses a short, or strongly warns against owning it.
- "none" = anything less than a clear high-conviction directional call.

Be extremely conservative. Default to "none" when unsure.

STRICT EXCLUSIONS:
- Performance recaps, scorecards, lists, rankings, or "these were up/down X%" are "none" for every ticker unless the author gives a specific current/future directional call for that exact ticker.
- A broad basket statement like "many of these should keep going up" is not enough to mark every listed ticker bullish.
- Product/company comparisons are "none" unless explicitly framed as an investment/stock-price call. Example: "IBKR is the better brokerage than HOOD" is not bullish IBKR or bearish HOOD by itself.
- Questions, surprise, criticism of a product feature, or customer/user advice are "none" unless the author explicitly ties it to buying/selling/shorting the stock/token.
- Retrospective victory laps ("I called it", "now up", "was right", "went from X to Y") are "none" unless paired with a fresh current/future call.
- Neutral news, funding/news announcements, earnings facts, partnerships, or "interesting" observations are "none" unless the author clearly states a directional view.
- Comparisons/benchmarks: if a ticker is only used as an analogy or benchmark for another (e.g. "$A is the next $B"), the benchmark $B is "none".

Words like "short", "sell", "crash", "bear", "dump", "long", "up", and "down" do NOT by themselves decide stance. Judge the author's own investment view on that exact ticker.

conviction is 0..1. Use bull/bear only when conviction >= 0.7; otherwise use none.

Reply ONLY with JSON: {"results":[{"id":"...","stances":[{"asset":"$X","stance":"bull|bear|none","conviction":0.0}]}]}`

type BatchItem = { id: string; text: string; tickers: string[] }

export async function classifyBatch(
  items: BatchItem[],
  { apiKey = requiredEnv('OPENAI_API_KEY'), model = optionalEnv('OPENAI_MODEL') ?? 'gpt-5.4' } = {},
): Promise<Record<string, RawStance[]>> {
  if (!items.length) return {}

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: STANCE_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(items) },
      ],
    }),
  })

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 240)}`)
  const data = await res.json()
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
  const out: Record<string, RawStance[]> = {}
  for (const result of parsed.results ?? []) {
    out[String(result.id)] = (result.stances ?? []).map((stance: any) => ({
      asset: normalizeAsset(stance.asset),
      stance: ['bull', 'bear', 'none'].includes(stance.stance) ? stance.stance : 'none',
      conviction: Number(stance.conviction) || 0,
    }))
  }
  return out
}

export async function classifyCandidates(
  candidates: TweetCandidate[],
  { batchSize = 12, concurrency = 4 } = {},
) {
  const maxCandidates = Number(optionalEnv('CLASSIFY_MAX_CANDIDATES') ?? 0)
  const selected = maxCandidates > 0 ? candidates.slice(0, maxCandidates) : candidates
  const cached = optionalEnv('USE_LOCAL_TWITTER_CACHE') === '1' ? loadLocalClassificationCache() : new Map<string, RawStance[]>()
  const classified = new Map<string, RawStance[]>()
  for (const candidate of selected) {
    const stances = cached.get(candidate.id)
    if (stances) classified.set(candidate.id, stances)
  }
  const todo = selected.filter((candidate) => !classified.has(candidate.id))
  const batches = chunk(todo, batchSize)
  await mapWithConcurrency(batches, concurrency, async (batch) => {
    const result = await classifyBatch(batch.map((item) => ({ id: item.id, text: item.text, tickers: item.assets })))
    for (const [id, stances] of Object.entries(result)) classified.set(id, stances)
  })
  return selected.map((candidate) => ({
    ...candidate,
    stances: (classified.get(candidate.id) ?? [])
      .filter((stance) => candidate.assets.includes(normalizeAsset(stance.asset)) && (stance.stance === 'bull' || stance.stance === 'bear'))
      .map((stance) => ({
        asset: normalizeAsset(stance.asset),
        direction: stance.stance === 'bull' ? 'BULL' as const : 'BEAR' as const,
        conviction: stance.conviction || 0.5,
      })),
  })).filter((tweet) => tweet.stances.length > 0)
}

function loadLocalClassificationCache(): Map<string, RawStance[]> {
  const out = new Map<string, RawStance[]>()
  const dir = resolve(process.cwd(), '.cache/twitter')
  for (const file of ['aleabitoreddit.llm.json', 'blknoiz06.llm.json']) {
    const path = resolve(dir, file)
    if (!existsSync(path)) continue
    try {
      const data = JSON.parse(readFileSync(path, 'utf8')) as Record<string, any[]>
      for (const [id, stances] of Object.entries(data)) {
        out.set(id, (stances ?? []).map((stance) => ({
          asset: normalizeAsset(stance.asset),
          stance: String(stance.stance ?? '').toLowerCase() === 'long'
            ? 'bull'
            : String(stance.stance ?? '').toLowerCase() === 'short'
              ? 'bear'
              : String(stance.stance ?? '').toLowerCase(),
          conviction: Number(stance.conviction) || 0,
        })) as RawStance[])
      }
    } catch {
      // Ignore malformed local cache files; production classification still works.
    }
  }
  return out
}

export function extractCashtags(text: string): string[] {
  return [...new Set([...text.matchAll(/\$[A-Za-z][A-Za-z0-9]{1,9}\b/g)].map((m) => normalizeAsset(m[0])))]
}

export function normalizeAsset(asset: string): string {
  const value = String(asset ?? '').trim().toUpperCase().replace(/^\$+/, '')
  return value ? `$${value}` : '$UNKNOWN'
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}
