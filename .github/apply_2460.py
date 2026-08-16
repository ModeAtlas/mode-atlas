from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def write(rel, text):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def replace_once(rel, old, new):
    text = read(rel)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{rel}: expected exactly one occurrence, found {count}: {old[:120]!r}')
    write(rel, text.replace(old, new, 1))


def regex_replace_once(rel, pattern, replacement, flags=0):
    text = read(rel)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{rel}: expected one regex replacement, found {count}: {pattern[:120]!r}')
    write(rel, updated)


# Release metadata.
replace_once(
    'assets/app/mode-atlas-version.js',
    "var VERSION = '2.45.0';\n  var CACHE_REVISION = 'assets-2.45.0';",
    "var VERSION = '2.46.0';\n  var CACHE_REVISION = 'assets-2.46.0';"
)

# Release notes: restore the missing 2.45 entry and document the production-readiness pass.
changelog = read('CHANGELOG.md')
if not changelog.startswith('## 2.46.0'):
    release_notes = '''## 2.46.0 - 2026-08-16
- Split Firebase startup so App/Auth still restore returning accounts immediately while Firestore loads only when an authenticated cloud operation actually needs it; signed-out visitors no longer download Firestore on every page.
- Replaced the always-loaded developer console JavaScript/CSS with a small eligibility loader that loads the full diagnostics only on localhost or for the developer account.
- Kept lazy developer assets revisioned and build-owned so production diagnostics remain cache-safe without adding unmanaged runtime files.
- Removed stray macOS metadata from the repository and added regression/audit guards for the new production dependency boundaries.
- Preserved auth restoration, cloud hydration/merge ownership, save schemas, PWA/update behaviour, trainer scoring/SRS, Test Results, Atlas Level, and achievement calculations.

## 2.45.0 - 2026-08-16
- Added a shared keyboard bypass link and stable main-content landmarks across the real application pages.
- Converted trainer Records, Mastery, Practice Setup, and mastery heatmap interactions to native keyboard-operable controls with shared ARIA state ownership.
- Improved shared dialog focus semantics and modal drawer scroll locking while retaining existing Escape/focus-return behaviour.
- Raised compact interactive touch targets on coarse-pointer devices without inflating passive pills, badges, or desktop-only presentation.
- Kept reduced-motion, focus-visible, trainer/scoring/progression/storage/cloud/PWA behaviour under their existing owners and added focused accessibility regression coverage.

'''
    write('CHANGELOG.md', release_notes + changelog)

# Production frontend manifest: lazy-load the developer console instead of shipping it to every learner.
replace_once(
    'frontend_components.py',
    "INTERACTIVE_CHROME_STYLES = (\n    'assets/css/mode-atlas-dev-console.css',\n    'assets/css/mode-atlas-app-modals.css',",
    "INTERACTIVE_CHROME_STYLES = (\n    'assets/css/mode-atlas-app-modals.css',"
)
replace_once(
    'frontend_components.py',
    "    'assets/app/mode-atlas-dev-console.js',\n    'assets/app/mode-atlas-pwa.js',",
    "    'assets/app/mode-atlas-dev-console-loader.js',\n    'assets/app/mode-atlas-pwa.js',"
)

# The revision builder owns lazy assets as well as directly referenced HTML assets.
replace_once(
    'build_revision_assets.py',
    "CRITICAL = {\n    'mode-atlas-version.js',\n    'mode-atlas-legacy-sw-retirement.js',\n    'mode-atlas-version-check.js',\n    'mode-atlas-head-bootstrap.js',\n    'mode-atlas-early-loader.js',\n}\n",
    "CRITICAL = {\n    'mode-atlas-version.js',\n    'mode-atlas-legacy-sw-retirement.js',\n    'mode-atlas-version-check.js',\n    'mode-atlas-head-bootstrap.js',\n    'mode-atlas-early-loader.js',\n}\nLAZY_ASSETS = (\n    'assets/app/mode-atlas-dev-console.js',\n    'assets/css/mode-atlas-dev-console.css',\n)\n"
)
replace_once(
    'build_revision_assets.py',
    "for html_path, canonical, fingerprinted in referenced:\n    src = (html_path.parent / canonical).resolve()\n    dst = (html_path.parent / fingerprinted).resolve()\n    try:\n        src.relative_to(ROOT)\n        dst.relative_to(ROOT)\n    except ValueError:\n        raise SystemExit(f'Asset path escapes project root: {html_path} -> {canonical}')\n    if not src.exists():\n        raise SystemExit(f'Missing canonical asset: {html_path.relative_to(ROOT)} -> {canonical}')\n    dst.parent.mkdir(parents=True, exist_ok=True)\n    shutil.copy2(src, dst)\n\nprint(f'Built revisioned JS/CSS assets for {REVISION}.')",
    "for html_path, canonical, fingerprinted in referenced:\n    src = (html_path.parent / canonical).resolve()\n    dst = (html_path.parent / fingerprinted).resolve()\n    try:\n        src.relative_to(ROOT)\n        dst.relative_to(ROOT)\n    except ValueError:\n        raise SystemExit(f'Asset path escapes project root: {html_path} -> {canonical}')\n    if not src.exists():\n        raise SystemExit(f'Missing canonical asset: {html_path.relative_to(ROOT)} -> {canonical}')\n    dst.parent.mkdir(parents=True, exist_ok=True)\n    shutil.copy2(src, dst)\n\n# Some production-only features are loaded on demand rather than referenced by\n# static HTML. They still receive the same release fingerprint and source-equality\n# guarantees as manifest assets.\nfor lazy_rel in LAZY_ASSETS:\n    src = (ROOT / lazy_rel).resolve()\n    try:\n        src.relative_to(ROOT)\n    except ValueError:\n        raise SystemExit(f'Lazy asset escapes project root: {lazy_rel}')\n    if not src.exists():\n        raise SystemExit(f'Missing canonical lazy asset: {lazy_rel}')\n    dst = src.with_name(src.stem + '.' + REVISION + src.suffix)\n    dst.parent.mkdir(parents=True, exist_ok=True)\n    shutil.copy2(src, dst)\n\nprint(f'Built revisioned JS/CSS assets for {REVISION}.')"
)

# Small production gate for developer diagnostics. It derives the lazy asset suffix
# from its own source URL, so canonical local development and revisioned production
# builds both load the matching console files.
write('assets/app/mode-atlas-dev-console-loader.js', r'''(function ModeAtlasDevConsoleLoader(root){
  'use strict';
  if (root.ModeAtlasDevConsoleLoader) return;

  const DEV_EMAIL = 'admin@mode-atlas.com';
  const loaderScript = document.currentScript;
  const loaderUrl = loaderScript?.src || new URL('/assets/app/mode-atlas-dev-console-loader.js', location.href).href;
  const versionMatch = loaderUrl.match(/mode-atlas-dev-console-loader(\.assets-\d+\.\d+\.\d+)?\.js(?:[?#].*)?$/i);
  const suffix = versionMatch?.[1] || '';
  const consoleScriptUrl = new URL(`mode-atlas-dev-console${suffix}.js`, loaderUrl).href;
  const consoleStyleUrl = new URL(`../css/mode-atlas-dev-console${suffix}.css`, loaderUrl).href;
  let loadPromise = null;

  function isLocalDevHost(){
    try {
      return !!root.ModeAtlasEnv?.isLocalhost || /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname || '');
    } catch { return false; }
  }

  function currentUserEmail(){
    try {
      const user = root.KanaCloudSync?.getUser?.() || root.currentUser || null;
      return String(user?.email || '').trim().toLowerCase();
    } catch { return ''; }
  }

  function isEligible(){
    return isLocalDevHost() || currentUserEmail() === DEV_EMAIL;
  }

  function ensureStyle(){
    if (document.querySelector('link[data-ma-dev-console-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = consoleStyleUrl;
    link.dataset.maDevConsoleStyle = '';
    document.head.appendChild(link);
  }

  function loadIfEligible(){
    if (root.ModeAtlasDevConsole) return Promise.resolve(true);
    if (!isEligible()) return Promise.resolve(false);
    if (loadPromise) return loadPromise;

    ensureStyle();
    loadPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-ma-dev-console-script]');
      if (existing) {
        existing.addEventListener('load', () => resolve(!!root.ModeAtlasDevConsole), { once:true });
        existing.addEventListener('error', () => { loadPromise = null; resolve(false); }, { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = consoleScriptUrl;
      script.defer = true;
      script.dataset.maDevConsoleScript = '';
      script.addEventListener('load', () => resolve(!!root.ModeAtlasDevConsole), { once:true });
      script.addEventListener('error', () => {
        loadPromise = null;
        console.warn('Mode Atlas developer diagnostics could not be loaded.');
        resolve(false);
      }, { once:true });
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  root.ModeAtlasDevConsoleLoader = Object.freeze({ isEligible, loadIfEligible });

  if (isLocalDevHost()) void loadIfEligible();
  root.addEventListener('kanaCloudSyncStatusChanged', () => { if (isEligible()) void loadIfEligible(); });
})(window);
''')

# Cloud startup: keep Auth eager for session restoration, but make Firestore demand-driven.
cloud = read('cloud-sync.js')
cloud_top_pattern = r"let initializeApp, getApps, getApp;.*?\nasync function loadFirebaseModules\(\) \{.*?\n\}\n\nconst CONFIG"
cloud_top_replacement = r'''let initializeApp, getApps, getApp;
let getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged;
let getFirestore, doc, getDoc, setDoc;
let firebaseModulesPromise = null;
let firebaseModulesLoaded = false;
let firestoreModulePromise = null;
let firestoreModuleLoaded = false;

function firebaseEnvironmentAllowsModules() {
  if (window.ModeAtlasEnv && window.ModeAtlasEnv.canUseFirebase === false) return false;
  if (location.protocol === 'file:') return false;
  return true;
}

async function loadFirestoreModule() {
  if (!firebaseEnvironmentAllowsModules()) return false;
  if (firestoreModuleLoaded) return true;
  // Backend tests and local harnesses may inject the Firestore API through the
  // core loader. Treat an already-complete API surface as loaded rather than
  // issuing a real network import.
  if ([getFirestore, doc, getDoc, setDoc].every((fn) => typeof fn === 'function')) {
    firestoreModuleLoaded = true;
    return true;
  }
  if (firestoreModulePromise) return firestoreModulePromise;

  const attempt = import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js')
    .then((firestoreMod) => {
      getFirestore = firestoreMod.getFirestore;
      doc = firestoreMod.doc;
      getDoc = firestoreMod.getDoc;
      setDoc = firestoreMod.setDoc;
      return true;
    })
    .catch((error) => {
      console.warn('Firebase Firestore module could not be loaded.', error);
      return false;
    });

  firestoreModulePromise = (async () => {
    try {
      const loaded = await attempt;
      firestoreModuleLoaded = loaded === true;
      return loaded;
    } finally {
      firestoreModulePromise = null;
    }
  })();
  return firestoreModulePromise;
}

async function ensureFirestore() {
  if (db) return true;
  if (!app) {
    const setupReady = await setupFirebase();
    if (!setupReady || !app) return false;
  }
  const loaded = await loadFirestoreModule();
  if (!loaded || typeof getFirestore !== 'function') return false;
  if (!db) db = getFirestore(app);
  return !!db;
}

async function loadFirebaseModules() {
  if (!firebaseEnvironmentAllowsModules()) return false;
  if (firebaseModulesLoaded) return true;
  if (firebaseModulesPromise) return firebaseModulesPromise;

  const attempt = Promise.all([
    import('https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js')
  ]).then(([appMod, authMod]) => {
    initializeApp = appMod.initializeApp;
    getApps = appMod.getApps;
    getApp = appMod.getApp;
    getAuth = authMod.getAuth;
    GoogleAuthProvider = authMod.GoogleAuthProvider;
    signInWithPopup = authMod.signInWithPopup;
    signInWithRedirect = authMod.signInWithRedirect;
    getRedirectResult = authMod.getRedirectResult;
    signOut = authMod.signOut;
    onAuthStateChanged = authMod.onAuthStateChanged;
    return true;
  }).catch((error) => {
    console.warn('Firebase App/Auth modules could not be loaded.', error);
    return false;
  });

  firebaseModulesPromise = (async () => {
    try {
      const loaded = await attempt;
      firebaseModulesLoaded = loaded === true;
      return loaded;
    } finally {
      firebaseModulesPromise = null;
    }
  })();
  return firebaseModulesPromise;
}

const CONFIG'''
updated, count = re.subn(cloud_top_pattern, cloud_top_replacement, cloud, count=1, flags=re.S)
if count != 1:
    raise RuntimeError(f'cloud-sync.js: failed to replace Firebase loader block ({count})')
cloud = updated

old = '  if (app && auth && db && authListenerInstalled) return true;'
if cloud.count(old) != 1:
    raise RuntimeError('cloud-sync.js: setupFirebase ownership guard drifted')
cloud = cloud.replace(old, '  if (app && auth && authListenerInstalled) return true;', 1)

old = '      db = getFirestore(app);\n'
if cloud.count(old) != 1:
    raise RuntimeError('cloud-sync.js: expected one eager Firestore initialization')
cloud = cloud.replace(old, '', 1)

old = '        if (user && db) {'
if cloud.count(old) != 1:
    raise RuntimeError('cloud-sync.js: auth hydration condition drifted')
cloud = cloud.replace(old, '        if (user) {', 1)

old = '  if (!CONFIG_READY || !currentUser || !db) return false;'
if cloud.count(old) != 2:
    raise RuntimeError(f'cloud-sync.js: expected two cloud-operation db guards, found {cloud.count(old)}')
cloud = cloud.replace(old, "  if (!CONFIG_READY || !currentUser) return false;\n  if (!await ensureFirestore()) return false;")

old = "    const importUid = currentUser?.uid || null;\n    if (CONFIG_READY && importUid && db && (typeof navigator === 'undefined' || navigator.onLine !== false)) {"
new = "    const importUid = currentUser?.uid || null;\n    const firestoreReady = importUid ? await ensureFirestore() : false;\n    if (CONFIG_READY && importUid && firestoreReady && (typeof navigator === 'undefined' || navigator.onLine !== false)) {"
if cloud.count(old) != 1:
    raise RuntimeError('cloud-sync.js: import Firestore guard drifted')
cloud = cloud.replace(old, new, 1)

old = "    const resetUid = currentUser?.uid || null;\n    if (CONFIG_READY && resetUid && db) {"
new = "    const resetUid = currentUser?.uid || null;\n    const firestoreReady = resetUid ? await ensureFirestore() : false;\n    if (CONFIG_READY && resetUid && firestoreReady) {"
if cloud.count(old) != 1:
    raise RuntimeError('cloud-sync.js: reset Firestore guard drifted')
cloud = cloud.replace(old, new, 1)
write('cloud-sync.js', cloud)

# Production audit owns the new dependency boundaries.
audit = read('audit_project.py')
old = '''    for marker in (
        "firebaseModulesLoaded = loaded === true;",
        "firebaseModulesPromise = null;",
        "firebaseSetupPromise = null;",
        "const joinedExistingSetup = !!firebaseSetupPromise;",
        "if (!ready && joinedExistingSetup",
        "authListenerInstalled",
    ):
        if marker not in cloud:
            fail(errors, f"Firebase setup is missing retry/recovery marker: {marker}")
'''
new = '''    for marker in (
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
    core_loader = re.search(r"async function loadFirebaseModules\\(\\) \\{(?P<body>.*?)\\n\\}", cloud, re.S)
    firestore_loader = re.search(r"async function loadFirestoreModule\\(\\) \\{(?P<body>.*?)\\n\\}", cloud, re.S)
    if not core_loader or 'firebase-firestore.js' in core_loader.group('body'):
        fail(errors, 'Firebase core startup still eagerly imports Firestore')
    if not firestore_loader or 'firebase-firestore.js' not in firestore_loader.group('body'):
        fail(errors, 'Firestore no longer has a dedicated lazy module owner')
    setup_firebase = re.search(r"async function setupFirebase\\(\\) \\{(?P<body>.*?)\\n\\}\\n\\nfunction getDocRef", cloud, re.S)
    if setup_firebase and 'db = getFirestore(app)' in setup_firebase.group('body'):
        fail(errors, 'Firebase auth startup still eagerly initializes Firestore')
'''
if audit.count(old) != 1:
    raise RuntimeError('audit_project.py: Firebase audit block drifted')
audit = audit.replace(old, new, 1)

insert_marker = "    # Public page dependency stacks and the early loader are build-time owned.\n"
production_block = '''    # Production-only diagnostics are lazy: normal learners load only the small
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

'''
if production_block not in audit:
    if insert_marker not in audit:
        raise RuntimeError('audit_project.py: dependency audit insertion marker missing')
    audit = audit.replace(insert_marker, production_block + insert_marker, 1)
write('audit_project.py', audit)

# Backend regression guard for the remote-module split.
backend = read('tests/backend.test.js')
backend_test = r'''

test('2.46 Firebase startup restores Auth eagerly but defers Firestore until cloud data is needed', () => {
  const coreStart = CLOUD_SYNC_SOURCE.indexOf('async function loadFirebaseModules() {');
  const coreEnd = CLOUD_SYNC_SOURCE.indexOf('\n}\n\nconst CONFIG', coreStart) + 2;
  assert.ok(coreStart >= 0 && coreEnd > coreStart, 'core Firebase loader should remain a distinct patchable owner');
  const coreLoader = CLOUD_SYNC_SOURCE.slice(coreStart, coreEnd);
  assert.match(coreLoader, /firebase-app\.js/);
  assert.match(coreLoader, /firebase-auth\.js/);
  assert.doesNotMatch(coreLoader, /firebase-firestore\.js/, 'signed-out startup must not fetch Firestore');

  const firestoreStart = CLOUD_SYNC_SOURCE.indexOf('async function loadFirestoreModule() {');
  const firestoreEnd = CLOUD_SYNC_SOURCE.indexOf('\n}\n\nasync function ensureFirestore()', firestoreStart) + 2;
  assert.ok(firestoreStart >= 0 && firestoreEnd > firestoreStart, 'Firestore should have one lazy module loader');
  const firestoreLoader = CLOUD_SYNC_SOURCE.slice(firestoreStart, firestoreEnd);
  assert.match(firestoreLoader, /firebase-firestore\.js/);
  assert.match(CLOUD_SYNC_SOURCE, /async function ensureFirestore\(\)/);
  assert.equal((CLOUD_SYNC_SOURCE.match(/if \(!await ensureFirestore\(\)\) return false;/g) || []).length, 2);

  const setupStart = CLOUD_SYNC_SOURCE.indexOf('async function setupFirebase() {');
  const setupEnd = CLOUD_SYNC_SOURCE.indexOf('\n}\n\nfunction getDocRef', setupStart) + 2;
  const setup = CLOUD_SYNC_SOURCE.slice(setupStart, setupEnd);
  assert.doesNotMatch(setup, /db\s*=\s*getFirestore\(app\)/, 'Auth restoration must not instantiate Firestore for guests');
  assert.match(setup, /if \(user\) \{\s*initialHydrationPromise = hydrateFromCloud\(false\)\.catch/s);
});
'''
if "test('2.46 Firebase startup restores Auth eagerly" not in backend:
    backend += backend_test
write('tests/backend.test.js', backend)

# Frontend/build regression guard for lazy diagnostics.
frontend_tests = read('tests/frontend.test.js')
frontend_test = r'''

test('2.46 production boot keeps developer diagnostics lazy and revision-build owned', () => {
  const frontend = read('frontend_components.py');
  const builder = read('build_revision_assets.py');
  const loader = read('assets/app/mode-atlas-dev-console-loader.js');
  const version = read('assets/app/mode-atlas-version.js');
  const revision = (version.match(/CACHE_REVISION\s*=\s*['\"]([^'\"]+)/) || [])[1];

  assert.match(frontend, /assets\/app\/mode-atlas-dev-console-loader\.js/);
  assert.doesNotMatch(frontend, /['\"]assets\/app\/mode-atlas-dev-console\.js['\"]/);
  assert.doesNotMatch(frontend, /['\"]assets\/css\/mode-atlas-dev-console\.css['\"]/);
  assert.match(builder, /LAZY_ASSETS/);
  assert.match(builder, /assets\/app\/mode-atlas-dev-console\.js/);
  assert.match(builder, /assets\/css\/mode-atlas-dev-console\.css/);
  assert.match(loader, /document\.currentScript/);
  assert.match(loader, /kanaCloudSyncStatusChanged/);
  assert.match(loader, /admin@mode-atlas\.com/);
  assert.match(loader, /loadIfEligible/);

  for (const page of ['index.html','kana/index.html','reading/index.html','writing/index.html','results/index.html','wordbank/index.html']) {
    const html = read(page);
    assert.match(html, new RegExp(`mode-atlas-dev-console-loader\\.${revision}\\.js`));
    assert.doesNotMatch(html, new RegExp(`mode-atlas-dev-console\\.${revision}\\.js`));
    assert.doesNotMatch(html, new RegExp(`mode-atlas-dev-console\\.${revision}\\.css`));
  }
});
'''
if "test('2.46 production boot keeps developer diagnostics lazy" not in frontend_tests:
    frontend_tests += frontend_test
write('tests/frontend.test.js', frontend_tests)

# Repository hygiene: Finder metadata is not a production asset.
ds_store = ROOT / '.DS_Store'
if ds_store.exists():
    ds_store.unlink()

print('Applied Mode Atlas 2.46.0 performance and production-readiness source changes')
