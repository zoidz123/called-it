const PRODUCTION_API_URL = 'https://called-it-api-production.up.railway.app'
const LOCAL_API_URL = 'http://127.0.0.1:3001'

export const API_URL = process.env.NEXT_PUBLIC_API_URL
  ?? process.env.API_URL
  ?? (process.env.NODE_ENV === 'production' ? PRODUCTION_API_URL : LOCAL_API_URL)

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
