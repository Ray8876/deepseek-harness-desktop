# DeepSeek Harness Desktop · Windows 离线版

本项目 fork 自 [dsh-tauri/deepseek-harness-desktop](https://github.com/dsh-tauri/deepseek-harness-desktop)，为 **Windows 10/11 x64** 自动构建和发布离线安装包，属于个人维护的非官方版本。

[下载离线版](https://github.com/Ray8876/deepseek-harness-desktop/releases/latest) · [自动构建状态](https://github.com/Ray8876/deepseek-harness-desktop/actions/workflows/auto-offline-release.yml)

## 自动更新

GitHub Actions 每 6 小时检查上游正式 Release，自动同步源码、固定依赖版本、运行测试并打包。构建和校验成功后直接发布，无需人工确认；已发布版本自动跳过，冲突或检查失败时停止发布。

## 下载与安装

从本仓库同一个 Release 下载两个安装器，依次运行：

1. `MicrosoftEdgeWebView2RuntimeInstallerX64.exe`：安装 WebView2 Runtime。
2. `deepseek-harness-desktop-<版本>-windows-x64-offline-setup.exe`：安装主程序。

主程序内置 Node.js、Harness、pnpm 和 MinGit；WebView2 使用独立的离线安装器。Release 同时提供 `offline-manifest.json` 和 `SHA256SUMS`，用于查看版本和校验文件。

## 说明

- 离线包提供本地安装与启动所需依赖；在线模型 API、社区插件下载等功能仍需网络。
- 安装器未签名，Windows 可能提示未知发布者。
- 自动测试和构建不等同于真实 Windows 断网安装验收，详见 [离线构建与验收说明](docs/OFFLINE_WINDOWS.md)。
- 其他平台及项目完整介绍请访问[上游项目](https://github.com/dsh-tauri/deepseek-harness-desktop)。

## 许可证

保留上游 [MIT License](LICENSE) 及[禁止商业二次开发的附加条款](LICENSE.details)。
