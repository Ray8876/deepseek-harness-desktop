import { styles as sharedStyles } from '../../constants/theme'
import { cssr } from '../../utils/cssr'

export const MODEL_EXTRAS_STYLE_ID = 'dsh-tauri-ui-model-extras-styles'

const { c } = cssr
const { primary, secondary, tertiary, error, success, hover, borderL4, layer1, focusRing } = sharedStyles

export default c([
  c('.dshp-model-extras__row', {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    minWidth: '0',
  }),
  c('.dshp-model-extras__link', {
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    height: '28px',
    padding: '0 10px',
    border: 'none',
    borderRadius: '14px',
    background: 'transparent',
    color: tertiary,
    cursor: 'pointer',
    font: 'inherit',
    fontSize: '12px',
    lineHeight: '18px',
    whiteSpace: 'nowrap',
  }, [
    c('&:hover:not(:disabled)', {
      background: hover,
      color: secondary,
    }),
    c('&:focus-visible', focusRing),
    c('&:disabled', {
      cursor: 'not-allowed',
      opacity: '0.5',
    }),
    c('&[aria-expanded=\'true\']', {
      color: secondary,
    }),
  ]),
  c('.dshp-model-extras__notice', {
    flex: '1 1 100%',
    minWidth: '0',
    margin: '0',
    fontSize: '12px',
    lineHeight: '18px',
    color: tertiary,
    overflowWrap: 'anywhere',
  }, [
    c('&.dshp-model-extras__notice--failed', { color: error }),
    c('&.dshp-model-extras__notice--done', { color: success }),
  ]),
  c('.dshp-model-extras__dialog-field', {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  }),
  c('.dshp-model-extras__dialog-label', {
    fontSize: '12px',
    lineHeight: '18px',
    color: secondary,
  }),
  c('.dshp-model-extras__input', {
    boxSizing: 'border-box',
    width: '100%',
    height: '32px',
    padding: '0 10px',
    border: `0.5px solid ${borderL4}`,
    borderRadius: '8px',
    background: layer1,
    color: primary,
    font: 'inherit',
    fontSize: '14px',
    lineHeight: '22px',
    outline: 'none',
  }, [
    c('&:focus-visible', focusRing),
    c('&:disabled', {
      cursor: 'not-allowed',
      opacity: '0.5',
    }),
  ]),
  c('.dshp-model-extras__dialog-hint', {
    fontSize: '12px',
    lineHeight: '18px',
    color: tertiary,
  }),
  c('.dshp-model-extras__dialog-error', {
    margin: '0',
    fontSize: '13px',
    lineHeight: '20px',
    color: error,
  }),
])
