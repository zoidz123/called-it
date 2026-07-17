import { expect, test } from 'bun:test'

test('collects framework routes with preview metadata and no preview API', async () => {
  const env = { ...process.env }
  delete env.NEXT_PUBLIC_API_URL
  delete env.NEXT_PUBLIC_SITE_URL
  Object.assign(env, {
    CI: '1',
    NEXT_TELEMETRY_DISABLED: '1',
    NODE_ENV: 'production',
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_URL: 'called-it-preview-build-test.vercel.app',
  })

  const root = new URL('../../..', import.meta.url).pathname
  const nextEnvPath = `${root}/apps/web/next-env.d.ts`
  const originalNextEnv = await Bun.file(nextEnvPath).text()
  let output = ''
  let exitCode = -1
  try {
    const build = Bun.spawn(['bun', 'run', 'build:web'], {
      cwd: root,
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(build.stdout).text(),
      new Response(build.stderr).text(),
      build.exited,
    ])
    output = `${stdout}\n${stderr}`
    exitCode = code
  } finally {
    await Bun.write(nextEnvPath, originalNextEnv)
  }

  expect(exitCode, output).toBe(0)
  expect(output).toContain('/_not-found')
}, 30_000)
