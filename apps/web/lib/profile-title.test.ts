import { describe, expect, test } from 'bun:test'
import { profileTitle } from './profile-title'

describe('profileTitle', () => {
  test('uses the populated profile name and handle', () => {
    expect(profileTitle({ name: 'Market Maven', handle: 'market_maven' })).toBe(
      'Market Maven (@market_maven) on Called It',
    )
  })

  test('falls back to Called It when profile identity is incomplete', () => {
    expect(profileTitle({ name: 'Market Maven' })).toBe('Called It')
    expect(profileTitle({ handle: 'market_maven' })).toBe('Called It')
    expect(profileTitle(null)).toBe('Called It')
  })
})
