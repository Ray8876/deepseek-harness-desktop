import type { AppSettingUpdate, ZoomAction } from './types'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { defineStore } from 'valtio-define'
import { persist } from 'valtio-define/plugins/persist'
import { storage } from '@/config/storage'
import { ZOOM_FACTOR_STEP } from './constants'
import { normalizeZoomFactor } from './utils'

export const setting = defineStore({
  state: () => ({
    installed: false,
    port: 3080,
    harness_max_heap_mb: null as number | null,
    auto_start: true,
    cli_link_enabled: true,
    zoom_factor: 1,
    close_action: 'tray',
    backup_retention_count: 10,
    backup_include_credentials: false,
    language: null as string | null,
  }),
  actions: {
    update(update: AppSettingUpdate) {
      return invoke('update_app_config', { ...update })
    },
    zoom(action: ZoomAction) {
      if (action === 'reset') {
        this.zoom_factor = 1
        return
      }
      const delta = action === 'increase' ? ZOOM_FACTOR_STEP : -ZOOM_FACTOR_STEP
      this.zoom_factor = normalizeZoomFactor(this.zoom_factor + delta)
    },
  },
  persist: {
    key: 'setting',
    storage,
  },
})

setting.use(persist({ hydrate: false }))

const unlisten = listen<typeof setting.$state>('setting_updated', async (event) => {
  setting.$patch(event.payload)
  await setting.$persist.rehydrate()
  unlisten.then(unlisten => unlisten())
})
