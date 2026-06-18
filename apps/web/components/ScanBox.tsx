'use client'

import { FormEvent, useState } from 'react'
import { API_URL } from '../lib/api'

type Job = {
  id: string
  status: string
  stage?: string
  progress?: number
  progress_message?: string
  error?: string
  handle: string
}

export function ScanBox({ initialHandle = '', className = '' }: { initialHandle?: string; className?: string }) {
  const [handle, setHandle] = useState(initialHandle)
  const [status, setStatus] = useState('Scan an X profile to measure price action after public ticker mentions.')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const clean = normalizeHandle(handle)
    if (!clean) {
      setStatus('Enter a valid X handle or profile URL.')
      return
    }
    setBusy(true)
    setStatus('Checking if this trader is scannable...')
    try {
      const pre = await fetch(`${API_URL}/api/scan/${encodeURIComponent(clean)}/precheck`).then((res) => res.json())
      if (pre.cached) {
        setStatus('Already on the board. Running a fresh pass...')
      } else {
        if (!pre.ok) throw new Error(pre.message || 'This account is not ready to scan.')
        setStatus('Starting the paid scan...')
      }
      const created = await fetch(`${API_URL}/api/scan/${encodeURIComponent(clean)}?dev=1`, {
        method: 'POST',
        headers: { 'x-dev-paid': 'true' },
      }).then((res) => res.json())
      await poll(created.jobId)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Scan failed.')
      setBusy(false)
    }
  }

  async function poll(jobId: string) {
    for (;;) {
      const payload = await fetch(`${API_URL}/api/jobs/${jobId}`).then((res) => res.json())
      const job: Job = payload.job
      if (!job) throw new Error('Job disappeared.')
      setStatus(`${job.progress ?? 0}% - ${job.progress_message ?? job.stage ?? job.status}`)
      if (job.status === 'done') {
        window.location.href = `/u/${job.handle}`
        return
      }
      if (job.status === 'error') throw new Error(job.error || 'Scan failed.')
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  }

  return (
    <section className={`scan-box ${className}`.trim()}>
      <h2>Who called it?</h2>
      <form className="scan-form" onSubmit={submit}>
        <input
          aria-label="X handle"
          placeholder="https://x.com/ChrisCamillo"
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          disabled={busy}
          suppressHydrationWarning
        />
        <button type="submit" disabled={busy}>{busy ? 'Scanning' : 'Scan'}</button>
      </form>
      <p className="status-line">{status}</p>
    </section>
  )
}

function normalizeHandle(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'x.com' || host === 'twitter.com') {
      const handle = url.pathname.split('/').filter(Boolean)[0] ?? ''
      if (/^[A-Za-z0-9_]{1,15}$/.test(handle)) return handle.toLowerCase()
    }
  } catch {
    // Fall through to plain handle parsing.
  }
  const handle = trimmed.replace(/^@/, '').replace(/[?#].*$/, '').replace(/\/.*$/, '')
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle.toLowerCase() : ''
}
