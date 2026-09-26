//! 失败输出解析：识别网络错误（代理/DNS/连接/TLS）、git 传输层失败
//! （HTTPS→SSH 回退提示）、pnpm store 布局不兼容（`ERR_PNPM_UNEXPECTED_STORE`
//! 一族），并从输出中挑选可展示的错误消息（ANSI 清洗、命中错误标记的行优先、
//! 截断）。

/// 给非空诊断文本加 `: ` 前缀，便于直接拼进错误消息（空文本返回空串）。
pub(super) fn diagnostic_suffix(detail: &str) -> String {
    if detail.is_empty() {
        String::new()
    } else {
        format!(": {detail}")
    }
}

/// 命中即视为可展示错误行的标记。除 pnpm/Node 的常规错误外，还覆盖「命令或
/// shim 不可用」一类失败：cmd.exe 的 `'pnpm' is not recognized…`、shim 的
/// `[pnpm] pnpm not found…`、批处理跳转失败 `The system cannot find the batch
/// label…`，以及中文 cmd 文案。这些行不含 `error`/`failed`，一旦被过滤掉，
/// 用户只会看到 dsh 包装后的 `pnpm failed in profile directory`，真实原因
/// （shim 不可用）永远不可见。
const ERROR_MARKERS: [&str; 14] = [
    "ERR_",
    "error",
    "Error",
    "failed",
    "✖",
    "warning",
    "not recognized",
    "not found",
    "No such file",
    "cannot find",
    "Cannot find",
    "找不到",
    "无法",
    "不是内部或外部命令",
];

/// 从 dsh/pnpm 失败输出中提取可展示的错误消息：优先 git 传输层提示；
/// 否则挑出命中错误标记的行（最多 8 行），没有则取输出尾部，ANSI 清洗后
/// 截断到 2000 字符。
pub(super) fn pick_error_message(output: &str, hint: Option<&str>) -> String {
    if let Some(hint) = hint {
        return hint.to_string();
    }
    let cleaned: Vec<String> = output
        .split('\n')
        .filter_map(|line| {
            let trimmed = strip_ansi(line);
            let trimmed = trimmed.trim();
            (!trimmed.is_empty()).then(|| trimmed.to_string())
        })
        .filter(|line| ERROR_MARKERS.iter().any(|marker| line.contains(marker)))
        .take(8)
        .collect();
    let base = if cleaned.is_empty() {
        output.trim().to_string()
    } else {
        cleaned.join("\n")
    };
    base.chars().take(2000).collect()
}

/// 去除 ANSI 转义序列（`\x1B[...m`，含颜色/样式码）。
fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' && chars.peek() == Some(&'[') {
            chars.next(); // '['
            while let Some(&n) = chars.peek() {
                if n.is_ascii_digit() || n == ';' {
                    chars.next();
                } else {
                    break;
                }
            }
            if chars.peek() == Some(&'m') {
                chars.next();
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// 从 pnpm 失败输出里识别网络错误，返回稳定提示，避免把网络问题误报为 dsh
/// 子进程错误。代理、DNS、连接超时和 TLS 失败都属于此类。
pub(super) fn network_error_hint(output: &str) -> Option<&'static str> {
    const SIGNALS: &[&str] = &[
        "eai_again",
        "enotfound",
        "econnrefused",
        "econnreset",
        "etimedout",
        "network timeout",
        "network request failed",
        "fetch failed",
        "unable to verify the first certificate",
        "self signed certificate",
        "socket hang up",
        "could not resolve host",
        "failed to connect",
        "connection timed out",
        "connection reset",
    ];
    let lower = output.to_ascii_lowercase();
    SIGNALS
        .iter()
        .any(|signal| lower.contains(signal))
        .then_some("网络连接失败，请检查网络或代理设置后重试。")
}

/// pnpm 的 lockfile supply-chain 校验（`minimumReleaseAge`）要按 registry 元数据核对
/// 每个条目的发布时间；元数据拉不到时 pnpm 会把条目**直接判成违规**并以
/// `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` 中止，输出里唯一的线索只有
/// `[WARN] GET https://registry.npmjs.org/<pkg> error (unknown)` —— 用户看到的
/// 「违反供应链策略」其实是网络问题（实测 `undici@7.29.1` 已发布 21 天仍被判违规）。
/// 命中即说明重跑同一条命令大概率能过，调用方据此重试。
///
/// 真·发布时间违规（版本确实太新）不带任何拉取失败信号，绝不命中：那种失败重试无用，
/// 也不该把供应链信号降级成网络问题。
///
/// 传入的必须是**单次尝试**的输出（`run_plugin_with_allow_build_retry` 为此额外返回
/// 最后一次尝试的输出）：把历次重试拼接起来判断时，早先一次的网络字样会给最终一次的真·
/// 违规「背书」，正好破坏上面这条边界。
pub(super) fn policy_verification_network_failure(output: &str) -> bool {
    let lower = output.to_ascii_lowercase();
    if !lower.contains("err_pnpm_minimum_release_age_violation") {
        return false;
    }
    const FETCH_FAILURES: [&str; 4] = [
        "error (unknown)",
        "will retry in",
        "fetch failed",
        "failed to fetch",
    ];
    FETCH_FAILURES.iter().any(|signal| lower.contains(signal))
}

pub(super) fn git_transport_hint(output: &str) -> Option<&'static str> {
    const SIGNALS: &[(&str, &str)] = &[
        (
            "spawn git enoent",
            "Git is not installed or not on PATH (pnpm could not spawn git: ENOENT). Install git (e.g. Debian/Ubuntu: `sudo apt install git`; macOS: `brew install git`) or uncheck git-hosted plugins and retry.",
        ),
        (
            "command failed with enoent: git",
            "Git is not installed or not on PATH (pnpm could not run git: ENOENT). Install git (e.g. Debian/Ubuntu: `sudo apt install git`; macOS: `brew install git`) or uncheck git-hosted plugins and retry.",
        ),
        (
            "host key verification failed",
            "git fell back to SSH and could not verify GitHub's host key (no known_hosts entry; the process ran non-interactively). Make sure GitHub is reachable over HTTPS.",
        ),
        (
            "permission denied (publickey)",
            "git reached GitHub over SSH instead of HTTPS (Permission denied (publickey)) — usually your git config rewrites GitHub HTTPS to SSH (url.<base>.insteadOf) while no SSH key is configured. The desktop app isolates git config to force HTTPS for plugin installs; if you still see this, remove that rewrite (git config --global --unset-all 'url.git@github.com:.insteadOf') or configure an SSH key.",
        ),
        (
            "could not read from remote repository",
            "pnpm could not read from the git remote — commonly a git+ssh transport failure. Ensure GitHub is reachable over HTTPS.",
        ),
        (
            "ssh: connect to host",
            "pnpm tried to reach GitHub over SSH (port 22) and the connection was refused. Use HTTPS instead.",
        ),
    ];
    let lower = output.to_ascii_lowercase();
    SIGNALS
        .iter()
        .find(|(sig, _)| lower.contains(sig))
        .map(|(_, hint)| *hint)
}

/// pnpm `reportUnexpectedStore` / `reportUnexpectedVirtualStoreDir` 正文里分别给出
/// 「档案记录的位置」与「当前解析出的位置」，路径用双引号包裹。
const RECORDED_PATH_MARKERS: &[&str] = &[
    "currently linked from the store at ",
    "symlinked from the virtual store directory at ",
];
const CURRENT_PATH_MARKERS: &[&str] = &[
    "now wants to use the store at ",
    "now wants to use the virtual store at ",
];

/// 从 pnpm 失败输出里识别 store 布局不兼容（`ERR_PNPM_UNEXPECTED_STORE`、
/// `ERR_PNPM_UNEXPECTED_VIRTUAL_STORE`、`ERR_PNPM_STORE_BREAKING_CHANGE`、
/// `ERR_PNPM_MODULES_BREAKING_CHANGE`），返回带双方路径与处置办法的指引。
///
/// pnpm 只在正文里给出「档案记录的 store」与「当前 store」两条路径，而
/// [`pick_error_message`] 的标记行过滤把它们全部丢掉（正文两行都不含
/// `ERR_`/`error`/`failed` 标记），用户最终只看到
/// `Unexpected store location (This error may happen if the node_modules was installed
/// with a different major version of pnpm)` —— 插件装不上却看不到任何原因。这里直接从
/// 原始输出把两条路径捞出来。
pub(super) fn store_mismatch_hint(output: &str) -> Option<String> {
    const CODES: &[&str] = &[
        "ERR_PNPM_UNEXPECTED_STORE",
        "ERR_PNPM_UNEXPECTED_VIRTUAL_STORE",
        "ERR_PNPM_STORE_BREAKING_CHANGE",
        "ERR_PNPM_MODULES_BREAKING_CHANGE",
    ];
    if !CODES.iter().any(|code| contains_error_code(output, code)) {
        return None;
    }
    Some(match (
        quoted_after(output, RECORDED_PATH_MARKERS),
        quoted_after(output, CURRENT_PATH_MARKERS),
    ) {
        (Some(recorded), Some(current)) => format!(
            "The profile's node_modules was created by a different pnpm major version: it is linked from the store at \"{recorded}\", but the pnpm now in use resolves the store at \"{current}\". Install/update cannot succeed until those match — install the pnpm major version that created this profile, or delete the profile's node_modules directory and retry so pnpm rebuilds it with the current version."
        ),
        _ => "The profile's node_modules is not compatible with the pnpm version now in use (pnpm refused before installing). Install the pnpm major version that created this profile, or delete the profile's node_modules directory and retry so pnpm rebuilds it with the current version.".to_string(),
    })
}

/// 取 `markers` 中最早出现的那一条之后紧跟的双引号路径。
fn quoted_after(output: &str, markers: &[&str]) -> Option<String> {
    let (index, marker) = markers
        .iter()
        .filter_map(|marker| output.find(marker).map(|index| (index, *marker)))
        .min_by_key(|(index, _)| *index)?;
    let rest = output[index + marker.len()..].strip_prefix('"')?;
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

/// 完整错误码匹配（大小写不敏感）：`ERR_PNPM_UNEXPECTED_STORE_EXTRA` 这类更长变体
/// 不算命中 —— 命中即会把误导性的 store 指引顶到真正的失败原因之前，宁可 fail closed。
fn contains_error_code(output: &str, code: &str) -> bool {
    let upper = output.to_ascii_uppercase();
    let mut from = 0;
    while let Some(index) = upper[from..].find(code) {
        let end = from + index + code.len();
        let boundary = upper[end..]
            .chars()
            .next()
            .is_none_or(|c| !(c.is_ascii_alphanumeric() || c == '_'));
        if boundary {
            return true;
        }
        from = from + index + 1;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diagnostic_suffix_preserves_non_allowbuilds_failure() {
        assert_eq!(diagnostic_suffix(""), "");
        assert_eq!(
            diagnostic_suffix("ERR_PNPM_LINKING_FAILED: stale symlink"),
            ": ERR_PNPM_LINKING_FAILED: stale symlink"
        );
    }

    // ---- git 传输层错误识别（区别于 allowBuilds 门禁）----

    /// shim 不可用时 cmd.exe / shim 自己的原话，不含 `error`/`failed`：
    /// 若被过滤掉，用户只剩 dsh 的 `pnpm failed in profile directory`。
    #[test]
    fn pick_error_message_keeps_shim_unavailable_lines() {
        let out = "dsh: pnpm failed in profile directory C:\\Users\\小蔡\\.dsh\\profiles\\safe\n\
                   [pnpm] pnpm not found. Please run DeepSeek Harness Desktop to install it first.\n";
        let picked = pick_error_message(out, None);
        assert!(
            picked.contains("pnpm not found"),
            "shim diagnostic must survive: {picked}"
        );

        let cmd = "'pnpm' is not recognized as an internal or external command,\noperable program or batch file.\n";
        assert!(pick_error_message(cmd, None).contains("not recognized"));

        let label = "The system cannot find the batch label specified - no_pnpm\n";
        assert!(pick_error_message(label, None).contains("batch label"));
    }

    #[test]
    fn pick_error_message_still_drops_noise() {
        let out = "Progress: resolved 1, reused 0, downloaded 0\n\
                   ERR_PNPM_LINKING_FAILED: stale symlink\n\
                   Done in 2.8s\n";
        let picked = pick_error_message(out, None);
        assert!(picked.contains("ERR_PNPM_LINKING_FAILED"));
        assert!(!picked.contains("Done in"), "progress noise must be dropped: {picked}");
    }

    #[test]
    fn git_transport_hint_detects_host_key_failure() {
        let out = "git ls-remote \"git+ssh://git@github.com/foo.git\" HEAD\nHost key verification failed.\nfatal: Could not read from remote repository.\n";
        assert!(git_transport_hint(out).is_some());
    }

    #[test]
    fn git_transport_hint_detects_publickey_and_ssh() {
        assert!(git_transport_hint("git@github.com: Permission denied (publickey)").is_some());
        assert!(
            git_transport_hint("ssh: connect to host github.com port 22: Connection refused")
                .is_some()
        );
    }

    #[test]
    fn git_transport_hint_detects_enoent_missing_git() {
        // issue #369：Linux 无系统 git 时 pnpm spawn git 直接 ENOENT
        let out = "[ENOENT] Command failed with ENOENT: git ls-remote 'git+ssh://git@github.com/omdsh-dev/DSH-better-sidebar.git' HEAD\nspawn git ENOENT\n";
        assert!(git_transport_hint(out).is_some());
        // 单独一行也命中
        assert!(git_transport_hint("spawn git ENOENT").is_some());
    }

    #[test]
    fn git_transport_hint_none_for_allowbuilds_output() {
        // allowBuilds 场景（prepare 构建被拦）不应误判为传输层错误
        let out = "[ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED] ...\nallowBuilds:\n  node-pty: true\n";
        assert!(git_transport_hint(out).is_none());
    }

    // ---- lockfile supply-chain 校验因 registry 元数据拉取失败而误判违规 ----

    /// 用户实测（pnpm 11.7.0，`undici@7.29.1` 已发布 21 天）：判定违规的唯一线索是
    /// registry 元数据请求失败，而不是发布时间。
    const POLICY_VERIFICATION_FETCH_FAILURE: &str = "✗ Lockfile failed supply-chain policy check (4 entries in 2.7s) [ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION]\n1 lockfile entries failed verification:\n[WARN] GET https://registry.npmjs.org/undici error (unknown). Will retry in 10 seconds. 2 retries left.\n";

    #[test]
    fn policy_verification_failure_detects_registry_fetch_error() {
        assert!(policy_verification_network_failure(
            POLICY_VERIFICATION_FETCH_FAILURE
        ));
    }

    #[test]
    fn policy_verification_failure_ignores_real_release_age_violation() {
        // 真违规会给出发布时间与阈值、没有拉取失败信号：重试无用，也不该改判成网络问题。
        let real = "[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] undici@7.29.1 was published recently (released 5 minutes ago; minimumReleaseAge is 1440)\n";
        assert!(!policy_verification_network_failure(real));
        assert!(!policy_verification_network_failure(
            "ERR_PNPM_FETCH_404 registry error"
        ));
        assert!(!policy_verification_network_failure(""));
    }

    // ---- pnpm store 布局不兼容（ERR_PNPM_UNEXPECTED_STORE 一族）----

    /// pnpm 的真实原始输出：档案由 pnpm 10 装好，当前 pnpm 11 解析出另一份 store。
    const UNEXPECTED_STORE_OUTPUT: &str = r#"
 ERR_PNPM_UNEXPECTED_STORE  Unexpected store location

The dependencies at "/Users/gao/.dsh/profiles/web/node_modules" are currently linked from the store at "/Users/gao/Library/pnpm/store/v10".

pnpm now wants to use the store at "/Users/gao/Library/pnpm/store/v11" to link dependencies.

If you want to use the new store location, reinstall your dependencies with "pnpm install".

You may change the global store location by running "pnpm config set store-dir <dir> --global".
(This error may happen if the node_modules was installed with a different major version of pnpm)
"#;

    #[test]
    fn store_mismatch_hint_names_both_store_paths() {
        let hint = store_mismatch_hint(UNEXPECTED_STORE_OUTPUT).expect("store hint");
        assert!(hint.contains("/Users/gao/Library/pnpm/store/v10"));
        assert!(hint.contains("/Users/gao/Library/pnpm/store/v11"));
        assert!(hint.contains("node_modules"));
    }

    #[test]
    fn store_mismatch_hint_covers_virtual_store_and_pathless_codes() {
        let virtual_store = r#"
 ERR_PNPM_UNEXPECTED_VIRTUAL_STORE  Unexpected virtual store location

The dependencies at "/p/node_modules" are currently symlinked from the virtual store directory at "/old/.pnpm".

pnpm now wants to use the virtual store at "/new/.pnpm" to link dependencies from the store.
"#;
        let hint = store_mismatch_hint(virtual_store).expect("virtual store hint");
        assert!(hint.contains("/old/.pnpm"));
        assert!(hint.contains("/new/.pnpm"));

        // 正文里没有双方路径（breaking change 一族）也要给指引，而不是退回裸标题
        let pathless = r#"[ERR_PNPM_MODULES_BREAKING_CHANGE] The node_modules structure at "/p/node_modules" is not compatible with the current pnpm version. Run "pnpm install --force" to recreate node_modules."#;
        assert!(store_mismatch_hint(pathless).is_some());
    }

    #[test]
    fn store_mismatch_hint_none_for_other_failures() {
        assert!(store_mismatch_hint("ERR_PNPM_NO_MATCHING_VERSION: no version").is_none());
        assert!(store_mismatch_hint("").is_none());
        // 前缀相同的更长错误码不算命中（fail closed，别把 store 指引顶到真因之前）
        assert!(store_mismatch_hint("[ERR_PNPM_UNEXPECTED_STORE_EXTRA] other failure").is_none());
        assert!(store_mismatch_hint("[ERR_PNPM_UNEXPECTED_VIRTUAL_STORE_X] other").is_none());
        // 完整码（方括号/空格/行尾都算边界）仍命中
        assert!(store_mismatch_hint("[ERR_PNPM_UNEXPECTED_STORE] Unexpected store location").is_some());
        assert!(store_mismatch_hint(" ERR_PNPM_UNEXPECTED_STORE  x").is_some());
    }

    #[test]
    fn pick_error_message_drops_store_paths_which_is_why_the_hint_exists() {
        // 回归说明：标记行过滤把两条 store 路径都丢掉（都不含 ERR_/error/failed），
        // 用户只剩标题与末行括号说明 —— 必须由 store_mismatch_hint 兜住。
        let picked = pick_error_message(UNEXPECTED_STORE_OUTPUT, None);
        assert!(picked.contains("Unexpected store location"));
        assert!(!picked.contains("store/v10"));
        assert!(!picked.contains("store/v11"));
    }
}
