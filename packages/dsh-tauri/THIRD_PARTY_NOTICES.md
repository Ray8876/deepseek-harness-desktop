# Third-party notices

## deepseek-ai/deepseek-harness

The desktop-carrier and official-account behaviours in this package are derived
from the upstream Electron desktop implementation of the same features.
Upstream sources are MIT-licensed:

- Repository: <https://github.com/deepseek-ai/deepseek-harness>
- Cross-checked revision: `46a7f68b0922371ce7144b668b90e377d8e799f4`
- License: MIT — Copyright (c) 2026 DeepSeek

Derived behaviour (upstream → this package):

| Upstream | This package | What was taken |
| --- | --- | --- |
| `apps/desktop/src/main.ts` — `platformLoginUrl()`, `welcomeBackend.account.watch(...)`, `shell.openExternal(...)` while `attempt.phase === 'waiting-browser'` | `src/client/register/account.ts` | The watch → open flow. The Tauri shell has no Electron main process, so the same flow runs in the embedded UI and opens through the shell's `open_external_url`. |
| `packages/client/ui-settings-account/src/client/index.ts` — `ctx.remote.$stream({ name: 'account', open: signal => ctx.remote.account.watch(signal) })` consuming `frame.value` / `frame.accept()`, gated by `'dshDesktop' in globalThis` | `src/client/register/account.ts` | The account-stream consumption pattern and the carrier gate, mirrored so upstream UI and this package observe the same state. |
| `apps/desktop/src/preload-app.ts` — `contextBridge.exposeInMainWorld('dshDesktop', <app origin> ? createProductApi() : { protocolVersion: 1 })` | `src/host/apply.ts` | The carrier marker. Only upstream's non-app-origin value `{ protocolVersion: 1 }` is published; none of the Electron product APIs (`browser`, `updates`) are faked. |
| `packages/host/webserver` — structured index-injection rows (`global`, `script`, `script-src`, …) | `src/host/types/harness.ts` (`IndexInjectRow`) | The row contract this package pushes into `webserver/index-inject`. |
| `apps/desktop/src/main.ts` — `app.setAsDefaultProtocolClient('dsh')` + `open-url` handling that only focuses the primary window for `dsh://open` | `src-tauri/src/desktop/deep_link.rs` (app shell, outside this package) | The deep-link action set, so the Platform success page's "open app" button reaches this app. |

Not derived: `src/host/service/gate.ts` adapts this repo's own embedded-WebView
authentication constraints; upstream only defines the `connection` gate
semantics it overrides.

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
