import type { EventHandlerRequest } from 'dsh-tauri'
import type { OpenModelsConfigResponse } from '../../index.types'
import { defineEventHandler } from 'dsh-tauri'
import { configFile } from '../../../service/config-file'

export default defineEventHandler<EventHandlerRequest, Promise<OpenModelsConfigResponse>>(async (event) => {
  const result = await configFile.open()
  if (!result.ok) {
    event.res.status = 500
    return { ok: false, path: result.path, error: result.error }
  }
  return { ok: true, path: result.path, opened: result.opened }
})
