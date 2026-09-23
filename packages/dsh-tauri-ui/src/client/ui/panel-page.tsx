import type { ReactElement, ReactNode } from 'react'
import { useMountStyle } from '../hooks/use-mount-style'
import panelPageStyle from './panel-page.cssr'

const PANEL_PAGE_STYLE_ID = 'dsh-tauri-ui-panel-page-styles'

/**
 * 面板页容器：复刻官方插件页（`@deepseek-ai/dsh-client-ui-plugin-manager` 的
 * `PluginManagerPage`）的页根几何，使第三方插件面板与官方左侧栏「插件」入口
 * 在左右留白、内容列宽与滚动行为上完全一致。
 *
 * 页根自持 `height:100%` + `overflow:auto`（`main` 槽宿主锚点是 `display:contents`，
 * 中心列不滚动），居中与间距由 `align-items:center` + `gap` 承担；面板自身根节点
 * 作为直接子项被 `>*` 规则夹到 960px。
 */
export function PanelPage({ children }: { children: ReactNode }): ReactElement {
  useMountStyle(panelPageStyle, PANEL_PAGE_STYLE_ID)
  return <div className="dshp-panel-page">{children}</div>
}
