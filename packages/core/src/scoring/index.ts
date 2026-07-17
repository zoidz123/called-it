import { resolveAssets, type AssetContext } from '../assets'
import { getEntryAndCurrentPrices } from '../pricing'
import type { ClassifiedTweet, Direction, ResolvedAsset, ScoredCall, UserStats } from '../types'

export async function scoreCalls(
  handle: string,
  classifiedTweets: ClassifiedTweet[],
  options: { allowLlmAssetResolution?: boolean } = {},
): Promise<{ calls: ScoredCall[]; stats: UserStats }> {
  const maxAssets = Number(process.env.SCORING_MAX_ASSETS ?? 0)
  const assetsAll = [...new Set(classifiedTweets.flatMap((tweet) => tweet.stances.map((stance) => stance.asset)))]
  const assets = maxAssets > 0 ? assetsAll.slice(0, maxAssets) : assetsAll
  const resolved = await resolveAssets(assets, buildAssetContexts(classifiedTweets, assets), { allowLlm: options.allowLlmAssetResolution })
  const callGroups = await mapWithConcurrency(assets, Number(process.env.PRICING_CONCURRENCY ?? 6), async (asset) => {
    return scoreAssetCalls(handle, asset, classifiedTweets, resolved)
  })
  const calls = callGroups.flat().filter(Boolean) as ScoredCall[]

  calls.sort((a, b) => b.returnPct - a.returnPct)
  return { calls, stats: computeStats(handle, calls) }
}

export async function refreshExistingCallPrices(
  existingCalls: Array<Omit<ScoredCall, 'evidence'> & { id?: string }>,
): Promise<ScoredCall[]> {
  const refreshed = await mapWithConcurrency(existingCalls, Number(process.env.PRICING_CONCURRENCY ?? 6), async (call) => {
    const resolvedAsset: ResolvedAsset = {
      symbol: call.asset,
      assetClass: call.assetClass,
      sourceId: call.sourceId,
      name: null,
      provider: call.assetClass === 'crypto' ? 'hyperliquid' : 'yahoo',
    }
    const prices = await getEntryAndCurrentPrices(resolvedAsset, call.firstPitchAt)
    if (!prices) return null

    const returnPct = call.direction === 'BULL'
      ? (prices.current.price - prices.entry.price) / prices.entry.price
      : (prices.entry.price - prices.current.price) / prices.entry.price

    return {
      ...call,
      entryPrice: prices.entry.price,
      currentPrice: prices.current.price,
      returnPct,
      isUp: returnPct > 0,
      pricedAt: prices.current.pricedAt,
      evidence: [],
    }
  })
  return refreshed.filter(Boolean) as ScoredCall[]
}

async function scoreAssetCalls(
  handle: string,
  asset: string,
  classifiedTweets: ClassifiedTweet[],
  resolved: Awaited<ReturnType<typeof resolveAssets>>,
): Promise<ScoredCall[]> {
  const assetTweets = classifiedTweets
    .filter((tweet) => tweet.stances.some((stance) => stance.asset === asset))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  const resolvedAsset = resolved.get(asset)
  if (!assetTweets.length || !resolvedAsset) return []

  const stances = assetTweets.flatMap((tweet) => tweet.stances.filter((stance) => stance.asset === asset))
  const calls = await Promise.all((['BULL', 'BEAR'] as const).map(async (direction) => {
    return scoreDirectionalAssetCall({
      handle,
      asset,
      direction,
      assetTweets,
      stances,
      resolvedAsset,
    })
  }))

  return calls.filter(Boolean) as ScoredCall[]
}

async function scoreDirectionalAssetCall({
  handle,
  asset,
  direction,
  assetTweets,
  stances,
  resolvedAsset,
}: {
  handle: string
  asset: string
  direction: Direction
  assetTweets: ClassifiedTweet[]
  stances: { asset: string; direction: Direction; conviction: number }[]
  resolvedAsset: ResolvedAsset
}): Promise<ScoredCall | null> {
  const directionTweets = assetTweets.filter((tweet) =>
    tweet.stances.some((stance) => stance.asset === asset && stance.direction === direction),
  )
  const first = directionTweets[0]
  if (!first) return null

  const prices = await getEntryAndCurrentPrices(resolvedAsset, first.createdAt)
  if (!prices) return null

  const returnPct = direction === 'BULL'
    ? (prices.current.price - prices.entry.price) / prices.entry.price
    : (prices.entry.price - prices.current.price) / prices.entry.price
  return {
    handle,
    asset,
    assetClass: resolvedAsset.assetClass,
    sourceId: resolvedAsset.sourceId,
    direction,
    firstPitchAt: first.createdAt,
    firstTweetId: first.id,
    entryPrice: prices.entry.price,
    currentPrice: prices.current.price,
    returnPct,
    isUp: returnPct > 0,
    mentions: assetTweets.length,
    bulls: stances.filter((stance) => stance.direction === 'BULL').length,
    bears: stances.filter((stance) => stance.direction === 'BEAR').length,
    pricedAt: prices.current.pricedAt,
    evidence: directionTweets.slice(0, 2),
  }
}

export function computeStats(handle: string, calls: ScoredCall[]): UserStats {
  const returns = calls.map((call) => call.returnPct)
  const avgReturn = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0
  const sorted = [...returns].sort((a, b) => a - b)
  const medianReturn = sorted.length
    ? sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : 0
  const callsUp = calls.filter((call) => call.isUp).length
  return {
    handle,
    avgReturn,
    medianReturn,
    hitRate: calls.length ? callsUp / calls.length : 0,
    callsTotal: calls.length,
    callsUp,
  }
}

function buildAssetContexts(classifiedTweets: ClassifiedTweet[], assets: string[]) {
  const contexts = new Map<string, AssetContext>()
  for (const asset of assets) {
    const tweets = classifiedTweets
      .filter((tweet) => tweet.stances.some((stance) => stance.asset === asset))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, 3)
      .map((tweet) => ({ id: tweet.id, text: tweet.text, createdAt: tweet.createdAt }))
    contexts.set(asset, { asset, tweets })
  }
  return contexts
}

async function mapWithConcurrency<T, R>(
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
