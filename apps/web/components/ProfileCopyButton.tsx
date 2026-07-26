'use client'

import { useEffect, useRef, useState } from 'react'

export const COPY_FEEDBACK_DURATION_MS = 2_000

type ClipboardWriter = Pick<Clipboard, 'writeText'>
type FeedbackTimer = ReturnType<typeof setTimeout>
type FeedbackTimerScheduler = (callback: () => void, delay: number) => FeedbackTimer
type CopyFeedback = 'idle' | 'copied' | 'unavailable'

export async function copyProfileUrl(profileUrl: string, clipboard = getClipboard()): Promise<boolean> {
  if (!clipboard?.writeText) return false

  try {
    await clipboard.writeText(profileUrl)
    return true
  } catch {
    return false
  }
}

export function scheduleCopyFeedbackReset(
  onReset: () => void,
  schedule: FeedbackTimerScheduler = (callback, delay) => setTimeout(callback, delay),
): FeedbackTimer {
  return schedule(onReset, COPY_FEEDBACK_DURATION_MS)
}

export function ProfileCopyButton({ profileUrl }: { profileUrl: string }) {
  const [feedback, setFeedback] = useState<CopyFeedback>('idle')
  const resetTimer = useRef<FeedbackTimer | null>(null)

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current)
  }, [])

  async function handleCopy() {
    const copied = await copyProfileUrl(profileUrl)
    if (resetTimer.current) clearTimeout(resetTimer.current)

    setFeedback(copied ? 'copied' : 'unavailable')
    resetTimer.current = scheduleCopyFeedbackReset(() => {
      setFeedback('idle')
      resetTimer.current = null
    })
  }

  const label = feedback === 'copied'
    ? 'Copied'
    : feedback === 'unavailable'
      ? 'Copy unavailable'
      : 'Copy profile link'
  const status = feedback === 'copied'
    ? 'Profile link copied to clipboard.'
    : feedback === 'unavailable'
      ? 'Clipboard unavailable. Profile link was not copied.'
      : ''

  return (
    <>
      <button
        className="share-copy-profile-link"
        type="button"
        aria-describedby="profile-copy-status"
        onClick={handleCopy}
      >
        {label}
      </button>
      <span id="profile-copy-status" className="visually-hidden" role="status" aria-live="polite">
        {status}
      </span>
    </>
  )
}

function getClipboard(): ClipboardWriter | undefined {
  if (typeof navigator === 'undefined') return undefined
  return navigator.clipboard
}
