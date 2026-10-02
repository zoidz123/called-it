import { timedFetch } from './http'
import { optionalEnv, requiredEnv } from './env'

const MAX_ATTEMPTS = 5

export type JevQuestion =
  | { type: 'choice'; instructions: unknown; criteria: Record<string, unknown> }
  | { type: 'noul'; instructions: unknown }
export type JevAnswer = { choice?: string; probabilities?: Record<string, number>; noul?: number }

// One Jev request: every question is answered in isolation against the same state.
export async function askJev(
  state: unknown,
  questions: Record<string, JevQuestion>,
  { apiKey = requiredEnv('TYPESAFE_API_KEY'), model = optionalEnv('TYPESAFE_MODEL') ?? 'jev-1.13.0' } = {},
): Promise<Record<string, JevAnswer>> {
  const body = JSON.stringify({ model, state, questions })
  for (let attempt = 1; ; attempt++) {
    const res = await timedFetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body,
    }, 60_000)
    if ((res.status === 429 || res.status === 529) && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(res.headers.get('retry-after'))
      await new Promise((done) => setTimeout(done, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt))
      continue
    }
    if (!res.ok) throw new Error(`TypeSafe ${res.status}: ${(await res.text()).slice(0, 240)}`)
    return (await res.json()).answers ?? {}
  }
}
