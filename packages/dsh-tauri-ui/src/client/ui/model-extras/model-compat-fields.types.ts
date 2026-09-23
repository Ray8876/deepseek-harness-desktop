import type { Translate } from './types'

export interface ModelCompatFieldsProps {
  t: Translate
  model: Record<string, unknown>
  index: number
  /** 协议是 chat completions 时才渲染「关闭 Developer 角色」开关，由调用方按自己的路由判断。 */
  templateCompat: boolean
  onPatch: (patch: Record<string, unknown>) => void
  disabled?: boolean | undefined
}
