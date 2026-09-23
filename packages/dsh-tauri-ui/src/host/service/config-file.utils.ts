import type { EditorPreference } from '../../shared/editor.types'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, win32 } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { openUrl, spawnDetached } from 'dsh-tauri'

const run = promisify(execFile)

export async function openInEditor(path: string, preference: EditorPreference): Promise<void> {
  if (preference.editor === 'system') {
    await openUrl(path)
    return
  }
  let command = preference.command
  if (preference.editor === 'vscode' || preference.editor === 'cursor') {
    if (process.platform === 'darwin')
      command = preference.editor === 'vscode' ? 'Visual Studio Code' : 'Cursor'
    else if (process.platform === 'win32')
      command = resolveWindowsEditor(preference.editor)
    else
      command = preference.editor === 'vscode' ? 'code' : 'cursor'
  }
  if (command.startsWith('~/'))
    command = join(homedir(), command.slice(2))
  if (process.platform === 'darwin' && (command.endsWith('.app') || !isAbsolute(command))) {
    await run('/usr/bin/open', ['-a', command, path], { timeout: 10_000 })
    return
  }
  await spawnDetached(command, [path])
}

function resolveWindowsEditor(editor: 'vscode' | 'cursor'): string {
  const directoryName = editor === 'vscode' ? 'Microsoft VS Code' : 'Cursor'
  const executable = editor === 'vscode' ? 'Code.exe' : 'Cursor.exe'
  const candidates: string[] = []
  if (process.env.LOCALAPPDATA)
    candidates.push(win32.join(process.env.LOCALAPPDATA, 'Programs', directoryName, executable))
  for (const root of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
    if (root)
      candidates.push(win32.join(root, directoryName, executable))
  }
  for (const directory of (process.env.PATH ?? '').split(';').filter(Boolean)) {
    candidates.push(win32.join(directory, executable))
    candidates.push(win32.resolve(directory, '..', executable))
  }
  return candidates.find(candidate => existsSync(candidate)) ?? executable
}
