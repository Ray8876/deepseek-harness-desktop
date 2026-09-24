import hashlib
import json
import os
from pathlib import Path
import re
import subprocess


def gh(*args):
    return subprocess.run(['gh', *args], check=True, text=True, capture_output=True).stdout.strip()


def digest(path):
    with path.open('rb') as file:
        return hashlib.file_digest(file, 'sha256').hexdigest()


def verify(directory, tag, sha):
    files = list(directory.iterdir())
    manifest = json.loads((directory / 'offline-manifest.json').read_text())
    version = manifest['desktopVersion']
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', version) or tag != f'v{version}-offline-sidecar':
        raise ValueError('Release tag does not match artifact desktop version')
    if not re.fullmatch(r'[0-9a-f]{40}', sha) or manifest['sourceCommit'] != sha:
        raise ValueError('Artifact source commit does not match release target')
    if manifest['schema'] != 1 or manifest['mode'] != 'windows-x64':
        raise ValueError('Unexpected offline manifest')
    installer = f'deepseek-harness-desktop-{version}-windows-x64-offline-setup.exe'
    webview = 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'
    expected = {installer, webview, 'offline-manifest.json'}
    if {p.name for p in files} != expected | {'SHA256SUMS'} or not all(p.is_file() for p in files):
        raise ValueError('Expected exactly the four offline release files')
    entries = {}
    for line in (directory / 'SHA256SUMS').read_text().splitlines():
        match = re.fullmatch(r'([0-9a-f]{64})  ([^/\\]+)', line)
        if not match or match[2] in entries:
            raise ValueError('Malformed or duplicate checksum entry')
        entries[match[2]] = match[1]
    if set(entries) != expected:
        raise ValueError('Checksum file list does not match release files')
    for name, expected in entries.items():
        actual = digest(directory / name)
        if actual != expected:
            raise ValueError(f'SHA-256 mismatch: {name}')
    if (directory / webview).stat().st_size < 100 * 1024 * 1024:
        raise ValueError('WebView2 sidecar is too small')
    return manifest, installer


def main():
    repo = os.environ['GH_REPO']
    tag = os.environ['RELEASE_TAG']
    sha = os.environ['TARGET_SHA']
    run_id = os.environ['ARTIFACT_RUN_ID']
    source_run = json.loads(gh('api', f'repos/{repo}/actions/runs/{run_id}'))
    if source_run['path'] not in ['.github/workflows/auto-offline-release.yml', '.github/workflows/build-windows-offline.yml']:
        raise ValueError('Artifact was not produced by an offline build workflow')
    if run_id != os.environ['GITHUB_RUN_ID'] and source_run['conclusion'] != 'success':
        raise ValueError('Source build run did not succeed')
    directory = Path('release-assets')
    manifest, installer = verify(directory, tag, sha)
    result = subprocess.run(['gh', 'api', f'repos/{repo}/releases/tags/{tag}'], text=True, capture_output=True)
    release = None
    if result.returncode == 0:
        release = json.loads(result.stdout)
        if not release['draft']:
            print(f'{tag} is already public; leaving it unchanged')
            return
        if release['target_commitish'] != sha:
            raise ValueError('Existing draft targets a different source commit')
    elif 'HTTP 404' not in result.stderr:
        raise RuntimeError(result.stderr)
    title = f'DeepSeek Harness Desktop {manifest["desktopVersion"]} Windows 离线版'
    notes = Path('release-notes.md')
    notes.write_text(f'''Windows x64 离线修改版（未签名），由 GitHub Actions 自动构建并发布。

先运行 `MicrosoftEdgeWebView2RuntimeInstallerX64.exe`，再运行 `{installer}`。主安装器不会联网下载或内置 WebView2 Runtime。

- 桌面上游源码：`{manifest['auditedUpstreamCommit']}`
- 离线构建源码：`{sha}`
- Harness：`{manifest['assets']['harness']['releaseTag']}`
- [构建记录](https://github.com/{repo}/actions/runs/{run_id})
- 已校验四个发布文件及 SHA-256；自动构建不代表已完成人工 Windows 断网安装验收。
''')
    if release is None:
        gh('release', 'create', tag, '--target', sha, '--draft', '--title', title, '--notes-file', str(notes))
        release = json.loads(gh('api', f'repos/{repo}/releases/tags/{tag}'))
        if release['target_commitish'] != sha:
            raise ValueError('New draft targets a different source commit')
    gh('release', 'upload', tag, *[str(p) for p in sorted(directory.iterdir())], '--clobber')
    resolved = json.loads(gh('api', f'repos/{repo}/commits/{tag}'))['sha']
    if resolved != sha:
        raise ValueError('Release tag points to a different commit')
    uploaded = json.loads(gh('api', f'repos/{repo}/releases/tags/{tag}'))
    remote = {a['name']: a for a in uploaded['assets']}
    if set(remote) != {p.name for p in directory.iterdir()}:
        raise ValueError('Remote release file list mismatch')
    for path in directory.iterdir():
        expected_digest = 'sha256:' + digest(path)
        if remote[path.name]['size'] != path.stat().st_size or remote[path.name].get('digest') != expected_digest:
            raise ValueError(f'Remote release digest mismatch: {path.name}')
    gh('release', 'edit', tag, '--draft=false', '--prerelease=false', '--latest', '--title', title, '--notes-file', str(notes))
    print(uploaded['html_url'])


if __name__ == '__main__':
    main()
