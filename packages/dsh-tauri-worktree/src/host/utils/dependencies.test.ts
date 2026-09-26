import { lstat, mkdir, mkdtemp, readFile, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { join } from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import {
  copyMissingChildren,
  isDependencyInstallCommand,
  linkWorktreeDependencies,
  normalizeLinkDirectories,
  normalizeSeedDirectories,
  seedWorktreeDirectories,
  unlinkWorktreeDependencies,
} from './dependencies'

const temporaryDirectories: string[] = []

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix))
  temporaryDirectories.push(root)
  return root
}

async function createFixture(): Promise<{ project: string, worktree: string, marker: string }> {
  const project = await temporaryRoot('dsh-deps-project-')
  const worktree = await temporaryRoot('dsh-deps-worktree-')
  const marker = join(project, 'node_modules', 'pkg', 'index.js')
  await mkdir(join(project, 'node_modules', 'pkg'), { recursive: true })
  await writeFile(marker, 'shared-dependency\n')
  return { project, worktree, marker }
}

async function createBuildCacheFixture(): Promise<{ project: string, worktree: string, source: string }> {
  const project = await temporaryRoot('dsh-seed-project-')
  const worktree = await temporaryRoot('dsh-seed-worktree-')
  const artifact = join(project, 'src-tauri', 'target', 'debug', 'deps', 'libdemo.rlib')
  await mkdir(join(project, 'src-tauri', 'target', 'debug', 'incremental'), { recursive: true })
  await mkdir(join(project, 'src-tauri', 'target', 'debug', 'deps'), { recursive: true })
  await writeFile(artifact, 'artifact\n')
  await writeFile(join(project, 'src-tauri', 'target', 'debug', 'incremental', 'cache.bin'), 'incremental\n')
  await mkdir(join(project, 'src-tauri', 'target', 'debug', 'build'), { recursive: true })
  await writeFile(join(project, 'src-tauri', 'target', 'debug', 'build', 'generated.rs'), '// generated\n')
  const source = join(worktree, 'src-tauri', 'src', 'main.rs')
  await mkdir(join(worktree, 'src-tauri', 'src'), { recursive: true })
  await writeFile(source, 'fn main() {}\n')
  return { project, worktree, source }
}

async function createSkillsFixture(): Promise<{ project: string, worktree: string, skill: string }> {
  const project = await temporaryRoot('dsh-deps-project-')
  const worktree = await temporaryRoot('dsh-deps-worktree-')
  const skill = join(project, '.agents', 'skills', 'handle', 'SKILL.md')
  await mkdir(join(project, '.agents', 'skills', 'handle'), { recursive: true })
  await writeFile(skill, '# handle\n')
  return { project, worktree, skill }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('normalizeLinkDirectories', () => {
  it('falls back to node_modules for empty input and dedupes preserving order', () => {
    expect(normalizeLinkDirectories()).toEqual(['node_modules'])
    expect(normalizeLinkDirectories([])).toEqual(['node_modules'])
    expect(normalizeLinkDirectories(['.venv', 'node_modules', '.venv'])).toEqual(['.venv', 'node_modules'])
  })

  it('rejects path traversal and separator-bearing entries', () => {
    expect(normalizeLinkDirectories(['../evil', 'a/b', 'a\\b', '.', '..', '', '  '])).toEqual([])
    expect(normalizeLinkDirectories(['node_modules/'])).toEqual(['node_modules'])
  })
})

describe('isDependencyInstallCommand', () => {
  it.each([
    'pnpm install',
    'pnpm i',
    'pnpm add lodash',
    'npm ci',
    'npm install --frozen-lockfile',
    'yarn',
    'yarn add react',
    'bun install',
    'cd packages/app && pnpm install',
    'pip install -r requirements.txt',
    'uv sync',
    'cargo build',
    'go mod download',
    'bundle install',
    'composer install',
  ])('detects %s', (command) => {
    expect(isDependencyInstallCommand(command)).toBe(true)
  })

  it.each([
    '',
    'pnpm run build',
    'npm test',
    'pnpm exec tsc --noEmit',
    'git status',
    'npm run lint --fix',
    'node scripts/build.js',
  ])('ignores %s', (command) => {
    expect(isDependencyInstallCommand(command)).toBe(false)
  })
})

describe('linkWorktreeDependencies', () => {
  it('links the source dependency directory into the worktree and reads through it', async () => {
    const { project, worktree } = await createFixture()
    const result = await linkWorktreeDependencies(project, worktree, ['node_modules'])

    expect(result.linked).toEqual(['node_modules'])
    const stats = await lstat(join(worktree, 'node_modules'))
    expect(stats.isSymbolicLink()).toBe(true)
    expect(await readFile(join(worktree, 'node_modules', 'pkg', 'index.js'), 'utf8')).toBe('shared-dependency\n')
  })

  it('skips missing source directories and already-populated targets', async () => {
    const project = await temporaryRoot('dsh-deps-project-')
    const worktree = await temporaryRoot('dsh-deps-worktree-')
    await mkdir(join(worktree, 'node_modules'), { recursive: true })

    const missingSource = await linkWorktreeDependencies(project, worktree, ['node_modules'])
    expect(missingSource).toEqual({ linked: [], skipped: ['node_modules'] })

    const { project: withSource, worktree: emptyWorktree } = await createFixture()
    await mkdir(join(emptyWorktree, 'node_modules'), { recursive: true })
    const occupiedTarget = await linkWorktreeDependencies(withSource, emptyWorktree, ['node_modules'])
    expect(occupiedTarget).toEqual({ linked: [], skipped: ['node_modules'] })
  })
})

describe('unlinkWorktreeDependencies', () => {
  it('removes only the link and keeps the source dependency tree intact', async () => {
    const { project, worktree, marker } = await createFixture()
    await linkWorktreeDependencies(project, worktree, ['node_modules'])

    await expect(unlinkWorktreeDependencies(worktree, ['node_modules'])).resolves.toEqual(['node_modules'])
    await expect(lstat(join(worktree, 'node_modules'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(marker, 'utf8')).toBe('shared-dependency\n')
  })

  it('leaves a real (independently installed) directory untouched', async () => {
    const worktree = await temporaryRoot('dsh-deps-worktree-')
    const installed = join(worktree, 'node_modules', 'pkg')
    await mkdir(installed, { recursive: true })
    await writeFile(join(installed, 'index.js'), 'independent\n')

    await expect(unlinkWorktreeDependencies(worktree, ['node_modules'])).resolves.toEqual([])
    expect(await readFile(join(installed, 'index.js'), 'utf8')).toBe('independent\n')
  })

  it('is idempotent when the directory is absent', async () => {
    const worktree = await temporaryRoot('dsh-deps-worktree-')
    await expect(unlinkWorktreeDependencies(worktree, ['node_modules'])).resolves.toEqual([])
  })
})

describe('normalizeSeedDirectories', () => {
  it('falls back to the tauri build cache and keeps nested paths', () => {
    expect(normalizeSeedDirectories()).toEqual(['src-tauri/target'])
    expect(normalizeSeedDirectories([])).toEqual(['src-tauri/target'])
    expect(normalizeSeedDirectories(['src-tauri\\target\\', 'target'])).toEqual(['src-tauri/target', 'target'])
  })

  it('rejects traversal, absolute and duplicate entries', () => {
    expect(normalizeSeedDirectories(['../evil', 'src/../../etc', '.', '..', '', '  ', '/etc/passwd', 'C:\\Windows'])).toEqual([])
    const deduped = normalizeSeedDirectories(['src-tauri/target', 'SRC-TAURI/TARGET'])
    expect(deduped).toEqual(process.platform === 'win32' ? ['src-tauri/target'] : ['src-tauri/target', 'SRC-TAURI/TARGET'])
  })
})

describe('seedWorktreeDirectories', () => {
  it('copies the build cache, drops incremental state and refreshes local rust sources', async () => {
    const { project, worktree, source } = await createBuildCacheFixture()
    await utimes(source, new Date(0), new Date(0))
    const startedAt = Date.now()

    const result = await seedWorktreeDirectories([project], worktree, ['src-tauri/target'])

    expect(result).toEqual({ seeded: ['src-tauri/target'], skipped: [], touched: 1, errors: [], sources: [project] })
    expect(await readFile(join(worktree, 'src-tauri', 'target', 'debug', 'deps', 'libdemo.rlib'), 'utf8')).toBe('artifact\n')
    expect(await readFile(join(worktree, 'src-tauri', 'target', 'debug', 'build', 'generated.rs'), 'utf8')).toBe('// generated\n')
    await expect(lstat(join(worktree, 'src-tauri', 'target', 'debug', 'incremental'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await stat(source)).mtimeMs).toBeGreaterThanOrEqual(startedAt - 1000)
  })

  it('keeps the source cache intact and skips missing sources or occupied targets', async () => {
    const { project, worktree } = await createBuildCacheFixture()

    const emptyProject = await temporaryRoot('dsh-seed-empty-')
    const missingSource = await seedWorktreeDirectories([emptyProject], worktree, ['src-tauri/target'])
    expect(missingSource).toEqual({ seeded: [], skipped: ['src-tauri/target'], touched: 0, errors: [], sources: [] })

    await mkdir(join(worktree, 'src-tauri', 'target'), { recursive: true })
    const occupiedTarget = await seedWorktreeDirectories([project], worktree, ['src-tauri/target'])
    expect(occupiedTarget).toEqual({ seeded: [], skipped: ['src-tauri/target'], touched: 0, errors: [], sources: [] })
    expect(await readFile(join(project, 'src-tauri', 'target', 'debug', 'deps', 'libdemo.rlib'), 'utf8')).toBe('artifact\n')
  })

  it('falls back to the next source root that carries the directory', async () => {
    const { project, worktree } = await createBuildCacheFixture()
    const emptyProject = await temporaryRoot('dsh-seed-empty-')

    const result = await seedWorktreeDirectories([emptyProject, project], worktree, ['src-tauri/target'])

    expect(result.seeded).toEqual(['src-tauri/target'])
    expect(result.sources).toEqual([project])
    expect(await readFile(join(worktree, 'src-tauri', 'target', 'debug', 'deps', 'libdemo.rlib'), 'utf8')).toBe('artifact\n')
  })
})

describe('copyMissingChildren', () => {
  it('copies a missing source directory into the target as a real directory', async () => {
    const { project, skill } = await createSkillsFixture()
    const worktree = await temporaryRoot('dsh-deps-worktree-')

    await expect(copyMissingChildren(join(project, '.agents'), join(worktree, '.agents'))).resolves.toEqual(['skills'])
    const copied = join(worktree, '.agents', 'skills')
    expect((await lstat(copied)).isSymbolicLink()).toBe(false)
    expect(await readFile(join(copied, 'handle', 'SKILL.md'), 'utf8')).toBe('# handle\n')
    expect(await readFile(skill, 'utf8')).toBe('# handle\n')
  })

  it('merges missing descendants into an existing target directory and keeps its files', async () => {
    const { project } = await createSkillsFixture()
    const worktree = await temporaryRoot('dsh-deps-worktree-')
    await mkdir(join(worktree, '.agents', 'skills'), { recursive: true })
    await writeFile(join(worktree, '.agents', 'skills', 'local.md'), 'local\n')

    await expect(copyMissingChildren(join(project, '.agents'), join(worktree, '.agents'))).resolves.toEqual(['skills/handle'])
    expect(await readFile(join(worktree, '.agents', 'skills', 'local.md'), 'utf8')).toBe('local\n')
    expect(await readFile(join(worktree, '.agents', 'skills', 'handle', 'SKILL.md'), 'utf8')).toBe('# handle\n')
  })

  it('replaces a legacy symbolic link with a real copied directory', async () => {
    const { project, skill } = await createSkillsFixture()
    const worktree = await temporaryRoot('dsh-deps-worktree-')
    await symlink(join(project, '.agents'), join(worktree, '.agents'), process.platform === 'win32' ? 'junction' : 'dir')

    await expect(copyMissingChildren(join(project, '.agents'), join(worktree, '.agents'))).resolves.toEqual(['skills'])
    expect((await lstat(join(worktree, '.agents'))).isSymbolicLink()).toBe(false)
    expect(await readFile(join(worktree, '.agents', 'skills', 'handle', 'SKILL.md'), 'utf8')).toBe('# handle\n')
    expect(await readFile(skill, 'utf8')).toBe('# handle\n')
  })

  it('returns no copies when the source is absent', async () => {
    const worktree = await temporaryRoot('dsh-deps-worktree-')
    await expect(copyMissingChildren(join(worktree, 'missing'), join(worktree, 'target'))).resolves.toEqual([])
  })
})
