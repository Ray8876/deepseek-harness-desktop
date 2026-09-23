import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDirectory, writeAtomic } from 'dsh-tauri'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configFile } from './config-file'
import { openInEditor } from './config-file.utils'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, readFile: vi.fn(actual.readFile) }
})
vi.mock('dsh-tauri', async (importOriginal) => {
  const actual = await importOriginal<typeof import('dsh-tauri')>()
  return { ...actual, openDirectory: vi.fn(), writeAtomic: vi.fn(actual.writeAtomic) }
})
vi.mock('./config-file.utils', () => ({ openInEditor: vi.fn() }))

describe('config file editor preference', () => {
  let home: string

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'dsh-editor-'))
    vi.stubEnv('DSH_HOME', home)
    vi.mocked(openInEditor).mockResolvedValue(undefined)
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    await rm(home, { recursive: true, force: true })
  })

  it('keeps the system default for existing users without a preference', async () => {
    await writeFile(join(home, 'settings.yaml'), 'models: {}\n')
    expect(await configFile.load()).toEqual({ editor: 'system', command: '' })
    expect(await configFile.open()).toEqual({ ok: true, path: join(home, 'settings.yaml'), opened: 'file' })
    expect(openInEditor).toHaveBeenCalledWith(join(home, 'settings.yaml'), { editor: 'system', command: '' })
  })

  it.each([
    ['malformed JSON', '{'],
    ['invalid shape', 'null'],
    ['unknown editor', '{"editor":"unknown","command":""}'],
    ['empty custom command', '{"editor":"custom","command":"  "}'],
  ])('recovers from %s and allows saving a new preference', async (_, content) => {
    const path = join(home, 'dsh-tauri-ui', 'editor.json')
    await mkdir(join(home, 'dsh-tauri-ui'))
    await writeFile(path, content)
    await writeFile(join(home, 'settings.yaml'), 'models: {}\n')

    expect(await configFile.load()).toEqual({ editor: 'system', command: '' })
    expect(await configFile.open()).toEqual({ ok: true, path: join(home, 'settings.yaml'), opened: 'file' })
    expect(openInEditor).toHaveBeenCalledWith(join(home, 'settings.yaml'), { editor: 'system', command: '' })
    expect(await readFile(path, 'utf8')).toBe(content)

    await configFile.save({ editor: 'vscode', command: '' })
    expect(await configFile.load()).toEqual({ editor: 'vscode', command: '' })
  })

  it.each(['EACCES', 'EIO'])('reports %s instead of falling back to the system editor', async (code) => {
    await writeFile(join(home, 'settings.yaml'), 'models: {}\n')
    const error = Object.assign(new Error(code), { code })
    vi.mocked(readFile).mockRejectedValueOnce(error)
    await expect(configFile.load()).rejects.toBe(error)

    vi.mocked(readFile).mockRejectedValueOnce(error)
    expect(await configFile.open()).toEqual({ ok: false, path: join(home, 'settings.yaml'), error: code })
    expect(openInEditor).not.toHaveBeenCalled()
    expect(openDirectory).not.toHaveBeenCalled()
  })

  it('persists a custom editor and uses it on the next open', async () => {
    await writeFile(join(home, 'settings.yaml'), 'models: {}\n')
    await configFile.save({ editor: 'custom', command: '  /Applications/My Editor.app  ' })
    const preference = { editor: 'custom', command: '/Applications/My Editor.app' }
    expect(JSON.parse(await readFile(join(home, 'dsh-tauri-ui', 'editor.json'), 'utf8'))).toEqual(preference)
    expect(await configFile.load()).toEqual(preference)
    await configFile.open()
    expect(openInEditor).toHaveBeenCalledWith(join(home, 'settings.yaml'), preference)
    await configFile.save({ editor: 'system', command: '' })
    expect(await configFile.load()).toEqual({ editor: 'system', command: '' })
  })

  it('rejects an empty custom editor without replacing the saved preference', async () => {
    await configFile.save({ editor: 'vscode', command: '' })
    await expect(configFile.save({ editor: 'custom', command: '  ' })).rejects.toThrow('EDITOR_COMMAND_REQUIRED')
    expect(await configFile.load()).toEqual({ editor: 'vscode', command: '' })
  })

  it('persists and opens with the Cursor preset', async () => {
    await writeFile(join(home, 'settings.yaml'), 'models: {}\n')
    const preference = { editor: 'cursor', command: '' } as const
    await configFile.save(preference)
    expect(await configFile.load()).toEqual(preference)
    await configFile.open()
    expect(openInEditor).toHaveBeenCalledWith(join(home, 'settings.yaml'), preference)
  })

  it('reports launcher failure instead of silently opening a different app', async () => {
    await writeFile(join(home, 'settings.yaml'), 'models: {}\n')
    vi.mocked(openInEditor).mockRejectedValueOnce(new Error('Editor not found'))
    expect(await configFile.open()).toEqual({ ok: false, path: join(home, 'settings.yaml'), error: 'Editor not found' })
    expect(openDirectory).not.toHaveBeenCalled()
  })

  it('opens and reports the containing directory when settings do not exist', async () => {
    expect(await configFile.open()).toEqual({ ok: true, path: home, opened: 'directory' })
    expect(openDirectory).toHaveBeenCalledWith(home)
    expect(openInEditor).not.toHaveBeenCalled()
  })

  it('treats a directory named settings.yaml as no settings file and opens the containing directory', async () => {
    await mkdir(join(home, 'settings.yaml'))

    expect(await configFile.open()).toEqual({ ok: true, path: home, opened: 'directory' })
    expect(openDirectory).toHaveBeenCalledWith(home)
    expect(openInEditor).not.toHaveBeenCalled()
  })

  it('surfaces an atomic write failure without replacing the stored preference', async () => {
    const path = join(home, 'dsh-tauri-ui', 'editor.json')
    await configFile.save({ editor: 'vscode', command: '' })

    const failure = Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
    vi.mocked(writeAtomic).mockRejectedValueOnce(failure)

    await expect(configFile.save({ editor: 'cursor', command: '' })).rejects.toBe(failure)
    expect(writeAtomic).toHaveBeenCalledTimes(2)
    const [target, serialized] = vi.mocked(writeAtomic).mock.calls[1]!
    expect(target).toBe(path)
    expect(JSON.parse(String(serialized))).toEqual({ editor: 'cursor', command: '' })
    expect(await configFile.load()).toEqual({ editor: 'vscode', command: '' })
  })
})
