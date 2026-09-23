/**
 * client/index.ts — dsh-tauri-running-changes 客户端插件体（browser half）。
 *
 * 依赖纪律（跨内核代硬约束）：本文件与整个 client/ 目录**不静态引用任何 `@deepseek-ai/*` 包**——
 * client bundle 在 dsh Web ModuleLoader 的 factory 里运行，模块表只认识内核当前装载的模块；
 * 引用了另一个内核代里不存在的 specifier 会让 loader 整棵树失败（界面白屏）。
 * 允许的 bare import 只有 react / dsh-tauri/client / dsh-tauri-ui/client。
 */

import type { ClientContext } from 'dsh-tauri/client'
import {
  PLUGIN_ID,
  RUNNING_CHANGES_LOCALE_EFFECT,
  RUNNING_CHANGES_RUNNING_CHIP_EFFECT,
  RUNNING_CHANGES_SUMMARY_EFFECT,
} from './constants'
import { locale } from './locales'
import { runningChipFeature } from './register/running-chip'
import { summaryFeature } from './register/summary'

export type * from './types'

/** 插件显示名（诊断元数据）。 */
export const name = PLUGIN_ID

/** 需要的客户端服务：slots（槽位注册）、locale（双语文案）。 */
export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.effect(locale.registerLocale, RUNNING_CHANGES_LOCALE_EFFECT)
  ctx.effect(summaryFeature, RUNNING_CHANGES_SUMMARY_EFFECT)
  ctx.effect(runningChipFeature, RUNNING_CHANGES_RUNNING_CHIP_EFFECT)
}
