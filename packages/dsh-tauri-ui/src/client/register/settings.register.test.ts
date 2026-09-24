import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerSettings } from './settings'

const mocks = vi.hoisted(() => ({
  settings: {
    launcherAvailable: false,
    setLauncherAvailable(value: boolean): void {
      mocks.settings.launcherAvailable = value
    },
  },
}))

vi.mock('../store', () => ({ store: { settings: mocks.settings } }))
vi.mock('../ui/sidebar', () => ({ SettingsSidebar: () => null }))
vi.mock('../ui/trigger', () => ({ SettingsTrigger: () => null }))
vi.mock('@deepseek-ai/dsh-client-ui-renderer', () => ({ SlotOutlet: () => null }))
vi.mock('dsh-tauri/client', () => ({
  defineRegister: (setup: (controller: unknown, ctx: unknown) => void) =>
    function registerEffect(this: unknown) {
      setup({ add: (): void => {} }, this)
      return (): void => {}
    },
}))

afterEach(() => {
  mocks.settings.launcherAvailable = false
})

/** 用最小 slots 面记录注入点：inject 只登记，register 由激活回调按需触发。 */
function activate() {
  const injected: Array<{ key: string, activate: () => unknown }> = []
  const registered: string[] = []
  const ctx = {
    slots: {
      inject(key: string, callback: () => unknown) {
        injected.push({ key, activate: callback })
        return (): void => {}
      },
      register(options: { name: string }) {
        registered.push(options.name)
        return (): void => {}
      },
    },
  }

  ;(registerSettings as unknown as (this: unknown) => void).call(ctx)

  return { injected, registered }
}

describe('registerSettings launcher seat', () => {
  it('registers the settings seats and probes the official launcher slot', () => {
    const { injected, registered } = activate()

    expect(injected.map(entry => entry.key)).toEqual([
      'shell.overlay',
      'sidebar.settings',
      'settings.launcher',
    ])

    for (const entry of injected)
      entry.activate()

    expect(registered).toContain('shell.overlay')
    expect(registered).toContain('sidebar.settings')
  })

  /** 官方账号菜单落在 `settings.launcher`：声明前必须退回自有触发器，声明后由官方条目渲染。 */
  it('hosts the official account launcher only while it is declared', () => {
    const { injected } = activate()
    const launcher = injected.find(entry => entry.key === 'settings.launcher')

    expect(launcher).toBeDefined()
    const dispose = launcher?.activate() as (() => void) | undefined
    expect(mocks.settings.launcherAvailable).toBe(true)

    dispose?.()
    expect(mocks.settings.launcherAvailable).toBe(false)
  })
})
