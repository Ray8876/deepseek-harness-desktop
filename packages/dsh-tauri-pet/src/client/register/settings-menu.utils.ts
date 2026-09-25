import {
  MENU_ITEM_ICON_SELECTOR,
  MENU_ITEM_LABEL_SELECTOR,
  PET_MENU_ITEM_ATTRIBUTE,
  SETTINGS_MENU_LABELS,
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

/** 克隆条目换图标用的标记串（不引入 react-dom/server）。 */
const PET_PAW_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${PET_PAW_PATHS.map(path => `<path d="${path}"/>`).join('')}</svg>`

/**
 * 该条目是否是设置菜单的锚点（文案为「设置」）。
 *
 * 官方账号菜单与壳层自有菜单都以它作为唯一稳定锚点：两者条目结构相同（primitives 的
 * `button[role=menuitem]`），其它菜单（工作区、模型选择）不含该文案。
 */
export function isSettingsMenuItem(item: HTMLElement): boolean {
  const text = item.textContent?.trim() ?? ''
  return SETTINGS_MENU_LABELS.includes(text)
}

/**
 * 克隆官方条目改成桌宠动作项：样式随克隆继承（绝不手写动态类名哈希），只换文案与图标。
 * 文案节点缺失（非 primitives 结构）时返回 null，调用方中止插入，不追加半成品条目。
 */
export function decoratePetMenuItem(source: HTMLButtonElement, label: string): HTMLButtonElement | null {
  const item = source.cloneNode(true) as HTMLButtonElement
  const labelNode = item.querySelector<HTMLElement>(MENU_ITEM_LABEL_SELECTOR)
  if (labelNode === null)
    return null
  labelNode.textContent = label
  const icon = item.querySelector<HTMLElement>(MENU_ITEM_ICON_SELECTOR)
  if (icon !== null)
    icon.innerHTML = PET_PAW_SVG
  item.setAttribute(PET_MENU_ITEM_ATTRIBUTE, '1')
  return item
}
