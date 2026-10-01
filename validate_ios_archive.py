"""Check actual Release products; signing/upload remain Apple account operations."""
from pathlib import Path
import json
import plistlib
import sys
import wave
from sync_ios_project import release_version, ios_build_number


def validate(app: Path) -> None:
    version = release_version()
    for bundle, identifier in ((app, "app.modeatlas"), (app / "PlugIns/ModeAtlasWidgets.appex", "app.modeatlas.widgets")):
        info = plistlib.loads((bundle / "Info.plist").read_bytes())
        assert info["CFBundleIdentifier"] == identifier
        assert info["CFBundleShortVersionString"] == version
        assert str(info["CFBundleVersion"]) == str(ios_build_number())
        assert info["MinimumOSVersion"] == "18.0"
        privacy = plistlib.loads((bundle / "PrivacyInfo.xcprivacy").read_bytes())
        assert privacy["NSPrivacyTracking"] is False
        assert (bundle / "Metadata.appintents").is_dir()
    privacy = plistlib.loads((app / "PrivacyInfo.xcprivacy").read_bytes())
    assert any(entry["NSPrivacyAccessedAPIType"] == "NSPrivacyAccessedAPICategoryUserDefaults" and "CA92.1" in entry["NSPrivacyAccessedAPITypeReasons"] for entry in privacy["NSPrivacyAccessedAPITypes"])
    public = app / "public"
    manifest = json.loads((public / "mode-atlas-native-manifest.json").read_text())
    assert manifest["version"] == version
    for name in ("app", "auth", "firestore", "functions"):
        assert (public / f"assets/vendor/firebase-{name}.assets-{version}.js").is_file()
    for name in ("tap", "correct", "wrong", "finish", "achievement", "success", "warning", "error"):
        with wave.open(str(public / f"assets/audio/{name}.wav")) as sound:
            frames = sound.readframes(sound.getnframes())
            assert sound.getnchannels() == 1 and sound.getframerate() == 44100
            assert frames[:2] == b"\x00\x00" and frames[-2:] == b"\x00\x00"
    assert not (public / "sw.js").exists()
    print(f"Release archive resources, privacy manifests, metadata and audio PASS: {version}")


if __name__ == "__main__":
    validate(Path(sys.argv[1]))
