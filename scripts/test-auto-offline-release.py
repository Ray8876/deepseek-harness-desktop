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


class AutomationTests(unittest.TestCase):
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

    def test_runtime_pins_match(self):
        sync.check_runtime_pins()

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
