import { resolveAssets, type AssetContext, type TickerRegistry } from '../assets'
import { getPriceSeries, hasFreshSeries, isOnchainSource, pricesAt, type PriceSeries } from '../pricing'
import type { ClassifiedTweet, Direction, HorizonStats, ResolvedAsset, ScoredCall, ScoredCallout, UserStats } from '../types'

export async function scoreCalls(
  handle: string,
  classifiedTweets: ClassifiedTweet[],
  // `resolved` holds instruments already settled for this handle, so they are not looked up again.
  // Assets outside it are skipped unless `resolveMissing` is set.
  // `settled` holds callouts whose three horizons are already final. They are reused as stored, never repriced,
  // so a result cannot drift once the venue stops serving the hourly prices it was scored on.
  options: {
    allowLlmAssetResolution?: boolean
    resolved?: Map<string, ResolvedAsset>
    resolveMissing?: boolean
    settled?: Map<string, SettledCallout>
    // What the registry already knows about tickers, looked up only for the ones that need resolving.
    registryFor?: (assets: string[]) => Promise<TickerRegistry>
    // Scores only these assets.
    only?: string[]
    // Leaves out on-chain tokens whose prices are not already in the store. Their venue is slow and rate limited,
    // so they are returned in `deferred` for the caller to score afterwards.
    deferSlow?: boolean
    onProgress?: (done: number, total: number) => void
  } = {},
  // `instruments` are the ones resolved on this run, for the caller to record, and `resolved` is every instrument
  // the run scored against.
): Promise<{ calls: ScoredCall[]; stats: UserStats; instruments: ResolvedAsset[]; resolved: Map<string, ResolvedAsset>; deferred: string[] }> {
  const maxAssets = Number(process.env.SCORING_MAX_ASSETS ?? 0)
  const assetsAll = [...new Set(classifiedTweets.flatMap((tweet) => tweet.stances.map((stance) => stance.asset)))]
  const wanted = options.only ? assetsAll.filter((asset) => options.only?.includes(asset)) : assetsAll
  const assets = maxAssets > 0 ? wanted.slice(0, maxAssets) : wanted
  const resolved = new Map(options.resolved)
  const instruments: ResolvedAsset[] = []
  if (!options.resolved || options.resolveMissing) {
    const missing = assets.filter((asset) => !resolved.has(asset))
    const known = [...resolved.values()]
    const found = await resolveAssets(missing, buildAssetContexts(classifiedTweets, missing), {
      allowLlm: options.allowLlmAssetResolution,
      registry: missing.length ? await options.registryFor?.(missing) : undefined,
      cryptoShare: known.length ? known.filter((instrument) => instrument.assetClass === 'crypto').length / known.length : undefined,
    })
    for (const [asset, instrument] of found) resolved.set(asset, instrument)
    instruments.push(...found.values())
  }
  const deferred: string[] = []
  if (options.deferSlow) {
    for (const asset of assets) {
      const instrument = resolved.get(asset)
      if (instrument && isOnchainSource(instrument.sourceId) && !(await hasFreshSeries(instrument))) deferred.push(asset)
    }
  }
  const now = assets.filter((asset) => !deferred.includes(asset))
  let done = 0
  const callGroups = await mapWithConcurrency(now, Number(process.env.PRICING_CONCURRENCY ?? 6), async (asset) => {
    const scored = await scoreAssetCalls(handle, asset, classifiedTweets, resolved, options.settled)
    options.onProgress?.(++done, now.length)
    return scored
  })
  const calls = callGroups.flat()

  calls.sort((a, b) => b.returnPct - a.returnPct)
  return { calls, stats: computeStats(handle, calls), instruments, resolved, deferred }
}

async function scoreAssetCalls(
  handle: string,
  asset: string,
  classifiedTweets: ClassifiedTweet[],
  resolved: Map<string, ResolvedAsset>,
  settled?: Map<string, SettledCallout>,
): Promise<ScoredCall[]> {
  const assetTweets = classifiedTweets
    .filter((tweet) => tweet.stances.some((stance) => stance.asset === asset))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  const resolvedAsset = resolved.get(asset)
  if (!assetTweets.length || !resolvedAsset) return []

  const series = await getPriceSeries(resolvedAsset, assetTweets[0].createdAt)
  if (!series) return []
  return callsFromSeries(handle, asset, resolvedAsset, assetTweets, series, Date.now(), settled)
}

// Prices every post on one asset. Each post that makes a call is its own call, as if $1,000 went into it.
export function callsFromSeries(
  handle: string,
  asset: string,
  resolvedAsset: ResolvedAsset,
  assetTweets: ClassifiedTweet[],
  series: PriceSeries,
  now = Date.now(),
  settled?: Map<string, SettledCallout>,
): ScoredCall[] {
  const stances = assetTweets.flatMap((tweet) => tweet.stances.filter((stance) => stance.asset === asset))
  const calls: ScoredCall[] = []
  for (const tweet of assetTweets) {
    for (const stance of tweet.stances) {
      if (stance.asset !== asset) continue
      const { direction } = stance
      const final = settled?.get(settledKey(tweet.id, asset, direction))
      const prices = final ? null : pricesAt(series, tweet.createdAt, now)
      if (!final && !prices) continue
      const entryPrice = final?.entryPrice ?? prices?.entry.price ?? 0
      const at = (exit: number | undefined) => exit === undefined ? null : directionalReturn(direction, entryPrice, exit)
      const callout: ScoredCallout = {
        tweetId: tweet.id,
        createdAt: new Date(tweet.createdAt).toISOString(),
        conviction: stance.conviction,
        entryPrice,
        entryAt: final?.entryAt ?? prices?.entry.pricedAt ?? new Date(tweet.createdAt).toISOString(),
        returnPct: directionalReturn(direction, entryPrice, series.current.price),
        return7d: final ? final.return7d : at(prices?.horizons[7]?.price),
        return30d: final ? final.return30d : at(prices?.horizons[30]?.price),
        return90d: final ? final.return90d : at(prices?.horizons[90]?.price),
      }
      calls.push({
        handle,
        asset,
        assetClass: resolvedAsset.assetClass,
        sourceId: resolvedAsset.sourceId,
        direction,
        firstPitchAt: callout.createdAt,
        firstTweetId: callout.tweetId,
        entryPrice,
        currentPrice: series.current.price,
        returnPct: callout.returnPct,
        return7d: callout.return7d,
        return30d: callout.return30d,
        return90d: callout.return90d,
        isUp: callout.returnPct > 0,
        mentions: 1,
        bulls: stances.filter((item) => item.direction === 'BULL').length,
        bears: stances.filter((item) => item.direction === 'BEAR').length,
        pricedAt: series.current.pricedAt,
        evidence: [tweet],
        callouts: [callout],
      })
    }
  }
  return calls
}

export type SettledCallout = { entryPrice: number; entryAt: string; return7d: number; return30d: number; return90d: number }

export function settledKey(tweetId: string, asset: string, direction: Direction) {
  return `${tweetId}|${asset}|${direction}`
}

export function computeStats(handle: string, calls: ScoredCall[]): UserStats {
  const returns = calls.map((call) => call.returnPct)
  const callsUp = calls.filter((call) => call.isUp).length
  return {
    handle,
    avgReturn: mean(returns) ?? 0,
    medianReturn: median(returns),
    hitRate: calls.length ? callsUp / calls.length : 0,
    callsTotal: calls.length,
    callsUp,
    horizons: {
      7: horizonStats(calls.map((call) => call.return7d)),
      30: horizonStats(calls.map((call) => call.return30d)),
      90: horizonStats(calls.map((call) => call.return90d)),
    },
  }
}

function horizonStats(returns: (number | null)[]): HorizonStats {
  const settled = returns.filter((value): value is number => value !== null)
  if (!settled.length) return { avgReturn: 0, medianReturn: 0, hitRate: 0, calls: 0 }
  return {
    avgReturn: mean(settled) ?? 0,
    medianReturn: median(settled),
    hitRate: settled.filter((value) => value > 0).length / settled.length,
    calls: settled.length,
  }
}

// Averages the values that have settled; null when none have.
function mean(values: (number | null)[]): number | null {
  const settled = values.filter((value): value is number => value !== null)
  return settled.length ? settled.reduce((sum, value) => sum + value, 0) / settled.length : null
}

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
}

// The move from entry to exit, with a bearish call counted as a short.
export function directionalReturn(direction: Direction, entry: number, exit: number) {
  return direction === 'BULL' ? (exit - entry) / entry : (entry - exit) / entry
}

// How many of an account's posts on a ticker are read to tell which instrument the ticker means.
const ASSET_CONTEXT_TWEETS = 5

export function buildAssetContexts(classifiedTweets: ClassifiedTweet[], assets: string[]) {
  const contexts = new Map<string, AssetContext>()
  for (const asset of assets) {
    const tweets = classifiedTweets
      .filter((tweet) => tweet.stances.some((stance) => stance.asset === asset))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, ASSET_CONTEXT_TWEETS)
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
