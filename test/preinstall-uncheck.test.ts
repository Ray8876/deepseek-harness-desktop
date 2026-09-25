import type { Event } from '@tauri-apps/api/event'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** 资源清单是 JSONC（允许行注释）：解析前先剥掉行注释。 */
function readManifest(): { plugins: { preset: Array<{ id: string, recommended?: boolean, checked?: boolean }> } } {
  const raw = readFileSync(new URL('../src-tauri/resources/manifest.jsonc', import.meta.url), 'utf8')
  return JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ''))
}

// ── Suite A — i18n keys exist (source assertion on JSON) ─────────────────────
describe('preinstall can-uncheck hint i18n keys', () => {
  it('provides preinstall.can_uncheck_hint in en-US', () => {
    const source = readFileSync(new URL('../src/i18n/locales/en-US.json', import.meta.url), 'utf8')
    const messages = JSON.parse(source) as Record<string, string>
    expect(messages).toHaveProperty('preinstall.can_uncheck_hint')
    expect(messages['preinstall.can_uncheck_hint']).toContain('Unchecked plugins won\'t be installed')
  })

  it('provides preinstall.can_uncheck_hint in zh-CN', () => {
    const source = readFileSync(new URL('../src/i18n/locales/zh-CN.json', import.meta.url), 'utf8')
    const messages = JSON.parse(source) as Record<string, string>
    expect(messages).toHaveProperty('preinstall.can_uncheck_hint')
    expect(messages['preinstall.can_uncheck_hint']).toContain('取消后不会安装')
  })
})

// ── Suite B — component references the hint key (source assertion) ───────────
describe('preinstallSetup hint text', () => {
  it('renders the can_uncheck_hint key', () => {
    const source = readFileSync(new URL('../src/layout/components/setup-preinstall.tsx', import.meta.url), 'utf8')
    expect(source).toContain('preinstall.can_uncheck_hint')
  })
})

// ── Suite C — component has dynamic button label (source assertion) ──────────
describe('preinstallSetup primary button morph', () => {
  it('guards the label switch on hasChanges', () => {
    const source = readFileSync(new URL('../src/layout/components/setup-preinstall.tsx', import.meta.url), 'utf8')
    expect(source).toContain('hasChanges')
  })

  it('can render the Skip label', () => {
    const source = readFileSync(new URL('../src/layout/components/setup-preinstall.tsx', import.meta.url), 'utf8')
    expect(source).toContain('preinstall.skip')
  })
})

// ── Suite B2 — 未预选声明抑制首次预选（behavior） ──────────────────────────────
// 推荐项仍显示「推荐」chip，但清单声明 `checked: false` 时首次引导不预选。
describe('unchecked preset suppresses first-run preselection', () => {
  it('is honored by initialCheckedSet and keeps the recommended chip independent', () => {
    const source = readFileSync(new URL('../src/layout/components/setup-preinstall.tsx', import.meta.url), 'utf8')
    expect(source).toContain('p.defaultUnchecked')
    // 预选判定必须先于 recommended，否则 defaultUnchecked 永远不会生效
    expect(source.indexOf('p.defaultUnchecked')).toBeLessThan(source.indexOf('p.recommended || p.fix'))
  })

  it('declares the DSH IM preset as recommended but not pre-checked', () => {
    const im = readManifest().plugins.preset.find(p => p.id === '@xmanrui/dsh-im')
    expect(im).toBeDefined()
    expect(im?.recommended).toBe(true)
    // 资源清单是唯一真值：Rust 侧据此派生 defaultUnchecked（checked === false）
    expect(im?.checked).toBe(false)
  })
})

// ── Suite D — store empty-selection guard (behavior, regression lock) ────────
// vi.mock 工厂会被提升到文件顶部，必须先经 vi.hoisted 声明模块级 mock 状态，
// 否则工厂执行时引用未初始化的绑定（Vitest 4.x 语义）。
const { eventListeners, invoke } = vi.hoisted(() => ({
  eventListeners: new Map<string, (event: Event<unknown>) => void>(),
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (event: string, callback: (payload: Event<unknown>) => void) => {
    eventListeners.set(event, callback)
    return vi.fn()
  }),
}))
vi.mock('@/config/client', () => ({ queryClient: { invalidateQueries: vi.fn() } }))
vi.mock('../src/store/modules/harness-updater', () => ({
  harnessUpdater: { checkForUpdate: vi.fn() },
}))

const { preinstall } = await import('../src/store/modules/preinstall')

beforeEach(() => {
  eventListeners.clear()
  invoke.mockReset()
})

describe('confirmPreinstall empty-selection guard', () => {
  it('does not invoke the backend when ids is empty', async () => {
    await preinstall.confirm([])
    expect(invoke).not.toHaveBeenCalled()
  })
})
