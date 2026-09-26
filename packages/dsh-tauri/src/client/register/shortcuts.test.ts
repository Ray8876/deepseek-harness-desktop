/**
 * register/shortcuts.test.ts — 快捷键桥的三条契约。
 *
 * 1. iframe → 宿主：核心 `ctx.shortcuts.catalog` 的目录投影后经 `dsh://shortcuts` 回报
 *    （壳层菜单右侧的按键提示都读它），配置变更后重发；
 * 2. 宿主 → iframe：`dsh://edit` 在文档上执行对应编辑命令，非法 action 不进文档；
 * 3. 宿主 → iframe：`dsh://shortcuts:open` 按官方 `shortcuts.open` 的**生效**绑定补一次
 *    合成 keydown，弹出官方弹层与官方蒙版（壳层不自建对话框）。
 *
 * 核心没有 `shortcuts` 服务（老核心）时全部保持沉默，不得抛错。
 */
import type { ClientContext, ParentMessage } from '../types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CMD_EDIT, CMD_SHORTCUTS_OPEN, EVENT_SHORTCUTS, shortcutsFeature } from './shortcuts'

const dispatchers = new Set<(event: KeyboardEvent) => void>()

interface Harness {
  sent: ParentMessage[]
  dispatch: (data: unknown) => void
  listeners: () => number
  keydowns: KeyboardEvent[]
}

function stubEnv(): Harness {
  const sent: ParentMessage[] = []
  const listeners = new Set<(event: MessageEvent) => void>()
  dispatchers.clear()
  const parent = { postMessage: (data: ParentMessage) => void sent.push(data) }
  vi.stubGlobal('window', {
    parent,
    addEventListener: (type: string, handler: (event: never) => void) => {
      if (type === 'message')
        listeners.add(handler as (event: MessageEvent) => void)
      if (type === 'keydown')
        dispatchers.add(handler as (event: KeyboardEvent) => void)
    },
    removeEventListener: (_type: string, handler: (event: never) => void) => {
      listeners.delete(handler as (event: MessageEvent) => void)
      dispatchers.delete(handler as (event: KeyboardEvent) => void)
    },
    dispatchEvent: (event: KeyboardEvent) => {
      for (const handler of dispatchers)
        handler(event)
      return true
    },
  })
  vi.stubGlobal('document', { execCommand: vi.fn(() => true) })
  return {
    sent,
    listeners: () => listeners.size,
    keydowns: [],
    dispatch(data: unknown) {
      for (const handler of listeners)
        handler({ source: parent, data } as unknown as MessageEvent)
    },
  }
}

const disposers: (() => void)[] = []

function fakeCtx(service: unknown): ClientContext {
  return {
    get: () => service,
    effect(callback: (this: unknown) => () => void) {
      const dispose = callback.call({ ctx: this })
      disposers.push(dispose)
      return dispose
    },
  } as unknown as ClientContext
}

function catalogService(rows: unknown[], subscribe?: (listener: () => void) => () => void) {
  return { catalog: { getSnapshot: () => rows, ...subscribe === undefined ? {} : { subscribe } } }
}

afterEach(() => {
  for (const dispose of disposers.splice(0))
    dispose()
  vi.unstubAllGlobals()
})

describe('shortcutsFeature', () => {
  it('projects the catalog to the shell and republishes on change', () => {
    const env = stubEnv()
    let notify = (): void => {}
    const ctx = fakeCtx(catalogService([
      { id: 'session.new', label: 'New chat', keys: ['Ctrl+N'], aria: 'Control+N', modified: false },
      { id: 'workspace.add', label: 'Open folder', keys: ['Ctrl+O'] },
      { id: 42, label: 'broken' },
      { id: 'no.label' },
    ], (listener) => {
      notify = listener
      return () => {}
    }))

    shortcutsFeature.call(ctx)

    expect(env.sent).toEqual([{
      type: EVENT_SHORTCUTS,
      rows: [
        { id: 'session.new', label: 'New chat', keys: ['Ctrl+N'], aria: 'Control+N' },
        { id: 'workspace.add', label: 'Open folder', keys: ['Ctrl+O'] },
      ],
    }])
    expect(env.listeners()).toBe(1)

    notify()
    expect(env.sent).toHaveLength(2)
  })

  it('stays inert when the core has no shortcuts service', () => {
    const env = stubEnv()

    expect(() => shortcutsFeature.call(fakeCtx(undefined))).not.toThrow()
    expect(env.sent).toEqual([])
    expect(env.listeners()).toBe(0)
  })

  it('runs the edit command and ignores unknown actions', () => {
    const env = stubEnv()
    const exec = vi.fn(() => true)
    vi.stubGlobal('document', { execCommand: exec })

    shortcutsFeature.call(fakeCtx(catalogService([])))
    env.dispatch({ type: CMD_EDIT, action: 'copy' })
    env.dispatch({ type: CMD_EDIT, action: 'rm -rf' })
    env.dispatch({ type: 'dsh://sidebar:toggle' })

    expect(exec).toHaveBeenCalledTimes(1)
    expect(exec).toHaveBeenCalledWith('copy')
  })

  /** 官方弹层：用目录里的生效绑定合成 keydown（官方适配器只看 code + 修饰键）。 */
  it('opens the official reference with the effective binding', () => {
    const env = stubEnv()
    class FakeKeyboardEvent {
      code: string
      ctrlKey: boolean
      metaKey: boolean
      altKey: boolean
      shiftKey: boolean
      constructor(_type: string, init: KeyboardEventInit = {}) {
        this.code = init.code ?? ''
        this.ctrlKey = Boolean(init.ctrlKey)
        this.metaKey = Boolean(init.metaKey)
        this.altKey = Boolean(init.altKey)
        this.shiftKey = Boolean(init.shiftKey)
      }
    }
    vi.stubGlobal('KeyboardEvent', FakeKeyboardEvent)
    let seen: FakeKeyboardEvent | undefined
    const handler = (event: FakeKeyboardEvent): void => {
      seen = event
    }
    dispatchers.add(handler as unknown as (event: KeyboardEvent) => void)

    shortcutsFeature.call(fakeCtx(catalogService([
      { id: 'shortcuts.open', label: 'Shortcuts', keys: ['Ctrl+/'], binding: { code: 'Slash', modifiers: ['control'] } },
    ])))
    env.dispatch({ type: CMD_SHORTCUTS_OPEN })

    expect(seen?.code).toBe('Slash')
    expect(seen?.ctrlKey).toBe(true)
    expect(seen?.metaKey).toBe(false)
    dispatchers.delete(handler as unknown as (event: KeyboardEvent) => void)
  })
})
