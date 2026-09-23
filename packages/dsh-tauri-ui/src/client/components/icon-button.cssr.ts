import { styles as sharedStyles } from '../constants/theme'
import { cssr } from '../utils/cssr'

const { c, bem: { b, m } } = cssr
const { brand, focusRing, hover, primary, secondary, tertiary } = sharedStyles

export default b('icon-button', {}, [
  m('search', {
    display: 'inline-flex',
    flex: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    padding: 0,
    border: 'none',
    borderRadius: '50%',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
  }, [
    c('&:hover', { background: hover }),
  ]),
  m('toolbar', {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 'none',
    width: '28px',
    height: '28px',
    border: '0',
    borderRadius: '28px',
    background: 'transparent',
    color: 'var(--dsw-alias-label-caption)',
    cursor: 'pointer',
  }, [
    c('&:hover:not(:disabled)', {
      background: hover,
      color: secondary,
    }),
    c('&:disabled', {
      opacity: '0.5',
      cursor: 'default',
    }),
    c('&:focus-visible', {
      outline: `2px solid ${brand}`,
      outlineOffset: '1px',
    }),
  ]),
  m('model', {
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    border: 'none',
    borderRadius: '6px',
    background: 'transparent',
    color: tertiary,
    cursor: 'pointer',
  }, [
    c('&:hover:not(:disabled)', {
      background: hover,
      color: primary,
    }),
    c('&:disabled', {
      cursor: 'default',
      opacity: '0.4',
    }),
    c('&:focus-visible', { ...focusRing }),
  ]),
  m('round', {
    position: 'relative',
    flex: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    border: 'none',
    borderRadius: '50%',
    cornerShape: 'round',
    padding: '0',
    background: 'transparent',
    cursor: 'pointer',
    color: secondary,
  }, [
    c('&:hover:not(:disabled)', { background: hover }),
    c('&:disabled', {
      cursor: 'default',
      opacity: '0.5',
    }),
  ]),
  m('row', {
    flex: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    border: 'none',
    borderRadius: '4px',
    padding: '0',
    background: 'transparent',
    cursor: 'pointer',
    color: tertiary,
  }, [
    c('&:hover:not(:disabled)', { color: primary }),
    c('&:disabled', {
      cursor: 'default',
      opacity: '0.5',
    }),
  ]),
  m('help', {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 'none',
    width: '24px',
    height: '24px',
    padding: '0',
    border: '0',
    borderRadius: '6px',
    background: 'none',
    color: tertiary,
    cursor: 'pointer',
  }, [
    c('&:hover, &:focus-visible, &[aria-expanded=\'true\']', {
      background: 'var(--dsw-alias-bg-layer-4)',
      color: secondary,
    }),
    c('&:focus-visible', {
      outline: `2px solid ${brand}`,
      outlineOffset: '1px',
    }),
  ]),
  m('action', {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'calc(28px + var(--dsh-content-font-delta, 0px))',
    height: 'calc(28px + var(--dsh-content-font-delta, 0px))',
    padding: '6px',
    border: 'none',
    borderRadius: '28px',
    background: 'transparent',
    color: tertiary,
    cursor: 'pointer',
  }, [
    c('&:hover:not(:disabled)', {
      background: hover,
      color: secondary,
    }),
    c('&:disabled', {
      cursor: 'default',
      opacity: '0.4',
    }),
  ]),
])
