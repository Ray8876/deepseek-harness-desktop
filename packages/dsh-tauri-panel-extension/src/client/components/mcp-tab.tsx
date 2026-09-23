import type { ReactElement } from 'react'
import type { McpSaveBody } from '../apis/index.type'
import type { McpRow } from '../types'
import type { McpEditorMode, McpEditorState, McpImportItem, McpTabProps } from './mcp-tab.types'
import { ArrowRotateRight, Button, ChevronDown, Chip, Icon, IconButton, Menu, Modal, PlugConnection, StateDot, Tag } from 'dsh-tauri-ui/client'
import { compact } from 'dsh-tauri/client'
import { useEffect, useState } from 'react'
import { deleteMcp, getImportScan, getMcp, postImportApply, postMcp, postMcpCheck, postMcpToggle } from '../apis'
import { MCP_RESTART_INITIAL_DELAY_MS, MCP_RESTART_POLL_INTERVAL_MS, MCP_RESTART_TIMEOUT_MS } from '../constants'
import { useTimers } from '../hooks/use-timers'
import { restartHost } from '../service/restart'
import { isDesktopHost } from '../service/restart.utils'
import { McpEditorForm } from './mcp-editor-form'
import { McpImportDialog } from './mcp-import-dialog'
import { mapToPairs, parseMcpJson, parsePairs } from './mcp-tab.utils'

export function McpTab({ t }: McpTabProps): ReactElement {
  const [servers, setServers] = useState<McpRow[] | null>(null)
  const [editor, setEditor] = useState<McpEditorState | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importItems, setImportItems] = useState<McpImportItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(false)
  const [restartConfirm, setRestartConfirm] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [outcome, setOutcome] = useState<{ ok: boolean, text: string } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [editorMode, setEditorMode] = useState<McpEditorMode>('json')
  const [pasteJson, setPasteJson] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [scope, setScope] = useState<'all' | 'global' | 'profile'>('all')
  const [scopeOpen, setScopeOpen] = useState(false)
  const [checking, setChecking] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState('')
  const { later } = useTimers()

  useEffect(() => {
    let current = true
    void getMcp().then(
      (body) => {
        if (current) {
          setServers(body.servers)
          setGlobalError(body.globalError ?? '')
        }
      },
      (error: Error) => {
        if (current) {
          setServers([])
          setOutcome({ ok: false, text: `${t('failed')}: ${String(error.message ?? error)}` })
        }
      },
    )
    return () => {
      current = false
    }
  }, [reload, t])

  const openImport = async (): Promise<void> => {
    setImportOpen(true)
    setImportItems(null)
    try {
      const body = await getImportScan()
      const existing = new Set(body.existing)
      setImportItems(body.servers.map(server => ({
        server,
        existing: existing.has(server.name),
        checked: !existing.has(server.name),
      })))
    }
    catch (error) {
      setImportItems([])
      setOutcome({ ok: false, text: `${t('failed')}: ${String(error instanceof Error ? error.message : error)}` })
    }
  }

  const doImport = async (): Promise<void> => {
    if (importItems === null)
      return
    const items = importItems.filter(item => item.checked && !item.existing).map(item => ({ agent: item.server.agent, name: item.server.name }))
    setBusy(true)
    try {
      const body = await postImportApply({ items })
      const failed = body.results.filter(item => !item.ok)
      setOutcome(failed.length === 0
        ? null
        : { ok: false, text: `${t('failed')}: ${failed.map(item => `${item.name} (${item.error})`).join(', ')}` })
      setImportOpen(false)
      setPending(true)
      setReload(value => value + 1)
    }
    catch (error) {
      setOutcome({ ok: false, text: `${t('failed')}: ${String(error instanceof Error ? error.message : error)}` })
    }
    finally {
      setBusy(false)
    }
  }

  const checkConnectivity = async (row: McpRow): Promise<void> => {
    setChecking(row.id)
    try {
      const result = await postMcpCheck({ id: row.id })
      setOutcome({ ok: result.ok, text: result.ok ? `${t('connectivityOk')}${result.detail ? ` (${result.detail})` : ''}` : `${t('connectivityFailed')}: ${result.detail ?? ''}` })
    }
    catch (error) {
      setOutcome({ ok: false, text: `${t('connectivityFailed')}: ${String(error)}` })
    }
    finally { setChecking(null) }
  }

  const reloadList = (showPending: boolean): void => {
    setReload(value => value + 1)
    if (showPending)
      setPending(true)
  }

  const openCreate = (): void => {
    setFormError(null)
    setPasteError(null)
    setPasteJson('')
    setEditorMode('json')
    setEditor({ id: '', serverName: '', transport: 'stdio', command: '', args: '', env: '', url: '', headers: '' })
  }

  const openEdit = (row: McpRow): void => {
    setFormError(null)
    setPasteError(null)
    setPasteJson('')
    setEditorMode('form')
    setEditor({
      id: row.id,
      serverName: row.serverName,
      transport: row.transport,
      command: row.command ?? '',
      args: (row.args ?? []).join('\n'),
      env: mapToPairs(row.env, '='),
      url: row.url ?? '',
      headers: mapToPairs(row.headers, ':'),
    })
  }

  const doPasteFill = (): void => {
    if (editor === null || pasteJson.trim() === '')
      return
    const parsed = parseMcpJson(pasteJson)
    if ('error' in parsed) {
      setPasteError(parsed.error)
      return
    }
    const lockIdentity = editor.id !== ''
    if (lockIdentity && parsed.transport !== editor.transport) {
      setPasteError(t('pasteTransportMismatch'))
      return
    }
    setPasteError(null)
    setFormError(null)
    setEditor({
      ...editor,
      ...(parsed.serverName !== undefined && !lockIdentity ? { serverName: parsed.serverName } : {}),
      ...(!lockIdentity ? { transport: parsed.transport } : {}),
      ...(parsed.transport === 'stdio'
        ? {
            command: parsed.command ?? editor.command,
            args: (parsed.args ?? []).join('\n'),
            env: mapToPairs(parsed.env, '='),
          }
        : {
            url: parsed.url ?? editor.url,
            headers: mapToPairs(parsed.headers, ':'),
          }),
    })
    setEditorMode('form')
  }

  const doSave = async (): Promise<void> => {
    if (editor === null)
      return
    let input: McpSaveBody
    if (editorMode === 'json') {
      const parsed = parseMcpJson(pasteJson)
      if ('error' in parsed) {
        setPasteError(parsed.error)
        return
      }
      input = {
        id: editor.id,
        serverName: parsed.serverName?.trim() ?? '',
        transport: parsed.transport,
        ...(parsed.transport === 'stdio'
          ? { command: parsed.command ?? '', args: parsed.args ?? [], env: parsed.env ?? {} }
          : { url: parsed.url ?? '', headers: parsed.headers ?? {} }),
      }
    }
    else {
      input = {
        id: editor.id,
        serverName: editor.serverName.trim(),
        transport: editor.transport,
        ...(editor.transport === 'stdio'
          ? {
              command: editor.command.trim(),
              args: compact(editor.args.split(/\r?\n/).map(line => line.trim())),
              env: parsePairs(editor.env, '='),
            }
          : {
              url: editor.url.trim(),
              headers: parsePairs(editor.headers, ':'),
            }),
      }
    }
    setBusy(true)
    setFormError(null)
    setPasteError(null)
    try {
      await postMcp(input)
      setEditor(null)
      setOutcome(null)
      reloadList(true)
    }
    catch (error) {
      setFormError(String(error instanceof Error ? error.message : error))
    }
    finally {
      setBusy(false)
    }
  }

  const doToggle = async (row: McpRow): Promise<void> => {
    setBusy(true)
    try {
      await postMcpToggle({ id: row.id, disabled: !row.disabled })
      setOutcome(null)
      reloadList(true)
    }
    catch (error) {
      setOutcome({ ok: false, text: `${t('failed')}: ${String(error instanceof Error ? error.message : error)}` })
    }
    finally {
      setBusy(false)
    }
  }

  const doRemove = async (): Promise<void> => {
    if (confirmId === null)
      return
    setBusy(true)
    try {
      await deleteMcp({ id: confirmId })
      setOutcome(null)
      reloadList(true)
    }
    catch (error) {
      setOutcome({ ok: false, text: `${t('failed')}: ${String(error instanceof Error ? error.message : error)}` })
    }
    finally {
      setBusy(false)
      setConfirmId(null)
    }
  }

  const doRestart = (): void => {
    setRestartConfirm(false)
    setRestarting(true)
    void restartHost()
    if (isDesktopHost())
      return
    const deadline = Date.now() + MCP_RESTART_TIMEOUT_MS
    const poll = (): void => {
      if (Date.now() > deadline)
        return
      later(() => {
        void getMcp().then(
          () => { window.location.reload() },
          () => { poll() },
        )
      }, MCP_RESTART_POLL_INTERVAL_MS)
    }
    later(poll, MCP_RESTART_INITIAL_DELAY_MS)
  }

  const restartBanner = (
    <div className="dshp-extension__banner" data-kind="info" role="status">
      <StateDot state="ongoing" size={10} />
      <div className="dshp-extension__banner-body">
        <span>{restarting ? t('restarting') : t('restartNeeded')}</span>
        <span className="dshp-extension__banner-hint">
          {restarting
            ? (!isDesktopHost() && t('restartPortHint'))
            : isDesktopHost()
              ? (
                  <>
                    {t('restartDesktopHint')}
                    {' '}
                    <Button variant="outline" size="sm" onClick={() => setRestartConfirm(true)}>{t('restartNow')}</Button>
                  </>
                )
              : t('restartOtherHint')}
        </span>
      </div>
    </div>
  )

  const scopeOptions = [
    { id: 'all', label: t('scopeAll') },
    { id: 'global', label: t('global') },
    { id: 'profile', label: t('profile') },
  ]

  return (
    <div className="dshp-extension__section">
      <div className="dshp-extension__head">
        <span className="dshp-extension__head-icon"><Icon as={PlugConnection} size={16} /></span>
        <h3>{t('mcpTitle')}</h3>
        <span className="dshp-extension__spacer" />
        <Button variant="ghost" size="sm" disabled={restarting} onClick={() => setRestartConfirm(true)}>{t('restart')}</Button>
        <Button variant="ghost" size="sm" onClick={() => void openImport()}>{t('importServers')}</Button>
        <Button variant="primary" size="sm" onClick={openCreate}>{t('addServer')}</Button>
      </div>
      <p className="dshp-extension__intro">{t('mcpIntro')}</p>

      {outcome !== null && (
        <div className="dshp-extension__banner" data-kind={outcome.ok ? 'ok' : 'error'} role="status">
          <StateDot state={outcome.ok ? 'done' : 'error'} size={10} />
          <div className="dshp-extension__banner-body"><span>{outcome.text}</span></div>
        </div>
      )}
      {(pending || restarting) && restartBanner}

      <div className="dshp-extension__list-head">
        <h3>{t('mcpTab')}</h3>
        {servers !== null && <span className="dshp-extension__count">{servers.length}</span>}
        <Menu
          open={scopeOpen}
          onClose={() => setScopeOpen(false)}
          onSelect={(id) => {
            setScope(id as typeof scope)
            setScopeOpen(false)
          }}
          items={scopeOptions}
          selectedId={scope}
          portal
          align="end"
          anchor={(
            <Chip
              variant="selector"
              aria-label={t('scope')}
              aria-haspopup="menu"
              open={scopeOpen}
              aria-expanded={scopeOpen}
              chevron={<Icon as={ChevronDown} />}
              onClick={() => setScopeOpen(value => !value)}
            >
              {scopeOptions.find(option => option.id === scope)?.label}
            </Chip>
          )}
        />
        <span className="dshp-extension__spacer" />
        <IconButton variant="toolbar" icon={<Icon as={ArrowRotateRight} />} aria-label={t('view')} title={t('view')} disabled={busy} onClick={() => setReload(value => value + 1)} />
      </div>

      {servers === null && <p className="dshp-extension__empty">{t('loading')}</p>}
      {servers !== null && servers.length === 0 && <p className="dshp-extension__empty">{t('emptyMcp')}</p>}
      {servers !== null && servers.length > 0 && (
        <ul className="dshp-extension__cards">
          {servers.filter(row => scope === 'all' || (row.layer ?? 'profile') === scope).map(row => (
            <li className="dshp-extension__card" key={row.id}>
              <div className="dshp-extension__card-top">
                <strong className="dshp-extension__card-title" title={row.id}>{row.serverName}</strong>
                <Tag tone={(row.scope ?? row.layer) === 'global' ? 'info' : 'neutral'}>{(row.scope ?? row.layer) === 'global' ? t('scopeGlobal') : t('scopeProfile')}</Tag>
                <Tag tone="neutral">{row.transport}</Tag>
                <Tag tone={row.disabled ? 'warning' : 'neutral'}>{row.disabled ? t('disabled') : t('enabled')}</Tag>
              </div>
              <p className="dshp-extension__card-desc">
                {row.transport === 'stdio' ? `${row.command ?? ''} ${(row.args ?? []).join(' ')}` : row.url ?? ''}
              </p>
              {row.shadowed === true && <p className="dshp-extension__form-error">{t('shadowedByGlobal')}</p>}
              {globalError !== '' && <p className="dshp-extension__form-error">{globalError}</p>}
              <div className="dshp-extension__card-row">
                <span className="dshp-extension__spacer" />
                <Button variant="ghost" size="sm" disabled={busy || checking === row.id} onClick={() => void checkConnectivity(row)}>{checking === row.id ? t('checkRunning') : t('checkLabel')}</Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void doToggle(row)}>{t('toggle')}</Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => openEdit(row)}>{t('edit')}</Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmId(row.id)}>{t('delete')}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editor !== null}
        onClose={() => setEditor(null)}
        closeLabel={t('close')}
        title={editor !== null && editor.id !== '' ? t('editServer') : t('addServer')}
        className="dshp-extension dshp-extension__modal-form"
        contentClassName="dshp-extension__modal-scroll"
      >
        {editor !== null && (
          <McpEditorForm
            t={t}
            editor={editor}
            mode={editorMode}
            busy={busy}
            pasteJson={pasteJson}
            pasteError={pasteError}
            formError={formError}
            onModeChange={setEditorMode}
            onEditorChange={patch => setEditor(current => current === null ? current : { ...current, ...patch })}
            onPasteJsonChange={setPasteJson}
            onPasteFill={doPasteFill}
            onCancel={() => setEditor(null)}
            onSave={() => void doSave()}
          />
        )}
      </Modal>

      <Modal
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        closeLabel={t('close')}
        title={t('confirmRemove')}
        description={confirmId ?? undefined}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setConfirmId(null)}>{t('cancel')}</Button>
            <Button variant="primary" disabled={busy} onClick={() => void doRemove()}>{t('delete')}</Button>
          </>
        )}
      >
        <p>{t('removeWarn')}</p>
      </Modal>

      <Modal
        open={restartConfirm}
        onClose={() => setRestartConfirm(false)}
        closeLabel={t('close')}
        title={t('restartConfirmTitle')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setRestartConfirm(false)}>{t('cancel')}</Button>
            <Button variant="primary" onClick={doRestart}>{t('restartNow')}</Button>
          </>
        )}
      >
        <p>{t('restartConfirmBody')}</p>
      </Modal>

      <McpImportDialog
        t={t}
        open={importOpen}
        items={importItems}
        busy={busy}
        formError={formError}
        onClose={() => setImportOpen(false)}
        onToggle={(index, checked) => {
          if (importItems === null)
            return
          const next = importItems.slice()
          next[index] = { ...next[index], checked }
          setImportItems(next)
        }}
        onToggleGroup={(indices, checked) => {
          if (importItems === null)
            return
          const next = importItems.slice()
          for (const index of indices)
            next[index] = { ...next[index], checked }
          setImportItems(next)
        }}
        onImport={() => void doImport()}
      />
    </div>
  )
}
