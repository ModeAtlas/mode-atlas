"""Validate this Mac's selected Xcode; discover a release toolchain only in CI.

Never changes xcode-select, Xcode preferences or the app used to open a project.
"""
from pathlib import Path
import argparse
import os
import re
import subprocess


def version(value):
    match = re.match(r'^(\d+)\.(\d+)', value)
    return tuple(map(int, match.groups())) if match else (0, 0)


def sdk_version(directory):
    result = subprocess.run(['xcrun', '--sdk', 'iphoneos', '--show-sdk-version'],
                            env={**os.environ, 'DEVELOPER_DIR': str(directory)},
                            capture_output=True, text=True, timeout=30)
    return version(result.stdout.strip()) if result.returncode == 0 else (0, 0)


def select(ci=False):
    if not ci:
        directory = os.environ.get('DEVELOPER_DIR', '').strip()
        if not directory:
            result = subprocess.run(['xcode-select', '--print-path'],
                                    capture_output=True, text=True, timeout=30)
            directory = result.stdout.strip() if result.returncode == 0 else ''
        if not directory or sdk_version(directory) < (27, 1):
            raise SystemExit('Your selected Xcode needs the iOS 27.1 SDK or later for Duo. '
                             'Choose the intended Xcode in Xcode Settings > Locations > Command Line Tools, '
                             'then retry. No Xcode selection or preferences were changed.')
        return directory

    candidates = []
    for app in Path('/Applications').glob('Xcode*.app'):
        if 'beta' in app.name.lower():
            continue
        directory = app / 'Contents/Developer'
        sdk = sdk_version(directory)
        if sdk >= (27, 1):
            candidates.append((sdk, str(directory)))
    if not candidates:
        raise SystemExit('iOS 27.1 SDK or later is required for the Duo release. Install release Xcode 27.1+; the previous SDK would produce a compatibility layout.')
    return max(candidates)[1]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ci', action='store_true', help='Discover the latest release Xcode on a CI runner.')
    print(select(ci=parser.parse_args().ci))
