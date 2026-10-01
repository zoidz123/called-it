import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { optionalEnv } from '../env'
import { askJev, type JevQuestion } from '../typesafe'
import type { ClassifiedTweet, RawStance, TweetCandidate } from '../types'

type BatchItem = { id: string; text: string; tickers: string[] }

// Jev answers every question in isolation, so each ticker gets its own Choice question against one tweet.
const JEV_STANCE_CRITERIA = {
  bull: {
    what: 'The author clearly states their own current or future bullish investment view on this exact ticker: expects the price to rise, says to buy, own or go long, calls it a core long, says dips should be bought, discloses ownership with a positive thesis, or strongly defends a thesis with forward conviction.',
    not_for: 'Words like "long" or "up" on their own, or a positive remark about the product or company that is not framed as an investment call.',
  },
  bear: {
    what: 'The author clearly states their own current or future bearish investment view on this exact ticker: expects the price to fall, says to sell, avoid or short it, calls it overvalued or doomed, discloses a short, or strongly warns against owning it.',
    not_for: 'Words like "short", "sell", "crash" or "dump" on their own, or criticism of a product feature that is not tied to the stock or token price.',
  },
  none: {
    what: 'Anything less than a clear, high-conviction directional call by the author on this exact ticker. Choose this when unsure.',
    examples: [
      'Performance recaps, scorecards, lists or rankings with no fresh call on this ticker.',
      'A broad basket statement that does not single out this ticker.',
      'Retrospective victory laps such as "I called it" or "now up 40%" with no new call.',
      'Neutral news, earnings facts, funding or partnership announcements.',
      'Questions, surprise, sarcasm, jokes or quoting someone else\'s view.',
      'The ticker is only a benchmark or analogy for another asset.',
    ],
  },
}
const JEV_CONCURRENCY = 8
const JEV_SARCASM_MAX = 0.5

export async function classifyWithJev(item: BatchItem): Promise<RawStance[]> {
  if (!item.tickers.length) return []
  const answers = await askJev({ tweet: item.text }, Object.fromEntries(item.tickers.flatMap((ticker): [string, JevQuestion][] => [
    [ticker, {
      type: 'choice',
      instructions: {
        question: "What is the author's own directional investment stance on the asset named in `ticker`, as expressed in `tweet`?",
        ticker,
      },
      criteria: JEV_STANCE_CRITERIA,
    }],
    [sarcasmId(ticker), {
      type: 'noul',
      instructions: {
        question: 'Is the author being sarcastic or mocking people who hold the opposite view on the asset in `ticker`, so that the literal wording is the reverse of what the author believes?',
        ticker,
      },
    }],
  ])))
  return item.tickers.map((ticker) => {
    const answer = answers[ticker]
    // A sarcastic post reads as the opposite call, so it is dropped rather than scored.
    const sarcastic = (answers[sarcasmId(ticker)]?.noul ?? 0) > JEV_SARCASM_MAX
    const stance = !sarcastic && (answer?.choice === 'bull' || answer?.choice === 'bear') ? answer.choice : 'none'
    // The chosen option's probability plays the role of conviction, so the 0.7 floor still applies.
    return { asset: normalizeAsset(ticker), stance, conviction: Number(answer?.probabilities?.[stance]) || 0 }
  })
}

function sarcasmId(ticker: string) {
  return `${ticker}:sarcasm`
}

export async function classifyCandidates(candidates: TweetCandidate[]) {
  const maxCandidates = Number(optionalEnv('CLASSIFY_MAX_CANDIDATES') ?? 0)
  const selected = maxCandidates > 0 ? candidates.slice(0, maxCandidates) : candidates
  const cached = optionalEnv('USE_LOCAL_TWITTER_CACHE') === '1' ? loadLocalClassificationCache() : new Map<string, RawStance[]>()
  const classified = new Map<string, RawStance[]>()
  for (const candidate of selected) {
    const stances = cached.get(candidate.id)
    if (stances) classified.set(candidate.id, stances)
  }
  const todo = selected.filter((candidate) => !classified.has(candidate.id))
  await mapWithConcurrency(todo, JEV_CONCURRENCY, async (item) => {
    classified.set(item.id, await classifyWithJev({ id: item.id, text: item.text, tickers: item.assets }))
  })
  return selected.map((candidate) => ({
    ...candidate,
    stances: (classified.get(candidate.id) ?? [])
      .filter((stance) => (
        candidate.assets.includes(normalizeAsset(stance.asset)) &&
        (stance.stance === 'bull' || stance.stance === 'bear') &&
        stance.conviction >= 0.7
      ))
      .map((stance) => ({
        asset: normalizeAsset(stance.asset),
        direction: stance.stance === 'bull' ? 'BULL' as const : 'BEAR' as const,
        conviction: stance.conviction || 0.5,
      })),
  })).filter((tweet) => tweet.stances.length > 0)
}

export function filterIgnoredCashtags(handle: string, tweets: ClassifiedTweet[]): ClassifiedTweet[] {
  const ignored = ignoredCashtagsForHandle(handle)
  if (!ignored.size) return tweets

  return tweets
    .map((tweet) => ({
      ...tweet,
      stances: tweet.stances.filter((stance) => !ignored.has(normalizeAsset(stance.asset))),
    }))
    .filter((tweet) => tweet.stances.length > 0)
}

function loadLocalClassificationCache(): Map<string, RawStance[]> {
  const out = new Map<string, RawStance[]>()
  const dir = resolve(process.cwd(), '.cache/twitter')
  if (!existsSync(dir)) return out
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.llm.json'))) {
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

function ignoredCashtagsForHandle(handle: string): Set<string> {
  const normalizedHandle = String(handle ?? '').trim().toLowerCase()
  const out = new Set<string>()
  const rawConfig = optionalEnv('IGNORED_CASTAGS_BY_HANDLE') ?? optionalEnv('IGNORED_CASHTAGS_BY_HANDLE') ?? ''
  for (const rule of rawConfig.split(';')) {
    const [rawHandle, rawAssets] = rule.split(':')
    if (String(rawHandle ?? '').trim().toLowerCase() !== normalizedHandle) continue
    for (const asset of String(rawAssets ?? '').split(',')) {
      const normalizedAsset = normalizeAsset(asset)
      if (normalizedAsset !== '$UNKNOWN') out.add(normalizedAsset)
    }
  }
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
