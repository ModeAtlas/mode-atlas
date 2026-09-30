"""Exercise the public artifact boundary, including the failed iOS symlink case."""
from html.parser import HTMLParser
from pathlib import Path
import sys
import tempfile
import unittest
from urllib.parse import unquote, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_web import ROOT, PUBLIC_DIRS, PUBLIC_FILES, build


class ResourceParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "img") and attrs.get("src"):
            self.urls.append(attrs["src"])
        if tag == "link" and attrs.get("href") and set(attrs.get("rel", "").split()) & {
            "stylesheet", "icon", "apple-touch-icon", "manifest", "preload", "modulepreload"
        }:
            self.urls.append(attrs["href"])


class WebsitePublishTests(unittest.TestCase):
    def test_release_artifact_preserves_runtime_and_has_all_page_resources(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "site"
            count = build(output)
            files = [path for path in output.rglob("*") if path.is_file()]
            self.assertEqual(len(files), count)
            for path in files:
                relative = path.relative_to(output)
                self.assertFalse(path.is_symlink(), str(relative))
                self.assertEqual(path.read_bytes(), (ROOT / relative).read_bytes(), str(relative))
            for name in ("ios", "backend", "tests", "docs", "node_modules", "package.json", "reading 2"):
                self.assertFalse((output / name).exists(), name)
            for page in output.rglob("*.html"):
                parser = ResourceParser()
                parser.feed(page.read_text(encoding="utf-8"))
                for url in parser.urls:
                    parts = urlsplit(url)
                    if parts.scheme or parts.netloc or not parts.path:
                        continue
                    path = unquote(parts.path)
                    target = output / path.lstrip("/") if path.startswith("/") else page.parent / path
                    self.assertTrue(target.is_file(), f"{page.relative_to(output)}: missing {url}")

    def test_native_broken_symlink_is_ignored_but_public_symlink_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "source"
            root.mkdir()
            for name in PUBLIC_FILES:
                (root / name).write_text("fixture", encoding="utf-8")
            for name in PUBLIC_DIRS:
                (root / name).mkdir()
            native_link = root / "ios/App/CapApp-SPM/symlinks/CapacitorFirebaseAuthentication"
            native_link.parent.mkdir(parents=True)
            native_link.symlink_to("../../../../../node_modules/@capacitor-firebase/authentication")
            build(Path(temporary) / "site", root)
            self.assertTrue(native_link.is_symlink())
            (root / "assets/broken").symlink_to("missing")
            with self.assertRaisesRegex(ValueError, "Symbolic links cannot be published"):
                build(Path(temporary) / "rejected", root)
            self.assertFalse((Path(temporary) / "rejected").exists())

    def test_existing_output_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            marker = output / "keep.txt"
            marker.write_text("keep", encoding="utf-8")
            with self.assertRaises(FileExistsError):
                build(output)
            self.assertEqual(marker.read_text(encoding="utf-8"), "keep")


if __name__ == "__main__":
    unittest.main()
