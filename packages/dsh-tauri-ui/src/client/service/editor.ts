import type { EditorPreference } from '../../shared/editor.types'
import { parseEditorPreference } from '../../shared/editor'
import { getConfigEditor, putConfigEditor } from '../apis'

export async function loadEditor(): Promise<EditorPreference> {
  const response = await getConfigEditor({ ignoreResponseError: true })
  if (response.error)
    throw new Error(response.error)
  return parseEditorPreference(response.preference)
}

export async function saveEditor(preference: EditorPreference): Promise<{ ok: boolean, error?: string }> {
  try {
    const response = await putConfigEditor({ preference: parseEditorPreference(preference) }, { ignoreResponseError: true })
    if (response.error)
      return { ok: false, error: response.error }
    parseEditorPreference(response.preference)
    return { ok: true }
  }
  catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
