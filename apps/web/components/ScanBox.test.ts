import { describe, expect, test } from 'bun:test'
import { precheckErrorMessage } from './ScanBox'

describe('precheckErrorMessage', () => {
  test('prefers the API error field', () => {
    expect(precheckErrorMessage({ error: 'Scanning is not configured.', message: 'Ready to scan.' })).toBe(
      'Scanning is not configured.',
    )
  })

  test('falls back to the message field', () => {
    expect(precheckErrorMessage({ message: 'Account is suspended.' })).toBe('Account is suspended.')
  })

  test('uses the generic fallback when neither field is set', () => {
    expect(precheckErrorMessage({})).toBe('This account is not ready to scan.')
  })
})
