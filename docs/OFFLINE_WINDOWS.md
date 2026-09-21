# Windows x64 offline bundle

This workflow builds an unsigned NSIS installer plus a separate WebView2 Runtime installer for a Windows x64 machine that has no network access at first launch. The normal online build and release workflows are unchanged.

## Audit baseline

- Audited upstream baseline: `c2d2a9dec6120ad96410bb368a54a1c359ebc392`
- Desktop version: `0.15.8`
- Harness: `0.1.5-rc.2`, tag `dsh-0.1.5-rc.2-34495473237`, commit `a9582858297904ee7d7ffe613cfd28faaa5f6462`
- Node.js: `v22.22.0`, SHA-256 `c97fa376d2becdc8863fcd3ca2dd9a83a9f3468ee7ccf7a6d076ec66a645c77a`
- pnpm: `11.7.0`, SHA-256 `deafa7ec98a1218b6a047289b92fbe2395c1e22d3495bb711653013218ee15ee`
- MinGit: `2.53.0.2`, SHA-256 `d4bf83d6a860ccae9af44e508e1e00a39f09db6fa78a9ba5543b94d87ca22a29`
- WebView2 Evergreen Standalone x64 sidecar, SHA-256 `ad9b350625e132481bc0953eee9e032810134df9fedbd7be364c3f4e0e4dbd64`
- Harness Windows package SHA-256 `328780f453d89f01543bfc1e055ada75a6ff2c6204c7973254c61f95be81076a`

The fixed Harness tag and commit are registered in `src-tauri/resources/version-recommend.json`. `scripts/offline-windows.mjs` rejects any other version, URL, redirect host, or digest.

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

The installer is unsigned. Signing and publication are separate authorization steps.

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
