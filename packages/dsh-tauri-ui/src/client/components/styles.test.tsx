import type { ComponentType, ReactElement, ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import globalStyle from '../styles/global.cssr'
import turnNavigationStyle from '../styles/index.cssr'
import { HeroWorkspace } from '../ui/hero-workspace'
import heroWorkspaceStyle from '../ui/hero-workspace.cssr'
import { AutoConfigAllButton } from '../ui/model-extras/auto-config-all-button'
import { configEditorStyle } from '../ui/model-extras/config-editor.cssr'
import { ModelCompatFields } from '../ui/model-extras/model-compat-fields'
import modelCompatFieldsStyle from '../ui/model-extras/model-compat-fields.cssr'
import { ModelConfigToolbar } from '../ui/model-extras/model-config-toolbar'
import modelExtrasStyle from '../ui/model-extras/model-extras.cssr'
import { ModelFetchConfigButton } from '../ui/model-extras/model-fetch-config-button'
import { SettingsNavIcon } from '../ui/nav-icon'
import navIconStyle from '../ui/nav-icon.cssr'
import { PanelPage } from '../ui/panel-page'
import panelPageStyle from '../ui/panel-page.cssr'
import { SegmentedControl } from '../ui/segmented-control'
import segmentedControlStyle from '../ui/segmented-control.cssr'
import { SettingsSidebar } from '../ui/sidebar'
import sidebarStyle from '../ui/sidebar.cssr'
import { SettingsTrigger } from '../ui/trigger'
import triggerStyle from '../ui/trigger.cssr'
import { Button } from './button'
import buttonStyle from './button.cssr'
import { Checkbox } from './checkbox'
import checkboxStyle from './checkbox.cssr'
import { Chip } from './chip'
import chipStyle from './chip.cssr'
import { Dot } from './dot'
import dotStyle from './dot.cssr'
import { GoalBar, GoalBarAction } from './goal-bar'
import goalBarStyle from './goal-bar.cssr'
import { IconButton } from './icon-button'
import iconButtonStyle from './icon-button.cssr'
import { Tag } from './tag'
import tagStyle from './tag.cssr'

const stores = vi.hoisted(() => ({
  settings: {
    open: false,
    activeId: undefined as string | undefined,
    query: '',
    railWidth: undefined as number | undefined,
  },
  sections: {
    rows: [] as { id: string, label: string }[],
    onboarding: [] as { id: string, label: string }[],
  },
}))

vi.mock('../store', () => ({
  store: { settings: stores.settings, sections: stores.sections },
}))

vi.mock('dsh-tauri/client', () => ({
  compact: (values: unknown[]): unknown[] => values.filter(Boolean),
  uniq: (values: unknown[]): unknown[] => [...new Set(values)],
  isEmpty: (values: readonly unknown[]): boolean => values.length === 0,
  clamp: (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max),
  get: (record: Record<string, unknown>, key: string, fallback?: unknown): unknown => record[key] ?? fallback,
  useEventListener: (): void => {},
  useStore: (module: unknown): unknown => module,
  defineStore: (definition: {
    state: () => Record<string, unknown>
    actions: Record<string, (...args: never[]) => unknown>
  }): Record<string, unknown> => {
    const state = definition.state()
    return {
      ...state,
      ...Object.fromEntries(Object.entries(definition.actions).map(([name, action]) => [name, action.bind(state)])),
    }
  },
  defineLocale: (namespace: string, dicts: { zh: Record<string, string>, en: Record<string, string> }) => ({
    NS: namespace,
    text: (key: string): string => dicts.zh[key] ?? key,
    activeLocale: (): string => 'zh',
    isEnglishLocale: (): boolean => false,
    useLocale: (): string => 'zh',
    registerLocale: (): (() => void) => () => {},
  }),
}))

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: (props: { children?: ReactNode, icon?: ReactNode, className?: string, disabled?: boolean, title?: string, onClick?: () => void }) => (
    <button type="button" className={props.className} disabled={props.disabled} title={props.title} onClick={props.onClick}>
      {props.icon}
      {props.children}
    </button>
  ),
  Tag: (props: { children?: ReactNode, className?: string, tone?: string }) => (
    <span className={props.className} data-tone={props.tone}>{props.children}</span>
  ),
  Switch: (props: { checked: boolean, disabled?: boolean, label: string, title?: string }) => (
    <button type="button" role="switch" aria-checked={props.checked} disabled={props.disabled} aria-label={props.label} title={props.title} />
  ),
  Menu: (props: { anchor?: ReactNode, items?: readonly { id: string, icon?: ReactNode }[], className?: string }) => (
    <span className={props.className}>
      {props.anchor}
      {(props.items ?? []).map(entry => <span key={entry.id}>{entry.icon}</span>)}
    </span>
  ),
  Modal: (props: { children?: ReactNode, footer?: ReactNode }) => (
    <div>
      {props.children}
      {props.footer}
    </div>
  ),
}))

vi.mock('@deepseek-ai/dsh-client-ui-renderer', () => ({
  SlotOutlet: () => null,
}))

const HERE = fileURLToPath(new URL('.', import.meta.url))
const PROBE = { settingsNs: 'ns', profilePath: [] }
const t = (key: string): string => key

function draw(component: unknown, props: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(node(component, props))
}

function node(component: unknown, props: Record<string, unknown> = {}): ReactElement {
  return createElement(component as unknown as ComponentType<Record<string, unknown>>, props)
}

function selectorHook(state: unknown): (select: (value: unknown) => unknown) => unknown {
  return select => select(state)
}

function readSource(...files: string[]): string {
  return files.map(file => readFileSync(`${HERE}${file}`, 'utf8')).join('\n')
}

function stripGroups(input: string, open: string, close: string): string {
  let depth = 0
  let output = ''
  for (const char of input) {
    if (char === open) {
      depth += 1
      continue
    }
    if (char === close) {
      depth = Math.max(0, depth - 1)
      continue
    }
    if (depth === 0)
      output += char
  }
  return output
}

function selectorParts(css: string): string[] {
  return css
    .replace(/@[\w-][^{]*\{/g, ' ')
    .split('}')
    .map(chunk => chunk.split('{')[0] ?? '')
    .map(chunk => chunk.replace(/\s+/g, ' ').trim())
    .filter(chunk => chunk !== '')
    .flatMap(chunk => stripGroups(stripGroups(chunk, '(', ')'), '[', ']').split(','))
    .map(part => part.trim())
    .filter(part => part !== '')
}

function classesIn(segment: string): string[] {
  return [...segment.matchAll(/\.([\w-]+)/g)].map(match => match[1] ?? '').filter(name => name !== '')
}

function renderedClassSets(markup: string): Set<string>[] {
  return [...markup.matchAll(/class="([^"]*)"/g)].map(match =>
    new Set((match[1] ?? '').split(/\s+/).filter(name => name !== '')),
  )
}

interface GatedClass {
  token: string
  literal: string
}

interface AuditCase {
  name: string
  style: { render: () => string }
  markup: () => string
  sources: string[]
  gated?: GatedClass[]
}

const SESSION_HOOK = selectorHook({ phase: 'loading', byId: {} })

const CASES: AuditCase[] = [
  {
    name: 'components/button',
    style: buttonStyle,
    sources: ['button.tsx'],
    markup: () => ['elevated', 'add', 'addGhost', 'danger']
      .flatMap(variant => ['sm', 'md'].map(size => draw(Button, { variant, size, children: 'x' })))
      .join(''),
  },
  {
    name: 'components/checkbox',
    style: checkboxStyle,
    sources: ['checkbox.tsx'],
    markup: () => draw(Checkbox, { checked: false, onChange: () => {}, children: 'x' }),
  },
  {
    name: 'components/chip',
    style: chipStyle,
    sources: ['chip.tsx'],
    markup: () => ['seat', 'composerTrigger', 'selector']
      .map(variant => draw(Chip, { variant, icon: createElement('span'), badge: createElement('span'), chevron: createElement('span'), open: true, children: 'x' }))
      .join(''),
  },
  {
    name: 'components/dot',
    style: dotStyle,
    sources: ['dot.tsx'],
    markup: () => ['done', 'warning', 'error', 'idle', undefined]
      .map(state => draw(Dot, { state }))
      .join(''),
  },
  {
    name: 'components/goal-bar',
    style: goalBarStyle,
    sources: ['goal-bar.tsx'],
    markup: () => [
      draw(GoalBar, {
        glyph: 'g',
        label: 'l',
        objective: 'o',
        error: 'e',
        actions: node(GoalBarAction, { children: 'd' }),
        children: node(GoalBarAction, { 'iconOnly': true, 'aria-label': 'i' }),
      }),
      draw(GoalBarAction, { children: 'd' }),
      draw(GoalBarAction, { children: 'x' }),
    ].join(''),
  },
  {
    name: 'components/icon-button',
    style: iconButtonStyle,
    sources: ['icon-button.tsx'],
    markup: () => ['search', 'toolbar', 'model', 'round', 'row', 'help', 'action']
      .map(variant => draw(IconButton, { variant, children: 'x' }))
      .join(''),
  },
  {
    name: 'components/tag',
    style: tagStyle,
    sources: ['tag.tsx'],
    markup: () => [
      draw(Tag, { variant: 'version', tone: 'neutral', children: 'v' }),
      draw(Tag, { variant: 'status', tone: 'danger', children: 's' }),
      draw(Tag, { variant: 'status', tone: 'info', children: 's' }),
      draw(Tag, { variant: 'status', tone: 'outline', children: 's' }),
      draw(Tag, { variant: 'version', tone: 'outline', children: 'v' }),
    ].join(''),
  },
  {
    name: 'ui/hero-workspace',
    style: heroWorkspaceStyle,
    sources: ['../ui/hero-workspace.tsx', '../constants/index.ts'],
    markup: () => draw(HeroWorkspace, {
      open: true,
      onPick: () => {},
      onClose: () => {},
      startUngrouped: () => {},
      useWorkspaces: selectorHook({ items: [], phase: 'pending' }),
      useSessions: selectorHook({}),
    }),
  },
  {
    name: 'ui/nav-icon',
    style: navIconStyle,
    sources: ['../ui/nav-icon.tsx'],
    markup: () => draw(SettingsNavIcon, { id: 'models' }),
  },
  {
    name: 'ui/panel-page',
    style: panelPageStyle,
    sources: ['../ui/panel-page.tsx'],
    markup: () => draw(PanelPage, { children: createElement('span') }),
  },
  {
    name: 'ui/segmented-control',
    style: segmentedControlStyle,
    sources: ['../ui/segmented-control.tsx'],
    markup: () => draw(SegmentedControl, {
      id: 'mode',
      label: 'Mode',
      value: 'b',
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
      onChange: () => {},
    }),
  },
  {
    name: 'ui/sidebar',
    style: sidebarStyle,
    sources: ['../ui/sidebar.tsx', '../constants/index.ts'],
    gated: [{ token: 'dshp-settings-sidebar__handle--dragging', literal: '__handle--dragging' }],
    markup: () => {
      stores.settings.open = true
      stores.settings.activeId = 'models'
      stores.sections.rows = [{ id: 'models', label: 'Models' }]
      const filled = draw(SettingsSidebar, { useSessions: SESSION_HOOK })
      stores.sections.rows = []
      const empty = draw(SettingsSidebar, { useSessions: SESSION_HOOK })
      stores.settings.open = false
      return `${filled}${empty}`
    },
  },
  {
    name: 'ui/trigger',
    style: triggerStyle,
    sources: ['../ui/trigger.tsx'],
    markup: () => [
      draw(SettingsTrigger, { wide: true, useSessions: SESSION_HOOK }),
      draw(SettingsTrigger, { wide: false, useSessions: SESSION_HOOK }),
    ].join(''),
  },
  {
    name: 'ui/model-extras/config-editor',
    style: configEditorStyle,
    sources: ['../ui/model-extras/model-config-toolbar.tsx'],
    markup: () => draw(ModelConfigToolbar, { t, editor: { editor: 'system', command: '' } }),
  },
  {
    name: 'ui/model-extras/model-compat-fields',
    style: modelCompatFieldsStyle,
    sources: ['../ui/model-extras/model-compat-fields.tsx'],
    markup: () => draw(ModelCompatFields, {
      t,
      model: { reasoningEfforts: { low: 'low' } },
      index: 0,
      templateCompat: true,
      onPatch: () => {},
    }),
  },
  {
    name: 'ui/model-extras/model-extras',
    style: modelExtrasStyle,
    sources: [
      '../ui/model-extras/model-config-toolbar.tsx',
      '../ui/model-extras/auto-config-all-button.tsx',
      '../ui/model-extras/model-fetch-config-button.tsx',
    ],
    gated: [
      { token: 'dshp-model-extras__dialog-label', literal: 'dshp-model-extras__dialog-label' },
      { token: 'dshp-model-extras__input', literal: 'dshp-model-extras__input' },
      { token: 'dshp-model-extras__dialog-hint', literal: 'dshp-model-extras__dialog-hint' },
      { token: 'dshp-model-extras__dialog-error', literal: 'dshp-model-extras__dialog-error' },
      { token: 'dshp-model-extras__notice', literal: 'dshp-model-extras__notice' },
      { token: 'dshp-model-extras__notice--failed', literal: 'dshp-model-extras__notice--failed' },
      { token: 'dshp-model-extras__notice--done', literal: 'dshp-model-extras__notice--done' },
    ],
    markup: () => [
      draw(ModelConfigToolbar, { t, onOpenConfig: () => {}, editor: { editor: 'system', command: '' } }),
      draw(AutoConfigAllButton, { t, models: [{ id: 'm' }], probe: PROBE }),
      draw(ModelFetchConfigButton, { t, modelId: 'm', models: [{ id: 'm' }], probe: PROBE }),
    ].join(''),
  },
  {
    name: 'styles/global',
    style: globalStyle,
    sources: [],
    markup: () => '',
  },
  {
    name: 'styles/index',
    style: turnNavigationStyle,
    sources: [],
    markup: () => '',
  },
]

describe('cssr class contract', () => {
  for (const auditCase of CASES) {
    it(`${auditCase.name} emits only classes its component renders`, () => {
      const parts = selectorParts(auditCase.style.render())
      const markup = auditCase.markup()
      const elements = renderedClassSets(markup)
      const rendered = new Set(elements.flatMap(set => [...set]))
      const emitted = [...new Set(parts.flatMap(classesIn))].filter(token => token.startsWith('dshp-')).sort()
      const gated = auditCase.gated ?? []
      const missing = emitted.filter(token => !rendered.has(token))

      expect(missing, `${auditCase.name} emits classes no rendered element carries`).toEqual(gated.map(item => item.token).sort())
      for (const item of gated)
        expect(readSource(...auditCase.sources), `gated literal for ${item.token}`).toContain(item.literal)

      const unsatisfiable = parts.filter((part) => {
        return part.split(/[\s>+~]+/).filter(segment => segment !== '').some((segment) => {
          const classes = classesIn(segment)
          if (classes.length < 2)
            return false
          if (!classes.every(name => rendered.has(name)))
            return false
          return !elements.some(set => classes.every(name => set.has(name)))
        })
      })

      expect([...new Set(unsatisfiable)], `${auditCase.name} has compound selectors no single element can carry`).toEqual([])
    })
  }

  it('keeps the goal-bar modifier on the action element instead of the block', () => {
    const parts = selectorParts(goalBarStyle.render())
    expect(parts).toContain('.dshp-goal-bar .dshp-goal-bar__action.dshp-goal-bar__action--icon')
    expect(parts.filter(part => part.includes('dshp-goal-bar--icon') || part.includes('dshp-goal-bar--danger'))).toEqual([])
    expect(parts.filter(part => part.includes('dshp-goal-bar__action--danger'))).toEqual([])
    const icon = draw(GoalBarAction, { 'iconOnly': true, 'aria-label': 'i' })
    const classes = [...icon.matchAll(/class="([^"]*)"/g)].map(match => match[1] ?? '')
    expect(classes).toContain('dshp-goal-bar__action dshp-goal-bar__action--icon')
  })

  it('drops the dead model-extras open, busy and hover classes', () => {
    const css = modelExtrasStyle.render()
    expect(css).toContain('.dshp-model-extras__link[aria-expanded=\'true\']')
    expect(css).not.toContain('dshp-model-extras__link--open')
    expect(css).not.toContain('dshp-model-extras__busy')
    const trigger = draw(ModelConfigToolbar, { t, editor: { editor: 'system', command: '' } })
    expect(trigger).toContain('class="dshp-model-extras__link dshp-model-config-toolbar__trigger"')
    expect(trigger).toContain('aria-expanded="false"')
  })
})
