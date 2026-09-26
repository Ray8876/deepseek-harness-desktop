/**
 * register/shortcuts.ts — 快捷键目录桥（iframe ↔ 宿主导航栏）。
 *
 * iframe → 宿主：把核心 `ctx.shortcuts` 的目录投影成 `{ id, label, keys, aria }`，经
 * `dsh://shortcuts` 送达壳层；壳层的「文件」「帮助」菜单右侧按键提示与「显示键盘快捷键」
 * 清单都读这一份（配置变更后重发，用户改键即时生效）。
 *
 * 宿主 → iframe：`dsh://edit` 由壳层的「编辑」菜单发出，在文档上执行对应编辑命令；
 * 剪贴板仍走系统快捷键（WebView 的原生粘贴不对脚本开放）。
 *
 * 协议字面量与宿主侧 `src/layout/components/webview.tsx` / `navbar.tsx` 逐字一致。
 */
import type { ParentMessage } from '../types'
import { invokeParent } from '../service/invoke-parent'
import { listenParent } from '../service/listen-parent'
import { defineRegister } from './index'

/** iframe → 宿主：快捷键目录回报。 */
export const EVENT_SHORTCUTS = 'dsh://shortcuts'

/** 宿主 → iframe：编辑菜单命令。 */
export const CMD_EDIT = 'dsh://edit'

/** 宿主 → iframe：打开官方「键盘快捷键」弹层（官方 `shortcuts.open` 命令，含官方蒙版）。 */
export const CMD_SHORTCUTS_OPEN = 'dsh://shortcuts:open'

/** 菜单可执行的编辑动作（`document.execCommand` 的命令名）。 */
export const EDIT_ACTIONS = ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'] as const

export type EditAction = typeof EDIT_ACTIONS[number]

/** 上报给壳层的一行目录（官方 `ShortcutCatalogEntry` 的投影）。 */
export interface ShortcutRowReport {
  id: string
  label: string
  keys: readonly string[]
  aria?: string
}

interface CatalogLike {
  getSnapshot?: () => unknown
  subscribe?: (listener: () => void) => () => void
}

interface ShortcutsLike {
  catalog?: CatalogLike
}

const ROW_MAX = 200

export const shortcutsFeature = defineRegister((controller, ctx) => {
  const service = ctx.get('shortcuts') as ShortcutsLike | undefined
  const catalog = service?.catalog
  const snapshot = catalog?.getSnapshot
  if (typeof snapshot !== 'function')
    return

  const report = (): void => {
    invokeParent({ type: EVENT_SHORTCUTS, rows: project(snapshot.call(catalog)) })
  }
  report()
  if (typeof catalog?.subscribe === 'function')
    controller.add(catalog.subscribe(report))

  controller.add(listenParent<ParentMessage>((data) => {
    if (data.type === CMD_SHORTCUTS_OPEN) {
      openReference(snapshot.call(catalog))
      return
    }
    runEdit(data.action)
  }, [CMD_EDIT, CMD_SHORTCUTS_OPEN]))
})

/** 目录投影：只保留有 id 与文案的行，`keys` 逐项取字符串。 */
function project(rows: unknown): ShortcutRowReport[] {
  if (!Array.isArray(rows))
    return []
  const out: ShortcutRowReport[] = []
  for (const row of rows) {
    if (typeof row !== 'object' || row === null)
      continue
    const entry = row as { id?: unknown, label?: unknown, keys?: unknown, aria?: unknown }
    if (typeof entry.id !== 'string' || typeof entry.label !== 'string')
      continue
    const keys = Array.isArray(entry.keys) ? entry.keys.filter((key): key is string => typeof key === 'string') : []
    out.push({
      id: entry.id,
      label: entry.label,
      keys,
      ...typeof entry.aria === 'string' ? { aria: entry.aria } : {},
    })
    if (out.length >= ROW_MAX)
      break
  }
  return out
}

/** 编辑命令：文档级 `document.execCommand`；失败只告警（原生快捷键仍是主路径）。 */
function runEdit(action: unknown): void {
  if (typeof action !== 'string' || !EDIT_ACTIONS.includes(action as EditAction))
    return
  if (typeof document === 'undefined')
    return
  try {
    document.execCommand(action)
  }
  catch (error) {
    console.warn('[dsh-tauri] running the edit command failed:', error)
  }
}

/**
 * 打开官方「键盘快捷键」弹层：官方命令没有公开的调用口，按其**生效**绑定补一次合成
 * keydown（官方键盘适配器只读 `event.code` 与修饰键，不校验 `isTrusted`），
 * 走的仍是官方 `shortcuts.open` 命令与其 `shell.overlay` 弹层（含官方蒙版）。
 */
function openReference(rows: unknown): void {
  if (typeof window === 'undefined' || typeof KeyboardEvent !== 'function')
    return
  const binding = bindingOf(rows, 'shortcuts.open')
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...binding ?? { code: 'Slash', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
  })
  window.dispatchEvent(event)
}

/** 目录里取某命令的生效绑定，翻成 KeyboardEvent 的物理键 + 修饰键字段。 */
function bindingOf(rows: unknown, id: string): KeyboardEventInit | undefined {
  if (!Array.isArray(rows))
    return undefined
  for (const row of rows) {
    if (typeof row !== 'object' || row === null)
      continue
    const entry = row as { id?: unknown, binding?: unknown }
    if (entry.id !== id)
      continue
    const binding = entry.binding
    if (typeof binding !== 'object' || binding === null)
      return undefined
    const { code, modifiers } = binding as { code?: unknown, modifiers?: unknown }
    if (typeof code !== 'string')
      return undefined
    const list = Array.isArray(modifiers) ? modifiers.filter((value): value is string => typeof value === 'string') : []
    return {
      code,
      ctrlKey: list.some(value => value === 'control' || value === 'ctrl'),
      metaKey: list.some(value => value === 'meta' || value === 'command' || value === 'cmd'),
      altKey: list.some(value => value === 'alt' || value === 'option'),
      shiftKey: list.includes('shift'),
    }
  }
  return undefined
}
