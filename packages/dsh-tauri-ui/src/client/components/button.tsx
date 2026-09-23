// 引用源 @deepseek-ai/dsh-client-ui-primitives · packages/client/ui-primitives/src/Button.tsx ; @deepseek-ai/dsh-client-ui-sidebar · packages/client/ui-sidebar/src/client/SidebarRoot.module.css ; @deepseek-ai/dsh-client-ui-plugin-manager · packages/client/ui-plugin-manager/src/client/PluginManagerPage.module.css · 版本 0.1.7-alpha.1（≥0.1.5-rc.1）· hash elevated=hHd-Xa_newSession add=X_2TxG_addButton addGhost=X_2TxG_addButton danger=X_2TxG_danger
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'
import { Button as PrimitiveButton } from '@deepseek-ai/dsh-client-ui-primitives'
import { compact } from 'dsh-tauri/client'
import { useMountStyle } from '../hooks/use-mount-style'
import buttonStyle from './button.cssr'

export type ButtonVariant
  = | 'primary'
    | 'ghost'
    | 'outline'
    | 'toolbar'
    | 'elevated'
    | 'add'
    | 'addGhost'
    | 'danger'

export type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  children?: ReactNode
}

const BUTTON_STYLE_ID = 'dsh-tauri-ui-button-styles'

function isLocalVariant(variant: ButtonProps['variant']): variant is 'elevated' | 'add' | 'addGhost' | 'danger' {
  return variant === 'elevated' || variant === 'add' || variant === 'addGhost' || variant === 'danger'
}

// elevated / add / addGhost 是上游固定几何，size 对其无效；danger 沿用官方 outline 的 md / sm 两档。
function LocalButton({
  variant,
  size,
  icon,
  className,
  children,
  ...rest
}: ButtonProps & { variant: 'elevated' | 'add' | 'addGhost' | 'danger', size: ButtonSize }): ReactElement {
  useMountStyle(buttonStyle, BUTTON_STYLE_ID)
  return (
    <button
      type="button"
      className={compact(['dshp-button', `dshp-button--${variant}`, `dshp-button--${size}`, className]).join(' ')}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

export function Button({ variant = 'ghost', size = 'md', icon, className, children, ...rest }: ButtonProps): ReactElement {
  if (isLocalVariant(variant))
    return <LocalButton variant={variant} size={size} icon={icon} className={className} {...rest}>{children}</LocalButton>
  return <PrimitiveButton variant={variant} size={size} icon={icon} className={className} {...rest}>{children}</PrimitiveButton>
}
