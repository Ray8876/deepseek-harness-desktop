import type { ClientContext } from 'dsh-tauri/client'
import { SlotOutlet } from '@deepseek-ai/dsh-client-ui-renderer'
import { defineRegister } from 'dsh-tauri/client'
import {
  SETTINGS_LAUNCHER_SLOT,
  SETTINGS_REGISTRANT,
  SETTINGS_SHELL_OVERLAY_SLOT,
  SETTINGS_SIDEBAR_ID,
  SETTINGS_SIDEBAR_SLOT,
  SETTINGS_TRIGGER_PRIORITY,
} from '../constants'
import { store } from '../store'
import { SettingsSidebar } from '../ui/sidebar'
import { SettingsTrigger } from '../ui/trigger'

export const registerSettings = defineRegister<ClientContext>((controller, ctx) => {
  if (typeof SlotOutlet !== 'function') {
    console.warn(
      '[dsh-tauri-ui] <SlotOutlet> unavailable (renderer patch missing) — settings sidebar disabled, official dialog stays.',
    )
    return
  }

  controller.add(
    ctx.slots.inject(SETTINGS_SHELL_OVERLAY_SLOT, () =>
      ctx.slots.register(
        { name: SETTINGS_SHELL_OVERLAY_SLOT, id: SETTINGS_SIDEBAR_ID, registrant: SETTINGS_REGISTRANT, inject: () => ({}) } as never,
        SettingsSidebar as never,
      )),
  )
  controller.add(
    ctx.slots.inject(SETTINGS_SIDEBAR_SLOT as never, () =>
      ctx.slots.register(
        { name: SETTINGS_SIDEBAR_SLOT, priority: SETTINGS_TRIGGER_PRIORITY, registrant: SETTINGS_REGISTRANT } as never,
        SettingsTrigger,
      )),
  )
  controller.add(
    ctx.slots.inject(SETTINGS_LAUNCHER_SLOT, () => {
      store.settings.setLauncherAvailable(true)
      return () => store.settings.setLauncherAvailable(false)
    }),
  )
})
