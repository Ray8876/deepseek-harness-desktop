import type { Binding, PendingHandoff } from '../types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearHostRuntime, setCurrentHostInstance } from '../config/runtime'
import { handoff } from './handoff'

vi.mock('dsh-tauri', async (importOriginal) => {
  const actual = await importOriginal<typeof import('dsh-tauri')>()
  const { testDshHome: home } = await import('../../../../.test/test-utils')
  return { ...actual, DSH_HOME: home }
})

const events = [
  { type: 'user/message', seq: 0, time: 1, data: { message: { role: 'user', content: [{ type: 'text', text: 'hi' }] } } },
  { type: 'turn/end', seq: 1, time: 2, data: { reason: { kind: 'completed' } } },
]

function sourceAgent(): unknown {
  return {
    session: {
      id: 'session-source',
      header: { agentPreset: 'default' },
      snapshotEvents: () => events,
    },
  }
}

interface SetupOptions {
  session?: unknown
  warn?: (message: string) => void
  create?: (options: any) => Promise<unknown>
}

function setup(options: SetupOptions = {}): { created: any[] } {
  const created: any[] = []
  setCurrentHostInstance({
    agents: {
      get: (id: string) => (id === 'session-source'
        ? { session: options.session ?? (sourceAgent() as any).session, ctx: {}, options: {} }
        : undefined),
      create: async (value: any) => {
        created.push(value)
        return options.create?.(value)
      },
    },
    workspaceRegistry: { resolveByPath: async () => undefined },
    logger: { warn: options.warn ?? (() => {}) },
  })
  return { created }
}

afterEach(() => {
  clearHostRuntime()
})

describe('handoff.inherit', () => {
  it('seeds the target session from the kernel snapshot log', async () => {
    const { created } = setup()
    const outcome = await handoff.inherit('session-source', 'session-target', 'C:/worktrees/w1')
    expect(outcome).toEqual({ ok: true, targetSessionId: 'session-target', seedLength: events.length })
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      sessionId: 'session-target',
      seed: events,
      inheritedEventCount: events.length,
      meta: {
        cwd: 'C:/worktrees/w1',
        parentSession: 'session-source',
        isSeeded: true,
        agentPreset: 'default',
      },
    })
  })

  it('reads the log through the legacy fallbacks', async () => {
    const legacy = [
      { id: 'session-source', header: {}, log: events },
      { id: 'session-source', header: {}, events },
    ]
    for (const session of legacy) {
      const { created } = setup({ session })
      expect(await handoff.inherit('session-source', 'session-target', 'C:/work')).toEqual({
        ok: true,
        targetSessionId: 'session-target',
        seedLength: events.length,
      })
      expect(created[0]?.seed).toEqual(events)
    }
  })

  it('reports a source session without a readable log', async () => {
    const { created } = setup({ session: { id: 'session-source', header: {} } })
    expect(await handoff.inherit('session-source', 'session-target', 'C:/work')).toEqual({
      ok: false,
      error: '源会话没有可继承的事件：session-source',
    })
    expect(created).toHaveLength(0)
  })

  it('warns when inheritance fails so the silent client fallback stays diagnosable', async () => {
    const warn = vi.fn()
    setup({ session: { id: 'session-source', header: {} }, warn })
    await handoff.inherit('session-source', 'session-target', 'C:/work')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('session-target'))
  })
})

describe('handoff.complete', () => {
  it('hands the inherited log to the worktree agent', async () => {
    const followup = vi.fn()
    const { created } = setup({ create: async () => ({ agent: { followup } }) })
    const pending: PendingHandoff = {
      sourceAgent: sourceAgent(),
      targetSessionId: 'session-target',
      binding: { worktreePath: 'C:/worktrees/w1', projectPath: 'C:/project' } as Binding,
    }

    await handoff.complete(pending)

    expect(created[0]).toMatchObject({
      sessionId: 'session-target',
      seed: events,
      inheritedEventCount: events.length,
      meta: {
        cwd: 'C:/worktrees/w1',
        parentSession: 'session-source',
        isSeeded: true,
        agentPreset: 'default',
      },
    })
    expect(followup).toHaveBeenCalledTimes(1)
    const followupMessage = followup.mock.calls[0][0]
    const text = followupMessage.content.map((block: any) => block.text).join('')
    expect(text).toContain('is_worktree: true')
    expect(text).toContain('Worktree path: C:/worktrees/w1')
    expect(text).toContain('Project path: C:/project')
    expect(text).toContain('The task has moved to this isolated worktree session.')
  })
})
