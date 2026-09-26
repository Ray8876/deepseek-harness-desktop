/**
 * settings-menu.utils.test.ts — 设置菜单桌宠条目的补丁契约。
 *
 * 仓库未装 jsdom：这里用最小假节点锁住三条真实契约——只认「设置」文案锚点、克隆项换文案
 * 与爪印图标并打守卫属性、缺 primitives 文案节点时中止（不插半成品条目）。
 */
import { describe, expect, it } from 'vitest'
import { decoratePetMenuItem, isSettingsMenuItem } from './settings-menu.utils'

interface FakeNode {
  textContent?: string
  label: FakeLabel | null
  icon: FakeIcon | null
  attributes: Record<string, string>
}

interface FakeLabel {
  textContent: string
}

interface FakeIcon {
  innerHTML: string
}

function fakeItem(text: string, structure = true): HTMLButtonElement {
  const label: FakeLabel | null = structure ? { textContent: text } : null
  const icon: FakeIcon | null = structure ? { innerHTML: '<svg data-official="1"></svg>' } : null
  const node = {
    textContent: text,
    label,
    icon,
    attributes: {} as Record<string, string>,
    cloneNode(): unknown {
      return fakeItem(text, structure)
    },
    querySelector(selector: string): unknown {
      if (selector.includes('itemLabel'))
        return node.label
      if (selector.includes('itemIcon'))
        return node.icon
      return null
    },
    setAttribute(name: string, value: string): void {
      node.attributes[name] = value
    },
  }
  return node as unknown as HTMLButtonElement
}

describe('isSettingsMenuItem', () => {
  it('matches only the settings labels', () => {
    expect(isSettingsMenuItem(fakeItem('设置'))).toBe(true)
    expect(isSettingsMenuItem(fakeItem('Settings'))).toBe(true)
    expect(isSettingsMenuItem(fakeItem('删除工作区'))).toBe(false)
    expect(isSettingsMenuItem(fakeItem('设置宠物'))).toBe(false)
  })
})

describe('decoratePetMenuItem', () => {
  it('rewrites the label and icon and marks the clone', () => {
    const source = fakeItem('设置')

    const item = decoratePetMenuItem(source, '启用宠物')
    const clone = item as unknown as FakeNode

    expect(clone).not.toBe(source)
    expect(clone.label?.textContent).toBe('启用宠物')
    expect(clone.icon?.innerHTML).toContain('<path')
    expect(clone.attributes['data-dsh-tauri-pet-menu-item']).toBe('1')
  })

  it('refuses to decorate a non-primitives item', () => {
    expect(decoratePetMenuItem(fakeItem('设置', false), '启用宠物')).toBeNull()
  })
})
