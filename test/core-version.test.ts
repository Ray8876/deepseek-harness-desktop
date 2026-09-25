import { describe, expect, it } from 'vitest'
import { isCoreUnsupported, MIN_SUPPORTED_CORE_VERSION } from '@/utils/core-version'

/**
 * issue #596：随包内置插件依赖的平台种子词自 dsh 0.1.5 起才存在，核心低于最低支持
 * 基线（0.1.5-rc.1）时 `@deepseek-ai/*` 模块在运行时模块表里不存在，插件必然加载失败
 * 并把应用卡在启动阶段。
 *
 * 后端据此回退预打包核心，前端核心面板据此标注「不兼容」并拒绝激活；这里锁住两侧
 * 共用的版本判定：低于基线为 true，等于/高于为 false，不可解析不误判。
 *
 * 兼容性只看最低支持基线，与推荐核心版本（`manifest.jsonc` 的 `engines.dsh.recommend`）无关——推荐版本
 * 高于基线、仅用于更新提示。
 */
describe('isCoreUnsupported', () => {
  it('把低于 0.1.5-rc.1 的旧版本判为不兼容', () => {
    expect(isCoreUnsupported('0.1.0-rc.7')).toBe(true)
    expect(isCoreUnsupported('0.1.2-rc.1')).toBe(true)
    expect(isCoreUnsupported('0.1.5-alpha.2')).toBe(true)
  })

  it('基线本身与更新的版本都算兼容', () => {
    expect(isCoreUnsupported(MIN_SUPPORTED_CORE_VERSION)).toBe(false)
    expect(isCoreUnsupported('0.1.5-rc.2')).toBe(false)
    expect(isCoreUnsupported('0.1.6-alpha.2')).toBe(false)
    expect(isCoreUnsupported('0.1.7-alpha.1')).toBe(false)
  })

  it('版本缺失或不可解析时不误判为不兼容', () => {
    expect(isCoreUnsupported('')).toBe(false)
    expect(isCoreUnsupported('not-a-version')).toBe(false)
  })

  it('带 dsh-/src- 前缀的 release tag 按同一基线判定', () => {
    expect(isCoreUnsupported('dsh-0.1.2-rc.1')).toBe(true)
    expect(isCoreUnsupported('src-0.1.5-rc.1')).toBe(false)
  })
})
