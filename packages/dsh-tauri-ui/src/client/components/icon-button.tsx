// 引用源 @deepseek-ai/dsh-client-ui-workspace · packages/client/ui-workspace/src/client/rows/WorkspaceBrowser.module.css ; @deepseek-ai/dsh-client-ui-plugin-manager · packages/client/ui-plugin-manager/src/client/PluginManagerPage.module.css ; @deepseek-ai/dsh-client-ui-settings-models · packages/client/ui-settings-models/src/client/ModelsSection.module.css ; @deepseek-ai/dsh-client-ui-sidebar · packages/client/ui-sidebar/src/client/SidebarRoot.module.css ; @deepseek-ai/dsh-client-ui-workspace · packages/client/ui-workspace/src/client/rows/Rows.module.css ; @deepseek-ai/dsh-client-ui-primitives · packages/client/ui-primitives/src/settings-form/fields.module.css ; @deepseek-ai/dsh-client-ui-chat · packages/client/ui-chat/src/client/chat/MessageIconActions.module.css · 版本 0.1.7-alpha.1（≥0.1.5-rc.1）· hash search=bhn1Oq_searchButton toolbar=X_2TxG_iconButton model=zGbnIq_iconButton round=IW6AQa_iconButton（同包另有 hHd-Xa_iconButton） row=YDXeBa_iconButton（同包另有 bhn1Oq_iconButton） help=helpButton action=xzv4MW_action
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'

import { compact } from 'dsh-tauri/client'
import { useMountStyle } from '../hooks/use-mount-style'
import iconButtonStyle from './icon-button.cssr'

export type IconButtonVariant = 'search' | 'toolbar' | 'model' | 'round' | 'row' | 'help' | 'action'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant: IconButtonVariant
  icon?: ReactNode
  children?: ReactNode
}

const ICON_BUTTON_STYLE_ID = 'dsh-tauri-ui-icon-button-styles'

export function IconButton({ variant, icon, className, children, ...rest }: IconButtonProps): ReactElement {
  useMountStyle(iconButtonStyle, ICON_BUTTON_STYLE_ID)
  return (
    <button
      type="button"
      className={compact(['dshp-icon-button', `dshp-icon-button--${variant}`, className]).join(' ')}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
