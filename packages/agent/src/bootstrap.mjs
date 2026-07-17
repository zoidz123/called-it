#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { confirmPurge } from './purge-confirmation.mjs'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageMetadata = readJson(join(packageRoot, 'package.json'))
const distributionManifest = readJson(join(packageRoot, 'dist', 'distribution-manifest.json'))
const supportedTargets = new Set(['codex', 'claude'])
const command = process.argv[2]
const args = process.argv.slice(3)

try {
  if (command === '--version' || command === '-v' || command === 'version') console.log(packageMetadata.version)
  else if (command === 'verify-package') verifyPackage()
  else if (command === 'install' || command === 'update') install(command, args)
  else if (command === 'uninstall') await uninstall(args)
  else usage(command ? `Unknown command: ${command}` : undefined)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

function verifyPackage() {
  if (distributionManifest.schemaVersion !== 1 || distributionManifest.name !== packageMetadata.name) {
    throw new Error('Distribution manifest identity is invalid.')
  }
  if (distributionManifest.version !== packageMetadata.version) throw new Error('Package and distribution manifest versions disagree.')
  verifyEntries(packageRoot, distributionManifest.payload)
  const runtime = readJson(join(packageRoot, 'dist', 'runtime-manifest.json'))
  const skill = readJson(join(packageRoot, 'dist', 'skill', 'called-it-manifest.json'))
  if (runtime.version !== packageMetadata.version || skill.version !== packageMetadata.version) {
    throw new Error('Runtime, package, and skill versions disagree.')
  }
  if (runtime.birdVersion !== '0.8.0') throw new Error('The runtime does not contain pinned Bird 0.8.0.')
  verifyEntries(packageRoot, runtime.files)
  verifyEntries(join(packageRoot, 'dist', 'skill'), skill.files)
  if (command === 'verify-package') console.log(`Verified @called-it/agent ${packageMetadata.version} (${distributionManifest.payload.length} payload files).`)
}

function install(action, rawArgs) {
  verifyPackage()
  verifyBun()
  const options = parseOptions(rawArgs, new Set(['--target', '--allow-downgrade', '--backup-modified']))
  const target = requiredTarget(options)
  const paths = resolvePaths(target)
  assertSafeDestination(paths.targetRoot, paths.skillDir)
  assertSafeDestination(paths.dataRoot, paths.runtimeRoot)

  const existing = inspectInstalledSkill(paths.skillDir)
  if (existing.exists && existing.version) {
    const comparison = compareVersions(packageMetadata.version, existing.version)
    if (comparison < 0 && !options.flags.has('--allow-downgrade')) {
      throw new Error(`Refusing downgrade from ${existing.version} to ${packageMetadata.version}. Rerun with --allow-downgrade to proceed.`)
    }
  }
  if (existing.exists && !existing.pristine && !options.flags.has('--backup-modified')) {
    throw new Error(`Refusing to overwrite modified or unmanaged skill at ${paths.skillDir}. Rerun with --backup-modified to preserve it first.`)
  }

  const runtimeVersionRoot = join(paths.runtimeRoot, 'versions', packageMetadata.version)
  installRuntime(runtimeVersionRoot, paths)
  const installed = installSkill(paths.skillDir, existing, options.flags.has('--backup-modified'))
  writeLauncher(paths.launcher, runtimeVersionRoot)
  writeAtomicJson(paths.installationRecord, {
    schemaVersion: 1,
    target,
    version: packageMetadata.version,
    skillDir: paths.skillDir,
    runtimeVersionRoot,
  })
  console.log(`${action === 'update' ? 'Updated' : 'Installed'} Called It ${packageMetadata.version} for ${target}.`)
  console.log(`Skill: ${paths.skillDir}`)
  console.log(`Launcher: ${paths.launcher}`)
  if (installed.backup) console.log(`Preserved modified skill backup: ${installed.backup}`)
}

async function uninstall(rawArgs) {
  verifyPackage()
  const options = parseOptions(rawArgs, new Set(['--target', '--purge', '--backup-modified']))
  const target = requiredTarget(options)
  const paths = resolvePaths(target)
  assertSafeDestination(paths.targetRoot, paths.skillDir)
  assertSafeDestination(paths.dataRoot, paths.runtimeRoot)
  const existing = inspectInstalledSkill(paths.skillDir)
  const remainingBeforeRemoval = installationRecords(paths.installationsDir).filter((name) => name !== `${target}.json`)
  if (options.flags.has('--purge')) {
    if (remainingBeforeRemoval.length) throw new Error('Refusing to purge shared data while another Called It target remains installed.')
    await confirmPurge()
  }
  let backup
  if (existing.exists && !existing.pristine && !options.flags.has('--backup-modified')) {
    throw new Error(`Refusing to remove modified or unmanaged skill at ${paths.skillDir}. Rerun with --backup-modified to preserve it first.`)
  }
  if (existing.exists) {
    if (!existing.pristine) {
      backup = backupPath(paths.skillDir)
      renameSync(paths.skillDir, backup)
    } else removeAtomically(paths.skillDir)
  }
  if (existsSync(paths.installationRecord)) rmSync(paths.installationRecord)

  const remaining = installationRecords(paths.installationsDir)
  if (!remaining.length) removeRuntime(paths.runtimeRoot)
  if (options.flags.has('--purge')) {
    purgeUserData(paths)
  }
  console.log(`Uninstalled Called It for ${target}.`)
  console.log(options.flags.has('--purge') ? 'Deleted Called It configuration, SQLite evidence, and reports.' : 'Preserved Called It configuration, SQLite evidence, and reports.')
  if (backup) console.log(`Preserved modified skill backup: ${backup}`)
}

function installRuntime(versionRoot, paths) {
  if (existsSync(versionRoot)) {
    const installedManifest = join(versionRoot, 'dist', 'runtime-manifest.json')
    if (!existsSync(installedManifest)) throw new Error(`Refusing to overwrite incomplete runtime at ${versionRoot}.`)
    const manifest = readJson(installedManifest)
    if (manifest.version !== packageMetadata.version) throw new Error(`Refusing to overwrite mismatched runtime at ${versionRoot}.`)
    verifyEntries(versionRoot, manifest.files)
    return
  }
  ensurePrivateDirectory(dirname(versionRoot))
  const stage = `${versionRoot}.stage-${randomId()}`
  ensurePrivateDirectory(stage)
  try {
    const runtimeEntries = distributionManifest.payload.filter(({ path }) =>
      path === 'dist/runtime-manifest.json' || path === 'dist/bird.mjs' || path === 'dist/bird-manifest.json' || path.startsWith('dist/runtime/') || path.startsWith('dist/licenses/'))
    copyEntries(packageRoot, stage, runtimeEntries)
    verifyEntries(stage, runtimeEntries)
    const runtime = readJson(join(stage, 'dist', 'runtime-manifest.json'))
    verifyEntries(stage, runtime.files)
    renameSync(stage, versionRoot)
  } catch (error) {
    rmSync(stage, { recursive: true, force: true })
    throw error
  }
  ensurePrivateDirectory(dirname(paths.launcher))
}

function installSkill(skillDir, existing, preserveModified) {
  ensurePrivateDirectory(dirname(skillDir))
  const stage = `${skillDir}.stage-${randomId()}`
  ensurePrivateDirectory(stage)
  const skillSource = join(packageRoot, 'dist', 'skill')
  copyTree(skillSource, stage)
  const manifest = readJson(join(stage, 'called-it-manifest.json'))
  verifyEntries(stage, manifest.files)
  let displaced
  let backup
  try {
    if (existing.exists) {
      displaced = preserveModified && !existing.pristine ? backupPath(skillDir) : `${skillDir}.replace-${randomId()}`
      renameSync(skillDir, displaced)
      if (preserveModified && !existing.pristine) backup = displaced
    }
    renameSync(stage, skillDir)
    if (displaced && !backup) rmSync(displaced, { recursive: true, force: true })
    return { backup }
  } catch (error) {
    if (existsSync(stage)) rmSync(stage, { recursive: true, force: true })
    if (displaced && existsSync(displaced) && !existsSync(skillDir)) renameSync(displaced, skillDir)
    throw error
  }
}

function writeLauncher(path, runtimeVersionRoot) {
  ensurePrivateDirectory(dirname(path))
  const executable = join(runtimeVersionRoot, 'dist', 'runtime', 'called-it.mjs')
  const contents = `#!/bin/sh\nexport CALLED_IT_LAUNCHER=${shellQuote(path)}\nexec bun ${shellQuote(executable)} "$@"\n`
  writeAtomic(path, contents, 0o755)
}

function inspectInstalledSkill(skillDir) {
  if (!existsSync(skillDir)) return { exists: false, pristine: false }
  if (lstatSync(skillDir).isSymbolicLink() || !statSync(skillDir).isDirectory()) return { exists: true, pristine: false }
  try {
    const manifest = readJson(join(skillDir, 'called-it-manifest.json'))
    verifyEntries(skillDir, manifest.files)
    const expected = new Set([...manifest.files.map(({ path }) => path), 'called-it-manifest.json'])
    const actual = new Set(filesBelow(skillDir).map((path) => relative(skillDir, path)))
    const exact = expected.size === actual.size && [...expected].every((path) => actual.has(path))
    return { exists: true, pristine: exact, version: String(manifest.version ?? '') }
  } catch {
    return { exists: true, pristine: false }
  }
}

function resolvePaths(target) {
  const home = requireAbsolute(process.env.HOME, 'HOME')
  const targetRootInput = target === 'codex' ? process.env.CODEX_HOME || join(home, '.codex') : process.env.CLAUDE_HOME || join(home, '.claude')
  const targetRoot = resolvedAllowedRoot(targetRootInput)
  const dataRootInput = process.env.CALLED_IT_HOME || join(process.env.XDG_DATA_HOME || join(home, '.local', 'share'), 'called-it')
  const dataRoot = resolvedAllowedRoot(dataRootInput)
  const configRoot = resolvedAllowedRoot(join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'called-it'))
  const runtimeRoot = join(dataRoot, 'runtime')
  const installationsDir = join(runtimeRoot, 'installations')
  return {
    targetRoot,
    dataRoot,
    configRoot,
    runtimeRoot,
    skillDir: join(targetRoot, 'skills', 'called-it'),
    launcher: join(runtimeRoot, 'bin', 'called-it'),
    installationsDir,
    installationRecord: join(installationsDir, `${target}.json`),
  }
}

function resolvedAllowedRoot(input) {
  const absolute = requireAbsolute(resolve(input), 'target root')
  let cursor = absolute
  const missing = []
  while (!existsSync(cursor)) {
    missing.unshift(cursor.slice(dirname(cursor).length + (dirname(cursor) === sep ? 0 : 1)))
    cursor = dirname(cursor)
  }
  if (lstatSync(cursor).isSymbolicLink()) cursor = realpathSync(cursor)
  else cursor = realpathSync(cursor)
  return resolve(cursor, ...missing)
}

function assertSafeDestination(root, destination) {
  const rel = relative(root, destination)
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) throw new Error(`Unsafe destination outside allowed root: ${destination}`)
  let cursor = root
  for (const part of rel.split(sep)) {
    cursor = join(cursor, part)
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw new Error(`Refusing symlink in installation path: ${cursor}`)
  }
}

function verifyBun() {
  const result = spawnSync('bun', ['--version'], { encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    throw new Error('Bun 1.x is required by the Called It runtime but was not found. Install Bun from https://bun.sh/docs/installation, then rerun this command. No global package was installed.')
  }
  const major = Number(result.stdout.trim().split('.')[0])
  if (!Number.isInteger(major) || major < 1) throw new Error(`Bun 1.x or newer is required; found ${result.stdout.trim() || 'an unknown version'}.`)
}

function verifyEntries(root, entries) {
  if (!Array.isArray(entries) || !entries.length) throw new Error('Package checksum inventory is empty.')
  for (const entry of entries) {
    const path = safeJoin(root, entry.path)
    if (!existsSync(path) || lstatSync(path).isSymbolicLink() || !statSync(path).isFile()) throw new Error(`Missing or unsafe package file: ${entry.path}`)
    const actual = createHash('sha256').update(readFileSync(path)).digest('hex')
    if (actual !== entry.sha256) throw new Error(`Checksum mismatch for ${entry.path}`)
  }
}

function copyEntries(sourceRoot, destinationRoot, entries) {
  for (const entry of entries) {
    const source = safeJoin(sourceRoot, entry.path)
    const destination = safeJoin(destinationRoot, entry.path)
    ensurePrivateDirectory(dirname(destination))
    copyFileSync(source, destination)
    chmodSync(destination, entry.path.endsWith('.mjs') ? 0o755 : 0o644)
  }
}

function copyTree(sourceRoot, destinationRoot) {
  for (const source of filesBelow(sourceRoot)) {
    const rel = relative(sourceRoot, source)
    const destination = safeJoin(destinationRoot, rel)
    ensurePrivateDirectory(dirname(destination))
    copyFileSync(source, destination)
    chmodSync(destination, 0o644)
  }
}

function safeJoin(root, path) {
  if (typeof path !== 'string' || path.includes('\0') || isAbsolute(path)) throw new Error(`Unsafe manifest path: ${String(path)}`)
  const joined = resolve(root, path)
  const rel = relative(root, joined)
  if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) throw new Error(`Unsafe manifest path: ${path}`)
  return joined
}

function filesBelow(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Refusing symlink in installed skill: ${path}`)
    return entry.isDirectory() ? filesBelow(path) : [path]
  })
}

function parseOptions(rawArgs, allowed) {
  const values = new Map()
  const flags = new Set()
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (!allowed.has(arg)) usage(`Unknown option: ${arg}`)
    if (arg === '--target') {
      const value = rawArgs[index + 1]
      if (!value || value.startsWith('--')) usage('--target requires codex or claude')
      values.set(arg, value)
      index += 1
    } else flags.add(arg)
  }
  return { values, flags }
}

function requiredTarget(options) {
  const target = options.values.get('--target')
  if (!supportedTargets.has(target)) usage('--target must be codex or claude')
  return target
}

function compareVersions(left, right) {
  const parse = (version) => {
    const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/)
    if (!match) throw new Error(`Cannot compare invalid installed version: ${version}`)
    return match.slice(1).map(Number)
  }
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1
  return 0
}

function installationRecords(directory) {
  if (!existsSync(directory)) return []
  if (lstatSync(directory).isSymbolicLink()) throw new Error(`Refusing symlink installation registry: ${directory}`)
  return readdirSync(directory).filter((name) => name.endsWith('.json'))
}

function removeRuntime(runtimeRoot) {
  if (!existsSync(runtimeRoot)) return
  assertNoSymlinksBelow(runtimeRoot)
  removeAtomically(runtimeRoot)
}

function purgeUserData(paths) {
  if (existsSync(paths.configRoot)) {
    assertNoSymlinksBelow(paths.configRoot)
    removeAtomically(paths.configRoot)
  }
  if (existsSync(paths.dataRoot)) {
    assertNoSymlinksBelow(paths.dataRoot)
    removeAtomically(paths.dataRoot)
  }
}

function assertNoSymlinksBelow(root) {
  if (lstatSync(root).isSymbolicLink()) throw new Error(`Refusing symlink during removal: ${root}`)
  if (statSync(root).isDirectory()) filesBelow(root)
}

function removeAtomically(path) {
  const trash = `${path}.remove-${randomId()}`
  renameSync(path, trash)
  rmSync(trash, { recursive: true, force: true })
}

function writeAtomicJson(path, value) {
  writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`, 0o600)
}

function writeAtomic(path, contents, mode) {
  ensurePrivateDirectory(dirname(path))
  const temporary = `${path}.tmp-${randomId()}`
  writeFileSync(temporary, contents, { mode })
  chmodSync(temporary, mode)
  renameSync(temporary, path)
}

function ensurePrivateDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 })
  chmodSync(path, 0o700)
}

function backupPath(path) {
  return `${path}.backup-${new Date().toISOString().replaceAll(':', '').replaceAll('.', '')}`
}

function randomId() {
  return randomBytes(6).toString('hex')
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function requireAbsolute(value, name) {
  if (!value || !isAbsolute(value)) throw new Error(`${name} must be an absolute path.`)
  return value
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function usage(error) {
  if (error) console.error(error)
  console.error('Usage: npx @called-it/agent install|update|uninstall --target codex|claude [--allow-downgrade] [--backup-modified] [--purge]')
  process.exit(1)
}
