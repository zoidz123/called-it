import { describe, expect, test } from 'bun:test'
import { resolvePublicApiUrl, resolvePublicSiteUrl } from './public-env'

describe('public build environment', () => {
  test('accepts explicit configured production URLs', () => {
    expect(resolvePublicSiteUrl({ configuredUrl: 'https://called-it.example', nodeEnv: 'production' }).href).toBe(
      'https://called-it.example/',
    )
    expect(resolvePublicApiUrl({ configuredUrl: 'https://api.called-it.example/', nodeEnv: 'production' })).toBe(
      'https://api.called-it.example',
    )
  })

  test('fails closed when production URLs are missing', () => {
    expect(() => resolvePublicSiteUrl({ nodeEnv: 'production' })).toThrow('Missing NEXT_PUBLIC_SITE_URL')
    expect(() => resolvePublicApiUrl({ nodeEnv: 'production' })).toThrow('Missing NEXT_PUBLIC_API_URL')
  })

  test('derives the preview site URL from the Vercel deployment hostname', () => {
    expect(resolvePublicSiteUrl({
      nodeEnv: 'production',
      vercelEnv: 'preview',
      vercelUrl: 'called-it-git-pr-3.vercel.app',
    }).href).toBe('https://called-it-git-pr-3.vercel.app/')
  })

  test('rejects malformed or non-Vercel preview metadata', () => {
    for (const vercelUrl of [
      'https://called-it.vercel.app',
      'called-it.vercel.app/path',
      'called-it.example.com',
      'user@called-it.vercel.app',
      '-called-it.vercel.app',
    ]) {
      expect(() => resolvePublicSiteUrl({ nodeEnv: 'production', vercelEnv: 'preview', vercelUrl })).toThrow(
        'VERCEL_URL must be a valid vercel.app hostname',
      )
    }
  })

  test('requires Vercel to supply preview deployment metadata', () => {
    expect(() => resolvePublicSiteUrl({ nodeEnv: 'production', vercelEnv: 'preview' })).toThrow(
      'Missing VERCEL_URL for preview deployment',
    )
  })

  test('leaves the preview API unavailable when no explicit preview backend exists', () => {
    expect(resolvePublicApiUrl({ nodeEnv: 'production', vercelEnv: 'preview' })).toBeNull()
  })
})
