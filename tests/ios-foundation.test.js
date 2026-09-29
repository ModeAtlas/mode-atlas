const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('iOS foundation has one platform facade with web and native adapters', () => {
  const facade = read('assets/platform/mode-atlas-platform.js');
  const web = read('assets/platform/mode-atlas-platform-web.js');
  const native = read('assets/platform/mode-atlas-platform-native.js');
  for (const method of ['getAppVersion', 'openExternalLink', 'openDestination', 'requestNotifications', 'setBadge', 'publishWidgetSnapshot', 'authenticate', 'revokeAppleAuthorization', 'signOutIdentityProvider']) {
    assert.match(facade, new RegExp(method));
  }
  assert.match(web, /registerAdapter\('web'/);
  assert.match(native, /registerAdapter\('ios'/);
  assert.match(native, /plugins\.ModeAtlasNative/);
  assert.match(native, /plugins\.FirebaseAuthentication/);
  assert.match(native, /plugins\.App/);
  assert.match(native, /appUrlOpen/);
  assert.match(native, /getLaunchUrl/);
  assert.match(native, /firebaseAuth\[method\]\(\{ skipNativeAuth:true \}\)/);
  assert.match(native, /providerId === 'apple\.com' \? 'signInWithApple' : 'signInWithGoogle'/);
  assert.match(native, /firebaseAuth\.revokeAccessToken\(\{ token:authorizationCode \}\)/);
  assert.doesNotMatch(native, /question selection|mastery calculation/i);
});

test('platform facade forwards Apple revocation code to its native adapter', async () => {
  const calls = [];
  const window = {};
  vm.runInNewContext(read('assets/platform/mode-atlas-platform.js'), { window, URL, Promise });
  window.AtlasPlatform.registerAdapter('ios', {
    revokeAppleAuthorization: async (code) => { calls.push(code); return true; }
  });
  assert.equal(await window.AtlasPlatform.revokeAppleAuthorization('fresh-code'), true);
  assert.deepEqual(calls, ['fresh-code']);
});

test('Personal Team build hides and rejects Apple sign-in even when its plugin method exists', async () => {
  let appleCalls = 0;
  const window = {
    ModeAtlasEnv: { isNativeApp:true },
    Capacitor: { Plugins: { FirebaseAuthentication: {
      signInWithGoogle: async () => ({}),
      signInWithApple: async () => { appleCalls += 1; }
    } } }
  };
  const context = vm.createContext({ window, URL, Promise });
  vm.runInContext(read('assets/platform/mode-atlas-platform.js'), context);
  vm.runInContext(read('assets/platform/mode-atlas-platform-native.js'), context);
  assert.deepEqual(Array.from(window.AtlasPlatform.getCapabilities().authProviders), ['google.com']);
  assert.equal((await window.AtlasPlatform.authenticate('apple.com')).handled, false);
  assert.equal(appleCalls, 0);
});

test('native runtime disables browser-only update and install ownership', () => {
  const head = read('assets/app/mode-atlas-head-bootstrap.js');
  const versions = read('assets/app/mode-atlas-version-check.js');
  const pwa = read('assets/app/mode-atlas-pwa.js');
  assert.match(head, /isNativeApp/);
  assert.match(head, /isNativeApp\s*:\s*isNativeApp/);
  assert.match(head, /firebaseAuthTransport/);
  assert.match(head, /native-provider-web-session/);
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
  const version = JSON.parse(read('package.json')).version;
  const [major, minor, patch] = version.split('.').map(Number);
  assert.ok(project.includes(`MARKETING_VERSION = ${version};`));
  assert.ok(project.includes(`CURRENT_PROJECT_VERSION = ${major * 1_000_000 + minor * 1_000 + patch};`));
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
  assert.equal(spawnSync('git', ['check-ignore', '-q', 'ios/App/App/public/index.html'], { cwd:ROOT }).status, 0);
});


test('native auth transport keeps Firebase JS as the single session and Firestore owner', () => {
  const cloud = read('cloud-sync.js');
  const config = JSON.parse(read('capacitor.config.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['@capacitor-firebase/authentication'], '8.5.2');
  assert.equal(pkg.dependencies['@capacitor/app'], '8.0.1');
  assert.equal(pkg.dependencies.firebase, '12.12.1');
  assert.equal(config.plugins.FirebaseAuthentication.skipNativeAuth, true);
  assert.deepEqual(config.plugins.FirebaseAuthentication.providers, ['google.com']);
  assert.deepEqual(config.experimental.ios.spm.packageTraits['@capacitor-firebase/authentication'], ['Google']);
  assert.match(cloud, /signInWithCredential/);
  assert.match(cloud, /AtlasPlatform\?\.authenticate\?\.\(providerId\)/);
  assert.match(cloud, /GoogleAuthProvider\.credential/);
  assert.match(cloud, /new OAuthProvider\('apple\.com'\)\.credential/);
  assert.match(cloud, /linkWithCredential\(user, credential\)/);
  assert.doesNotMatch(read('ios/App/App.xcodeproj/project.pbxproj'), /CODE_SIGN_ENTITLEMENTS|com\.apple\.SignInWithApple/);
  assert.match(read('assets/platform/mode-atlas-platform-native.js'), /var appleSignInEnabled = false/);
  assert.match(read('assets/platform/mode-atlas-platform-native.js'), /JS Auth session owns UID/);
  assert.doesNotMatch(cloud, /FirebaseAuthentication\.signInWithGoogle/);
});

test('provisioned iOS Google config is a bundled resource with a separate callback scheme', () => {
  const project = read('ios/App/App.xcodeproj/project.pbxproj');
  const info = read('ios/App/App/Info.plist');
  const scene = read('ios/App/App/SceneDelegate.swift');
  const sync = read('sync_ios_project.py');
  assert.match(project, /GoogleService-Info\.plist in Resources/);
  assert.match(project, /GOOGLE_REVERSED_CLIENT_ID = /);
  assert.match(info, /\$\(GOOGLE_REVERSED_CLIENT_ID\)/);
  assert.match(info, /<string>modeatlas<\/string>/);
  assert.match(scene, /GIDSignIn\.sharedInstance\.handle/);
  assert.match(sync, /validate_firebase\(require=True\)/);
  assert.ok(fs.existsSync(path.join(ROOT, 'ios/App/App/GoogleService-Info.plist')));
});

test('native destination router accepts only product links and consumes a launch once', async () => {
  const navigations = [];
  const memory = new Map();
  const context = {
    URL,
    Promise,
    console,
    sessionStorage: {
      getItem: key => memory.get(key) || null,
      setItem: (key, value) => memory.set(key, value)
    },
    location: {
      pathname: '/kana/', search: '',
      replace: path => navigations.push(['replace', path]),
      assign: path => navigations.push(['assign', path])
    }
  };
  let openUrl;
  let launchCount = 0;
  context.window = {
    ModeAtlasEnv: { isNativeApp: true },
    Capacitor: { Plugins: { App: {
      addListener: (_event, callback) => { openUrl = callback; },
      getLaunchUrl: async () => { launchCount++; return { url:'modeatlas://open/reading?mode=daily' }; }
    } } }
  };
  vm.createContext(context);
  vm.runInContext(read('assets/platform/mode-atlas-platform.js'), context);
  vm.runInContext(read('assets/platform/mode-atlas-platform-native.js'), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(navigations, [['replace', '/reading/?mode=daily']]);
  assert.equal(context.window.AtlasPlatform.destinationFromUrl('com.googleusercontent.apps.test:/oauth'), '');
  assert.equal(context.window.AtlasPlatform.destinationFromUrl('https://evil.example/reading/?mode=daily'), '');
  openUrl({ url:'modeatlas://open/reading?mode=review' });
  assert.deepEqual(navigations.at(-1), ['assign', '/reading/?mode=review']);
  vm.runInContext(read('assets/platform/mode-atlas-platform-native.js'), context);
  assert.equal(launchCount, 1);
});

test('native engagement snapshot excludes identity and permission requires an explicit action', async () => {
  const calls = [];
  let refresh;
  let granted = true;
  const window = {
    ModeAtlasEnv:{isNativeApp:true},
    ModeAtlasProgress:{getSummary:() => ({level:4,lifetimeCorrect:73,progress:.5,uid:'private',email:'private@example.com'})},
    ModeAtlasKanaMetrics:{kanaStats:() => ({streak:3,dailyDone:true})},
    AtlasPlatform:{
      getCapabilities:() => ({notifications:true,widgetSnapshots:true}),
      publishWidgetSnapshot:async value => calls.push(['snapshot',value]),
      requestNotifications:async () => { calls.push(['permission']); return {granted,status:'denied'}; },
      configureStudyReminder:async value => { calls.push(['reminder',value]); return value; }
    },
    addEventListener:() => {}
  };
  vm.runInNewContext(read('assets/platform/mode-atlas-native-engagement.js'), {
    window, document:{addEventListener:() => {}}, console,
    setTimeout:fn => {refresh=fn;return 1;},clearTimeout:() => {},Date
  });
  assert.equal(calls.length,0);
  await refresh();
  assert.equal(calls[0][0],'snapshot');
  assert.equal(calls[0][1].correct,73);
  assert.equal(calls[0][1].destination,'kana');
  assert.equal(JSON.stringify(calls).includes('private'),false);
  calls.length=0;
  await window.ModeAtlasNativeEngagement.configureReminder({enabled:false});
  assert.equal(calls.length,1);
  assert.equal(calls[0][0],'reminder');
  await assert.rejects(window.ModeAtlasNativeEngagement.configureReminder({enabled:true,hour:25}));
  assert.equal(calls.length,1);
  granted=false;
  const result=await window.ModeAtlasNativeEngagement.configureReminder({enabled:true,hour:18,minute:30});
  assert.equal(result.enabled,false);
  assert.equal(calls.length,2);
  granted=true;
  await window.ModeAtlasNativeEngagement.configureReminder({enabled:true,hour:18,minute:30});
  assert.equal(calls.at(-1)[1].hour,18);
  assert.equal(calls.at(-1)[1].minute,30);
});

test('native Settings omit browser display/install controls and keep repair with save actions', () => {
  function markup(native){
    const window={ModeAtlasEnv:{isNativeApp:native}};
    vm.runInNewContext(read('assets/ui/mode-atlas-settings-menu.js'),{window});
    return window.ModeAtlasSettingsMenu.markup({href:value=>value});
  }
  const native=markup(true), web=markup(false);
  assert.doesNotMatch(native,/ma-display-panel|data-ma-install/);
  assert.match(web,/ma-display-panel/);
  assert.match(web,/data-ma-install/);
  for(const html of [native,web]){
    assert.equal((html.match(/data-ma-repair-data/g)||[]).length,1);
    assert.match(html,/data-ma-unified-import[\s\S]*?data-ma-repair-data[\s\S]*?<\/div>\s*<input type="file"/);
    assert.doesNotMatch(html,/>Repair save data<\/div>/);
  }
});
