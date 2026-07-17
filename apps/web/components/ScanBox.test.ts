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

  test('prefers the message field for Fastify error bodies', () => {
    expect(
      precheckErrorMessage({
        statusCode: 500,
        error: 'Internal Server Error',
        message: '@nosuchuser was not found on X.',
      }),
    ).toBe('@nosuchuser was not found on X.')
  })

  test('falls back to the error field for Fastify bodies without a message', () => {
    expect(precheckErrorMessage({ statusCode: 500, error: 'Internal Server Error' })).toBe('Internal Server Error')
  })
})
