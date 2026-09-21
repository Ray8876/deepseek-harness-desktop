import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, join, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const resourceDir = join(repoRoot, 'src-tauri', 'resources')
const assetDir = join(resourceDir, 'offline')
const manifestPath = join(resourceDir, 'offline-manifest.json')
const targetDir = join(repoRoot, 'src-tauri', 'target')
const webviewId = '913236b0-52e1-4dde-943c-2cfdbe153d31'
const webviewFile = 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'
const webviewCachePath = join(
  targetDir,
  '.tauri',
  'x64',
  webviewId,
  webviewFile,
)
const auditedUpstreamCommit = 'c2d2a9dec6120ad96410bb368a54a1c359ebc392'
const fixedHarness = {
  version: '0.1.5-rc.2',
  tag: 'dsh-0.1.5-rc.2-34495473237',
  commit: 'a9582858297904ee7d7ffe613cfd28faaa5f6462',
  sha256: '328780f453d89f01543bfc1e055ada75a6ff2c6204c7973254c61f95be81076a',
}

const assets = [
  {
    key: 'node',
    version: 'v22.22.0',
    url: 'https://nodejs.org/dist/v22.22.0/node-v22.22.0-win-x64.zip',
    file: 'node-v22.22.0-win-x64.zip',
    sha256: 'c97fa376d2becdc8863fcd3ca2dd9a83a9f3468ee7ccf7a6d076ec66a645c77a',
    archive: 'zip',
  },
  {
    key: 'harness',
    version: fixedHarness.version,
    url: `https://github.com/dsh-tauri-desk/deepseek-harness-pkg/releases/download/${fixedHarness.tag}/deepseek-harness-pkg-windows.zip`,
    file: 'deepseek-harness-pkg-windows.zip',
    sha256: fixedHarness.sha256,
    archive: 'zip',
    releaseTag: fixedHarness.tag,
    releaseCommit: fixedHarness.commit,
  },
  {
    key: 'pnpm',
    version: '11.7.0',
    url: 'https://registry.npmjs.org/pnpm/-/pnpm-11.7.0.tgz',
    file: 'pnpm-11.7.0.tgz',
    sha256: 'deafa7ec98a1218b6a047289b92fbe2395c1e22d3495bb711653013218ee15ee',
    archive: 'tgz',
  },
  {
    key: 'mingit',
    version: '2.53.0.2',
    url: 'https://github.com/git-for-windows/git/releases/download/v2.53.0.windows.2/MinGit-2.53.0.2-64-bit.zip',
    file: 'MinGit-2.53.0.2-64-bit.zip',
    sha256: 'd4bf83d6a860ccae9af44e508e1e00a39f09db6fa78a9ba5543b94d87ca22a29',
    archive: 'zip',
  },
  {
    key: 'webview2',
    version: `evergreen-standalone-x64-${webviewId}`,
    url: `https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/${webviewId}/${webviewFile}`,
    file: webviewFile,
    sha256: 'ad9b350625e132481bc0953eee9e032810134df9fedbd7be364c3f4e0e4dbd64',
    archive: 'exe',
  },
]

const fixedSourceUrls = new Set(assets.map(asset => asset.url))
const allowedRedirectHosts = new Set([
  'nodejs.org',
  'github.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
  'registry.npmjs.org',
  'msedge.sf.dl.delivery.mp.microsoft.com',
  'download.microsoft.com',
  'msedge.download.prss.microsoft.com',
  'msedge.b.tlu.dl.delivery.mp.microsoft.com',
  'edgeassetstore.blob.core.windows.net',
])

function fail(message) {
  throw new Error(`OFFLINE_BUILD: ${message}`)
}

function log(message) {
  process.stdout.write(`${message}\n`)
}

function powershellQuote(value) {
  return `'${value.replaceAll('\'', '\'\'')}'`
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', rejectRun)
    child.on('close', (code) => {
      if (code !== 0) {
        rejectRun(
          new Error(
            `${command} ${args.join(' ')} exited with ${code}: ${stderr || stdout}`,
          ),
        )
        return
      }
      resolveRun({ stdout: stdout.trim(), stderr: stderr.trim() })
    })
  })
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  }
  catch (error) {
    fail(`cannot read JSON ${path}: ${error.message}`)
  }
}

async function getBuildMetadata() {
  const packageJson = await readJson(join(repoRoot, 'package.json'))
  const recommendation = await readJson(
    join(resourceDir, 'version-recommend.json'),
  )
  if (typeof packageJson.version !== 'string' || !packageJson.version.trim()) {
    fail('package.json has no desktop version')
  }
  if (recommendation.dsh !== fixedHarness.version) {
    fail(
      `version-recommend.json dsh must remain ${fixedHarness.version}, got ${recommendation.dsh}`,
    )
  }
  if (
    recommendation.offlineWindows?.tag !== fixedHarness.tag
    || recommendation.offlineWindows?.commit !== fixedHarness.commit
  ) {
    fail('version-recommend.json does not register the fixed Harness tag and commit')
  }

  let sourceCommit = ''
  try {
    sourceCommit = (await run('git', ['rev-parse', 'HEAD'])).stdout
  }
  catch {
    sourceCommit = process.env.GITHUB_SHA ?? ''
  }
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) {
    fail('source commit is not a full Git SHA')
  }

  const epoch = process.env.SOURCE_DATE_EPOCH
  const generatedAt = epoch
    ? new Date(Number(epoch) * 1000).toISOString()
    : new Date().toISOString()
  if (Number.isNaN(Date.parse(generatedAt))) {
    fail('SOURCE_DATE_EPOCH is invalid')
  }
  return {
    desktopVersion: packageJson.version,
    sourceCommit,
    generatedAt,
  }
}

function digestBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function digestFile(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk)
  }
  return hash.digest('hex')
}

async function fetchAsset(spec) {
  if (!fixedSourceUrls.has(spec.url)) {
    fail(`asset URL is not allowlisted: ${spec.url}`)
  }
  let current = spec.url
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const parsed = new URL(current)
    if (parsed.protocol !== 'https:') {
      fail(`non-HTTPS asset URL: ${current}`)
    }
    if (attempt === 0 && current !== spec.url) {
      fail(`asset redirect did not start from its fixed URL: ${current}`)
    }
    if (attempt > 0 && !allowedRedirectHosts.has(parsed.hostname)) {
      fail(`redirect host is not allowlisted: ${parsed.hostname}`)
    }
    const response = await fetch(current, {
      headers: { 'user-agent': 'deepseek-harness-desktop-offline-builder' },
      redirect: 'manual',
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) {
        fail(`redirect for ${spec.key} has no Location header`)
      }
      current = new URL(location, current).href
      continue
    }
    if (!response.ok) {
      fail(`${spec.key} download failed with HTTP ${response.status}`)
    }
    if (!allowedRedirectHosts.has(parsed.hostname)) {
      fail(`final asset host is not allowlisted: ${parsed.hostname}`)
    }
    return Buffer.from(await response.arrayBuffer())
  }
  fail(`too many redirects while downloading ${spec.key}`)
}

async function ensureAsset(spec) {
  const destination = join(assetDir, spec.file)
  try {
    if ((await stat(destination)).isFile()) {
      const existing = await digestFile(destination)
      if (existing === spec.sha256) {
        log(`reuse ${spec.key}: ${destination}`)
        return destination
      }
      log(`replace ${spec.key}: existing SHA-256 ${existing}`)
    }
  }
  catch {
    log(`download ${spec.key}`)
  }
  const bytes = await fetchAsset(spec)
  const actual = digestBytes(bytes)
  if (actual !== spec.sha256) {
    fail(`${spec.key} SHA-256 mismatch, expected ${spec.sha256}, got ${actual}`)
  }
  await mkdir(assetDir, { recursive: true })
  const temporary = join(assetDir, `.${spec.file}.${process.pid}.${randomUUID()}.tmp`)
  try {
    await writeFile(temporary, bytes, { flag: 'wx' })
    await rm(destination, { force: true })
    await rename(temporary, destination)
  }
  finally {
    await rm(temporary, { force: true })
  }
  return destination
}

function manifestAsset(spec) {
  const asset = {
    version: spec.version,
    url: spec.url,
    path: `offline/${spec.file}`,
    sha256: spec.sha256,
    archive: spec.archive,
  }
  if (spec.releaseTag)
    asset.releaseTag = spec.releaseTag
  if (spec.releaseCommit)
    asset.releaseCommit = spec.releaseCommit
  return asset
}

function buildManifest(metadata) {
  return {
    schema: 1,
    mode: 'windows-x64',
    desktopVersion: metadata.desktopVersion,
    sourceCommit: metadata.sourceCommit,
    auditedUpstreamCommit,
    generatedAt: metadata.generatedAt,
    assets: Object.fromEntries(assets.map(spec => [spec.key, manifestAsset(spec)])),
  }
}

function safeResourcePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\'))
    return false
  if (value.startsWith('/') || value.split('/').includes('..')) {
    return false
  }
  const absolute = resolve(resourceDir, value)
  const root = resolve(resourceDir) + sep
  return absolute.startsWith(root)
}

async function verifyManifest() {
  const manifest = await readJson(manifestPath)
  if (
    manifest.schema !== 1
    || manifest.mode !== 'windows-x64'
    || typeof manifest.desktopVersion !== 'string'
    || !/^[0-9a-f]{40}$/i.test(manifest.sourceCommit)
    || manifest.auditedUpstreamCommit !== auditedUpstreamCommit
    || typeof manifest.generatedAt !== 'string'
  ) {
    fail('manifest metadata is invalid')
  }
  const expectedKeys = assets.map(asset => asset.key).sort()
  const actualKeys = Object.keys(manifest.assets ?? {}).sort()
  if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) {
    fail('manifest asset keys do not match the fixed Windows x64 set')
  }
  for (const spec of assets) {
    const actual = manifest.assets[spec.key]
    const expected = manifestAsset(spec)
    for (const field of [
      'version',
      'url',
      'path',
      'sha256',
      'archive',
      'releaseTag',
      'releaseCommit',
    ]) {
      if ((actual[field] ?? undefined) !== (expected[field] ?? undefined)) {
        fail(`manifest ${spec.key}.${field} is not the fixed value`)
      }
    }
    if (!safeResourcePath(actual.path)) {
      fail(`manifest path escapes resources: ${spec.key}`)
    }
    const path = resolve(resourceDir, actual.path)
    try {
      if (!(await stat(path)).isFile())
        fail(`manifest asset is not a file: ${spec.key}`)
    }
    catch {
      fail(`manifest asset is missing: ${spec.key}: ${path}`)
    }
    const digest = await digestFile(path)
    if (digest !== spec.sha256) {
      fail(`${spec.key} file SHA-256 mismatch, expected ${spec.sha256}, got ${digest}`)
    }
  }
  try {
    if (!(await stat(webviewCachePath)).isFile()) {
      fail(`WebView2 cache is not a file: ${webviewCachePath}`)
    }
  }
  catch {
    fail(`WebView2 cache is missing: ${webviewCachePath}`)
  }
  const webviewSpec = assets.find(asset => asset.key === 'webview2')
  const cachedDigest = await digestFile(webviewCachePath)
  if (cachedDigest !== webviewSpec.sha256) {
    fail(
      `WebView2 cache SHA-256 mismatch, expected ${webviewSpec.sha256}, got ${cachedDigest}`,
    )
  }
  log(`verified ${assets.length} offline assets and WebView2 cache`)
  return manifest
}

async function prepare() {
  const metadata = await getBuildMetadata()
  await mkdir(assetDir, { recursive: true })
  for (const spec of assets) await ensureAsset(spec)
  const webview = join(assetDir, webviewFile)
  await mkdir(dirname(webviewCachePath), { recursive: true })
  await copyFile(webview, webviewCachePath)
  await writeFile(manifestPath, `${JSON.stringify(buildManifest(metadata), null, 2)}\n`)
  await verifyManifest()
  log(`prepared ${manifestPath}`)
}

async function findInstaller() {
  const nsisDir = join(targetDir, 'release', 'bundle', 'nsis')
  let entries
  try {
    entries = await readdir(nsisDir, { withFileTypes: true })
  }
  catch (error) {
    fail(`NSIS output directory is missing: ${nsisDir}: ${error.message}`)
  }
  const installers = entries
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.exe'))
    .map(entry => join(nsisDir, entry.name))
  if (installers.length !== 1) {
    fail(`expected one NSIS installer, found ${installers.length} in ${nsisDir}`)
  }
  return installers[0]
}

async function makeZip(sourceDir, destination) {
  if (process.platform === 'win32') {
    const command = [
      '$ErrorActionPreference = \'Stop\'',
      `Compress-Archive -Path ${powershellQuote(join(sourceDir, '*'))} -DestinationPath ${powershellQuote(destination)} -Force`,
    ].join('; ')
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command])
    return
  }
  await run('zip', ['-q', '-r', destination, '.'], { cwd: sourceDir })
}

async function finalize() {
  await verifyManifest()
  const installer = process.argv[3]
    ? resolve(process.cwd(), process.argv[3])
    : await findInstaller()
  try {
    if (!(await stat(installer)).isFile())
      fail(`installer is not a file: ${installer}`)
  }
  catch {
    fail(`installer is missing: ${installer}`)
  }
  const metadata = await getBuildMetadata()
  const outputDir = join(targetDir, 'release', 'bundle', 'offline-windows-x64')
  await rm(outputDir, { recursive: true, force: true })
  await mkdir(outputDir, { recursive: true })
  const installerName = `deepseek-harness-desktop-${metadata.desktopVersion}-windows-x64-offline-setup.exe`
  const outputInstaller = join(outputDir, installerName)
  const outputManifest = join(outputDir, 'offline-manifest.json')
  const sumsPath = join(outputDir, 'SHA256SUMS')
  const zipPath = join(
    targetDir,
    'release',
    'bundle',
    `deepseek-harness-desktop-${metadata.desktopVersion}-windows-x64-offline.zip`,
  )
  await copyFile(installer, outputInstaller)
  await copyFile(manifestPath, outputManifest)
  const installerDigest = await digestFile(outputInstaller)
  const manifestDigest = await digestFile(outputManifest)
  await writeFile(
    sumsPath,
    `${installerDigest}  ${installerName}\n${manifestDigest}  offline-manifest.json\n`,
  )
  await rm(zipPath, { force: true })
  await makeZip(outputDir, zipPath)
  const bundleSumsPath = join(targetDir, 'release', 'bundle', 'SHA256SUMS')
  const zipDigest = await digestFile(zipPath)
  await writeFile(
    bundleSumsPath,
    `${zipDigest}  ${basename(zipPath)}\n${installerDigest}  offline-windows-x64/${installerName}\n${manifestDigest}  offline-windows-x64/offline-manifest.json\n`,
  )
  log(`installer: ${outputInstaller}`)
  log(`manifest: ${outputManifest}`)
  log(`checksums: ${sumsPath}`)
  log(`archive: ${zipPath}`)
  log(`bundle checksums: ${bundleSumsPath}`)
}

async function main() {
  const command = process.argv[2] ?? ''
  if (command === 'prepare')
    return prepare()
  if (command === 'verify')
    return verifyManifest()
  if (command === 'finalize')
    return finalize()
  log('usage: node scripts/offline-windows.mjs <prepare|verify|finalize> [installer]')
  process.exitCode = 2
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`)
  process.exitCode = 1
})
