import { expect, test } from 'bun:test'
import { isTokenizedStock, pickOnchain, resolveByRules } from './index'

const pool = (fields: Record<string, unknown>) => ({
  provider: 'geckoterminal' as const,
  symbol: 'MOO',
  assetClass: 'crypto' as const,
  sourceId: 'gt:robinhood:0xpool:0xtoken',
  name: 'Memory cow Moo',
  score: 5_000_000,
  address: '0xD9dB30BB0D2b8d2eae3826A1372117E058791e18',
  liquidityUsd: 100_000,
  volumeUsd: 100_000,
  ...fields,
})
const stock = { provider: 'yahoo' as const, symbol: 'MOO', assetClass: 'stock' as const, sourceId: 'MOO', name: 'VanEck Agribusiness ETF', score: 1 }
const perp = { provider: 'hyperliquid' as const, symbol: 'MOO', assetClass: 'crypto' as const, sourceId: 'MOO', name: 'MOO', score: 1 }

test('picks the most traded pool, not the one with the most liquidity', () => {
  const idle = pool({ name: 'Idle', liquidityUsd: 720_000_000, volumeUsd: 20_000 })
  const traded = pool({ name: 'Traded', liquidityUsd: 6_000_000, volumeUsd: 10_000_000 })
  expect(pickOnchain([idle, traded], [])?.name).toBe('Traded')
  expect(pickOnchain([], [])).toBeNull()
})

test('a contract address quoted in the posts settles which token it is', () => {
  const big = pool({ name: 'Big', volumeUsd: 9_000_000, address: '0x1111111111111111111111111111111111111111' })
  const quoted = pool({ name: 'Quoted', volumeUsd: 50_000, address: '0x2222222222222222222222222222222222222222' })
  const picked = pickOnchain([big, quoted], ['aping $MOO ca: 0x2222222222222222222222222222222222222222'])
  expect(picked?.name).toBe('Quoted')
  expect(picked?.pinned).toBe(true)
  expect(resolveByRules('MOO', [stock, { ...quoted, pinned: true }])?.name).toBe('Quoted')
})

test('recognises a tokenized stock by the company name or the issuer label', () => {
  expect(isTokenizedStock('Micron Technology Inc.', 'Micron Technology - Backed')).toBe(true)
  expect(isTokenizedStock('International Business Machines', 'IBM • Robinhood Token')).toBe(true)
  expect(isTokenizedStock('VanEck Agribusiness ETF', 'Memory cow Moo')).toBe(false)
  expect(isTokenizedStock('BP p.l.c.', 'Backpack')).toBe(false)
})

test('settles a ticker by rule only when a single listed venue knows it', () => {
  expect(resolveByRules('MOO', [stock])).toBe(stock)
  expect(resolveByRules('MOO', [perp])).toBe(perp)
  // A stock and a token share the symbol, so the posts must decide.
  expect(resolveByRules('MOO', [stock, pool({})])).toBeNull()
  expect(resolveByRules('MOO', [stock, perp])).toBeNull()
  // A lone on-chain match is not trusted without the posts either.
  expect(resolveByRules('MOO', [pool({})])).toBeNull()
})

test('a lone on-chain match or a shared symbol never settles by rule, so the posts or the registry decide', () => {
  expect(resolveByRules('MOO', [stock, perp, pool({})])).toBeNull()
})
