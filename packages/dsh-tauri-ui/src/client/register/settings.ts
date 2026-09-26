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

const SETTINGS_SHORTCUT_EFFECT = 'dsh-tauri-ui: settings launcher shortcut (Ctrl+, hint)'

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
  controller.add(ctx.effect(() => publishLauncherShortcut(ctx), SETTINGS_SHORTCUT_EFFECT))
})

/**
 * 官方启动器座位的「Ctrl+,」提示：座位拿的是 ownerProps，读不到服务，
 * 这里把 `settings.open` 的生效按键投影进自己的 store（用户改键后重发）。
 * 核心没有快捷键服务（老核心）时不写值，座位不显示提示。
 */
function publishLauncherShortcut(ctx: ClientContext): () => void {
  const catalog = (ctx.get('shortcuts') as ShortcutsLike | undefined)?.catalog
  const snapshot = catalog?.getSnapshot
  if (typeof snapshot !== 'function')
    return () => {}

  const publish = (): void => {
    store.settings.setLauncherShortcut(shortcutOf(snapshot.call(catalog)))
  }
  publish()
  const off = typeof catalog?.subscribe === 'function' ? catalog.subscribe(publish) : undefined
  return () => {
    off?.()
    store.settings.setLauncherShortcut(undefined)
  }
}

/** 目录里 `settings.open` 的生效按键；缺行或键位为空即视为没有提示。 */
function shortcutOf(rows: unknown): { keys: readonly string[], aria?: string } | undefined {
  if (!Array.isArray(rows))
    return undefined
  for (const row of rows) {
    if (typeof row !== 'object' || row === null)
      continue
    const entry = row as { id?: unknown, keys?: unknown, aria?: unknown }
    if (entry.id !== 'settings.open')
      continue
    const keys = Array.isArray(entry.keys) ? entry.keys.filter((key): key is string => typeof key === 'string') : []
    if (keys.length === 0)
      return undefined
    return { keys, ...typeof entry.aria === 'string' ? { aria: entry.aria } : {} }
  }
  return undefined
}

interface CatalogLike {
  getSnapshot?: () => unknown
  subscribe?: (listener: () => void) => () => void
}

interface ShortcutsLike {
  catalog?: CatalogLike
}
