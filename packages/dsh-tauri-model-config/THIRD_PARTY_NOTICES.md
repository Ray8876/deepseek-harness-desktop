# Third-party notices

## deepseek-ai/deepseek-harness

This package is a Tauri-flavoured derivation of the upstream Models settings /
DeepSeek credential-onboarding plugin. Upstream sources are MIT-licensed:

- Repository: <https://github.com/deepseek-ai/deepseek-harness>
- Cross-checked revision: `46a7f68b0922371ce7144b668b90e377d8e799f4`
- License: MIT — Copyright (c) 2026 DeepSeek

Derived files (upstream `packages/client/ui-settings-models/` → this package):

| Upstream | This package (`src/`) |
| --- | --- |
| `src/index.ts` | `host/apply.ts` |
| `src/onboarding-config.ts`, `src/onboarding-copy.ts` | `shared/onboarding-config.ts`, `shared/onboarding-copy.ts` |
| `src/client/index.ts` | `client/register/models.ts`, `client/index.ts` |
| `src/client/ModelsSection.tsx` | `client/models/ModelsSection.tsx` |
| `src/client/DeepSeekModelsEditor.tsx` | `client/models/DeepSeekModelsEditor.tsx` |
| `src/client/DeepSeekOnboardingDialog.tsx` | `client/models/DeepSeekOnboardingDialog.tsx` |
| `src/client/ProviderEditor.tsx` | `client/models/ProviderEditor.tsx` |
| `src/client/CustomProviderCard.tsx` | `client/models/CustomProviderCard.tsx` |
| `src/client/ModelListEditor.tsx`, `ModelRow.tsx`, `ModelInputTypes.tsx`, `EditorFooter.tsx` | `client/models/` (same names) |
| `src/client/OnboardingModal.tsx`, `WelcomeNotice.tsx` | `client/models/` (same names) |
| `src/client/apiKey.ts`, `protocol-label.ts`, `operations.ts`, `schema-operations.ts`, `slot-contract.ts`, `store.ts`, `welcome-store.ts`, `locales.ts` | `client/models/` (same names) |

Kept deliberately from upstream:

- The slot and remote contracts are unchanged: `settings.section`,
  `settings.onboarding`, `settings.models.sign-in`, the `llm-deepseek` settings
  namespace, and the `credentialOnboarding` gate published through the
  `webserver/index-inject` global (`src/onboarding-config.ts` upstream).
- The `'dshDesktop' in globalThis` precondition of the official credential
  onboarding is preserved, so the local API-key flow never competes with the
  official account flow.

Re-implemented instead of copied:

- Styling runs on this repo's `css-render` stack (`client/models/styles.ts`,
  `client/models/styles.overrides.ts`); upstream `.module.css` files are not
  copied.
- `client/register/styles.ts`, `client/models/remote.ts`,
  `client/models/settings-forms.ts`, `client/types/remotes.ts` and
  `client/constants/index.ts` are this repo's own glue.

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
