import type { EventHandlerRequest } from 'dsh-tauri'
import type { EditorPreference } from '../../../../shared/editor.types'
import type { EditorPreferenceBody, EditorPreferenceResponse } from '../../index.types'
import { defineEventHandler, readBody } from 'dsh-tauri'
import { parseEditorPreference } from '../../../../shared/editor'
import { configFile } from '../../../service/config-file'

export default defineEventHandler<EventHandlerRequest, Promise<EditorPreferenceResponse>>(async (event) => {
  let preference: EditorPreference
  try {
    const body = await readBody<EditorPreferenceBody>(event, { type: 'json' })
    preference = parseEditorPreference(body?.preference)
  }
  catch (error) {
    event.res.status = 400
    return { error: error instanceof Error ? error.message : String(error) }
  }
  try {
    return { preference: await configFile.save(preference) }
  }
  catch (error) {
    event.res.status = 500
    return { error: error instanceof Error ? error.message : String(error) }
  }
})
