import type { ClientContext } from 'dsh-tauri/client'
import { defineRegister } from 'dsh-tauri/client'
import { PLUGIN_ID } from '../../shared/constants'
import { startUngroupedSession } from '../service/ungrouped-session'
import { newSessionButtonFrom, ungroupedCreateButtonFrom } from './new-session.utils'

/**
 * 官方侧边栏「新建会话」默认落到未分组：官方 onClick 挂在 React 根容器上，document 捕获阶段的
 * 监听先于它执行，`stopImmediatePropagation()` 即可让官方的 `startSession()` 分支整条不跑。
 *
 * 能力探测在**点击时**做（不是装配时）：composer 补丁的能力标记由官方 conversation 产物在
 * 求值时写下，装配顺序不保证它已经到位。缺补丁时放行官方分支（退级第 4 级），只告警一次。
 */
export const sidebarNewSessionFeature = defineRegister<ClientContext>((controller, ctx, adapter) => {
  if (typeof document === 'undefined')
    return

  let warned = false

  controller.listen('click', (event) => {
    if (newSessionButtonFrom(event.target) === null)
      return
    if (!adapter.has('composer.workspace-less')) {
      if (!warned) {
        warned = true
        console.warn(
          `[${PLUGIN_ID}] 「未分组」新建会话不可用：缺少桌面壳 composer 补丁（composer.workspace-less），沿用官方工作区选择。`,
        )
      }
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    startUngroupedSession(ctx, adapter)
  }, { capture: true })
})

/**
 * 官方「未分组」分组行的「+」在未分组桶里是空实现（`group.workspaceId === undefined`），
 * 点击没有任何效果。这里按与侧边栏「新建会话」完全相同的路径接管：切到会话并选中「未分组」。
 *
 * 能力探测同样在**点击时**做，缺补丁时放行官方分支（即空实现），只告警一次。
 */
export const ungroupedNewSessionFeature = defineRegister<ClientContext>((controller, ctx, adapter) => {
  if (typeof document === 'undefined')
    return

  let warned = false

  controller.listen('click', (event) => {
    if (ungroupedCreateButtonFrom(event.target) === null)
      return
    if (!adapter.has('composer.workspace-less')) {
      if (!warned) {
        warned = true
        console.warn(
          `[${PLUGIN_ID}] 「未分组」分组行新建会话不可用：缺少桌面壳 composer 补丁（composer.workspace-less），沿用官方行为。`,
        )
      }
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    startUngroupedSession(ctx, adapter)
  }, { capture: true })
})
