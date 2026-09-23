import type { ConnectionHost, HostContext } from '../types'

export interface HostRuntime<C = HostContext> {
  setCurrentHostInstance: (ctx: C | undefined) => void
  getCurrentHostInstance: () => C
}

/** 每个插件的 `config/runtime.ts` 各调用一次，得到插件私有的绑定槽位。 */
export function defineHostRuntime<C = HostContext>(): HostRuntime<C> {
  let current: C | undefined

  return {
    setCurrentHostInstance: (ctx) => {
      current = ctx
    },
    getCurrentHostInstance: () => {
      if (current === undefined)
        throw new TypeError('getCurrentHostInstance: 宿主实例尚未绑定，apply.ts 需先调用 setCurrentHostInstance(ctx)')
      return current
    },
  }
}

/** dsh-tauri 自身的宿主绑定槽位（载体鉴权适配读 `connection`）。 */
export const { setCurrentHostInstance, getCurrentHostInstance } = defineHostRuntime<ConnectionHost>()

export function clearHostRuntime(): void {
  setCurrentHostInstance(undefined)
}
