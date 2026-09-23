import type { ClientContext } from 'dsh-tauri/client'
import { defineRegister } from 'dsh-tauri/client'
import { CHECKBOX_STYLE_ID } from '../components/checkbox'
import checkboxStyle from '../components/checkbox.cssr'
import globalStyle, { GLOBAL_STYLE_ID } from '../styles/global.cssr'
import turnNavigationStyle, { TURN_NAVIGATION_STYLE_ID } from '../styles/index.cssr'
import { configEditorStyle, MODEL_CONFIG_TOOLBAR_STYLE_ID } from '../ui/model-extras/config-editor.cssr'
import modelCompatFieldsStyle, { MODEL_COMPAT_FIELDS_STYLE_ID } from '../ui/model-extras/model-compat-fields.cssr'
import modelExtrasStyle, { MODEL_EXTRAS_STYLE_ID } from '../ui/model-extras/model-extras.cssr'
import { SEGMENTED_CONTROL_STYLE_ID } from '../ui/segmented-control'
import segmentedControlStyle from '../ui/segmented-control.cssr'
import { mountStyle } from '../utils/style'

export const registerStyles = defineRegister<ClientContext>((controller) => {
  controller.add(mountStyle(globalStyle, GLOBAL_STYLE_ID))
  controller.add(mountStyle(turnNavigationStyle, TURN_NAVIGATION_STYLE_ID))
  controller.add(mountStyle(modelExtrasStyle, MODEL_EXTRAS_STYLE_ID))
  controller.add(mountStyle(configEditorStyle, MODEL_CONFIG_TOOLBAR_STYLE_ID))
  controller.add(mountStyle(modelCompatFieldsStyle, MODEL_COMPAT_FIELDS_STYLE_ID))
  controller.add(mountStyle(segmentedControlStyle, SEGMENTED_CONTROL_STYLE_ID))
  controller.add(mountStyle(checkboxStyle, CHECKBOX_STYLE_ID))
})
