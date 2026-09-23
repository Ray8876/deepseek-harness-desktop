// 引用源 @deepseek-ai/dsh-client-ui-agent-preset · packages/client/ui-agent-preset/src/client/AgentPresetSeat.module.css ; @deepseek-ai/dsh-client-ui-permission-presets · packages/client/ui-permission-presets/src/client/PermissionSelect.module.css ; @deepseek-ai/dsh-client-ui-permission-presets · packages/client/ui-permission-presets/src/client/PermissionRow.module.css · 版本 0.1.7-alpha.1（≥0.1.5-rc.1）· hash seat=cubgiG_seat composerTrigger=iWlSmW_trigger selector=oY77xG_selector
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'
import { compact } from 'dsh-tauri/client'
import { useMountStyle } from '../hooks/use-mount-style'
import chipStyle from './chip.cssr'

export type ChipVariant = 'seat' | 'composerTrigger' | 'selector'

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant: ChipVariant
  icon?: ReactNode
  badge?: ReactNode
  chevron?: ReactNode
  open?: boolean
  children?: ReactNode
}

const CHIP_STYLE_ID = 'dsh-tauri-ui-chip-styles'

export function Chip({ variant, icon, badge, chevron, open, className, children, ...rest }: ChipProps): ReactElement {
  useMountStyle(chipStyle, CHIP_STYLE_ID)
  // 官方 PermissionRow.selector 不包 icon/label/badge，其余两个 variant 按 PermissionSelect/AgentPresetSeat 包裹。
  const wraps = variant !== 'selector'
  return (
    <button
      type="button"
      className={compact(['dshp-chip', `dshp-chip--${variant}`, className]).join(' ')}
      {...rest}
    >
      {wraps && icon != null ? <span className="dshp-chip__icon" aria-hidden>{icon}</span> : icon}
      {wraps && children != null ? <span className="dshp-chip__label">{children}</span> : children}
      {wraps && badge != null ? <span className="dshp-chip__badge" aria-hidden>{badge}</span> : badge}
      {chevron === undefined
        ? null
        : <span className="dshp-chip__chevron" aria-hidden data-open={open === true ? 'true' : undefined}>{chevron}</span>}
    </button>
  )
}
