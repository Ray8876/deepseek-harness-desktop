// 引用源 @deepseek-ai/dsh-client-ui-primitives · packages/client/ui-primitives/src/StateDot.module.css · 版本 0.1.7-alpha.1（≥0.1.7-alpha.1）· hash dot=_dot_1i3xo_2
import type { ReactElement } from 'react'
import { compact } from 'dsh-tauri/client'
import { useMountStyle } from '../hooks/use-mount-style'
import dotStyle from './dot.cssr'

export type DotState = 'done' | 'warning' | 'error' | 'idle'

export interface DotProps {
  state?: DotState
  size?: number
  className?: string
}

export const DOT_STYLE_ID = 'dsh-tauri-ui-dot-styles'

export function Dot({ state, size = 10, className }: DotProps): ReactElement {
  useMountStyle(dotStyle, DOT_STYLE_ID)
  return (
    <span
      aria-hidden
      className={compact(['dshp-dot', className]).join(' ')}
      data-state={state}
      style={{ width: size, height: size }}
    />
  )
}
