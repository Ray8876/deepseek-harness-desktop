import type { InputActions, InputState } from '../service/session-switch.types'
import type { WorktreeSessionState } from '../store/modules/worktree.types'

export const NO_DRAFT_ATTACHMENTS: readonly string[] = []

// 未校准（isGit 未知）与已确认非 git 的会话都必须隐藏控件：前者会凭空白冒出切换框，
// 后者在工作树创建必然失败的情况下仍能进 pending，把会话锁死。
export function showsModeSelect(state: Pick<WorktreeSessionState, 'isGit' | 'mode'>): boolean {
  return state.isGit === true && state.mode !== 'worktree'
}

// 拦截和渲染必须是同一条件，否则控件消失后拦截仍在，用户失去唯一的退回入口。
export function interceptsSubmit(state: Pick<WorktreeSessionState, 'isGit' | 'mode'>): boolean {
  return state.mode === 'pending' && state.isGit === true
}

export function draftAttachmentIds(state: InputState | undefined): readonly string[] {
  return state?.attachmentIds ?? state?.imageIds ?? NO_DRAFT_ATTACHMENTS
}

export function canAddDraftAttachments(actions: InputActions | undefined): boolean {
  return typeof actions?.addAttachments === 'function' || typeof actions?.addImages === 'function'
}

export function addDraftAttachments(actions: InputActions | undefined, ids: readonly string[]): boolean {
  if (ids.length === 0)
    return true
  if (typeof actions?.addAttachments === 'function')
    return actions.addAttachments([...ids])
  if (typeof actions?.addImages === 'function')
    return actions.addImages([...ids])
  return false
}

export function removeDraftAttachment(actions: InputActions | undefined, id: string): void {
  if (typeof actions?.removeAttachment === 'function') {
    actions.removeAttachment(id)
    return
  }
  actions?.removeImage?.(id)
}

export function resolveAccessModeGroup(button: HTMLElement, planSlot: Element | null, maxDepth = 8): HTMLElement {
  let previous: HTMLElement = button
  let node: HTMLElement | null = button.parentElement
  for (let depth = 0; node && depth < maxDepth; depth++) {
    if (planSlot ? node.contains(planSlot) : previous !== button)
      return node
    previous = node
    node = node.parentElement
  }
  return button
}
