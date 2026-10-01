import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import sync_ios_project as release
from configure_ios_signing import signing_plan


class ReleaseTests(unittest.TestCase):
    def test_upload_sequence_is_independent_and_keeps_both_targets_together(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / 'release.xcconfig'
            config.write_text('// release\nMODE_ATLAS_BUILD_NUMBER = 2080001\n')
            with patch.object(release, 'BUILD_CONFIG', config):
                self.assertEqual(release.ios_build_number(), 2080001)
                self.assertEqual(release.next_build(), 2080002)
                self.assertEqual(release.ios_build_number(), 2080002)
                self.assertIn('// release', config.read_text())
        project = release.PBXPROJ.read_text()
        self.assertEqual(project.count('CURRENT_PROJECT_VERSION = "$(MODE_ATLAS_BUILD_NUMBER)";'), 4)

    def test_invalid_or_ambiguous_builds_fail_before_mutating(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / 'release.xcconfig'
            with patch.object(release, 'BUILD_CONFIG', config):
                for value in ['0', '-1', '1.2', '1000000000', '1\nMODE_ATLAS_BUILD_NUMBER = 2']:
                    source = f'MODE_ATLAS_BUILD_NUMBER = {value}\n'
                    config.write_text(source)
                    with self.assertRaises(SystemExit):
                        release.next_build()
                    self.assertEqual(config.read_text(), source)

    def test_team_migration_preserves_unrelated_native_settings_and_is_repeatable(self):
        project = '\tDEVELOPMENT_TEAM = ABC1234567;\n\tDevelopmentTeam = ABC1234567;\n\tCODE_SIGN_ENTITLEMENTS = "$(MODE_ATLAS_ENTITLEMENTS)";\n'
        local = '// keep local preferences\nOTHER_SETTING = value\n'
        updated, settings = signing_plan(project, local)
        self.assertNotIn('ABC1234567', updated)
        self.assertIn('CODE_SIGN_ENTITLEMENTS', updated)
        self.assertIn('OTHER_SETTING = value', settings)
        self.assertIn('DEVELOPMENT_TEAM = ABC1234567', settings)
        self.assertEqual(signing_plan(updated, settings), (updated, settings))

    def test_missing_or_conflicting_team_requires_an_explicit_resolution(self):
        for source in ['', 'DEVELOPMENT_TEAM = ABC1234567;\nDEVELOPMENT_TEAM = XYZ1234567;']:
            with self.assertRaises(ValueError):
                signing_plan(source)
        with self.assertRaises(ValueError):
            signing_plan('', requested='not-a-team')
        self.assertIn('DEVELOPMENT_TEAM = ABC1234567', signing_plan('', requested='ABC1234567')[1])


if __name__ == '__main__':
    unittest.main()
