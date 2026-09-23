import type { ReactElement, SVGProps } from 'react'
import { createElement } from 'react'
import {
  PET_SETTINGS_ROW_CLASS,
  SETTINGS_TRIGGER_RAIL_CLASS,
} from '../constants'

/** 爪印字形（@gravity-ui/icons 无对应图标，随 currentColor 变色）。 */
const PET_PAW_PATHS = [
  'M12 13.5c-2.7 0-5.5 2-5.5 4.3 0 1.4 1 2.2 2.3 2.2 1 0 1.9-.6 3.2-.6s2.2.6 3.2.6c1.3 0 2.3-.8 2.3-2.2 0-2.3-2.8-4.3-5.5-4.3z',
  'M7.3 8.1c-1 .1-1.8 1.2-1.7 2.5.1 1.2 1 2.1 2 2 .9-.1 1.7-1.2 1.6-2.4-.1-1.2-1-2.2-1.9-2.1z',
  'M12 4.5c-1.1 0-2 1.1-2 2.5s.9 2.5 2 2.5 2-1.1 2-2.5-.9-2.5-2-2.5z',
  'M16.7 8.1c-.9-.1-1.8.9-1.9 2.1-.1 1.2.7 2.3 1.6 2.4 1 .1 1.9-.8 2-2 .1-1.3-.7-2.4-1.7-2.5z',
  'M4.8 12.3c-.8.3-1.2 1.4-.9 2.4.3 1 1.2 1.6 2 1.3.8-.3 1.1-1.4.8-2.4-.3-1-1.1-1.6-1.9-1.3z',
  'M19.2 12.3c-.8-.3-1.6.3-1.9 1.3-.3 1 0 2.1.8 2.4.8.3 1.7-.3 2-1.3.3-1-.1-2.1-.9-2.4z',
]

export function PetPawIcon(props: SVGProps<SVGSVGElement>): ReactElement {
  return createElement(
    'svg',
    { 'viewBox': '0 0 24 24', 'fill': 'currentColor', 'aria-hidden': 'true', ...props },
    PET_PAW_PATHS.map(path => createElement('path', { key: path, d: path })),
  )
}

/** 触发器是否处于折叠态（Rail 圆形按钮）：折叠态保持定宽，不做拉伸修正。 */
export function isRailTrigger(trigger: HTMLElement): boolean {
  return trigger.classList.contains(SETTINGS_TRIGGER_RAIL_CLASS)
}

/**
 * 把触发器宿主立成 flex 行（复刻新版 dsh 客户端 SettingsRoot 的 triggerRow）。
 *
 * 除行类 + CSS 规则外再写一份内联样式兜底：CSS 可能被加载顺序/特异性盖过（表现为图标
 * 仍被挤到下一行），而 React 对未声明 style 的节点不会清除外部内联样式。
 */
export function applySettingsRow(host: HTMLElement, trigger: HTMLElement, rail: boolean): void {
  host.classList.add(PET_SETTINGS_ROW_CLASS)
  host.style.display = 'flex'
  host.style.alignItems = 'center'
  host.style.gap = '8px'
  host.style.width = '100%'
  if (rail) {
    trigger.style.removeProperty('flex')
    trigger.style.removeProperty('width')
    trigger.style.removeProperty('min-width')
    return
  }
  trigger.style.flex = '1 1 auto'
  trigger.style.width = 'auto'
  trigger.style.minWidth = '0'
}

/** 撤销设置行的类与内联样式（卸载时；未打过补丁的节点原样返回）。 */
export function revertSettingsRow(host: HTMLElement | undefined, trigger: HTMLElement | undefined): void {
  if (host) {
    host.classList.remove(PET_SETTINGS_ROW_CLASS)
    host.style.removeProperty('display')
    host.style.removeProperty('align-items')
    host.style.removeProperty('gap')
    host.style.removeProperty('width')
  }
  if (!trigger)
    return
  trigger.style.removeProperty('flex')
  trigger.style.removeProperty('width')
  trigger.style.removeProperty('min-width')
}
