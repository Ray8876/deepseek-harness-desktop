/** 设置分区面骨架与侧栏入口补丁的布局样式；通用控件观感全部来自 `dsh-tauri-ui/client`。 */
import { cssr } from 'dsh-tauri-ui/client'

const { c } = cssr

export default c([
  c('.dshp-pet__page', {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    color: 'var(--dsw-alias-label-primary)',
  }),
  c('.dshp-pet__tabs', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
    margin: '4px 0 0',
  }),
  c('.dshp-pet__tab-tools', { display: 'flex', alignItems: 'center', gap: '6px' }),
  c('.dshp-pet__tab-desc', {
    margin: '0',
    fontSize: '13px',
    lineHeight: '20px',
    color: 'var(--dsw-alias-label-secondary)',
  }),
  c('.dshp-pet__size-row', { display: 'flex', alignItems: 'center', gap: '12px' }),
  c('.dshp-pet__size-label', { flex: 'none', fontWeight: '500' }),
  c('.dshp-pet__size-slider', {
    flex: '1',
    accentColor: 'var(--dsw-alias-brand-primary)',
    cursor: 'pointer',
  }),
  c('.dshp-pet__hint', {
    margin: '0',
    fontSize: '12px',
    lineHeight: '18px',
    color: 'var(--dsw-alias-label-secondary)',
  }),
  c('.dshp-pet__empty', {
    padding: '24px 16px',
    textAlign: 'center',
    fontSize: '13px',
    lineHeight: '20px',
    borderRadius: '12px',
    border: '1px dashed var(--dsw-alias-border-weak)',
    color: 'var(--dsw-alias-label-secondary)',
  }),
  c('.dshp-pet__loading', {
    padding: '24px 16px',
    textAlign: 'center',
    fontSize: '13px',
    lineHeight: '20px',
    color: 'var(--dsw-alias-label-secondary)',
  }),
  c('.dshp-pet__error', {
    fontSize: '12px',
    lineHeight: '18px',
    color: 'var(--dsw-alias-state-error-primary)',
  }),

  c('.dshp-pet__cards', { display: 'flex', flexDirection: 'column', gap: '12px' }),
  c('.dshp-pet__card-item', {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid var(--dsw-alias-border-weak)',
    background: 'var(--dsw-alias-bg-base)',
  }, [
    c('&:hover', { background: 'var(--dsw-alias-interactive-bg-hover)' }),
  ]),
  c('.dshp-pet__card-thumb', {
    flex: 'none',
    width: '56px',
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    borderRadius: '10px',
    background: 'var(--dsw-alias-bg-layer-1)',
    overflow: 'hidden',
    objectFit: 'cover',
  }),
  c('.dshp-pet__card-thumb > img', {
    display: 'block',
    width: '100%',
    height: '100%',
  }),
  // 精灵图缩略图：8 列 × 11 行的雪碧图只露出左上角一帧。
  c('.dshp-pet__card-thumbSprite', {
    position: 'relative',
  }, [
    c('& > img', {
      position: 'absolute',
      width: '800%',
      height: '1100%',
      maxWidth: 'none',
      objectFit: 'fill',
      left: '0',
      top: '0',
    }),
  ]),
  c('.dshp-pet__card-body', {
    flex: '1',
    minWidth: '0',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  }),
  c('.dshp-pet__card-nameRow', {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: '0',
  }),
  c('.dshp-pet__card-name', {
    fontWeight: '600',
    fontSize: '14px',
    lineHeight: '20px',
    minWidth: '0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  c('.dshp-pet__card-desc', {
    fontSize: '12px',
    lineHeight: '18px',
    color: 'var(--dsw-alias-label-secondary)',
  }),
  c('.dshp-pet__card-actions', {
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  }),
])
