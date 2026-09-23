import { styles as sharedStyles } from '../constants/theme'
import { cssr } from '../utils/cssr'

const { c, bem: { b, m } } = cssr
const { borderL4, business, error, modulePlatform, secondary, tertiary } = sharedStyles

export default b('tag', {}, [
  m('version', {
    display: 'inline-flex',
    alignItems: 'center',
    flex: 'none',
    padding: '1px 8px',
    borderRadius: '999px',
    cornerShape: 'round',
    fontSize: '11px',
    lineHeight: '17px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  }, [
    c('&[data-tone=\'outline\']', {
      border: `0.5px solid ${borderL4}`,
      color: tertiary,
    }),
    c('&[data-tone=\'neutral\']', {
      background: modulePlatform,
      color: secondary,
    }),
  ]),
  m('status', {
    display: 'inline-flex',
    alignItems: 'center',
    height: '18px',
    padding: '0 7px',
    borderRadius: '999px',
    cornerShape: 'round',
    fontSize: '10px',
    lineHeight: '1',
    fontWeight: '500',
    whiteSpace: 'nowrap',
  }, [
    c('&[data-tone=\'outline\']', {
      border: `0.5px solid ${borderL4}`,
      color: tertiary,
    }),
    c('&[data-tone=\'info\']', {
      background: `color-mix(in srgb, ${business} 10%, transparent)`,
      color: business,
    }),
    c('&[data-tone=\'danger\']', {
      background: `color-mix(in srgb, ${error} 10%, transparent)`,
      color: error,
    }),
  ]),
])
