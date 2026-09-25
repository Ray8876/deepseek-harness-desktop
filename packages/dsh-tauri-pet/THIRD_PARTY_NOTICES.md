# Third-party asset notices

## dsh-pet

The pet media assets (WebM animations, preview GIFs and `config.jsonc`) are **no
longer bundled or downloaded** by this package. The preset pet catalog
(`pets.built-in` in `src-tauri/resources/manifest.jsonc`) only registers the remote URLs, and the
pet window streams them directly from
[`PC2005-cloud/dsh-pet`](https://github.com/PC2005-cloud/dsh-pet) at play time
(macOS reads the HEVC-alpha `.mov` mirror from
[`dsh-tauri-desk/dsh-pet-mov`](https://github.com/dsh-tauri-desk/dsh-pet-mov)).
The catalog pins specific commits for reproducibility:

| Source | Pinned commit |
| --- | --- |
| `PC2005-cloud/dsh-pet` | `e1ff8c1e4001878cbb80441262d530e16541f138` |
| `dsh-tauri-desk/dsh-pet-mov` | `be0f3bb494cb71a4c73f916c0b92d25a3ab4d002` |

`dsh-tauri-desk/dsh-pet-mov` is our own re-encode of the upstream transparent
WebM clips into the HEVC-with-Alpha (`.mov`) form WKWebView can decode with
alpha; it carries no separate artwork.

Both upstream repositories are MIT-licensed:

```text
MIT License

Copyright (c) 2026 PC2005-cloud

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

## dsh-dafeiyu

No assets from [`QCYTSN/dsh-dafeiyu`](https://github.com/QCYTSN/dsh-dafeiyu)
(the BigFish sprite set or its `legacy/` archive) are bundled, downloaded or
redistributed by this package. That repository is referenced for **text and
status-priority behaviour only** — see
[`docs/sync-log.md`](./docs/sync-log.md) for the adopted derivation. Its own art
was replaced upstream in `v0.1.10` by assets imported from `PC2005-cloud/dsh-pet`,
which are covered by the section above.
