"""Validate Mode Atlas' Firebase Apple configuration when it is provisioned.

The iOS app can compile before Firebase Console registration, but native Google
sign-in cannot function until ios/App/App/GoogleService-Info.plist belongs to
bundle id app.modeatlas. Use --require for release environments that must have
working native authentication.
"""
from __future__ import annotations

from argparse import ArgumentParser
from pathlib import Path
import plistlib

ROOT = Path(__file__).resolve().parent
PLIST = ROOT / "ios/App/App/GoogleService-Info.plist"
EXPECTED_BUNDLE_ID = "app.modeatlas"
EXPECTED_PROJECT_ID = "mode-atlus"


def validate(require: bool = False) -> bool:
    if not PLIST.exists():
        if require:
            raise SystemExit(
                "Missing ios/App/App/GoogleService-Info.plist. Register app.modeatlas "
                "in the existing Mode Atlas Firebase project before requiring native auth."
            )
        print("Mode Atlas iOS Firebase config: pending (native shell remains buildable)")
        return False

    with PLIST.open("rb") as handle:
        data = plistlib.load(handle)

    checks = {
        "BUNDLE_ID": EXPECTED_BUNDLE_ID,
        "PROJECT_ID": EXPECTED_PROJECT_ID,
    }
    for key, expected in checks.items():
        actual = str(data.get(key) or "")
        if actual != expected:
            raise SystemExit(f"{key} {actual!r} does not match expected {expected!r}.")

    for key in ("GOOGLE_APP_ID", "CLIENT_ID", "REVERSED_CLIENT_ID", "API_KEY"):
        if not str(data.get(key) or "").strip():
            raise SystemExit(f"GoogleService-Info.plist is missing required {key}.")

    print(
        "Mode Atlas iOS Firebase config PASS: "
        f"{data['BUNDLE_ID']} / {data['PROJECT_ID']}"
    )
    return True


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--require", action="store_true")
    args = parser.parse_args()
    validate(require=args.require)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
