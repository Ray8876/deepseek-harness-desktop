use crate::config;
use async_trait::async_trait;
use std::path::PathBuf;
use tauri::AppHandle;

/// 安装任务的类型标识：下载源选择、完整性校验与版本记录都按它分支，
/// 而不是按任务在 `tasks` 向量里的位置索引（重排向量不应改变行为）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InstallKind {
    Node,
    Dsh,
    Pnpm,
    /// 仅 Windows 构造：`Git` 安装任务按 `#[cfg(windows)]` 加入任务列表。
    #[cfg_attr(not(windows), allow(dead_code))]
    Git,
}

#[async_trait]
pub trait Installable: Send + Sync {
    fn kind(&self) -> InstallKind;
    fn title(&self) -> &str;
    fn check_installed(&self, app: &AppHandle) -> bool;
    fn get_download_url(&self) -> Result<String, String>;
    fn get_install_path(&self, app: &AppHandle) -> PathBuf;
}

// --- Node.js 实现 ---
pub struct Nodejs;

#[async_trait]
impl Installable for Nodejs {
    fn kind(&self) -> InstallKind {
        InstallKind::Node
    }
    fn title(&self) -> &str {
        "运行环境"
    }
    fn get_download_url(&self) -> Result<String, String> {
        config::get_node_download_url()
    }
    fn get_install_path(&self, app: &AppHandle) -> PathBuf {
        config::get_node_install_path(app)
    }
    fn check_installed(&self, app: &AppHandle) -> bool {
        if config::offline_build() {
            let expected = crate::service::download::load_offline_manifest(app)
                .ok()
                .flatten()
                .and_then(|manifest| manifest.asset("node").ok().map(|asset| asset.version.clone()));
            let Some(expected) = expected else {
                return false;
            };
            let Some(node) = config::bundled_node_binary(app) else {
                return false;
            };
            return config::get_node_version_of_path(&node).is_some_and(|version| {
                version == expected.trim_start_matches('v') && config::is_runtime_compatible(app)
            });
        }
        // 原生模块 ABI 探测已判定本地 node 无法加载核心的原生模块（issue #441）：
        // 此时不能再以"本机有版本兼容的 node"为由跳过捆绑运行时，否则服务进程仍会
        // 用那个 ABI 不匹配的运行时启动。
        if config::prefer_bundled_node_runtime() {
            return config::bundled_node_binary(app).is_some() && config::is_runtime_compatible(app);
        }
        if let Some(local_node) = config::get_local_node_path() {
            log::info!(
                "Detected compatible local Node.js ({}), skipping bundled runtime",
                local_node.display()
            );
            return true;
        }
        config::get_node_binary_path(app).exists() && config::is_runtime_compatible(app)
    }
}

// --- DeepSeek Harness 实现 ---
pub struct Dsh;

#[async_trait]
impl Installable for Dsh {
    fn kind(&self) -> InstallKind {
        InstallKind::Dsh
    }
    fn title(&self) -> &str {
        "Harness 核心"
    }
    fn get_download_url(&self) -> Result<String, String> {
        config::get_dsh_download_url()
    }
    fn get_install_path(&self, app: &AppHandle) -> PathBuf {
        config::get_dsh_install_path(app)
    }
    fn check_installed(&self, app: &AppHandle) -> bool {
        config::get_dsh_binary_path(app).exists()
    }
}

// --- pnpm 实现（dsh 的 plugin 命令依赖） ---
pub struct Pnpm;

#[async_trait]
impl Installable for Pnpm {
    fn kind(&self) -> InstallKind {
        InstallKind::Pnpm
    }
    fn title(&self) -> &str {
        "pnpm 包管理器"
    }
    fn get_download_url(&self) -> Result<String, String> {
        Ok(config::get_pnpm_download_url())
    }
    fn get_install_path(&self, app: &AppHandle) -> PathBuf {
        config::get_pnpm_install_path(app)
    }
    fn check_installed(&self, app: &AppHandle) -> bool {
        if config::offline_build() {
            let Some(expected) = crate::service::download::load_offline_manifest(app)
                .ok()
                .flatten()
                .and_then(|manifest| manifest.asset("pnpm").ok().map(|asset| asset.version.clone()))
            else {
                return false;
            };
            if !config::get_pnpm_binary_path(app).is_file() {
                return false;
            }
            let manifest = config::get_pnpm_install_path(app).join("package.json");
            let Ok(content) = std::fs::read_to_string(manifest) else {
                return false;
            };
            return serde_json::from_str::<serde_json::Value>(&content)
                .ok()
                .and_then(|value| value.get("version")?.as_str().map(str::to_string))
                .is_some_and(|version| version == expected);
        }
        // "有则跳过"：用户 PATH 中已有 pnpm 时不再安装捆绑版
        if crate::service::cli::find_user_pnpm(app).is_some() {
            log::info!("Detected user-installed pnpm, skipping bundled pnpm");
            return true;
        }
        config::get_pnpm_binary_path(app).exists()
    }
}

// --- Windows Git 实现（插件的 git 托管依赖需要） ---
#[cfg(windows)]
pub struct Git;

#[cfg(windows)]
#[async_trait]
impl Installable for Git {
    fn kind(&self) -> InstallKind {
        InstallKind::Git
    }
    fn title(&self) -> &str {
        "Git 环境"
    }

    fn get_download_url(&self) -> Result<String, String> {
        config::get_mingit_download_url()
    }

    fn get_install_path(&self, app: &AppHandle) -> PathBuf {
        config::get_mingit_install_path(app)
    }

    fn check_installed(&self, app: &AppHandle) -> bool {
        if config::offline_build() {
            return config::bundled_git_runtime_ready(app);
        }
        if let Some(system_git) = config::find_system_git_binary() {
            log::info!(
                "Detected usable system Git ({}), skipping bundled MinGit",
                system_git.display()
            );
            return true;
        }
        config::git_runtime_ready(app)
    }
}
