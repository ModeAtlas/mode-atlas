"""Static release audit for Mode Atlas.

This intentionally checks ownership boundaries that have caused regressions in
past builds: revisioned assets, update/SW separation, clean navigation URLs,
cloud-sync ownership, and generated-source consistency.
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import urljoin, urlsplit
import re
import sys
import json

ROOT = Path(__file__).resolve().parent
VERSION_FILE = ROOT / "assets/app/mode-atlas-version.js"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def resolve_local_asset(html_path: Path, raw: str) -> Path | None:
    if raw.startswith(("http://", "https://", "//", "data:", "#")):
        return None
    return (html_path.parent / raw.split("?", 1)[0]).resolve()


def css_brace_error(source: str) -> str | None:
    """Return a structural brace error while ignoring comments/quoted strings."""
    stack: list[int] = []
    i = 0
    line = 1
    quote: str | None = None
    in_comment = False
    while i < len(source):
        char = source[i]
        nxt = source[i + 1] if i + 1 < len(source) else ""
        if char == "\n":
            line += 1
        if in_comment:
            if char == "*" and nxt == "/":
                in_comment = False
                i += 2
                continue
            i += 1
            continue
        if quote is not None:
            if char == "\\":
                i += 2
                continue
            if char == quote:
                quote = None
            i += 1
            continue
        if char == "/" and nxt == "*":
            in_comment = True
            i += 2
            continue
        if char in {"'", '"'}:
            quote = char
            i += 1
            continue
        if char == "{":
            stack.append(line)
        elif char == "}":
            if not stack:
                return f"extra closing brace on line {line}"
            stack.pop()
        i += 1
    if in_comment:
        return "unterminated comment"
    if quote is not None:
        return "unterminated quoted string"
    if stack:
        return f"unclosed opening brace from line {stack[-1]}"
    return None


def main() -> int:
    errors: list[str] = []
    if not VERSION_FILE.exists():
        print("FAIL: missing assets/app/mode-atlas-version.js")
        return 1

    version_source = text(VERSION_FILE)
    version_match = re.search(r"var\s+VERSION\s*=\s*['\"]([^'\"]+)['\"]", version_source)
    revision_match = re.search(r"var\s+CACHE_REVISION\s*=\s*['\"]([^'\"]+)['\"]", version_source)
    if not version_match or not revision_match:
        print("FAIL: could not parse VERSION/CACHE_REVISION")
        return 1
    version = version_match.group(1)
    revision = revision_match.group(1)
    expected_revision = f"assets-{version}"
    if revision != expected_revision:
        fail(errors, f"CACHE_REVISION {revision!r} does not match VERSION {version!r}")

    release_number_fields = {
        'SAVE_SCHEMA_VERSION': 'ModeAtlasSaveSchemaVersion',
        'BACKUP_FORMAT_VERSION': 'ModeAtlasBackupFormatVersion',
        'CLOUD_SNAPSHOT_VERSION': 'ModeAtlasCloudSnapshotVersion',
    }
    release_values = {}
    for source_name, global_name in release_number_fields.items():
        match = re.search(rf"var\s+{source_name}\s*=\s*(\d+)", version_source)
        if not match:
            fail(errors, f"release metadata missing {source_name}")
            continue
        release_values[source_name] = int(match.group(1))
        if global_name not in version_source:
            fail(errors, f"release metadata does not expose {global_name}")
    build_date_match = re.search(r'''var\s+BUILD_DATE\s*=\s*['"]([^'"]*)['"]''', version_source)
    if not build_date_match or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", build_date_match.group(1)):
        fail(errors, "release metadata BUILD_DATE is missing or invalid")

    for metadata_name in ("package.json", "package-lock.json"):
        metadata_path = ROOT / metadata_name
        if not metadata_path.exists():
            fail(errors, f"missing release metadata: {metadata_name}")
            continue
        try:
            metadata = json.loads(text(metadata_path))
            if str(metadata.get("version", "")) != version:
                fail(errors, f"{metadata_name} version {metadata.get('version')!r} does not match app VERSION {version!r}")
            if metadata_name == "package-lock.json":
                root_pkg = ((metadata.get("packages") or {}).get("") or {})
                if str(root_pkg.get("version", "")) != version:
                    fail(errors, f"package-lock root package version {root_pkg.get('version')!r} does not match app VERSION {version!r}")
        except Exception as exc:
            fail(errors, f"could not parse {metadata_name}: {exc}")

    legacy_changelog_workflow = ROOT / '.github/workflows/update-changelog.yml'
    if legacy_changelog_workflow.exists():
        fail(errors, 'legacy GitHub release workflow still has a second owner for CHANGELOG.md')

    readme_path = ROOT / 'README.md'
    if readme_path.exists():
        readme_version = re.search(r'(?m)^Version:\s*(\S+)', text(readme_path))
        if not readme_version or readme_version.group(1) != version:
            fail(errors, f"README version does not match app VERSION {version!r}")

    # Canonical stylesheets must be structurally balanced. Browsers can recover
    # from an unclosed block in ways that silently change later selector scope, so
    # make this a release failure instead of relying on parser recovery.
    for css_path in sorted((ROOT / "assets/css").glob("*.css")):
        if re.search(r"\.assets-\d+\.\d+\.\d+\.css$", css_path.name, re.I):
            continue
        brace_error = css_brace_error(text(css_path))
        if brace_error:
            fail(errors, f"malformed canonical CSS {css_path.relative_to(ROOT)}: {brace_error}")

    fingerprint_re = re.compile(r"\.(assets-\d+\.\d+\.\d+)\.(js|css)$", re.I)
    asset_attr_re = re.compile(r'''(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']''', re.I)
    href_re = re.compile(r'''<a\b[^>]*\bhref=["']([^"']+)["']''', re.I)
    transport = {"build", "v", "reload", "swretired"}

    referenced_generated: set[Path] = set()
    AUDIT_IGNORED_DIRS = {'node_modules', '.git', 'playwright-report', 'test-results'}
    html_files = sorted(
        path for path in ROOT.rglob("*.html")
        if not any(part in AUDIT_IGNORED_DIRS for part in path.relative_to(ROOT).parts[:-1])
    )
    for html_path in html_files:
        if "harness" in html_path.name.lower():
            fail(errors, f"development harness must not ship as a public HTML page: {html_path.relative_to(ROOT)}")
    for html_path in html_files:
        html = text(html_path)
        for raw in asset_attr_re.findall(html):
            local = resolve_local_asset(html_path, raw)
            if local is None:
                continue
            try:
                local.relative_to(ROOT)
            except ValueError:
                fail(errors, f"asset escapes project root: {html_path.relative_to(ROOT)} -> {raw}")
                continue
            if not local.exists():
                fail(errors, f"missing local asset: {html_path.relative_to(ROOT)} -> {raw}")
                continue
            match = fingerprint_re.search(local.name)
            if not match or match.group(1) != revision:
                fail(errors, f"HTML asset is not fingerprinted with {revision}: {html_path.relative_to(ROOT)} -> {raw}")
            referenced_generated.add(local)

        for raw in href_re.findall(html):
            if raw.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
                continue
            try:
                absolute = urlsplit(urljoin("https://mode-atlas.app/", raw))
            except Exception:
                continue
            if absolute.netloc not in {"mode-atlas.app", "www.mode-atlas.app"}:
                continue
            query_keys = {part.split("=", 1)[0] for part in absolute.query.split("&") if part}
            bad = sorted(query_keys & transport)
            if bad:
                fail(errors, f"normal HTML navigation contains transport params {bad}: {html_path.relative_to(ROOT)} -> {raw}")

    # The profile/settings drawer is a shared module instantiated once per HTML document.
    # Every app page must load the same active-revision markup/binding owners, and no page
    # may carry its own inline Settings/update implementation.
    main_pages = [
        ROOT / 'index.html', ROOT / 'kana/index.html', ROOT / 'reading/index.html',
        ROOT / 'writing/index.html', ROOT / 'results/index.html', ROOT / 'wordbank/index.html',
    ]
    shared_drawer_assets = [
        f'mode-atlas-profile-menu.{revision}.js',
        f'mode-atlas-settings-menu.{revision}.js',
        f'mode-atlas-profile-drawer-bindings.{revision}.js',
    ]
    for page_path in main_pages:
        page_html = text(page_path)
        storage_pos = page_html.find(f'mode-atlas-storage.{revision}.js')
        import_pos = page_html.find(f'mode-atlas-import-export.{revision}.js')
        cloud_pos = page_html.find(f'cloud-sync.{revision}.js')
        if storage_pos < 0:
            fail(errors, f'shared storage boundary missing from {page_path.relative_to(ROOT)}')
        if import_pos >= 0 and storage_pos > import_pos:
            fail(errors, f'storage boundary loads after import/export on {page_path.relative_to(ROOT)}')
        if cloud_pos >= 0 and storage_pos > cloud_pos:
            fail(errors, f'storage boundary loads after cloud-sync on {page_path.relative_to(ROOT)}')
        for asset_name in shared_drawer_assets:
            if asset_name not in page_html:
                fail(errors, f'shared drawer asset missing from {page_path.relative_to(ROOT)}: {asset_name}')
        if 'id="maUpdateStatus"' in page_html or 'data-ma-check-updates' in page_html:
            fail(errors, f'page contains its own inline Settings/update UI: {page_path.relative_to(ROOT)}')

    # Shared frontend shell ownership. Navigation is rendered from one build-time
    # component source and styled by one navigation stylesheet. Profile/Settings
    # controls must be present in the shared nav rather than injected per page.
    frontend_pages = main_pages + [ROOT / 'privacy/index.html', ROOT / 'terms/index.html']
    for required in (ROOT / 'frontend_components.py', ROOT / 'assets/css/mode-atlas-components.css', ROOT / 'assets/css/mode-atlas-navigation.css'):
        if not required.exists():
            fail(errors, f'missing shared frontend foundation file: {required.relative_to(ROOT)}')
    for page_path in frontend_pages:
        page_html = text(page_path)
        if page_html.count('data-ma-navigation="shared"') != 1:
            fail(errors, f'page does not contain exactly one shared navigation instance: {page_path.relative_to(ROOT)}')
        if page_html.count('MODE_ATLAS_NAV_START') != 1 or page_html.count('MODE_ATLAS_NAV_END') != 1:
            fail(errors, f'page is missing shared navigation build markers: {page_path.relative_to(ROOT)}')
        for css_name in (f'mode-atlas-components.{revision}.css', f'mode-atlas-navigation.{revision}.css'):
            if css_name not in page_html:
                fail(errors, f'page is missing shared frontend stylesheet {css_name}: {page_path.relative_to(ROOT)}')
        if re.search(r'class=["\'][^"\']*(?:topbar|branch-nav|study-nav|nav-link|branch-link|study-link|profile-trigger|profile-dot|ma-settings-trigger)', page_html):
            fail(errors, f'page still contains a legacy navigation class: {page_path.relative_to(ROOT)}')

    # Production-only diagnostics are lazy: normal learners load only the small
    # eligibility owner, while the revision builder still fingerprints the full
    # console JS/CSS for localhost/developer use.
    frontend_source = text(ROOT / 'frontend_components.py')
    revision_builder = text(ROOT / 'build_revision_assets.py')
    dev_loader = text(ROOT / 'assets/app/mode-atlas-dev-console-loader.js')
    if "'assets/app/mode-atlas-dev-console-loader.js'" not in frontend_source:
        fail(errors, 'production frontend manifest is missing the developer-console eligibility loader')
    if "'assets/app/mode-atlas-dev-console.js'" in frontend_source or "'assets/css/mode-atlas-dev-console.css'" in frontend_source:
        fail(errors, 'full developer-console assets are still loaded eagerly by the production manifest')
    for lazy_asset in ('assets/app/mode-atlas-dev-console.js', 'assets/css/mode-atlas-dev-console.css'):
        if lazy_asset not in revision_builder:
            fail(errors, f'revision builder does not own lazy developer asset: {lazy_asset}')
    for marker in ('document.currentScript', 'kanaCloudSyncStatusChanged', 'loadIfEligible', 'admin@mode-atlas.com'):
        if marker not in dev_loader:
            fail(errors, f'developer-console loader missing eligibility/revision marker: {marker}')

    # Public page dependency stacks and the early loader are build-time owned.
    asset_regions = (
        ('MODE_ATLAS_HEAD_ASSETS_START', 'MODE_ATLAS_HEAD_ASSETS_END'),
        ('MODE_ATLAS_STYLE_ASSETS_START', 'MODE_ATLAS_STYLE_ASSETS_END'),
        ('MODE_ATLAS_EARLY_ASSETS_START', 'MODE_ATLAS_EARLY_ASSETS_END'),
        ('MODE_ATLAS_BODY_ASSETS_START', 'MODE_ATLAS_BODY_ASSETS_END'),
        ('MODE_ATLAS_LOADER_START', 'MODE_ATLAS_LOADER_END'),
    )
    dependency_region_re = re.compile(
        r'<!-- MODE_ATLAS_(?:HEAD|STYLE|EARLY|BODY)_ASSETS_START -->.*?<!-- MODE_ATLAS_(?:HEAD|STYLE|EARLY|BODY)_ASSETS_END -->',
        re.S,
    )
    for page_path in frontend_pages:
        page_html = text(page_path)
        for start_marker, end_marker in asset_regions:
            if page_html.count(start_marker) != 1 or page_html.count(end_marker) != 1:
                fail(errors, f'page is missing exactly one build-owned {start_marker} region: {page_path.relative_to(ROOT)}')
        if page_html.count('id="maLoadingScreen"') != 1:
            fail(errors, f'page does not contain exactly one build-owned early loader: {page_path.relative_to(ROOT)}')
        critical_positions = [page_html.find(name) for name in (
            'mode-atlas-version.', 'mode-atlas-legacy-sw-retirement.', 'mode-atlas-version-check.', 'mode-atlas-head-bootstrap.'
        )]
        if any(pos < 0 for pos in critical_positions) or critical_positions != sorted(critical_positions):
            fail(errors, f'critical head-script dependency order drifted: {page_path.relative_to(ROOT)}')
        if page_html.find('mode-atlas-early-loader.') < 0 or page_html.find('mode-atlas-early-loader.') > page_html.find('id="maLoadingScreen"'):
            fail(errors, f'early-loader script no longer precedes static loader markup: {page_path.relative_to(ROOT)}')
        unmanaged = dependency_region_re.sub('', page_html)
        if re.search(r'<script\b[^>]*\bsrc=["\'][^"\']+\.assets-[^"\']+\.js["\']', unmanaged, re.I):
            fail(errors, f'page contains a local JS dependency outside the build manifest: {page_path.relative_to(ROOT)}')
        if re.search(r'<link\b[^>]*\brel=["\']stylesheet["\'][^>]*\.assets-[^"\']+\.css["\']', unmanaged, re.I):
            fail(errors, f'page contains a local CSS dependency outside the build manifest: {page_path.relative_to(ROOT)}')

    wordbank_html = text(ROOT / 'wordbank/index.html')
    storage_pos = wordbank_html.find('mode-atlas-storage.assets-')
    wordbank_controller_pos = wordbank_html.find('mode-atlas-wordbank-page.assets-', storage_pos)
    save_repair_pos = wordbank_html.find('mode-atlas-save-repair.assets-', wordbank_controller_pos)
    cloud_pos = wordbank_html.find('cloud-sync.assets-', save_repair_pos)
    if not (storage_pos >= 0 and storage_pos < wordbank_controller_pos < save_repair_pos < cloud_pos):
        fail(errors, 'Word Bank dependency contract drifted: storage -> page controller -> save repair -> cloud sync')

    redirect_targets = {
        'kana.html': '/kana/', 'default.html': '/reading/', 'reverse.html': '/writing/',
        'test.html': '/results/', 'wordbank.html': '/wordbank/',
    }
    for rel, target in redirect_targets.items():
        redirect_html = text(ROOT / rel)
        if f'url={target}' not in redirect_html or f"new URL('{target}'" not in redirect_html:
            fail(errors, f'legacy redirect target drifted for {rel}: expected {target}')
        if "key !== 'build' && key !== 'v' && key !== 'reload'" not in redirect_html:
            fail(errors, f'legacy redirect no longer strips update transport parameters: {rel}')

    frontend_component_source = text(ROOT / 'frontend_components.py')
    for trainer_page in (ROOT / 'reading/index.html', ROOT / 'writing/index.html'):
        trainer_html = text(trainer_page)
        if trainer_html.count('data-ma-trainer-shell="shared"') != 1:
            fail(errors, f'trainer page does not contain exactly one shared trainer shell: {trainer_page.relative_to(ROOT)}')
        if trainer_html.count('MODE_ATLAS_TRAINER_START') != 1 or trainer_html.count('MODE_ATLAS_TRAINER_END') != 1:
            fail(errors, f'trainer page is missing shared trainer build markers: {trainer_page.relative_to(ROOT)}')
        for contract in ('data-ma-trainer-scores="shared"', 'data-ma-trainer-modifiers="shared"', 'ma-trainer-card', 'ma-trainer-button', 'ma-trainer-input'):
            if contract not in trainer_html:
                fail(errors, f'trainer page is missing shared trainer contract {contract}: {trainer_page.relative_to(ROOT)}')

    for marker_text in ('NAV_CONFIGS', 'PRIMARY_LINKS', 'render_navigation', 'apply_navigation', 'TRAINER_CONFIGS', 'render_trainer_shell', 'apply_trainer_shell', 'PAGE_ASSETS', 'HEAD_SCRIPTS', 'apply_frontend_assets', 'render_loading_screen', 'LEGACY_REDIRECTS', 'apply_legacy_redirects'):
        if marker_text not in frontend_component_source:
            fail(errors, f'shared frontend component source missing marker: {marker_text}')

    drawer_binding = text(ROOT / 'assets/ui/mode-atlas-profile-drawer-bindings.js')
    if 'ensureSettingsButtons' in drawer_binding:
        fail(errors, 'Profile/Settings binding still manufactures Settings navigation controls at runtime')
    if "querySelectorAll('[data-profile-open]')" not in drawer_binding:
        fail(errors, 'Profile binding does not use the shared navigation profile contract')

    settings_markup = text(ROOT / 'assets/ui/mode-atlas-settings-menu.js')
    profile_markup = text(ROOT / 'assets/ui/mode-atlas-profile-menu.js')
    if 'ma-menu-action' in settings_markup or 'ma-menu-action' in profile_markup:
        fail(errors, 'Profile/Settings markup still uses the legacy button implementation')
    if 'ma-button' not in settings_markup or 'ma-button' not in profile_markup:
        fail(errors, 'Profile/Settings markup does not use shared button primitives')
    if 'ma-status ma-settings-status' not in settings_markup:
        fail(errors, 'Settings update state does not use the shared inline status primitive')

    legacy_nav_selector = re.compile(r'(?<![-\w])\.(?:topbar|branch-nav|study-nav|nav-link|branch-link|study-link|profile-trigger|profile-dot|ma-settings-trigger)(?![-\w])')
    for css_path in sorted((ROOT / 'assets/css').glob('*.css')):
        if fingerprint_re.search(css_path.name) or css_path.name == 'mode-atlas-navigation.css':
            continue
        if legacy_nav_selector.search(text(css_path)):
            fail(errors, f'legacy navigation selector remains outside shared navigation CSS: {css_path.relative_to(ROOT)}')

    obsolete_polish = ROOT / 'assets/css/mode-atlas-app-polish.css'
    if obsolete_polish.exists():
        fail(errors, 'obsolete app-polish stylesheet still exists instead of shared-owner styling')
    for page_path in frontend_pages:
        if 'mode-atlas-app-polish' in text(page_path):
            fail(errors, f'page still loads obsolete app-polish stylesheet: {page_path.relative_to(ROOT)}')

    reading_css = text(ROOT / 'assets/css/mode-atlas-default-page.css')
    writing_css = text(ROOT / 'assets/css/mode-atlas-reverse-page.css')
    duplicate_trainer_shell = re.compile(r'(?m)^\.(?:main|side-panel|score-block|score-pill|bottom-shell|toggle-btn)\s*\{')
    if duplicate_trainer_shell.search(reading_css):
        fail(errors, 'Reading page CSS reintroduced shared trainer shell styling')
    if re.search(r'(?m)^\.(?:main|side-panel|score-block)\s*\{', writing_css):
        fail(errors, 'Writing page CSS reintroduced shared trainer shell styling')

    session_controls = text(ROOT / 'assets/trainer/mode-atlas-session-controls.js')
    study_css = text(ROOT / 'assets/css/mode-atlas-study-shared.css')
    achievement_css = text(ROOT / 'assets/css/mode-atlas-achievements.css')
    if "document.querySelector('.ma-trainer-card')" not in session_controls:
        fail(errors, 'Pause overlay does not target the shared trainer card')
    if '.ma-pause-overlay' not in study_css or '.ma-session-paused .ma-trainer-card' not in study_css:
        fail(errors, 'Pause/session presentation is not owned by the shared trainer stylesheet')
    if '.ma-pause-overlay' in achievement_css or '.ma-session-paused' in achievement_css or '.session-actions' in achievement_css:
        fail(errors, 'Achievements stylesheet still owns trainer pause/session presentation')

    # Every generated file for the active revision must exactly match its canonical source.
    generated = []
    stale_generated = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        match = fingerprint_re.search(path.name)
        if not match:
            continue
        if match.group(1) != revision:
            stale_generated.append(path)
            continue
        generated.append(path)
        canonical_name = fingerprint_re.sub(lambda m: "." + m.group(2), path.name)
        canonical = path.with_name(canonical_name)
        if not canonical.exists():
            fail(errors, f"generated asset has no canonical source: {path.relative_to(ROOT)}")
        elif path.read_bytes() != canonical.read_bytes():
            fail(errors, f"generated asset differs from canonical source: {path.relative_to(ROOT)}")
    if stale_generated:
        fail(errors, "stale generated assets remain: " + ", ".join(p.relative_to(ROOT).as_posix() for p in stale_generated[:8]))

    sw = text(ROOT / "sw.js")
    if re.search(r"addEventListener\s*\(\s*['\"]fetch['\"]", sw):
        fail(errors, "sw.js contains a fetch handler")
    if re.search(r"addEventListener\s*\(\s*['\"]message['\"]", sw):
        fail(errors, "sw.js contains a message handler")

    runtime_files = [p for p in ROOT.rglob("*.js") if not fingerprint_re.search(p.name) and 'tests' not in p.parts and 'node_modules' not in p.parts]
    for path in runtime_files:
        src = text(path)
        if "serviceWorker.register(" in src:
            fail(errors, f"runtime serviceWorker.register found in {path.relative_to(ROOT)}")

    loader_path = ROOT / 'assets/app/mode-atlas-loader.js'
    if loader_path.exists():
        fail(errors, 'unused mode-atlas-loader.js compatibility bridge still exists')
    for html_path in html_files:
        if 'mode-atlas-loader.' in text(html_path) or 'mode-atlas-loader.js' in text(html_path):
            fail(errors, f"HTML still loads removed loader bridge: {html_path.relative_to(ROOT)}")

    head_bootstrap = text(ROOT / 'assets/app/mode-atlas-head-bootstrap.js')
    if 'canUseModules' in head_bootstrap or 'loadModule:' in head_bootstrap:
        fail(errors, 'head bootstrap still exposes unused dynamic-module loader code')

    page_state = text(ROOT / 'assets/app/mode-atlas-page-state.js')
    if "event.persisted === true" not in page_state or "window.addEventListener('pageshow', boot)" in page_state:
        fail(errors, 'page-state lifecycle does not limit pageshow work to BFCache restores')
    if any(marker in page_state for marker in ('ModeAtlasPageState =', 'cleanDecorativeTextIcons', 'lifecycleListeners = new Map')):
        fail(errors, 'page-state still carries obsolete global/decorative/listener-registry compatibility work')

    settings = text(ROOT / "assets/ui/mode-atlas-profile-drawer-bindings.js")
    for forbidden in ("serviceWorker", "registration.update", "postMessage", "ModeAtlasUpdates"):
        if forbidden in settings:
            fail(errors, f"Settings binding contains forbidden update/SW API: {forbidden}")
    if "Service Worker version check" in settings:
        fail(errors, "Settings binding contains obsolete Service Worker update error text")

    checker = text(ROOT / "assets/app/mode-atlas-version-check.js")
    required_checker = (
        "cache: 'no-store'",
        "modeAtlasVersionFileCheckedResetDay:",
        "modeAtlasVersionFileAttemptedResetDay:",
        "runAutomaticCheck",
        "installNavigationCacheGuard",
        "url.searchParams.set('build', buildRevision)",
        "This is document cache separation, not an update/version-file check.",
    )
    for marker in required_checker:
        if marker not in checker:
            fail(errors, f"version checker missing required ownership marker: {marker}")

    cloud = text(ROOT / "cloud-sync.js")
    store_json_match = re.search(r"function\s+storeJSON\([^)]*\)\s*\{(?P<body>.*?)\n\}", cloud, re.S)
    store_set_json_match = re.search(r"function\s+storeSetJSON\([^)]*\)\s*\{(?P<body>.*?)\n\}", cloud, re.S)
    if (store_json_match and re.search(r"(?<![.\w])storeJSON\s*\(", store_json_match.group('body'))) or (store_set_json_match and re.search(r"(?<![.\w])storeSetJSON\s*\(", store_set_json_match.group('body'))):
        fail(errors, "cloud-sync storage fallback is recursively self-calling")
    if "modeAtlasCloudDataChanged" not in cloud:
        fail(errors, "cloud-sync does not expose a distinct cloud-data-changed event")
    if "hydrateFromCloud(false).catch" not in cloud:
        fail(errors, "auth restoration does not own initial cloud hydration")
    if "waitForInitialHydration" not in cloud:
        fail(errors, "cloud-sync does not expose auth-owned initial hydration readiness")
    if "cloudSyncPromise" not in cloud or "performSyncOnce" not in cloud:
        fail(errors, "cloud writes do not have a single in-flight sync owner")
    if cloud.count("currentUser.uid !== uid") < 3:
        fail(errors, "cloud operations are missing account-change guards")
    if "snap.exists() && !hasLocalImportGuard()" not in cloud:
        fail(errors, "cloud sync does not protect authoritative manual imports from remote merge races")
    if "const localSection = snapshotSectionFixed(name);" not in cloud or "snapshot.sections[name] = localSection;" not in cloud:
        fail(errors, "cloud sync can merge against a stale local snapshot after an in-flight Firestore read")
    for marker in (
        "firebaseModulesLoaded = loaded === true;",
        "firebaseModulesPromise = null;",
        "firestoreModuleLoaded = loaded === true;",
        "firestoreModulePromise = null;",
        "async function ensureFirestore()",
        "if (!await ensureFirestore()) return false;",
        "firebaseSetupPromise = null;",
        "const joinedExistingSetup = !!firebaseSetupPromise;",
        "if (!ready && joinedExistingSetup",
        "authListenerInstalled",
    ):
        if marker not in cloud:
            fail(errors, f"Firebase setup is missing retry/recovery marker: {marker}")
    core_loader = re.search(r"async function loadFirebaseModules\(\) \{(?P<body>.*?)\n\}", cloud, re.S)
    firestore_loader = re.search(r"async function loadFirestoreModule\(\) \{(?P<body>.*?)\n\}", cloud, re.S)
    if not core_loader or 'firebase-firestore.js' in core_loader.group('body'):
        fail(errors, 'Firebase core startup still eagerly imports Firestore')
    if not firestore_loader or 'firebase-firestore.js' not in firestore_loader.group('body'):
        fail(errors, 'Firestore no longer has a dedicated lazy module owner')
    setup_firebase = re.search(r"async function setupFirebase\(\) \{(?P<body>.*?)\n\}\n\nfunction getDocRef", cloud, re.S)
    if setup_firebase and 'db = getFirestore(app)' in setup_firebase.group('body'):
        fail(errors, 'Firebase auth startup still eagerly initializes Firestore')
    if "version: BACKUP_FORMAT_VERSION" not in cloud or "CLOUD_SNAPSHOT_VERSION" not in cloud:
        fail(errors, "cloud backup/snapshot envelopes do not use central release format metadata")

    profile = text(ROOT / "assets/ui/mode-atlas-profile-drawer-bindings.js")
    if "let profileCloudBinding = null;" not in profile:
        fail(errors, "profile cloud binding is not single-owner/idempotent")
    if "if (!profileCloudBinding) bindCloudUi();" not in profile:
        fail(errors, "profile status updates can rebind cloud controls unconditionally")

    page_sources = [
        ROOT / "assets/pages/mode-atlas-default-page.js",
        ROOT / "assets/pages/mode-atlas-reverse-page.js",
        ROOT / "assets/pages/mode-atlas-kana-page.js",
        ROOT / "assets/pages/mode-atlas-test-page.js",
        ROOT / "assets/pages/mode-atlas-wordbank-page.js",
    ]
    for path in page_sources:
        src = text(path)
        if "hydrateFromCloud(" in src or "beforePageLoad(" in src:
            fail(errors, f"page directly owns cloud hydration: {path.relative_to(ROOT)}")
        if "kanaCloudSyncStatusChanged" in src:
            fail(errors, f"page uses cloud status as a data-refresh trigger: {path.relative_to(ROOT)}")

    visit_flows = text(ROOT / "assets/app/mode-atlas-visit-flows.js")
    if "waitForInitialHydration" not in visit_flows:
        fail(errors, "visit/onboarding flow can decide before auth-owned cloud hydration settles")

    modifier_runtime = text(ROOT / "assets/trainer/mode-atlas-modifier-menu.js")
    if any(marker in modifier_runtime for marker in ("importPreviewBound", "installImportPreview", "confirmImportBtn", "importTextarea")):
        fail(errors, "legacy trainer import-preview owner still exists outside shared Settings import flow")
    if "event.persisted === true" not in modifier_runtime:
        fail(errors, "trainer runtime reboots on ordinary initial pageshow instead of BFCache restore only")
    if "function modeToggle(" in modifier_runtime or "persistTrainerSettings(" in modifier_runtime:
        fail(errors, "modifier-menu still contains a second trainer-control mutation owner")

    trainer_controls = text(ROOT / "assets/trainer/mode-atlas-trainer-controls.js")
    if "window.addEventListener('load', install)" in trainer_controls:
        fail(errors, "trainer controls redundantly reinstall on window load")
    if "document.addEventListener('ma:ui-refresh', install)" in trainer_controls:
        fail(errors, "trainer controls redundantly reinstall on generic UI refresh")
    if "event.persisted === true" not in trainer_controls:
        fail(errors, "trainer controls do not limit pageshow reinstall to BFCache restoration")

    obsolete_owners = [
        ROOT / "assets/app/mode-atlas-confusable-mode.js",
        ROOT / "assets/ui/mode-atlas-verified-preset-confusable.js",
        ROOT / "assets/results/mode-atlas-results-insights.js",
        ROOT / "assets/css/mode-atlas-results-insights.css",
    ]
    for path in obsolete_owners:
        if path.exists():
            fail(errors, f"obsolete duplicate/dead module still exists: {path.relative_to(ROOT)}")

    kana_data = text(ROOT / 'assets/data/mode-atlas-kana-data.js')
    for marker in ('kanaCollections', 'collections: kanaCollections', 'extendedKatakanaMap', 'yoonMap'):
        if marker not in kana_data:
            fail(errors, f"canonical Kana data missing flattened inventory marker: {marker}")

    metrics = text(ROOT / "assets/app/mode-atlas-kana-metrics.js")
    for marker in ("function createSnapshot()", "function useSnapshot(snapshot)", "readingStats:modeObj('reading','charStats')", "writingTimes:modeObj('writing','charTimes')", "const Collections=KanaData?.collections"):
        if marker not in metrics:
            fail(errors, f"Kana metrics missing canonical/snapshot ownership marker: {marker}")
    if re.search(r'''const\s+(?:HIRA|KATA|DAK|YOON|EXT)\s*=\s*['"\[]''', metrics):
        fail(errors, "Kana metrics still hard-codes a second Kana inventory")
    if "toISOString().slice(0,10)" in metrics or "toISOString().slice(0, 10)" in metrics:
        fail(errors, "Kana metrics still derives Daily Challenge dates from UTC")

    achievements = text(ROOT / 'assets/achievements/mode-atlas-achievements-ui.js')
    if 'const KanaData = window.ModeAtlasKanaData;' not in achievements or 'const Metrics = window.ModeAtlasKanaMetrics;' not in achievements:
        fail(errors, 'Achievements does not consume canonical Kana data/metrics owners')
    if re.search(r"const\s+(?:HIRA|KATA|DAK|YOON|EXT)\s*=\s*\[", achievements):
        fail(errors, 'Achievements still hard-codes a second Kana inventory')
    if "window.addEventListener('focus'" in achievements or "document.addEventListener('ma:ui-refresh'" in achievements:
        fail(errors, 'Achievements still performs generic focus/UI-refresh recalculation')
    if "event.persisted===true" not in achievements and "event.persisted === true" not in achievements:
        fail(errors, 'Achievements pageshow work is not BFCache-only')

    for page_path in main_pages:
        page_html = text(page_path)
        dependency_names = [
            f'mode-atlas-kana-data.{revision}.js',
            f'mode-atlas-kana-metrics.{revision}.js',
            f'mode-atlas-achievements-ui.{revision}.js',
        ]
        positions = [page_html.find(name) for name in dependency_names]
        if any(pos < 0 for pos in positions) or positions != sorted(positions):
            fail(errors, f"Kana data/metrics/achievement dependency order is invalid in {page_path.relative_to(ROOT)}")

    save_repair = text(ROOT / 'assets/app/mode-atlas-save-repair.js')
    for marker in ('modeAtlasSaveSchemaVersion', 'const MIGRATIONS = Object.freeze', 'runPendingMigrations', 'scheduleCloudSyncIfChanged', 'repairAfterCloudHydration'):
        if marker not in save_repair:
            fail(errors, f"save repair missing schema-migration ownership marker: {marker}")
    if "modeAtlasDataVersion" in save_repair:
        fail(errors, 'save repair still mixes app version with save schema version')
    repair_fn = re.search(r"function\s+repairSaveData\(\)\s*\{(?P<body>.*?)\n  \}", save_repair, re.S)
    if repair_fn and 'scheduleSync' in repair_fn.group('body'):
        fail(errors, 'repairSaveData schedules cloud sync even when no data changed')

    storage = text(ROOT / 'assets/app/mode-atlas-storage.js')
    if 'window.ModeAtlasSaveSchemaVersion' not in storage or 'SAVE_SCHEMA_VERSION' not in storage:
        fail(errors, 'storage schema version does not derive from central release metadata')
    for marker in ('APP_LOCAL_EXACT', 'APP_BACKUP_EXACT', 'APP_SESSION_EXACT', 'isAppLocalKey', 'isBackupKey', 'snapshotBackupStorage', 'filterAppMap', 'applyAppMap', 'clearAppData'):
        if marker not in storage:
            fail(errors, f'storage boundary missing authoritative inventory marker: {marker}')

    # No runtime module may clear the entire origin. Reset is Mode Atlas-scoped.
    for path in runtime_files:
        src = text(path)
        if 'localStorage.clear(' in src or 'sessionStorage.clear(' in src:
            fail(errors, f'origin-wide storage clear found in runtime module: {path.relative_to(ROOT)}')

    import_export = text(ROOT / 'assets/app/mode-atlas-import-export.js')
    if 'BACKUP_FORMAT_VERSION' not in import_export or "version: 2" in import_export:
        fail(errors, 'import/export backup format is still hard-coded outside release metadata')
    for marker in ('snapshotBackupStorage', 'applyAppMap', 'clearAppData'):
        if marker not in import_export:
            fail(errors, f'import/export bypasses shared storage boundary: missing {marker}')
    if 'Object.entries(data).forEach(([k,v]) => localStorage.setItem' in import_export:
        fail(errors, 'import fallback can write arbitrary origin keys')

    if 'store.clearAppData()' not in cloud:
        fail(errors, 'cloud reset bypasses shared scoped storage boundary')
    if 'store.snapshotBackupStorage(localStorage)' not in cloud:
        fail(errors, 'cloud export bypasses shared backup inventory')

    about = text(ROOT / 'assets/app/mode-atlas-about.js')
    if 'window.ModeAtlasSaveSchemaVersion' not in about or 'window.ModeAtlasBuildDate' not in about:
        fail(errors, 'About metadata duplicates save schema/build date instead of reading release metadata')

    trainer_core = text(ROOT / 'assets/trainer/mode-atlas-trainer-core.js')
    if "date: new Date().toISOString().slice(0, 10)" in trainer_core or 'ModeAtlasDates?.localDateKey' not in trainer_core:
        fail(errors, 'formal trainer test results do not use the shared local calendar-date helper')

    date_helper = ROOT / "assets/app/mode-atlas-date.js"
    if not date_helper.exists() or "localDateKey" not in text(date_helper):
        fail(errors, "shared local calendar-date helper is missing")
    for page_path in [ROOT / "kana/index.html", ROOT / "reading/index.html", ROOT / "writing/index.html"]:
        page_html = text(page_path)
        if f"mode-atlas-date.{revision}.js" not in page_html:
            fail(errors, f"Daily Challenge page does not load shared local-date helper: {page_path.relative_to(ROOT)}")

    # Frontend feedback ownership: one dialog owner, one feedback facade, no native browser prompts.
    dialog_path = ROOT / 'assets/app/mode-atlas-dialog.js'
    feedback_path = ROOT / 'assets/app/mode-atlas-feedback.js'
    if not dialog_path.exists() or 'ModeAtlasDialog' not in text(dialog_path):
        fail(errors, 'shared Mode Atlas dialog owner is missing')
    if not feedback_path.exists() or 'ModeAtlasFeedback' not in text(feedback_path):
        fail(errors, 'shared Mode Atlas feedback owner is missing')
    for page_path in main_pages:
        page_html = text(page_path)
        if f'mode-atlas-dialog.{revision}.js' not in page_html or f'mode-atlas-feedback.{revision}.js' not in page_html:
            fail(errors, f'shared feedback/dialog scripts missing from {page_path.relative_to(ROOT)}')

    native_prompt_re = re.compile(r'(?<![\w.])(?:window\.)?(?:alert|confirm)\s*\(')
    for path in runtime_files:
        if path in {dialog_path, feedback_path}:
            continue
        src = text(path)
        if native_prompt_re.search(src):
            fail(errors, f'native alert/confirm remains in runtime module: {path.relative_to(ROOT)}')

    for page_path in [ROOT / 'reading/index.html', ROOT / 'writing/index.html']:
        page_html = text(page_path)
        if any(marker in page_html for marker in ('importModalBackdrop', 'importTextarea', 'confirmImportBtn')):
            fail(errors, f'legacy trainer import modal still exists in {page_path.relative_to(ROOT)}')

    # Frontend primitive ownership: shared drawers/forms/cards and feature-dialog mechanics.
    components = text(ROOT / 'assets/css/mode-atlas-components.css')
    for marker in ('.ma-card{', '.ma-field{', '.ma-input,.ma-select,.ma-textarea{', '.ma-check{', '.ma-dialog--large{'):
        if marker not in components:
            fail(errors, f'shared frontend primitive missing: {marker}')

    profile_menu = text(ROOT / 'assets/ui/mode-atlas-profile-menu.js')
    settings_menu = text(ROOT / 'assets/ui/mode-atlas-settings-menu.js')
    if 'ma-drawer ma-shared-profile-drawer' not in profile_menu or 'ma-drawer ma-shared-settings-drawer' not in settings_menu:
        fail(errors, 'Profile/Settings do not consume the shared drawer shell')

    home_page = text(ROOT / 'assets/pages/mode-atlas-home-page.js')
    if not home_page or 'homeContinueAction' not in home_page:
        fail(errors, 'Atlas returning-user UI is missing its page controller')
    if any(marker in home_page for marker in ('ModeAtlasProfile', 'KanaCloudSync', 'profileDrawer', 'settingsDrawer')):
        fail(errors, 'Atlas page controller takes over shared Profile/Settings/cloud ownership')
    if 'Branches' in profile_menu or 'data-ma-nav-item' in profile_menu:
        fail(errors, 'Profile drawer duplicates shared navigation')
    settings_hierarchy_markers = ('ma-setting-row', 'ma-settings-disclosure', 'ma-settings-data-list', 'ma-save-section', 'ma-tools-panel')
    if any(marker not in settings_menu for marker in settings_hierarchy_markers):
        fail(errors, 'Settings drawer is missing the standard preference/data hierarchy')

    wordbank_html = text(ROOT / 'wordbank/index.html')
    wordbank_css = text(ROOT / 'assets/css/mode-atlas-wordbank-page.css')
    if 'class="ma-input" id="kanaInput"' not in wordbank_html or 'class="ma-select" id="sortSelect"' not in wordbank_html:
        fail(errors, 'Word Bank does not consume shared form controls')
    if re.search(r'input\[type="text"\]\s*,\s*textarea\s*,\s*select', wordbank_css):
        fail(errors, 'Word Bank still owns duplicate global input/select/textarea styling')

    kana_page = text(ROOT / 'assets/pages/mode-atlas-kana-page.js')
    kana_css = text(ROOT / 'assets/css/mode-atlas-kana-page.css')
    if 'ModeAtlasDialog.feature' not in kana_page:
        fail(errors, 'Kana information popups bypass the shared dialog owner')
    if any(marker in kana_page + kana_css for marker in ('kanaHubModal', '.kana-hub-modal', '.kana-modal-backdrop', '.kana-modal-panel')):
        fail(errors, 'Kana still contains a second feature-modal shell owner')

    if "feature(input){ return enqueue(input, 'feature'); }" not in text(dialog_path):
        fail(errors, 'shared dialog owner does not expose feature-content mode')

    if "createElement('style')" in visit_flows or 'maVisitStyles' in visit_flows or 'css.textContent' in visit_flows:
        fail(errors, 'visit/onboarding flow injects its own runtime CSS instead of shared stylesheet ownership')
    for marker in ('ma-card ma-visit-card', 'ma-button ma-button--primary ma-visit-btn', 'ma-check ma-visit-check'):
        if marker not in visit_flows:
            fail(errors, f'visit/onboarding flow does not consume shared primitive: {marker}')

    # Full-project ownership/performance cleanup guards.
    visit_flows_runtime = text(ROOT / 'assets/app/mode-atlas-visit-flows.js')
    if 'MutationObserver' in visit_flows_runtime or 'maDevPanel' in visit_flows_runtime:
        fail(errors, 'visit-flow dev tools still observe/inject into the removed legacy dev panel')
    dev_console = text(ROOT / 'assets/app/mode-atlas-dev-console.js')
    for marker in ('maDevFirstVisit', 'maDevDailyReturn', 'maDevResetVisit'):
        if marker not in dev_console:
            fail(errors, f'current Dev Diagnostics does not own visit-flow action: {marker}')

    import_export = text(ROOT / 'assets/app/mode-atlas-import-export.js')
    for marker in ('ModeAtlasImportUi', "addEventListener('focus'", "addEventListener('pageshow'", 'visibilitychange', 'rebuildSaveSections'):
        if marker in import_export:
            fail(errors, f'import/export still carries obsolete global/lifecycle refresh ownership: {marker}')

    sounds = text(ROOT / 'assets/app/mode-atlas-sounds.js')
    if 'MutationObserver' in sounds:
        fail(errors, 'sound system still scans the entire document with MutationObserver instead of explicit event boundaries')
    if 'ModeAtlasUI' in sounds:
        fail(errors, 'sound system still exports the unused ModeAtlasUI compatibility alias')
    if "for(const legacyKey of LEGACY_KEYS) writeModeValue" in sounds:
        fail(errors, 'sound mode still rewrites every legacy storage alias instead of canonical modeAtlasSound')
    storage_js = text(ROOT / 'assets/app/mode-atlas-storage.js')
    if "soundMode: 'modeAtlasSound'" not in storage_js:
        fail(errors, 'shared storage does not identify modeAtlasSound as the canonical sound preference')

    profile_bindings = text(ROOT / 'assets/ui/mode-atlas-profile-drawer-bindings.js')
    for marker in ('ModeAtlasKanaProfile', 'ModeAtlasTestProfile', 'ModeAtlasWordProfile'):
        if marker in profile_bindings:
            fail(errors, f'Profile still exports unused legacy alias: {marker}')
    for marker in ('trapDrawerFocus', 'drawerReturnFocus', "event.key === 'Escape' && activeDrawerName"):
        if marker not in profile_bindings:
            fail(errors, f'shared drawers missing focus-management contract: {marker}')

    early_loader = text(ROOT / 'assets/app/mode-atlas-early-loader.js')
    if 'ModeAtlasHideLoader' in early_loader or 'ModeAtlasLoaderState' in early_loader:
        fail(errors, 'early loader still exports unused compatibility globals')

    trainer_markup = text(ROOT / 'reading/index.html') + text(ROOT / 'writing/index.html')
    for label in ('aria-label="Type the romaji answer"', 'aria-label="Type the kana answer"'):
        if label not in trainer_markup:
            fail(errors, f'trainer text input missing accessible name: {label}')

    achievements_css = text(ROOT / 'assets/css/mode-atlas-achievements.css')
    if 'ma-preset-toggle' in achievements_css:
        fail(errors, 'Achievements stylesheet still owns trainer preset-toggle presentation')
    theme_css = text(ROOT / 'assets/css/mode-atlas-theme.css')
    if re.search(r'\.ma-drawer-backdrop\s*,\s*/\*', theme_css):
        fail(errors, 'theme stylesheet contains a dangling drawer-backdrop selector')
    shared_css = text(ROOT / 'assets/css/mode-atlas-page-shared.css')
    if any(marker in shared_css for marker in ('.ma-dev-panel', '.ma-dev-card', '.ma-dev-title', '.ma-dev-label')):
        fail(errors, 'shared page stylesheet still owns obsolete developer-panel presentation')

    if re.search(r'--ma-radius-lg\s*:', shared_css):
        fail(errors, 'shared page stylesheet overrides the canonical theme radius scale')
    for marker in ('.nav-shell', '.site-header', '.app-nav', '#profileDot', '#studyTopProfileDot', '#studyProfileBtn'):
        if marker in shared_css:
            fail(errors, f'shared page stylesheet restored retired navigation/profile ownership: {marker}')

    responsive_css = text(ROOT / 'assets/css/mode-atlas-responsive.css')
    for marker in ('.results-layout', '.hero-grid', '.field-grid', '.meta-grid', '.kana-hub', '.word-list'):
        if marker in responsive_css:
            fail(errors, f'shared responsive stylesheet owns page-internal layout again: {marker}')

    for marker in ('--ma-content-max:', '--ma-content-wide:', '--ma-page-gutter:', '--ma-radius-xl:', '--ma-kana:', '--ma-words:',
                   '--ma-page-bg-atlas:', '--ma-page-bg-kana:', '--ma-page-bg-results:', '--ma-page-bg-words:'):
        if marker not in theme_css:
            fail(errors, f'theme stylesheet missing canonical UI foundation token: {marker}')

    icon_sprite = text(ROOT / 'assets/mode-atlas-icons.svg')
    for marker in ('icon-settings', 'icon-user', 'icon-focus', 'icon-search', 'icon-star', 'icon-edit', 'icon-delete', 'icon-chart'):
        if f'id="{marker}"' not in icon_sprite:
            fail(errors, f'shared icon sprite missing: {marker}')
    for marker in ('.ma-page-intro{', '.ma-setting-row{', '.ma-status-chip{', '.ma-progress{', '.ma-skeleton-block,', '.ma-trend{'):
        if marker not in components:
            fail(errors, f'shared visual vocabulary missing: {marker}')

    atlas_markup = text(ROOT / 'index.html')
    if 'id="homeContinueCard"' not in atlas_markup or 'Reading Comprehension' not in atlas_markup:
        fail(errors, 'Atlas returning-user hierarchy or future branch naming drifted')
    kana_markup = text(ROOT / 'kana/index.html')
    if 'id="kanaContinueAction"' not in kana_markup or 'ma-skeleton-block' not in kana_markup:
        fail(errors, 'Kana hub recommendation/loading hierarchy drifted')
    trainer_ui_markup = text(ROOT / 'reading/index.html') + text(ROOT / 'writing/index.html')
    for marker in ('Practice setup ▼', 'id="sessionProgressBar"', 'Focus mode', 'Exit focus mode'):
        if marker not in trainer_ui_markup:
            fail(errors, f'trainer standardisation marker missing: {marker}')
    for marker in ('>Hide nav<', '>Show navigation<', '>Modifiers ▼<'):
        if marker in trainer_ui_markup:
            fail(errors, f'legacy trainer UI wording returned: {marker}')
    results_markup = text(ROOT / 'results/index.html')
    results_page_js = text(ROOT / 'assets/pages/mode-atlas-test-page.js')
    if 'id="resultsGuidanceCard"' not in results_markup or 'id="resultsTrend"' not in results_markup:
        fail(errors, 'Results actionable guidance/trend UI is missing')
    if 'function renderGuidance(' not in results_page_js or 'function renderTrend(' not in results_page_js:
        fail(errors, 'Results page no longer renders actionable guidance/trend data')
    wordbank_markup = text(ROOT / 'wordbank/index.html')
    library_pos = wordbank_markup.find('class=\"wordbank-library ma-page-section\"')
    add_pos = wordbank_markup.find('id=\"wordBankAddPanel\"')
    if (
        library_pos < 0 or add_pos <= library_pos
        or 'id=\"wordBankAddJumpBtn\"' not in wordbank_markup
        or 'id=\"wordBankActionsBtn\"' not in wordbank_markup
        or 'id=\"wordBankActionsPanel\"' not in wordbank_markup
        or 'id=\"wordBankResultsMeta\"' not in wordbank_markup
        or '<details class=\"wordbank-tools\">' in wordbank_markup
        or 'library-panel ma-card' in wordbank_markup
        or 'id=\"exportBtn\"' in wordbank_markup
        or 'id=\"importFile\"' in wordbank_markup
    ):
        fail(errors, 'Word Bank library-first hierarchy or collection settings ownership drifted')

    framed_pages = {
        ROOT / 'index.html': 'ma-atlas-page',
        ROOT / 'kana/index.html': 'ma-kana-page',
        ROOT / 'results/index.html': 'ma-results-page',
        ROOT / 'wordbank/index.html': 'ma-wordbank-page',
    }
    for page_path, body_class in framed_pages.items():
        page_markup = text(page_path)
        if body_class not in page_markup or 'ma-page-frame' not in page_markup:
            fail(errors, f'{page_path.relative_to(ROOT)} missing standard UI page-frame ownership')

    no_literal_colour_files = (
        ROOT / 'assets/css/mode-atlas-page-shared.css',
        ROOT / 'assets/css/mode-atlas-responsive.css',
        ROOT / 'assets/css/mode-atlas-components.css',
        ROOT / 'assets/css/mode-atlas-navigation.css',
        ROOT / 'assets/css/mode-atlas-app-modals.css',
        ROOT / 'assets/css/mode-atlas-wordbank-page.css',
    )
    for css_path in no_literal_colour_files:
        if re.search(r'#[0-9a-fA-F]{3,8}\b|rgba?\(', text(css_path)):
            fail(errors, f'{css_path.relative_to(ROOT)} reintroduced a literal colour outside the theme token owner')

    dead_runtime_markers = {
        ROOT / 'cloud-sync.js': ('function readNumber(', 'function snapshotSection(', 'function objectHasKeys(', 'function formatDateTime('),
        ROOT / 'assets/trainer/mode-atlas-modifier-menu.js': ('function currentWrongList(',),
        ROOT / 'assets/trainer/mode-atlas-trainer-shared.js': ('function isFinalTestQuestionCompleted(',),
        ROOT / 'assets/pages/mode-atlas-test-page.js': ('function getModifierStateLabel(',),
        ROOT / 'assets/pages/mode-atlas-reverse-page.js': ('function hasWritingLocalDataForPage(',),
    }
    for path, markers in dead_runtime_markers.items():
        src = text(path)
        for marker in markers:
            if marker in src:
                fail(errors, f'dead runtime helper returned after audit cleanup: {path.relative_to(ROOT)} -> {marker}')

    clean_urls = text(ROOT / "clean_urls.py")
    if "migration is retired" not in clean_urls.lower() or "shutil.move" in clean_urls:
        fail(errors, "clean_urls.py is not safely retired")

    if errors:
        print(f"Mode Atlas audit FAILED for {version} ({revision})")
        for item in errors:
            print(f" - {item}")
        return 1

    print(f"Mode Atlas audit PASS for {version} ({revision})")
    print(f" - HTML documents checked: {len(html_files)}")
    print(f" - Generated JS/CSS checked: {len(generated)}")
    print(f" - Referenced generated assets: {len(referenced_generated)}")
    print(" - Update/SW ownership: clean")
    print(" - Cloud hydration/data-event ownership: clean")
    print(" - Legacy clean-URL migration: safely retired")
    return 0


if __name__ == "__main__":
    sys.exit(main())
