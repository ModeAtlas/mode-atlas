"""Shared allowlist for files inside the web and iOS runtime directories."""
from pathlib import Path
import re

MEDIA_SUFFIXES = frozenset({'.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.gif', '.woff2'})
LICENSE_FILES = frozenset({
    'assets/fonts/inter-LICENSE.txt', 'assets/fonts/sora-LICENSE.txt',
    'assets/fonts/noto-sans-jp-LICENSE.txt', 'assets/icons/apple-sign-in-license.rtf',
})
# The update checker fetches this stable endpoint before it knows the new revision.
RUNTIME_METADATA_FILES = frozenset({'assets/app/mode-atlas-version.js'})


def is_public_runtime_file(relative: Path) -> bool:
    """Ship executable release assets, pages, media and required attributions only.

    Source maps, notes, logs, arbitrary JSON and credentials placed in a runtime
    directory are not publication inputs. This is packaging, not authorization.
    """
    if any(part.startswith('.') for part in relative.parts):
        return False
    if relative.as_posix() in LICENSE_FILES | RUNTIME_METADATA_FILES:
        return True
    if relative.parts[0] != 'assets':
        return relative.suffix == '.html'
    if relative.suffix in MEDIA_SUFFIXES:
        return True
    return bool(re.search(r'\.assets-\d+\.\d+\.\d+\.(js|css)$', relative.name))
