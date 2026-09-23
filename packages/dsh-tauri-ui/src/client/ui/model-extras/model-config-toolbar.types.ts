import type { EditorPreference } from '../../../shared/editor.types'
import type { Translate } from './types'

export type ModelDraft = Record<string, unknown>

export interface ModelProbeTarget {
  settingsNs: string
  profilePath: readonly string[]
  provider?: string
  baseURL?: string
  api?: string
  apiKey?: string
}

export interface ModelConfigToolbarProps {
  t: Translate
  editor?: EditorPreference
  onEditorChange?: (next: EditorPreference) => void
  onOpenConfig?: () => void
  openConfigLabel?: string
  openConfigHint?: string
  disabled?: boolean
}
