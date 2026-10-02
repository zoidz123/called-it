import { optionalEnv } from '../env'
import { onchainSource } from '../pricing'
import { spacedQueue } from '../spaced'
import { askJev } from '../typesafe'
import type { AssetClass, ResolvedAsset } from '../types'

type Provider = NonNullable<ResolvedAsset['provider']>
type ResolvedBy = NonNullable<ResolvedAsset['resolvedBy']>

export type AssetContext = {
  asset: string
  tweets: {
    id: string
    text: string
    createdAt: string
  }[]
}

type AssetCandidate = {
  provider: Provider
  symbol: string
  assetClass: AssetClass
  sourceId: string
  name: string | null
  exchange?: string
  quoteType?: string
  score: number
  // For an on-chain token: its contract, and the size of the pool it is priced from.
  address?: string
  liquidityUsd?: number
  volumeUsd?: number
}

// An on-chain pool below either of these is too thin to be what a post means, or to price a call against.
const MIN_ONCHAIN_LIQUIDITY_USD = 50_000
const MIN_ONCHAIN_VOLUME_USD = 10_000
// DexScreener's chain names where GeckoTerminal, which prices the pool, uses another.
const GECKO_NETWORKS: Record<string, string> = { ethereum: 'eth', polygon: 'polygon_pos', avalanche: 'avax', sui: 'sui-network' }
const CONTRACT_ADDRESS = /\b(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/g

const COMMON_ASSETS: Record<string, Omit<ResolvedAsset, 'symbol' | 'sourceId'> & { sourceId?: string }> = {
  BTC: crypto('Bitcoin'),
  ETH: crypto('Ethereum'),
  SOL: crypto('Solana'),
  SOLS: equity('Solstice Advanced Materials, Inc.'),
  HYPE: crypto('Hyperliquid'),
  DOGE: crypto('Dogecoin'),
  LINK: crypto('Chainlink'),
  AVAX: crypto('Avalanche'),
  SUI: crypto('Sui'),
  XRP: crypto('XRP'),
  BNB: crypto('BNB'),
  PEPE: crypto('Pepe'),
  WIF: crypto('dogwifhat'),
  BONK: crypto('Bonk'),
  TIA: crypto('Celestia'),
  ARB: crypto('Arbitrum'),
  OP: crypto('Optimism'),
  NDX: { ...crypto('Nasdaq 100 proxy'), sourceId: 'XYZ100' },
  AAPL: equity('Apple Inc.'),
  MSFT: equity('Microsoft Corporation'),
  NVDA: equity('NVIDIA Corporation'),
  AMZN: equity('Amazon.com, Inc.'),
  GOOGL: equity('Alphabet Inc.'),
  GOOG: equity('Alphabet Inc.'),
  META: equity('Meta Platforms, Inc.'),
  TSLA: equity('Tesla, Inc.'),
  AMD: equity('Advanced Micro Devices, Inc.'),
  ARM: equity('Arm Holdings plc'),
  MU: equity('Micron Technology Inc.'),
  AVGO: equity('Broadcom Inc.'),
  TSM: equity('Taiwan Semiconductor Manufacturing Company Limited'),
  INTC: equity('Intel Corporation'),
  RDDT: equity('Reddit, Inc.'),
  HOOD: equity('Robinhood Markets, Inc.'),
  CRWV: equity('CoreWeave, Inc.'),
  CRCL: equity('Circle Internet Group, Inc.'),
  COHR: equity('Coherent Corp.'),
  IBKR: equity('Interactive Brokers Group, Inc.'),
  NFLX: equity('Netflix, Inc.'),
  ORCL: equity('Oracle Corporation'),
  PLTR: equity('Palantir Technologies Inc.'),
  MSTR: equity('MicroStrategy Incorporated'),
  COIN: equity('Coinbase Global, Inc.'),
  SMCI: equity('Super Micro Computer, Inc.'),
  ASML: equity('ASML Holding N.V.'),
  QCOM: equity('QUALCOMM Incorporated'),
  MRVL: equity('Marvell Technology, Inc.'),
  SIVE: equity('Sivers Semiconductors AB', 'SIVE.ST'),
  SOI: equity('Soitec S.A.', 'SOI.PA'),
  LPK: equity('LPKF Laser & Electronics SE', '0ND2.IL'),
  IQE: equity('IQE plc', 'IQE.L'),
  XFAB: equity('X-FAB Silicon Foundries SE', 'XFAB.PA'),
  RPI: equity('Raspberry Pi Holdings plc', 'RPI.L'),
  AMAT: equity('Applied Materials, Inc.'),
  LRCX: equity('Lam Research Corporation'),
  KLAC: equity('KLA Corporation'),
  JPM: equity('JPMorgan Chase & Co.'),
  BAC: equity('Bank of America Corporation'),
  SPY: equity('SPDR S&P 500 ETF Trust'),
  SPX: equity('S&P 500 proxy', 'SPY'),
  QQQ: equity('Invesco QQQ Trust'),
}

const yahooSearchCache = new Map<string, Promise<AssetCandidate[]>>()
let hyperliquidMidsPromise: Promise<Record<string, string>> | null = null
const onchainSearchCache = new Map<string, Promise<AssetCandidate[]>>()
// DexScreener allows 300 searches a minute; a first scan can ask about hundreds of tickers at once.
const dexQueue = spacedQueue(220)
// A first scan can ask Yahoo about hundreds of tickers at once, which it answers with errors unless they are spaced.
const yahooQueue = spacedQueue(120)

export async function resolveAssets(
  symbols: string[],
  contexts: Map<string, AssetContext> = new Map(),
  // `cryptoShare` is the share of the account's already settled instruments that are crypto, where known.
  options: { allowLlm?: boolean; cryptoShare?: number } = {},
): Promise<Map<string, ResolvedAsset>> {
  const out = new Map<string, ResolvedAsset>()
  const unique = [...new Set(symbols.map((symbol) => cleanSymbol(symbol)).filter(Boolean))]
  const unresolved: string[] = []

  for (const raw of unique) {
    const common = COMMON_ASSETS[raw]
    if (common) {
      out.set(`$${raw}`, {
        symbol: `$${raw}`,
        assetClass: common.assetClass,
        sourceId: common.sourceId ?? raw,
        name: common.name,
        provider: common.provider,
        resolvedBy: 'common',
        confidence: 1,
      })
    } else {
      unresolved.push(raw)
    }
  }

  if (!unresolved.length) return out

  const candidateEntries = await Promise.all(unresolved.map(async (raw) => [raw, await getCandidates(raw, contexts.get(`$${raw}`))] as const))
  const ambiguous: { raw: string; candidates: AssetCandidate[]; context: AssetContext | undefined }[] = []

  for (const [raw, candidates] of candidateEntries) {
    const resolved = resolveByRules(raw, candidates)
    if (resolved) {
      out.set(`$${raw}`, toResolvedAsset(raw, resolved, 'rule'))
      continue
    }
    if (candidates.length) ambiguous.push({ raw, candidates, context: contexts.get(`$${raw}`) })
  }

  const llmResolved = options.allowLlm === false ? new Map<string, AssetCandidate>() : await resolveWithLlm(ambiguous, options.cryptoShare)
  for (const [raw, candidate] of llmResolved) {
    out.set(`$${raw}`, toResolvedAsset(raw, candidate, 'llm'))
  }
  // Where the posts did not settle it, an account that calls almost only stocks, or almost only crypto, means that
  // kind. Anything else stays unpriced: no price is better than the wrong instrument's.
  for (const { raw, candidates } of ambiguous) {
    if (out.has(`$${raw}`)) continue
    const usual = resolveByHabit(raw, candidates, options.cryptoShare)
    if (usual) out.set(`$${raw}`, toResolvedAsset(raw, usual, 'rule'))
  }

  return out
}

function crypto(name: string) {
  return { assetClass: 'crypto' as const, provider: 'hyperliquid' as const, name }
}

function equity(name: string, sourceId?: string) {
  return { assetClass: 'stock' as const, provider: 'yahoo' as const, name, sourceId }
}

async function getCandidates(raw: string, context?: AssetContext): Promise<AssetCandidate[]> {
  const [yahoo, hyperliquid, pools] = await Promise.all([yahooSearch(raw), hyperliquidCandidate(raw), onchainSearch(raw)])
  // A token that is the listed company's stock in tokenized form is not a separate instrument: the exchange listing
  // stays the one that is priced.
  const listed = yahoo.find((candidate) => cleanSymbol(candidate.symbol) === raw)
  const token = pickOnchain(listed ? pools.filter((pool) => !isTokenizedStock(listed.name, pool.name)) : pools, context?.tweets.map((tweet) => tweet.text) ?? [])
  // A coin with a Hyperliquid perpetual is priced there; its on-chain pools are mostly bridged copies. Only a
  // contract address quoted in the posts puts a token ahead of it.
  const onchain = token && (token.pinned || !hyperliquid.length) ? [token] : []
  return [...yahoo, ...hyperliquid, ...onchain].sort((a, b) => b.score - a.score)
}

type OnchainCandidate = AssetCandidate & { pinned?: boolean }

async function onchainSearch(raw: string): Promise<AssetCandidate[]> {
  const cached = onchainSearchCache.get(raw)
  if (cached) return cached
  const request = fetchOnchainSearch(raw)
  onchainSearchCache.set(raw, request)
  return request
}

// Every pool DexScreener lists for a token with exactly this symbol, thick enough to mean something.
async function fetchOnchainSearch(raw: string): Promise<AssetCandidate[]> {
  try {
    const response = await dexQueue(() => fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(raw)}`))
    if (!response.ok) throw new Error(`DexScreener search ${response.status}`)
    const json = await response.json()
    return (json.pairs ?? [])
      .filter((pair: any) => String(pair?.baseToken?.symbol ?? '').toUpperCase() === raw && pair?.pairAddress && pair?.chainId)
      .map((pair: any): AssetCandidate => ({
        provider: 'geckoterminal',
        symbol: raw,
        assetClass: 'crypto',
        sourceId: onchainSource(GECKO_NETWORKS[pair.chainId] ?? pair.chainId, pair.pairAddress, pair.baseToken.address),
        name: pair.baseToken.name ?? raw,
        exchange: pair.chainId,
        quoteType: 'TOKEN',
        score: 5_000_000,
        address: String(pair.baseToken.address),
        liquidityUsd: Number(pair.liquidity?.usd) || 0,
        volumeUsd: Number(pair.volume?.h24) || 0,
      }))
      .filter((pool: AssetCandidate) => (pool.liquidityUsd ?? 0) >= MIN_ONCHAIN_LIQUIDITY_USD && (pool.volumeUsd ?? 0) >= MIN_ONCHAIN_VOLUME_USD)
  } catch (error) {
    if (optionalEnv('DEBUG_PRICING') === '1') console.warn('DexScreener search failed', raw, error)
    return []
  }
}

// The one on-chain token a ticker could mean. A contract address quoted in the posts settles it outright. Otherwise
// it is the most traded pool: many tokens share a symbol, and liquidity alone is inflated by pools nobody trades.
export function pickOnchain(pools: AssetCandidate[], texts: string[]): OnchainCandidate | null {
  const byVolume = [...pools].sort((a, b) => (b.volumeUsd ?? 0) - (a.volumeUsd ?? 0) || (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0))
  const quoted = new Set(texts.flatMap((text) => text.match(CONTRACT_ADDRESS) ?? []).map((address) => address.toLowerCase()))
  const pinned = byVolume.find((pool) => pool.address && quoted.has(pool.address.toLowerCase()))
  return pinned ? { ...pinned, pinned: true } : byVolume[0] ?? null
}

const TOKENIZED_STOCK = /robinhood token|tokenized|xstock|backed|securities|ondo|dinari/i

// Whether a token is a listed company's stock in tokenized form: it carries the company's name ("Micron Technology -
// Backed") or an issuer's label ("IBM • Robinhood Token").
export function isTokenizedStock(listedName: string | null, tokenName: string | null) {
  const token = String(tokenName ?? '')
  const word = String(listedName ?? '').toLowerCase().match(/[a-z0-9]+/)?.[0] ?? ''
  return TOKENIZED_STOCK.test(token) || (word.length >= 3 && token.toLowerCase().includes(word))
}

async function yahooSearch(raw: string): Promise<AssetCandidate[]> {
  const cached = yahooSearchCache.get(raw)
  if (cached) return cached
  const request = fetchYahooSearch(raw)
  yahooSearchCache.set(raw, request)
  return request
}

async function fetchYahooSearch(raw: string): Promise<AssetCandidate[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(raw)}&quotesCount=8&newsCount=0&enableFuzzyQuery=false`
    const response = await yahooQueue(() => fetch(url, { headers: yahooHeaders() }))
    if (!response.ok) throw new Error(`Yahoo search ${response.status}`)
    const json = await response.json()
    return (json.quotes ?? [])
      .filter((quote: any) => quote?.symbol && ['EQUITY', 'ETF'].includes(String(quote.quoteType ?? '')))
      .map((quote: any): AssetCandidate => ({
        provider: 'yahoo',
        symbol: String(quote.symbol).toUpperCase(),
        assetClass: 'stock',
        sourceId: String(quote.symbol).toUpperCase(),
        name: quote.shortname ?? quote.longname ?? null,
        exchange: quote.exchange,
        quoteType: quote.quoteType,
        score: Number(quote.score) || 0,
      }))
  } catch (error) {
    if (optionalEnv('DEBUG_PRICING') === '1') console.warn('Yahoo search failed', raw, error)
    // A failed search is not remembered, or the ticker would look unlisted for as long as the process lives.
    yahooSearchCache.delete(raw)
    return []
  }
}

async function hyperliquidCandidate(raw: string): Promise<AssetCandidate[]> {
  try {
    const mids = await getHyperliquidMids()
    return mids[raw] ? [{
      provider: 'hyperliquid',
      symbol: raw,
      assetClass: 'crypto',
      sourceId: raw,
      name: raw,
      quoteType: 'PERP',
      score: 10_000_000,
    }] : []
  } catch (error) {
    if (optionalEnv('DEBUG_PRICING') === '1') console.warn('Hyperliquid candidate failed', raw, error)
    return []
  }
}

async function getHyperliquidMids() {
  if (!hyperliquidMidsPromise) {
    hyperliquidMidsPromise = fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'allMids' }),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Hyperliquid mids ${response.status}`)
      return response.json()
    })
  }
  return hyperliquidMidsPromise
}

// Settles a ticker without reading the posts when only one venue knows it, or when the posts quote a token's
// contract. A ticker more than one venue knows is left for the posts to decide.
export function resolveByRules(raw: string, candidates: (AssetCandidate & { pinned?: boolean })[]) {
  const onchain = candidates.find((candidate) => candidate.provider === 'geckoterminal')
  if (onchain?.pinned) return onchain
  const yahooExact = candidates.find((candidate) => candidate.provider === 'yahoo' && cleanSymbol(candidate.symbol) === raw)
  const hyperliquidExact = candidates.find((candidate) => candidate.provider === 'hyperliquid' && candidate.symbol === raw)
  const exact = [yahooExact, hyperliquidExact, onchain].filter((candidate) => candidate !== undefined)
  // A lone on-chain match still goes to the posts: a thin token can share a symbol with something unlisted.
  return exact.length === 1 && exact[0] !== onchain ? exact[0] : null
}

async function resolveWithLlm(items: { raw: string; candidates: AssetCandidate[]; context: AssetContext | undefined }[], cryptoShare?: number) {
  const out = new Map<string, AssetCandidate>()
  if (!items.length || optionalEnv('ASSET_RESOLUTION_LLM_ENABLED') === '0') return out

  await Promise.all(items.map(async (item) => {
    try {
      const candidates = item.candidates.slice(0, 6)
      const answers = await askJev(
        {
          cashtag: `$${item.raw}`,
          tweets: item.context?.tweets.map((tweet) => tweet.text) ?? [],
          ...(cryptoShare === undefined ? {} : { account: `${Math.round(cryptoShare * 100)}% of the instruments this account has called before are crypto; the rest are stocks and ETFs.` }),
        },
        {
          instrument: {
            type: 'choice',
            instructions: 'Which priced instrument does `cashtag` refer to in `tweets`? Match the company or project, sector, market and asset type the tweets describe. The other tickers in the same tweets are strong evidence: a ticker listed among stocks is the stock, and one listed among crypto tokens, memecoins or chain names is the token. Weigh what `account` usually calls only when the tweets leave it open.',
            criteria: {
              ...Object.fromEntries(candidates.map((candidate, index) => [String(index), describeCandidate(candidate)])),
              ambiguous: 'The tweets do not clearly identify any one of the listed instruments.',
            },
          },
        },
      )
      const answer = answers.instrument
      const candidate = candidates[Number(answer?.choice)]
      const confidence = Number(answer?.probabilities?.[answer?.choice ?? '']) || 0
      if (!candidate || confidence < 0.65) return
      out.set(item.raw, { ...candidate, score: Math.max(candidate.score, confidence * 1_000_000) })
    } catch (error) {
      if (optionalEnv('DEBUG_PRICING') === '1') console.warn('asset LLM resolution failed', error)
    }
  }))
  return out
}

// An account this one-sided is taken to mean its usual kind of instrument when the posts leave a ticker open.
const HABIT_SHARE = 0.8

export function resolveByHabit(raw: string, candidates: AssetCandidate[], cryptoShare?: number) {
  if (cryptoShare === undefined) return null
  const exact = candidates.filter((candidate) => cleanSymbol(candidate.symbol) === raw)
  if (cryptoShare <= 1 - HABIT_SHARE) return exact.find((candidate) => candidate.assetClass === 'stock') ?? null
  if (cryptoShare >= HABIT_SHARE) return exact.find((candidate) => candidate.assetClass === 'crypto') ?? null
  return null
}

function describeCandidate(candidate: AssetCandidate) {
  if (candidate.provider === 'geckoterminal') {
    return { kind: 'crypto token traded on-chain', symbol: candidate.symbol, name: candidate.name, chain: candidate.exchange, dailyVolumeUsd: Math.round(candidate.volumeUsd ?? 0) }
  }
  if (candidate.provider === 'hyperliquid') return { kind: 'crypto token with a perpetual on Hyperliquid', symbol: candidate.symbol }
  return { kind: candidate.quoteType === 'ETF' ? 'exchange-traded fund' : 'listed company stock', symbol: candidate.symbol, name: candidate.name, exchange: candidate.exchange }
}

function toResolvedAsset(raw: string, candidate: AssetCandidate, resolvedBy: ResolvedBy): ResolvedAsset {
  return {
    symbol: `$${raw}`,
    assetClass: candidate.assetClass,
    sourceId: candidate.sourceId,
    name: candidate.name,
    provider: candidate.provider,
    resolvedBy,
    confidence: Math.min(1, Math.max(0.5, candidate.score / 1_000_000)),
  }
}

function yahooHeaders(): HeadersInit {
  return { 'User-Agent': 'Mozilla/5.0' }
}

function cleanSymbol(symbol: string): string {
  return String(symbol ?? '').replace(/^\$+/, '').trim().toUpperCase()
}
