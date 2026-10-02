// What the share images have in common: the Pluto desk palette, at the 2x scale they render at, and the avatar.
export const COLORS = {
  yellow: '#e9e9e4',
  ink: '#121212',
  edge: '#45453f',
  paper: '#ffffff',
  paperSoft: '#f4f4f0',
  muted: '#8e8e88',
  accent: '#2f5bff',
  green: '#1d7a3a',
  red: '#b3261e',
}

export async function loadAvatar(avatarUrl: string | null) {
  if (!avatarUrl) return null
  let url: URL
  try {
    url = new URL(avatarUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null

  const allowedHosts = new Set(['pbs.twimg.com', 'abs.twimg.com', 'ton.twimg.com', 'pbs.twimg.com.cdn.cloudflare.net'])
  if (!allowedHosts.has(url.hostname)) return null

  const response = await fetch(url.toString(), {
    headers: { accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
    cache: 'no-store',
  })
  if (!response.ok) return null
  const contentType = response.headers.get('content-type') ?? 'image/jpeg'
  if (!contentType.startsWith('image/')) return null
  const buffer = Buffer.from(await response.arrayBuffer())
  return `data:${contentType};base64,${buffer.toString('base64')}`
}
