"""Package canonical browser policy modules for Firebase; never edit copies."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
SOURCES = (
    "assets/app/mode-atlas-social-config.js",
    "assets/app/mode-atlas-social-identity.js",
    "assets/app/mode-atlas-date.js",
    "assets/app/mode-atlas-progress.js",
    "assets/app/mode-atlas-review.js",
    "assets/app/mode-atlas-reward-rules.js",
    "assets/data/mode-atlas-kana-data.js",
)


def build():
    destination = ROOT / "backend/functions/shared"
    destination.mkdir(parents=True, exist_ok=True)
    for source in SOURCES:
        shutil.copyfile(ROOT / source, destination / Path(source).name)
    print("Packaged canonical progression, recall and reward policy for the social backend.")


if __name__ == "__main__":
    build()
