import type { HostContext } from '../types'
import { describe, expect, it } from 'vitest'
import { setCurrentHostInstance } from '../config/runtime'
import { session } from './session'

interface SetupOptions {
  status?: string
  events?: unknown
  session?: unknown
  loader?: unknown
}

function turnEnd(kind: string) {
  return { type: 'turn/end', seq: 1, time: 0, data: { turn: 1, reason: { kind } } }
}

function setup(options: SetupOptions = {}): { followed: Array<{ content: unknown, source: unknown }> } {
  const followed: Array<{ content: unknown, source: unknown }> = []
  const agent = {
    status: options.status ?? 'idle',
    session: options.session ?? { snapshotEvents: () => options.events ?? [turnEnd('completed')] },
    followup: (message: { content: unknown, source: unknown }) => void followed.push(message),
  }
  setCurrentHostInstance({
    agents: { get: (id: string) => (id === 'unknown' ? undefined : agent) },
    loader: options.loader ?? {
      import: async () => ({ createUserMessage: (input: unknown) => input }),
      unwrapExports: (value: unknown) => value,
    },
    logger: { warn: () => {} },
  } as HostContext)
  return { followed }
}

describe('session.resume', () => {
  it('continues a session whose turn was aborted by the user', async () => {
    const { followed } = setup({ events: [{ type: 'turn/start' }, turnEnd('aborted')] })
    expect(await session.resume('s1')).toEqual({ ok: true })
    expect(followed).toHaveLength(1)
    expect(followed[0]?.source).toEqual({ kind: 'continue' })
  })

  it('continues interrupted and errored turns', async () => {
    setup({ events: [turnEnd('interrupted')] })
    expect(await session.resume('s1')).toEqual({ ok: true })

    const { followed } = setup({ events: [turnEnd('error')] })
    expect(await session.resume('s1')).toEqual({ ok: true })
    expect(followed).toHaveLength(1)
  })

  it('refuses a turn that settled normally, naming the reason', async () => {
    for (const kind of ['completed', 'blocked', 'max-tokens']) {
      const { followed } = setup({ events: [turnEnd(kind)] })
      const outcome = await session.resume('s1')
      expect(outcome).toEqual({ ok: false, code: 409, error: expect.stringContaining(kind) })
      expect(followed).toHaveLength(0)
    }
  })

  it('refuses a running session and an unknown one', async () => {
    setup({ status: 'running' })
    expect(await session.resume('s1')).toEqual({ ok: false, code: 409, error: '会话仍在运行，无需继续' })
    expect(await session.resume('unknown')).toEqual({ ok: false, code: 404, error: '会话不存在或尚未运行' })
  })

  it('reads the log through the legacy fallbacks', async () => {
    const log = [turnEnd('aborted')]
    setup({ session: { log } })
    expect(await session.resume('s1')).toEqual({ ok: true })
    setup({ session: { events: log } })
    expect(await session.resume('s1')).toEqual({ ok: true })
  })

  it('treats an unreadable log as continuable rather than blocking the user', async () => {
    setup({ session: {} })
    expect(await session.resume('s1')).toEqual({ ok: true })
  })

  it('reports a missing runtime module instead of throwing', async () => {
    setup({ events: [turnEnd('aborted')], loader: { import: async () => ({}), unwrapExports: () => ({}) } })
    const outcome = await session.resume('s1')
    expect(outcome.ok).toBe(false)
    expect(outcome.ok === false && outcome.code).toBe(500)
  })

  it('reports 500 with the DSH_LOADER_MISSING literal when the host exposes no loader', async () => {
    const followed: unknown[] = []
    setCurrentHostInstance({
      agents: {
        get: () => ({
          status: 'idle',
          session: { snapshotEvents: () => [turnEnd('aborted')] },
          followup: (message: unknown) => void followed.push(message),
        }),
      },
      logger: { warn: () => {} },
    } as HostContext)
    expect(await session.resume('s1')).toEqual({
      ok: false,
      code: 500,
      error: 'TypeError: DSH_LOADER_MISSING: ctx.loader',
    })
    expect(followed).toHaveLength(0)
  })

  it('reports 500 with the DSH_LOADER_MISSING literal when the loader lacks import()', async () => {
    setup({ events: [turnEnd('aborted')], loader: { unwrapExports: (value: unknown) => value } })
    expect(await session.resume('s1')).toEqual({
      ok: false,
      code: 500,
      error: 'TypeError: DSH_LOADER_MISSING: ctx.loader',
    })
  })

  it('reports 500 with the DSH_LLM_EXPORT_MISSING literal when import() carries no createUserMessage', async () => {
    const { followed } = setup({
      events: [turnEnd('aborted')],
      loader: { import: async () => ({ createUserMessage: 'not-a-function' }), unwrapExports: () => undefined },
    })
    expect(await session.resume('s1')).toEqual({
      ok: false,
      code: 500,
      error: 'TypeError: DSH_LLM_EXPORT_MISSING: createUserMessage',
    })
    expect(followed).toHaveLength(0)
  })

  it('turns a throwing loader into a 500 naming the thrown error', async () => {
    setup({
      events: [turnEnd('aborted')],
      loader: { import: async () => { throw new Error('boom') }, unwrapExports: (value: unknown) => value },
    })
    expect(await session.resume('s1')).toEqual({ ok: false, code: 500, error: 'Error: boom' })
  })
})
