<p align="center">
  <a href="https://github.com/Ray8876/deepseek-harness-desktop">
    <img src="public/favicon.svg" width="96" alt="DeepSeek Harness Desktop" />
  </a>
</p>

<h1 align="center">DeepSeek Harness 桌面版<br />Windows 离线安装修改版</h1>

<p align="center">
  基于 <a href="https://github.com/dsh-tauri/deepseek-harness-desktop">上游项目</a> 的个人修改版，<br />
  为 Windows x64 提供首次启动无需联网的离线安装包。
</p>

<p align="center">
  <a href="https://github.com/Ray8876/deepseek-harness-desktop/actions/workflows/build-windows-offline.yml">
    <img src="https://github.com/Ray8876/deepseek-harness-desktop/actions/workflows/build-windows-offline.yml/badge.svg" alt="Offline Windows Build" />
  </a>
  <a href="https://github.com/dsh-tauri/deepseek-harness-desktop/releases">
    <img src="https://img.shields.io/github/v/release/dsh-tauri/deepseek-harness-desktop?style=flat-square&label=release&color=4D6BFE" alt="Release" />
  </a>
  <img src="https://img.shields.io/github/downloads/dsh-tauri/deepseek-harness-desktop/total?style=flat-square&label=downloads&color=4D6BFE" alt="Downloads" />
  <img src="https://img.shields.io/github/stars/dsh-tauri/deepseek-harness-desktop?style=flat-square&label=stars&color=4D6BFE" alt="Stars" />
  <img src="https://img.shields.io/github/license/dsh-tauri/deepseek-harness-desktop?style=flat-square&label=license&color=4D6BFE" alt="MIT License" />
  <img src="https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-black?style=flat-square" alt="Windows | macOS | Linux" />
  <img src="https://img.shields.io/badge/dsh-0.1.5--rc.2-4D6BFE?style=flat-square" alt="dsh 0.1.5-rc.2" />
</p>

<p align="center">
  <samp><a href="./README.en.md">English</a> · <a href="./README.es.md">Español</a> · <a href="https://dshtauri.mintlify.site">文档</a> · <strong>中文</strong></samp>
</p>

## Windows 离线安装修改版

本 fork 在上游桌面端 `v0.15.8` 基础上增加独立的 Windows x64 离线安装流程。Release 将主程序安装器与官方 WebView2 Standalone x64 安装器并列提供；主程序安装器内置 Node.js、Harness、pnpm 和 MinGit，不会在安装过程中联网下载 WebView2。

> [!IMPORTANT]
> 这是个人维护的修改版，不是上游官方发行包。当前生成的是**未签名 NSIS 安装器**，Windows 可能显示未知发布者提示。离线使用时请先运行 Release 中的 `MicrosoftEdgeWebView2RuntimeInstallerX64.exe`，再运行主程序安装器；社区插件安装、在线更新及其他网络功能仍然需要联网。

### 使用 GitHub Actions 构建

1. 打开本仓库的 [Actions](https://github.com/Ray8876/deepseek-harness-desktop/actions) 页面。
2. 选择 **Offline Windows Build**，点击 **Run workflow**。
3. 构建完成后下载 `deepseek-harness-desktop-windows-x64-offline` Artifact。
4. 先运行 WebView2 Runtime 安装器，再运行主程序安装器。

Artifact 包含：

- Windows x64 离线安装器 `.exe`
- 独立的 WebView2 Runtime 安装器 `MicrosoftEdgeWebView2RuntimeInstallerX64.exe`
- `offline-manifest.json`
- `SHA256SUMS`

Artifact 本身就是 GitHub 下载的压缩包，内部包含主程序安装器和独立 WebView2 Runtime 安装器；本地构建目录仍会额外生成同样内容的完整离线分发包 `.zip`。

构建任务使用 GitHub 托管的临时 `windows-2022` 环境，固定依赖版本并验证每项资产的 SHA-256。详细版本、构建命令和断网验收步骤见 [离线 Windows 构建说明](./docs/OFFLINE_WINDOWS.md)。

<p align="center">
 <a href="https://trendshift.io/repositories/151676?utm_source=trendshift-badge&amp;utm_medium=badge&amp;utm_campaign=badge-trendshift-151676" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/151676/daily?language=Rust" alt="dsh-tauri%2Fdeepseek-harness-desktop | Trendshift" width="250" height="55"/></a>
</p>


<p align="center">
  <a href="docs/PREVIEW.md">
    <img src="./docs/images/hero-zh.png" width="100%" alt="DSH Desktop 中文宣传横幅" />
  </a>
</p>

- 🧩 **插件管理** — 插件面板管理已安装插件，出现异常时提供升级 / 卸载入口，错误详情。
- 🎁 **内置插件** — 随安装包内置插件，以及将来引入更多高质量的内置插件。
- 🪶 **原生轻量** — Tauri 2 外壳（非 Electron）：更小的安装包、更低的内存占用、原生窗口。
- ⌨️ **命令行集成** — 安装自动注册 `dsh` 命令，新开终端即用；不覆盖你已有 shell 配置。
- 🧭 **启动引导** — 首次启动可选推荐插件，也可在配置中重新选择。
- 🚀 **自更新** — 应用内更新，不需要重新下载；
- 🐾 **桌宠** — 提供 Pets / Codex 双来源桌宠管理，预设宠物开箱即用（直连远端素材，无需下载）、可导入 Codex `.zip` 资源包，并根据会话活动显示状态气泡。

## 预设插件

首次启动引导中提供的插件，按需勾选安装：

- [DSH Market](https://github.com/dsh-market/dsh-market) — 浏览、搜索并一键安装社区插件（推荐）
- [DSH Better Sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) — 类 VSCode 右侧栏，按会话隔离（推荐）
- [DSH Rewind](https://github.com/SiriLee/dsh-rewind) — 同窗口内对话回退，从不新建会话分支；自带轻量工作区备份，回退时可一并还原文件（推荐）
- [DSH-IM](https://github.com/xmanrui/dsh-im) — 让微信、飞书、钉钉、企业微信、QQ、Slack、Telegram、Discord、WhatsApp、iMessage 等渠道接入本机 Harness，并在左侧栏「IM」面板中统一管理（推荐）

> 预设插件清单由桌面端维护。为避免不稳定的预设插件导致软件异常，如需新增或更新预设，请在 [deepseek-harness-desktop/issues](https://github.com/dsh-tauri/deepseek-harness-desktop/issues) 提起请求。

## 内置插件

随安装包资源内置的第一方插件：

- [DSH Tauri](https://github.com/dsh-tauri/deepseek-harness-desktop/tree/main/packages/dsh-tauri) — 提供与 Tauri 2 外壳的通信通道
- [DSH Tauri Connection](https://github.com/dsh-tauri/deepseek-harness-desktop/tree/main/packages/dsh-tauri-connection) — 让跨源沙箱内嵌 WebView 用上回环宿主：在 `connection` 服务上覆写桌面载体的两道鉴权闸门
- [DSH Model Config](https://github.com/dsh-tauri/deepseek-harness-desktop/tree/main/packages/dsh-tauri-model-config) — 接管模型设置页，补齐上下文与输出上限、图片输入、思考模式和本地端点兼容选项
- [DSH Tauri UI](https://github.com/dsh-tauri/deepseek-harness-desktop/tree/main/packages/dsh-tauri-ui) — 为 Tauri 2 外壳提供自定义设置侧边栏
- [DSH Tauri Worktree](https://github.com/dsh-tauri/deepseek-harness-desktop/tree/main/packages/dsh-tauri-worktree) — 为每个会话创建隔离的 Git Worktree，并支持检出到本地分支或归档放弃
- [DSH Tauri Panel Extension](https://github.com/dsh-tauri/deepseek-harness-desktop/tree/main/packages/dsh-tauri-panel-extension) — Skills/MCP 管理与导入技能仓库，内嵌插件市场面板
- [DSH Tauri Panel Scheduler](https://github.com/dsh-tauri/deepseek-harness-desktop/tree/main/packages/dsh-tauri-panel-scheduler) — 创建每天、间隔、工作日或每周的定时任务；在独立 Agent 会话中执行，并保留执行记录
- [DSH Tauri Turn Rewind](https://github.com/dsh-tauri/deepseek-harness-desktop/tree/main/packages/dsh-tauri-turnrewind) — 按 Agent 回合记录私有 Git 快照并显示文件变更卡片；恢复文件交由推荐的 dsh-rewind 插件
- [DSH Tauri Session](https://github.com/dsh-tauri/deepseek-harness-desktop/tree/main/packages/dsh-tauri-session) — 将删除工作区改为归档，并提供支持搜索、排序、分组、项目筛选和取消归档的「已归档聊天」设置页
- [DSH Tauri Pet](https://github.com/dsh-tauri/deepseek-harness-desktop/tree/main/packages/dsh-tauri-pet) — 管理 Chat / Codex 桌宠、预设宠物下载、资源包导入和会话活动状态
- [DSH Tauri Rightclick](https://github.com/dsh-tauri/deepseek-harness-desktop/tree/main/packages/dsh-tauri-rightclick) — 为会话、工作区、正文、链接和输入框补充常用操作
- 更多即将引入的插件...

## 快速开始

Windows x64 离线修改版从本仓库的 [Actions](https://github.com/Ray8876/deepseek-harness-desktop/actions) 下载构建产物；其他平台及上游常规安装包请前往[上游 Releases](https://github.com/dsh-tauri/deepseek-harness-desktop/releases)。

**macOS（Homebrew）：** 也可通过 Homebrew 一键安装：

```bash
brew install dsh-tauri/desktop/deepseek-harness
```

本 fork 的 Windows 离线安装包已包含 Node 运行时与 Harness 内核，安装前单独安装 WebView2 Runtime 后，首次运行无需下载；上游常规安装包仍会在首次运行时下载依赖。启动后进入 `http://127.0.0.1:3080` 的 Harness 界面。

**系统要求：** Windows 10+ · macOS 10.15+ · Linux（AppImage / .deb）· 离线修改版仅提供 Windows x64 · Harness 内核 **0.1.5-rc.2**

> **Linux Wayland 注意（PikaOS / GNOME Wayland / Ubuntu 22.04+）：** AppImage 在 Wayland 下可能因 WebKitGTK 黑屏/崩溃，应用已自动处理常见情形。 <details><summary>若仍黑屏/崩溃：</summary><br>**改用 `.deb`**（已验证 PikaOS 4 Wayland），或手动 `WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 GDK_BACKEND=x11 ./AppImage`。图标不显示时，将应用内 `hicolor` 图标复制到 `~/.local/share/icons` 并运行 `update-desktop-database`。<br></details>
>
> **Linux 滚动发行版启动即崩（Arch / CachyOS / Fedora 等）：** 旧版 AppImage 会随包携带构建镜像（Ubuntu 22.04）的 `libwayland-client` 等显示栈库，较新的宿主 Mesa 与之 ABI 不匹配会导致 `WebKitWebProcess` 直接 `abort()`——表现为**双击后没有任何界面、也没有任何日志**。构建阶段已剔除这些库（见 `.github/workflows/build-linux.yml` 与 `scripts/fix-appimage-host-libs.sh`），请使用修复后发布的版本；仍受影响时可用 `.deb`，或 `LD_PRELOAD=/usr/lib/libwayland-client.so.0 ./AppImage`（路径按发行版调整）。

## 交流

- [加入 Discord 社区](https://discord.gg/RT9As6Cj8B)

<table>
  <tr>
    <td align="center"><strong>QQ 群</strong><br /><img src="./docs/images/community/qq-qrcode.jpg" width="360" alt="QQ 群二维码" /></td>
    <td align="center"><strong>微信群(已满,请先加我微信) -> </strong><br /><img src="./docs/images/community/wx-qrcode.png" width="360" alt="微信群二维码" /></td>
    <td align="center"><strong>个人微信</strong><br /><img src="https://github.com/user-attachments/assets/c1d6e493-b608-4a6d-b387-dfcaa37ccfdc" width="360" alt="微信群二维码" /></td>
  </tr>
</table>


## 开发

想参与开发？参见 [docs/DEVELOPMENT.zh.md](./docs/DEVELOPMENT.zh.md)。

## 工作原理

```text
┌──────────────────────────────────────────────┐
│ Tauri WebView (React)                        │
│   安装状态机 → 下载进度 → iframe              │
│   加载 dsh Web 界面 + 侧边栏控制              │
└──────────────────────┬───────────────────────┘
                       │ invoke 命令 + 事件
┌──────────────────────┴───────────────────────┐
│ Tauri Rust 后端                              │
│   service/download  安装器 + 解压            │
│   service/core      Harness 核心多版本管理   │
│   service/profile   dsh 档案管理             │
│   service/plugin    插件卸载 / 升级          │
│   service/cli       dsh 命令 shim + PATH     │
│   service/update    桌面端自更新             │
│   service/workflow  dsh 进程生命周期         │
│   task              dsh 健康检查             │
└──────┬───────────────────────────┬───────────┘
       │                           │
  runtime/ (Node.js v22.22.0)   dependencies/dsh/ (发行版)
       └─────────────┬─────────────┘
                     ▼
   dsh --profile <档案> --host 127.0.0.1 --port 3080
                     │  DSH_HOME=~/.dsh
                     ▼
        http://127.0.0.1:3080/  ← 内嵌界面
```

Harness 发行版由 [deepseek-harness-pkg](https://github.com/dsh-tauri/deepseek-harness-pkg) 构建发布。每次启动都会对比最新发行版，本地过期时提醒下载更新；GitHub 不可达时保留本地安装。通过 CLI 全局安装的本地核心会被优先使用。

## 说明

> [!WARNING]
> **开发预览** — 上游 `dsh` 仍在快速迭代，存在破坏性变更；本项目同步跟随。

> [!NOTE]
> **安全声明** — `dsh` 具备本地代码执行能力。仅供学习 / 研究 / 测试，请在可信、隔离的环境中使用。

## 相关项目

- [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — 上游 `dsh` agent 平台
- [deepseek-harness-pkg](https://github.com/dsh-tauri/deepseek-harness-pkg) — 预打包 Harness 发行版（本应用下载源）

### 插件数据源

插件在运行时直接引用的远端素材与上游清单：

- [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) — 预设桌宠素材（WebM 动作、预览 GIF、`config.jsonc`），`preset-pets.json` 固定到 `e1ff8c1`
- [dsh-tauri/dsh-pet-mov](https://github.com/dsh-tauri/dsh-pet-mov) — macOS HEVC-alpha `.mov` 镜像（WKWebView 不认 VP9-alpha），固定到 `be0f3bb`
- [hairyf/dsh-pet-component](https://github.com/hairyf/dsh-pet-component) — 桌宠渲染组件（npm `dsh-pet-component`）

### 插件子仓库

`source/` 下按插件需要克隆的参考仓库，多数不随本仓库提交：

- [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) — 桌宠动作权重、连续播放与气泡样式（子模块）
- [Skylarking/dsh-plugin-codex-pets](https://github.com/Skylarking/dsh-plugin-codex-pets) — Codex 宠物图集与会话状态映射（子模块）
- [ayangweb/BongoCat](https://github.com/ayangweb/BongoCat) — Tauri 桌宠窗口、原生拖动、DPI 与鼠标穿透基准（子模块）
- [QCYTSN/dsh-dafeiyu](https://github.com/QCYTSN/dsh-dafeiyu) — 桌宠气泡文案与状态优先级参考（子模块）
- [Signalight/codex-to-dsh-pet](https://github.com/Signalight/codex-to-dsh-pet) — Codex v2 图集、动作优先级与会话状态映射

## License

[MIT](./LICENSE)，附加[非商用条款](./LICENSE.details) © deepseek-harness-desktop contributors
