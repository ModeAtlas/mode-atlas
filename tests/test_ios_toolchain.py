import subprocess
import os
import unittest
from pathlib import Path
from unittest.mock import patch

import select_ios_toolchain as toolchain


class DuoSDKSelection(unittest.TestCase):
    @patch.object(Path, 'glob')
    @patch.object(subprocess, 'run')
    def test_requires_27_1_and_selects_newest_nonbeta(self, run, glob):
        glob.return_value = [Path('/Applications/Xcode_27.app'), Path('/Applications/Xcode_27.1.app'), Path('/Applications/Xcode_28_beta.app')]
        run.side_effect = [subprocess.CompletedProcess([], 0, '27.0\n'), subprocess.CompletedProcess([], 0, '27.1\n')]
        self.assertEqual(toolchain.select(ci=True), '/Applications/Xcode_27.1.app/Contents/Developer')
        self.assertEqual(run.call_count, 2)

    @patch.object(Path, 'glob', return_value=[Path('/Applications/Xcode.app')])
    @patch.object(subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, '27.0\n'))
    def test_old_sdk_fails_instead_of_accepting_a_compatibility_build(self, run, glob):
        with self.assertRaisesRegex(SystemExit, 'iOS 27.1 SDK'):
            toolchain.select(ci=True)

    @patch.dict(os.environ, {'DEVELOPER_DIR': '/Applications/My Xcode.app/Contents/Developer'})
    @patch.object(subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, '27.1\n'))
    @patch.object(Path, 'glob')
    def test_explicit_toolchain_is_preserved_without_searching_other_apps(self, glob, run):
        self.assertEqual(toolchain.select(), '/Applications/My Xcode.app/Contents/Developer')
        glob.assert_not_called()
        self.assertEqual(run.call_args.kwargs['env']['DEVELOPER_DIR'], os.environ['DEVELOPER_DIR'])

    @patch.dict(os.environ, {}, clear=True)
    @patch.object(subprocess, 'run')
    @patch.object(Path, 'glob')
    def test_uses_the_users_selected_xcode(self, glob, run):
        run.side_effect = [subprocess.CompletedProcess([], 0, '/Applications/Xcode.app/Contents/Developer\n'),
                           subprocess.CompletedProcess([], 0, '27.1\n')]
        self.assertEqual(toolchain.select(), '/Applications/Xcode.app/Contents/Developer')
        self.assertEqual(run.call_args_list[0].args[0], ['xcode-select', '--print-path'])
        glob.assert_not_called()

    @patch.dict(os.environ, {'DEVELOPER_DIR': '/Applications/Older.app/Contents/Developer'})
    @patch.object(subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, '27.0\n'))
    @patch.object(Path, 'glob')
    def test_local_old_sdk_stops_instead_of_silently_switching_xcode(self, glob, run):
        with self.assertRaisesRegex(SystemExit, 'No Xcode selection or preferences were changed'):
            toolchain.select()
        glob.assert_not_called()
