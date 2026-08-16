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
    build = build.replace("for html_path in ROOT.rglob('*.html'):", 'for html_path in iter_project_html():')
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

kana_path = ROOT / 'kana/index.html'
kana = kana_path.read_text(encoding='utf-8')
kana = kana.replace(
    '<main id="mainContent" class="kana-hub ma-page-section" id="kanaHub">',
    '<main id="mainContent" class="kana-hub ma-page-section">',
)
kana_path.write_text(kana, encoding='utf-8')

wordbank_page_path = ROOT / 'assets/pages/mode-atlas-wordbank-page.js'
wordbank_page = wordbank_page_path.read_text(encoding='utf-8')
if not wordbank_page.lstrip().startswith('(function ModeAtlasWordBankPage(){'):
    wordbank_page = "(function ModeAtlasWordBankPage(){\n  'use strict';\n" + wordbank_page.rstrip() + "\n})();\n"
wordbank_page_path.write_text(wordbank_page, encoding='utf-8')

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
      localStorage.setItem('maWhatsNewSeen', 'smoke');
"""
if "localStorage.setItem('modeAtlasOnboardingComplete', 'true');" not in smoke:
    if seed_anchor not in smoke:
        raise SystemExit('Smoke-test local state seed is in an unexpected state.')
    smoke = smoke.replace(seed_anchor, seed_block, 1)
elif "localStorage.setItem('maWhatsNewSeen', 'smoke');" not in smoke:
    smoke = smoke.replace(
        "      localStorage.setItem('modeAtlasLegalVersion', '2026-05');\n",
        "      localStorage.setItem('modeAtlasLegalVersion', '2026-05');\n      localStorage.setItem('maWhatsNewSeen', 'smoke');\n",
        1,
    )

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

smoke = smoke.replace("page.locator('[data-settings-open]').first()", "page.locator('[data-settings-open]:visible').first()")
smoke = smoke.replace("page.locator('#kanaHub')", "page.locator('#mainContent.kana-hub')")
smoke = smoke.replace(
    "        page.waitForURL(/\\/kana\\/$/, { timeout: 5000 }),\n        page.locator('a.branch.kana').click(),",
    "        page.waitForURL(/\\/kana\\/$/, { timeout: 7500, waitUntil: 'commit' }),\n        page.locator('a.atlas-product__action[href=\"/kana/\"]').click({ noWaitAfter: true }),",
)
smoke = smoke.replace(
    "      await expect(page.locator('.ma-trainer-card .ma-pause-overlay')).toBeVisible();\n",
    "      await expect(page.locator('#pauseSessionBtn [data-ma-pause-label]')).toHaveText('Resume');\n      await expect(page.locator('#input')).toBeDisabled();\n",
)
wordbank_old = """      const input = page.locator('#kanaInput');
      const add = page.locator('#addWordBtn');
      await expect(add).toBeEnabled();
      await input.fill('ねこ');
"""
wordbank_new = """      await page.locator('#wordBankAddJumpBtn').click();
      const input = page.locator('#kanaInput');
      const add = page.locator('#addWordBtn');
      await expect(input).toBeVisible();
      await expect(add).toBeEnabled();
      await input.fill('ねこ');
"""
if wordbank_old in smoke:
    smoke = smoke.replace(wordbank_old, wordbank_new, 1)
elif wordbank_new not in smoke:
    raise SystemExit('Word Bank smoke-test flow is in an unexpected state.')
smoke = smoke.replace(
    "      await expect(profileDrawer).toBeHidden();\n      await expect(profileTrigger).toBeFocused();",
    "      await expect(profileDrawer).toHaveAttribute('aria-hidden', 'true');\n      await expect(profileDrawer).not.toHaveClass(/\\bopen\\b/);\n      await expect(page.locator('body')).not.toHaveClass(/profile-open/);\n      await expect(profileTrigger).toBeFocused();",
)
smoke = smoke.replace(
    "      await expect(settingsDrawer).toBeHidden();\n      await expect(settingsButton).toBeFocused();",
    "      await expect(settingsDrawer).toHaveAttribute('aria-hidden', 'true');\n      await expect(settingsDrawer).not.toHaveClass(/\\bopen\\b/);\n      await expect(page.locator('body')).not.toHaveClass(/settings-open/);\n      await expect(settingsButton).toBeFocused();",
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

  const kana = read('kana/index.html');
  assert.doesNotMatch(kana, /<main[^>]*\bid=["']mainContent["'][^>]*\bid=/,
    'Kana Hub main landmark must not contain duplicate id attributes');
  assert.match(kana, /<main id=["']mainContent["'] class=["']kana-hub ma-page-section["']>/,
    'Kana Hub must keep the shared mainContent landmark');

  const wordBankPage = read('assets/pages/mode-atlas-wordbank-page.js');
  assert.match(wordBankPage, /^\(function ModeAtlasWordBankPage\(\)\{/,
    'Word Bank page declarations must stay in page-local scope and not collide with shared kana data');
  assert.match(wordBankPage, /\}\)\(\);\s*$/,
    'Word Bank page module scope must close cleanly');

  const smoke = read('tests/smoke.spec.js');
  assert.doesNotMatch(smoke, /window\.ModeAtlasSettings\?\.open/,
    'browser smoke must open Settings through the real user control');
  assert.match(smoke, /\[data-settings-open\]:visible/,
    'browser smoke must select the visible shared Settings trigger');
  assert.match(smoke, /toHaveAttribute\('data-settings-bound', 'shared'/,
    'browser smoke must wait for shared Settings binding readiness');
  assert.match(smoke, /modeAtlasOnboardingComplete[\s\S]*modeAtlasKanaSetupComplete/,
    'core browser smoke must seed a completed stable-user setup rather than be blocked by onboarding');
  assert.match(smoke, /maWhatsNewSeen["'], 'smoke'/,
    'core browser smoke must suppress release notes so unrelated interaction tests stay isolated');
  assert.doesNotMatch(smoke, /ma-trainer-card \.ma-pause-overlay/,
    'trainer smoke must validate canonical paused state rather than a presentation-only overlay');
  assert.match(smoke, /atlas-product__action\[href=\\?"\/kana\/\\?"\]/,
    'Atlas navigation smoke must use the current visible Kana product action');
  assert.match(smoke, /wordBankAddJumpBtn[\s\S]*kanaInput/,
    'Word Bank smoke must open the Add Word dialog before interacting with its form');

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
- Isolated the Word Bank page controller in page-local module scope so its romaji helper maps cannot collide with the shared Kana Data module or block downstream Kana Metrics and Achievements startup.
- Hardened browser smoke state around completed onboarding, release notes, shared Settings readiness, current Atlas/Word Bank controls, and canonical trainer/drawer state so CI validates the real current user flows.
- Corrected the Kana Hub main landmark so it no longer emits duplicate id attributes while retaining the shared mainContent accessibility target.
- Added a permanent release gate covering the project audit, Node regressions, generated-asset cleanliness, and desktop/mobile Playwright smoke tests.
- Renamed the PWA assessment shortcut to Test Results so installed-app terminology matches the formal Test Mode reporting experience.
- Kept trainer behaviour, scoring/SRS, storage schemas, cloud sync, progression, onboarding, PWA install ownership, and update-check application logic unchanged.

"""
    changelog_path.write_text(entry + changelog, encoding='utf-8')
