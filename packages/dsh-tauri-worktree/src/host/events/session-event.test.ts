/**
 * session-event.test.ts — 会话事件接线的领域契约。
 *
 * 锁住的契约：只有登记过的工作树会话在首个请求头落盘时补一次标题；其它事件、其它会话都不触发。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearHostRuntime, pendingWorktreeTitles, setCurrentHostInstance } from '../config/runtime'
import { handleSessionEvent } from './session-event'

function hostWith(refresh: ReturnType<typeof vi.fn>): void {
  setCurrentHostInstance({ get: () => ({ refresh }), logger: { warn: () => {} } })
}

afterEach(() => {
  clearHostRuntime()
})

describe('handleSessionEvent：工作树会话标题接线', () => {
  it('登记的会话在请求头事件上补一次标题', async () => {
    const refresh = vi.fn(async () => {})
    hostWith(refresh)
    pendingWorktreeTitles.add('session-target')

    handleSessionEvent({ id: 'session-target' }, { type: 'assistant/message' })
    expect(refresh).not.toHaveBeenCalled()

    handleSessionEvent({ id: 'session-target' }, { type: 'request/header' })

    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('未登记的会话收到请求头也不刷新', async () => {
    const refresh = vi.fn(async () => {})
    hostWith(refresh)

    handleSessionEvent({ id: 'session-other' }, { type: 'request/header' })
    await Promise.resolve()

    expect(refresh).not.toHaveBeenCalled()
  })
})
