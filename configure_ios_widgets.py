"""Own the local App Group selection and the app/extension entitlement mapping."""
import argparse
from pathlib import Path
import re

CONFIG = Path(__file__).resolve().parent / 'ios/widget-sharing.local.xcconfig'


def widget_settings(app_group: str, source: str = '') -> str:
    if not re.fullmatch(r'group\.[A-Za-z0-9][A-Za-z0-9.-]+', app_group):
        raise ValueError('Enter your registered group. identifier using only letters, numbers, dots and hyphens.')
    # Remove the previous shared entitlement selector during the one-time
    # migration. Keep unrelated local settings and the actual provisioned group.
    source = re.sub(r'^[ \t]*MODE_ATLAS_(?:APP_GROUP|ENTITLEMENTS|APP_ENTITLEMENTS|WIDGET_ENTITLEMENTS)[ \t]*=[^\n]*(?:\n|$)', '', source, flags=re.M).strip()
    prefix = source + '\n' if source else ''
    return (prefix + f'MODE_ATLAS_APP_GROUP = {app_group}\n'
            'MODE_ATLAS_APP_ENTITLEMENTS = App/AppWithWidgets.entitlements\n'
            'MODE_ATLAS_WIDGET_ENTITLEMENTS = Shared/WidgetSharing.entitlements\n')


def sync_widget_configuration(config: Path = CONFIG) -> None:
    if not config.exists():
        return
    source = config.read_text()
    groups = re.findall(r'^[ \t]*MODE_ATLAS_APP_GROUP[ \t]*=[ \t]*([^\n]+)', source, re.M)
    if len(groups) != 1:
        raise ValueError('Widget configuration needs one registered App Group. Run configure_ios_widgets.py --app-group YOUR_GROUP_ID.')
    updated = widget_settings(groups[0].strip(), source)
    if source != updated:
        config.write_text(updated)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--app-group', help='Your registered App Group, e.g. group.app.modeatlas')
    group.add_argument('--disable', action='store_true', help='Disable shared widget progress')
    args = parser.parse_args()
    if args.disable:
        CONFIG.unlink(missing_ok=True)
        print('Widget sharing disabled. The app retains Sign in with Apple.')
        return
    try:
        settings = widget_settings(args.app_group, CONFIG.read_text() if CONFIG.exists() else '')
    except ValueError as error:
        parser.error(str(error))
    CONFIG.write_text(settings)
    print('App Group saved for both targets; Apple sign-in remains app-only. Confirm the group is provisioned on your paid signing team.')


if __name__ == '__main__':
    main()
