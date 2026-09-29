"""Opt in to an already-provisioned App Group without changing shared project files."""
import argparse
from pathlib import Path
import re
parser = argparse.ArgumentParser(description=__doc__)
group = parser.add_mutually_exclusive_group(required=True)
group.add_argument('--app-group', help='Your registered App Group, e.g. group.app.modeatlas')
group.add_argument('--disable', action='store_true', help='Return to shortcut-only widgets')
args = parser.parse_args()
config = Path(__file__).resolve().parent / 'ios/widget-sharing.local.xcconfig'
if args.disable:
    config.unlink(missing_ok=True)
    print('Widget progress sharing disabled. Practice shortcuts remain available.')
else:
    if not re.fullmatch(r'group\.[A-Za-z0-9][A-Za-z0-9.-]+', args.app_group):
        parser.error('Enter a registered group. identifier using only letters, numbers, dots and hyphens.')
    config.write_text(f'MODE_ATLAS_APP_GROUP = {args.app_group}\nMODE_ATLAS_ENTITLEMENTS = Shared/WidgetSharing.entitlements\n')
    print('Configured shared progress. Assign the same registered App Group and signing team to App and ModeAtlasWidgets in Xcode.')
