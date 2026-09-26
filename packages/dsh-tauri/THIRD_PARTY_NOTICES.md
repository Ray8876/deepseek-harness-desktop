# Third-party notices

## deepseek-ai/deepseek-harness

- Repository: <https://github.com/deepseek-ai/deepseek-harness>
- Version: `dsh-v0.1.7-rc.2`
- Revision: `477b4f420553e8a52c2fbccc464d7561b239c443`
- Source: `source/deepseek-harness`
- License: MIT — Copyright (c) 2026 DeepSeek

Derived (upstream → this package):

- `apps/desktop/src/main.ts` — `platformLoginUrl()`, `welcomeBackend.account.watch(...)`, `shell.openExternal(...)` while `attempt.phase === 'waiting-browser'` → `src/client/register/account.ts`: the watch → open flow, run in the embedded UI and opened through the shell's `open_external_url`.
- `packages/client/ui-settings-account/src/client/index.ts` — `ctx.remote.$stream({ name: 'account', open: signal => ctx.remote.account.watch(signal) })` consuming `frame.value` / `frame.accept()`, gated by `'dshDesktop' in globalThis` → `src/client/register/account.ts`: the account-stream consumption pattern and carrier gate.
- `apps/desktop/src/preload-app.ts` — `contextBridge.exposeInMainWorld('dshDesktop', <app origin> ? createProductApi() : { protocolVersion: 1 })` → `src/host/apply.ts`: the carrier marker; only `{ protocolVersion: 1 }` is published, no Electron product API (`browser`, `updates`) is faked.
- `packages/host/webserver` — structured index-injection rows (`global`, `script`, `script-src`, …) → `src/host/types/harness.ts` (`IndexInjectRow`).
- `apps/desktop/src/main.ts` — `app.setAsDefaultProtocolClient('dsh')` + `open-url` handling that focuses the primary window for `dsh://open` → `src-tauri/src/desktop/deep_link.rs` (app shell).

Not derived:

- `src/host/service/gate.ts` adapts this repo's embedded-WebView authentication constraints; upstream only defines the `connection` gate semantics it overrides.

Note:

- The account-stream carrier gate and the sidebar/DOM contracts mirrored here are unchanged from `0.1.7-alpha.1`.

## License

```text
MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
