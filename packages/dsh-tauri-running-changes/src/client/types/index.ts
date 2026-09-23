/**
 * client/types/index.ts — 客户端跨模块共享的线协议与领域模型。
 *
 * 单一模块专属的类型与所属模块同目录同名（`store/modules/session.types.ts`、
 * `components/running-changes-chip.types.ts`…），此目录只留被多个模块共享的类型。
 */

/** 单文件变更状态：本 turn 新增 / 修改 / 删除。 */
export type TurnFileStatus = 'A' | 'M' | 'D'

/** 宿主 summary 路由返回的单文件差异。 */
export interface TurnFileChange {
  path: string
  status: TurnFileStatus
  insertions: number | null
  deletions: number | null
  binary: boolean
}

/** 宿主 summary 路由返回的单 turn 记录。 */
export interface TurnSummary {
  turn: number
  fileCount: number
  insertions: number
  deletions: number
  unavailable: string | null
  /** 该轮是否建立过快照基线（旧宿主不带该字段时视为 true，即保守地照常呈现）。 */
  hasBaseline?: boolean
  truncated: boolean
  files: TurnFileChange[]
  /**
   * 因超过单文件上限而未纳入快照的路径。
   * 宿主只回传前若干条（载荷有界），因此必须按「计数」而不是「长度」呈现。
   */
  skippedOversized: string[]
  /** 被跳过的嵌套仓库目录（gitlink 内容未纳入快照）。 */
  skippedNestedRepos: string[]
}

/** 宿主 summary 路由的完整载荷。 */
export interface SessionSummary {
  sessionId: string
  isGit: boolean
  workspaceRoot: string | null
  unavailableReason: string | null
  turns: TurnSummary[]
}

/** 运行中实时读数（宿主 live 路由的载荷）。 */
export interface LiveSnapshot {
  /** 是否有正在进行的 turn。 */
  active: boolean
  turn: number | null
  fileCount: number
  insertions: number
  deletions: number
}

/** 界面文案键（zh 为权威键集，en 必须逐键对齐）。 */
export type LocaleKey
  = | 'runningChanged'
    | 'binary'
