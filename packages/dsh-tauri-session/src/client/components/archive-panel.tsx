import type { MenuEntry } from 'dsh-tauri-ui/client'
import type { ReactElement } from 'react'
import type { ArchiveSort } from '../store/modules/archive.types'
import type { ArchivePanelProps, DeleteConfirm } from './archive-panel.types'
import { Button, ChevronDown, Chip, Ellipsis, FolderOpen, Icon, IconButton, Input, Magnifier, Menu, Modal, Toast, TrashBin, useMountStyle } from 'dsh-tauri-ui/client'
import { isEmpty, useWatchImmediate } from 'dsh-tauri/client'
import { useCallback, useState } from 'react'
import { SESSION_STYLE_ID } from '../constants'
import { useArchiveView } from '../hooks/use-archive-view'
import { locale } from '../locales'
import {
  clearArchive,
  deleteSession,
  deleteWorkspaceSessions,
  fetchArchive,
  openSessionDir,
  unarchiveSession,
} from '../service/archive'
import { store } from '../store'
import archivePanelStyle from './archive-panel.layout'
import { formatTime, projectOptions } from './archive-panel.utils'

/** 设置页「归档」分区：已归档的聊天列表（搜索 / 排序 / 项目筛选 / 取消归档 / 彻底删除）。 */
export function ArchivePanel(props: ArchivePanelProps): ReactElement | null {
  useMountStyle(archivePanelStyle, SESSION_STYLE_ID)
  const { ui, rows, visible, groups, busy } = useArchiveView(props)
  locale.useLocale()
  const [confirm, setConfirm] = useState<DeleteConfirm>(null)
  const [openGroupMenu, setOpenGroupMenu] = useState<string | null>(null)
  const [openPathError, setOpenPathError] = useState<string | null>(null)
  const [openSort, setOpenSort] = useState(false)
  const [openProjectFilter, setOpenProjectFilter] = useState(false)

  // 进入分区或宿主归档集合规模变化时刷新归档载荷（meta：createdAt/cwd）。
  useWatchImmediate((props.workspacesRuntime.list.getSnapshot().archivedSessionIds ?? []).length, () => {
    void fetchArchive()
  })

  // 变更走宿主注册表内部状态机，不产生官方 changed frame；成功后手动重拉镜像。
  const resync = useCallback(async () => {
    await props.workspacesRuntime.manager?.refresh?.()
    await props.sessionsRuntime.refresh?.()
  }, [props.workspacesRuntime, props.sessionsRuntime])

  function handleConfirmDelete(): void {
    const active = confirm
    setConfirm(null)
    if (active?.kind === 'single')
      void deleteSession({ sessionId: active.sessionId, resync })
    else if (active?.kind === 'all')
      void clearArchive({ resync })
    else if (active?.kind === 'workspace')
      void deleteWorkspaceSessions({ sessionIds: active.sessionIds, resync })
  }

  async function handleOpenSessionDirectory(sessionId: string): Promise<void> {
    const result = await openSessionDir({ sessionId })
    setOpenPathError(result.ok ? null : result.error ?? '')
  }

  const sortOptions = [
    { id: 'updatedAt', label: locale.text('sortUpdatedAt') },
    { id: 'createdAt', label: locale.text('sortCreatedAt') },
    { id: 'title', label: locale.text('sortTitle') },
  ]
  const projectFilterOptions = [
    { id: 'all', label: locale.text('allProjects') },
    ...projectOptions(rows),
    ...(rows.some(row => !row.workspaceId) ? [{ id: 'ungrouped', label: locale.text('ungrouped') }] : []),
  ]

  const footer = (
    <>
      <Button variant="ghost" onClick={() => setConfirm(null)}>{locale.text('cancel')}</Button>
      <Button
        variant="danger"
        disabled={ui.pending}
        onClick={handleConfirmDelete}
      >
        {locale.text('deleteConfirm')}
      </Button>
    </>
  )

  return (
    <div className="dshp-session__page">
      <div className="dshp-session__header">
        <h1 className="dshp-session__title">{locale.text('archiveTitle')}</h1>
        <Button
          type="button"
          variant="danger"
          icon={<Icon as={TrashBin} />}
          disabled={busy}
          onClick={() => setConfirm({ kind: 'all' })}
        >
          {locale.text('deleteAll')}
        </Button>
      </div>

      <div className="dshp-session__toolbar">
        <Input
          className="dshp-session__search"
          value={ui.query}
          placeholder={locale.text('searchPlaceholder')}
          aria-label={locale.text('searchPlaceholder')}
          icon={<Icon as={Magnifier} />}
          onChange={event => store.archive.setQuery(event.target.value)}
        />
        <Menu
          open={openSort}
          onClose={() => setOpenSort(false)}
          onSelect={(id) => {
            setOpenSort(false)
            store.archive.setSort(id as ArchiveSort)
          }}
          items={sortOptions}
          selectedId={ui.sort}
          portal
          align="end"
          anchor={(
            <Chip
              variant="selector"
              className="dshp-session__menu-select"
              aria-label={locale.text('sortLabel')}
              aria-haspopup="menu"
              open={openSort}
              aria-expanded={openSort}
              onClick={() => setOpenSort(openState => !openState)}
              chevron={<Icon as={ChevronDown} />}
            >
              <span className="dshp-session__menu-select-label">
                {sortOptions.find(option => option.id === ui.sort)?.label ?? ui.sort}
              </span>
            </Chip>
          )}
        />
        <Menu
          open={openProjectFilter}
          onClose={() => setOpenProjectFilter(false)}
          onSelect={(id) => {
            setOpenProjectFilter(false)
            store.archive.setWorkspaceFilter(id)
          }}
          items={projectFilterOptions}
          selectedId={ui.workspaceId}
          portal
          align="end"
          anchor={(
            <Chip
              variant="selector"
              className="dshp-session__menu-select"
              aria-label={locale.text('allProjects')}
              aria-haspopup="menu"
              open={openProjectFilter}
              aria-expanded={openProjectFilter}
              onClick={() => setOpenProjectFilter(openState => !openState)}
              chevron={<Icon as={ChevronDown} />}
            >
              <span className="dshp-session__menu-select-label">
                {projectFilterOptions.find(option => option.id === ui.workspaceId)?.label ?? ui.workspaceId}
              </span>
            </Chip>
          )}
        />
      </div>

      {ui.error && <div className="dshp-session__error">{ui.error}</div>}

      {!ui.loading && isEmpty(visible) && (
        <div className="dshp-session__empty">{ui.query ? locale.text('noResults') : locale.text('empty')}</div>
      )}

      <div className="dshp-session__groups">
        {groups.map(group => (
          <section key={group.id} className="dshp-session__group">
            <div className="dshp-session__group-header">
              <Icon as={FolderOpen} />
              <span className="dshp-session__group-title">{group.title || locale.text('ungrouped')}</span>
              <span className="dshp-session__group-count">
                {group.rows.length}
                {' '}
                {locale.text('chats')}
              </span>
              <Menu
                open={openGroupMenu === group.id}
                onClose={() => setOpenGroupMenu(null)}
                onSelect={(id) => {
                  setOpenGroupMenu(null)
                  if (id === 'delete') {
                    setConfirm({
                      kind: 'workspace',
                      workspaceTitle: group.title || locale.text('ungrouped'),
                      sessionIds: rows.filter(row => group.id === 'ungrouped' ? !row.workspaceId : row.workspaceId === group.id).map(row => row.sessionId),
                    })
                  }
                }}
                items={[{
                  id: 'delete',
                  label: locale.text('deleteProjectChats'),
                  icon: <Icon as={TrashBin} />,
                  danger: true,
                } satisfies MenuEntry]}
                portal
                align="end"
                anchor={(
                  <IconButton
                    variant="action"
                    icon={<Icon size={12} as={Ellipsis} />}
                    aria-label={locale.text('groupMenuAria')}
                    aria-haspopup="menu"
                    aria-expanded={openGroupMenu === group.id}
                    onClick={() => setOpenGroupMenu(openGroupMenu === group.id ? null : group.id)}
                  />
                )}
              />
            </div>
            <ul className="dshp-session__list">
              {group.rows.map(row => (
                <li key={row.sessionId} className="dshp-session__row">
                  <div className="dshp-session__row-main">
                    <div>
                      <button
                        type="button"
                        className="dshp-session__row-title"
                        title={locale.text('openDirectory')}
                        aria-label={`${locale.text('openDirectory')}: ${row.title}`}
                        onClick={() => void handleOpenSessionDirectory(row.sessionId)}
                      >
                        {row.title}
                      </button>
                    </div>
                    <span className="dshp-session__row-time">{formatTime(row)}</span>
                  </div>
                  <div className="dshp-session__row-actions">
                    <IconButton
                      variant="action"
                      icon={<Icon as={TrashBin} />}
                      aria-label={locale.text('deleteRowAria')}
                      disabled={busy}
                      onClick={() => setConfirm({ kind: 'single', sessionId: row.sessionId })}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void unarchiveSession({ sessionId: row.sessionId, resync })}
                    >
                      {locale.text('unarchive')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Modal
        open={confirm?.kind === 'single'}
        onClose={() => setConfirm(null)}
        title={locale.text('deleteSingleTitle')}
        description={locale.text('deleteSingleBody')}
        footer={footer}
        closeLabel={locale.text('close')}
      />
      <Modal
        open={confirm?.kind === 'all'}
        onClose={() => setConfirm(null)}
        title={locale.text('deleteAllTitle')}
        description={locale.text('deleteAllBody')}
        footer={footer}
        closeLabel={locale.text('close')}
      />
      <Modal
        open={confirm?.kind === 'workspace'}
        onClose={() => setConfirm(null)}
        title={locale.text('deleteProjectTitle')}
        description={confirm?.kind === 'workspace' ? locale.text('deleteProjectBody', { count: confirm.sessionIds.length, workspace: confirm.workspaceTitle }) : ''}
        footer={footer}
        closeLabel={locale.text('close')}
      />

      {openPathError
        ? (
            <Toast
              key={openPathError}
              text={locale.text('openFailed', { reason: openPathError })}
              onDone={() => setOpenPathError(null)}
            />
          )
        : null}
    </div>
  )
}
