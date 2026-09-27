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


test('Capacitor iOS shell is repository-owned and versioned from Mode Atlas release metadata', () => {
  const config = JSON.parse(read('capacitor.config.json'));
  const project = read('ios/App/App.xcodeproj/project.pbxproj');
  const sync = read('sync_ios_project.py');
  assert.equal(config.appId, 'app.modeatlas');
  assert.equal(config.appName, 'Mode Atlas');
  assert.equal(config.webDir, '.build/ios-web');
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER = app\.modeatlas;/);
  assert.match(project, /MARKETING_VERSION = 2\.54\.0;/);
  assert.match(project, /CURRENT_PROJECT_VERSION = 2054000;/);
  assert.match(sync, /Mode Atlas' canonical version owner/);
  assert.match(sync, /major \* 1_000_000 \+ minor \* 1_000 \+ patch/);
});

test('generated native web payload stays out of source control', () => {
  const rootIgnore = read('.gitignore');
  const iosIgnore = read('ios/.gitignore');
  assert.match(rootIgnore, /\.build\//);
  assert.match(rootIgnore, /ios\/App\/App\/public\//);
  assert.match(iosIgnore, /App\/App\/public/);
  assert.ok(fs.existsSync(path.join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj')));
  assert.equal(fs.existsSync(path.join(ROOT, 'ios/App/App/public')), false);
});
