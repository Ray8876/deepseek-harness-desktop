import type { ReactElement } from 'react'
import type { InputActions } from '../service/session-switch.types'
import type { ModeSelectProps } from './mode-select.types'
import { ChevronDown, Chip, CircleTree, Icon, Menu } from 'dsh-tauri-ui/client'
import { forEach, get } from 'dsh-tauri/client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  COMPOSER_MODE_BUTTON_SELECTOR,
  COMPOSER_PLAN_SLOT_SELECTOR,
  COMPOSER_SEAT_SELECTOR,
  HERO_PRESET_SLOT_SELECTOR,
  MODE_ANCHOR_ATTRIBUTE,
} from '../constants'
import { useWaiter } from '../hooks/use-waiter'
import { useWorktreeSession } from '../hooks/use-worktree-session'
import { locale } from '../locales'
import { waitForInputActions, waitForSessionListed } from '../service/session-switch'
import { attach, create } from '../service/worktree'
import { store } from '../store'
import { addDraftAttachments, canAddDraftAttachments, draftAttachmentIds, interceptsSubmit, removeDraftAttachment, resolveAccessModeGroup, showsModeSelect } from './mode-select.utils'

export function WorktreeModeSelect(props: ModeSelectProps): ReactElement {
  const { sessionId } = props
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [portalHost, setPortalHost] = useState<HTMLSpanElement | null>(null)

  // keep:effect composer 锚点由组件 ref 决定，DOM 重排观察无法上提到 register
  useEffect(() => {
    const anchor = anchorRef.current
    const composerSeat = anchor?.closest<HTMLElement>(COMPOSER_SEAT_SELECTOR)
    if (!composerSeat)
      return

    let host: HTMLSpanElement | null = null
    const place = (): void => {
      const modeButton = composerSeat.querySelector<HTMLElement>(COMPOSER_MODE_BUTTON_SELECTOR)
      let target: HTMLElement | null = null
      if (modeButton) {
        const planSlot = composerSeat.querySelector<HTMLElement>(COMPOSER_PLAN_SLOT_SELECTOR)
        target = resolveAccessModeGroup(modeButton, planSlot)
      }
      target ??= composerSeat.querySelector<HTMLElement>(HERO_PRESET_SLOT_SELECTOR)
      if (!target) {
        setPortalHost(null)
        host?.remove()
        host = null
        return
      }
      if (!host) {
        host = document.createElement('span')
        host.dataset.dshTauriWorktreeMode = sessionId
        host.className = 'dshp-mode-select__host'
      }
      if (target.nextElementSibling !== host)
        target.after(host)
      setPortalHost(host)
    }

    place()
    const observer = new MutationObserver(place)
    observer.observe(composerSeat, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      host?.remove()
    }
  }, [sessionId])

  return (
    <>
      <span ref={anchorRef} className="dshp-mode-select__anchor" {...{ [MODE_ANCHOR_ATTRIBUTE]: sessionId }} />
      {portalHost && createPortal(<WorktreeModeControl {...props} />, portalHost)}
    </>
  )
}

function WorktreeModeControl({ sessionId, useInput, inputActions, sessionsRuntime, workspacesRuntime }: ModeSelectProps): ReactElement | null {
  const state = useWorktreeSession(sessionId)
  const draft = useInput(input => input.draft)
  const imageIds = useInput(draftAttachmentIds)
  const { wait } = useWaiter()
  locale.useLocale()
  const [open, setOpen] = useState(false)
  const submittingRef = useRef(false)

  // keep:effect 发送拦截依赖官方 composer 私有 DOM，没有 pre-submit 钩子可用
  useEffect(() => {
    if (!interceptsSubmit({ isGit: state.isGit, mode: state.mode }))
      return
    const root = document.querySelector<HTMLElement>(`[${MODE_ANCHOR_ATTRIBUTE}="${CSS.escape(sessionId)}"]`)
    const composerSeat = root?.closest<HTMLElement>(COMPOSER_SEAT_SELECTOR)
    if (!composerSeat)
      return

    const start = async (): Promise<void> => {
      if (submittingRef.current || draft.trim() === '')
        return
      submittingRef.current = true
      const targetSessionId = `session-${crypto.randomUUID()}`
      store.worktree.patch(sessionId, { mode: 'pending', phase: 'creating', loadingLabel: locale.text('progressCreating'), error: '' })
      let switched = false
      let detached = false
      let nextActions: InputActions | undefined
      try {
        const created = await create({ sessionId: targetSessionId, sourceSessionId: sessionId, inherit: true })
        if (!created.ok || !created.result)
          throw new Error(created.error ?? 'Failed to create worktree.')
        const result = created.result
        const worktreePath = result.worktreePath
        if (!worktreePath)
          throw new Error('Failed to create worktree.')
        if (result.inherited) {
          await waitForSessionListed({ sessions: sessionsRuntime, sessionId: targetSessionId, wait })
        }
        else {
          await sessionsRuntime.create({ cwd: worktreePath, sessionId: targetSessionId })
        }
        await attach({ sessionId: targetSessionId })
        // 目标输入面只在切换后才物化，而源附件一旦摘除、源作用域随切换销毁就再也回不去：
        // 先用源输入面探测该核心的附件面是否可写，不可写就整体中止（此时草稿与附件都还没动）。
        if (imageIds.length > 0 && !canAddDraftAttachments(inputActions))
          throw new Error('无法迁移消息附件到工作树会话')
        // 0.1.6 起会话输入面只在被保留的会话上物化：先切换（切换即保留主视图）再取目标输入面。
        // 源会话的草稿与附件必须先摘除——源作用域随切换销毁，会把仍挂在其草稿上的附件从注册表释放。
        inputActions.setDraft('')
        forEach(imageIds, imageId => removeDraftAttachment(inputActions, imageId))
        detached = true
        sessionsRuntime.open(targetSessionId)
        switched = true
        const actions = await waitForInputActions({ sessions: sessionsRuntime, sessionId: targetSessionId, wait })
        nextActions = actions
        actions.setDraft(draft)
        if (!addDraftAttachments(actions, imageIds))
          throw new Error('无法迁移消息附件到工作树会话')
        store.worktree.patch(sessionId, { mode: 'local', phase: 'idle', loadingLabel: '' })
        queueMicrotask(() => {
          try {
            actions.submit()
          }
          finally {
            actions.setDraft('')
            forEach(imageIds, imageId => removeDraftAttachment(actions, imageId))
          }
        })
        if (result.inherited)
          await workspacesRuntime.archiveSession(sessionId).catch(() => {})
      }
      catch (error) {
        const message = get(error, 'message', String(error))
        // 切换前的失败源会话仍在：把已摘除的草稿与附件放回即可。
        // 切换后的失败无法就地恢复：切回源会话，用它重新物化的输入面放回内容，避免用户丢内容。
        let restored = !switched
        if (detached && switched) {
          nextActions?.setDraft('')
          try {
            sessionsRuntime.open(sessionId)
            const sourceActions = await waitForInputActions({ sessions: sessionsRuntime, sessionId, wait })
            sourceActions.setDraft(draft)
            addDraftAttachments(sourceActions, imageIds)
            restored = true
          }
          catch {
            restored = false
          }
        }
        else if (detached) {
          inputActions.setDraft(draft)
          addDraftAttachments(inputActions, imageIds)
        }
        // 失败必须退回 local：停在 pending 会让拦截器一直吞掉发送事件，会话彻底不可用。
        store.worktree.patch(sessionId, {
          mode: 'local',
          phase: 'error',
          loadingLabel: '',
          error: message,
        })
        // 没能切回源会话时源提示条不再渲染：错误同步到当前会话，避免静默失败。
        if (!restored) {
          store.worktree.patch(targetSessionId, {
            mode: 'local',
            phase: 'error',
            loadingLabel: '',
            error: message,
          })
        }
      }
      finally {
        submittingRef.current = false
      }
    }

    const intercept = (event: Event): void => {
      const target = event.target
      if (!(target instanceof Node) || !composerSeat.contains(target))
        return
      if (event instanceof MouseEvent) {
        const button = target instanceof Element ? target.closest('button[aria-label]') : null
        if (button?.getAttribute('aria-label')?.includes('发送') !== true && button?.getAttribute('aria-label')?.toLowerCase().includes('send') !== true)
          return
      }
      if (event instanceof KeyboardEvent && (event.key !== 'Enter' || event.shiftKey || event.isComposing))
        return
      // 没有草稿就没什么可接管的，放行；吞掉事件却什么都不做，等价于把发送键焊死。
      if (draft.trim() === '')
        return
      event.preventDefault()
      event.stopImmediatePropagation()
      void start()
    }

    composerSeat.addEventListener('click', intercept, true)
    composerSeat.addEventListener('keydown', intercept, true)
    return () => {
      composerSeat.removeEventListener('click', intercept, true)
      composerSeat.removeEventListener('keydown', intercept, true)
    }
  }, [draft, imageIds, inputActions, sessionId, sessionsRuntime, state.isGit, state.mode, wait, workspacesRuntime])

  if (!showsModeSelect(state))
    return null

  const pending = state.mode === 'pending'
  const activeLabel = pending ? locale.text('modeNewWorktree') : locale.text('modeLocal')
  const trigger = (
    <Chip
      variant="composerTrigger"
      aria-label={locale.text('modeLabel')}
      aria-haspopup="menu"
      aria-expanded={open}
      open={open}
      icon={<Icon as={CircleTree} size={14} />}
      chevron={<Icon as={ChevronDown} />}
      onClick={() => setOpen(value => !value)}
    >
      <span className="dshp-mode-select__label">{activeLabel}</span>
    </Chip>
  )

  return (
    <Menu
      open={open}
      onClose={() => setOpen(false)}
      items={[
        { id: 'local', label: locale.text('modeLocal') },
        { id: 'pending', label: locale.text('modeWorktree') },
      ]}
      selectedId={pending ? 'pending' : 'local'}
      onSelect={(id) => {
        setOpen(false)
        const mode = id === 'pending' ? 'pending' : 'local'
        store.worktree.patch(sessionId, {
          mode,
          phase: 'idle',
          loadingLabel: '',
          error: '',
        })
      }}
      side="top"
      align="start"
      portal
      anchor={trigger}
    />
  )
}
