import { describe, expect, test } from 'bun:test'
import { corsOrigin, scanIsConfigured } from './config'

describe('API configuration', () => {
  test('fails closed when a production CORS allowlist is missing', () => {
    expect(() => corsOrigin({ NODE_ENV: 'production' })).toThrow('Missing CORS_ORIGIN')
  })

  test('parses explicit CORS origins', () => {
    expect(corsOrigin({ NODE_ENV: 'production', CORS_ORIGIN: 'https://app.example.com, https://admin.example.com' }))
      .toEqual(['https://app.example.com', 'https://admin.example.com'])
  })

  test('enables scans only when both providers are configured', () => {
    expect(scanIsConfigured({ OPENAI_API_KEY: 'configured', TWITTERAPI_IO_API_KEYS: 'configured' })).toBe(true)
    expect(scanIsConfigured({ OPENAI_API_KEY: 'configured' })).toBe(false)
  })

  test('disables scan routes with the worker', () => {
    expect(scanIsConfigured({
      OPENAI_API_KEY: 'configured',
      TWITTERAPI_IO_API_KEYS: 'configured',
      SCAN_WORKER_ENABLED: 'false',
    })).toBe(false)
  })
})
