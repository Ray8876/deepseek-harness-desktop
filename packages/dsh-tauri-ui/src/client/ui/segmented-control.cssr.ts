import { styles as sharedStyles } from '../constants/theme'
import { cssr } from '../utils/cssr'

const { c, bem: { b, e } } = cssr
const { primary, secondary, hover, modulePlatform, layer1, borderL3, focusRing } = sharedStyles

export default b('segmented-control', {
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2px',
  padding: '2px',
  border: 'none',
  borderRadius: '10px',
  background: modulePlatform,
}, [
  e('option', {
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    minHeight: '28px',
    padding: '0 12px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    color: secondary,
    cursor: 'pointer',
    font: 'inherit',
    fontSize: '13px',
    lineHeight: '20px',
    whiteSpace: 'nowrap',
  }, [
    c('&:hover:not(:disabled)', {
      background: hover,
      color: primary,
    }),
    c('&:focus-visible', focusRing),
    c('&:disabled', {
      cursor: 'not-allowed',
      opacity: '0.5',
    }),
  ]),
  e('option--selected', {
    background: layer1,
    color: primary,
    fontWeight: '500',
    boxShadow: `inset 0 0 0 0.5px ${borderL3}`,
  }, [
    c('&:hover:not(:disabled)', {
      background: layer1,
      color: primary,
    }),
  ]),
])
