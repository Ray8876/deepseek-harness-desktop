//! Windows x64 离线依赖清单与本地资产读取。

use crate::config;
use crate::service::download::{verify_sha256, ProgressTracker};
use serde::Deserialize;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Component, Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};

const MANIFEST_FILE: &str = "offline-manifest.json";
const MANIFEST_SCHEMA: u32 = 1;
const OFFLINE_MODE: &str = "windows-x64";
const REQUIRED_ASSETS: [&str; 5] = ["node", "harness", "pnpm", "mingit", "webview2"];

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflineManifest {
    pub schema: u32,
    pub mode: String,
    pub desktop_version: String,
    pub source_commit: String,
    pub audited_upstream_commit: String,
    pub generated_at: String,
    pub assets: BTreeMap<String, OfflineAsset>,
    #[serde(skip)]
    root: PathBuf,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflineAsset {
    pub version: String,
    pub url: String,
    pub path: String,
    pub sha256: String,
    pub archive: String,
    #[serde(default)]
    pub release_tag: Option<String>,
    #[serde(default)]
    pub release_commit: Option<String>,
}

impl OfflineManifest {
    pub fn asset(&self, key: &str) -> Result<&OfflineAsset, String> {
        self.assets
            .get(key)
            .ok_or_else(|| format!("OFFLINE_ASSET_DECLARATION_MISSING: {key}"))
    }

    fn validate(&self) -> Result<(), String> {
        if self.schema != MANIFEST_SCHEMA {
            return Err(format!(
                "OFFLINE_MANIFEST_SCHEMA_UNSUPPORTED: {}",
                self.schema
            ));
        }
        if self.mode != OFFLINE_MODE {
            return Err(format!(
                "OFFLINE_MANIFEST_MODE_UNSUPPORTED: {}",
                self.mode
            ));
        }
        if self.desktop_version.trim().is_empty()
            || self.source_commit.trim().is_empty()
            || self.audited_upstream_commit.trim().is_empty()
            || self.generated_at.trim().is_empty()
        {
            return Err("OFFLINE_MANIFEST_METADATA_INVALID: required metadata is empty".to_string());
        }
        for key in REQUIRED_ASSETS {
            let asset = self.asset(key)?;
            validate_asset(key, asset)?;
        }
        let harness = self.asset("harness")?;
        if harness
            .release_tag
            .as_deref()
            .is_none_or(|value| value.is_empty())
            || harness
                .release_commit
                .as_deref()
                .is_none_or(|value| value.is_empty())
        {
            return Err("OFFLINE_HARNESS_RELEASE_METADATA_INVALID: tag and commit are required".to_string());
        }
        Ok(())
    }

    fn asset_path(&self, key: &str) -> Result<PathBuf, String> {
        let asset = self.asset(key)?;
        let root = self
            .root
            .canonicalize()
            .map_err(|e| format!("OFFLINE_RESOURCE_ROOT_INVALID: {}: {e}", self.root.display()))?;
        let path = root.join(&asset.path);
        let canonical = fs::canonicalize(&path).map_err(|e| {
            format!(
                "OFFLINE_ASSET_MISSING: {key}: {}: {e}",
                path.display()
            )
        })?;
        if !canonical.starts_with(&root) {
            return Err(format!("OFFLINE_ASSET_PATH_ESCAPE: {key}"));
        }
        Ok(canonical)
    }
}

fn validate_asset(key: &str, asset: &OfflineAsset) -> Result<(), String> {
    let digest = asset.sha256.strip_prefix("sha256:").unwrap_or(&asset.sha256);
    if digest.len() != 64 || !digest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(format!("OFFLINE_ASSET_DIGEST_INVALID: {key}"));
    }
    if asset.version.trim().is_empty()
        || asset.url.trim().is_empty()
        || asset.archive.trim().is_empty()
        || !is_safe_relative_path(&asset.path)
    {
        return Err(format!("OFFLINE_ASSET_METADATA_INVALID: {key}"));
    }
    Ok(())
}

fn is_safe_relative_path(value: &str) -> bool {
    let path = Path::new(value);
    !value.is_empty()
        && !path.is_absolute()
        && path.components().all(|component| {
            !matches!(component, Component::ParentDir | Component::RootDir | Component::Prefix(_))
        })
}

fn manifest_candidates<R: Runtime>(app_handle: &AppHandle<R>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(root) = app_handle.path().resource_dir() {
        candidates.push(root.join(MANIFEST_FILE));
        candidates.push(root.join("resources").join(MANIFEST_FILE));
    }
    if cfg!(debug_assertions) {
        candidates.push(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources")
                .join(MANIFEST_FILE),
        );
    }
    candidates
}

fn parse_manifest(content: &str, root: PathBuf) -> Result<OfflineManifest, String> {
    let mut manifest: OfflineManifest = serde_json::from_str(content)
        .map_err(|e| format!("OFFLINE_MANIFEST_INVALID: {e}"))?;
    manifest.root = root;
    manifest.validate()?;
    Ok(manifest)
}

pub fn load_offline_manifest<R: Runtime>(
    app_handle: &AppHandle<R>,
) -> Result<Option<OfflineManifest>, String> {
    if !config::offline_build() {
        return Ok(None);
    }
    let path = manifest_candidates(app_handle)
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| {
            "OFFLINE_MANIFEST_MISSING: bundled offline-manifest.json not found".to_string()
        })?;
    let root = path
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "OFFLINE_RESOURCE_ROOT_INVALID: manifest has no parent".to_string())?;
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("OFFLINE_MANIFEST_READ_FAILED: {}: {e}", path.display()))?;
    parse_manifest(&content, root).map(Some)
}

pub async fn read_offline_asset<'a, R: Runtime>(
    tracker: &ProgressTracker<'a, R>,
    manifest: &OfflineManifest,
    key: &str,
) -> Result<(String, Vec<u8>), String> {
    let asset = manifest.asset(key)?.clone();
    let path = manifest.asset_path(key)?;
    let name = Path::new(&asset.path)
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("OFFLINE_ASSET_NAME_INVALID: {key}"))?
        .to_string();
    tracker.update(
        0.0,
        format!("读取离线资产 {key}"),
        format!("Load offline asset: {}", path.display()),
    );
    let expected = asset.sha256;
    let key_for_error = key.to_string();
    let bytes = tokio::task::spawn_blocking(move || -> Result<Vec<u8>, String> {
        let bytes = fs::read(&path).map_err(|e| {
            format!(
                "OFFLINE_ASSET_READ_FAILED: {key_for_error}: {}: {e}",
                path.display()
            )
        })?;
        verify_sha256(&bytes, &expected).map_err(|error| {
            format!("OFFLINE_ASSET_VERIFY_FAILED: {key_for_error}: {error}")
        })?;
        Ok(bytes)
    })
    .await
    .map_err(|e| format!("OFFLINE_ASSET_READ_TASK_FAILED: {e}"))??;
    tracker.update(
        100.0,
        format!("离线资产 {key} 已校验"),
        format!("Verified offline asset: {name}"),
    );
    Ok((name, bytes))
}

#[cfg(test)]
mod tests {
    use super::{parse_manifest, OfflineManifest};
    use std::path::PathBuf;

    fn manifest(path: &str) -> String {
        serde_json::json!({
            "schema": 1,
            "mode": "windows-x64",
            "desktopVersion": "0.15.8",
            "sourceCommit": "c2d2a9dec6120ad96410bb368a54a1c359ebc392",
            "auditedUpstreamCommit": "c2d2a9dec6120ad96410bb368a54a1c359ebc392",
            "generatedAt": "2026-09-21T00:00:00.000Z",
            "assets": {
                "node": { "version": "v22.22.0", "url": "https://nodejs.org/a", "path": path, "sha256": "a".repeat(64), "archive": "zip" },
                "harness": { "version": "0.1.5-rc.2", "url": "https://github.com/a", "path": "offline/harness.zip", "sha256": "b".repeat(64), "archive": "zip", "releaseTag": "dsh-0.1.5-rc.2-34495473237", "releaseCommit": "a9582858297904ee7d7ffe613cfd28faaa5f6462" },
                "pnpm": { "version": "11.7.0", "url": "https://registry.npmjs.org/a", "path": "offline/pnpm.tgz", "sha256": "c".repeat(64), "archive": "tgz" },
                "mingit": { "version": "2.53.0.2", "url": "https://github.com/a", "path": "offline/mingit.zip", "sha256": "d".repeat(64), "archive": "zip" },
                "webview2": { "version": "evergreen", "url": "https://msedge.sf.dl.delivery.mp.microsoft.com/a", "path": "offline/webview2.exe", "sha256": "e".repeat(64), "archive": "exe" }
            }
        })
        .to_string()
    }

    #[test]
    fn manifest_requires_all_fixed_assets() {
        let parsed = parse_manifest(&manifest("offline/node.zip"), PathBuf::from("resources"));
        assert!(parsed.is_ok());
        assert_eq!(parsed.unwrap().asset("harness").unwrap().version, "0.1.5-rc.2");
    }

    #[test]
    fn manifest_rejects_path_escape() {
        let error = parse_manifest(&manifest("offline/../node.zip"), PathBuf::from("resources"))
            .expect_err("path traversal must be rejected");
        assert!(error.starts_with("OFFLINE_ASSET_METADATA_INVALID: node"));
    }

    #[test]
    fn manifest_rejects_invalid_digest() {
        let content = manifest("offline/node.zip").replace(&"a".repeat(64), "invalid");
        let error = parse_manifest(&content, PathBuf::from("resources"))
            .expect_err("invalid digest must be rejected");
        assert!(error.starts_with("OFFLINE_ASSET_DIGEST_INVALID: node"));
    }

    #[test]
    fn manifest_root_is_not_deserialized_from_input() {
        let parsed: OfflineManifest =
            parse_manifest(&manifest("offline/node.zip"), PathBuf::from("resources")).unwrap();
        assert_eq!(parsed.root, PathBuf::from("resources"));
    }
}
