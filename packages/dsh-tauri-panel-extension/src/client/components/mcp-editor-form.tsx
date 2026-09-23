import type { ReactElement } from 'react'
import type { Translate } from '../locales/index.types'
import type { McpEditorMode, McpEditorState } from './mcp-tab.types'
import { Button, ChevronDown, Chip, Icon, Input, Menu, SegmentedControl } from 'dsh-tauri-ui/client'
import { useId, useState } from 'react'

export interface McpEditorFormProps {
  t: Translate
  editor: McpEditorState
  mode: McpEditorMode
  busy: boolean
  pasteJson: string
  pasteError: string | null
  formError: string | null
  onModeChange: (mode: McpEditorMode) => void
  onEditorChange: (patch: Partial<McpEditorState>) => void
  onPasteJsonChange: (value: string) => void
  onPasteFill: () => void
  onCancel: () => void
  onSave: () => void
}

export function McpEditorForm(props: McpEditorFormProps): ReactElement {
  const { t, editor, mode, busy, pasteJson, pasteError, formError, onModeChange, onEditorChange, onPasteJsonChange, onPasteFill, onCancel, onSave } = props
  const tabsId = useId()
  const [transportOpen, setTransportOpen] = useState(false)
  const transportOptions = [
    { id: 'stdio', label: t('transportStdio') },
    { id: 'streamable-http', label: t('transportHttp') },
  ]
  return (
    <div className="dshp-extension__form">
      <SegmentedControl
        id={tabsId}
        label={t('addServer')}
        value={mode}
        options={[
          { value: 'json', label: t('editorJsonTab') },
          { value: 'form', label: t('editorFormTab') },
        ]}
        onChange={next => onModeChange(next as McpEditorMode)}
      />
      {mode === 'json'
        ? (
            <div id={`${tabsId}-json-panel`} className="dshp-extension__form" role="tabpanel" aria-labelledby={`${tabsId}-json`}>
              <label className="dshp-extension__label">
                <span>{t('formatPaste')}</span>
                <textarea
                  className="dshp-extension__textarea dshp-extension__json-editor"
                  placeholder={'{\n  "mcpServers": {\n    "name": { "command": "npx", "args": ["-y", "@example/mcp-server"] }\n  }\n}\n'}
                  value={pasteJson}
                  onChange={event => onPasteJsonChange(event.target.value)}
                />
              </label>
              {pasteError !== null && <p className="dshp-extension__form-error">{pasteError}</p>}
              <div className="dshp-extension__card-row">
                <Button variant="outline" size="sm" disabled={pasteJson.trim() === ''} onClick={onPasteFill}>{t('formatFill')}</Button>
              </div>
            </div>
          )
        : (
            <div id={`${tabsId}-form-panel`} className="dshp-extension__form" role="tabpanel" aria-labelledby={`${tabsId}-form`}>
              <label className="dshp-extension__label">
                <span>{t('serverName')}</span>
                <Input
                  value={editor.serverName}
                  disabled={editor.id !== ''}
                  onChange={event => onEditorChange({ serverName: event.target.value })}
                />
              </label>
              <div className="dshp-extension__label">
                <span>{t('transport')}</span>
                <Menu
                  open={transportOpen}
                  onClose={() => setTransportOpen(false)}
                  onSelect={(id) => {
                    onEditorChange({ transport: id as McpEditorState['transport'] })
                    setTransportOpen(false)
                  }}
                  items={transportOptions}
                  selectedId={editor.transport}
                  portal
                  anchor={(
                    <Chip
                      variant="selector"
                      disabled={editor.id !== ''}
                      aria-label={t('transport')}
                      aria-haspopup="menu"
                      open={transportOpen}
                      aria-expanded={transportOpen}
                      chevron={<Icon as={ChevronDown} />}
                      onClick={() => setTransportOpen(value => !value)}
                    >
                      {transportOptions.find(option => option.id === editor.transport)?.label}
                    </Chip>
                  )}
                />
              </div>
              {editor.transport === 'stdio'
                ? (
                    <>
                      <label className="dshp-extension__label">
                        <span>{t('command')}</span>
                        <Input value={editor.command} onChange={event => onEditorChange({ command: event.target.value })} />
                      </label>
                      <label className="dshp-extension__label">
                        <span>{t('args')}</span>
                        <textarea className="dshp-extension__textarea" data-short="true" value={editor.args} onChange={event => onEditorChange({ args: event.target.value })} />
                      </label>
                      <label className="dshp-extension__label">
                        <span>{t('envPairs')}</span>
                        <textarea className="dshp-extension__textarea" data-short="true" value={editor.env} onChange={event => onEditorChange({ env: event.target.value })} />
                      </label>
                    </>
                  )
                : (
                    <>
                      <label className="dshp-extension__label">
                        <span>{t('url')}</span>
                        <Input value={editor.url} onChange={event => onEditorChange({ url: event.target.value })} />
                      </label>
                      <label className="dshp-extension__label">
                        <span>{t('headersPairs')}</span>
                        <textarea className="dshp-extension__textarea" data-short="true" value={editor.headers} onChange={event => onEditorChange({ headers: event.target.value })} />
                      </label>
                    </>
                  )}
            </div>
          )}
      {formError !== null && <p className="dshp-extension__form-error">{formError}</p>}
      <div className="dshp-extension__card-row">
        <span className="dshp-extension__spacer" />
        <Button variant="ghost" onClick={onCancel}>{t('cancel')}</Button>
        <Button variant="primary" disabled={busy} onClick={onSave}>{t('save')}</Button>
      </div>
    </div>
  )
}
