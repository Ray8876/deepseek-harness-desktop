import type { EventHandlerRequest } from 'dsh-tauri'
import type { EditorPreferenceResponse } from '../../index.types'
import { defineEventHandler } from 'dsh-tauri'
import { configFile } from '../../../service/config-file'

export default defineEventHandler<EventHandlerRequest, Promise<EditorPreferenceResponse>>(async (event) => {
  try {
    return { preference: await configFile.load() }
  }
  catch (error) {
    event.res.status = 500
    return { error: error instanceof Error ? error.message : String(error) }
  }
})
