import type { RegisterController } from 'dsh-tauri/client'
import { Icon, IconButton, StateDot } from 'dsh-tauri-ui/client'
import { defineRegister } from 'dsh-tauri/client'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import {
  PET_ICON_ATTRIBUTE,
  PET_ICON_RETRY_MAX,
  PET_ICON_RETRY_MS,
  SETTINGS_TRIGGER_SELECTOR,
  SIDEBAR_SELECTOR,
} from '../constants'
import { locale } from '../locales'
import { loadPetStatus, togglePet } from '../service/pet'
import { store } from '../store'
import {
  applySettingsRow,
  isRailTrigger,
  PetPawIcon,
  revertSettingsRow,
} from './sidebar-icon.utils'

/**
 * 侧栏桌宠入口补丁：入口由 dsh-tauri-ui 的 IconButton 渲染，插在 `.dshp-settings-trigger`
 * 右侧；两态（绿点 = 已启用），点击切换启用状态，设置页走 settings.section。
 */
export const sidebarIconFeature = defineRegister((controller) => {
  registerSidebarPetIcon(controller)
})

/** 当前是否启用（绿点两态的唯一真值来自共享 store）。 */
function iconActive(): boolean {
  return store.pet.$state.status?.enabled ?? false
}

/** 纯持久开关：关掉即落盘 `enabled=false`，重启后不会自己再起来（失败由服务层记录）。 */
async function toggleEnabled(): Promise<void> {
  await togglePet({ enabled: !iconActive() })
}

function registerSidebarPetIcon(controller: RegisterController): void {
  if (typeof document === 'undefined')
    return

  const label = locale.text('name')
  // 按钮渲染在脱离文档的 React 根里再搬进侧栏：根外收不到合成事件（交互走原生监听），
  // 卸载前必须搬回容器（React 只从自己的容器里摘节点）。
  const entryHost = document.createElement('div')
  const entryRoot = createRoot(entryHost)
  let button: HTMLButtonElement | undefined
  let rowHost: HTMLElement | undefined
  let patchedTrigger: HTMLElement | undefined
  let patchedRail: boolean | undefined

  const onClick = (): void => {
    void toggleEnabled()
  }

  function render(): void {
    const active = iconActive()
    entryRoot.render(createElement(
      IconButton,
      {
        'variant': 'round',
        'className': 'dshp-pet__icon-entry',
        'icon': createElement(Icon, { as: PetPawIcon }),
        'aria-label': label,
        'aria-pressed': active,
      },
      active
        ? createElement(
            'span',
            { className: 'dshp-pet__icon-dot' },
            createElement(StateDot, { state: 'done', size: 6 }),
          )
        : null,
    ))
  }

  /** 按钮由 React 异步渲染进宿主，落到宿主后才挂守卫属性、提示气泡与点击监听。 */
  function capture(): void {
    if (button !== undefined)
      return
    const node = entryHost.firstElementChild
    if (!(node instanceof HTMLButtonElement))
      return
    button = node
    button.setAttribute(PET_ICON_ATTRIBUTE, '1')
    button.setAttribute('data-tip', label)
    button.addEventListener('click', onClick)
    scan()
  }

  /** 行布局只在宿主/触发器/折叠态真的变化时才重写（观察器回调高频）。 */
  function applyRowStyles(host: HTMLElement, trigger: HTMLElement): void {
    const rail = isRailTrigger(trigger)
    if (host === rowHost && trigger === patchedTrigger && rail === patchedRail)
      return
    applySettingsRow(host, trigger, rail)
    rowHost = host
    patchedTrigger = trigger
    patchedRail = rail
  }

  /** 看护入口按钮：触发器就绪且按钮不在其右侧时（首次挂载 / React 重渲染丢弃）重新插入。 */
  function ensurePlaced(): void {
    const trigger = document.querySelector<HTMLElement>(SETTINGS_TRIGGER_SELECTOR)
    if (!trigger?.parentElement)
      return
    applyRowStyles(trigger.parentElement, trigger)
    if (button === undefined || (button.isConnected && button.previousElementSibling === trigger))
      return
    trigger.after(button)
  }

  function scan(): void {
    // 侧栏未就绪时静默跳过（由重试计时器兜底），就绪后交由观察器看护。
    if (!document.querySelector(SIDEBAR_SELECTOR))
      return
    ensurePlaced()
  }

  // 按钮异步落到宿主，宿主一变就去认领；两态随 store 变化，首屏再拉一次权威状态。
  controller.observe(entryHost, capture, { childList: true })
  render()
  controller.add(store.pet.$subscribe(render))
  void loadPetStatus()

  controller.observe(document.body, scan, { childList: true, subtree: true })

  // 观察器覆盖不到「应用晚挂载、长时间无 DOM 变更」的空窗，补一条短暂轮询（侧栏出现即停）。
  let tries = 0
  const stopPolling = controller.interval(() => {
    scan()
    if (document.querySelector(SIDEBAR_SELECTOR) || ++tries > PET_ICON_RETRY_MAX)
      stopPolling()
  }, PET_ICON_RETRY_MS)
  scan()

  // 收尾：注册顺序保证它在观察器断开之后执行（否则移除按钮会触发 scan 重新插入）。
  controller.add(() => {
    if (button !== undefined) {
      button.removeEventListener('click', onClick)
      entryHost.append(button)
      button = undefined
    }
    entryRoot.unmount()
    revertSettingsRow(rowHost, patchedTrigger)
    rowHost = undefined
    patchedTrigger = undefined
    patchedRail = undefined
  })
}
