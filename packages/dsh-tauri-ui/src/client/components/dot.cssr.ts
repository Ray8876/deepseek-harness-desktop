import { styles as sharedStyles } from '../constants/theme'
import { cssr } from '../utils/cssr'

const { c, bem: { b } } = cssr
const { error, idle, success, warn } = sharedStyles

export default b('dot', {
  position: 'relative',
  display: 'inline-block',
  flex: 'none',
}, [
  c('&::after', {
    content: '""',
    position: 'absolute',
    inset: '20%',
    borderRadius: '50%',
    cornerShape: 'round',
    background: 'currentColor',
  }),
  c('&[data-state="done"]', { color: success }),
  c('&[data-state="warning"]', { color: warn }),
  c('&[data-state="error"]', { color: error }),
  c('&[data-state="idle"]', { color: idle }),
])
