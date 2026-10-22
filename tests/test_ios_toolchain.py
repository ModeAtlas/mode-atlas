import subprocess
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
        self.assertEqual(toolchain.select(), '/Applications/Xcode_27.1.app/Contents/Developer')
        self.assertEqual(run.call_count, 2)

    @patch.object(Path, 'glob', return_value=[Path('/Applications/Xcode.app')])
    @patch.object(subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, '27.0\n'))
    def test_old_sdk_fails_instead_of_accepting_a_compatibility_build(self, run, glob):
        with self.assertRaisesRegex(SystemExit, 'iOS 27.1 SDK'):
            toolchain.select()
