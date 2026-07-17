import { describe, expect, test } from 'bun:test'
import { resolveApiUrl } from './api'

describe('resolveApiUrl', () => {
  test('uses the local API during development', () => {
    expect(resolveApiUrl({ nodeEnv: 'development' })).toBe('http://127.0.0.1:3001')
  })

  test('requires explicit production configuration', () => {
    expect(() => resolveApiUrl({ configuredUrl: '', nodeEnv: 'production' })).toThrow('Missing NEXT_PUBLIC_API_URL')
  })

  test('allows an unavailable API in preview without choosing a production backend', () => {
    expect(resolveApiUrl({ configuredUrl: '', nodeEnv: 'production', vercelEnv: 'preview' })).toBeNull()
  })

  test('normalizes a configured URL', () => {
    expect(resolveApiUrl({ configuredUrl: 'https://api.example.com/' })).toBe('https://api.example.com')
  })

  test('rejects embedded credentials', () => {
    expect(() => resolveApiUrl({ configuredUrl: 'https://user:pass@example.com' })).toThrow('without credentials')
  })
})
