import type { Translate } from './types'
import { locale } from '../../locales'

export const MODEL_EXTRAS_KEYS = [
  'apply',
  'textEditor',
  'textEditorHint',
  'editorSystem',
  'editorVSCode',
  'editorCursor',
  'editorCustom',
  'editorCommand',
  'editorCommandPlaceholder',
  'editorCommandHint',
  'editorLoadFailed',
  'editorSaveFailed',
  'openConfigFile',
  'openConfigFileHint',
  'openConfigFileLanded',
  'openConfigFileDirectory',
  'openConfigFileFailed',
  'autoConfigureModels',
  'autoConfigureModelsHint',
  'fetchModelConfig',
  'fetchModelConfigHint',
  'fetchingConfig',
  'configUnreachable',
  'configNoneApplied',
  'configApplied',
  'configUndisclosed',
  'modelConfig',
  'thinkingMode',
  'thinkingLevels',
  'thinkingModeHint',
  'developerRole',
  'developerRoleHint',
] as const

export const modelExtrasTranslate: Translate = (key, params) => (locale.text as Translate)(key, params)
