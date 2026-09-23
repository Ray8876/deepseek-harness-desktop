import { defineConfig } from '@genapi/core'
import { pluginPipeline } from './genapi.pipeline'

// 本列表的判据是「有需要生成的宿主 HTTP 路由」，不是「有宿主半区」：
// `dsh-tauri`（3 条路由）与 `dsh-tauri-pet`（3 条）都自行手写调用层，没有列出。
// `dsh-tauri-model-config` 是官方 `ui-settings-models` 的原样 fork：宿主半区只有
// webserver 全局注入（`webserver/index-inject`），没有 HTTP 路由，因此没有可生成的 API；
// 本仓库自有的 5 条路由已随自动配置/打开配置文件能力迁到 `dsh-tauri-ui`。
const plugins = [
  'dsh-tauri-panel-extension',
  'dsh-tauri-panel-scheduler',
  'dsh-tauri-rightclick',
  'dsh-tauri-session',
  'dsh-tauri-running-changes',
  'dsh-tauri-ui',
  'dsh-tauri-worktree',
]

export default defineConfig({
  preset: pluginPipeline,
  meta: { import: { http: 'dsh-tauri/client' } },
  // worktree 的根级 routes/post.ts、routes/delete.ts 生成名是 `post` / 保留字 `delete`
  patch: { operations: { delete: 'deleteWorktree', post: 'postWorktree' } },
  servers: plugins.map(plugin => ({
    input: `packages/${plugin}/src/host/routes`,
    output: { main: `packages/${plugin}/src/client/apis/index.ts` },
    meta: { baseURL: JSON.stringify(`/api/desktop/${plugin}`) },
  })),
})
