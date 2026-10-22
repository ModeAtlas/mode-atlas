"""Select an installed release Xcode with an iOS SDK that supports Duo.

Used by CI and the documented Mac handover. Does not install software or change
xcode-select globally; emits the selected Developer path for DEVELOPER_DIR.
"""
from pathlib import Path
import os
import re
import subprocess
import sys


def version(value):
    match = re.match(r'^(\d+)\.(\d+)', value)
    return tuple(map(int, match.groups())) if match else (0, 0)


def select():
    candidates = []
    for app in Path('/Applications').glob('Xcode*.app'):
        if 'beta' in app.name.lower():
            continue
        directory = app / 'Contents/Developer'
        result = subprocess.run(['xcrun', '--sdk', 'iphoneos', '--show-sdk-version'],
                                env={**os.environ, 'DEVELOPER_DIR': str(directory)},
                                capture_output=True, text=True, timeout=30)
        sdk = version(result.stdout.strip())
        if result.returncode == 0 and sdk >= (27, 1):
            candidates.append((sdk, str(directory)))
    if not candidates:
        raise SystemExit('iOS 27.1 SDK or later is required for the Duo release. Install release Xcode 27.1+; the previous SDK would produce a compatibility layout.')
    return max(candidates)[1]


if __name__ == '__main__':
    print(select())
