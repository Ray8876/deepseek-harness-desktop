import semver from 'semver'

/**
 * 核心(dsh)版本判断：以 rc.2 为硬编码基准，高于该基准的版本引入破坏性更改、
 * 可能影响第三方插件。该判断与「推荐版本」逻辑无关，仅作为用户提示的阈值。
 */
export const CORE_BREAKING_BASELINE = '0.1.2-rc.1'

/**
 * Semver comparison using the `semver` package.
 * Handles `dsh-`/`src-` prefixes (including repeated `dsh-src-` chains) by
 * stripping before comparison; unparsable values compare as equal.
 * Returns: negative if a < b, 0 if equal, positive if a > b.
 */
export function compareVersions(a: string, b: string): number {
  const clean = (v: string) => {
    let s = v
    while (s.startsWith('dsh-') || s.startsWith('src-'))
      s = s.replace(/^(?:src|dsh)-/, '')
    return s
  }
  const pa = semver.parse(clean(a))
  const pb = semver.parse(clean(b))
  if (!pa || !pb)
    return 0
  return semver.compare(pa, pb)
}

/** 判断核心版本（版本串或 release tag）是否高于 rc.2 基准（引入破坏性更改） */
export function isCoreBreakingVersion(version: string): boolean {
  return !!version && compareVersions(version, CORE_BREAKING_BASELINE) > 0
}

/**
 * 最低支持的核心版本（与 Rust `MIN_SUPPORTED_CORE_VERSION` 对齐）。低于它的核心缺少
 * 内置插件依赖的平台种子词，随包插件必然加载失败并把应用卡在启动阶段（issue #596）。
 *
 * 这是兼容性的唯一基线：它低于推荐核心版本（`version-recommend.json`，仅用于更新
 * 提示），两者不可混用——拿推荐版本当基线会把「高于基线、低于推荐版本」的可用核心
 * 误判为不兼容（推荐版本为 0.1.7-alpha.1 时，0.1.5-rc.3 就是这么被挡下的）。
 */
export const MIN_SUPPORTED_CORE_VERSION = '0.1.5-rc.1'

/**
 * 核心版本是否低于最低支持基线（按版本判定，与来源无关）。
 *
 * 版本缺失或不可解析时返回 false（`compareVersions` 对不可解析值返回 0）——漏放行只是
 * 回到修复前的行为，误判会把可用的核心归进「不兼容」分组。
 */
export function isCoreUnsupported(version: string): boolean {
  return compareVersions(version, MIN_SUPPORTED_CORE_VERSION) < 0
}
