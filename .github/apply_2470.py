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

manifest_path = ROOT / 'site.webmanifest'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
for shortcut in manifest.get('shortcuts', []):
    if shortcut.get('url') == '/results/':
        shortcut['name'] = 'Test Results'
        shortcut['short_name'] = 'Test Results'
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

smoke_path = ROOT / 'tests/smoke.spec.js'
smoke = smoke_path.read_text(encoding='utf-8')
old = """      await page.evaluate(() => window.ModeAtlasSettings?.open?.());
      const updateButton = page.locator('#maCheckUpdatesBtn');
      const updateStatus = page.locator('#maUpdateStatus');
"""
new = """      const settingsButton = page.locator('[data-settings-open]').first();
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

  const manifest = JSON.parse(read('site.webmanifest'));
  const resultsShortcut = (manifest.shortcuts || []).find((shortcut) => shortcut.url === '/results/');
  assert.ok(resultsShortcut, 'PWA manifest must keep the Test Results shortcut');
  assert.equal(resultsShortcut.name, 'Test Results');
  assert.equal(resultsShortcut.short_name, 'Test Results');

  const smoke = read('tests/smoke.spec.js');
  assert.doesNotMatch(smoke, /window\.ModeAtlasSettings\?\.open/,
    'browser smoke must open Settings through the real user control');
  assert.match(smoke, /toHaveAttribute\('data-settings-bound', 'shared'/,
    'browser smoke must wait for shared Settings binding readiness');

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
- Made the Settings update-check browser smoke test wait for the shared drawer binding and open Settings through the real visible control rather than an optional internal API.
- Added a permanent release gate covering the project audit, Node regressions, generated-asset cleanliness, and desktop/mobile Playwright smoke tests.
- Renamed the PWA assessment shortcut to Test Results so installed-app terminology matches the formal Test Mode reporting experience.
- Kept trainer behaviour, scoring/SRS, storage schemas, cloud sync, progression, onboarding, PWA install ownership, and update-check application logic unchanged.

"""
    changelog_path.write_text(entry + changelog, encoding='utf-8')
