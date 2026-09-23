/**
 * 批次 09 · `dsh-tauri-running-changes` 的宿主路由（契约见 `docs/specs/plugin.test.md`）。
 *
 * 插件只读：两个 GET 端点把账本里的逐回合变更记录回传给客户端读数。判定依赖会话与工作区
 * 上下文，而 scratch 宿主不造会话，因此本批刻意只覆盖无会话条件下即可判定的分支：入参校验、
 * 会话缺失、方法矩阵。`GET /live` 对未知会话的语义未确认，不写用例以免编造预期。
 *
 * 断言对象是外部世界（HTTP 状态码与响应字节），不采信插件自报。宿主复用 globalSetup 的
 * 共享实例（已挂载 dsh-tauri-running-changes），不另起进程。
 */

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, inject, it } from 'vitest'

const SUMMARY_PATH = '/api/desktop/dsh-tauri-running-changes/summary'
const LIVE_PATH = '/api/desktop/dsh-tauri-running-changes/live'

/** 插件自有数据目录（`$DSH_HOME/<feature>`，账本与私有快照仓都在其下）。 */
const FEATURE_DIR = 'dsh-tauri-running-changes'

/** 两条只声明 GET 的读路径。 */
const READ_PATHS = [SUMMARY_PATH, LIVE_PATH] as const

/** 只读路由公布的方法集合（顺序属实现细节，实测为固定三元的字典序）。 */
const READ_ONLY_ALLOW = ['GET', 'HEAD', 'OPTIONS']

interface ErrorBody {
  error?: string
}

/** `/api/**` 要求浏览器会话；Cookie 由编排在根路径用一次性 token 换得。 */
function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { cookie: inject('dshCookie'), ...extra }
}

function url(path: string): string {
  return `${inject('dshBaseUrl')}${path}`
}

/** `allow` 成员顺序属实现细节，按集合比较。 */
function allowMethods(response: Response): string[] {
  return (response.headers.get('allow') ?? '').split(',').map(entry => entry.trim()).filter(Boolean).sort()
}

/** 插件数据目录的递归清单；目录不存在即「什么都没落盘」。 */
function featureDirEntries(): string[] {
  const dir = join(inject('dshHome'), FEATURE_DIR)
  if (!existsSync(dir))
    return []
  return readdirSync(dir, { recursive: true }).map(entry => String(entry)).sort()
}

describe('宿主路由：入参与会话校验', () => {
  it('[反向] 验证两个端点缺 sessionId 均返回 400', async () => {
    const before = featureDirEntries()

    for (const path of READ_PATHS) {
      const response = await fetch(url(path), { headers: apiHeaders() })

      expect(response.status, `GET ${path} 不带查询串必须在读账本之前被拒`).toBe(400)
      expect(
        await response.json() as ErrorBody,
        `GET ${path} 的拒绝理由必须是缺少入参，而不是会话或工作区问题`,
      ).toEqual({ error: '缺少 sessionId' })
    }

    expect(featureDirEntries(), '入参校验必须在读账本之前返回，一个字节都不许落盘').toEqual(before)
  })

  it('[反向] 验证未知会话的摘要返回 404', async () => {
    const response = await fetch(url(`${SUMMARY_PATH}?sessionId=does-not-exist`), { headers: apiHeaders() })

    expect(response.status, '未登记的会话必须 404，而不是 400 或 500').toBe(404)
    expect(
      await response.json() as ErrorBody,
      '会话缺失与入参缺失必须是两条可区分的理由',
    ).toEqual({ error: '会话不存在或尚未就绪' })
  })
})

describe('宿主路由：方法矩阵', () => {
  it('验证两条路径的方法集合（只有 GET）', async () => {
    for (const path of READ_PATHS) {
      const preflight = await fetch(url(path), { method: 'OPTIONS', headers: apiHeaders() })

      expect(preflight.status, `OPTIONS ${path} 必须走默认 204 预检`).toBe(204)
      expect(
        allowMethods(preflight),
        `OPTIONS ${path} 的 allow 必须公布 GET / HEAD（GET 隐含）/ OPTIONS`,
      ).toEqual(READ_ONLY_ALLOW)

      const post = await fetch(url(path), {
        method: 'POST',
        headers: apiHeaders({ 'content-type': 'application/json' }),
        body: '{}',
      })

      expect(post.status, `POST ${path} 只声明了 GET，必须 405`).toBe(405)
      expect(
        allowMethods(post),
        `POST ${path} 的 allow 不得把 POST 说成可用，且必须指出真正可用的读方法`,
      ).toEqual(READ_ONLY_ALLOW)
    }
  })
})
