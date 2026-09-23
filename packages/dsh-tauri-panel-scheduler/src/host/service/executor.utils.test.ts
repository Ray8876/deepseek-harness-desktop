import { describe, expect, it, vi } from 'vitest'
import { decideRunOutcome, describeFailure, summarizeRun, waitForTurnStart } from './executor.utils'

const runEvents = [
  { seq: 0, type: 'turn/end', data: { reason: { kind: 'completed' } } },
  { seq: 1, type: 'turn/start', data: {} },
  { seq: 2, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'working' }] } } },
  { seq: 3, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'done' }] } } },
  { seq: 4, type: 'turn/end', data: { reason: { kind: 'error', error: { code: 'llm_error', message: 'boom' } } } },
]

const failureReason = { kind: 'error', error: { code: 'llm_error', message: 'boom' } }

describe('decideRunOutcome', () => {
  it('超时优先判失败（即使 turn 已启动）', () => {
    expect(decideRunOutcome({ started: true, timedOut: true, reason: { kind: 'completed' } }))
      .toEqual({ status: 'failed', error: { code: 'timeout', message: '定时任务超过最大运行时限。' } })
  })

  it('turn 根本没启动才报「没有产生完整 turn」', () => {
    expect(decideRunOutcome({ started: false, timedOut: false, reason: undefined }))
      .toEqual({ status: 'failed', error: { code: 'no_turn_result', message: '本次定时任务没有产生完整 turn。' } })
  })

  it('turn 已启动但没有 turn/end 事件 → 成功（核心异常收尾不补写该事件）', () => {
    expect(decideRunOutcome({ started: true, timedOut: false, reason: undefined }))
      .toEqual({ status: 'succeeded' })
  })

  it('completed 视为成功', () => {
    expect(decideRunOutcome({ started: true, timedOut: false, reason: { kind: 'completed' } }))
      .toEqual({ status: 'succeeded' })
  })

  it('显式的非 completed 原因仍判失败', () => {
    expect(decideRunOutcome({ started: true, timedOut: false, reason: { kind: 'aborted' } }))
      .toEqual({ status: 'failed', error: { code: 'turn_aborted', message: '定时任务以 aborted 结束。' } })
    expect(decideRunOutcome({ started: true, timedOut: false, reason: { kind: 'error', error: { code: 'llm_error', message: 'boom' } } }))
      .toEqual({ status: 'failed', error: { code: 'llm_error', message: 'boom' } })
  })
})

describe('describeFailure', () => {
  it('没有 turn/end 收尾原因时归为 no_turn_result', () => {
    expect(describeFailure(undefined)).toEqual({ code: 'no_turn_result', message: '本次定时任务没有产生完整 turn。' })
  })

  it('取消 / 中断类收尾原因按 turn_<kind> 归类', () => {
    expect(describeFailure({ kind: 'aborted' })).toEqual({ code: 'turn_aborted', message: '定时任务以 aborted 结束。' })
    expect(describeFailure({ kind: 'interrupted' })).toEqual({ code: 'turn_interrupted', message: '定时任务以 interrupted 结束。' })
  })

  it('error 原因透传内核错误码与文案，缺失时回落到通用失败', () => {
    expect(describeFailure({ kind: 'error', error: { code: 'llm_error', message: 'boom' } }))
      .toEqual({ code: 'llm_error', message: 'boom' })
    expect(describeFailure({ kind: 'error' })).toEqual({ code: 'agent_error', message: '定时任务 Agent 执行失败。' })
    expect(describeFailure({ kind: 'error', error: { code: 42, message: '' } }))
      .toEqual({ code: 'agent_error', message: '' })
    expect(describeFailure({ kind: 'error', error: 'boom' })).toEqual({ code: 'agent_error', message: '定时任务 Agent 执行失败。' })
  })
})

describe('waitForTurnStart', () => {
  it('seq 增长即返回 true', async () => {
    const session = { seq: 7 }
    setTimeout(() => {
      session.seq = 8
    }, 15)
    await expect(waitForTurnStart(session, 7, 500)).resolves.toBe(true)
  })

  it('始终没启动时在窗口后返回 false', async () => {
    vi.useFakeTimers()
    try {
      const session = { seq: 7 }
      const pending = waitForTurnStart(session, 7, 50)
      await vi.advanceTimersByTimeAsync(80)
      await expect(pending).resolves.toBe(false)
    }
    finally {
      vi.useRealTimers()
    }
  })
})

describe('summarizeRun', () => {
  it('内核 0.1.2-rc.1 起改从 snapshotEvents 读日志，失败收尾不会被吞成成功', () => {
    const outcome = summarizeRun({ snapshotEvents: () => runEvents }, 1)
    expect(outcome).toEqual({ text: 'done', reason: failureReason })
    expect(decideRunOutcome({ started: true, timedOut: false, reason: outcome.reason }))
      .toEqual({ status: 'failed', error: { code: 'llm_error', message: 'boom' } })
  })

  it('legacy 内核的 log / events 仍作兜底', () => {
    for (const session of [{ log: runEvents }, { events: runEvents }]) {
      expect(summarizeRun(session, 1)).toEqual({ text: 'done', reason: failureReason })
    }
  })

  it('只统计 firstSeq 之后的事件', () => {
    expect(summarizeRun({ snapshotEvents: () => runEvents }, 5)).toEqual({ text: '' })
  })

  it('日志不可读时退化为「没有 turn/end」，交由 decideRunOutcome 兜底', () => {
    expect(summarizeRun({}, 0)).toEqual({ text: '' })
    expect(summarizeRun(undefined, 0)).toEqual({ text: '' })
  })
})
