/**
 * host/routes/index.ts — running-changes HTTP 路由（客户端 UI 唯一的数据面）。
 *
 *   GET  /api/desktop/dsh-tauri-running-changes/summary?sessionId=<id>  读本会话的 turn 变更记录
 *   GET  /api/desktop/dsh-tauri-running-changes/live?sessionId=<id>     读运行中实时读数（客户端提示条）
 *
 * 「文件路径 = URL 路径」：`routes/<资源>/<方法>.ts` 逐段对应
 * `/api/desktop/dsh-tauri-running-changes/<资源>` 与 `client/apis` 的生成物同源派生。
 * 方法限制、OPTIONS 204、连接信任边界与请求体上限全部由 `defineRoutes` 承担。
 * 处理器不接收 apply 期依赖：宿主能力一律经 `service/` 访问。
 */

import { defineRoutes } from 'dsh-tauri'
import live from './live/get'
import summary from './summary/get'

export const routes = defineRoutes((disposer) => {
  disposer.get({ kind: 'exact', path: '/api/desktop/dsh-tauri-running-changes/summary' }, summary)
  disposer.get({ kind: 'exact', path: '/api/desktop/dsh-tauri-running-changes/live' }, live)
})
