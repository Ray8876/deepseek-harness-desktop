// 引用源 @deepseek-ai/dsh-client-ui-goal · packages/client/ui-goal/src/client/GoalBar.module.css · 版本 0.1.7-alpha.1（≥0.1.5-rc.1）· hash bar=nLMEza_bar action=nLMEza_iconBtn
import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from 'react'
import { compact } from 'dsh-tauri/client'
import { useMountStyle } from '../hooks/use-mount-style'
import goalBarStyle from './goal-bar.cssr'

export interface GoalBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  glyph?: ReactNode
  label?: ReactNode
  objective?: ReactNode
  error?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}

export interface GoalBarActionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  iconOnly?: boolean
  children?: ReactNode
}

const GOAL_BAR_STYLE_ID = 'dsh-tauri-ui-goal-bar-styles'

export function GoalBar({
  glyph,
  label,
  objective,
  error,
  actions,
  className,
  children,
  ...rest
}: GoalBarProps): ReactElement {
  useMountStyle(goalBarStyle, GOAL_BAR_STYLE_ID)
  return (
    <div className={compact(['dshp-goal-bar', className]).join(' ')} {...rest}>
      {glyph === undefined ? null : <span className="dshp-goal-bar__glyph">{glyph}</span>}
      {label === undefined ? null : <span className="dshp-goal-bar__label">{label}</span>}
      {objective === undefined ? null : <span className="dshp-goal-bar__objective">{objective}</span>}
      {error === undefined ? null : <span className="dshp-goal-bar__error" role="alert">{error}</span>}
      {children}
      {actions === undefined ? null : <div className="dshp-goal-bar__actions">{actions}</div>}
    </div>
  )
}

export function GoalBarAction({
  iconOnly = false,
  className,
  children,
  ...rest
}: GoalBarActionProps): ReactElement {
  useMountStyle(goalBarStyle, GOAL_BAR_STYLE_ID)
  return (
    <button
      type="button"
      className={compact(['dshp-goal-bar__action', iconOnly ? 'dshp-goal-bar__action--icon' : undefined, className]).join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
