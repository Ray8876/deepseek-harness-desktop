import { PLUGIN_ID } from '../../shared/constants'

/** settings.section 槽位里的桌宠分区标识与排序权重。 */
export const PET_SECTION_ID = 'dsh-tauri-pet-settings'
export const PET_SECTION_ORDER = 230

/** 样式挂载 id 与 effect 标签。 */
export const PET_STYLES_ID = 'dsh-tauri-pet-styles'
export const PET_LOCALE_EFFECT = `${PLUGIN_ID}: locale`
export const PET_STYLES_EFFECT = `${PLUGIN_ID}: styles`
export const PET_SECTION_EFFECT = `${PLUGIN_ID}: settings section`
export const PET_PREFILL_EFFECT = `${PLUGIN_ID}: conversation prefill`
export const PET_MENU_EFFECT = `${PLUGIN_ID}: settings menu items`

/** conversation.input.left 槽位里的一次性草稿注入。 */
export const CONVERSATION_INPUT_LEFT_SLOT = 'conversation.input.left'
export const PET_PREFILL_ID = 'dsh-tauri-pet-prefill'
export const PET_PREFILL_ORDER = 230
export const PET_PREFILL_PRIORITY = 0
export const PET_HATCH_PROMPT = '/hatch-dsh-pet 根据你对我的了解，养一只宠物'

/** 桌面端 Tauri 命令 id（与 src-tauri 的 command 名逐字一致）。 */
export const CMD_GET_PET_STATUS = 'get_pet_status'
export const CMD_SET_PET_ENABLED = 'set_pet_enabled'
export const CMD_SET_ACTIVE_PET = 'set_active_pet'
export const CMD_SET_PET_SIZE = 'set_pet_size'
export const CMD_LIST_PETS = 'list_pets'
export const CMD_IMPORT_PET = 'import_pet'
export const CMD_LIST_PRESET_PETS = 'list_preset_pets'

/**
 * 设置菜单补丁的选择器与守卫属性。
 *
 * 官方账号菜单（桌面载体）与壳层自有菜单（浏览器直开）都是官方 primitives 的 portal `Menu`，
 * 条目为 `button[role=menuitem]` 且由 `itemWrap` 包裹；「设置」条目是唯一锚点，其它菜单
 * （工作区、模型选择等）不含该文案。克隆官方条目以继承样式，因此不依赖动态类名哈希。
 *
 * 桌宠的开关只存在于这个菜单里：侧栏爪按钮已删除（设置入口两种形态都是菜单）。
 */
export const SETTINGS_MENU_LABELS: readonly string[] = ['设置', 'Settings']
export const MENU_ITEM_SELECTOR = 'button[role="menuitem"]'
export const MENU_ITEM_WRAP_SELECTOR = '[class*="itemWrap"]'
export const MENU_ITEM_LABEL_SELECTOR = '[class*="itemLabel"]'
export const MENU_ITEM_ICON_SELECTOR = '[class*="itemIcon"]'
export const PET_MENU_ITEM_ATTRIBUTE = 'data-dsh-tauri-pet-menu-item'
export const PET_MENU_PATCH_ATTRIBUTE = 'data-dsh-tauri-pet-menu-patched'

/** 桌宠窗口大小（百分比）。 */
export const PET_DEFAULT_SIZE = 100
export const PET_SIZE_MIN = 50
export const PET_SIZE_MAX = 200
export const PET_SIZE_STEP = 5
