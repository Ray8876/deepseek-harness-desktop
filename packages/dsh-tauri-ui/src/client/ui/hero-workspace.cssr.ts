import { HERO_WORKSPACE_CHIP_CLASS } from '../constants'
import { styles as sharedStyles } from '../constants/theme'
import { cssr } from '../utils/cssr'

const { c, bem: { b, e } } = cssr
const { primary, tertiary, hover } = sharedStyles

const HERO_ROW = '[class$="heroWorkspaceRow"]'

/**
 * 官方 chip 与本插件 chip 共用 aria-label（官方 conversation 词典 `hero.chooseWorkspace`），
 * `:not()` 是两者的唯一区分；`:has()` 保证只在接管 chip 真的挂载后才隐藏官方入口。
 */
const OFFICIAL_CHIP = ['选择工作区', 'Choose workspace']
  .map(label => `${HERO_ROW}:has(.${HERO_WORKSPACE_CHIP_CLASS}) button[aria-label="${label}"]:not(.${HERO_WORKSPACE_CHIP_CLASS})`)
  .join(',')

const chip = b('hero-workspace', {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  boxSizing: 'border-box',
  minHeight: '28px',
  maxWidth: 'min(100%, 360px)',
  padding: '0 8px',
  border: 'none',
  borderRadius: '16px',
  background: 'transparent',
  color: primary,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '13px',
  fontWeight: '500',
  lineHeight: '20px',
  whiteSpace: 'nowrap',
}, [
  c('&:not(:disabled):hover, &[aria-expanded="true"]', { background: hover }),
  e('folder', {
    flex: 'none',
    color: primary,
  }),
  e('label', {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  e('chevron', {
    flex: 'none',
    color: 'var(--dsw-alias-label-caption)',
  }),
  e('status', {
    color: tertiary,
    fontSize: '12px',
    lineHeight: '20px',
  }),
  e('error', {
    color: 'var(--dsw-alias-state-error-primary)',
    fontSize: '12px',
    lineHeight: '18px',
  }),
  e('action', {
    minWidth: '72px',
  }),
])

export default c([
  chip,
  // 官方 chip 只在我们的 chip 真的挂载后隐藏：接管失败（条目崩溃退位）时官方入口原样回来。
  c(OFFICIAL_CHIP, { display: 'none !important' }),
])
