import { styles as sharedStyles } from '../../constants/theme'
import { cssr } from '../../utils/cssr'

export const MODEL_COMPAT_FIELDS_STYLE_ID = 'dsh-tauri-ui-model-compat-fields-styles'

const { c } = cssr
const { secondary, tertiary, borderL3, brand, focusRing } = sharedStyles

export default c([
  c('.dshp-model-compat', {
    order: '1',
    display: 'flex',
    gap: '16px',
    minWidth: '0',
    margin: '0',
    padding: '0',
    border: 'none',
  }),
  c('.dshp-model-compat__field', {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '0',
  }),
  c('.dshp-model-compat__label', {
    padding: '0',
    color: tertiary,
    fontSize: '12px',
    lineHeight: '18px',
  }),
  c('.dshp-model-compat__switch', {
    display: 'flex',
    alignItems: 'center',
    height: '32px',
  }),
  c('.dshp-model-compat__levels', {
    order: '3',
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  }),
  c('.dshp-model-compat__chips', {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  }),
  c('.dshp-model-compat__chip', {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    height: '24px',
    padding: '0 8px',
    border: `0.5px solid ${borderL3}`,
    borderRadius: '6px',
    fontSize: '12px',
    lineHeight: '18px',
    color: secondary,
    cursor: 'pointer',
  }, [
    c('&:has(input:disabled)', {
      opacity: '0.6',
      cursor: 'default',
    }),
    c('input', {
      width: '12px',
      height: '12px',
      margin: '0',
      accentColor: brand,
    }),
    c('input:focus-visible', focusRing),
  ]),
])
