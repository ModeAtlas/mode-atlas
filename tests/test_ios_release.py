import tempfile
import unittest
import plistlib
import re
from pathlib import Path
from unittest.mock import patch

import sync_ios_project as release
from configure_ios_signing import signing_plan
from configure_ios_widgets import sync_widget_configuration


class ReleaseTests(unittest.TestCase):
    def test_router_source_survives_a_retained_local_signing_project(self):
        source = release.PBXPROJ.read_text()
        legacy = re.sub(r'^.*28910000000000000000000[12].*\n', '', source, flags=re.M)
        legacy = legacy.replace('MARKETING_VERSION = ', 'DEVELOPMENT_TEAM = LOCAL12345;\nMARKETING_VERSION = ')
        updated = release.sync_document_router_source(legacy)
        self.assertEqual(updated.count('289100000000000000000001'), 3)
        self.assertEqual(updated.count('289100000000000000000002'), 2)
        self.assertEqual(updated.count('DEVELOPMENT_TEAM = LOCAL12345;'), legacy.count('DEVELOPMENT_TEAM = LOCAL12345;'))
        self.assertEqual(release.sync_document_router_source(updated), updated)
        with self.assertRaises(SystemExit):
            release.sync_document_router_source(legacy.replace('504EC3001FED79650016851F', 'MISSING_SOURCE_PHASE'))

    def test_apple_entitlements_remain_on_app_with_or_without_widget_sharing(self):
        root = release.ROOT / 'ios/App'
        for app_path, widget_path in [('App/App.entitlements', 'Shared/LocalOnly.entitlements'),
                                      ('App/AppWithWidgets.entitlements', 'Shared/WidgetSharing.entitlements')]:
            app = plistlib.loads((root / app_path).read_bytes())
            widget = plistlib.loads((root / widget_path).read_bytes())
            self.assertEqual(app['com.apple.developer.applesignin'], ['Default'])
            self.assertNotIn('com.apple.developer.applesignin', widget)
            self.assertEqual(app.get('com.apple.security.application-groups'), widget.get('com.apple.security.application-groups'))
        project = release.sync_auth_entitlements(release.PBXPROJ.read_text())
        self.assertEqual(project.count('CODE_SIGN_ENTITLEMENTS = "$(MODE_ATLAS_APP_ENTITLEMENTS)";'), 2)
        self.assertEqual(project.count('CODE_SIGN_ENTITLEMENTS = "$(MODE_ATLAS_WIDGET_ENTITLEMENTS)";'), 2)
        self.assertEqual(project, release.sync_auth_entitlements(project))

    def test_existing_app_group_is_migrated_without_losing_local_settings(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / 'widgets.xcconfig'
            config.write_text('// local\nMODE_ATLAS_APP_GROUP = group.real.progress\nMODE_ATLAS_ENTITLEMENTS = Shared/WidgetSharing.entitlements\nOTHER = keep\n')
            sync_widget_configuration(config)
            updated = config.read_text()
            self.assertIn('MODE_ATLAS_APP_GROUP = group.real.progress', updated)
            self.assertIn('OTHER = keep', updated)
            self.assertIn('MODE_ATLAS_APP_ENTITLEMENTS = App/AppWithWidgets.entitlements', updated)
            self.assertNotIn('MODE_ATLAS_ENTITLEMENTS =', updated)
            sync_widget_configuration(config)
            self.assertEqual(config.read_text(), updated)
            config.write_text('MODE_ATLAS_APP_GROUP =\n')
            with self.assertRaises(ValueError):
                sync_widget_configuration(config)
            self.assertEqual(config.read_text(), 'MODE_ATLAS_APP_GROUP =\n')
            config.unlink()
            sync_widget_configuration(config)
            self.assertFalse(config.exists(), 'No App Group is invented for an unconfigured Mac')

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
        self.assertEqual(updated, '\tCODE_SIGN_ENTITLEMENTS = "$(MODE_ATLAS_ENTITLEMENTS)";\n')
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

    def test_explicit_paid_team_replaces_old_local_team_without_changing_widgets(self):
        project = 'DEVELOPMENT_TEAM = NEW1234567;\nMODE_ATLAS_APP_GROUP = group.real.progress;\n'
        local = 'DEVELOPMENT_TEAM = OLD1234567\nOTHER = keep\n'
        with self.assertRaises(ValueError):
            signing_plan(project, local)
        updated, settings = signing_plan(project, local, requested='NEW1234567')
        self.assertIn('group.real.progress', updated)
        self.assertNotIn('OLD1234567', settings)
        self.assertIn('DEVELOPMENT_TEAM = NEW1234567', settings)
        self.assertIn('OTHER = keep', settings)


if __name__ == '__main__':
    unittest.main()
