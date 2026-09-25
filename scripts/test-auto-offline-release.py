import hashlib
import importlib.util
import json
import tempfile
from pathlib import Path
import unittest


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


sync = load('auto-offline-release')
publish = load('publish-offline-release')
cleanup = load('cleanup-auto-offline-branch')


class AutomationTests(unittest.TestCase):
    def test_cleanup_deletes_branch_after_publication_points_to_source(self):
        releases = [dict(tag_name='v0.17.0-offline-sidecar', draft=False, target_commitish='a' * 40)]
        self.assertEqual(cleanup.cleanup_action(releases, 'v0.17.0-offline-sidecar', 'a' * 40, 'success'), 'delete')

    def test_cleanup_preserves_matching_draft_for_publication_resume(self):
        releases = [dict(tag_name='v0.17.0-offline-sidecar', draft=True, target_commitish='a' * 40)]
        self.assertEqual(cleanup.cleanup_action(releases, 'v0.17.0-offline-sidecar', 'a' * 40, 'failure'), 'preserve')

    def test_cleanup_deletes_failed_build_branch_without_release(self):
        self.assertEqual(cleanup.cleanup_action([], 'v0.17.0-offline-sidecar', 'a' * 40, 'skipped'), 'delete')

    def test_cleanup_rejects_success_without_public_release(self):
        with self.assertRaisesRegex(RuntimeError, 'no matching public release'):
            cleanup.cleanup_action([], 'v0.17.0-offline-sidecar', 'a' * 40, 'success')

    def test_cleanup_rejects_public_release_for_a_different_source_commit(self):
        releases = [dict(tag_name='v0.17.0-offline-sidecar', draft=False, target_commitish='b' * 40)]
        with self.assertRaisesRegex(RuntimeError, 'different source commit'):
            cleanup.cleanup_action(releases, 'v0.17.0-offline-sidecar', 'a' * 40, 'success')

    def test_exact_recommended_core_and_newest_build(self):
        releases = [dict(tag_name=tag, draft=draft) for tag, draft in [
            ('dsh-0.1.5-rc.3-9', False), ('dsh-0.1.5-rc.3-10', False),
            ('dsh-0.1.5-rc.30-100', False), ('dsh-0.1.7-rc.1-200', False),
            ('dsh-0.1.5-rc.3-11', True)]]
        self.assertEqual(sync.select_harness(releases, '0.1.5-rc.3')['tag_name'], 'dsh-0.1.5-rc.3-10')
        self.assertIsNone(sync.select_harness(releases, '0.1.8'))

    def test_duplicate_drafts_reuse_the_same_target_and_public_release_wins(self):
        releases = [
            dict(tag_name='v0.17.0-offline-sidecar', draft=True, target_commitish='a' * 40, created_at='2026-09-24T01:00:00Z'),
            dict(tag_name='v0.17.0-offline-sidecar', draft=True, target_commitish='a' * 40, created_at='2026-09-24T01:01:00Z'),
        ]
        self.assertEqual(sync.select_release(releases, 'v0.17.0-offline-sidecar'), releases[0])
        releases.append(dict(tag_name='v0.17.0-offline-sidecar', draft=False, target_commitish='a' * 40))
        self.assertEqual(sync.select_release(releases, 'v0.17.0-offline-sidecar'), releases[2])
        releases[1]['target_commitish'] = 'b' * 40
        with self.assertRaisesRegex(RuntimeError, 'different commits'):
            sync.select_release(releases[:2], 'v0.17.0-offline-sidecar')

    def test_published_release_is_never_rebuilt(self):
        release = dict(draft=False, target_commitish='a' * 40)
        self.assertEqual(sync.release_action(release, False), 'published')
        self.assertEqual(sync.release_action(release, True), 'published')

    def test_draft_release_resumes_publication_even_when_tag_exists(self):
        release = dict(draft=True, target_commitish='a' * 40)
        self.assertEqual(sync.release_action(release, True), 'resume')

    def test_existing_tag_without_release_metadata_skips_duplicate_build(self):
        self.assertEqual(sync.release_action(None, True), 'tag-only')

    def test_new_release_without_release_or_tag_is_built(self):
        self.assertEqual(sync.release_action(None, False), 'build')

    def test_runtime_pins_match(self):
        sync.check_runtime_pins()

    def test_upstream_download_exports_merge_with_offline_manifest_exports(self):
        ours = '''mod core;
mod installable;
mod offline;
pub use installable::{Dsh, InstallKind, Installable, Nodejs, Pnpm};
pub use offline::{load_offline_manifest, read_offline_asset, OfflineAsset, OfflineManifest};
'''
        theirs = '''mod core;
mod installable;
pub use installable::{record_mappings, tasks, Dsh, InstallKind, Installable, Nodejs, Pnpm};
'''

        merged = sync.merge_download_module(ours, theirs)

        self.assertIn('mod offline;', merged)
        self.assertIn('pub use offline::{load_offline_manifest, read_offline_asset, OfflineAsset, OfflineManifest};', merged)
        self.assertIn('pub use installable::{record_mappings, tasks, Dsh, InstallKind, Installable, Nodejs, Pnpm};', merged)
        self.assertEqual(merged.count('mod offline;'), 1)

    def test_upstream_download_merge_rejects_unexpected_conflict_shape(self):
        with self.assertRaisesRegex(RuntimeError, 'Unexpected conflict'):
            sync.merge_download_module('mod core;\n', 'mod core;\n')

    def test_harness_recommendation_reads_legacy_json_layout(self):
        with tempfile.TemporaryDirectory() as temp:
            resources = Path(temp)
            (resources / 'version-recommend.json').write_text('{"dsh":"0.1.5-rc.2"}')
            self.assertEqual(sync.harness_recommendation(resources), '0.1.5-rc.2')

    def test_harness_recommendation_reads_jsonc_manifest_layout(self):
        with tempfile.TemporaryDirectory() as temp:
            resources = Path(temp)
            (resources / 'manifest.jsonc').write_text('''{
  // engine recommendation
  "engines": { "dsh": { "recommend": " 0.1.5-rc.3 ", }, },
  "url": "https://example.com/a//b",
}''')
            self.assertEqual(sync.harness_recommendation(resources), '0.1.5-rc.3')

    def test_publication_rejects_wrong_source_corruption_and_extra_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            manifest = dict(desktopVersion='0.16.0', sourceCommit='a' * 40, schema=1, mode='windows-x64')
            (root / 'offline-manifest.json').write_text(json.dumps(manifest))
            (root / 'deepseek-harness-desktop-0.16.0-windows-x64-offline-setup.exe').write_bytes(b'MZinstaller')
            with (root / 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe').open('wb') as file:
                file.truncate(101 * 1024 * 1024)
            checksums = ''.join(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.name + '\n' for p in root.iterdir())
            (root / 'SHA256SUMS').write_text(checksums)
            publish.verify(root, 'v0.16.0-offline-sidecar', 'a' * 40)
            with self.assertRaisesRegex(ValueError, 'source commit'):
                publish.verify(root, 'v0.16.0-offline-sidecar', 'b' * 40)
            (root / 'unexpected.exe').write_bytes(b'extra')
            with self.assertRaisesRegex(ValueError, 'exactly'):
                publish.verify(root, 'v0.16.0-offline-sidecar', 'a' * 40)
            (root / 'unexpected.exe').unlink()
            (root / 'deepseek-harness-desktop-0.16.0-windows-x64-offline-setup.exe').write_bytes(b'corrupted')
            with self.assertRaisesRegex(ValueError, 'SHA-256 mismatch'):
                publish.verify(root, 'v0.16.0-offline-sidecar', 'a' * 40)


if __name__ == '__main__':
    unittest.main()
