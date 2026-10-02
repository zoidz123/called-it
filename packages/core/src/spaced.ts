// Runs tasks one at a time with a pause after each, for an API that limits requests per minute.
export function spacedQueue(intervalMs: number) {
  let tail: Promise<unknown> = Promise.resolve()
  return function run<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(async () => {
      try {
        return await task()
      } finally {
        await new Promise((done) => setTimeout(done, intervalMs))
      }
    })
    tail = result.catch(() => {})
    return result
  }
}
