import json
import os
import re
import subprocess
from urllib.parse import quote


def gh(*args):
    return subprocess.run(['gh', *args], check=True, text=True, capture_output=True).stdout.strip()


def api(path):
    return json.loads(gh('api', path))


def cleanup_action(releases, tag, sha, publish_result):
    matches = [release for release in releases if release['tag_name'] == tag]
    public = [release for release in matches if not release['draft']]
    if len(public) > 1:
        raise RuntimeError(f'Multiple public GitHub Releases use tag {tag}')
    if public:
        if public[0]['target_commitish'] == sha:
            return 'delete'
        if publish_result == 'success':
            raise RuntimeError('Published release targets a different source commit')
        return 'delete'
    if any(release['draft'] and release['target_commitish'] == sha for release in matches):
        return 'preserve'
    if publish_result == 'success':
        raise RuntimeError('Successful publication has no matching public release')
    return 'delete'


def matching_refs(repo, sha):
    pages = json.loads(gh('api', '--paginate', '--slurp', f'repos/{repo}/git/matching-refs/heads/codex/auto-offline-'))
    matches = []
    for page in pages:
        for ref in page:
            name = ref['ref']
            if not re.fullmatch(r'refs/heads/codex/auto-offline-v[0-9]+\.[0-9]+\.[0-9]+-[0-9]+-[0-9]+', name):
                continue
            if ref['object']['sha'] == sha:
                matches.append(name)
    return matches


def main():
    repo = os.environ['GH_REPO']
    tag = os.environ['RELEASE_TAG']
    sha = os.environ['TARGET_SHA']
    publish_result = os.environ['PUBLISH_RESULT']
    if not re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+-offline-sidecar', tag):
        raise ValueError('Unexpected offline release tag')
    if not re.fullmatch(r'[0-9a-f]{40}', sha):
        raise ValueError('Unexpected source commit')
    releases = api(f'repos/{repo}/releases?per_page=100')
    action = cleanup_action(releases, tag, sha, publish_result)
    if action == 'preserve':
        print(f'Keeping the source branch for resumable draft {tag}')
        return
    if any(release['tag_name'] == tag and not release['draft'] and release['target_commitish'] == sha for release in releases):
        tag_sha = api(f'repos/{repo}/commits/{quote(tag, safe="")}')['sha']
        if tag_sha != sha:
            raise RuntimeError('Published release tag points to a different source commit')
    refs = matching_refs(repo, sha)
    for ref in refs:
        gh('api', '--method', 'DELETE', f'repos/{repo}/git/{ref}')
    if matching_refs(repo, sha):
        raise RuntimeError('Temporary source branch still exists after cleanup')
    if refs:
        print(f'Deleted {len(refs)} temporary source branch(es) for {tag}')
    else:
        print(f'No temporary source branch remains for {tag}')


if __name__ == '__main__':
    main()
