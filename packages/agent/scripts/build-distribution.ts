import { createHash } from 'node:crypto'
import { chmod, copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import agentPackage from '../package.json' with { type: 'json' }

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(packageRoot, '../..')
const dist = join(packageRoot, 'dist')
const skillSource = join(repositoryRoot, 'skills', 'called-it')
const skillDestination = join(dist, 'skill')
const runtimeDestination = join(dist, 'runtime')

await import('./bundle-bird')
await copyFile(join(packageRoot, 'src', 'bootstrap.mjs'), join(dist, 'bootstrap.mjs'))
await chmod(join(dist, 'bootstrap.mjs'), 0o755)
await copyFile(join(packageRoot, 'src', 'purge-confirmation.mjs'), join(dist, 'purge-confirmation.mjs'))
await rm(runtimeDestination, { recursive: true, force: true })
await rm(skillDestination, { recursive: true, force: true })
await mkdir(runtimeDestination, { recursive: true })

const build = await Bun.build({
  entrypoints: [join(packageRoot, 'src', 'cli.ts')],
  outdir: runtimeDestination,
  naming: 'called-it.mjs',
  target: 'bun',
  format: 'esm',
  minify: false,
  sourcemap: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
})
if (!build.success) throw new Error(build.logs.map((log) => log.message).join('\n'))
await chmod(join(runtimeDestination, 'called-it.mjs'), 0o755)

await cp(skillSource, skillDestination, { recursive: true, filter: (source) => !source.includes('called-it-workspace') })
const skillFiles = await fileChecksums(skillDestination)
await writeJson(join(skillDestination, 'called-it-manifest.json'), {
  schemaVersion: 1,
  name: 'called-it',
  version: agentPackage.version,
  files: skillFiles,
})

await copyFile(join(packageRoot, 'LICENSE'), join(dist, 'licenses', 'CALLED-IT-MIT.txt'))
const runtimeFiles = await checksumsFor([
  join(dist, 'runtime', 'called-it.mjs'),
  join(dist, 'bird.mjs'),
  join(dist, 'bird-manifest.json'),
  ...(await filesBelow(join(dist, 'licenses'))),
])
await writeJson(join(dist, 'runtime-manifest.json'), {
  schemaVersion: 1,
  name: '@called-it/agent',
  version: agentPackage.version,
  birdVersion: '0.8.0',
  files: runtimeFiles,
})

const payload = await checksumsFor([
  join(packageRoot, 'package.json'),
  join(packageRoot, 'LICENSE'),
  join(packageRoot, 'README.md'),
  join(dist, 'bootstrap.mjs'),
  join(dist, 'purge-confirmation.mjs'),
  join(dist, 'runtime-manifest.json'),
  ...(await filesBelow(join(dist, 'runtime'))),
  join(dist, 'bird.mjs'),
  join(dist, 'bird-manifest.json'),
  ...(await filesBelow(join(dist, 'licenses'))),
  ...(await filesBelow(skillDestination)),
])
await writeJson(join(dist, 'distribution-manifest.json'), {
  schemaVersion: 1,
  name: '@called-it/agent',
  version: agentPackage.version,
  nodeBootstrap: '>=18',
  bunRuntime: '>=1',
  payload,
})

console.log(JSON.stringify({ version: agentPackage.version, payloadFiles: payload.length }))

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o644 })
}

async function fileChecksums(root: string) {
  return checksumsFor((await filesBelow(root)).filter((path) => !path.endsWith('called-it-manifest.json')), root)
}

async function checksumsFor(paths: string[], relativeRoot = packageRoot) {
  return Promise.all(paths.sort().map(async (path) => ({
    path: relative(relativeRoot, path),
    sha256: createHash('sha256').update(await readFile(path)).digest('hex'),
  })))
}

async function filesBelow(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? filesBelow(path) : [path]
  }))
  return nested.flat()
}
