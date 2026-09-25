use std::ffi::OsString;

const AUTO_HEAP_MIN_MB: u64 = 2048;
const AUTO_HEAP_MAX_MB: u64 = 8192;

fn node_options_heap_limit(node_options: &str) -> bool {
    let mut tokens = node_options.split_whitespace();
    while let Some(token) = tokens.next() {
        let token = token.trim_matches(['"', '\'']);
        for flag in ["--max-old-space-size", "--max_old_space_size"] {
            if token == flag {
                if tokens
                    .next()
                    .is_some_and(|value| value.trim_matches(['"', '\'']).parse::<u32>().is_ok_and(|mb| mb > 0))
                {
                    return true;
                }
                break;
            }
            if token.strip_prefix(flag).and_then(|tail| tail.strip_prefix('='))
                .is_some_and(|value| value.trim_matches(['"', '\'']).parse::<u32>().is_ok_and(|mb| mb > 0))
            {
                return true;
            }
        }
    }
    false
}

pub(super) fn auto_heap_limit_mb(total_mb: u64) -> u32 {
    (total_mb / 2).clamp(AUTO_HEAP_MIN_MB, AUTO_HEAP_MAX_MB) as u32
}

pub(super) fn resolve_heap_limit_mb(
    configured: Option<u32>,
    node_options: Option<&str>,
    total_mb: Option<u64>,
) -> Option<u32> {
    if node_options.is_some_and(node_options_heap_limit) {
        return None;
    }
    configured.or_else(|| total_mb.filter(|total| *total > 0).map(auto_heap_limit_mb))
}

pub(super) fn heap_option_arg(heap_mb: Option<u32>) -> Option<OsString> {
    heap_mb.map(|mb| OsString::from(format!("--max-old-space-size={mb}")))
}

#[cfg(windows)]
pub(super) fn physical_memory_mb() -> Option<u64> {
    use windows_sys::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
    let mut status: MEMORYSTATUSEX = unsafe { std::mem::zeroed() };
    status.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
    (unsafe { GlobalMemoryStatusEx(&mut status) } != 0).then_some(status.ullTotalPhys / 1024 / 1024)
}

#[cfg(target_os = "macos")]
pub(super) fn physical_memory_mb() -> Option<u64> {
    use objc2_foundation::NSProcessInfo;
    let bytes = NSProcessInfo::processInfo().physicalMemory();
    (bytes > 0).then_some(bytes / 1024 / 1024)
}

#[cfg(target_os = "linux")]
pub(super) fn physical_memory_mb() -> Option<u64> {
    let meminfo = std::fs::read_to_string("/proc/meminfo").ok()?;
    let total_kb = meminfo.lines()
        .find_map(|line| line.strip_prefix("MemTotal:"))?
        .split_whitespace().next()?.parse::<u64>().ok()?;
    (total_kb > 0).then_some(total_kb / 1024)
}

#[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
pub(super) fn physical_memory_mb() -> Option<u64> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adaptive_limit_clamps_at_half_physical_memory() {
        assert_eq!(auto_heap_limit_mb(4096), 2048);
        assert_eq!(auto_heap_limit_mb(8192), 4096);
        assert_eq!(auto_heap_limit_mb(12288), 6144);
        assert_eq!(auto_heap_limit_mb(16384), 8192);
        assert_eq!(auto_heap_limit_mb(32768), 8192);
    }

    #[test]
    fn resolve_preserves_configured_value_and_falls_back_on_unknown_memory() {
        assert_eq!(resolve_heap_limit_mb(Some(12288), None, Some(16384)), Some(12288));
        assert_eq!(resolve_heap_limit_mb(None, None, Some(16384)), Some(8192));
        assert_eq!(resolve_heap_limit_mb(None, None, Some(0)), None);
        assert_eq!(resolve_heap_limit_mb(None, None, None), None);
    }

    #[test]
    fn inherited_heap_limit_takes_precedence_over_configured_and_adaptive_values() {
        for options in [
            "--max-old-space-size=8192",
            "--trace-warnings --max-old-space-size 8192",
            "--max-old-space-size \"8192\"",
            "--max_old_space_size=8192",
            "--max_old_space_size 8192",
        ] {
            assert_eq!(resolve_heap_limit_mb(Some(12288), Some(options), Some(32768)), None, "{options}");
        }
    }

    #[test]
    fn unrelated_or_malformed_node_options_do_not_disable_adaptive_limit() {
        for options in [
            "--trace-warnings",
            "--no-max-old-space-size=8192",
            "--max-old-space-size-extra=8192",
            "--max-old-space-size=",
            "--max-old-space-size=not-a-number",
            "--max-old-space-size 0",
        ] {
            assert_eq!(resolve_heap_limit_mb(None, Some(options), Some(16384)), Some(8192), "{options}");
        }
    }
}
