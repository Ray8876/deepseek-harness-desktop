# Windows x64 offline bundle

This workflow builds an unsigned NSIS installer plus a separate WebView2 Runtime installer for a Windows x64 machine that has no network access at first launch. The normal online build and release workflows are unchanged.

## Automatic releases

`Automatic Offline Windows Release` runs entirely on GitHub-hosted runners every six hours (00:23, 06:23, 12:23, 18:23 UTC). No local computer, Codex task, personal access token, or manual approval is needed. GitHub may delay scheduled runs. If the default branch has no commits for 30 days, the monitor adds an empty maintenance commit to keep public-repository scheduling active before GitHub's 60-day inactivity cutoff.

The workflow follows the latest stable desktop Release, skips already published versions, applies upstream changes to the maintained offline baseline, and resolves the exact recommended Harness version to a tagged asset with a GitHub SHA-256 digest. It creates a source branch for traceability, invokes the Windows build, and publishes `v<version>-offline-sidecar` only after all build and artifact checks pass. Draft releases are temporary upload staging and become public automatically after remote asset digest verification.

Conflicting source changes, changed Node/pnpm/MinGit pins, missing asset digests, failed tests, and incomplete uploads stop publication. GitHub Actions records the failure and uses the account's normal workflow notification settings. The next scheduled check retries unpublished versions; published releases are never overwritten. Incompatible upstream changes still require code maintenance.

The integration baseline is recorded in `scripts/offline-upstream.json`; the exact Harness tag, commit, digest and desktop upstream commit are recorded in `scripts/offline-harness-lock.json`. WebView2 remains the pinned Evergreen Standalone x64 sidecar. The main installer uses `webviewInstallMode: skip`.

## Build

Run the independent GitHub Actions workflow `Offline Windows Build` on a Windows x64 runner. The equivalent local commands, after installing the repository toolchain, are:

```text
pnpm install --frozen-lockfile
pnpm build:plugins
pnpm --filter dsh-tauri build && pnpm --filter dsh-tauri-ui build
pnpm typecheck
cargo test --all-features --locked --manifest-path src-tauri/Cargo.toml
pnpm offline:prepare
pnpm offline:verify
DSH_OFFLINE_BUILD=1 pnpm tauri build --config src-tauri/tauri.offline.conf.json
pnpm offline:finalize
```

On PowerShell, set `$env:DSH_OFFLINE_BUILD = "1"` for the Tauri build step. `offline:prepare` downloads the four application assets into `src-tauri/resources/offline/`, downloads the pinned WebView2 Standalone installer into `src-tauri/target/offline-staging/`, verifies every SHA-256, and writes `src-tauri/resources/offline-manifest.json`. The offline Tauri config uses `webviewInstallMode: skip`, so WebView2 is not embedded in or downloaded by the main NSIS installer. `offline:verify` performs the same checks without downloading.

## Artifacts

The final output is under `src-tauri/target/release/bundle/`:

- `deepseek-harness-desktop-<version>-windows-x64-offline.zip`
- `SHA256SUMS`
- `offline-windows-x64/deepseek-harness-desktop-<version>-windows-x64-offline-setup.exe`
- `offline-windows-x64/MicrosoftEdgeWebView2RuntimeInstallerX64.exe`
- `offline-windows-x64/offline-manifest.json`
- `offline-windows-x64/SHA256SUMS`

The GitHub Actions artifact uploads only the `offline-windows-x64/` directory. The artifact therefore contains the two side-by-side installers, the manifest, and checksums; the separately generated full `.zip` remains a local build output and is not nested into the artifact.

The installer is unsigned. Successful automatic builds are authorized for public publication; signing is not configured.

## Required disconnected VM acceptance

Use a clean Windows 10/11 x64 VM, snapshot it, and disconnect the network before each first-launch test:

1. Run `MicrosoftEdgeWebView2RuntimeInstallerX64.exe` and confirm Runtime installation completes without a download prompt.
2. Run the NSIS package and confirm main application installation completes without a download prompt.
3. Close and reopen the application, then reboot the VM and repeat the launch check.
4. Exercise the CLI shim from a fresh terminal and verify it uses the bundled Node, pnpm, and Git.
5. Verify that community plugin installation/update reports a network-required error while bundled plugins still load.
6. Uninstall, reinstall from the same installer, and verify user data and install state follow the documented policy.
7. With a newer offline bundle, test the supported overwrite/upgrade path and verify the Harness tag/commit record.
8. Reconnect only after all checks and separately verify online update and plugin flows are still available in the normal build.

This checkout has not completed those real disconnected Windows VM checks. Code review, manifest logic, and CI build preparation do not substitute for the installer, reboot, shim, uninstall/reinstall, and upgrade evidence above.
