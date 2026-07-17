import { optionalEnv, requiredEnv } from '../env'
import type { AssetClass, ResolvedAsset } from '../types'

type Provider = 'yahoo' | 'hyperliquid'
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
}

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

export async function resolveAssets(symbols: string[], contexts: Map<string, AssetContext> = new Map()): Promise<Map<string, ResolvedAsset>> {
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

  const candidateEntries = await Promise.all(unresolved.map(async (raw) => [raw, await getCandidates(raw)] as const))
  const ambiguous: { raw: string; candidates: AssetCandidate[]; context: AssetContext | undefined }[] = []

  for (const [raw, candidates] of candidateEntries) {
    const resolved = resolveByRules(raw, candidates)
    if (resolved) {
      out.set(`$${raw}`, toResolvedAsset(raw, resolved, 'rule'))
      continue
    }
    if (candidates.length) ambiguous.push({ raw, candidates, context: contexts.get(`$${raw}`) })
  }

  const llmResolved = await resolveWithLlm(ambiguous)
  for (const [raw, candidate] of llmResolved) {
    out.set(`$${raw}`, toResolvedAsset(raw, candidate, 'llm'))
  }

  return out
}

function crypto(name: string) {
  return { assetClass: 'crypto' as const, provider: 'hyperliquid' as const, name }
}

function equity(name: string, sourceId?: string) {
  return { assetClass: 'stock' as const, provider: 'yahoo' as const, name, sourceId }
}

async function getCandidates(raw: string): Promise<AssetCandidate[]> {
  const [yahoo, hyperliquid] = await Promise.all([yahooSearch(raw), hyperliquidCandidate(raw)])
  return [...yahoo, ...hyperliquid].sort((a, b) => b.score - a.score)
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
    const response = await fetch(url, { headers: yahooHeaders() })
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

function resolveByRules(raw: string, candidates: AssetCandidate[]) {
  const yahooExact = candidates.find((candidate) => candidate.provider === 'yahoo' && cleanSymbol(candidate.symbol) === raw)
  const hyperliquidExact = candidates.find((candidate) => candidate.provider === 'hyperliquid' && candidate.symbol === raw)
  if (yahooExact && hyperliquidExact) return null
  if (yahooExact) return yahooExact
  if (hyperliquidExact) return hyperliquidExact
  return null
}

async function resolveWithLlm(items: { raw: string; candidates: AssetCandidate[]; context: AssetContext | undefined }[]) {
  const out = new Map<string, AssetCandidate>()
  if (!items.length || optionalEnv('ASSET_RESOLUTION_LLM_ENABLED') === '0') return out

  try {
    const apiKey = requiredEnv('OPENAI_API_KEY')
    const model = optionalEnv('OPENAI_MODEL') ?? 'gpt-5.4'
    const payload = items.map((item) => ({
      cashtag: `$${item.raw}`,
      tweets: item.context?.tweets.slice(0, 3) ?? [],
      candidates: item.candidates.slice(0, 6).map((candidate, index) => ({
        id: String(index),
        provider: candidate.provider,
        symbol: candidate.symbol,
        assetClass: candidate.assetClass,
        name: candidate.name,
        exchange: candidate.exchange,
        quoteType: candidate.quoteType,
      })),
    }))
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: ASSET_RESOLUTION_PROMPT },
          { role: 'user', content: JSON.stringify({ items: payload }) },
        ],
      }),
    })
    if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 240)}`)
    const parsed = JSON.parse((await response.json()).choices?.[0]?.message?.content ?? '{}')
    for (const result of parsed.results ?? []) {
      const raw = cleanSymbol(result.cashtag)
      const source = items.find((item) => item.raw === raw)
      const index = Number(result.selectedCandidateId)
      const confidence = Number(result.confidence) || 0
      if (!source || !Number.isInteger(index) || confidence < 0.65) continue
      const candidate = source.candidates[index]
      if (candidate) out.set(raw, { ...candidate, score: Math.max(candidate.score, confidence * 1_000_000) })
    }
  } catch (error) {
    if (optionalEnv('DEBUG_PRICING') === '1') console.warn('asset LLM resolution failed', error)
  }
  return out
}

const ASSET_RESOLUTION_PROMPT = `You resolve financial cashtags to priced instruments.

You are given one cashtag, tweet context, and candidate instruments from Yahoo Finance and Hyperliquid.
Pick ONLY one candidate id from the provided candidates when the tweet context clearly identifies it.
Prefer the candidate whose company/project matches the tweet context, sector, market, and asset type.
Do not invent symbols. If context is insufficient or candidates are not a clear match, mark ambiguous.

Reply ONLY with JSON:
{"results":[{"cashtag":"$TOWA","selectedCandidateId":"0|null","confidence":0.0,"ambiguous":true,"reason":"short reason"}]}`

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
