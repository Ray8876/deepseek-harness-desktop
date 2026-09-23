import type { ReactElement } from 'react'
import type { LocaleKey, Translate } from '../locales/index.types'
import type { RunView } from '../types'
import { Alarm, CircleCheck, CircleDashed, CircleStop, CircleXmark, Dot, Icon, IconButton, TrashBin } from 'dsh-tauri-ui/client'
import { formatLocalTime, isRunUnread } from './schedule.utils'

export interface RunsTabProps {
  t: Translate
  runs: readonly RunView[]
  readAt: number
  readIds: readonly string[]
  emptyLabel: string
  onOpen: (run: RunView) => void
  onDelete: (id: string) => void
}

const STATUS_KEYS: Record<RunView['status'], LocaleKey> = {
  succeeded: 'succeeded',
  failed: 'failed',
  interrupted: 'interrupted',
  skipped: 'skipped',
  cancelled: 'cancelled',
  queued: 'queued',
  running: 'running',
}

const STATUS_ICONS = {
  succeeded: CircleCheck,
  failed: CircleXmark,
  interrupted: CircleXmark,
  cancelled: CircleStop,
  skipped: CircleDashed,
  queued: CircleDashed,
  running: Alarm,
}

export function RunsTab({ t, runs, readAt, readIds, emptyLabel, onOpen, onDelete }: RunsTabProps): ReactElement {
  if (runs.length === 0)
    return <p className="dshp-scheduler__empty">{emptyLabel}</p>
  return (
    <ul className="dshp-scheduler__runs-list">
      {runs.map(run => (
        <li key={run.id} className="dshp-scheduler__card" onClick={() => onOpen(run)}>
          <div style={{ height: 36 }}>
            <span
              className="dshp-scheduler__card-icon"
              data-status={run.status}
              role="img"
              aria-label={t(STATUS_KEYS[run.status])}
              title={t(STATUS_KEYS[run.status])}
            >
              <Icon as={STATUS_ICONS[run.status]} />
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="dshp-scheduler__card-title" title={run.taskName}>
              {run.taskName}
              {isRunUnread(run, readAt, readIds) ? <Dot state="done" /> : null}
            </span>
            <div className="dshp-scheduler__card-meta">
              <span className="dshp-scheduler__card-meta-text">{formatLocalTime(run.startedAt) ?? ''}</span>
            </div>
          </div>
          <IconButton
            variant="action"
            icon={<Icon as={TrashBin} size={12} />}
            aria-label={t('deleteRun')}
            onClick={(event) => {
              event.stopPropagation()
              onDelete(run.id)
            }}
          />
        </li>
      ))}
    </ul>
  )
}
