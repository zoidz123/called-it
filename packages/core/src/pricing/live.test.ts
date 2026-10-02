import { expect, test } from 'bun:test'
import { liveQuote } from './index'

const mids = { BTC: 85000, 'xyz:XYZ100': 24500, 'xyz:MU': 1092, 'xyz:GOLD': 4171 }

test('quotes crypto by its coin name', () => {
  expect(liveQuote({ asset_class: 'crypto', source_id: 'BTC' }, mids)).toEqual({ coin: 'BTC', price: 85000 })
})

test('finds an index that Hyperliquid lists on its stock venue', () => {
  expect(liveQuote({ asset_class: 'crypto', source_id: 'XYZ100' }, mids)).toEqual({ coin: 'xyz:XYZ100', price: 24500 })
})

test('quotes a stock from the stock venue when it agrees with the last close', () => {
  expect(liveQuote({ asset_class: 'stock', source_id: 'MU' }, mids, 1097)).toEqual({ coin: 'xyz:MU', price: 1092 })
})

test('rejects a stock quote that is really another instrument with the same ticker', () => {
  expect(liveQuote({ asset_class: 'stock', source_id: 'GOLD' }, mids, 21)).toBeNull()
})

test('has no quote for a stock without a last close to check against, or one Hyperliquid does not list', () => {
  expect(liveQuote({ asset_class: 'stock', source_id: 'MU' }, mids)).toBeNull()
  expect(liveQuote({ asset_class: 'stock', source_id: 'QQQ' }, mids, 742)).toBeNull()
  expect(liveQuote({ asset_class: 'crypto', source_id: 'NOPE' }, mids)).toBeNull()
})
