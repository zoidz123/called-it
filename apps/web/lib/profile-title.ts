type ProfileIdentity = {
  handle?: string | null
  name?: string | null
}

export function profileTitle(profile: ProfileIdentity | null | undefined) {
  const name = profile?.name?.trim()
  const handle = profile?.handle?.trim().replace(/^@/, '')

  if (!name || !handle) return 'Called It'

  return `${name} (@${handle}) on Called It`
}
