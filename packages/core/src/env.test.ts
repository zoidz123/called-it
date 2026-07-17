import { afterEach, describe, expect, test } from 'bun:test'
import { requiredAnyEnv, requiredEnv } from './env'

const testNames = ['CALLED_IT_TEST_PRIMARY', 'CALLED_IT_TEST_FALLBACK']

afterEach(() => {
  for (const name of testNames) delete process.env[name]
})

describe('environment helpers', () => {
  test('requiredEnv trims configured values', () => {
    process.env.CALLED_IT_TEST_PRIMARY = '  configured  '
    expect(requiredEnv('CALLED_IT_TEST_PRIMARY')).toBe('configured')
  })

  test('requiredEnv fails without exposing a value', () => {
    expect(() => requiredEnv('CALLED_IT_TEST_PRIMARY')).toThrow('Missing CALLED_IT_TEST_PRIMARY')
  })

  test('requiredAnyEnv accepts a configured fallback', () => {
    process.env.CALLED_IT_TEST_FALLBACK = 'fallback'
    expect(requiredAnyEnv(testNames)).toBe('fallback')
  })

  test('requiredAnyEnv fails when every option is empty', () => {
    expect(() => requiredAnyEnv(testNames)).toThrow('Missing one of: CALLED_IT_TEST_PRIMARY, CALLED_IT_TEST_FALLBACK')
  })
})
