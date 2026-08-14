"""Retired Mode Atlas URL-layout migration.

This script performed the one-time flat-file -> folder URL migration used by
older Mode Atlas builds. The repository now already uses /kana/, /reading/,
/writing/, /results/, and /wordbank/ source documents. Re-running the old
migration against the current layout could overwrite those real pages with the
legacy redirect files, so the migration is intentionally disabled.

Use build_revision_assets.py for normal release builds.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
EXPECTED_LAYOUT = [
    ROOT / "index.html",
    ROOT / "kana" / "index.html",
    ROOT / "reading" / "index.html",
    ROOT / "writing" / "index.html",
    ROOT / "results" / "index.html",
    ROOT / "wordbank" / "index.html",
]


def main() -> int:
    missing = [path.relative_to(ROOT).as_posix() for path in EXPECTED_LAYOUT if not path.exists()]
    if missing:
        print("Mode Atlas clean URL migration is retired, and the expected current layout is incomplete:")
        for path in missing:
            print(f"  - {path}")
        print("Restore the current project layout instead of running the legacy migration.")
        return 2

    print("clean_urls.py is retired and made no changes.")
    print("The project already uses the current clean-URL folder layout.")
    print("For release assets, run: python3 build_revision_assets.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
