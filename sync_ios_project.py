"""Synchronize iOS project release metadata from Mode Atlas' canonical version owner.

The web release metadata remains the single source of truth. Xcode's generated
build settings are derived output and are verified by the release gate.
"""
from __future__ import annotations

from pathlib import Path
import os
import plistlib
import re

from validate_ios_firebase_config import PLIST as FIREBASE_PLIST, validate as validate_firebase

ROOT = Path(__file__).resolve().parent
VERSION_SOURCE = ROOT / "assets/app/mode-atlas-version.js"
PBXPROJ = ROOT / "ios/App/App.xcodeproj/project.pbxproj"
SPM_SYMLINK = ROOT / "ios/App/CapApp-SPM/symlinks/CapacitorFirebaseAuthentication"


def release_version() -> str:
    source = VERSION_SOURCE.read_text(encoding="utf-8")
    match = re.search(r"var\s+VERSION\s*=\s*['\"]([^'\"]+)['\"]", source)
    if not match:
        raise SystemExit("Could not read Mode Atlas VERSION.")
    version = match.group(1)
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise SystemExit(f"iOS release requires semantic numeric VERSION, got {version!r}.")
    return version


def ios_build_number(version: str) -> int:
    major, minor, patch = (int(part) for part in version.split("."))
    if minor >= 1000 or patch >= 1000:
        raise SystemExit("iOS deterministic build-number encoding supports minor/patch values below 1000.")
    return major * 1_000_000 + minor * 1_000 + patch


def sync() -> tuple[str, int, bool]:
    version = release_version()
    build = ios_build_number(version)
    validate_firebase(require=True)
    with FIREBASE_PLIST.open("rb") as handle:
        firebase = plistlib.load(handle)
    reversed_client_id = firebase["REVERSED_CLIENT_ID"]
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9.+-]*", reversed_client_id):
        raise SystemExit("Firebase REVERSED_CLIENT_ID is not a valid iOS URL scheme.")
    source = PBXPROJ.read_text(encoding="utf-8")
    updated = re.sub(r"MARKETING_VERSION = [^;]+;", f"MARKETING_VERSION = {version};", source)
    updated = re.sub(r"CURRENT_PROJECT_VERSION = [^;]+;", f"CURRENT_PROJECT_VERSION = {build};", updated)
    if "GOOGLE_REVERSED_CLIENT_ID = " in updated:
        updated = re.sub(r"GOOGLE_REVERSED_CLIENT_ID = [^;]+;", f"GOOGLE_REVERSED_CLIENT_ID = {reversed_client_id};", updated)
    else:
        updated = re.sub(
            r"(?m)^(\s*)CURRENT_PROJECT_VERSION = [^;]+;",
            lambda match: match.group(0) + "\n" + match.group(1) + f"GOOGLE_REVERSED_CLIENT_ID = {reversed_client_id};",
            updated,
        )

    if updated.count(f"MARKETING_VERSION = {version};") < 2:
        raise SystemExit("Could not synchronize all Xcode marketing-version build settings.")
    if updated.count(f"CURRENT_PROJECT_VERSION = {build};") < 2:
        raise SystemExit("Could not synchronize all Xcode build-number settings.")
    if updated.count(f"GOOGLE_REVERSED_CLIENT_ID = {reversed_client_id};") != 2:
        raise SystemExit("Could not synchronize the Firebase callback scheme in both Xcode configurations.")

    changed = updated != source
    if changed:
        PBXPROJ.write_text(updated, encoding="utf-8")
    return version, build, changed


def normalize_spm_link() -> None:
    """Capacitor writes an absolute checkout path; commit a portable SPM link."""
    if not SPM_SYMLINK.is_symlink():
        return
    dependency = ROOT / "node_modules/@capacitor-firebase/authentication"
    relative = os.path.relpath(dependency, SPM_SYMLINK.parent)
    if os.readlink(SPM_SYMLINK) != relative:
        SPM_SYMLINK.unlink()
        SPM_SYMLINK.symlink_to(relative)


if __name__ == "__main__":
    import sys
    if sys.argv[1:] == ["--normalize-spm-links"]:
        normalize_spm_link()
        raise SystemExit(0)
    version, build, changed = sync()
    status = "updated" if changed else "already synchronized"
    print(f"Mode Atlas iOS version {status}: {version} ({build})")
