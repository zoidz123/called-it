// A request to an outside service that gives up instead of hanging: one stalled call would otherwise hold a scan,
// and the worker running it, for good.
export function timedFetch(input: string | URL, init: RequestInit = {}, timeoutMs = 20_000): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) })
}
