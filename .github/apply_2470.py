from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

version_path = ROOT / 'assets/app/mode-atlas-version.js'
version = version_path.read_text(encoding='utf-8')
version = version.replace("var VERSION = '2.46.0';", "var VERSION = '2.47.0';")
version = version.replace("var CACHE_REVISION = 'assets-2.46.0';", "var CACHE_REVISION = 'assets-2.47.0';")
version_path.write_text(version, encoding='utf-8')

package_path = ROOT / 'package.json'
package = json.loads(package_path.read_text(encoding='utf-8'))
package['version'] = '2.47.0'
package_path.write_text(json.dumps(package, indent=2) + '\n', encoding='utf-8')

lock_path = ROOT / 'package-lock.json'
lock_text = lock_path.read_text(encoding='utf-8').replace(
    'https://packages.applied-caas-gateway1.internal.api.openai.org/artifactory/api/npm/npm-public/',
    'https://registry.npmjs.org/'
)
lock = json.loads(lock_text)
lock['version'] = '2.47.0'
if isinstance((lock.get('packages') or {}).get(''), dict):
    lock['packages']['']['version'] = '2.47.0'
lock_path.write_text(json.dumps(lock, indent=2) + '\n', encoding='utf-8')

build_path = ROOT / 'build_revision_assets.py'
build = build_path.read_text(encoding='utf-8')
if 'def iter_project_html()' not in build:
    build = build.replace(
        "for html_path in ROOT.rglob('*.html'):",
        'for html_path in iter_project_html():',
    )
    build = build.replace(
        'referenced = set()\n',
        "BUILD_IGNORED_DIRS = {'node_modules', '.git', 'playwright-report', 'test-results'}\n\ndef iter_project_html():\n    for html_path in ROOT.rglob('*.html'):\n        relative = html_path.relative_to(ROOT)\n        if any(part in BUILD_IGNORED_DIRS for part in relative.parts[:-1]):\n            continue\n        yield html_path\n\nreferenced = set()\n",
        1,
    )
build_path.write_text(build, encoding='utf-8')

audit_path = ROOT / 'audit_project.py'
audit = audit_path.read_text(encoding='utf-8')
if 'AUDIT_IGNORED_DIRS' not in audit:
    audit = audit.replace(
        '    referenced_generated: set[Path] = set()\n    html_files = sorted(ROOT.rglob("*.html"))',
        "    referenced_generated: set[Path] = set()\n    AUDIT_IGNORED_DIRS = {'node_modules', '.git', 'playwright-report', 'test-results'}\n    html_files = sorted(\n        path for path in ROOT.rglob(\"*.html\")\n        if not any(part in AUDIT_IGNORED_DIRS for part in path.relative_to(ROOT).parts[:-1])\n    )",
        1,
    )
audit_path.write_text(audit, encoding='utf-8')

manifest_path = ROOT / 'site.webmanifest'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
for shortcut in manifest.get('shortcuts', []):
    if shortcut.get('url') == '/results/':
        shortcut['name'] = 'Test Results'
        shortcut['short_name'] = 'Test Results'
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

smoke_path = ROOT / 'tests/smoke.spec.js'
smoke = smoke_path.read_text(encoding='utf-8')
seed_anchor = "      localStorage.setItem('modeAtlasSmokeSeeded', '1');\n"
seed_block = """      localStorage.setItem('modeAtlasSmokeSeeded', '1');
      localStorage.setItem('modeAtlasStarterSeen', 'true');
      localStorage.setItem('modeAtlasOnboardingComplete', 'true');
      localStorage.setItem('modeAtlasKanaSetupComplete', 'true');
      localStorage.setItem('modeAtlasLegalAccepted', 'true');
      localStorage.setItem('modeAtlasLegalAcceptedAt', String(Date.now()));
      localStorage.setItem('modeAtlasLegalVersion', '2026-05');
"""
if "localStorage.setItem('modeAtlasOnboardingComplete', 'true');" not in smoke:
    if seed_anchor not in smoke:
        raise SystemExit('Smoke-test local state seed is in an unexpected state.')
    smoke = smoke.replace(seed_anchor, seed_block, 1)

old = """      await page.evaluate(() => window.ModeAtlasSettings?.open?.());
      const updateButton = page.locator('#maCheckUpdatesBtn');
      const updateStatus = page.locator('#maUpdateStatus');
"""
new = """      const settingsButton = page.locator('[data-settings-open]:visible').first();
      const settingsDrawer = page.locator('#settingsDrawer');
      await expect(settingsDrawer).toBeAttached({ timeout: 5000 });
      await expect(settingsButton).toBeVisible();
      await expect(settingsButton).toHaveAttribute('data-settings-bound', 'shared', { timeout: 5000 });
      await settingsButton.click();
      await expect(settingsDrawer).toBeVisible();

      const updateButton = page.locator('#maCheckUpdatesBtn');
      const updateStatus = page.locator('#maUpdateStatus');
      await expect(updateButton).toBeVisible();
"""
if old in smoke:
    smoke = smoke.replace(old, new, 1)
elif new not in smoke:
    raise SystemExit('Settings smoke-test opener is in an unexpected state.')
smoke = smoke.replace(
    "page.locator('[data-settings-open]').first()",
    "page.locator('[data-settings-open]:visible').first()",
)
smoke_path.write_text(smoke, encoding='utf-8')

frontend_path = ROOT / 'tests/frontend.test.js'
frontend = frontend_path.read_text(encoding='utf-8')
marker = "test('2.47 release candidate hardening keeps release tooling reproducible'"
if marker not in frontend:
    frontend += r'''

test('2.47 release candidate hardening keeps release tooling reproducible', () => {
  const lock = read('package-lock.json');
  assert.doesNotMatch(lock, /internal\.api\.openai|applied-caas|artifactory\/api\/npm/i,
    'package-lock must remain installable from public infrastructure');

  const build = read('build_revision_assets.py');
  assert.match(build, /BUILD_IGNORED_DIRS\s*=\s*\{[^}]*'node_modules'/,
    'revision builder must not treat installed dependencies as application source');
  assert.match(build, /def iter_project_html\(\):/,
    'revision builder must own project HTML discovery explicitly');

  const audit = read('audit_project.py');
  assert.match(audit, /AUDIT_IGNORED_DIRS\s*=\s*\{[^}]*'node_modules'/,
    'release audit must not treat installed dependencies as application source');

  const manifest = JSON.parse(read('site.webmanifest'));
  const resultsShortcut = (manifest.shortcuts || []).find((shortcut) => shortcut.url === '/results/');
  assert.ok(resultsShortcut, 'PWA manifest must keep the Test Results shortcut');
  assert.equal(resultsShortcut.name, 'Test Results');
  assert.equal(resultsShortcut.short_name, 'Test Results');

  const smoke = read('tests/smoke.spec.js');
  assert.doesNotMatch(smoke, /window\.ModeAtlasSettings\?\.open/,
    'browser smoke must open Settings through the real user control');
  assert.match(smoke, /\[data-settings-open\]:visible/,
    'browser smoke must select the visible shared Settings trigger');
  assert.match(smoke, /toHaveAttribute\('data-settings-bound', 'shared'/,
    'browser smoke must wait for shared Settings binding readiness');
  assert.match(smoke, /modeAtlasOnboardingComplete[\s\S]*modeAtlasKanaSetupComplete/,
    'core browser smoke must seed a completed stable-user setup rather than be blocked by onboarding');

  const gate = read('.github/workflows/release-check.yml');
  assert.match(gate, /npm ci --ignore-scripts --registry=https:\/\/registry\.npmjs\.org\//,
    'release gate must install from the public npm registry');
  assert.match(gate, /npm run release:check/, 'release gate must run static and Node release checks');
  assert.match(gate, /desktop-chromium/, 'release gate must exercise the desktop browser project');
  assert.match(gate, /mobile-chromium/, 'release gate must exercise the mobile browser project');
  assert.match(gate, /git diff --exit-code/, 'release gate must reject uncommitted generated assets');
});
'''
    frontend_path.write_text(frontend, encoding='utf-8')

changelog_path = ROOT / 'CHANGELOG.md'
changelog = changelog_path.read_text(encoding='utf-8')
if not changelog.startswith('## 2.47.0'):
    entry = """## 2.47.0 - 2026-08-16
- Repaired package-lock package URLs so clean machines install Playwright dependencies from the public npm registry instead of an environment-specific internal registry.
- Restricted revision-build and release-audit HTML discovery to Mode Atlas source, preventing installed dependencies and browser-test output from being interpreted as application pages on clean CI machines.
- Made Settings browser smoke coverage wait for the shared drawer binding and use the real visible Settings control, while core smoke state now explicitly represents a completed learner setup so onboarding cannot intercept unrelated interaction tests.
- Added a permanent release gate covering the project audit, Node regressions, generated-asset cleanliness, and desktop/mobile Playwright smoke tests.
- Renamed the PWA assessment shortcut to Test Results so installed-app terminology matches the formal Test Mode reporting experience.
- Kept trainer behaviour, scoring/SRS, storage schemas, cloud sync, progression, onboarding, PWA install ownership, and update-check application logic unchanged.

"""
    changelog_path.write_text(entry + changelog, encoding='utf-8')
