// 引用源 @deepseek-ai/dsh-client-ui-primitives · packages/client/ui-primitives/src/Tag.tsx ; @deepseek-ai/dsh-client-ui-plugin-manager · packages/client/ui-plugin-manager/src/client/PluginManagerPage.module.css · 版本 0.1.7-alpha.1（≥0.1.5-rc.1）· hash version=X_2TxG_versionTag status=X_2TxG_statusTag
import type { HTMLAttributes, ReactElement, ReactNode } from 'react'
import { Tag as PrimitiveTag } from '@deepseek-ai/dsh-client-ui-primitives'
import { compact } from 'dsh-tauri/client'
import { useMountStyle } from '../hooks/use-mount-style'
import tagStyle from './tag.cssr'

export type TagVariant = 'default' | 'version' | 'status'

export type TagTone = 'outline' | 'solid' | 'neutral' | 'quiet' | 'success' | 'info' | 'warning' | 'danger'

export interface TagProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  variant?: TagVariant
  tone?: TagTone
  children?: ReactNode
}

const TAG_STYLE_ID = 'dsh-tauri-ui-tag-styles'

function LocalTag({ variant, tone = 'outline', className, children, ...rest }: TagProps & { variant: 'version' | 'status' }): ReactElement {
  useMountStyle(tagStyle, TAG_STYLE_ID)
  return (
    <span
      className={compact(['dshp-tag', `dshp-tag--${variant}`, className]).join(' ')}
      data-tone={tone}
      {...rest}
    >
      {children}
    </span>
  )
}

export function Tag({ variant = 'default', tone = 'outline', className, children, ...rest }: TagProps): ReactElement {
  if (variant === 'default')
    return <PrimitiveTag tone={tone} className={className} {...rest}>{children}</PrimitiveTag>
  return <LocalTag variant={variant} tone={tone} className={className} {...rest}>{children}</LocalTag>
}
