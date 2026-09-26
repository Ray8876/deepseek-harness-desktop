import { describe, expect, it } from 'vitest'
import globalStyle from './global.cssr'

/**
 * 侧边栏 rail 的 logo 契约。
 *
 * 官方侧边栏折叠后，logo 不再来自 `logoRow` 上的品牌块（它只在展开态渲染），
 * 而是画在 logo 行里那枚 toggle 内（`railMark` 鲸鱼，悬停互换为展开图标）。
 * 本仓为去掉重复入口在展开态隐藏该 toggle —— 该规则不得在折叠态继续命中，
 * 否则 rail 上的 logo 整块消失。这里按生成 CSS 断言这条恢复规则存在且特异性更高。
 */
describe('sidebar rail logo', () => {
  const css = globalStyle.render()

  it('展开态隐藏重复的折叠 toggle', () => {
    expect(css).toMatch(/\[class\$="logoRow"\][^{]*\[class\$="toggle"\][^{]*\{[^}]*display:\s*none\s*!important/)
  })

  it('折叠态把承载 logo 的 toggle 恢复显示（特异性高于隐藏规则）', () => {
    const recovery = /\[class\*="collapsed"\]\s*\[class\$="logoRow"\]\s*\[class\$="toggle"\][^{]*\{[^}]*display:\s*inline-flex\s*!important/.exec(css)
    expect(recovery, '缺少折叠轨道的 logo 恢复规则').not.toBeNull()

    const hide = css.indexOf('[class$="logoRow"] [class$="toggle"]')
    const show = css.indexOf('[class*="collapsed"] [class$="logoRow"] [class$="toggle"]')
    expect(show, '恢复规则必须排在隐藏规则之后').toBeGreaterThan(hide)
  })
})

/**
 * 中栏表面契约。
 *
 * 官方桌面端（Windows 标题栏形态）把中栏画成「别名底色 + 左上 16px 圆角」，触发条件是
 * 宿主在文档根打的 `data-windows-titlebar`（`dsh-client-ui-layout` 的
 * `[data-windows-titlebar] .centerCol`）。桌面壳的标题栏在 iframe 之外，该属性在本仓
 * 永不存在——中栏一旦保持透明，整块右栏（插件页一并）就会露出布局帧的侧栏底色，
 * 圆角也无从渲染。这里按生成 CSS 断言等价声明存在，且不再依赖无人写入的标记选择器。
 */
describe('center column surface', () => {
  const css = globalStyle.render()

  it('中栏按类名后缀以别名底色绘制并带左上 16px 圆角', () => {
    expect(css).toMatch(
      /\[class\$="centerCol"\]\s*\{[^}]*background:\s*var\(--dsw-alias-bg-base\);[^}]*border-radius:\s*16px 0 0 0;[^}]*corner-shape:\s*round;[^}]*\}/,
    )
  })

  it('中栏规则不再依赖运行时无人写入的 data-dsh-center-col 标记', () => {
    expect(css).not.toContain('data-dsh-center-col')
  })
})
