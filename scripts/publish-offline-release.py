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


def release_list(repo):
    return json.loads(gh('api', f'repos/{repo}/releases?per_page=100'))


def release_tag_sha(repo, tag):
    result = subprocess.run(['gh', 'api', f'repos/{repo}/git/ref/tags/{tag}'], text=True, capture_output=True)
    if result.returncode != 0:
        if 'HTTP 404' in result.stderr:
            return None
        raise RuntimeError(result.stderr)
    ref = json.loads(result.stdout)['object']
    while ref['type'] == 'tag':
        ref_sha = ref['sha']
        ref = json.loads(gh('api', f'repos/{repo}/git/tags/{ref_sha}'))['object']
    return ref['sha']


def upload_asset(repo, release_id, path):
    import urllib.parse

    token = os.environ['GH_TOKEN']
    url = f'https://uploads.github.com/repos/{repo}/releases/{release_id}/assets?name={urllib.parse.quote(path.name)}'
    result = subprocess.run([
        'curl', '--fail-with-body', '--silent', '--show-error', '--request', 'POST',
        '--header', 'Accept: application/vnd.github+json',
        '--header', f'Authorization: Bearer {token}',
        '--header', 'X-GitHub-Api-Version: 2022-11-28',
        '--header', 'Content-Type: application/octet-stream',
        '--data-binary', f'@{path.resolve()}', url,
    ], check=True, text=True, capture_output=True)
    return json.loads(result.stdout)


def main():
    repo = os.environ['GH_REPO']
    tag = os.environ['RELEASE_TAG']
    sha = os.environ['TARGET_SHA']
    run_id = os.environ['ARTIFACT_RUN_ID']
    source_run = json.loads(gh('api', f'repos/{repo}/actions/runs/{run_id}'))
    if source_run['path'] not in ['.github/workflows/auto-offline-release.yml', '.github/workflows/build-windows-offline.yml']:
        raise ValueError('Artifact was not produced by an offline build workflow')
    if source_run['path'] == '.github/workflows/auto-offline-release.yml':
        jobs = json.loads(gh('api', f'repos/{repo}/actions/runs/{run_id}/jobs'))['jobs']
        build_succeeded = any(job['name'].startswith('build / ') and job['conclusion'] == 'success' for job in jobs)
    else:
        build_succeeded = source_run.get('conclusion') == 'success'
    if not build_succeeded:
        raise ValueError('Source build run did not succeed')
    directory = Path('release-assets')
    manifest, installer = verify(directory, tag, sha)
    title = f'DeepSeek Harness Desktop {manifest['desktopVersion']} Windows 离线版'
    notes = Path('release-notes.md')
    notes.write_text(f'''Windows x64 离线修改版（未签名），由 GitHub Actions 自动构建并发布。

先运行 `MicrosoftEdgeWebView2RuntimeInstallerX64.exe`，再运行 `{installer}`。主安装器不会联网下载或内置 WebView2 Runtime。

- 桌面上游源码：`{manifest['auditedUpstreamCommit']}`
- 离线构建源码：`{sha}`
- Harness：`{manifest['assets']['harness']['releaseTag']}`
- [构建记录](https://github.com/{repo}/actions/runs/{run_id})
- 已校验四个发布文件及 SHA-256；自动构建不代表已完成人工 Windows 断网安装验收。
''')
    candidates = [r for r in release_list(repo) if r['tag_name'] == tag]
    if any(not r['draft'] for r in candidates):
        print(f'{tag} is already public; leaving it unchanged')
        return
    if any(r['target_commitish'] != sha for r in candidates):
        raise ValueError('Existing draft targets a different source commit')
    if candidates:
        release = min(candidates, key=lambda r: r['created_at'])
    else:
        result = subprocess.run([
            'gh', 'release', 'create', tag, '--target', sha, '--draft',
            '--title', title, '--notes-file', str(notes),
        ], check=True, text=True, capture_output=True)
        release = [r for r in release_list(repo) if r['tag_name'] == tag and r['draft']]
        if len(release) != 1 or release[0]['target_commitish'] != sha:
            raise RuntimeError(f'Could not resolve the new draft release: {result.stdout.strip()}')
        release = release[0]
    expected_names = {path.name for path in directory.iterdir()}
    remote = {asset['name']: asset for asset in release['assets']}
    for name, asset in list(remote.items()):
        if name not in expected_names:
            raise ValueError(f'Unexpected existing draft asset: {name}')
        path = directory / name
        if asset['size'] == path.stat().st_size and asset.get('digest') == 'sha256:' + digest(path):
            continue
        asset_id = asset['id']
        gh('api', '--method', 'DELETE', f'repos/{repo}/releases/assets/{asset_id}')
    for path in sorted(directory.iterdir()):
        release_id = release['id']
        current = json.loads(gh('api', f'repos/{repo}/releases/{release_id}'))['assets']
        existing = next((asset for asset in current if asset['name'] == path.name), None)
        expected_digest = 'sha256:' + digest(path)
        if existing and existing['size'] == path.stat().st_size and existing.get('digest') == expected_digest:
            continue
        uploaded = upload_asset(repo, release_id, path)
        if uploaded['size'] != path.stat().st_size or uploaded.get('digest') != expected_digest:
            raise ValueError(f'Uploaded release digest mismatch: {path.name}')
    release_id = release['id']
    uploaded = json.loads(gh('api', f'repos/{repo}/releases/{release_id}'))
    remote = {asset['name']: asset for asset in uploaded['assets']}
    if set(remote) != expected_names:
        raise ValueError('Remote release file list mismatch')
    for path in directory.iterdir():
        expected_digest = 'sha256:' + digest(path)
        if remote[path.name]['size'] != path.stat().st_size or remote[path.name].get('digest') != expected_digest:
            raise ValueError(f'Remote release digest mismatch: {path.name}')
    tag_sha = release_tag_sha(repo, tag)
    if tag_sha and tag_sha != sha:
        raise ValueError('Release tag points to a different commit')
    if tag_sha is None:
        gh('api', '--method', 'POST', f'repos/{repo}/git/refs', '-f', f'ref=refs/tags/{tag}', '-f', f'sha={sha}')
    if release_tag_sha(repo, tag) != sha:
        raise ValueError('Release tag target verification failed')
    gh('api', '--method', 'PATCH', f'repos/{repo}/releases/{release_id}',
       '-F', 'draft=false', '-F', 'prerelease=false', '-f', f'name={title}', '-F', f'body=@{notes}')
    print(f'https://github.com/{repo}/releases/tag/{tag}')


if __name__ == '__main__':
    main()
