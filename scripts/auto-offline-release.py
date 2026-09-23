import json
import os
from pathlib import Path
import re
import subprocess
import time
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent


def run(*args, **kwargs):
    preserve = kwargs.pop('preserve', False)
    result = subprocess.run(args, cwd=ROOT, check=True, text=True, capture_output=True, **kwargs).stdout
    return result if preserve else result.strip()


def api(path):
    return json.loads(run('gh', 'api', path))


def release_exists(repo, tag):
    result = subprocess.run(['gh', 'api', f'repos/{repo}/releases/tags/{tag}'], text=True, capture_output=True)
    if result.returncode == 0:
        return not json.loads(result.stdout)['draft']
    if 'HTTP 404' in result.stderr:
        return False
    raise RuntimeError(result.stderr)


def select_harness(releases, version):
    pattern = re.compile(rf'dsh-{re.escape(version)}-[0-9]+')
    matches = [r for r in releases if not r['draft'] and pattern.fullmatch(r['tag_name'])]
    if not matches:
        return None
    return max(matches, key=lambda r: int(r['tag_name'].rsplit('-', 1)[1]))


def harness_lock(version, upstream_sha):
    repo = 'dsh-tauri/deepseek-harness-pkg'
    candidates = []
    for page in range(1, 11):
        releases = api(f'repos/{repo}/releases?per_page=100&page={page}')
        candidates.extend(releases)
        if len(releases) < 100:
            break
    release = select_harness(candidates, version)
    if release is None:
        raise RuntimeError(f'No pinned Harness release for {version}')
    assets = [a for a in release['assets'] if a['name'] == 'deepseek-harness-pkg-windows.zip']
    if len(assets) != 1 or not re.fullmatch(r'sha256:[0-9a-f]{64}', assets[0].get('digest') or ''):
        raise RuntimeError('Harness Windows asset has no trusted GitHub SHA-256 digest')
    tag = release['tag_name']
    sha = api(f'repos/{repo}/commits/{quote(tag, safe="")}')['sha']
    return dict(version=version, tag=tag, commit=sha, sha256=assets[0]['digest'][7:], upstreamCommit=upstream_sha)


def check_runtime_pins():
    source = (ROOT / 'src-tauri/src/config/constants.rs').read_text()
    script = (ROOT / 'scripts/offline-windows.mjs').read_text()
    for name in ['NODE_VERSION', 'PNPM_VERSION', 'PNPM_SHA256', 'MINGIT_VERSION', 'MINGIT_X64_SHA256']:
        match = re.search(rf'pub const {name}: &str =\s*"([^"]+)"', source)
        if not match or f"'{match[1]}'" not in script:
            raise RuntimeError(f'{name} changed; offline dependency pins need maintenance')


def output(**values):
    with open(os.environ['GITHUB_OUTPUT'], 'a') as file:
        for key, value in values.items():
            file.write(f'{key}={value}\n')


def keep_schedule_active():
    if os.environ.get('GITHUB_REF') != 'refs/heads/main':
        return
    age = time.time() - int(run('git', 'log', '-1', '--format=%ct'))
    if age < 30 * 24 * 60 * 60:
        return
    run('git', 'config', 'user.name', 'github-actions[bot]')
    run('git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
    run('git', 'commit', '--allow-empty', '-m', 'ci: keep scheduled upstream monitoring active')
    run('git', 'push', 'origin', 'HEAD:refs/heads/main')


def main():
    keep_schedule_active()
    settings = json.loads((ROOT / 'scripts/offline-upstream.json').read_text())
    repo = os.environ['GITHUB_REPOSITORY']
    release = api(f'repos/{settings["repository"]}/releases/latest')
    tag = release['tag_name']
    if release['draft'] or release['prerelease'] or not re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+', tag):
        raise RuntimeError(f'Unexpected stable release tag: {tag}')
    release_tag = f'{tag}-offline-sidecar'
    if release_exists(repo, release_tag):
        output(should_build='false')
        print(f'{release_tag} already published')
        return
    baseline = settings['baseline']
    run('git', 'fetch', '--no-tags', f'https://github.com/{settings["repository"]}.git', f'refs/tags/{tag}')
    upstream_sha = run('git', 'rev-parse', 'FETCH_HEAD^{commit}')
    run('git', 'merge-base', '--is-ancestor', baseline, upstream_sha)
    patch = run('git', 'diff', '--binary', baseline, upstream_sha, '--', '.', ':(exclude).github',
                ':(exclude)scripts/auto-offline-release.py', ':(exclude)scripts/offline-upstream.json',
                ':(exclude)scripts/offline-harness-lock.json', ':(exclude)scripts/offline-windows.mjs',
                ':(exclude)scripts/test-auto-offline-release.py', ':(exclude)scripts/publish-offline-release.py', ':(exclude)docs/OFFLINE_WINDOWS.md', preserve=True)
    if patch:
        run('git', 'apply', '--3way', '--index', input=patch)
    version = json.loads((ROOT / 'package.json').read_text())['version']
    if tag != f'v{version}':
        raise RuntimeError('Desktop version does not match upstream release tag')
    recommendation = json.loads((ROOT / 'src-tauri/resources/version-recommend.json').read_text())['dsh']
    lock = harness_lock(recommendation, upstream_sha)
    check_runtime_pins()
    (ROOT / 'scripts/offline-harness-lock.json').write_text(json.dumps(lock, indent=2) + '\n')
    run('git', 'add', 'scripts/offline-harness-lock.json')
    run('git', 'diff', '--cached', '--check')
    if run('git', 'diff', '--cached', '--name-only', '--', '.github'):
        raise RuntimeError('Automatic synchronization must not change trusted workflows')
    run('git', 'config', 'user.name', 'github-actions[bot]')
    run('git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
    run('git', 'commit', '--allow-empty', '-m', f'build: prepare {release_tag} from {upstream_sha}')
    sha = run('git', 'rev-parse', 'HEAD')
    branch = f'codex/auto-offline-{tag}-{os.environ["GITHUB_RUN_ID"]}-{os.environ["GITHUB_RUN_ATTEMPT"]}'
    run('git', 'push', 'origin', f'HEAD:refs/heads/{branch}')
    output(should_build='true', source_ref=sha, tag=release_tag)
    print(f'Prepared {release_tag}: {sha}, upstream {upstream_sha}, Harness {lock["tag"]}')


if __name__ == '__main__':
    main()
