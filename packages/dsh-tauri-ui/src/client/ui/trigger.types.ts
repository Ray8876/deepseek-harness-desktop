import type { SessionId, SessionListState } from 'dsh-tauri/client'
import type { SelectorHook } from '../types/selector'

/**
 * `useSessions` 快照的读取面：0.1.7 起核心不再把选中态放进列表快照（改由 `uiSession` 持有），
 * 适配层会把 `current` 投影补回，因此按可选成员声明。
 *
 * `byId` 放宽为裸字符串索引：核心按 branded `SessionId` 建索引，而 `current` 经投影回落后
 * 是裸字符串，二者在读取处需能互相寻址。
 */
export type SessionListStateLike = Omit<SessionListState, 'byId'> & {
  current?: string
  byId: Record<string, SessionListState['byId'][SessionId]>
}

export interface SettingsTriggerProps {
  wide: boolean
  useSessions: SelectorHook<SessionListStateLike>
  useWorkspaces?: unknown
}
