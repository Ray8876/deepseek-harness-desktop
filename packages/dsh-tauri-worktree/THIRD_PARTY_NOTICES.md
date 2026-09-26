# Third-party notices

## deepseek-ai/deepseek-harness

- Repository: <https://github.com/deepseek-ai/deepseek-harness>
- Version: `dsh-v0.1.7-rc.2`
- Revision: `477b4f420553e8a52c2fbccc464d7561b239c443`
- Source: `source/deepseek-harness`
- Catalog pin: `dsh:` → `0.1.7-alpha.1` (`pnpm-workspace.yaml`)
- License: MIT — Copyright (c) 2026 DeepSeek
- Not copied: the per-session Git worktree is this repo's own feature; only the official Host and client contracts below are relied on.

Integration points:

- Official session title: `sessionTitle.refresh()` is the explicit entry point when the kernel's automatic title generation did not run, right after the first request header lands; its absence or failure never affects the task (`src/host/service/title.ts:21`, `src/host/events/session-event.ts:9`).
- Official attachments service: attachment descriptors are handed back to the official collection, and a missing capability only falls back, never blocks (`src/client/service/attachments.ts:5`, `src/client/service/attachments.test.ts:115`).
- Official composer DOM: send interception depends on the official composer's private DOM because no pre-submit hook exists (`src/client/components/mode-select.tsx:104`); file uploads wait for readiness exactly as the official composer disables send while it is not ready.
- Ordinary session titles: refreshed once per session via the official entry, matching the kernel's own timing.

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
