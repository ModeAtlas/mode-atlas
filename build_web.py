"""Package the public website for GitHub Pages without traversing native source.

Release assets are already generated and committed. Copy them unchanged so the
website serves the same release as the shared source used by the iOS builder.
"""
from argparse import ArgumentParser
from pathlib import Path
import shutil


ROOT = Path(__file__).resolve().parent
PUBLIC_DIRS = ("assets", "kana", "reading", "writing", "results", "wordbank", "privacy", "terms")
PUBLIC_FILES = (
    "index.html", "default.html", "reverse.html", "kana.html", "test.html", "wordbank.html",
    "cloud-sync.js", "firebase-config.js", "sw.js", "site.webmanifest",
    "robots.txt", "sitemap.xml", "CNAME",
)


def public_files(root: Path) -> list[Path]:
    files = {root / name for name in PUBLIC_FILES}
    for pattern in ("cloud-sync.assets-*.js", "firebase-config.assets-*.js", "google*.html"):
        files.update(root.glob(pattern))
    for name in PUBLIC_DIRS:
        directory = root / name
        if directory.is_symlink() or not directory.is_dir():
            raise ValueError(f"Public directory must be a real directory: {name}")
        for path in directory.rglob("*"):
            if any(part.startswith(".") for part in path.relative_to(root).parts):
                continue
            if path.is_symlink():
                raise ValueError(f"Symbolic links cannot be published: {path.relative_to(root)}")
            if path.is_file():
                files.add(path)
    for path in files:
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"Public file must be a regular file: {path.relative_to(root)}")
    return sorted(files)


def build(output: Path, root: Path = ROOT) -> int:
    root = root.resolve()
    output = output.resolve()
    files = public_files(root)
    # Require a fresh destination; never clear a user's existing directory.
    output.mkdir(parents=True, exist_ok=False)
    for source in files:
        destination = output / source.relative_to(root)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
    return len(files)


def main() -> None:
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path, help="New directory for the public website")
    args = parser.parse_args()
    count = build(args.output)
    print(f"Packaged {count} public website files in {args.output}")


if __name__ == "__main__":
    main()
