/**
 * client/constants/index.ts — 客户端静态常量（跨 half 协议常量见 shared/constants.ts）。
 */

import { PLUGIN_ID } from '../../shared/constants'

export { PLUGIN_ID } from '../../shared/constants'

/**
 * 输入框上方独占一行的 dock 槽（list 型、可叠加）：运行中提示条的位置。
 *
 * dock 按 order 升序渲染；官方 `todo`（0）、`goal`（10）、`queue`（20）与工作树横幅（-10）
 * 都在这一槽里。提示条必须压在这些条目之上——它是当前这一轮正在发生的改动读数。
 */
export const RUNNING_CHANGES_INPUT_DOCK_SLOT = 'conversation.input.dock'

export const RUNNING_CHANGES_RUNNING_CHIP_ID = `${PLUGIN_ID}-running-changes`
export const RUNNING_CHANGES_RUNNING_CHIP_ORDER = -30

/** 运行中提示条的客户端轮询间隔；宿主端另有 1.5s 的 git 刷新节奏。 */
export const RUNNING_CHANGES_LIVE_POLL_INTERVAL_MS = 1200

/** 提示条的 css-render style id。 */
export const RUNNING_CHANGES_CHIP_STYLE_ID = `${PLUGIN_ID}/RunningChangesChip.module.css`
export const RUNNING_CHANGES_COUNTS_STYLE_ID = `${PLUGIN_ID}/ChangeCounts.module.css`

/** effect 标签（诊断/日志）。 */
export const RUNNING_CHANGES_LOCALE_EFFECT = `${PLUGIN_ID}: locale`
export const RUNNING_CHANGES_SUMMARY_EFFECT = `${PLUGIN_ID}: summary retry`
export const RUNNING_CHANGES_RUNNING_CHIP_EFFECT = `${PLUGIN_ID}: running chip`

/**
 * 「该轮已结束但账本还没有记录」时的重试参数（指数退避：700ms → 1.4s → 2.8s → 5s 封顶，
 * 12 次累计约 50s）。
 *
 * after 快照在 turn/end 之后**后台结算**：先是队列里可能在飞的实时读数，再是 after 自身的
 * `git add --all`。实测大仓库上首次 add 要 6–20s，因此短窗口会让手动停止以及首次快照的 turn
 * 迟迟等不到账本落定。退避到 5s 既覆盖慢仓库，又不会在常见情况下持续打请求——一旦账本出现
 * 该轮的记录就立刻停止重试。
 */
export const RUNNING_CHANGES_SUMMARY_RETRY_DELAY_MS = 700
export const RUNNING_CHANGES_SUMMARY_RETRY_MAX_DELAY_MS = 5000
export const RUNNING_CHANGES_SUMMARY_MAX_RETRIES = 12

/** 重试调度的检查节拍（由 register 的 controller.interval 承担）。 */
export const RUNNING_CHANGES_SUMMARY_TICK_MS = 400
