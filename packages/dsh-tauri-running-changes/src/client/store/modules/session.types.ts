import type { SessionSummary } from '../../types'

/** 每会话客户端状态（只放数据；请求与重试记账在 service/ 与 register/）。 */
export interface RunningChangesSessionState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  summary: SessionSummary | null
  error: string | null
  /**
   * 已结束、正等账本落定的 turn 号；账本尚无该轮记录时由 register 的调度器重拉。
   * null 表示当前没有在等账本（例如非 Git 工作区）。
   */
  awaitingTurn: number | null
}

/** 每会话状态容器。 */
export interface RunningChangesUiState {
  bySession: Record<string, RunningChangesSessionState>
}
