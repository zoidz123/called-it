'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { API_URL } from '../lib/api'

type ProfileAutoRefreshProps = {
  handle: string
  computedAt?: string | null
  enabled: boolean
}

export function ProfileAutoRefresh({ handle, computedAt, enabled }: ProfileAutoRefreshProps) {
  const router = useRouter()

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let attempts = 0

    async function poll() {
      attempts += 1
      try {
        const response = await fetch(`${API_URL}/api/users/${encodeURIComponent(handle)}?tweets=0`, {
          cache: 'no-store',
        })
        if (!response.ok) return
        const payload = await response.json()
        const nextComputedAt = payload?.user?.computed_at
        if (!cancelled && nextComputedAt && nextComputedAt !== computedAt) {
          router.refresh()
          cancelled = true
        }
      } catch {
        // Keep the scorecard usable if a background refresh poll fails.
      }
    }

    const timer = window.setInterval(() => {
      if (cancelled || attempts >= 24) {
        window.clearInterval(timer)
        return
      }
      void poll()
    }, 5000)

    void poll()

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [computedAt, enabled, handle, router])

  return null
}
