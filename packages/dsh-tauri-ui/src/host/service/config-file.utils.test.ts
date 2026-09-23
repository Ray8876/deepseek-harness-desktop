import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { openUrl, spawnDetached } from 'dsh-tauri'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openInEditor } from './config-file.utils'

const runtime = vi.hoisted(() => ({ platform: 'darwin', env: {} as NodeJS.ProcessEnv }))
vi.mock('node:process', () => ({ default: runtime }))
vi.mock('node:fs', () => ({ existsSync: vi.fn() }))
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_command, _args, _options, callback) => callback(null, '', '')),
}))
vi.mock('dsh-tauri', () => ({ openUrl: vi.fn(), spawnDetached: vi.fn() }))

describe('opening files in an editor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runtime.platform = 'darwin'
    runtime.env = {}
    vi.mocked(existsSync).mockReturnValue(false)
  })

  it('uses the existing system association when requested', async () => {
    await openInEditor('/tmp/settings.yaml', { editor: 'system', command: '' })
    expect(openUrl).toHaveBeenCalledWith('/tmp/settings.yaml')
    expect(execFile).not.toHaveBeenCalled()
    expect(spawnDetached).not.toHaveBeenCalled()
  })

  it('opens VS Code on macOS without depending on the code CLI', async () => {
    await openInEditor('/tmp/my config/settings.yaml', { editor: 'vscode', command: '' })
    expect(execFile).toHaveBeenCalledWith('/usr/bin/open', ['-a', 'Visual Studio Code', '/tmp/my config/settings.yaml'], { timeout: 10_000 }, expect.any(Function))
  })

  it('opens Cursor on macOS without depending on its CLI', async () => {
    await openInEditor('/tmp/settings.yaml', { editor: 'cursor', command: '' })
    expect(execFile).toHaveBeenCalledWith('/usr/bin/open', ['-a', 'Cursor', '/tmp/settings.yaml'], { timeout: 10_000 }, expect.any(Function))
  })

  it('passes custom application and file paths as literal arguments', async () => {
    const path = '/tmp/settings $(touch injected).yaml'
    await openInEditor(path, { editor: 'custom', command: '/Applications/My Editor.app' })
    expect(execFile).toHaveBeenCalledWith('/usr/bin/open', ['-a', '/Applications/My Editor.app', path], { timeout: 10_000 }, expect.any(Function))
  })

  it('propagates a failed macOS open command', async () => {
    vi.mocked(execFile).mockImplementationOnce((_command: any, _args: any, _options: any, callback: any): any => callback(new Error('Unable to find application')))
    await expect(openInEditor('/tmp/settings.yaml', { editor: 'vscode', command: '' })).rejects.toThrow('Unable to find application')
  })

  it('finds a Windows user installation without launching a cmd shim', async () => {
    runtime.platform = 'win32'
    runtime.env = { LOCALAPPDATA: 'C:\\Users\\Test User\\AppData\\Local' }
    const exe = 'C:\\Users\\Test User\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe'
    vi.mocked(existsSync).mockImplementation(path => path === exe)
    await openInEditor('C:\\My Config\\settings.yaml', { editor: 'vscode', command: '' })
    expect(spawnDetached).toHaveBeenCalledWith(exe, ['C:\\My Config\\settings.yaml'])
  })

  it('finds a portable Windows installation from its bin entry in PATH', async () => {
    runtime.platform = 'win32'
    runtime.env = { PATH: 'D:\\Tools\\VS Code\\bin' }
    vi.mocked(existsSync).mockImplementation(path => path === 'D:\\Tools\\VS Code\\Code.exe')
    await openInEditor('C:\\settings.yaml', { editor: 'vscode', command: '' })
    expect(spawnDetached).toHaveBeenCalledWith('D:\\Tools\\VS Code\\Code.exe', ['C:\\settings.yaml'])
  })

  it('finds a Windows Cursor user installation', async () => {
    runtime.platform = 'win32'
    runtime.env = { LOCALAPPDATA: 'C:\\Users\\Test User\\AppData\\Local' }
    const exe = 'C:\\Users\\Test User\\AppData\\Local\\Programs\\Cursor\\Cursor.exe'
    vi.mocked(existsSync).mockImplementation(path => path === exe)
    await openInEditor('C:\\My Config\\settings.yaml', { editor: 'cursor', command: '' })
    expect(spawnDetached).toHaveBeenCalledWith(exe, ['C:\\My Config\\settings.yaml'])
  })

  it('launches the code executable on Linux', async () => {
    runtime.platform = 'linux'
    await openInEditor('/tmp/settings.yaml', { editor: 'vscode', command: '' })
    expect(spawnDetached).toHaveBeenCalledWith('code', ['/tmp/settings.yaml'])
  })

  it('launches the cursor executable on Linux', async () => {
    runtime.platform = 'linux'
    await openInEditor('/tmp/settings.yaml', { editor: 'cursor', command: '' })
    expect(spawnDetached).toHaveBeenCalledWith('cursor', ['/tmp/settings.yaml'])
  })

  it('launches a custom executable without shell evaluation', async () => {
    runtime.platform = 'linux'
    await openInEditor('/tmp/settings.yaml', { editor: 'custom', command: '/opt/My Editor/editor' })
    expect(spawnDetached).toHaveBeenCalledWith('/opt/My Editor/editor', ['/tmp/settings.yaml'])
  })
})
