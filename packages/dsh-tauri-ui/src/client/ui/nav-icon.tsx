import type { ReactElement } from 'react'
import type { IconComponent } from '../components/icon'
import { get } from 'dsh-tauri/client'
import { Icon } from '../components/icon'
import { Database, Gear, Person, Puzzle } from '../components/icons'
import { useMountStyle } from '../hooks/use-mount-style'
import settingsNavIconStyle from './nav-icon.cssr'

const SETTINGS_NAV_ICON_STYLE_ID = 'dsh-tauri-ui-settings-nav-icon-styles'

const NAV_ICONS: Record<string, IconComponent> = {
  'models': Database,
  'agent-presets': Person,
  'plugins': Puzzle,
}

export function SettingsNavIcon({ id }: { id: string }): ReactElement {
  useMountStyle(settingsNavIconStyle, SETTINGS_NAV_ICON_STYLE_ID)
  const NavIcon = get(NAV_ICONS, id, Gear)
  return <Icon as={NavIcon} size={16} className="dshp-settings-nav-icon" />
}
