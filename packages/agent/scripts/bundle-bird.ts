import { createHash } from 'node:crypto'
import { chmod, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(packageRoot, 'dist')
const birdPackagePath = fileURLToPath(import.meta.resolve('@steipete/bird/package.json'))
const birdRoot = dirname(birdPackagePath)
const sweetCookiePackagePath = join(birdRoot, '../sweet-cookie/package.json')
const birdPackage = Bun.file(birdPackagePath)
const sweetCookiePackage = Bun.file(sweetCookiePackagePath)

if (!(await birdPackage.exists()) || !(await sweetCookiePackage.exists())) throw new Error('Install workspace dependencies before bundling Bird.')
const birdMetadata = await birdPackage.json()
const sweetCookieMetadata = await sweetCookiePackage.json()
if (birdMetadata.version !== '0.8.0') throw new Error(`Expected @steipete/bird 0.8.0, found ${birdMetadata.version}`)
if (sweetCookieMetadata.version !== '0.1.0') throw new Error(`Expected @steipete/sweet-cookie 0.1.0, found ${sweetCookieMetadata.version}`)

await rm(dist, { recursive: true, force: true })
await mkdir(join(dist, 'licenses'), { recursive: true })
const entry = join(birdRoot, 'dist/cli.js')
const result = await Bun.build({
  entrypoints: [entry],
  outdir: dist,
  target: 'node',
  format: 'esm',
  naming: 'bird.mjs',
  minify: false,
  sourcemap: 'none',
  define: { __dirname: 'undefined' },
})
if (!result.success) throw new Error(result.logs.map((log) => log.message).join('\n'))

const bundlePath = join(dist, 'bird.mjs')
const bundle = await readFile(bundlePath)
if (!bundle.includes(Buffer.from('user-tweets')) || !bundle.includes(Buffer.from('whoami'))) throw new Error('Bird bundle is missing required read commands.')
const forbiddenPatch = Buffer.from('CAST(expires_utc AS TEXT)')
if (bundle.includes(forbiddenPatch)) throw new Error('Chrome expiry cast was applied without a failing runtime probe.')
if (bundle.includes(Buffer.from('/Users/'))) throw new Error('Bird bundle contains an absolute local path.')

for (const [name, source] of [
  ['BIRD-MIT.txt', join(packageRoot, 'third_party_licenses/BIRD-MIT.txt')],
  ['SWEET-COOKIE-MIT.txt', join(packageRoot, 'third_party_licenses/SWEET-COOKIE-MIT.txt')],
] as const) await copyFile(source, join(dist, 'licenses', name))

const manifest = {
  version: birdMetadata.version,
  sweetCookieVersion: sweetCookieMetadata.version,
  sha256: createHash('sha256').update(bundle).digest('hex'),
  chromeExpiryCastApplied: false,
  commands: ['whoami', 'user-tweets', 'read'],
  licenses: ['licenses/BIRD-MIT.txt', 'licenses/SWEET-COOKIE-MIT.txt'],
}
await writeFile(join(dist, 'bird-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 })
await chmod(bundlePath, 0o755)
console.log(JSON.stringify(manifest))
