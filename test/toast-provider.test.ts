import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PROVIDER = '../src/components/toast-provider.tsx'
const HEROUI_TOAST = '../node_modules/@heroui/react/dist/components/toast/toast.js'

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

describe('toast provider render-slot contract', () => {
  it('falls back to the HeroUI default bubble only for undefined children', () => {
    // 独立 oracle：HeroUI 用 `typeof children === "undefined"` 判定走默认气泡，
    // 传 null 会命中最后的 `: children` 分支渲染空内容。
    expect(source(HEROUI_TOAST)).toContain('typeof children === "undefined"')
  })

  it('passes undefined — never null — on the non-custom branch', () => {
    const provider = source(PROVIDER)
    expect(provider).toContain('props.custom')
    expect(provider).toContain(': undefined}')
    expect(provider).not.toContain(': null}')
  })
})
