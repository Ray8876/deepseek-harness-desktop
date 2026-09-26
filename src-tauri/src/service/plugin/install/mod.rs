//! 预装插件安装：校验选中项、准备环境（pnpm/dsh shim、按需补齐捆绑 pnpm、
//! 停止运行中的服务），随后调用 `dsh plugin --profile web add <specs...>`，
//! 成功后执行 Windows 极简模式专项修复。
//!
//! pnpm 对两类构建脚本默认不放行、缺白名单时报硬错误：
//! 1. git 托管插件的 `prepare` 构建（`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`）——
//!    其允许键随 pnpm 的克隆方式变化（git+ssh#sha / codeload tar.gz），无法预先确定；
//! 2. 传递依赖的原生构建（如 `node-pty`，`ERR_PNPM_IGNORED_BUILDS`）。
//!    因此从 pnpm 错误输出解析它建议的允许键，写入 profile 的
//!    `pnpm-workspace.yaml` 后重试，直至成功或无可解析项。
//!
//! pnpm 10 与 11 对放行项的配置键与输出形式不同（均由各自报错提示决定，只能运行期
//! 读取，见 [`allowlist::parse_allowlist_keys`] 与 [`allowlist::apply_allow_build_keys`]）：
//! - pnpm 10（旧 store 复用用户版）只认 `onlyBuiltDependencies`（list 形式）；
//! - pnpm 11（捆绑版）认 `allowBuilds`（map 形式）。
//!   应用会把同一批包名同时写入这两个键，保证任一版本 pnpm 都能读到放行项。
//!
//! 关键陷阱：pnpm v11 在 `allowBuilds` 阻断时可能仍以 **exit 0** 退出（假成功），
//! 所以重试逻辑不能只看退出码（见 [`run_plugin_with_allow_build_retry`]），安装成功
//! 后还会核验 `node_modules` 产物是否真实落盘（见 [`artifact::verify_installed_products`]），
//! 并就地补构建缺失的声明入口（见 [`artifact::ensure_plugin_entry_built`]）。
//!
//! 模块划分（`install/`）：
//! - [`self`]：安装编排入口（install / install_internal）与 allowBuilds 重试循环
//! - [`single`]：单插件升级/卸载（`dsh plugin update/remove`，卸载后核验 + 离线兜底、
//!   弃用插件自动卸载）
//! - [`spec`]：安装 spec 准备（内置插件捆绑目录、GitHub 简写规范化、Windows 引号）
//! - [`env`]：`dsh plugin` 子进程环境（$DSH_HOME 隔离、git HTTPS 强制）
//! - [`pnpm`]：pnpm 选版与版本探测（store 主版本感知、捆绑版补齐、有界 probe 监控）
//! - [`allowlist`]：构建放行白名单解析与 pnpm-workspace.yaml 写回
//! - [`diagnose`]：失败输出解析（网络 / git 传输层 / ANSI 清洗与消息挑选）
//! - [`artifact`]：安装产物落盘核验（防「假成功」）+ 声明入口就地补构建

use crate::config;
use crate::service::cli;
use crate::service::core;
use crate::service::profile::active_profile;
use crate::service::workflow;
use std::collections::HashMap;
use std::ffi::OsString;
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

// plugin 兄弟模块的再导出：子模块经 `super::` 统一从这里取，跨模块边界只在此定义。
pub(crate) use super::ensure_profile_npmrc;
pub(crate) use super::errors;
pub(crate) use super::installed::{installed_name, is_installed, profile_dir};
pub(crate) use super::preset::{
    bundled_dep_spec, bundled_plugin_dir, load_deprecated_ids, load_presets, PreinstallPluginInfo,
};
pub(crate) use super::process::{
    acquire_operation_lock, acquire_process_lock, new_process_owner, run_plugin_process, PidGuard,
    PreinstallLogPayload, ProcessOwner, PREINSTALL_LOG_EVENT,
};
pub(crate) use super::recovery::is_actionable_plugin_ref;
pub(crate) use super::uninstall_recovery;
pub(crate) use crate::service::profile::ensure_profile_pnpm_policy;

mod allowlist;
mod artifact;
mod diagnose;
mod env;
mod pnpm;
mod single;
mod spec;

// 子模块对外 API：plugin 兄弟模块（verify / internal 等）与安装编排共用
pub(crate) use env::build_plugin_envs;
pub(crate) use pnpm::{
    bundled_pnpm_major, harness_prefer_bundled_pnpm, pnpm_major_version_at, profile_store_major,
};
pub(crate) use single::uninstall_deprecated_plugins;
pub use single::{remove, update};

use allowlist::{add_allow_build_keys, parse_allowlist_keys};
use artifact::{ensure_plugin_entry_built, verify_installed_products};
use diagnose::{
    diagnostic_suffix, git_transport_hint, network_error_hint, pick_error_message,
    policy_verification_network_failure, store_mismatch_hint,
};
use pnpm::ensure_pnpm;
use spec::{bundled_dir_of, normalize_git_spec, preset_spec_for_install, spec_argument};

/// 允许构建重试的上限。每次重试解决 pnpm 报出的一个允许键（git depPath 或
/// 传递构建包名），多个 git 插件 / 多个原生依赖各占一次，上限封顶防死循环。
const MAX_ALLOW_LIST_RETRIES: usize = 8;

/// 瞬时文件系统错误的重试上限。Windows 下 `dsh plugin add` 重建内置插件的
/// 链接（junction / reparse point）后立即回读其 `package.json` 会随机失败：
/// libuv 报 `UV_UNKNOWN`（退出码 -4094，输出含 `[UNKNOWN] unknown error, open ...`），
/// 一次随机失败就让整个安装放弃——`link:` 依赖没有写入 profile `package.json`，
/// 下次启动又判定 `dep_ok=false` 而重装，形成不可恢复的启动死循环（issue #264）。
/// 该失败是「刚重建的 reparse point 落定 / 实时杀软扫刚写入路径」的瞬时态，重跑
/// 同一 `dsh plugin add` 即可越过。首启期间杀软可能持续占用新文件，短暂的固定重试
/// 窗口不足以覆盖扫描时间，因此使用指数退避扩大到约两分钟的恢复窗口。
const TRANSIENT_FS_RETRIES: usize = 8;
/// 瞬时文件系统错误的首次重试延迟；后续延迟按指数增长，最多 64 秒。
const TRANSIENT_FS_RETRY_DELAY: std::time::Duration = std::time::Duration::from_secs(1);

fn transient_fs_retry_delay(retry: usize) -> std::time::Duration {
    let seconds = TRANSIENT_FS_RETRY_DELAY
        .as_secs()
        .checked_shl(retry.saturating_sub(1) as u32)
        .unwrap_or(64)
        .min(64);
    std::time::Duration::from_secs(seconds)
}

/// lockfile supply-chain 校验因 registry 元数据拉不到而误判违规时的重试上限
/// （见 [`policy_verification_network_failure`]）。实测 registry 短暂不可用能让
/// 「已发布三周的 entry」连续失败数分钟：pnpm 自己重试两轮后放弃，这里再按退避
/// 把窗口拉到约一分钟以覆盖这类抖动；不设更大上限是因为每次重试都要重跑整条
/// `dsh plugin add`。
const POLICY_VERIFICATION_RETRIES: usize = 4;
/// 该重试的首次延迟；后续延迟按指数增长，最多 30 秒。
const POLICY_VERIFICATION_RETRY_DELAY: std::time::Duration = std::time::Duration::from_secs(5);

fn policy_verification_retry_delay(retry: usize) -> std::time::Duration {
    let seconds = POLICY_VERIFICATION_RETRY_DELAY
        .as_secs()
        .checked_shl(retry.saturating_sub(1) as u32)
        .unwrap_or(30)
        .min(30);
    std::time::Duration::from_secs(seconds)
}

pub async fn install(app_handle: &AppHandle, ids: &[String]) -> Result<(), String> {
    install_with_cancel(app_handle, ids, None, new_process_owner()).await
}

/// 内置插件启动自愈专用入口：取消信号会阻止被结束的 pnpm/dsh 进程再次进入
/// allowBuilds 重试，确保硬上限之后不会悄悄拉起下一棵进程树。
pub(crate) async fn install_internal(
    app_handle: &AppHandle,
    ids: &[String],
    cancel: tokio::sync::watch::Receiver<bool>,
    owner: ProcessOwner,
) -> Result<(), String> {
    install_with_cancel(app_handle, ids, Some(cancel), owner).await
}

async fn install_with_cancel(
    app_handle: &AppHandle,
    ids: &[String],
    cancel: Option<tokio::sync::watch::Receiver<bool>>,
    owner: ProcessOwner,
) -> Result<(), String> {
    if ids.is_empty() {
        return Err("PREINSTALL_EMPTY: no plugins selected".to_string());
    }

    // 单次读取预设并构建查找表，提升算法效率至 O(N)
    let presets = load_presets(app_handle);
    let preset_map: HashMap<&str, &PreinstallPluginInfo> =
        presets.iter().map(|p| (p.id.as_str(), p)).collect();

    let mut specs = Vec::with_capacity(ids.len());
    let mut needs_git = false;
    // 是否给含空格的 spec 预加引号取决于活动核心的 `dsh plugin` 实现（见
    // [`spec_argument`]）：0.1.6-alpha.2 起 pnpm 由 argv 数组启动，预加引号会变成
    // spec 的一部分（issue #647）。
    let core_version = crate::service::core::active_version(app_handle);
    for id in ids {
        let preset = preset_map
            .get(id.as_str())
            .ok_or_else(|| format!("PREINSTALL_INVALID_ID: {id}"))?;
        // 内置插件改为从随包分发的捆绑目录安装（`link:` 本地联接依赖，见
        // preset::bundled_dep_spec；不用 `file:`——pnpm 对盘符冒号的绝对路径
        // 会当相对路径解析），其余沿用清单声明的 spec；随后统一把
        // `github:user/repo` 规范为显式 `git+https://...`，绕开 pnpm 对
        // GitHub 简写「HTTPS 探测失败即回退 SSH」的已知缺陷（pnpm issue
        // #3948 / #7243 / #13276）：公开仓库一旦落进 git+ssh，在没有 SSH 配置
        // 的桌面机上必然 `Host key verification failed` / `Permission denied (publickey)`。
        //
        // 最后按活动核心决定是否为含空格的 spec 加内嵌双引号：0.1.6-alpha.2 起
        // dsh CLI 改用 execa 以 argv 数组启动 pnpm，参数不再经 shell 拼接，预加引号
        // 只会让 pnpm 收到带字面引号的 spec（issue #647）；更早的核心在 win32 用
        // `shell:true` 把参数拼成命令行（Node 只拼接、不转义，DEP0190），含空格的
        // 内置插件路径（`link:<应用安装目录>`）不预加引号就会被切碎成多个 spec，
        // pnpm 报 `ERR_PNPM_SPEC_NOT_SUPPORTED`、启动自愈每轮重装（死循环）。两种
        // 形态落盘 `package.json` 的值都是不带引号的 `link:<路径>`，与内核
        // 对账的 `expected`（bundled_dep_spec）一致（见 [`spec_argument`]）。
        let raw = normalize_git_spec(&preset_spec_for_install(
            preset,
            bundled_dir_of(app_handle, preset),
            core_version.as_deref(),
        )?);
        if config::offline_build()
            && !raw.starts_with("link:")
            && !raw.starts_with("file:")
        {
            return Err(
                "OFFLINE_PLUGIN_NETWORK_REQUIRED: community plugin installation requires network access"
                    .to_string(),
            );
        }
        // 规范化后 `git+...` 前缀即 git 托管依赖：pnpm 安装时需要实际可用的 git
        // （见下方预检）；npm 包名（如 `dshmarket`）与 `link:` 本地依赖无需 git。
        if raw.starts_with("git+") {
            needs_git = true;
        }
        specs.push(spec_argument(&raw, core_version.as_deref()));
    }

    // git 托管插件安装前预检（issue #369）：Linux/macOS 完全依赖系统 git（不在
    // 空白 Windows 自动配置范围，`config::git_runtime_ready` 非 Windows 恒真），
    // 系统缺 git 时 `pnpm spawn git` 直接 ENOENT，用户只看到裸错误 + 误导性的
    // allowBuilds 提示。启动子进程前实际探测 git 可执行能否运行，缺失时给出
    // 可读失败原因与修复指引，而不是等 pnpm 装到一半才失败。
    if needs_git && !env::git_available(app_handle) {
        return Err(
            "GIT_NOT_FOUND: selected plugins include git-hosted dependencies, but no usable git \
             was found on this system. Install git (e.g. Debian/Ubuntu: `sudo apt install git`; \
             macOS: `brew install git`) or uncheck those plugins and retry."
                .to_string(),
        );
    }

    // 确保 pnpm/dsh shim 存在
    cli::ensure_shims(app_handle)?;

    let node = config::get_node_binary_path(app_handle);
    // 活动核心的 dsh 入口：本地核心存在时用本地 CLI，否则预打包
    let dsh_bin = core::active_dsh_binary(app_handle);
    if !node.exists() {
        return Err("NODE_NOT_FOUND: Node.js runtime missing".to_string());
    }
    if !dsh_bin.exists() {
        return Err("HARNESS_NOT_FOUND: dsh CLI missing".to_string());
    }

    let window = app_handle
        .get_webview_window("main")
        .ok_or("WINDOW_NOT_FOUND: main window missing")?;

    // 选定/补齐安装用的 pnpm：返回是否应强制使用捆绑版（版本感知，见 ensure_pnpm）
    let prefer_bundled_pnpm = ensure_pnpm(app_handle, &window, owner).await?;
    // 首次安装可能早于服务启动；提前写入非交互清理配置，避免 pnpm 在无 TTY
    // 环境以 ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY 中止（issue #130）。
    super::ensure_profile_npmrc(app_handle)?;
    // 旧档案可能由早期版本创建，没有同步 Harness 的最小发布时间例外；补齐
    // 精确的已审查 zod 版本，避免 registry 元数据瞬时失败阻断插件安装（issue #222）。
    super::ensure_profile_pnpm_policy(app_handle)?;
    // 安装前停止运行中的服务，避免资源冲突。
    // 记录停服结果：停服失败意味着服务可能仍在运行、插件目录可能被写入，
    // 此时创建快照会捕获不一致状态，因此停服失败时跳过快照（不终止安装）。
    let mut stopped = true;
    if workflow::has_owned_process() {
        // 停服务会让用户感到"重启"，先在日志面板讲清缘由（issue #48）
        let _ = window.emit(
            PREINSTALL_LOG_EVENT,
            PreinstallLogPayload {
                line: "[harness] 正在停止运行中的服务（安装插件需要短暂重启）…".to_string(),
            },
        );
        log::info!("Stopping running harness service before installing plugins");
        stopped = match workflow::stop(app_handle.clone()).await {
            Ok(()) => true,
            Err(e) => {
                log::warn!("failed to stop harness before plugin install: {e}");
                false
            }
        };
    }
    // 安装/升级前自动快照已安装的插件（覆盖式），失败仅告警不阻断安装。
    // 仅在服务已确认停止后执行，保证快照一致
    // （issue #303：自动快照失败不阻塞主流程，避免升级被陈旧快照问题拖垮）。
    if stopped {
        for id in ids {
            if is_installed(app_handle, id) {
                super::snapshot::create_best_effort(app_handle, id);
            }
        }
    }

    let envs = build_plugin_envs(app_handle, prefer_bundled_pnpm);

    // 拼装命令行参数
    let mut args = vec![
        dsh_bin.as_os_str().to_os_string(),
        OsString::from("plugin"),
        OsString::from("--profile"),
        OsString::from(active_profile(app_handle)),
        OsString::from("add"),
    ];
    args.extend(specs.iter().map(|s| OsString::from(s.as_str())));

    let cwd = config::get_dsh_install_path(app_handle);
    // 日志打印实际传给 dsh 的 spec（此前打印 id 会误导排查：安装用的是 spec）
    log::info!("Running dsh plugin install for {specs:?}");

    // `dsh plugin add` 在 profile 目录里驱动 pnpm。pnpm v11 会拦下 git 托管
    // 插件的 prepare 构建与传递原生依赖（见模块头注），其允许键不可预知，因此
    // 失败时解析输出里印出的 `allowBuilds` 键写回 profile 的 pnpm-workspace.yaml
    // 后重试，直至成功或再无键可加（升级路径同样依赖该重试，见
    // [`run_plugin_with_allow_build_retry`]）。
    let (exit_code, last_output, last_attempt) = run_plugin_install_with_transient_retry(
        app_handle,
        &node,
        &args,
        &cwd,
        &envs,
        &window,
        "install",
        cancel.as_ref(),
        owner,
    )
    .await?;

    if exit_code != 0 {
        log::error!("dsh plugin install failed with exit code {exit_code}");
        // 先无条件落一行 pnpm 原始诊断：后面的分类文案（网络 / store 指引）会丢掉细节，
        // 而用户贴进 issue 的日志必须能看到 pnpm 究竟报了什么。
        let detail = pick_error_message(&last_output, None);
        if !detail.is_empty() {
            log::error!("dsh plugin install diagnostic: {detail}");
        }
        // 区分 git 传输层失败与 allowBuilds 构建门禁：前者是 pnpm 走了 git+ssh
        // （用户环境无 SSH 配置），后者才是补充白名单可自愈的。传输层错误给出
        // 可读指引，避免用户被 dsh 那条 allowBuilds 提示误导。
        //
        // 分类一律只读**最后一次尝试**的输出：`last_output` 是历次 allowBuilds 重试的
        // 拼接串，早先一次的网络字样（`fetch failed`/`econnreset` 等）会给最终一次的真·
        // 发布时间违规「背书」，把失败原因整体归错。拼接串仍只用于日志与用户可见的诊断文本。
        let network_error = network_error_hint(&last_attempt).is_some()
            || policy_verification_network_failure(&last_attempt)
            || (exit_code == 3 && last_attempt.trim().is_empty());
        let hint = git_transport_hint(&last_attempt);
        let store_hint = store_mismatch_hint(&last_attempt);
        let network_hint = network_error.then_some(
            "NETWORK_ERROR: plugin registry request failed; check network or proxy settings and retry.",
        );
        let message = if network_error {
            network_hint.unwrap_or_default().to_string()
        } else if let Some(store_hint) = store_hint.as_deref() {
            store_hint.to_string()
        } else {
            pick_error_message(&last_output, hint)
        };
        // 批量安装失败时给本次选中的每个插件记一条错误（前端据此展示异常标记，
        // 可针对单个插件重试更新/卸载）
        for id in ids {
            if let Err(e) = errors::record(app_handle, id, "install", &message) {
                log::warn!("failed to record plugin error for {id}: {e}");
            }
        }
        if let Some(network_hint) = network_hint {
            log::warn!("network failure detected during plugin install: {network_hint}");
            let _ = window.emit(
                PREINSTALL_LOG_EVENT,
                PreinstallLogPayload {
                    line: format!("[network] {network_hint}"),
                },
            );
            // network_hint 已带 NETWORK_ERROR: 前缀，直接返回避免双重前缀
            return Err(network_hint.to_string());
        }
        if let Some(hint) = hint {
            log::warn!("git transport failure detected during plugin install: {hint}");
            let _ = window.emit(
                PREINSTALL_LOG_EVENT,
                PreinstallLogPayload {
                    line: format!("[pnpm] {hint}"),
                },
            );
            return Err(format!(
                "PREINSTALL_FAILED: dsh plugin exited with code {exit_code} ({hint})"
            ));
        }
        // pnpm 因档案 node_modules 与当前 pnpm 的 store 布局不匹配而拒绝安装：
        // 报错正文里的两条 store 路径会被 pick_error_message 丢掉，这里补上可读
        // 指引，避免用户只看到「插件安装失败」。
        if let Some(store_hint) = store_hint {
            log::warn!("pnpm store incompatibility detected during plugin install: {store_hint}");
            let _ = window.emit(
                PREINSTALL_LOG_EVENT,
                PreinstallLogPayload {
                    line: format!("[pnpm] {store_hint}"),
                },
            );
            return Err(format!(
                "PREINSTALL_FAILED: dsh plugin exited with code {exit_code} ({store_hint})"
            ));
        }
        let detail = pick_error_message(&last_output, None);
        return Err(format!(
            "PREINSTALL_FAILED: dsh plugin exited with code {exit_code}{}",
            diagnostic_suffix(&detail)
        ));
    }

    // 真正修复：核验本次安装是否真实落盘。pnpm 可能在 allowBuilds 阻断时仍以
    // exit 0 退出（假成功），若产物缺失则记录错误并返回 Err，让前端如实展示失败、
    // 允许重试，而不是误报「已安装」。已落盘的插件在上一步被核验并清除历史错误。
    verify_installed_products(app_handle, ids, &preset_map, &last_output)?;

    // 产物级核验：包已落盘但声明入口（如 `lib/index.js`）未构建时，本次安装
    // 同样是假成功——cordis 加载器在下一次启动必然 ERR_MODULE_NOT_FOUND 崩溃
    // （见 [`ensure_plugin_entry_built`]）。就地补构建或如实报错，不让坏态
    // 静默进入下一次启动；包目录按预设的 `installed_name` 解析（scoped 插件
    // 与 id 不同名），失败跨插件聚合后一次性返回，前端可一并重试。
    let mut entry_errors = Vec::new();
    for id in ids {
        let Some(preset) = preset_map.get(id.as_str()) else {
            continue;
        };
        let pkg_dir = profile_dir(app_handle)
            .join("node_modules")
            .join(installed_name(preset));
        if let Err(e) = ensure_plugin_entry_built(app_handle, id, &pkg_dir, &envs, &window).await {
            if let Err(err) = errors::record(app_handle, id, "install", &e) {
                log::warn!("failed to record plugin error for {id}: {err}");
            }
            entry_errors.push(format!("{id}: {e}"));
        }
    }
    if !entry_errors.is_empty() {
        return Err(format!(
            "PREINSTALL_ENTRY_FAILED:\n{}",
            entry_errors.join("\n")
        ));
    }

    // 告知用户安装阶段结束；随后的服务重启由前端 continueAfterPreinstall 负责
    let _ = window.emit(
        PREINSTALL_LOG_EVENT,
        PreinstallLogPayload {
            line: format!("[harness] 已安装 {} 个插件", ids.len()),
        },
    );

    log::info!("Preinstall plugins installed successfully: {ids:?}");
    Ok(())
}

/// 返回 `(exit_code, 历次尝试的输出拼接, 最后一次尝试的输出)`。
///
/// 两个字符串用途不同：诊断与用户文案要拼接（早期的 allowBuilds 提示也是线索），而
/// **失败分类只能看最后一次尝试**——拼接串里早先一次的网络字样会与最终一次的真实原因
/// 互相「佐证」，把失败归类错（如把真·供应链违规判成网络抖动，见
/// [`policy_verification_network_failure`]）。
#[allow(clippy::too_many_arguments)]
async fn run_plugin_with_allow_build_retry(
    app_handle: &AppHandle,
    node: &Path,
    args: &[OsString],
    cwd: &Path,
    envs: &HashMap<String, String>,
    window: &WebviewWindow,
    action: &str,
    cancel: Option<&tokio::sync::watch::Receiver<bool>>,
    owner: ProcessOwner,
) -> Result<(i32, String, String), String> {
    let _operation_guard = acquire_operation_lock().await;
    // 上一次被强杀的安装（取消 / 刷新 / 退出）会在 profile 里留下 dsh 的孤儿写锁，
    // 之后每次安装都要静默等到 deadline。dsh 侧不做恢复，这里按 PID 存活代劳。
    super::process::clear_orphan_plugin_writer_lock(&super::installed::profile_dir(app_handle));
    let mut retries = 0usize;
    let mut all_output = String::new();
    let mut last_attempt = String::new();
    let exit_code = loop {
        if cancel.is_some_and(|signal| *signal.borrow()) {
            return Err("PLUGIN_OPERATION_CANCELLED: plugin operation was cancelled".to_string());
        }
        let (code, captured) = run_plugin_process(node, args, cwd, envs, window, owner).await?;
        if cancel.is_some_and(|signal| *signal.borrow()) {
            return Err("PLUGIN_OPERATION_CANCELLED: plugin operation was cancelled".to_string());
        }
        append_command_output(&mut all_output, &captured);
        let new_keys = parse_allowlist_keys(&captured);
        // 本次尝试要么即将 continue 重试、要么即将 break 收尾；两种情况都以后者为准，
        // 所以每次都记下它，最终留在 `last_attempt` 的就是决定退出码的那一次。
        last_attempt = captured;
        // 有可补充的 allowBuilds 键且未达上限 → 写入并重试（无论本次退出码是否为 0，
        // 见上方注释：pnpm 可能在阻断时仍以 0 退出）。
        if !new_keys.is_empty() && retries < MAX_ALLOW_LIST_RETRIES {
            retries += 1;
            add_allow_build_keys(app_handle, &new_keys)?;
            log::info!("pnpm allowBuilds updated with {new_keys:?}, retrying {action} ({retries})");
            let _ = window.emit(
                PREINSTALL_LOG_EVENT,
                PreinstallLogPayload {
                    line: format!("[pnpm] 已放行插件构建（allowBuilds），重试{action}…"),
                },
            );
            continue;
        }
        // 到达重试上限仍解析到待放行键：pnpm 的 exit 0 在 allowBuilds 场景不可信，
        // 直接视为失败（即便退出码为 0），交由调用方走失败 / 产物核验分支。
        if !new_keys.is_empty() {
            log::error!(
                "dsh plugin {action}: allowBuilds retry limit reached ({retries}), keys {new_keys:?} unresolved"
            );
            break if code == 0 { 1 } else { code };
        }
        if code != 0 {
            log::error!(
                "dsh plugin {action} failed with exit code {code}; no allowBuilds entries to add"
            );
        }
        break code;
    };
    Ok((exit_code, all_output, last_attempt))
}

/// 以带瞬时文件系统错误重试的方式运行 `dsh plugin <action>`（`add` 专用路径）。
///
/// [`run_plugin_with_allow_build_retry`] 只处理 pnpm 的 allowBuilds 门禁重试；这里再包
/// 一层针对「reparse point 刚重建即被回读」的瞬时失败（issue #264）：Windows 下 pnpm
/// 重建内置插件链接后立即读回 `package.json`，libuv 会随机报 `UV_UNKNOWN`（退出码
/// -4094）、输出含 `[UNKNOWN] unknown error, open ...`。一次随机失败就放弃安装，会让
/// `link:` 依赖没有落盘，下次启动又判 `dep_ok=false` 再装 → 启动死循环。
///
/// 识别到瞬时失败后再跑一次完整命令（有界，见 [`TRANSIENT_FS_RETRIES`]），每次重试前
/// 短暂休眠等 reparse point 落定 / 杀软扫完；该失败是概率性的，重试即大概率越过。
#[allow(clippy::too_many_arguments)]
async fn run_plugin_install_with_transient_retry(
    app_handle: &AppHandle,
    node: &Path,
    args: &[OsString],
    cwd: &Path,
    envs: &HashMap<String, String>,
    window: &WebviewWindow,
    action: &str,
    cancel: Option<&tokio::sync::watch::Receiver<bool>>,
    owner: ProcessOwner,
) -> Result<(i32, String, String), String> {
    let mut attempt = 0usize;
    let mut policy_attempt = 0usize;
    loop {
        let (exit_code, output, last_attempt) = run_plugin_with_allow_build_retry(
            app_handle, node, args, cwd, envs, window, action, cancel, owner,
        )
        .await?;
        // 先判网络类：pnpm 把「元数据拉不到」渲染成供应链违规，重跑整条命令最有效。
        // 判定只看最后一次尝试的输出（原因见 run_plugin_with_allow_build_retry 的返回值说明）。
        if exit_code != 0
            && policy_attempt < POLICY_VERIFICATION_RETRIES
            && policy_verification_network_failure(&last_attempt)
        {
            policy_attempt += 1;
            let delay = policy_verification_retry_delay(policy_attempt);
            log::warn!(
                "dsh plugin {action} failed the lockfile supply-chain check because registry \
                 metadata could not be fetched; retrying ({policy_attempt}/{POLICY_VERIFICATION_RETRIES}) \
                 after {delay:?}"
            );
            let _ = window.emit(
                PREINSTALL_LOG_EVENT,
                PreinstallLogPayload {
                    line: format!(
                        "[harness] registry 元数据拉取失败，依赖校验未通过，正在重试（{policy_attempt}/{POLICY_VERIFICATION_RETRIES}）…"
                    ),
                },
            );
            if sleep_or_cancelled(delay, cancel).await {
                return Err(
                    "PLUGIN_OPERATION_CANCELLED: plugin operation was cancelled".to_string()
                );
            }
            continue;
        }
        if exit_code != 0
            && attempt < TRANSIENT_FS_RETRIES
            && is_transient_fs_install_failure(exit_code, &last_attempt)
        {
            attempt += 1;
            let delay = transient_fs_retry_delay(attempt);
            log::warn!(
                "dsh plugin {action} hit a transient filesystem error (exit code {exit_code}); \
                 retrying ({attempt}/{TRANSIENT_FS_RETRIES}) after {delay:?}"
            );
            let _ = window.emit(
                PREINSTALL_LOG_EVENT,
                PreinstallLogPayload {
                    line: format!(
                        "[harness] 插件安装遇到瞬时文件系统错误，正在重试（{attempt}/{TRANSIENT_FS_RETRIES}）…"
                    ),
                },
            );
            if sleep_or_cancelled(delay, cancel).await {
                return Err(
                    "PLUGIN_OPERATION_CANCELLED: plugin operation was cancelled".to_string()
                );
            }
            continue;
        }
        return Ok((exit_code, output, last_attempt));
    }
}

/// 退避等待，且能被 `cancel` 立即打断（返回 true 表示等待期间被取消）。
///
/// 直接 `tokio::time::sleep` 会让取消最多等到退避结束（供应链校验 30s、瞬时文件系统
/// 64s）：用户点了取消，安装却还在转圈。每轮尝试前另有取消检查兜底，这里只负责不让
/// 退避本身成为最长的一段等待。
///
/// 只有值变成 `true` 才算取消：`watch` 的任何一次写入都会唤醒 `changed()`，包括写入
/// `false` 与发送端被 drop（`changed()` 返回 `Err`）——那些情况必须继续等满退避，否则
/// 一次无关的唤醒就能让重试提前发生，退避形同虚设。
async fn sleep_or_cancelled(
    delay: std::time::Duration,
    cancel: Option<&tokio::sync::watch::Receiver<bool>>,
) -> bool {
    let Some(signal) = cancel else {
        tokio::time::sleep(delay).await;
        return false;
    };
    // 两个副本分工：`signal` 只用于等待变更（`changed` 需要 &mut），`probe` 只用于读值，
    // 免得 select 的处理分支里同时借可变与不可变。
    let mut signal = signal.clone();
    let probe = signal.clone();
    if *probe.borrow() {
        return true;
    }
    let timer = tokio::time::sleep(delay);
    tokio::pin!(timer);
    loop {
        tokio::select! {
            _ = &mut timer => return false,
            changed = signal.changed() => {
                if *probe.borrow() {
                    return true;
                }
                if changed.is_err() {
                    // 发送端已 drop：值不可能再变 true，跳出后等满退避如实返回。
                    break;
                }
            }
        }
    }
    timer.await;
    false
}

/// 判断 `dsh plugin` 失败是否为「刚重建的链接被立即回读」的瞬时文件系统错误。
///
/// 特征：退出码 `-4094`（libuv `UV_UNKNOWN`），或输出含 Node 对该错误的通用描述
/// `[UNKNOWN] unknown error`（fs.open 等对 reparse point 的读取）。非 Windows 命中
/// 同名错误也一并重试（幂等无害：重试上限有界，最坏只是多等一小段再如实失败）。
fn is_transient_fs_install_failure(exit_code: i32, output: &str) -> bool {
    if exit_code == -4094 {
        return true;
    }
    let lower = output.to_ascii_lowercase();
    lower.contains("[unknown]") || lower.contains("unknown error")
}

/// 合并单次命令输出，并在相邻尝试之间补换行，保证后续错误解析不会粘连两段日志。
pub(super) fn append_command_output(all_output: &mut String, captured: &str) {
    if captured.is_empty() {
        return;
    }
    if !all_output.is_empty() && !all_output.ends_with('\n') {
        all_output.push('\n');
    }
    all_output.push_str(captured);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_output_retains_earlier_retry_diagnostics() {
        let mut output = String::new();
        append_command_output(&mut output, "ERR_PNPM_IGNORED_BUILDS");
        append_command_output(&mut output, "");

        assert_eq!(output, "ERR_PNPM_IGNORED_BUILDS");
    }

    #[test]
    fn transient_fs_failure_detects_uv_unknown_exit_code() {
        assert!(is_transient_fs_install_failure(-4094, ""));
        assert!(is_transient_fs_install_failure(
            -4094,
            "some unrelated output"
        ));
    }

    #[test]
    fn transient_fs_failure_detects_unknown_error_open_message() {
        // 与 issue #264 报告中一致的特征串：Node fs.open 通过刚重建的 junction
        // 读回 package.json 时随机 `UV_UNKNOWN`。
        let output = "[UNKNOWN] unknown error, open 'C:\\Users\\x\\.dsh\\profiles\\web\\node_modules\\dsh-tauri\\package.json'";
        assert!(is_transient_fs_install_failure(1, output));
        // `[unknown]` / `unknown error` 大小写不敏感
        assert!(is_transient_fs_install_failure(
            1,
            &output.to_ascii_lowercase()
        ));
    }

    #[test]
    fn transient_fs_retry_delay_uses_exponential_backoff() {
        assert_eq!(
            transient_fs_retry_delay(1),
            std::time::Duration::from_secs(1)
        );
        assert_eq!(
            transient_fs_retry_delay(2),
            std::time::Duration::from_secs(2)
        );
        assert_eq!(
            transient_fs_retry_delay(8),
            std::time::Duration::from_secs(64)
        );
    }

    #[test]
    fn policy_verification_retry_delay_uses_capped_exponential_backoff() {
        assert_eq!(
            policy_verification_retry_delay(1),
            std::time::Duration::from_secs(5)
        );
        assert_eq!(
            policy_verification_retry_delay(2),
            std::time::Duration::from_secs(10)
        );
        assert_eq!(
            policy_verification_retry_delay(4),
            std::time::Duration::from_secs(30)
        );
    }

    #[test]
    fn transient_fs_failure_rejects_ordinary_failures() {
        assert!(!is_transient_fs_install_failure(
            1,
            "ERR_PNPM_SPEC_NOT_SUPPORTED"
        ));
        assert!(!is_transient_fs_install_failure(
            254,
            "ENOENT: no such file"
        ));
        assert!(!is_transient_fs_install_failure(
            3,
            "ERR_PNPM_FETCH_404 registry error"
        ));
    }

    #[test]
    fn transient_fs_failure_treats_exit_zero_output_as_transient_detection_only() {
        // 检测函数只看输出特征；是否为「失败」由调用方用 exit_code != 0 判定。
        // 假成功（exit 0）场景交由产物核验分支处理，不会因这里返回真而误重试。
        assert!(is_transient_fs_install_failure(0, "unknown error, open"));
    }

    #[tokio::test]
    async fn sleep_or_cancelled_returns_immediately_when_cancelled() {
        let (tx, rx) = tokio::sync::watch::channel(false);
        let wait = sleep_or_cancelled(std::time::Duration::from_secs(30), Some(&rx));
        // 退避远长于测试：只有被取消打断才来得及在这里断言（否则本测试会挂 30 秒）。
        let cancel = async {
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            let _ = tx.send(true);
        };

        let (cancelled, ()) = tokio::join!(wait, cancel);

        assert!(cancelled);
    }

    #[tokio::test]
    async fn sleep_or_cancelled_waits_out_the_delay_without_a_cancel_signal() {
        let (_tx, rx) = tokio::sync::watch::channel(false);

        // 值一直是 false（未取消）→ 等满退避后返回 false
        assert!(!sleep_or_cancelled(std::time::Duration::from_millis(10), Some(&rx)).await);
        // 没有取消通道（单插件路径传 None）→ 等价于普通 sleep
        assert!(!sleep_or_cancelled(std::time::Duration::from_millis(10), None).await);
    }

    #[tokio::test]
    async fn sleep_or_cancelled_ignores_false_updates_during_the_wait() {
        let (tx, rx) = tokio::sync::watch::channel(false);
        let started = std::time::Instant::now();
        // 等待期间两次写入 false：`watch` 的每次写入都会唤醒 `changed()`，若把它当成
        // 「已取消/已结束」，退避会被缩短到 40ms 左右。
        let wait = sleep_or_cancelled(std::time::Duration::from_millis(150), Some(&rx));
        let noise = async {
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
            let _ = tx.send(false);
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
            let _ = tx.send(false);
        };

        let (cancelled, ()) = tokio::join!(wait, noise);

        assert!(!cancelled);
        assert!(
            started.elapsed() >= std::time::Duration::from_millis(120),
            "false 唤醒不得缩短退避，实际等了 {:?}",
            started.elapsed()
        );
    }
}
