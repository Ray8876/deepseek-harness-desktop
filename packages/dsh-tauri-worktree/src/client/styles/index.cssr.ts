import { cssr } from 'dsh-tauri-ui/client'
import { SESSION_ICON_ATTRIBUTE } from '../constants'

const { c } = cssr

export default c([
  c(`[${SESSION_ICON_ATTRIBUTE}]`, {
    width: '16px',
    height: '20px',
    flex: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: '2px',
    color: 'var(--dsw-alias-label-secondary)',
  }),
  c('[role="treeitem"]', { position: 'relative' }),
  c(`[role="treeitem"]:hover [${SESSION_ICON_ATTRIBUTE}]`, { visibility: 'hidden' }),

  c('.dshp-mode-select__host', { display: 'inline-flex', alignItems: 'center', flex: 'none' }),
  c('.dshp-mode-select__anchor', { display: 'none' }),
  c('.dshp-mode-select__label', { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),

  c('.dshp-worktree', { boxSizing: 'border-box' }),
  c('.dshp-worktree__surface', {
    boxSizing: 'border-box',
    width: 'calc(100% - 2 * var(--dsh-composer-side-clearance) - 4 * var(--dsh-composer-dock-inset))',
    maxWidth: 'calc(var(--dsh-composer-card-max-width) - 4 * var(--dsh-composer-dock-inset))',
    margin: '0 auto',
    alignSelf: 'center',
  }),
  c('.dshp-worktree__logs', {
    display: 'grid',
    gridTemplateRows: '0fr',
    opacity: 0,
    transition: 'grid-template-rows 180ms cubic-bezier(.16, 1, .3, 1), opacity 140ms ease',
  }),
  c('.dshp-worktree__logs--open', { gridTemplateRows: '1fr', opacity: 1 }),
  c('.dshp-worktree__logs-inner', { minHeight: 0, overflow: 'hidden', marginTop: '6px' }),
  c('.dshp-worktree__logs-panel', {
    maxHeight: '180px',
    overflowY: 'auto',
    padding: '10px',
    borderRadius: '10px',
    border: '1px solid var(--dsw-alias-border-l2)',
    background: 'var(--dsw-alias-bg-base)',
    zIndex: 30,
  }),
  c('.dshp-worktree__log-line', { fontSize: '12px', fontFamily: 'cursive', lineHeight: '16px' }),

  c('.dshp-worktree__dialog-form', { display: 'flex', flexDirection: 'column', gap: '14px' }),
  c('.dshp-worktree__dialog-field', { display: 'flex', flexDirection: 'column', gap: '6px' }),
  c('.dshp-worktree__dialog-field-label', { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, var(--dsw-alias-label-primary))' }),
  c('.dshp-worktree__dialog-path-row', { display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px', lineHeight: '18px' }),
  c('.dshp-worktree__dialog-path-key', { flex: 'none', color: 'var(--dsw-alias-label-secondary, var(--dsw-alias-label-primary))' }),
  c('.dshp-worktree__dialog-path-value', { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }),
  c('.dshp-worktree__dialog-error', { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-state-error-primary)' }),
])
