export type BirdErrorClass =
  | 'auth'
  | 'rate_limit'
  | 'network'
  | 'server'
  | 'unavailable_account'
  | 'not_found'
  | 'cursor_rejected'
  | 'tool_incompatible'
  | 'timeout'
  | 'unknown'

export class BirdError extends Error {
  constructor(
    readonly kind: BirdErrorClass,
    message: string,
    readonly retryable = false,
  ) {
    super(redactBirdDetail(message))
    this.name = 'BirdError'
  }
}

export function classifyBirdError(stderr: string, stdout = '', timedOut = false): BirdError {
  const text = `${stderr}\n${stdout}`
  if (timedOut || /timed?\s*out|abort/i.test(text)) return new BirdError('timeout', 'Bird request timed out.', true)
  if (/429|rate.?limit|too many requests/i.test(text)) return new BirdError('rate_limit', 'X rate-limited the read request.')
  if (/no twitter cookies found|missing required credentials|not logged in|unauthorized|forbidden|\b401\b|\b403\b/i.test(fatalScope(text))) {
    return new BirdError('auth', 'The selected browser profile is not authenticated to X.')
  }
  if (/protected|suspended|account.*(missing|not found)|could not find user|user not found/i.test(text)) {
    return new BirdError('unavailable_account', 'The target account is unavailable or protected.')
  }
  if (/(tweet|post).*(not found|does not exist|deleted)/i.test(text)) return new BirdError('not_found', 'The targeted post was not found.')
  if (/invalid.*cursor|cursor.*(reject|invalid|expired)|variable.*cursor/i.test(text)) {
    return new BirdError('cursor_rejected', 'The stored Bird cursor was rejected.')
  }
  if (/query.?id|malformed json|unexpected json|contract|graphql.*404|\b404\b.*query/i.test(text)) {
    return new BirdError('tool_incompatible', 'Bird 0.8.0 is incompatible with the current X response contract.')
  }
  if (/enotfound|econn|network|socket|fetch failed|dns/i.test(text)) return new BirdError('network', 'A network error interrupted Bird.', true)
  if (/internal server error|\b5\d\d\b|server error|bad gateway|service unavailable/i.test(text)) {
    return new BirdError('server', 'X returned a server error.', true)
  }
  return new BirdError('unknown', 'Bird could not complete the read request.')
}

export function redactBirdDetail(value: string): string {
  return String(value)
    .replace(/(auth[_-]?token|ct0)(\s*[:=]\s*|\s+)[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/--(?:auth-token|ct0)(?:=|\s+)\S+/gi, '[credential flag rejected]')
    .replace(/([A-Za-z0-9_-]{24,})/g, '[opaque]')
    .slice(0, 400)
}

function fatalScope(text: string) {
  const fatal = text.split(/\r?\n/).filter((line) => line.includes('❌') || /^error[: ]/i.test(line))
  return fatal.length ? fatal.join('\n') : text
}
