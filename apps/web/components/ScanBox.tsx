'use client'

import { FormEvent, useState } from 'react'
import { API_URL } from '../lib/api'

const IS_LOCAL_API = API_URL.startsWith('http://localhost') || API_URL.startsWith('http://127.0.0.1')
const DEV_PAID_SCAN = process.env.NEXT_PUBLIC_ALLOW_DEV_PAID_SCAN === 'true'
  || (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ALLOW_DEV_PAID_SCAN !== 'false')
  || (process.env.NODE_ENV !== 'production' && IS_LOCAL_API)

type Job = {
  id: string
  status: string
  stage?: string
  progress?: number
  progress_message?: string
  error?: string
  handle: string
}

export function ScanBox({
  initialHandle = '',
  className = '',
  title = 'Who called it?',
  helperText = 'Paste an X/Twitter profile to score their public ticker calls.',
}: {
  initialHandle?: string
  className?: string
  title?: string | null
  helperText?: string
}) {
  const [handle, setHandle] = useState(initialHandle)
  const [inlineError, setInlineError] = useState('')
  const [scanMessage, setScanMessage] = useState('')
  const [scanProgress, setScanProgress] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const clean = normalizeHandle(handle)
    if (!clean) {
      setInlineError('Enter a valid X handle or profile URL.')
      return
    }
    setInlineError('')
    setScanProgress(0)
    setScanMessage('')
    setBusy(true)
    try {
      const pre = await fetch(`${API_URL}/api/scan/${encodeURIComponent(clean)}/precheck`).then((res) => res.json())
      if (pre.cached) {
        window.location.href = `/u/${pre.handle ?? clean}`
        return
      } else {
        if (!pre.ok) throw new Error(pre.message || 'This account is not ready to scan.')
        setScanMessage(DEV_PAID_SCAN ? 'Starting scan...' : 'Starting the paid scan...')
      }
      setScanProgress(5)
      setModalOpen(true)
      const scanUrl = `${API_URL}/api/scan/${encodeURIComponent(clean)}${DEV_PAID_SCAN ? '?dev=1' : ''}`
      const created = await fetch(scanUrl, {
        method: 'POST',
        headers: DEV_PAID_SCAN ? { 'x-dev-paid': 'true' } : undefined,
      }).then(async (res) => {
        const payload = await res.json().catch(() => null)
        if (!res.ok) throw new Error(payload?.error || 'Payment is required to start a fresh scan.')
        return payload
      })
      await poll(created.jobId)
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : 'Scan failed.')
      setModalOpen(false)
      setBusy(false)
    }
  }

  async function poll(jobId: string) {
    for (;;) {
      const payload = await fetch(`${API_URL}/api/jobs/${jobId}`).then((res) => res.json())
      const job: Job = payload.job
      if (!job) throw new Error('Job disappeared.')
      setScanProgress(clampProgress(job.progress ?? 0))
      setScanMessage(job.progress_message ?? job.stage ?? job.status)
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
      {title ? <h2>{title}</h2> : null}
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
      <div className="scan-helper-row">
        <p>{helperText}</p>
        <span className="scan-info">
          <button type="button" aria-label="How scans work">?</button>
          <span className="scan-info-popover" role="tooltip">
            We pull public X/Twitter posts from the past year, filter for stock and crypto ticker mentions, then price what happened after each call.
          </span>
        </span>
      </div>
      {inlineError ? <p className="status-line scan-error">{inlineError}</p> : null}
      {busy && !modalOpen ? (
        <button className="scan-progress-reopen" type="button" onClick={() => setModalOpen(true)}>
          View scan progress
        </button>
      ) : null}
      {busy && modalOpen ? (
        <div className="scan-modal-backdrop" role="presentation">
          <div
            aria-labelledby="scan-modal-title"
            aria-modal="true"
            className="scan-modal"
            role="dialog"
          >
            <div className="scan-modal-head">
              <div>
                <span>Scanning</span>
                <h3 id="scan-modal-title">Building your scorecard</h3>
              </div>
              <button
                aria-label="Close progress dialog"
                className="scan-modal-close"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                X
              </button>
            </div>
            <div className="scan-progress-meter" aria-label={`Scan ${scanProgress}% complete`}>
              <span style={{ width: `${scanProgress}%` }} />
            </div>
            <div className="scan-modal-status">
              <strong>{scanProgress}%</strong>
              <p>{scanMessage}</p>
            </div>
            <p className="scan-modal-note">
              The scan is still running in the background. You can close this tab and come back later; the scorecard will be waiting when it is ready.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
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
