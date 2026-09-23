import { styles as sharedStyles } from '../constants/theme'
import { cssr } from '../utils/cssr'

const { c, bem: { b, e, m } } = cssr
const { dimmed, focusRing, hover, modulePlatform, primary, secondary } = sharedStyles

const labelEllipsis = {
  minWidth: '0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

// css-render 只把 @media/@supports 当块级选择器（isMediaOrSupports），官方那条 @container 只能顶层 raw 发出。
const COMPOSER_TRIGGER_COLLAPSE = [
  '@container (max-width: 460px) {',
  '  .dshp-chip--composerTrigger:has(.dshp-chip__icon) .dshp-chip__label {',
  '    display: none;',
  '  }',
  '}',
].join('\n')

export default c([
  b('chip', {}, [
    // 官方三种 chip 的 chevron 同为一枚细描边 14px artwork；gravity 实心箭头在 14px 下宽 +20.8%、高 +35.6%、
    // 笔画重 +49.9%，实测光学等效点为 11px。属字形属性，故置于块级供三种 variant 共用，调用方传 size 也不再漂移。
    e('chevron', {}, [
      c('& svg', { width: '11px', height: '11px' }),
    ]),
    m('seat', {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      minWidth: '0',
      maxWidth: 'min(100%, 240px)',
      minHeight: '28px',
      padding: '0 8px',
      border: 'none',
      borderRadius: '16px',
      background: 'transparent',
      color: primary,
      fontSize: '13px',
      lineHeight: '20px',
      fontWeight: '500',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
    }, [
      c('&:not(:disabled):hover, &[aria-expanded=\'true\']', { background: hover }),
      c('&:disabled', {
        cursor: 'default',
        color: 'var(--dsw-alias-label-quaternary)',
      }),
      e('icon', {
        display: 'inline-flex',
        flex: '0 0 auto',
        color: primary,
      }),
      e('label', labelEllipsis),
      e('chevron', {
        display: 'inline-flex',
        flex: '0 0 auto',
        color: 'var(--dsw-alias-label-caption)',
      }),
    ]),
    m('composerTrigger', {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      minWidth: '0',
      maxWidth: '220px',
      height: '28px',
      padding: '0 4px 0 8px',
      border: 'none',
      borderRadius: '24px',
      outline: 'none',
      background: 'transparent',
      color: secondary,
      fontSize: '13px',
      lineHeight: '20px',
      fontWeight: '500',
      cursor: 'pointer',
    }, [
      c('&:hover:not(:disabled)', { background: hover }),
      c('&:focus-visible', { ...focusRing }),
      c('&:disabled', {
        color: dimmed,
        cursor: 'default',
      }),
      e('icon', {
        display: 'inline-flex',
        flex: '0 0 auto',
      }, [
        c('& svg', { width: '14px', height: '14px' }),
      ]),
      e('label', labelEllipsis),
      e('badge', { flex: '0 0 auto' }),
      e('chevron', {
        display: 'inline-flex',
        flex: '0 0 auto',
        color: 'var(--dsw-alias-label-caption)',
        transition: 'transform 120ms ease',
      }, [
        c('&[data-open=\'true\']', { transform: 'rotate(180deg)' }),
      ]),
    ]),
    m('selector', {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '12px',
      height: '36px',
      padding: '0 14px',
      border: 'none',
      borderRadius: '18px',
      background: modulePlatform,
      font: 'inherit',
      fontSize: '14px',
      lineHeight: '22px',
      color: primary,
      cursor: 'pointer',
    }, [
      c('&:hover:not(:disabled)', { background: hover }),
      c('&:disabled', { cursor: 'default' }),
      e('chevron', {
        display: 'inline-flex',
        flex: '0 0 auto',
        color: 'var(--dsw-alias-label-caption)',
        transition: 'transform 120ms ease',
      }, [
        // 官方 .selector 是设置行、不旋转；本仓把它当下拉触发器用，故与 composerTrigger 一样带展开态。
        c('&[data-open=\'true\']', { transform: 'rotate(180deg)' }),
      ]),
    ]),
  ]),
  c('', { raw: COMPOSER_TRIGGER_COLLAPSE }),
])
