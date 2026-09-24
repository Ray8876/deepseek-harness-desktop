//! `dsh://` 深链：官方账号成功页的「打开应用」按钮走的就是它。
//!
//! 与官方 Electron 版逐字对齐：
//! - 协议注册 `app.setAsDefaultProtocolClient('dsh')`（仅在打包态）；
//! - `open-url` 处理里**只**认 `dsh://open`（含尾斜杠）→ 把主窗口拉到前台，不做其它动作；
//! - OAuth 回调不走深链（那是 `http://127.0.0.1:<port>/oauth/callback`）。
//!
//! Windows/Linux 的协议注册在运行期完成（`register_all`），因此开发态也能直接验证按钮；
//! 打包安装器的注册由 `tauri.conf.json` 的 `plugins.deep-link.desktop.schemes` 驱动。

use tauri::AppHandle;
use tauri_plugin_deep_link::DeepLinkExt;

/// 官方唯一使用的深链动作（尾斜杠形式等价）。
pub fn is_open_request(url: &str) -> bool {
    url == "dsh://open" || url == "dsh://open/"
}

/// 注册 `dsh` 协议并接管打开事件。最佳努力：失败只告警，不阻断启动。
pub fn init(app: &AppHandle) {
    #[cfg(any(windows, target_os = "linux"))]
    if let Err(e) = app.deep_link().register_all() {
        log::warn!("deep link register_all failed: {e}");
    }

    let handle = app.clone();
    app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            if is_open_request(url.as_str()) {
                crate::utils::show_main_window(&handle);
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::is_open_request;

    #[test]
    fn recognizes_the_official_open_requests() {
        assert!(is_open_request("dsh://open"));
        assert!(is_open_request("dsh://open/"));
    }

    #[test]
    fn ignores_other_urls() {
        assert!(!is_open_request("dsh://oauth/callback"));
        assert!(!is_open_request("https://platform.deepseek.com/dsh/authorized?login_source=desktop"));
        assert!(!is_open_request(""));
    }
}
