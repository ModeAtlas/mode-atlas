"""Synchronize iOS project release metadata from Mode Atlas' canonical version owner.

The web release metadata remains the single source of truth. Xcode's generated
build settings are derived output and are verified by the release gate.
"""
from __future__ import annotations

from pathlib import Path
import os
import plistlib
import re
import json
import subprocess

from validate_ios_firebase_config import PLIST as FIREBASE_PLIST, validate as validate_firebase
from configure_ios_widgets import sync_widget_configuration

ROOT = Path(__file__).resolve().parent
VERSION_SOURCE = ROOT / "assets/app/mode-atlas-version.js"
PBXPROJ = ROOT / "ios/App/App.xcodeproj/project.pbxproj"
SPM_LINKS = {'CapacitorFirebaseAuthentication': 'authentication', 'CapacitorFirebaseMessaging': 'messaging'}
BUILD_CONFIG = ROOT / "ios/release.xcconfig"


def release_version() -> str:
    source = VERSION_SOURCE.read_text(encoding="utf-8")
    match = re.search(r"var\s+VERSION\s*=\s*['\"]([^'\"]+)['\"]", source)
    if not match:
        raise SystemExit("Could not read Mode Atlas VERSION.")
    version = match.group(1)
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise SystemExit(f"iOS release requires semantic numeric VERSION, got {version!r}.")
    return version


def ios_build_number() -> int:
    """One committed upload sequence, shared by the app and widget extension."""
    values = re.findall(r"^MODE_ATLAS_BUILD_NUMBER = ([1-9][0-9]*);?$", BUILD_CONFIG.read_text(), re.M)
    if len(values) != 1 or int(values[0]) > 999999999:
        raise SystemExit("ios/release.xcconfig needs one positive MODE_ATLAS_BUILD_NUMBER below 1000000000.")
    return int(values[0])


def next_build() -> int:
    value = ios_build_number() + 1
    if value > 999999999:
        raise SystemExit("iOS upload build number is out of range.")
    source = BUILD_CONFIG.read_text()
    BUILD_CONFIG.write_text(re.sub(r"^MODE_ATLAS_BUILD_NUMBER = [0-9]+;?$", f"MODE_ATLAS_BUILD_NUMBER = {value}", source, flags=re.M))
    return value


def sync_privacy_resources(source: str) -> str:
    """Deterministic resources also update locally retained signing projects."""
    targets = (
        ("279000000000000000000001", "279000000000000000000002", "504EC3061FED79650016851F", "504EC3021FED79650016851F"),
        ("279000000000000000000003", "279000000000000000000004", "C7700313516F038757BAEF16", "3FE72E556019EC3F3A1FF736"),
    )
    for ref, build, group, phase in targets:
        if not re.search(rf"{ref}[^\n]*= ", source):
            source = source.replace("/* End PBXFileReference section */", f'\t\t{ref} /* PrivacyInfo.xcprivacy */ = {{isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; }};\n/* End PBXFileReference section */')
        if not re.search(rf"{build}[^\n]*= ", source):
            source = source.replace("/* End PBXBuildFile section */", f'\t\t{build} /* PrivacyInfo.xcprivacy in Resources */ = {{isa = PBXBuildFile; fileRef = {ref} /* PrivacyInfo.xcprivacy */; }};\n/* End PBXBuildFile section */')
        for owner, field, item in ((group, 'children', ref), (phase, 'files', build)):
            pattern = rf'(^[ \t]*{owner}(?: /\*[^\n]*?\*/)? = \{{[^{{}}]*?{field} = \()([^)]*)(\))'
            def include(match):
                entries = match.group(2)
                if item not in entries:
                    entries = entries.rstrip() + f'\n\t\t\t\t{item} /* PrivacyInfo.xcprivacy */,\n\t\t\t'
                return match.group(1) + entries + match.group(3)
            source, count = re.subn(pattern, include, source, count=1, flags=re.S | re.M)
            if count != 1:
                raise SystemExit(f"Could not locate iOS resource owner {owner}; project left unchanged.")
    return source


def sync_document_router_source(source: str) -> str:
    """Include the native route owner when retaining a locally signed project."""
    name = 'ModeAtlasRouter.swift'
    ref, build = '289100000000000000000001', '289100000000000000000002'
    if not re.search(rf'{ref}[^\n]*= ', source):
        source = source.replace('/* End PBXFileReference section */', f'\t\t{ref} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {name}; sourceTree = "<group>"; }};\n/* End PBXFileReference section */')
    if not re.search(rf'{build}[^\n]*= ', source):
        source = source.replace('/* End PBXBuildFile section */', f'\t\t{build} /* {name} in Sources */ = {{isa = PBXBuildFile; fileRef = {ref} /* {name} */; }};\n/* End PBXBuildFile section */')
    for owner, field, item in [('504EC3061FED79650016851F', 'children', ref), ('504EC3001FED79650016851F', 'files', build)]:
        pattern = rf'(^[ \t]*{owner}(?: /\*[^\n]*?\*/)? = \{{[^{{}}]*?{field} = \()([^)]*)(\))'
        def include(match):
            entries = match.group(2)
            if item not in entries:
                entries = entries.rstrip() + f'\n\t\t\t\t{item} /* {name} */,\n\t\t\t'
            return match.group(1) + entries + match.group(3)
        source, count = re.subn(pattern, include, source, count=1, flags=re.S | re.M)
        if count != 1:
            raise SystemExit(f'Could not locate iOS router source owner {owner}; project left unchanged.')
    return source


def sync() -> tuple[str, int, bool]:
    version = release_version()
    build = ios_build_number()
    validate_firebase(require=True)
    with FIREBASE_PLIST.open("rb") as handle:
        firebase = plistlib.load(handle)
    reversed_client_id = firebase["REVERSED_CLIENT_ID"]
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9.+-]*", reversed_client_id):
        raise SystemExit("Firebase REVERSED_CLIENT_ID is not a valid iOS URL scheme.")
    source = PBXPROJ.read_text(encoding="utf-8")
    updated = re.sub(r"MARKETING_VERSION = [^;]+;", f"MARKETING_VERSION = {version};", source)
    updated = re.sub(r"CURRENT_PROJECT_VERSION = [^;]+;", 'CURRENT_PROJECT_VERSION = "$(MODE_ATLAS_BUILD_NUMBER)";', updated)
    if "GOOGLE_REVERSED_CLIENT_ID = " in updated:
        updated = re.sub(r"GOOGLE_REVERSED_CLIENT_ID = [^;]+;", f"GOOGLE_REVERSED_CLIENT_ID = {reversed_client_id};", updated)
    else:
        updated = re.sub(
            r"(?m)^(\s*)CURRENT_PROJECT_VERSION = [^;]+;",
            lambda match: match.group(0) + "\n" + match.group(1) + f"GOOGLE_REVERSED_CLIENT_ID = {reversed_client_id};",
            updated,
        )

    # Names come from the shared reward catalogue; the native bridge reads the
    # compiled Info.plist instead of maintaining a second entitlement catalogue.
    icon_names = json.loads(subprocess.check_output([
        "node", "-p", "JSON.stringify(require('./assets/app/mode-atlas-reward-rules.js').icons.filter(item=>item.icon).map(item=>item.icon))"
    ], cwd=ROOT, text=True))
    if any(not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]*", name) for name in icon_names):
        raise SystemExit("Invalid alternate app icon name in reward catalogue.")
    for name in icon_names:
        if not (ROOT / f"ios/App/App/Assets.xcassets/{name}.appiconset/Contents.json").is_file():
            raise SystemExit(f"Missing bundled reward app icon: {name}")
    # Alternate icon catalogues are owned here so local signing-project backups
    # receive the same release configuration without losing personal team values.
    updated = re.sub(r'(?m)^[ \t]*ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = [^;]+;\n', '', updated)
    updated = re.sub(
        r'(?m)^([ \t]*)ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;',
        lambda match: match.group(0) + '\n' + match.group(1) + 'ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = "' + ' '.join(icon_names) + '";',
        updated,
    )

    if updated.count(f"MARKETING_VERSION = {version};") < 2:
        raise SystemExit("Could not synchronize all Xcode marketing-version build settings.")
    if updated.count('CURRENT_PROJECT_VERSION = "$(MODE_ATLAS_BUILD_NUMBER)";') != 4:
        raise SystemExit("Could not synchronize all Xcode build-number settings.")
    if updated.count(f"GOOGLE_REVERSED_CLIENT_ID = {reversed_client_id};") != 2:
        raise SystemExit("Could not synchronize the Firebase callback scheme in both Xcode configurations.")

    updated = sync_document_router_source(updated)
    updated = sync_privacy_resources(updated)
    updated = sync_auth_entitlements(updated)
    info_path = ROOT / 'ios/App/App/Info.plist'
    with info_path.open('rb') as handle:
        info = plistlib.load(handle)
    if info.get('FirebaseMessagingAutoInitEnabled') is not False:
        info['FirebaseMessagingAutoInitEnabled'] = False
        info_path.write_bytes(plistlib.dumps(info, sort_keys=False))
    try:
        sync_widget_configuration()
    except ValueError as error:
        raise SystemExit(str(error)) from error
    changed = updated != source
    if changed:
        PBXPROJ.write_text(updated, encoding="utf-8")
    return version, build, changed


def sync_auth_entitlements(source: str) -> str:
    """App-only Apple sign-in must survive local widget and signing selections."""
    counts = {'App': 0, 'ModeAtlasWidgets': 0}
    def update(match):
        block = match.group(0)
        owner = next((name for name in counts if f'INFOPLIST_FILE = {name}/Info.plist;' in block), None)
        if owner is None:
            return block
        setting = 'MODE_ATLAS_APP_ENTITLEMENTS' if owner == 'App' else 'MODE_ATLAS_WIDGET_ENTITLEMENTS'
        replacement = f'CODE_SIGN_ENTITLEMENTS = "$({setting})";'
        if 'CODE_SIGN_ENTITLEMENTS = ' not in block:
            block = block.replace(f'INFOPLIST_FILE = {owner}/Info.plist;', replacement + f'\n\t\t\t\tINFOPLIST_FILE = {owner}/Info.plist;')
        else:
            block = re.sub(r'CODE_SIGN_ENTITLEMENTS = [^;]+;', replacement, block)
        if owner == 'App':
            environment = 'development' if re.search(r'SWIFT_ACTIVE_COMPILATION_CONDITIONS = [^;]*DEBUG', block) else 'production'
            block = re.sub(r'(?m)^[ \t]*MODE_ATLAS_PUSH_ENVIRONMENT = [^;]+;\n', '', block)
            block = block.replace('INFOPLIST_FILE = App/Info.plist;', f'INFOPLIST_FILE = App/Info.plist;\n\t\t\t\tMODE_ATLAS_PUSH_ENVIRONMENT = {environment};')
        counts[owner] += 1
        return block
    updated = re.sub(r'buildSettings = \{[^{}]*\};', update, source)
    if counts != {'App': 2, 'ModeAtlasWidgets': 2}:
        raise SystemExit('Could not identify the app and widget signing configurations; project left unchanged.')
    return updated


def normalize_spm_link() -> None:
    """Capacitor writes an absolute checkout path; commit a portable SPM link."""
    for name, package in SPM_LINKS.items():
        link = ROOT / 'ios/App/CapApp-SPM/symlinks' / name
        if not link.is_symlink():
            continue
        dependency = ROOT / 'node_modules/@capacitor-firebase' / package
        relative = os.path.relpath(dependency, link.parent)
        if os.readlink(link) != relative:
            link.unlink()
            link.symlink_to(relative)


if __name__ == "__main__":
    import sys
    if sys.argv[1:] == ["--normalize-spm-links"]:
        normalize_spm_link()
        raise SystemExit(0)
    if sys.argv[1:] == ["--next-build"]:
        next_build()
    elif sys.argv[1:]:
        raise SystemExit("Usage: sync_ios_project.py [--next-build | --normalize-spm-links]")
    version, build, changed = sync()
    status = "updated" if changed else "already synchronized"
    print(f"Mode Atlas iOS version {status}: {version} ({build})")
