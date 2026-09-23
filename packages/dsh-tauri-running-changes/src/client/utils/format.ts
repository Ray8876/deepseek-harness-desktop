/**
 * client/utils/format.ts — 纯函数：计数文本与账本落定判定。
 *
 * 全部为纯函数，便于单测直接锁定（plugin.baisc.md「优先测试纯函数」）。
 * 计数文本供 `ChangeCounts` 的 `title` 使用：视觉是分开着色的两个 span，
 * 但读屏/悬浮提示要拿到同一条「+N -M」文本。
 */

import type { SessionSummary, TurnFileChange } from '../types'

/** 单行 `+N -M` 文本；二进制显示 binaryLabel。 */
export function formatCounts(file: Pick<TurnFileChange, 'insertions' | 'deletions' | 'binary'>, binaryLabel: string): string {
  if (file.binary)
    return binaryLabel
  const insertions = file.insertions ?? 0
  const deletions = file.deletions ?? 0
  return `+${insertions} -${deletions}`
}

/**
 * 账本里是否已经有这一轮的记录（**任何**记录，包括「文件数为 0」与「不可用」）。
 *
 * 重试窗口只该盯住「账本还没有这一轮」，而不是「界面暂时看不到」：
 * 前者是 after 快照还在后台结算（要等），后者可能是「这一轮确实没有改动」（等也没用，
 * 而且会把重试预算白白烧掉）。
 */
export function hasTurnRecord(summary: SessionSummary | null, turn: number | undefined): boolean {
  if (summary === null || turn === undefined)
    return false
  return summary.turns.some(item => item.turn === turn)
}

/**
 * 第 `attempt` 次重试（0 起）的等待时间：700ms 起指数退避、封顶 5s。
 * @param attempt - 已失败的重试次数。
 * @param baseMs - 首次等待。
 * @param maxMs - 单次等待上限。
 * @returns 毫秒。
 */
export function summaryRetryDelayMs(attempt: number, baseMs: number, maxMs: number): number {
  const safe = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0
  return Math.min(baseMs * 2 ** safe, maxMs)
}
