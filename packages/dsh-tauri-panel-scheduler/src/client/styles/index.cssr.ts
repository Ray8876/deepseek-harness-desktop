import { cssr, styles as sharedStyles } from 'dsh-tauri-ui/client'
import { SESSION_ICON_ATTRIBUTE } from '../constants'

const { c } = cssr
const { primary, secondary, tertiary, dimmed, borderL4, brand, business, layer1, font, hover, error, success } = sharedStyles

export default c([
  c('.dshp-scheduler__shell', { boxSizing: 'border-box', color: primary, fontFamily: font, fontSize: '13px', lineHeight: '1.5' }),
  c('.dshp-scheduler__top', { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '12px' }),
  c('.dshp-scheduler__heading', { minWidth: '0' }),
  c('.dshp-scheduler__heading h1', { margin: '0', fontSize: '20px', lineHeight: '28px', fontWeight: '500' }),
  c('.dshp-scheduler__heading p', { margin: '4px 0 0', color: secondary, fontSize: '13px', lineHeight: '20px' }),
  c('.dshp-scheduler__toolbar', { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }),
  c('.dshp-scheduler__search-bar', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }),
  c('.dshp-scheduler__search-wrap', { flex: '0 1 280px', minWidth: '0', maxWidth: '280px' }),
  c('.dshp-scheduler__tabs', { display: 'flex', margin: '4px 0 14px' }),
  c('.dshp-scheduler__cards', { display: 'flex', flexDirection: 'column', gap: '8px', margin: '0', padding: '0', listStyle: 'none' }),
  c('.dshp-scheduler__runs-list', { display: 'flex', flexDirection: 'column', gap: '8px', margin: '0', padding: '0', listStyle: 'none' }),
  c('.dshp-scheduler__empty', { margin: '0', padding: '48px 0', color: tertiary, fontSize: '13px', textAlign: 'center' }),
  c('.dshp-scheduler__error', { margin: '0', color: error, fontSize: '12px', lineHeight: '18px' }),
  c('@media (max-width: 680px)', [c('.dshp-scheduler__search-wrap', { maxWidth: '160px' })]),

  c('.dshp-scheduler__modal', { width: 'min(640px,100%) !important' }),
  c('.dshp-scheduler__field', { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '0', fontSize: '13px' }),
  c('.dshp-scheduler__field-label', { display: 'inline-flex', alignItems: 'center', gap: '10px', color: secondary, fontSize: '12px', fontWeight: '500', lineHeight: '18px' }),
  c('.dshp-scheduler__inline', { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }),
  c('.dshp-scheduler__schedule-once', { flex: '1', minWidth: '0' }),
  c('.dshp-scheduler__prompt-wrap', { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }),
  c('.dshp-scheduler__composer', { display: 'flex', gap: '8px', alignItems: 'center' }),
  c('.dshp-scheduler__textarea', { boxSizing: 'border-box', border: `.5px solid ${borderL4}`, width: '100%', height: 'auto', minHeight: '240px', font: 'inherit', background: layer1, color: primary, borderRadius: '8px', padding: '10px', paddingBottom: '46px', fontSize: '14px', lineHeight: '1.55', resize: 'vertical', outline: 'none' }),
  c('.dshp-scheduler__textarea:focus', { borderColor: brand }),
  c('.dshp-scheduler__textarea::placeholder', { color: dimmed }),

  c('.dshp-scheduler__card', { boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', width: '100%', minWidth: '0', height: '60px', padding: '10px 12px', borderRadius: '10px', background: 'transparent', color: 'inherit', font: 'inherit', fontSize: '13px', lineHeight: '20px', textAlign: 'left', cursor: 'pointer', overflow: 'hidden' }),
  c('.dshp-scheduler__card:hover', { background: hover }),
  c('.dshp-scheduler__card--paused', { opacity: '.6' }),
  c('.dshp-scheduler__card-title', { display: 'flex', alignItems: 'center', gap: '8px', margin: '0', fontSize: '13px', lineHeight: '18px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  c('.dshp-scheduler__card-icon', { flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px', width: '16px', height: '16px', fontSize: '16px', color: business }),
  c('.dshp-scheduler__card-icon[data-status="succeeded"]', { color: success }),
  c('.dshp-scheduler__card-icon[data-status="failed"],.dshp-scheduler__card-icon[data-status="interrupted"]', { color: error }),
  c('.dshp-scheduler__card-icon[data-status="running"],.dshp-scheduler__card-icon[data-status="queued"]', { color: secondary }),
  c('.dshp-scheduler__card-icon[data-status="cancelled"],.dshp-scheduler__card-icon[data-status="skipped"]', { color: tertiary }),
  c('.dshp-scheduler__card-meta', { display: 'flex', alignItems: 'center', gap: '10px', minWidth: '0' }),
  c('.dshp-scheduler__card-meta-text', { flex: '1', minWidth: '0', color: tertiary, fontSize: '12px', lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  c('.dshp-scheduler__card-meta-text strong', { color: secondary, fontWeight: '600' }),

  c('button:has(.dshp-scheduler__nav-dot)', { position: 'relative' }),
  c('button:has(.dshp-scheduler__nav-dot) .dshp-scheduler__nav-dot', { position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }),

  c('.dshp-scheduler__recs', { display: 'flex', flexDirection: 'column', gap: '8px', margin: '20px 0 0' }),
  c('.dshp-scheduler__recs-title', { margin: '0', fontSize: '13px', lineHeight: '20px', fontWeight: '600' }),
  c('.dshp-scheduler__recs-list', { display: 'flex', flexDirection: 'column', gap: '8px', margin: '0', padding: '0', listStyle: 'none' }),
  c('.dshp-scheduler__recs-item', { boxSizing: 'border-box', display: 'flex', alignItems: 'flex-start', gap: '10px', width: '100%', minWidth: '0', padding: '10px 12px', border: 'none', borderRadius: '10px', background: 'transparent', color: 'inherit', font: 'inherit', fontSize: '13px', lineHeight: '20px', textAlign: 'left', cursor: 'pointer' }),
  c('.dshp-scheduler__recs-item:hover', { background: hover }),
  c('.dshp-scheduler__recs-icon', { flex: 'none', display: 'inline-flex', marginTop: '2px', fontSize: '16px' }),
  c('.dshp-scheduler__recs-body', { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '0' }),
  c('.dshp-scheduler__recs-name', { color: primary, fontSize: '13px', lineHeight: '18px', fontWeight: '500' }),
  c('.dshp-scheduler__recs-name strong', { color: secondary, fontWeight: '600' }),
  c('.dshp-scheduler__recs-prompt', { color: tertiary, fontSize: '12px', lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  c('.dshp-scheduler__muted', { margin: '0', color: secondary, fontSize: '12px' }),

  c('.dshp-scheduler__model-trigger-label', { minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  c('.dshp-scheduler__model-trigger-effort', { flex: 'none', color: tertiary, whiteSpace: 'nowrap' }),
  c('.dshp-scheduler__model-row', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', width: '100%' }),
  c('.dshp-scheduler__model-row-label', { flex: 'none' }),
  c('.dshp-scheduler__model-row-hint', { flex: '1', minWidth: '0', overflow: 'hidden', color: tertiary, textAlign: 'right', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  c('.dshp-scheduler__model-option-copy', { display: 'flex', minWidth: '0', flex: '1', flexDirection: 'column' }),
  c('.dshp-scheduler__model-name', { overflow: 'hidden', fontSize: '14px', fontWeight: '500', lineHeight: '20px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  c('.dshp-scheduler__model-description', { overflow: 'hidden', color: tertiary, fontSize: '12px', lineHeight: '18px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),

  // register/session-icons.ts 通过 DOM 观察器注入侧边栏会话行时钟图标
  c(`[${SESSION_ICON_ATTRIBUTE}]`, { width: '16px', height: '20px', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: '2px', marginRight: '5px', color: secondary }),
  c('[role="treeitem"]', { position: 'relative' }),
])
