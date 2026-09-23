import type { ReactElement } from 'react'
import type { SurfaceBarProps } from './surface.types'
import { ArrowRightFromSquare, CircleTree, GoalBar, GoalBarAction, Icon, TerminalLine, TrashBin, Xmark } from 'dsh-tauri-ui/client'
import { useState } from 'react'
import { useWorktreeSession } from '../hooks/use-worktree-session'
import { locale } from '../locales'
import { store } from '../store'

export function WorktreeSurface({ sessionId }: SurfaceBarProps): ReactElement | null {
  locale.useLocale()
  const state = useWorktreeSession(sessionId)
  const [logOpen, setLogOpen] = useState(false)

  if (state.phase === 'idle' || (state.mode === 'local' && state.phase !== 'error'))
    return null

  const creating = state.phase === 'creating'
  const deleting = state.phase === 'deleting'
  const failed = state.phase === 'error'
  const bound = state.mode === 'worktree'
  const label = creating
    ? state.loadingLabel || locale.text('progressCreating')
    : deleting
      ? locale.text('progressDeleting')
      : failed
        ? locale.text('progressError')
        : locale.text('surfaceWorktree')

  return (
    <div className="dshp-worktree">
      <div className="dshp-worktree__surface">
        <GoalBar
          actions={(
            <>
              {bound && !deleting && (
                <>
                  <GoalBarAction
                    aria-label={locale.text('surfaceCheckout')}
                    iconOnly
                    onClick={() => store.worktree.patch(sessionId, { checkoutOpen: true, error: '' })}
                    title={locale.text('surfaceCheckout')}
                  >
                    <Icon as={ArrowRightFromSquare} size={14} />
                  </GoalBarAction>
                  <GoalBarAction
                    aria-label={locale.text('surfaceAbandon')}
                    iconOnly
                    onClick={() => store.worktree.patch(sessionId, { abandonOpen: true })}
                    title={locale.text('surfaceAbandon')}
                  >
                    <Icon as={TrashBin} size={14} />
                  </GoalBarAction>
                </>
              )}
              {failed && !bound && (
                <GoalBarAction
                  aria-label={locale.text('surfaceDismiss')}
                  iconOnly
                  onClick={() => store.worktree.patch(sessionId, { phase: 'idle', error: '' })}
                  title={locale.text('surfaceDismiss')}
                >
                  <Icon as={Xmark} size={14} />
                </GoalBarAction>
              )}
            </>
          )}
          data-dsh-worktree-surface={sessionId}
          error={failed ? state.error : undefined}
          glyph={<Icon as={CircleTree} size={14} />}
          label={`${label}${creating ? '...' : ''}`}
        >
          {bound && state.log.length > 0 && (
            <GoalBarAction
              aria-label={locale.text('progressViewLogs')}
              iconOnly
              onClick={() => setLogOpen(value => !value)}
              title={locale.text('progressViewLogs')}
            >
              <Icon as={TerminalLine} size={14} />
            </GoalBarAction>
          )}
        </GoalBar>
        <Logs log={state.log} open={logOpen} />
      </div>
    </div>
  )
}

export function Logs({ log, open }: { log: readonly string[], open: boolean }): ReactElement {
  return (
    <div
      aria-hidden={!open}
      className={`${'dshp-worktree__logs'} ${open ? 'dshp-worktree__logs--open' : ''}`}
    >
      <div className="dshp-worktree__logs-inner">
        <div className="dshp-worktree__logs-panel">
          {log.map((line, index) => <div key={`${index}:${line}`} className="dshp-worktree__log-line">{line}</div>)}
        </div>
      </div>
    </div>
  )
}
