import type { SessionSummary, TurnSummary } from '../types'
import { describe, expect, it } from 'vitest'
import { formatCounts, hasTurnRecord, summaryRetryDelayMs } from './format'

function turnSummary(patch: Partial<TurnSummary> = {}): TurnSummary {
  return {
    turn: 1,
    fileCount: 1,
    insertions: 4,
    deletions: 3,
    unavailable: null,
    truncated: false,
    files: [{ path: 'src/driver.ts', status: 'M', insertions: 4, deletions: 3, binary: false }],
    skippedOversized: [],
    skippedNestedRepos: [],
    ...patch,
  }
}

function summary(patch: Partial<SessionSummary> = {}): SessionSummary {
  return {
    sessionId: 'session-1',
    isGit: true,
    workspaceRoot: 'C:/proj',
    unavailableReason: null,
    turns: [turnSummary()],
    ...patch,
  }
}

describe('formatCounts', () => {
  it('renders +N -M and falls back to the binary label', () => {
    expect(formatCounts({ insertions: 5, deletions: 3, binary: false }, 'binary')).toBe('+5 -3')
    expect(formatCounts({ insertions: null, deletions: null, binary: true }, 'binary')).toBe('binary')
    expect(formatCounts({ insertions: null, deletions: null, binary: false }, 'binary')).toBe('+0 -0')
  })
})

describe('hasTurnRecord / summaryRetryDelayMs', () => {
  it('只看账本有没有这一轮的记录，不看界面是否可见', () => {
    expect(hasTurnRecord(null, 1)).toBe(false)
    expect(hasTurnRecord(summary(), undefined)).toBe(false)
    expect(hasTurnRecord(summary(), 1)).toBe(true)
    expect(hasTurnRecord(summary(), 7)).toBe(false)
    // 空记录（该轮确实没有改动）也算「已落账」：重试窗口据此停止，不再白等。
    expect(hasTurnRecord(summary({ turns: [turnSummary({ files: [], fileCount: 0 })] }), 1)).toBe(true)
  })

  it('重试等待时间 700ms 起指数退避、5s 封顶', () => {
    expect(summaryRetryDelayMs(0, 700, 5000)).toBe(700)
    expect(summaryRetryDelayMs(1, 700, 5000)).toBe(1400)
    expect(summaryRetryDelayMs(2, 700, 5000)).toBe(2800)
    expect(summaryRetryDelayMs(3, 700, 5000)).toBe(5000)
    expect(summaryRetryDelayMs(11, 700, 5000)).toBe(5000)
    // 异常入参（负数/非整数/NaN）不能算出荒唐的等待时间。
    expect(summaryRetryDelayMs(-1, 700, 5000)).toBe(700)
    expect(summaryRetryDelayMs(Number.NaN, 700, 5000)).toBe(700)
    expect(summaryRetryDelayMs(1.9, 700, 5000)).toBe(1400)
  })
})
