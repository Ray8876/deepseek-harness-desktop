import { cssr } from '../utils/cssr'

const { c, bem: { b } } = cssr

/**
 * 面板页几何：逐条对齐官方插件页 `@deepseek-ai/dsh-client-ui-plugin-manager`
 * 的 `.X_2TxG_page`（含 `>*{width:100%;max-width:960px}` 子项约束）。
 */
export default b('panel-page', {
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '32px',
  height: '100%',
  padding: '28px clamp(24px, 4vw, 48px) 48px',
  overflow: 'auto',
  color: 'var(--dsw-alias-label-primary)',
}, [
  c('&>*', { width: '100%', maxWidth: '960px' }),
])
