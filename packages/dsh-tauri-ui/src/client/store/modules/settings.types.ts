export interface SettingsUiState {
  open: boolean
  activeId: string | undefined
  query: string
  railWidth: number | undefined
  /**
   * 官方 `settings.launcher` 座位是否已声明（官方条目在注册时声明，早于本插件时装好）。
   * 未声明（更老核心）时触发器渲染自有按钮——`SlotOutlet` 对未声明的槽位返回空，绝不能让
   * 设置入口消失。
   */
  launcherAvailable: boolean
}

export type SettingsUiKey = 'back' | 'search' | 'settings' | 'noResults'
