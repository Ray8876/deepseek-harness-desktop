import { readFileSync } from 'node:fs'
import i18next from 'i18next'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { resources } from '../src/i18n/index.resource'
import { attachStartupDiagnostics } from '../src/store/modules/harness/utils'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

/** 报告者在 issue #699 里贴出的真实 FATAL 行（V8 堆耗尽） */
const V8_HEAP_OOM_LINE = 'FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory'

const HEAP_KEYS = [
  'errors.heap_oom',
  'ui.heap_limit',
  'ui.heap_limit_auto',
  'messages.heap_changed',
  'messages.heap_restart_hint',
  'messages.heap_invalid',
  'messages.heap_save_failed',
]

function locale(file: 'zh-CN.json' | 'en-US.json'): Record<string, string> {
  const raw = readFileSync(new URL(`../src/i18n/locales/${file}`, import.meta.url), 'utf8')
  return JSON.parse(raw) as Record<string, string>
}

function stubServiceLogTail(raw: string) {
  invokeMock.mockImplementation(async (command: string) => (command === 'read_service_logs' ? raw : undefined))
}

beforeAll(async () => {
  // 与壳层同一份资源初始化默认 i18next 实例：断言的是真实译文，而不是未初始化时的 key 回退
  await i18next.init({
    resources,
    lng: 'zh-CN',
    keySeparator: false,
    nsSeparator: false,
    initAsync: false,
  })
})

afterEach(() => {
  invokeMock.mockReset()
})

describe('attachStartupDiagnostics heap exhaustion hint', () => {
  it('attaches the heap hint when the owned process exited and the log tail shows V8 heap exhaustion', async () => {
    stubServiceLogTail([
      'dsh web: http://127.0.0.1:3080/?token=abc',
      V8_HEAP_OOM_LINE,
    ].join('\n'))

    const error = await attachStartupDiagnostics(new Error('Harness exited'), true)

    expect(error.heapOomHint).toBe(locale('zh-CN.json')['errors.heap_oom'])
  })

  it('keeps the hint off when the same log tail predates the current boot', async () => {
    stubServiceLogTail([
      'dsh web: http://127.0.0.1:3080/?token=abc',
      V8_HEAP_OOM_LINE,
    ].join('\n'))

    const error = await attachStartupDiagnostics(new Error('Plugin installation failed'), false)

    expect(error.heapOomHint).toBeUndefined()
  })

  it('keeps the hint off when the process exited without the V8 signature', async () => {
    stubServiceLogTail([
      'Error: EADDRINUSE: address already in use 127.0.0.1:3080',
      'Owned Harness process 42 exited with code 134',
    ].join('\n'))

    const error = await attachStartupDiagnostics(new Error('Harness exited'), true)

    expect(error.heapOomHint).toBeUndefined()
  })
})

describe('harness heap i18n contract', () => {
  it('defines every heap key in both locales', () => {
    const zh = locale('zh-CN.json')
    const en = locale('en-US.json')

    for (const key of HEAP_KEYS) {
      expect(zh[key], `zh-CN.json missing ${key}`).toBeTypeOf('string')
      expect(en[key], `en-US.json missing ${key}`).toBeTypeOf('string')
    }
  })
})
