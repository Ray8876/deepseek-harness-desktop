import { invoke } from '../service/invoke'
import { defineRegister } from './index'

/** 官方账号流中与「自动打开浏览器」相关的最小投影（`AccountView.attempt` 子集）。 */
interface AccountAttemptView {
  phase?: string
  authorizeUrl?: string
}

interface AccountViewLike {
  attempt?: AccountAttemptView | null
}

/** `$stream` 的帧：官方 `RemoteStream.read()` 把 open() 的每个原始值包成 `{ value, accept }`。 */
interface AccountStreamFrame {
  value?: AccountViewLike
  accept?: () => void
}

interface AccountStreamLike extends AsyncIterable<AccountStreamFrame> {
  dispose?: () => Promise<void> | void
}

interface AccountRemoteLike {
  account?: {
    watch?: (signal: AbortSignal) => AsyncIterable<AccountViewLike>
  }
  $stream?: (options: {
    name: string
    open: (signal: AbortSignal) => AsyncIterable<AccountViewLike>
    ended: (accepted: boolean) => Error
  }) => AccountStreamLike
}

/** `ctx.inject` 给出的作用域上下文：只在这里读 `remote` / `remote.account`。 */
interface InjectedScope {
  remote?: AccountRemoteLike
}

/**
 * 官方桌面端由 Electron 主进程监听账号流并把授权地址交给系统浏览器（`shell.openExternal`）；
 * 桌面壳没有主进程，这里在 iframe 内做同一件事：账号尝试进入 `waiting-browser` 时打开系统
 * 浏览器，用户不必再手抄弹窗里的链接（弹窗里那个转圈的主按钮正是 waiting-browser）。
 *
 * 两条必须遵守的约束，都是踩过的坑：
 * - `remote` / `remote.account` 由 `dsh-client-connection` **稍后**提供，且 cordis 的 ctx 代理
 *   对未声明服务直接抛 `cannot get property "remote.account" without inject`。必须用动态
 *   `ctx.inject` 声明依赖，并**只在使用它给出的作用域 ctx** 读服务——用外层 ctx 读会抛。
 * - 订阅走官方 `$stream`（把 `watch()` 的原始值包成带 `accept()` 的帧），与官方
 *   `ui-settings-account` 的消费方式逐字一致。
 *
 * 只在桌面载体生效：浏览器直开没有 `dshDesktop` 标记，也不该替用户开浏览器。
 */
export const accountSignInFeature = defineRegister((controller, ctx) => {
  if (!('dshDesktop' in globalThis))
    return

  let opened: string | undefined

  ctx.inject(['remote', 'remote.account'], (scoped) => {
    const remote = (scoped as unknown as InjectedScope).remote
    const account = remote?.account
    const watch = account?.watch
    if (typeof watch !== 'function' || typeof remote?.$stream !== 'function') {
      console.warn('[dsh-tauri] account stream unavailable — the authorize url cannot be opened automatically')
      return
    }

    const stream = remote.$stream({
      name: 'account',
      open: signal => watch.call(account, signal),
      ended: () => new Error('account stream ended'),
    })
    controller.add(() => {
      void stream.dispose?.()
    })

    void (async () => {
      for await (const frame of stream) {
        const attempt = frame.value?.attempt
        frame.accept?.()
        const url = attempt?.authorizeUrl
        if (attempt?.phase !== 'waiting-browser' || !isBrowserUrl(url) || url === opened)
          continue
        opened = url
        await invoke('open_external_url', { url }).catch((error: unknown) => {
          console.warn('[dsh-tauri] opening the account authorize url failed:', error)
        })
      }
    })().catch(() => undefined)
  })
})

// --- internal ---

/** 只放行宿主 `open_external_url` 能处理的 http(s) 浏览器地址。 */
function isBrowserUrl(value: unknown): value is string {
  if (typeof value !== 'string')
    return false
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  }
  catch {
    return false
  }
}
