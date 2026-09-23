import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { ModelConfigToolbarProps } from './model-config-toolbar.types'
import { Button, Menu, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState } from 'react'
import { ChevronDown } from '../../components/icons'
import { useMountStyle } from '../../hooks/use-mount-style'
import { loadEditor, saveEditor } from '../../service/editor'
import { withDetail } from '../../service/model-config.utils'
import { configEditorStyle, MODEL_CONFIG_TOOLBAR_STYLE_ID } from './config-editor.cssr'
import modelExtrasStyle, { MODEL_EXTRAS_STYLE_ID } from './model-extras.cssr'

const SEPARATOR: MenuEntry = { id: 'separator', type: 'separator' }

export function ModelConfigToolbar({
  t,
  editor,
  onEditorChange,
  onOpenConfig,
  openConfigLabel,
  openConfigHint,
  disabled,
}: ModelConfigToolbarProps): ReactElement {
  useMountStyle(modelExtrasStyle, MODEL_EXTRAS_STYLE_ID)
  useMountStyle(configEditorStyle, MODEL_CONFIG_TOOLBAR_STYLE_ID)
  const [menuOpen, setMenuOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [loaded, setLoaded] = useState(editor)
  const [command, setCommand] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string>()
  const current = editor ?? loaded
  const locked = disabled === true || busy

  const items: MenuEntry[] = [
    { id: 'system', label: t('editorSystem'), icon: <span className="dshp-model-config-toolbar__icon dshp-model-config-toolbar__icon--system" aria-hidden="true" /> },
    { id: 'vscode', label: t('editorVSCode'), icon: <span className="dshp-model-config-toolbar__icon dshp-model-config-toolbar__icon--vscode" aria-hidden="true" /> },
    { id: 'cursor', label: t('editorCursor'), icon: <span className="dshp-model-config-toolbar__icon dshp-model-config-toolbar__icon--cursor" aria-hidden="true" /> },
    SEPARATOR,
    { id: 'custom', label: t('editorCustom'), icon: <span className="dshp-model-config-toolbar__icon dshp-model-config-toolbar__icon--custom" aria-hidden="true" /> },
  ]

  async function openMenu(): Promise<void> {
    if (locked)
      return
    if (menuOpen) {
      setMenuOpen(false)
      return
    }
    if (current !== undefined) {
      setMenuOpen(true)
      return
    }
    setBusy(true)
    setFailure(undefined)
    try {
      setLoaded(await loadEditor())
      setMenuOpen(true)
    }
    catch (error) {
      setFailure(withDetail(t('editorLoadFailed'), String(error)))
    }
    finally {
      setBusy(false)
    }
  }

  function closeDialog(): void {
    if (busy)
      return
    setCustomOpen(false)
    setFailure(undefined)
  }

  async function save(next: NonNullable<typeof current>): Promise<void> {
    if (busy)
      return
    setBusy(true)
    setFailure(undefined)
    const result = await saveEditor(next)
    setBusy(false)
    if (result.ok) {
      if (editor === undefined)
        setLoaded(next)
      onEditorChange?.(next)
      setCustomOpen(false)
    }
    else {
      setFailure(withDetail(t('editorSaveFailed'), result.error ?? ''))
    }
  }

  function selectEditor(id: string): void {
    if (current === undefined || busy)
      return
    setMenuOpen(false)
    if (id === 'custom') {
      setCommand(current.command)
      setCustomOpen(true)
      return
    }
    if (id === 'vscode' || id === 'cursor' || id === 'system')
      void save({ ...current, editor: id })
  }

  return (
    <div className="dshp-model-extras__row">
      <Menu
        open={menuOpen}
        align="end"
        autoFocus
        items={items}
        selectedId={current?.editor}
        onSelect={selectEditor}
        onClose={() => setMenuOpen(false)}
        anchor={(
          <button
            type="button"
            className="dshp-model-extras__link dshp-model-config-toolbar__trigger"
            onClick={() => { void openMenu() }}
            disabled={locked}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-busy={busy}
          >
            {t('textEditor')}
            <ChevronDown aria-hidden="true" />
          </button>
        )}
      />
      {onOpenConfig === undefined
        ? null
        : (
            <button
              type="button"
              className="dshp-model-extras__link"
              disabled={locked}
              title={openConfigHint}
              onClick={onOpenConfig}
            >
              {openConfigLabel ?? t('openConfigFile')}
            </button>
          )}
      <Modal
        open={customOpen || failure !== undefined}
        onClose={closeDialog}
        title={customOpen ? t('editorCustom') : t('textEditor')}
        closeLabel={t('close')}
        description={t('textEditorHint')}
        footer={(
          <>
            <Button variant="outline" disabled={busy} onClick={closeDialog}>{customOpen ? t('cancel') : t('close')}</Button>
            {customOpen
              ? (
                  <Button disabled={busy || !command.trim()} onClick={() => { void save({ editor: 'custom', command: command.trim() }) }}>
                    {t('apply')}
                  </Button>
                )
              : null}
          </>
        )}
      >
        <div className="dshp-model-extras__dialog-field">
          {customOpen
            ? (
                <label className="dshp-model-extras__dialog-field">
                  <span className="dshp-model-extras__dialog-label">{t('editorCommand')}</span>
                  <input
                    className="dshp-model-extras__input"
                    value={command}
                    disabled={busy}
                    placeholder={t('editorCommandPlaceholder')}
                    onChange={event => setCommand(event.target.value)}
                  />
                  <span className="dshp-model-extras__dialog-hint">{t('editorCommandHint')}</span>
                </label>
              )
            : null}
          {failure === undefined ? null : <p className="dshp-model-extras__dialog-error" role="alert">{failure}</p>}
        </div>
      </Modal>
    </div>
  )
}
