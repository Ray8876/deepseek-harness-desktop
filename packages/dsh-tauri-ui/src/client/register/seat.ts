import type { ClientContext } from 'dsh-tauri/client'
import { defineRegister } from 'dsh-tauri/client'
import {
  SETTINGS_REGISTRANT,
  SETTINGS_SHELL_OVERLAY_SLOT,
  SETTINGS_SHELL_SEAT_ID,
} from '../constants'
import { TauriUiSeat } from '../ui/seat'

export const registerShellSeat = defineRegister<ClientContext>((controller, ctx) => {
  controller.add(
    ctx.slots.inject(SETTINGS_SHELL_OVERLAY_SLOT, () =>
      ctx.slots.register(
        {
          name: SETTINGS_SHELL_OVERLAY_SLOT,
          id: SETTINGS_SHELL_SEAT_ID,
          registrant: SETTINGS_REGISTRANT,
        },
        TauriUiSeat,
      )),
  )
})
