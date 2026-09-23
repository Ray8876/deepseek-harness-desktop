import type { ReactNode } from 'react'
import type { Translate } from './types'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AutoConfigAllButton } from './auto-config-all-button'
import { ModelConfigToolbar } from './model-config-toolbar'
import { ModelFetchConfigButton } from './model-fetch-config-button'
import { MODEL_EXTRAS_KEYS } from './translate'

const mocks = vi.hoisted(() => ({
  dicts: undefined as { zh: Record<string, string>, en: Record<string, string> } | undefined,
  ofetch: vi.fn(),
}))

vi.mock('dsh-tauri/client', () => ({
  ofetch: mocks.ofetch,
  defineLocale: (_namespace: string, dicts: { zh: Record<string, string>, en: Record<string, string> }) => {
    mocks.dicts = dicts
    return {
      NS: _namespace,
      text: (key: string) => dicts.zh[key] ?? key,
      activeLocale: () => 'zh',
      isEnglishLocale: () => false,
      useLocale: () => 'zh',
      registerLocale: () => () => {},
    }
  },
}))

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Menu: ({ anchor, open }: { anchor?: ReactNode, open?: boolean }) => (
    <>
      {anchor}
      {open === true ? null : null}
    </>
  ),
  Modal: ({ open, title, children }: { open?: boolean, title?: ReactNode, children?: ReactNode }) =>
    open === true ? <div role="dialog" aria-label={typeof title === 'string' ? title : undefined}>{children}</div> : null,
  Button: ({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) => <button type="button" {...rest}>{children}</button>,
}))

const t: Translate = (key, params) => {
  const dict: Record<string, string> = {
    textEditor: 'Text editor',
    openConfigFile: 'Open config file',
    autoConfigureModels: 'Configure all models',
    autoConfigureModelsHint: 'Fill in limits',
    fetchModelConfig: 'Fetch config',
    fetchModelConfigHint: 'Fill in this model',
    fetchingConfig: 'Fetching…',
  }
  const template = dict[key] ?? key
  if (params === undefined)
    return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => name in params ? String(params[name]) : match)
}

describe('mODEL_EXTRAS_KEYS', () => {
  it('names only keys the dsh-tauri-ui dictionary actually carries, in both languages', async () => {
    await import('../../locales')
    const dicts = mocks.dicts
    if (dicts === undefined)
      throw new Error('the locale dictionary was never declared')
    expect(MODEL_EXTRAS_KEYS.length).toBeGreaterThan(0)
    for (const key of MODEL_EXTRAS_KEYS) {
      expect(dicts.zh[key], `zh:${key}`).toBeTypeOf('string')
      expect(dicts.en[key], `en:${key}`).toBeTypeOf('string')
    }
  })

  it('keeps the zh and en key sets identical', async () => {
    await import('../../locales')
    const dicts = mocks.dicts
    if (dicts === undefined)
      throw new Error('the locale dictionary was never declared')
    expect(Object.keys(dicts.en).sort()).toEqual(Object.keys(dicts.zh).sort())
  })
})

describe('modelFetchConfigButton', () => {
  it('renders the fetch action for a row that carries no configuration yet', () => {
    const html = renderToStaticMarkup(
      <ModelFetchConfigButton
        t={t}
        modelId="gpt-4o"
        models={[{ id: 'gpt-4o', name: 'GPT-4o' }]}
        probe={{ settingsNs: 'llm-pi-ai', profilePath: ['providers', 'acme'] }}
      />,
    )
    expect(html).toContain('Fetch config')
    expect(html).toContain('Fill in this model')
  })

  it('renders nothing once the row already declares a capability', () => {
    const html = renderToStaticMarkup(
      <ModelFetchConfigButton
        t={t}
        modelId="gpt-4o"
        models={[{ id: 'gpt-4o', contextWindow: 128000 }]}
        probe={{ settingsNs: 'llm-pi-ai', profilePath: [] }}
      />,
    )
    expect(html).toBe('')
  })

  it('honours the disabled prop', () => {
    const html = renderToStaticMarkup(
      <ModelFetchConfigButton
        t={t}
        modelId="m"
        models={[{ id: 'm' }]}
        probe={{ settingsNs: 'ns', profilePath: [] }}
        disabled
      />,
    )
    expect(html).toContain('disabled=""')
  })
})

describe('autoConfigAllButton', () => {
  it('locks itself while the draft carries no model', () => {
    const html = renderToStaticMarkup(
      <AutoConfigAllButton t={t} models={[]} probe={{ settingsNs: 'ns', profilePath: [] }} />,
    )
    expect(html).toContain('Configure all models')
    expect(html).toContain('disabled=""')
  })

  it('stays available once the draft lists a model', () => {
    const html = renderToStaticMarkup(
      <AutoConfigAllButton t={t} models={[{ id: 'm' }]} probe={{ settingsNs: 'ns', profilePath: [] }} />,
    )
    expect(html).not.toContain('disabled')
  })
})

describe('modelConfigToolbar', () => {
  it('renders the editor trigger and the open-config action', () => {
    const html = renderToStaticMarkup(
      <ModelConfigToolbar t={t} onOpenConfig={vi.fn()} editor={{ editor: 'system', command: '' }} />,
    )
    expect(html).toContain('Text editor')
    expect(html).toContain('Open config file')
    expect(html).toContain('dshp-model-config-toolbar__trigger')
  })

  it('omits the open-config action when the caller owns it elsewhere', () => {
    const html = renderToStaticMarkup(
      <ModelConfigToolbar t={t} editor={{ editor: 'vscode', command: '' }} />,
    )
    expect(html).not.toContain('Open config file')
  })
})
