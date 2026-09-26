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
    git_export = 'pub use installable::Git;'
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
    additions = []
    if git_export in ours and git_export not in merged:
        additions.append(git_export)
    if offline_exports not in merged:
        additions.append(offline_exports)
    if additions:
        merged = merged.replace(upstream_exports, upstream_exports + '\n' + '\n'.join(additions), 1)
    return merged


def merge_runtime_conflict(ours, theirs):
    offline_build = 'pub fn offline_build() -> bool {\n    option_env!("DSH_OFFLINE_BUILD").is_some()\n}'
    bundled_git = '''#[cfg(windows)]
pub fn bundled_git_runtime_ready<R: Runtime>(app_handle: &AppHandle<R>) -> bool {
    git_binary_works(&get_mingit_binary_path(app_handle))
}'''
    if offline_build not in ours or bundled_git not in ours:
        raise RuntimeError('Unexpected offline runtime changes in src-tauri/src/config/runtime.rs')

    merged = theirs
    import_anchor = 'use super::{detect_region, Region};\n'
    if offline_build not in merged:
        if import_anchor not in merged:
            raise RuntimeError('Cannot locate runtime imports while resolving upstream conflict')
        merged = merged.replace(import_anchor, import_anchor + '\n' + offline_build + '\n', 1)

    default_preference = '''pub fn prefer_bundled_node_runtime() -> bool {
    PREFER_BUNDLED_NODE_RUNTIME.load(Ordering::Relaxed)
}'''
    offline_preference = '''pub fn prefer_bundled_node_runtime() -> bool {
    offline_build() || PREFER_BUNDLED_NODE_RUNTIME.load(Ordering::Relaxed)
}'''
    if default_preference in merged:
        merged = merged.replace(default_preference, offline_preference, 1)
    elif offline_preference not in merged:
        raise RuntimeError('Cannot locate bundled Node preference while resolving upstream conflict')

    git_cmd_signature = 'pub fn get_git_cmd_dir<R: Runtime>(app_handle: &AppHandle<R>) -> Option<PathBuf> {\n'
    offline_git_cmd = '''    if offline_build() {
        let bundled = get_mingit_binary_path(app_handle);
        return if git_binary_works(&bundled) {
            bundled.parent().map(Path::to_path_buf)
        } else {
            None
        };
    }
'''
    if offline_git_cmd.strip() not in merged:
        if git_cmd_signature not in merged:
            raise RuntimeError('Cannot locate Windows Git command-path selector while resolving upstream conflict')
        merged = merged.replace(git_cmd_signature, git_cmd_signature + offline_git_cmd, 1)

    git_ready_pattern = re.compile(
        r'(pub fn git_runtime_ready<R: Runtime>\(app_handle: &AppHandle<R>\) -> bool \{\n)(.*?)(\n\})',
        re.S,
    )
    match = git_ready_pattern.search(merged)
    if not match:
        raise RuntimeError('Cannot locate Git readiness check while resolving upstream conflict')
    body = match.group(2)
    if 'dependencies::bundled_core_dir(app_handle).is_some()' not in body and 'offline_build()' not in body:
        raise RuntimeError('Unexpected upstream Git readiness check while resolving offline conflict')
    offline_git_ready = '''    if offline_build() {
        return bundled_git_runtime_ready(app_handle);
    }
'''
    if 'if offline_build()' not in body:
        merged = merged[:match.start(2)] + offline_git_ready + body + merged[match.end(2):]
    if bundled_git not in merged:
        # `match` offsets are stale after the body insertion; use the stable closing context.
        function = git_ready_pattern.search(merged)
        if not function:
            raise RuntimeError('Cannot re-locate Git readiness check after merging offline mode')
        merged = merged[:function.end()] + '\n\n' + bundled_git + merged[function.end():]
    return merged


def merge_core_version_conflict(ours, theirs):
    if 'if config::offline_build() {' not in ours:
        raise RuntimeError('Unexpected offline core-version changes in src-tauri/src/service/core/version.rs')
    signature = 'async fn fetch_release_catalog() -> (Vec<download::DshPkgReleaseMeta>, bool) {\n'
    offline_guard = '''    if config::offline_build() {
        return (Vec::new(), false);
    }
'''
    if offline_guard.strip() in theirs:
        return theirs
    if signature not in theirs or 'match download::fetch_dsh_pkg_releases().await {' not in theirs:
        raise RuntimeError('Cannot locate upstream release catalog while resolving offline conflict')
    return theirs.replace(signature, signature + offline_guard, 1)


def merge_install_workflow_conflict(ours, theirs):
    required_offline_code = [
        'let offline_manifest = download::load_offline_manifest(app_handle)?;',
        'download::read_offline_asset(&tracker, manifest, key).await?',
        'asset.release_commit.clone().unwrap_or_default()',
    ]
    if any(code not in ours for code in required_offline_code):
        raise RuntimeError('Unexpected offline installer changes in src-tauri/src/service/workflow/install.rs')

    merged = theirs
    install_log = '    log::info!("Starting installation process");\n'
    manifest_setup = '''    let offline_manifest = download::load_offline_manifest(app_handle)?;
    if config::offline_build() {
        dsh_latest = None;
        log::info!("Offline build selected; dependency installation is local-only");
    }
'''
    if 'let offline_manifest = download::load_offline_manifest(app_handle)?;' not in merged:
        if install_log not in merged:
            raise RuntimeError('Cannot locate installer entry point while resolving offline conflict')
        merged = merged.replace(install_log, install_log + manifest_setup, 1)

    online_lookup = 'if dsh_latest.is_none() && dsh_missing {'
    if online_lookup in merged:
        merged = merged.replace(online_lookup, 'if !config::offline_build() && dsh_latest.is_none() && dsh_missing {', 1)
    elif 'if !config::offline_build() && dsh_latest.is_none() && dsh_missing {' not in merged:
        raise RuntimeError('Cannot locate Harness metadata lookup while resolving offline conflict')

    outdated_start = merged.find('        let outdated = kind == download::InstallKind::Dsh\n')
    outdated_end = merged.find('\n        if task.check_installed(app_handle) && !outdated {', outdated_start)
    if outdated_start < 0 or outdated_end < 0:
        raise RuntimeError('Cannot locate installer version check while resolving offline conflict')
    old_outdated = merged[outdated_start:outdated_end]
    if 'if config::offline_build()' not in old_outdated:
        prefix = '        let outdated = kind == download::InstallKind::Dsh\n            && '
        if not old_outdated.startswith(prefix) or not old_outdated.endswith(';'):
            raise RuntimeError('Unexpected Harness version check while resolving offline conflict')
        online_expression = old_outdated[len(prefix):-1].splitlines()
        if not online_expression:
            raise RuntimeError('Empty Harness version check while resolving offline conflict')
        online_expression = '\n'.join(
            ['                ' + online_expression[0].lstrip()]
            + [('    ' + line) if line else '' for line in online_expression[1:]]
        )
        offline_outdated = '''        let outdated = kind == download::InstallKind::Dsh
            && if config::offline_build() {
                offline_manifest
                    .as_ref()
                    .and_then(|manifest| manifest.asset("harness").ok())
                    .is_some_and(|asset| {
                        config::get_dsh_version(app_handle).as_deref()
                            != Some(asset.version.trim())
                    })
            } else {
''' + online_expression + '''
            };
'''
        merged = merged[:outdated_start] + offline_outdated + merged[outdated_end:]

    download_start = merged.find('        let (urls, name) = if kind == download::InstallKind::Dsh {')
    verify_start = merged.find('        download::verify_sha256(&buffer, &expected_digest)?;', download_start)
    if download_start < 0 or verify_start < 0:
        if 'let (name, buffer, expected_digest) = if let Some(manifest) = offline_manifest.as_ref() {' in merged:
            download_start = -1
        else:
            raise RuntimeError('Cannot locate installer download block while resolving offline conflict')
    if download_start >= 0:
        online_download = merged[download_start:verify_start].rstrip()
        online_download = '\n'.join(('    ' + line) if line else '' for line in online_download.splitlines())
        offline_download = '''        let (name, buffer, expected_digest) = if let Some(manifest) = offline_manifest.as_ref() {
            let key = match kind {
                download::InstallKind::Node => "node",
                download::InstallKind::Dsh => "harness",
                download::InstallKind::Pnpm => "pnpm",
                download::InstallKind::Git => "mingit",
            };
            let (name, buffer) = download::read_offline_asset(&tracker, manifest, key).await?;
            let digest = manifest.asset(key)?.sha256.clone();
            (name, buffer, digest)
        } else {
''' + online_download + '''
            (name, buffer, expected_digest)
        };
'''
        merged = merged[:download_start] + offline_download + merged[verify_start:]

    release_record = '''            if let Some(info) = &dsh_latest {
                config::set_dsh_pkg_commit(app_handle, info.commit.clone());
                config::set_dsh_pkg_tag(app_handle, info.tag.clone());
            }'''
    offline_release_record = '''            if let Some(manifest) = &offline_manifest {
                let asset = manifest.asset("harness")?;
                config::set_dsh_pkg_commit(
                    app_handle,
                    asset.release_commit.clone().unwrap_or_default(),
                );
                config::set_dsh_pkg_tag(
                    app_handle,
                    asset.release_tag.clone().unwrap_or_default(),
                );
            } else if let Some(info) = &dsh_latest {
                config::set_dsh_pkg_commit(app_handle, info.commit.clone());
                config::set_dsh_pkg_tag(app_handle, info.tag.clone());
            }'''
    if release_record in merged:
        merged = merged.replace(release_record, offline_release_record, 1)
    elif offline_release_record not in merged:
        raise RuntimeError('Cannot locate Harness release record while resolving offline conflict')
    return merged


def resolve_known_offline_conflicts():
    runtime_path = 'src-tauri/src/config/runtime.rs'
    version_path = 'src-tauri/src/service/core/version.rs'
    download_path = 'src-tauri/src/service/download/mod.rs'
    install_path = 'src-tauri/src/service/workflow/install.rs'
    resolvers = {
        runtime_path: merge_runtime_conflict,
        version_path: merge_core_version_conflict,
        download_path: merge_download_module,
        install_path: merge_install_workflow_conflict,
    }
    conflicts = run('git', 'diff', '--name-only', '--diff-filter=U').splitlines()
    if not conflicts or any(path not in resolvers for path in conflicts):
        return False

    for path, resolver in resolvers.items():
        if path not in conflicts:
            continue
        ours = run('git', 'show', f':2:{path}', preserve=True)
        theirs = run('git', 'show', f':3:{path}', preserve=True)
        (ROOT / path).write_text(resolver(ours, theirs))
        run('git', 'add', '--', path)
        print(f'Resolved known offline/upstream conflict in {path}')
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


def release_action(existing_release, tag_exists):
    if existing_release:
        return 'published' if not existing_release['draft'] else 'resume'
    return 'tag-only' if tag_exists else 'build'


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
    tag_exists = bool(run('git', 'tag', '--list', release_tag))
    action = release_action(existing_release, tag_exists)
    print(f'Latest upstream release: {tag}; offline release state: {action}')
    if action == 'published':
        target = existing_release['target_commitish']
        if re.fullmatch(r'[0-9a-f]{40}', target):
            output(should_build='false', already_published='true', source_ref=target, tag=release_tag)
        else:
            output(should_build='false')
        print(f'{release_tag} already published')
        return
    if action == 'tag-only':
        # A published GitHub Release always has a tag. If the release-list API
        # temporarily omits its metadata, never rebuild or overwrite that tag.
        # Leave cleanup disabled; the next scheduled check can reconcile it.
        print(f'{release_tag} tag exists but its Release metadata is unavailable; skipping duplicate packaging')
        output(should_build='false')
        return
    if action == 'resume':
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
            if not resolve_known_offline_conflicts():
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
