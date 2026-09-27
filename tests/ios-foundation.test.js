const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('iOS foundation has one platform facade with web and native adapters', () => {
  const facade = read('assets/platform/mode-atlas-platform.js');
  const web = read('assets/platform/mode-atlas-platform-web.js');
  const native = read('assets/platform/mode-atlas-platform-native.js');
  for (const method of ['getAppVersion', 'openExternalLink', 'openDestination', 'requestNotifications', 'setBadge', 'publishWidgetSnapshot']) {
    assert.match(facade, new RegExp(method));
  }
  assert.match(web, /registerAdapter\('web'/);
  assert.match(native, /registerAdapter\('ios'/);
  assert.match(native, /Plugins\.ModeAtlasNative/);
  assert.doesNotMatch(native, /SRS|mastery calculation|question selection/i);
});

test('native runtime disables browser-only update and install ownership', () => {
  const head = read('assets/app/mode-atlas-head-bootstrap.js');
  const versions = read('assets/app/mode-atlas-version-check.js');
  const pwa = read('assets/app/mode-atlas-pwa.js');
  assert.match(head, /isNativeApp/);
  assert.match(head, /isNativeApp\s*:\s*isNativeApp/);
  assert.match(head, /!isNativeApp/);
  assert.match(versions, /isNativeRuntime/);
  assert.match(versions, /native-bundle/);
  assert.match(pwa, /ModeAtlasEnv\?\.isNativeApp/);
});

test('shared build manifest loads platform facade and adapters once in the head', () => {
  const frontend = read('frontend_components.py');
  const facade = frontend.indexOf('assets/platform/mode-atlas-platform.js');
  const web = frontend.indexOf('assets/platform/mode-atlas-platform-web.js');
  const native = frontend.indexOf('assets/platform/mode-atlas-platform-native.js');
  assert.ok(facade >= 0 && web > facade && native > web);
});

test('iOS web bundle builder excludes web transport/runtime duplication', () => {
  const builder = read('build_ios_web.py');
  assert.match(builder, /PAGE_DIRS/);
  assert.match(builder, /is_revisioned_runtime_asset/);
  assert.match(builder, /sw\.js/);
  assert.match(builder, /site\.webmanifest/);
  assert.match(builder, /mode-atlas-native-manifest\.json/);
  assert.match(builder, /Canonical JS\/CSS leaked into iOS bundle/);
});
