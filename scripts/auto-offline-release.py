import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent


def run(*args, **kwargs):
    preserve = kwargs.pop('preserve', False)
    result = subprocess.run(args, cwd=ROOT, check=False, text=True, capture_output=True, **kwargs)
    if result.returncode:
        if result.stdout:
            print(result.stdout, end='', file=sys.stderr)
        if result.stderr:
            print(result.stderr, end='', file=sys.stderr)
        raise subprocess.CalledProcessError(
            result.returncode, args, output=result.stdout, stderr=result.stderr
        )
    return result.stdout if preserve else result.stdout.strip()


def merge_download_module(ours, theirs):
    offline_module = 'mod offline;'
    offline_exports = 'pub use offline::{load_offline_manifest, read_offline_asset, OfflineAsset, OfflineManifest};'
    upstream_exports = next(
        (line for line in theirs.splitlines() if 'pub use installable::{record_mappings, tasks,' in line),
        None,
    )
    if offline_module not in ours or offline_exports not in ours or not upstream_exports:
        raise RuntimeError('Unexpected conflict in src-tauri/src/service/download/mod.rs')

    merged = theirs
    if offline_module not in merged:
        anchor = 'mod installable;\n'
        if anchor not in merged:
            raise RuntimeError('Cannot locate installable module declaration while resolving upstream conflict')
        merged = merged.replace(anchor, anchor + offline_module + '\n', 1)
    if offline_exports not in merged:
        merged = merged.replace(upstream_exports, upstream_exports + '\n' + offline_exports, 1)
    return merged


def resolve_download_module_conflict():
    path = 'src-tauri/src/service/download/mod.rs'
    conflicts = run('git', 'diff', '--name-only', '--diff-filter=U').splitlines()
    if conflicts != [path]:
        return False
    ours = run('git', 'show', f':2:{path}', preserve=True)
    theirs = run('git', 'show', f':3:{path}', preserve=True)
    (ROOT / path).write_text(merge_download_module(ours, theirs))
    run('git', 'add', '--', path)
    print(f'Resolved known offline/upstream export conflict in {path}')
    return True


def api(path):
    return json.loads(run('gh', 'api', path))


def select_release(releases, tag):
    matches = [release for release in releases if release['tag_name'] == tag]
    public = [release for release in matches if not release['draft']]
    if len(public) > 1:
        raise RuntimeError(f'Multiple public GitHub Releases use tag {tag}')
    if public:
        return public[0]
    if len({release['target_commitish'] for release in matches}) > 1:
        raise RuntimeError(f'Draft GitHub Releases target different commits for tag {tag}')
    return min(matches, key=lambda release: release['created_at']) if matches else None


def get_release(repo, tag):
    releases = json.loads(run('gh', 'api', f'repos/{repo}/releases?per_page=100'))
    return select_release(releases, tag)



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


def parse_jsonc(source):
    without_comments = []
    index = 0
    in_string = False
    escaped = False
    while index < len(source):
        char = source[index]
        if in_string:
            without_comments.append(char)
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == '"':
                in_string = False
            index += 1
        elif char == '"':
            in_string = True
            without_comments.append(char)
            index += 1
        elif source.startswith('//', index):
            end = source.find('\n', index)
            if end == -1:
                break
            without_comments.append('\n')
            index = end + 1
        elif source.startswith('/*', index):
            end = source.find('*/', index + 2)
            if end == -1:
                raise ValueError('Unterminated JSONC block comment')
            without_comments.append(' ')
            without_comments.extend(char for char in source[index:end + 2] if char in '\r\n')
            index = end + 2
        else:
            without_comments.append(char)
            index += 1

    source = ''.join(without_comments)
    without_trailing_commas = []
    index = 0
    in_string = False
    escaped = False
    while index < len(source):
        char = source[index]
        if in_string:
            without_trailing_commas.append(char)
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == '"':
                in_string = False
        elif char == '"':
            in_string = True
            without_trailing_commas.append(char)
        elif char == ',':
            following = index + 1
            while following < len(source) and source[following].isspace():
                following += 1
            if following == len(source) or source[following] not in '}]':
                without_trailing_commas.append(char)
        else:
            without_trailing_commas.append(char)
        index += 1
    return json.loads(''.join(without_trailing_commas))


def harness_recommendation(resources):
    legacy = resources / 'version-recommend.json'
    if legacy.is_file():
        version = json.loads(legacy.read_text()).get('dsh')
    else:
        manifest = parse_jsonc((resources / 'manifest.jsonc').read_text())
        version = manifest.get('engines', {}).get('dsh', {}).get('recommend')
    if not isinstance(version, str) or not version.strip():
        raise RuntimeError('Upstream resources do not define a recommended Harness version')
    return version.strip()


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
    existing_release = get_release(repo, release_tag)
    if existing_release and not existing_release['draft']:
        target = existing_release['target_commitish']
        if re.fullmatch(r'[0-9a-f]{40}', target):
            output(should_build='false', already_published='true', source_ref=target, tag=release_tag)
        else:
            output(should_build='false')
        print(f'{release_tag} already published')
        return
    if existing_release:
        match = re.search(r'/actions/runs/(\d+)', existing_release.get('body') or '')
        if not match or not re.fullmatch(r'[0-9a-f]{40}', existing_release['target_commitish']):
            raise RuntimeError('Draft release is missing its source run or target commit')
        source_run_id = match.group(1)
        source_run = api(f'repos/{repo}/actions/runs/{source_run_id}')
        if source_run['path'] == '.github/workflows/auto-offline-release.yml':
            jobs = api(f'repos/{repo}/actions/runs/{source_run_id}/jobs')['jobs']
            build_succeeded = any(job['name'].startswith('build / ') and job['conclusion'] == 'success' for job in jobs)
        else:
            build_succeeded = source_run.get('conclusion') == 'success'
        if not build_succeeded:
            raise RuntimeError('Draft release source build did not succeed')
        artifacts = api(f'repos/{repo}/actions/runs/{source_run_id}/artifacts')['artifacts']
        if not any(a['name'] == 'deepseek-harness-desktop-windows-x64-offline' and not a['expired'] for a in artifacts):
            raise RuntimeError('Draft release source artifact is missing or expired')
        output(should_build='false', resume_publish='true', source_ref=existing_release['target_commitish'],
               artifact_run_id=source_run_id, tag=release_tag)
        print(f'Resuming verified artifact publication for {release_tag} from run {source_run_id}')
        return
    baseline = settings['baseline']
    run('git', 'fetch', '--no-tags', f'https://github.com/{settings["repository"]}.git', f'refs/tags/{tag}')
    upstream_sha = run('git', 'rev-parse', 'FETCH_HEAD^{commit}')
    run('git', 'merge-base', '--is-ancestor', baseline, upstream_sha)
    patch = run('git', 'diff', '--binary', baseline, upstream_sha, '--', '.', ':(exclude).github', ':(exclude)README.md',
                ':(exclude)scripts/auto-offline-release.py', ':(exclude)scripts/offline-upstream.json',
                ':(exclude)scripts/offline-harness-lock.json', ':(exclude)scripts/offline-windows.mjs',
                ':(exclude)scripts/test-auto-offline-release.py', ':(exclude)scripts/publish-offline-release.py',
                ':(exclude)scripts/cleanup-auto-offline-branch.py', ':(exclude)docs/OFFLINE_WINDOWS.md', preserve=True)
    if patch:
        try:
            run('git', 'apply', '--3way', '--index', input=patch)
        except subprocess.CalledProcessError:
            if not resolve_download_module_conflict():
                raise
    version = json.loads((ROOT / 'package.json').read_text())['version']
    if tag != f'v{version}':
        raise RuntimeError('Desktop version does not match upstream release tag')
    recommendation = harness_recommendation(ROOT / 'src-tauri/resources')
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
