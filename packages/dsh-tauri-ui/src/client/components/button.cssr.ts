import { styles as sharedStyles } from '../constants/theme'
import { cssr } from '../utils/cssr'

const { c, bem: { b, m } } = cssr
const { borderL3, error, primary, primaryFill, primaryFg, primaryHover, hover, active } = sharedStyles

const addCapsule = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  boxSizing: 'border-box',
  height: '32px',
  padding: '0 12px',
  border: 'none',
  borderRadius: '16px',
  fontSize: '13px',
  lineHeight: '20px',
  cursor: 'pointer',
} as const

export default b('button', {}, [
  m('elevated', {
    display: 'flex',
    flex: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    boxSizing: 'border-box',
    width: '100%',
    height: '38px',
    padding: '8px 16px',
    font: 'inherit',
    fontSize: '14px',
    fontWeight: '500',
    lineHeight: '22px',
    color: primary,
    background: 'var(--dsw-alias-button-elevated-fill)',
    border: `0.5px solid ${borderL3}`,
    borderRadius: '12px',
    cursor: 'pointer',
    overflow: 'hidden',
  }, [
    c('&:hover:not(:disabled)', { background: 'var(--dsw-alias-button-floating-hover)' }),
    c('&:disabled', {
      cursor: 'not-allowed',
      opacity: '0.5',
    }),
  ]),
  m('add', { ...addCapsule, background: primaryFill, color: primaryFg }, [
    c('&:hover:not(:disabled)', { background: primaryHover }),
    c('&:disabled', {
      cursor: 'not-allowed',
      opacity: '0.4',
    }),
  ]),
  m('addGhost', { ...addCapsule, background: 'transparent', color: primary }, [
    c('&:hover:not(:disabled)', { background: hover }),
    c('&:active:not(:disabled)', { background: active }),
    c('&:disabled', {
      cursor: 'not-allowed',
      opacity: '0.4',
    }),
  ]),
  // 上游 `.danger` 是 token 重绑：本地覆盖 --dsw-alias-interactive-bg-hover，让 hover 洗色变红。
  m('danger', {
    'display': 'inline-flex',
    'alignItems': 'center',
    'justifyContent': 'center',
    'gap': '4px',
    'boxSizing': 'border-box',
    'height': '36px',
    'padding': '0 14px',
    'border': `0.5px solid color-mix(in srgb, ${error} 30%, transparent)`,
    'borderRadius': '18px',
    'background': 'transparent',
    'color': error,
    'fontSize': '14px',
    'lineHeight': '22px',
    'cursor': 'pointer',
    '--dsw-alias-interactive-bg-hover': `color-mix(in srgb, ${error} 8%, transparent)`,
  }, [
    c('&:hover:not(:disabled)', { background: 'var(--dsw-alias-interactive-bg-hover)' }),
    c('&:disabled', {
      cursor: 'not-allowed',
      opacity: '0.4',
    }),
    c('&.dshp-button--sm', {
      height: '28px',
      padding: '0 10px',
      fontSize: '12px',
      lineHeight: '18px',
      borderRadius: '14px',
    }),
  ]),
])
