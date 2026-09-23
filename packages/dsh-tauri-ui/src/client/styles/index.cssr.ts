import { TURN_NAVIGATION_SLOT_SELECTOR } from '../constants'
import { cssr } from '../utils/cssr'

export const TURN_NAVIGATION_STYLE_ID = 'dsh-tauri-ui-turn-navigation-styles'

const { c } = cssr

export default c(TURN_NAVIGATION_SLOT_SELECTOR, {
  display: 'block',
})
