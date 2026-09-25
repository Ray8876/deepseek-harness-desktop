import { styles as sharedStyles } from '../constants/theme'
import { cssr } from '../utils/cssr'

const { c, bem: { b, m } } = cssr
const { primary, hover } = sharedStyles

export default c([
  // 壳层自有菜单用官方 primitives 的 `Menu`，其 anchor 包裹层（`.root`）是 `inline-flex`
  // 收缩盒：触发器会按内容宽度塌缩，侧栏里就不再是整行了。菜单只能给「包裹层」加类，
  // 因此在这里把该层拉满（`span`+类名特异性高于 primitives 的 `.root`）。
  c('span.dshp-settings-trigger-host', {
    display: 'block',
    width: '100%',
  }),
  b('settings-trigger', {
    boxSizing: 'border-box',
    cursor: 'pointer',
    width: 'calc(100% + 4px)',
    height: '42px',
    color: primary,
    background: 'none',
    border: 'none',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '4px -2px',
    padding: '0 10px 0 8px',
    fontFamily: 'inherit',
    fontSize: '14px',
    lineHeight: '22px',
    overflow: 'hidden',
    flex: 'none',
  }, [
    c('&:hover', { background: hover }),
    m('rail', {
      borderRadius: '50%',
      justifyContent: 'center',
      gap: 0,
      width: '36px',
      height: '36px',
      margin: '8px 0 10px',
      padding: 0,
    }),
  ]),
])
