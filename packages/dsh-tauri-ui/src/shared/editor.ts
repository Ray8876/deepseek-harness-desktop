import type { EditorPreference } from './editor.types'

export function parseEditorPreference(value: unknown): EditorPreference {
  if (typeof value !== 'object' || value === null)
    throw new Error('EDITOR_INVALID')
  const { editor, command } = value as Partial<EditorPreference>
  if (editor !== 'vscode' && editor !== 'cursor' && editor !== 'system' && editor !== 'custom')
    throw new Error('EDITOR_INVALID')
  if (typeof command !== 'string' || /[\r\n\0]/.test(command))
    throw new Error('EDITOR_INVALID')
  if (editor === 'custom' && !command.trim())
    throw new Error('EDITOR_COMMAND_REQUIRED')
  return { editor, command: command.trim() }
}
