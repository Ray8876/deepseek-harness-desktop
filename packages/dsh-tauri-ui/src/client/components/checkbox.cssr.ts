import { styles as sharedStyles } from '../constants/theme'
import { cssr } from '../utils/cssr'

const { c, bem: { b, e } } = cssr
const { primary, secondary } = sharedStyles

export default b('checkbox', {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  color: primary,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '14px',
  lineHeight: '20px',
}, [
  e('input', {
    boxSizing: 'border-box',
    flex: 'none',
    width: '16px',
    height: '16px',
    margin: '0',
    accentColor: 'var(--dsw-alias-button-primary-fill)',
    cursor: 'inherit',
  }, [
    c('&:disabled', {
      cursor: 'not-allowed',
    }),
  ]),
  e('label', {
    minWidth: 0,
    color: secondary,
  }),
  c('&:has(> .dshp-checkbox__input:disabled)', {
    cursor: 'not-allowed',
    opacity: '0.5',
  }),
  c('&:has(> .dshp-checkbox__input:disabled) .dshp-checkbox__label', {
    color: secondary,
  }),
  c('.dshp-checkbox__input:focus-visible', {
    outline: 'var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary))',
    outlineOffset: '1px',
  }),
])
