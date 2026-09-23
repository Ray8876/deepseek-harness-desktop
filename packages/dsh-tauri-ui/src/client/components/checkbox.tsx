// 引用源 @deepseek-ai/dsh-client-ui-primitives · packages/client/ui-primitives/src/Checkbox.tsx · 版本 0.1.7-alpha.1（≥0.1.7-alpha.1）· hash default=_checkbox_1jl6j_1
import type { ReactElement, ReactNode } from 'react'
import { useMountStyle } from '../hooks/use-mount-style'
import checkboxStyle from './checkbox.cssr'

export interface CheckboxProps {
  'checked': boolean
  'disabled'?: boolean
  'onChange': (next: boolean) => void
  'children'?: ReactNode
  'aria-label'?: string
  'title'?: string
}

export const CHECKBOX_STYLE_ID = 'dsh-tauri-ui-checkbox-styles'

export function Checkbox({ checked, disabled, onChange, children, 'aria-label': ariaLabel, title }: CheckboxProps): ReactElement {
  useMountStyle(checkboxStyle, CHECKBOX_STYLE_ID)
  return (
    <label className="dshp-checkbox" title={title}>
      <input
        className="dshp-checkbox__input"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={event => onChange(event.target.checked)}
      />
      {children === undefined ? null : <span className="dshp-checkbox__label">{children}</span>}
    </label>
  )
}
