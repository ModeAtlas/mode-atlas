"""Keep this Mac's signing team out of the shared Xcode project.

Run once after choosing a team in Xcode, or pass --team YOURTEAMID.
App Group configuration continues to belong to widget-sharing.local.xcconfig.
"""
from __future__ import annotations

from pathlib import Path
import argparse
import re

ROOT = Path(__file__).resolve().parent
TEAM_LINE = re.compile(r'^[ \t]*(?:DEVELOPMENT_TEAM|DevelopmentTeam) = "?([A-Z0-9]{10})"?;?[ \t]*(?:\r?\n|$)', re.M)


def signing_plan(project: str, local: str = '', requested: str | None = None) -> tuple[str, str]:
    teams = set(TEAM_LINE.findall(project)) | set(TEAM_LINE.findall(local))
    if requested:
        if not re.fullmatch(r'[A-Z0-9]{10}', requested):
            raise ValueError('Use the 10-character Apple team ID from Xcode.')
        if teams - {requested}:
            raise ValueError('Different signing teams are present. Resolve the team selection in Xcode first.')
        teams.add(requested)
    if len(teams) != 1:
        raise ValueError('Choose one team in Xcode first, or run npm run ios:signing -- --team YOURTEAMID.')
    team = teams.pop()
    project = TEAM_LINE.sub('', project)
    local = TEAM_LINE.sub('', local).strip()
    if not local:
        local = '// Local Mac signing settings. This file is ignored by Git.'
    return project, local + f'\nDEVELOPMENT_TEAM = {team}\n'


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--team')
    args = parser.parse_args()
    project_path = ROOT / 'ios/App/App.xcodeproj/project.pbxproj'
    local_path = ROOT / 'ios/signing.local.xcconfig'
    source = project_path.read_text()
    try:
        project, local = signing_plan(source, local_path.read_text() if local_path.exists() else '', args.team)
    except ValueError as error:
        parser.error(str(error))
    if project != source:
        backup = ROOT / '.build/signing-migration'
        backup.mkdir(parents=True, exist_ok=True)
        (backup / 'project.pbxproj').write_text(source)
    local_path.write_text(local)
    if project != source:
        project_path.write_text(project)
    print('Signing team saved in ios/signing.local.xcconfig for both app and widget. App Group settings preserved.')


if __name__ == '__main__':
    main()
