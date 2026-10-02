import { describe, expect, test } from 'bun:test'
import { corsOrigin, scanIsConfigured, visitorAddress } from './config'

describe('visitorAddress', () => {
  test('takes the address the edge reports, whatever the forwarding chain says', () => {
    // What Railway sends: the chain ends with a rotating edge server, so only X-Real-IP identifies the visitor.
    expect(visitorAddress({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '203.0.113.9, 84.17.44.228' }, '100.64.0.2')).toBe('203.0.113.9')
    expect(visitorAddress({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '203.0.113.9, 84.17.44.225' }, '100.64.0.3')).toBe('203.0.113.9')
  })

  test('falls back to the connection when no proxy is in front', () => {
    expect(visitorAddress({}, '127.0.0.1')).toBe('127.0.0.1')
    expect(visitorAddress({ 'x-real-ip': '  ' }, undefined)).toBe('unknown')
  })
})

describe('API configuration', () => {
  test('fails closed when a production CORS allowlist is missing', () => {
    expect(() => corsOrigin({ NODE_ENV: 'production' })).toThrow('Missing CORS_ORIGIN')
  })

  test('parses explicit CORS origins', () => {
    expect(corsOrigin({ NODE_ENV: 'production', CORS_ORIGIN: 'https://app.example.com, https://admin.example.com' }))
      .toEqual(['https://app.example.com', 'https://admin.example.com'])
  })

  test('enables scans only when both providers are configured', () => {
    expect(scanIsConfigured({ TYPESAFE_API_KEY: 'configured', TWITTERAPI_IO_API_KEYS: 'configured' })).toBe(true)
    expect(scanIsConfigured({ TYPESAFE_API_KEY: 'configured' })).toBe(false)
  })

  test('disables scan routes with the worker', () => {
    expect(scanIsConfigured({
      TYPESAFE_API_KEY: 'configured',
      TWITTERAPI_IO_API_KEYS: 'configured',
      SCAN_WORKER_ENABLED: 'false',
    })).toBe(false)
  })
})
