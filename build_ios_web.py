"""Build the deterministic web payload consumed by the Mode Atlas iOS shell.

The website remains canonical. This builder copies the already-revisioned public
runtime into a native bundle without Service Worker/PWA transport files or
canonical source duplicates.
"""
from __future__ import annotations

from argparse import ArgumentParser
from pathlib import Path
import json
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
VERSION_FILE = ROOT / "assets/app/mode-atlas-version.js"
PAGE_DIRS = ("kana", "reading", "writing", "results", "wordbank", "privacy", "terms")
ROOT_RUNTIME_FILES = ("index.html",)
ASSET_DIR = "assets"


def release_metadata() -> tuple[str, str, str]:
    source = VERSION_FILE.read_text(encoding="utf-8")
    version = re.search(r"var\s+VERSION\s*=\s*['\"]([^'\"]+)['\"]", source)
    revision = re.search(r"var\s+CACHE_REVISION\s*=\s*['\"]([^'\"]+)['\"]", source)
    build_date = re.search(r"var\s+BUILD_DATE\s*=\s*['\"]([^'\"]+)['\"]", source)
    if not version or not revision or not build_date:
        raise SystemExit("Could not parse Mode Atlas release metadata.")
    return version.group(1), revision.group(1), build_date.group(1)


def source_commit() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        return ""


def is_revisioned_runtime_asset(path: Path, revision: str) -> bool:
    if path.suffix.lower() not in {".js", ".css"}:
        return True
    return f".{revision}." in path.name


def copy_tree_runtime(source: Path, destination: Path, revision: str) -> None:
    for path in sorted(source.rglob("*")):
        if not path.is_file() or path.name == ".DS_Store":
            continue
        if not is_revisioned_runtime_asset(path, revision):
            continue
        rel = path.relative_to(source)
        target = destination / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)


def build(output: Path) -> dict[str, str]:
    version, revision, build_date = release_metadata()
    if revision != f"assets-{version}":
        raise SystemExit(f"Revision {revision!r} does not match version {version!r}.")

    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    for rel in ROOT_RUNTIME_FILES:
        shutil.copy2(ROOT / rel, output / rel)

    for rel in PAGE_DIRS:
        copy_tree_runtime(ROOT / rel, output / rel, revision)

    copy_tree_runtime(ROOT / ASSET_DIR, output / ASSET_DIR, revision)

    for stem in ("firebase-config", "cloud-sync"):
        src = ROOT / f"{stem}.{revision}.js"
        if not src.exists():
            raise SystemExit(f"Missing revisioned native runtime dependency: {src.name}")
        shutil.copy2(src, output / src.name)

    manifest = {
        "version": version,
        "revision": revision,
        "buildDate": build_date,
        "sourceCommit": source_commit(),
        "runtime": "ios-bundled-web",
    }
    (output / "mode-atlas-native-manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    forbidden = ("sw.js", "site.webmanifest")
    for name in forbidden:
        if (output / name).exists():
            raise SystemExit(f"Forbidden web-only runtime file copied into iOS bundle: {name}")

    canonical_code = [
        p for p in output.rglob("*")
        if p.is_file() and p.suffix.lower() in {".js", ".css"} and f".{revision}." not in p.name
    ]
    if canonical_code:
        raise SystemExit("Canonical JS/CSS leaked into iOS bundle: " + ", ".join(str(p.relative_to(output)) for p in canonical_code[:8]))

    return manifest


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--output", default=str(ROOT / ".build/ios-web"))
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    if args.check:
        with tempfile.TemporaryDirectory(prefix="mode-atlas-ios-web-") as temp:
            manifest = build(Path(temp))
            print(f"Mode Atlas iOS web bundle PASS: {manifest['version']} ({manifest['revision']})")
        return 0

    output = Path(args.output).resolve()
    manifest = build(output)
    print(f"Built iOS web bundle: {output} — {manifest['version']} ({manifest['revision']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
