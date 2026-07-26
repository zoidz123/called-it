import { describe, expect, test } from 'bun:test'
import { COPY_FEEDBACK_DURATION_MS, copyProfileUrl, scheduleCopyFeedbackReset } from './ProfileCopyButton'

describe('copyProfileUrl', () => {
  test('copies the canonical public profile URL verbatim', async () => {
    const copiedUrls: string[] = []
    const profileUrl = 'https://called-it.example/u/market_maven'

    const copied = await copyProfileUrl(profileUrl, {
      writeText: async (value) => {
        copiedUrls.push(value)
      },
    })

    expect(copied).toBe(true)
    expect(copiedUrls).toEqual([profileUrl])
  })

  test('reports unavailable clipboard access without throwing', async () => {
    await expect(copyProfileUrl('https://called-it.example/u/market_maven', undefined)).resolves.toBe(false)
    await expect(copyProfileUrl('https://called-it.example/u/market_maven', {
      writeText: async () => {
        throw new Error('Permission denied')
      },
    })).resolves.toBe(false)
  })
})

test('clears copy feedback after the configured duration', () => {
  let resetCalls = 0
  let scheduledCallback: (() => void) | undefined
  let scheduledDelay: number | undefined

  const scheduledTimer = scheduleCopyFeedbackReset(
    () => {
      resetCalls += 1
    },
    (callback, delay) => {
      scheduledCallback = callback
      scheduledDelay = delay
      return setTimeout(() => {}, 60_000)
    },
  )

  expect(scheduledDelay).toBe(COPY_FEEDBACK_DURATION_MS)
  expect(resetCalls).toBe(0)
  scheduledCallback?.()
  expect(resetCalls).toBe(1)
  clearTimeout(scheduledTimer)
})
