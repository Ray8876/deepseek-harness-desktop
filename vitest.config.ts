import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * 根 Vitest 配置：只放「跨 project 的全局项」与 project 清单。
 *
 * Vitest 不把根配置本身当作 project（除非显式列出），因此这里不再写任何 include：
 * 用例归属由 `vitest.unit.config.ts`（单元）、`vitest.plugin.config.ts`（插件 L2）
 * 与 `vitest.desktop.config.ts`（桌面端 L3）各自声明。
 *
 * 注意 project 级配置**不继承**这里的 `resolve.alias`，各 project 需自行声明 `@/`。
 *
 * 仓库根还 vendored 了 dsh 核心源码（`source/` 与 `archive/`），其测试依赖 dsh 核心的
 * `@/` paths 解析（在插件 workspace 的 vitest 下不可用），故三个 project 都不纳入。
 */
export default defineConfig({
  // 与 vite.config.ts 保持一致：src 内部统一用 `@/` 别名。
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    projects: [
      './vitest.unit.config.ts',
      './vitest.plugin.config.ts',
      './vitest.desktop.config.ts',
    ],
    // 覆盖率只作可见性报告：不设 `thresholds`、不作为 CI 门禁。vendored 源码（`source/`、
    // `archive/`、`test/archive/`）与 Rust 侧（`src-tauri/`）不是本仓被测面，必须显式排除，
    // 否则报告数字没有意义。`coverage` 只能在根配置生效——project 级的同名字段会被忽略。
    coverage: {
      provider: 'v8',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
        'source/**',
        'archive/**',
        'test/archive/**',
        'src-tauri/**',
      ],
    },
  },
})
