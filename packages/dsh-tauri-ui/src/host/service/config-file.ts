import type { EditorPreference } from '../../shared/editor.types'
import type { ConfigOpenResult } from './config-file.types'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { defineService, openDirectory, writeAtomic } from 'dsh-tauri'
import { PLUGIN_ID } from '../../shared/constants'
import { parseEditorPreference } from '../../shared/editor'
import { resolveSettingsFilePath } from '../utils/paths'
import { openInEditor } from './config-file.utils'

export const configFile = defineService({
  async load(): Promise<EditorPreference> {
    let content: string
    try {
      content = await readFile(preferencePath(), 'utf8')
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return { editor: 'system', command: '' }
      throw error
    }
    try {
      return parseEditorPreference(JSON.parse(content))
    }
    catch {
      return { editor: 'system', command: '' }
    }
  },

  async save(preference: EditorPreference): Promise<EditorPreference> {
    const normalized = parseEditorPreference(preference)
    await writeAtomic(preferencePath(), JSON.stringify(normalized))
    return normalized
  },

  async open(): Promise<ConfigOpenResult> {
    const path = resolveSettingsFilePath()
    try {
      const servesFile = await isFile(path)
      if (servesFile)
        await openInEditor(path, await configFile.load())
      else
        await openDirectory(dirname(path))
      return { ok: true, path: servesFile ? path : dirname(path), opened: servesFile ? 'file' : 'directory' }
    }
    catch (error) {
      return { ok: false, path, error: error instanceof Error ? error.message : String(error) }
    }
  },
})

function preferencePath(): string {
  return join(dirname(resolveSettingsFilePath()), PLUGIN_ID, 'editor.json')
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return false
    throw error
  }
}
