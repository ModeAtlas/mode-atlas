const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CLOUD_SYNC_SOURCE = fs.readFileSync(path.join(ROOT, 'cloud-sync.js'), 'utf8');
const STORAGE_SOURCE = fs.readFileSync(path.join(ROOT, 'assets/app/mode-atlas-storage.js'), 'utf8');
const KANA_DATA_SOURCE = fs.readFileSync(path.join(ROOT, 'assets/data/mode-atlas-kana-data.js'), 'utf8');
const SAVE_REPAIR_SOURCE = fs.readFileSync(path.join(ROOT, 'assets/app/mode-atlas-save-repair.js'), 'utf8');
const TRAINER_CORE_SOURCE = fs.readFileSync(path.join(ROOT, 'assets/trainer/mode-atlas-trainer-core.js'), 'utf8');
const VERSION_SOURCE = fs.readFileSync(path.join(ROOT, 'assets/app/mode-atlas-version.js'), 'utf8');
const APP_VERSION = (VERSION_SOURCE.match(/var\s+VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1];
const APP_REVISION = (VERSION_SOURCE.match(/var\s+CACHE_REVISION\s*=\s*['"]([^'"]+)['"]/) || [])[1];

class StorageMock {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { key = String(key); return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
  clear() { this.map.clear(); }
}

class EventTargetMock {
  constructor() { this.listeners = new Map(); this.events = []; }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  dispatchEvent(event) {
    this.events.push(event);
    for (const listener of this.listeners.get(event.type) || []) listener.call(this, event);
    return true;
  }
}

class CustomEventMock {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
}

class ButtonMock {
  constructor() { this.hidden = false; this.counts = {}; }
  addEventListener(type) { this.counts[type] = (this.counts[type] || 0) + 1; }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

function createBaseContext({ configured = false } = {}) {
  const window = new EventTargetMock();
  const localStorage = new StorageMock();
  const sessionStorage = new StorageMock();
  window.ModeAtlasEnv = { canUseFirebase: configured };
  window.ModeAtlasStorage = undefined;
  window.KANA_FIREBASE_CONFIG = configured ? { apiKey: 'x', projectId: 'p', appId: 'a' } : null;
  window.ModeAtlasSessionCloudPause = false;

  const context = {
    window,
    self: window,
    localStorage,
    sessionStorage,
    navigator: { onLine: true },
    location: { protocol: configured ? 'https:' : 'http:', origin: configured ? 'https://mode-atlas.app' : 'http://localhost:8010' },
    console,
    CustomEvent: CustomEventMock,
    alert() {},
    setTimeout,
    clearTimeout,
    Date,
    Promise,
    JSON,
    Object,
    Array,
    Set,
    WeakSet,
    Map,
    Number,
    String,
  };
  vm.createContext(context);
  return { context, window, localStorage, sessionStorage };
}

function patchFirebaseLoader(source) {
  const start = source.indexOf('async function loadFirebaseModules() {');
  const end = source.indexOf('\n}\n\nconst CONFIG', start) + 2;
  assert.ok(start >= 0 && end > start, 'Firebase loader block should be patchable for backend tests');
  const replacement = `async function loadFirebaseModules() {
    const m = __mocks;
    initializeApp=m.initializeApp; getApps=m.getApps; getApp=m.getApp;
    getAuth=m.getAuth; initializeAuth=m.initializeAuth; browserLocalPersistence=m.browserLocalPersistence;
    GoogleAuthProvider=m.GoogleAuthProvider; OAuthProvider=m.OAuthProvider;
    signInWithCredential=m.signInWithCredential; linkWithCredential=m.linkWithCredential;
    reauthenticateWithCredential=m.reauthenticateWithCredential; reauthenticateWithPopup=m.reauthenticateWithPopup;
    signInWithPopup=m.signInWithPopup;
    signInWithRedirect=m.signInWithRedirect; getRedirectResult=m.getRedirectResult; signOut=m.signOut;
    onAuthStateChanged=m.onAuthStateChanged; getFirestore=m.getFirestore; doc=m.doc; getDoc=m.getDoc; setDoc=m.setDoc;
    return true;
  }`;
  return source.slice(0, start) + replacement + source.slice(end);
}

function patchFirebaseLoaderWithTransientFailure(source) {
  const start = source.indexOf('async function loadFirebaseModules() {');
  const end = source.indexOf('\n}\n\nconst CONFIG', start) + 2;
  assert.ok(start >= 0 && end > start, 'Firebase loader block should be patchable for retry tests');
  const replacement = `async function loadFirebaseModules() {
    __firebaseLoadAttempts.count += 1;
    if (__firebaseLoadAttempts.count === 1) return false;
    const m = __mocks;
    initializeApp=m.initializeApp; getApps=m.getApps; getApp=m.getApp;
    getAuth=m.getAuth; initializeAuth=m.initializeAuth; browserLocalPersistence=m.browserLocalPersistence;
    GoogleAuthProvider=m.GoogleAuthProvider; signInWithCredential=m.signInWithCredential; signInWithPopup=m.signInWithPopup;
    signInWithRedirect=m.signInWithRedirect; getRedirectResult=m.getRedirectResult; signOut=m.signOut;
    onAuthStateChanged=m.onAuthStateChanged; getFirestore=m.getFirestore; doc=m.doc; getDoc=m.getDoc; setDoc=m.setDoc;
    return true;
  }`;
  return source.slice(0, start) + replacement + source.slice(end);
}

function remoteReading(label, correct, updatedAt) {
  return {
    sections: {
      reading: {
        updatedAt,
        data: {
          highScore: String(correct),
          settings: {},
          stats: { [label]: { correct, wrong: 0 } },
          times: {},
          srs: {},
          scoreHistory: {},
          dailyChallengeHistory: {},
        },
      },
    },
  };
}



test('Mode Atlas storage boundary protects unrelated origin data', async () => {
  const { context, window, localStorage, sessionStorage } = createBaseContext({ configured: false });
  window.ModeAtlasSaveSchemaVersion = 3;
  vm.runInContext(STORAGE_SOURCE, context, { filename: 'mode-atlas-storage.js' });
  const store = window.ModeAtlasStorage;

  localStorage.setItem('settings', JSON.stringify({ hiraganaRows: ['h_a'] }));
  localStorage.setItem('modeAtlasThemePreference', 'light');
  localStorage.setItem('modeAtlasLocalSaveOwner', 'account-a');
  localStorage.setItem('modeAtlasAccountSave:account-b', 'private cached progress');
  localStorage.setItem('modeAtlasWidgetSuspended', '1');
  localStorage.setItem(`modeAtlasVersionFileCheckedResetDay:${APP_REVISION}`, '2026-08-13');
  localStorage.setItem('firebase:authUser:test', 'firebase-owned');
  localStorage.setItem('thirdPartyPreference', 'keep-me');
  sessionStorage.setItem('modeAtlasSafeMode', '1');
  sessionStorage.setItem('modeAtlasTourPending', '1');
  sessionStorage.setItem('thirdPartySession', 'keep-session');

  const backup = store.snapshotBackupStorage(localStorage);
  assert.equal(backup.settings, JSON.stringify({ hiraganaRows: ['h_a'] }));
  assert.equal(backup.modeAtlasThemePreference, 'light');
  assert.equal(backup[`modeAtlasVersionFileCheckedResetDay:${APP_REVISION}`], undefined, 'runtime update flags must not enter backups');
  assert.equal(backup['firebase:authUser:test'], undefined);
  assert.equal(backup.thirdPartyPreference, undefined);
  assert.equal(backup['modeAtlasAccountSave:account-b'], undefined, 'other account caches must not enter backups');
  assert.equal(backup.modeAtlasLocalSaveOwner, undefined);

  const filtered = store.filterAppMap({
    settings: JSON.stringify({ katakanaRows: ['k_a'] }),
    modeAtlasThemePreference: 'dark',
    modeAtlasMadeUpFutureKey: 'must-not-import',
    thirdPartyPreference: 'must-not-import',
  });
  assert.deepEqual(Object.keys(filtered).sort(), ['modeAtlasThemePreference', 'settings']);
  const imported = store.applyAppMap({
    settings: JSON.stringify({ katakanaRows: ['k_a'] }),
    modeAtlasThemePreference: 'dark',
    modeAtlasMadeUpFutureKey: 'must-not-import',
    thirdPartyPreference: 'must-not-import',
  });
  assert.deepEqual([...imported].sort(), ['modeAtlasThemePreference', 'settings']);
  assert.equal(localStorage.getItem('modeAtlasMadeUpFutureKey'), null);
  assert.equal(localStorage.getItem('thirdPartyPreference'), 'keep-me');

  const cleared = store.clearAppData();
  assert.ok(cleared.local.includes('settings'));
  assert.ok(cleared.local.some((key) => key.startsWith('modeAtlasVersionFileCheckedResetDay:')));
  assert.equal(localStorage.getItem('settings'), null);
  assert.equal(localStorage.getItem('modeAtlasThemePreference'), null);
  assert.equal(localStorage.getItem('modeAtlasLocalSaveOwner'), null);
  assert.equal(localStorage.getItem('modeAtlasAccountSave:account-b'), null);
  assert.equal(localStorage.getItem('modeAtlasWidgetSuspended'), null);
  assert.equal(localStorage.getItem(`modeAtlasVersionFileCheckedResetDay:${APP_REVISION}`), null);
  assert.equal(localStorage.getItem('firebase:authUser:test'), 'firebase-owned');
  assert.equal(localStorage.getItem('thirdPartyPreference'), 'keep-me');
  assert.equal(sessionStorage.getItem('modeAtlasSafeMode'), null);
  assert.equal(sessionStorage.getItem('modeAtlasTourPending'), null);
  assert.equal(sessionStorage.getItem('thirdPartySession'), 'keep-session');

  // Cloud Reset must use the same scoped boundary rather than clearing the origin.
  localStorage.setItem('charStats', JSON.stringify({ 'あ': { correct: 1, wrong: 0 } }));
  localStorage.setItem('thirdPartyPreference', 'still-here');
  sessionStorage.setItem('modeAtlasSafeMode', '1');
  sessionStorage.setItem('thirdPartySession', 'still-here-too');
  vm.runInContext(CLOUD_SYNC_SOURCE, context, { filename: 'cloud-sync.js' });
  await window.KanaCloudSync.ready;
  await window.KanaCloudSync.resetAllData();
  assert.equal(localStorage.getItem('charStats'), null);
  assert.equal(sessionStorage.getItem('modeAtlasSafeMode'), null);
  assert.equal(localStorage.getItem('thirdPartyPreference'), 'still-here');
  assert.equal(sessionStorage.getItem('thirdPartySession'), 'still-here-too');
});
test('cloud-sync falls back to localStorage and bindUi is idempotent', async () => {
  const { context, window, localStorage } = createBaseContext({ configured: false });
  localStorage.setItem('charStats', JSON.stringify({ 'あ': { correct: 3, wrong: 1 } }));
  localStorage.setItem('settings', JSON.stringify({ hiraganaRows: ['h_a'] }));

  vm.runInContext(CLOUD_SYNC_SOURCE, context, { filename: 'cloud-sync.js' });
  await window.KanaCloudSync.ready;

  const snapshot = window.KanaCloudSync.debugLocalSnapshot();
  assert.equal(snapshot.sections.reading.data.stats['あ'].correct, 3);

  const signInBtn = new ButtonMock();
  const signOutBtn = new ButtonMock();
  const options = {
    signInBtn,
    signOutBtn,
    nameEl: { textContent: '' },
    emailEl: { textContent: '' },
    photoEl: { hidden: false, removeAttribute() {}, alt: '', src: '' },
  };
  const first = window.KanaCloudSync.bindUi(options);
  const second = window.KanaCloudSync.bindUi(options);
  assert.equal(first, second);
  assert.equal(signInBtn.counts.click, 1);
  assert.equal(signOutBtn.counts.click, 1);
});

test('native Google credential creates a persistent JS session and updates Profile', async () => {
  const { context, window } = createBaseContext({ configured: true });
  window.ModeAtlasEnv.isNativeApp = true;
  window.AtlasPlatform = { authenticate: async () => ({ handled: true, credential: { idToken: 'google-token' } }) };
  let authCallback;
  let persistence;
  const auth = { currentUser: null };
  const user = { uid: 'native-user', email: 'learner@example.com' };
  context.__mocks = {
    initializeApp: () => ({}), getApps: () => [], getApp: () => ({}),
    getAuth: () => { throw Error('native setup must not use browser defaults'); },
    initializeAuth: (_app, dependencies) => { persistence = dependencies.persistence; return auth; },
    browserLocalPersistence: { type: 'LOCAL' },
    GoogleAuthProvider: class { setCustomParameters() {} static credential(token) { return { token }; } },
    signInWithCredential: async (_auth, credential) => {
      assert.equal(credential.token, 'google-token');
      auth.currentUser = user;
      authCallback(user);
      return { user };
    },
    signInWithPopup: async () => {}, signInWithRedirect: async () => {}, getRedirectResult: async () => null,
    signOut: async () => {}, onAuthStateChanged: (_auth, callback) => { authCallback = callback; callback(null); },
    getFirestore: () => ({}), doc: (_db, ...parts) => parts.join('/'),
    getDoc: async () => ({ exists: () => false }), setDoc: async () => {}
  };
  const source = patchFirebaseLoader(CLOUD_SYNC_SOURCE);
  vm.runInContext(source, context, { filename: 'cloud-sync.js' });
  await window.KanaCloudSync.ready;
  const emailEl = { textContent: '' };
  window.KanaCloudSync.bindUi({ emailEl });
  assert.equal(await window.KanaCloudSync.signInWithGoogle(), true);
  assert.equal(persistence.type, 'LOCAL');
  assert.equal(window.KanaCloudSync.getUser().uid, 'native-user');
  assert.equal(emailEl.textContent, user.email);
});

test('Apple links to the current Firebase UID and revokes authorization on account deletion', async () => {
  const { context, window, localStorage } = createBaseContext({ configured: true });
  window.ModeAtlasEnv.isNativeApp = true;
  window.ModeAtlasStorage = { clearAppData: () => localStorage.clear() };
  let approve = false;
  window.ModeAtlasFeedback = { confirm: async () => approve, alert: async () => {}, toast: () => {} };
  const user = { uid: 'shared-uid', providerData: [{ providerId:'google.com' }] };
  const auth = { currentUser: user };
  const calls = [];
  let socialFailure = true;
  let switchDuringRevoke=false;
  window.ModeAtlasSocial = { deleteAccount: async (uid) => { assert.equal(uid,user.uid);calls.push('server'); if(socialFailure)throw new Error('Deletion unavailable'); return {deleted:true}; }, accountDeletionStatus: async(uid)=>{assert.equal(uid,user.uid);return {deleted:false};} };
  window.AtlasPlatform = {
    authenticate: async (providerId) => {
      assert.equal(providerId, 'apple.com');
      return { handled:true, credential:{ idToken:'apple-token', nonce:'raw-nonce', authorizationCode:'apple-code' } };
    },
    revokeAppleAuthorization: async (code) => { calls.push('revoke:' + code);if(switchDuringRevoke)auth.currentUser={uid:'another-account'};return true; },
    signOutIdentityProvider: async () => true
  };
  context.__mocks = {
    initializeApp: () => ({}), getApps: () => [], getApp: () => ({}),
    initializeAuth: () => auth, browserLocalPersistence: {},
    GoogleAuthProvider: class { setCustomParameters() {} },
    OAuthProvider: class { constructor(id) { assert.equal(id, 'apple.com'); } credential(value) { return value; } },
    onAuthStateChanged: (_auth, callback) => { callback(user); },
    linkWithCredential: async (target, credential) => {
      assert.equal(target.uid, 'shared-uid');
      assert.equal(credential.rawNonce, 'raw-nonce');
      user.providerData.push({providerId:'apple.com'});
      calls.push('link');
    },
    reauthenticateWithCredential: async (target, credential) => {
      assert.equal(target.uid, 'shared-uid');
      assert.equal(credential.idToken, 'apple-token');
      calls.push('reauth');
    },
    deleteUser: async (target) => { assert.equal(target.uid, 'shared-uid'); calls.push('user'); },
    signOut: async () => {}, getRedirectResult: async () => null,
    getFirestore: () => ({}), doc: (_db, ...parts) => parts.join('/'),
    getDoc: async () => ({ exists: () => true, data: () => ({sections:{}}) }),
    setDoc: async () => { calls.push('restore'); },
    deleteDoc: async () => { calls.push('document'); }
  };
  vm.runInContext(patchFirebaseLoader(CLOUD_SYNC_SOURCE), context, { filename:'cloud-sync.js' });
  await window.KanaCloudSync.ready;
  assert.equal(await window.KanaCloudSync.linkNativeProvider('apple.com'), false);
  assert.equal(await window.KanaCloudSync.deleteAccount(), false);
  assert.deepEqual(calls, [], 'Cancelling must not contact the provider or delete data');
  approve = true;
  assert.equal(await window.KanaCloudSync.linkNativeProvider('apple.com'), true);
  assert.equal(auth.currentUser.uid, 'shared-uid');
  localStorage.setItem('modeAtlasOnboardingComplete', 'true');
  assert.equal(await window.KanaCloudSync.deleteAccount(), false, 'Server deletion failure must retain the device save');
  assert.deepEqual(calls, ['link','reauth','revoke:apple-code','server']);
  assert.equal(localStorage.getItem('modeAtlasOnboardingComplete'), 'true');
  calls.length=0;switchDuringRevoke=true;
  assert.equal(await window.KanaCloudSync.deleteAccount(),false);
  assert.deepEqual(calls,['reauth','revoke:apple-code'],'an account change during revocation must not reach server deletion');
  assert.equal(localStorage.getItem('modeAtlasOnboardingComplete'),'true');
  switchDuringRevoke=false;auth.currentUser=user;
  calls.length=0;socialFailure=false;
  const deletion = window.KanaCloudSync.deleteAccount();
  assert.equal(await window.KanaCloudSync.deleteAccount(), false, 'Repeated tap must not queue a second deletion');
  assert.equal(await deletion, true);
  assert.deepEqual(calls, ['reauth','revoke:apple-code','server']);
  assert.equal(localStorage.getItem('modeAtlasOnboardingComplete'), null);
});

test('cloud-sync discards stale-account hydration and serializes sync bursts', async () => {
  const { context, window, localStorage } = createBaseContext({ configured: true });
  let authCallback = null;
  const reads = new Map();
  let activeWrites = 0;
  let maxActiveWrites = 0;
  let writeCount = 0;

  context.__mocks = {
    initializeApp: () => ({ app: true }),
    getApps: () => [],
    getApp: () => ({ app: true }),
    getAuth: () => ({ auth: true }),
    GoogleAuthProvider: class { setCustomParameters() {} },
    signInWithPopup: async () => {},
    signInWithRedirect: async () => {},
    getRedirectResult: async () => null,
    signOut: async () => {},
    onAuthStateChanged: (_auth, callback) => { authCallback = callback; return () => {}; },
    getFirestore: () => ({ db: true }),
    doc: (_db, ...parts) => parts.join('/'),
    getDoc: async (ref) => {
      const uid = ref.split('/')[1];
      const pending = reads.get(uid);
      const data = pending ? await pending : null;
      return { exists: () => !!data, data: () => data };
    },
    setDoc: async () => {
      writeCount += 1;
      activeWrites += 1;
      maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
      await delay(15);
      activeWrites -= 1;
    },
  };

  vm.runInContext(patchFirebaseLoader(CLOUD_SYNC_SOURCE), context, { filename: 'cloud-sync.js' });
  for (let i = 0; i < 50 && !authCallback; i += 1) await delay(1);
  assert.equal(typeof authCallback, 'function');

  const userARead = deferred();
  const userBRead = deferred();
  reads.set('A', userARead.promise);
  reads.set('B', userBRead.promise);

  authCallback({ uid: 'A', displayName: 'A' });
  await delay(0);
  authCallback({ uid: 'B', displayName: 'B' });
  await delay(0);

  userBRead.resolve(remoteReading('び', 7, 200));
  assert.equal(await window.KanaCloudSync.waitForInitialHydration(), true);
  await delay(5);
  userARead.resolve(remoteReading('あ', 99, 300));
  await delay(20);

  const stats = JSON.parse(localStorage.getItem('charStats') || '{}');
  assert.equal(stats['あ'], undefined, 'stale user A data must never apply after account switch');
  assert.equal(stats['び'].correct, 7, 'current user B data should hydrate');
  assert.ok(window.events.some((event) => event.type === 'modeAtlasCloudDataChanged'));

  reads.set('B', Promise.resolve(remoteReading('び', 7, 200)));
  writeCount = 0;
  activeWrites = 0;
  maxActiveWrites = 0;
  await Promise.all(Array.from({ length: 20 }, () => window.KanaCloudSync.syncNow()));
  assert.equal(maxActiveWrites, 1, 'Firestore writes must be serialized');
  assert.ok(writeCount <= 2, `burst should coalesce to current + one follow-up write, got ${writeCount}`);
});



test('in-flight cloud sync preserves local section changes made while Firestore read is pending', async () => {
  const { context, window, localStorage } = createBaseContext({ configured: true });
  let authCallback = null;
  let syncRead = null;
  let latestWrite = null;
  let getDocCount = 0;

  context.__mocks = {
    initializeApp: () => ({ app: true }),
    getApps: () => [],
    getApp: () => ({ app: true }),
    getAuth: () => ({ auth: true }),
    GoogleAuthProvider: class { setCustomParameters() {} },
    signInWithPopup: async () => {},
    signInWithRedirect: async () => {},
    getRedirectResult: async () => null,
    signOut: async () => {},
    onAuthStateChanged: (_auth, callback) => { authCallback = callback; return () => {}; },
    getFirestore: () => ({ db: true }),
    doc: (_db, ...parts) => parts.join('/'),
    getDoc: async () => {
      getDocCount += 1;
      if (getDocCount === 1) return { exists: () => false, data: () => null };
      const data = await syncRead.promise;
      return { exists: () => true, data: () => data };
    },
    setDoc: async (_ref, payload) => { latestWrite = payload; },
  };

  vm.runInContext(STORAGE_SOURCE, context, { filename: 'mode-atlas-storage.js' });
  vm.runInContext(patchFirebaseLoader(CLOUD_SYNC_SOURCE), context, { filename: 'cloud-sync.js' });
  for (let i = 0; i < 50 && !authCallback; i += 1) await delay(1);
  assert.equal(typeof authCallback, 'function');

  authCallback({ uid: 'A', displayName: 'A' });
  assert.equal(await window.KanaCloudSync.waitForInitialHydration(), true);

  // Existing local state when sync starts.
  localStorage.setItem('kanaWordBank', JSON.stringify([{ id: 'old', kana: 'いぬ', english: 'dog', notes: '', favorite: false }]));
  localStorage.setItem('kanaWordBankUpdatedAt', '300');

  syncRead = deferred();
  const pendingSync = window.KanaCloudSync.syncNow();
  await delay(0);

  // User changes Word Bank while the Firestore read is still pending.
  const newestLocal = [{ id: 'new', kana: 'ねこ', english: 'cat', notes: '', favorite: false }];
  localStorage.setItem('kanaWordBank', JSON.stringify(newestLocal));
  localStorage.setItem('kanaWordBankUpdatedAt', '500');

  syncRead.resolve({
    sections: {
      wordBank: {
        updatedAt: 400,
        data: { items: [{ id: 'remote', kana: 'とり', english: 'bird', notes: '', favorite: false }] },
      },
    },
  });

  assert.equal(await pendingSync, true);
  assert.deepEqual(JSON.parse(localStorage.getItem('kanaWordBank')), newestLocal,
    'remote data older than the live local edit must not overwrite the new Word Bank entry');
  assert.deepEqual(latestWrite.sections.wordBank.data.items, newestLocal,
    'the Firestore write must use the live local section, not the stale snapshot captured before getDoc');
  assert.equal(Number(latestWrite.sections.wordBank.updatedAt), 500);
});

test('initial cloud hydration preserves local section changes made while Firestore read is pending', async () => {
  const { context, window, localStorage } = createBaseContext({ configured: true });
  let authCallback = null;
  const hydrationRead = deferred();
  let latestWrite = null;

  context.__mocks = {
    initializeApp: () => ({ app: true }),
    getApps: () => [],
    getApp: () => ({ app: true }),
    getAuth: () => ({ auth: true }),
    GoogleAuthProvider: class { setCustomParameters() {} },
    signInWithPopup: async () => {},
    signInWithRedirect: async () => {},
    getRedirectResult: async () => null,
    signOut: async () => {},
    onAuthStateChanged: (_auth, callback) => { authCallback = callback; return () => {}; },
    getFirestore: () => ({ db: true }),
    doc: (_db, ...parts) => parts.join('/'),
    getDoc: async () => {
      const data = await hydrationRead.promise;
      return { exists: () => true, data: () => data };
    },
    setDoc: async (_ref, payload) => { latestWrite = payload; },
  };

  vm.runInContext(STORAGE_SOURCE, context, { filename: 'mode-atlas-storage.js' });
  vm.runInContext(patchFirebaseLoader(CLOUD_SYNC_SOURCE), context, { filename: 'cloud-sync.js' });
  for (let i = 0; i < 50 && !authCallback; i += 1) await delay(1);
  assert.equal(typeof authCallback, 'function');

  // Local state that exists when hydration begins.
  localStorage.setItem('kanaWordBank', JSON.stringify([{ id: 'old-local', kana: 'いぬ' }]));
  localStorage.setItem('kanaWordBankUpdatedAt', '100');
  authCallback({ uid: 'A', displayName: 'A' });
  await delay(0);

  // User adds a word while the initial cloud restore is still waiting on Firestore.
  const newestLocal = [{ id: 'new-local', kana: 'ねこ', romaji: 'neko', english: 'cat', notes: '', favorite: false }];
  localStorage.setItem('kanaWordBank', JSON.stringify(newestLocal));
  localStorage.setItem('kanaWordBankUpdatedAt', '200');

  hydrationRead.resolve({
    sections: {
      wordBank: {
        // Deliberately newer than the local clock: a user edit made after the
        // hydration began must still win this particular merge.
        updatedAt: 999,
        data: { items: [{ id: 'remote-old-content', kana: 'とり', english: 'bird' }] },
      },
    },
  });

  assert.equal(await window.KanaCloudSync.waitForInitialHydration(), true);
  assert.deepEqual(JSON.parse(localStorage.getItem('kanaWordBank')), newestLocal,
    'initial hydration must not overwrite a local section changed after the read began');
  assert.ok(Number(localStorage.getItem('kanaWordBankUpdatedAt')) > 999,
    'the preserved local section must receive a logical clock newer than the conflicting remote snapshot');

  // The preserved local section should be queued back to cloud.
  await delay(300);
  assert.ok(latestWrite, 'preserved local data should be scheduled for cloud sync');
  assert.deepEqual(latestWrite.sections.wordBank.data.items, newestLocal);
});

test('Firebase setup retries after a transient initial module failure', async () => {
  const { context, window } = createBaseContext({ configured: true });
  let authCallback = null;
  context.__firebaseLoadAttempts = { count: 0 };
  context.__mocks = {
    initializeApp: () => ({ app: true }),
    getApps: () => [],
    getApp: () => ({ app: true }),
    getAuth: () => ({ auth: true }),
    GoogleAuthProvider: class { setCustomParameters() {} },
    signInWithPopup: async () => {},
    signInWithRedirect: async () => {},
    getRedirectResult: async () => null,
    signOut: async () => {},
    onAuthStateChanged: (_auth, callback) => { authCallback = callback; return () => {}; },
    getFirestore: () => ({ db: true }),
    doc: (_db, ...parts) => parts.join('/'),
    getDoc: async () => ({ exists: () => false, data: () => null }),
    setDoc: async () => {},
  };

  vm.runInContext(patchFirebaseLoaderWithTransientFailure(CLOUD_SYNC_SOURCE), context, { filename: 'cloud-sync.js' });
  for (let i = 0; i < 30 && context.__firebaseLoadAttempts.count < 1; i += 1) await delay(1);
  assert.equal(context.__firebaseLoadAttempts.count, 1, 'initial Firebase setup should attempt module loading once');
  assert.equal(authCallback, null, 'failed first setup must not install a partial auth listener');

  window.dispatchEvent({ type: 'online' });
  for (let i = 0; i < 50 && !authCallback; i += 1) await delay(1);
  assert.equal(context.__firebaseLoadAttempts.count, 2, 'online recovery should retry the failed Firebase setup');
  assert.equal(typeof authCallback, 'function', 'retry should complete Firebase auth setup without a page reload');
});

test('save repair runs schema migration once and only syncs when data changes', () => {
  const window = new EventTargetMock();
  const localStorage = new StorageMock();
  let scheduledSyncs = 0;
  const document = new EventTargetMock();
  document.readyState = 'complete';
  document.querySelectorAll = () => [];

  const repairToasts = [];
  window.ModeAtlasSaveSchemaVersion = 3;
  window.ModeAtlas = {};
  window.ModeAtlasFeedback = { toast(message) { repairToasts.push(String(message)); } };
  window.KanaCloudSync = { scheduleSync() { scheduledSyncs += 1; return true; } };
  window.ModeAtlasStorage = {
    KEYS: {},
    SAVE_SCHEMA_VERSION: 3,
    SCHEMA_VERSION: 3,
    get(key, fallback = '') { const value = localStorage.getItem(key); return value == null ? fallback : value; },
    set(key, value) { localStorage.setItem(key, value); return true; },
    json(key, fallback) { const raw = localStorage.getItem(key); if (!raw) return fallback; try { return JSON.parse(raw); } catch { return fallback; } },
    setJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); return true; },
  };

  const context = { window, self: window, document, localStorage, CustomEvent: CustomEventMock, console, Date, JSON, Object, Array, Set, Number, String };
  vm.createContext(context);
  vm.runInContext(SAVE_REPAIR_SOURCE, context, { filename: 'mode-atlas-save-repair.js' });

  assert.equal(localStorage.getItem('modeAtlasSaveSchemaVersion'), '3', 'first run should mark the current save schema');
  assert.equal(scheduledSyncs, 0, 'schema metadata alone must not schedule Firestore sync');
  assert.equal((document.listeners.get('click') || []).length, 1, 'repair should have one delegated click owner');

  const duplicate = { id: 'same-result', mode: 'reading', correct: 10, wrong: 0 };
  localStorage.setItem('testModeResults', JSON.stringify([duplicate, duplicate]));
  let prevented = false;
  const dynamicRepairButton = { setAttribute() {} };
  document.dispatchEvent({
    type: 'click',
    target: { closest(selector) { return selector === '[data-ma-repair-data]' ? dynamicRepairButton : null; } },
    preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true, 'dynamically mounted repair button click should be handled');
  assert.equal(JSON.parse(localStorage.getItem('testModeResults')).length, 1, 'delegated Settings repair should run the integrity repair');
  assert.equal(scheduledSyncs, 1, 'delegated repair should schedule one sync only when it changed data');
  assert.match(repairToasts.at(-1) || '', /^Repair complete · /, 'delegated repair should give visible completion feedback');

  localStorage.setItem('testModeResults', JSON.stringify([duplicate, duplicate]));
  const result = window.ModeAtlas.repairDataModel({ sync: true });
  assert.ok(result.changed >= 1);
  assert.equal(JSON.parse(localStorage.getItem('testModeResults')).length, 1);
  assert.equal(scheduledSyncs, 2, 'a direct real repair should schedule exactly one additional cloud sync');

  const clean = window.ModeAtlas.repairDataModel({ sync: true });
  assert.equal(clean.changed, 0, 'a second clean repair should make no changes');
  assert.equal(scheduledSyncs, 2, 'a no-op repair must not schedule another cloud sync');

  localStorage.setItem('testModeResults', JSON.stringify([duplicate, duplicate]));
  window.dispatchEvent(new CustomEventMock('modeAtlasCloudDataChanged', { detail: { source: 'hydrate', sections: ['readingTests'] } }));
  assert.equal(JSON.parse(localStorage.getItem('testModeResults')).length, 1, 'newly hydrated legacy data should still receive integrity repair');
  assert.equal(scheduledSyncs, 3, 'a real post-hydration repair should sync its corrected data once');
});

test('document navigation uses loaded revision as a cache key without checking for updates', async () => {
  const source = fs.readFileSync(path.join(ROOT, 'assets/app/mode-atlas-version-check.js'), 'utf8');
  const listeners = new Map();
  let fetchCount = 0;
  let assigned = '';

  const document = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    querySelectorAll() { return []; },
  };
  const history = { state: null, replaceState() {} };
  const location = {
    href: 'https://mode-atlas.app/',
    origin: 'https://mode-atlas.app',
    pathname: '/',
    protocol: 'https:',
    search: '',
    hash: '',
    assign(url) { assigned = String(url); },
    replace(url) { assigned = String(url); },
  };
  const window = {
    ModeAtlasVersion: APP_VERSION,
    MODE_ATLAS_VERSION: APP_VERSION,
    ModeAtlasCacheRevision: APP_REVISION,
    MODE_ATLAS_CACHE_REVISION: APP_REVISION,
  };
  const context = {
    window,
    self: window,
    document,
    history,
    location,
    localStorage: new StorageMock(),
    sessionStorage: new StorageMock(),
    performance: { getEntriesByType() { return [{ type: 'navigate' }]; } },
    fetch: async () => { fetchCount += 1; throw new Error('navigation must not fetch the version file'); },
    AbortController,
    URL,
    Set,
    Date,
    Promise,
    Object,
    String,
    Number,
    setTimeout,
    clearTimeout,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'mode-atlas-version-check.js' });

  assert.equal(window.ModeAtlasVersionFile.appUrl('/kana/'), '/kana/');
  assert.equal(
    window.ModeAtlasVersionFile.documentRequestUrl('/kana/?starter=advanced'),
    `https://mode-atlas.app/kana/?starter=advanced&build=${APP_REVISION}`
  );
  assert.equal(fetchCount, 0, 'creating a document request URL must not run an update check');

  assert.equal(window.ModeAtlasVersionFile.installNavigationCacheGuard(), true);
  assert.equal(window.ModeAtlasVersionFile.installNavigationCacheGuard(), false, 'navigation guard must be single-owner');

  const anchor = {
    getAttribute(name) { if (name === 'href') return '/kana/'; if (name === 'target') return ''; return null; },
    hasAttribute() { return false; },
  };
  let prevented = false;
  listeners.get('click')({
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: { closest() { return anchor; } },
    preventDefault() { prevented = true; },
  });

  assert.equal(prevented, true);
  assert.equal(assigned, `https://mode-atlas.app/kana/?build=${APP_REVISION}`);
  assert.equal(fetchCount, 0, 'normal navigation must not call the deployed version file');
});


test('Kana metrics use one storage snapshot and local calendar dates', () => {
  const dateSource = fs.readFileSync(path.join(ROOT, 'assets/app/mode-atlas-date.js'), 'utf8');
  const metricsSource = fs.readFileSync(path.join(ROOT, 'assets/app/mode-atlas-kana-metrics.js'), 'utf8');
  const previousTz = process.env.TZ;
  process.env.TZ = 'Australia/Melbourne';

  try {
    const reads = new Map();
    const bump = (key) => reads.set(key, (reads.get(key) || 0) + 1);
    const modeData = {
      'reading:charStats': { 'あ': { correct: 12, wrong: 1 }, 'い': { correct: 2, wrong: 4 } },
      'writing:charStats': { 'あ': { correct: 8, wrong: 0 }, 'い': { correct: 1, wrong: 3 } },
      'reading:charTimes': { 'あ': { avg: 1200 }, 'い': { avg: 3100 } },
      'writing:charTimes': { 'あ': { avg: 800 }, 'い': { avg: 2900 } },
      'reading:dailyHistory': { '2026-08-12': { officialScore: 18 } },
      'writing:dailyHistory': { '2026-08-11': { officialScore: 17 } },
    };
    const resultData = {
      testModeResults: [{ id: 'r1', mode: 'reading' }],
      writingTestModeResults: [{ id: 'w1', mode: 'writing' }],
    };

    const window = {
      ModeAtlasStorage: {
        readModeJSON(mode, name, fallback) {
          const key = `${mode}:${name}`;
          bump(key);
          return modeData[key] ?? fallback;
        },
        readModeNumber(mode, name, fallback) {
          const key = `${mode}:${name}`;
          bump(key);
          return name === 'highScore' ? (mode === 'reading' ? 22 : 19) : fallback;
        },
        json(key, fallback) {
          bump(`json:${key}`);
          return resultData[key] ?? fallback;
        },
        number(_key, fallback) { return fallback; },
      },
    };
    const context = { window, self: window, location: { pathname: '/kana/' }, Date, Object, Array, Set, Number, String, JSON, console };
    vm.createContext(context);
    vm.runInContext(KANA_DATA_SOURCE, context, { filename: 'mode-atlas-kana-data.js' });
    vm.runInContext(dateSource, context, { filename: 'mode-atlas-date.js' });
    vm.runInContext(fs.readFileSync(path.join(ROOT,'assets/app/mode-atlas-review.js'),'utf8'), context);
    vm.runInContext(metricsSource, context, { filename: 'mode-atlas-kana-metrics.js' });

    const collections = window.ModeAtlasKanaData.collections;
    assert.equal(collections.hiragana.length, 46);
    assert.equal(collections.katakana.length, 46);
    assert.equal(collections.dakuten.length, 50);
    assert.equal(collections.yoon.length, 72);
    assert.equal(collections.extended.length, 26);
    assert.equal(collections.all.length, 240);
    assert.ok(collections.yoon.includes('ぢゃ') && collections.yoon.includes('ヂョ'));
    assert.ok(collections.extended.includes('ヴュ') && collections.extended.includes('ツォ'));

    const localBoundary = new Date('2026-08-11T15:30:00Z'); // 01:30 on Aug 12 in Melbourne.
    assert.equal(window.ModeAtlasDates.localDateKey(localBoundary), '2026-08-12');

    const metrics = window.ModeAtlasKanaMetrics;
    const snapshot = metrics.createSnapshot();
    const readsAfterSnapshot = new Map(reads);

    assert.equal(metrics.charCorrect('あ', snapshot), 20);
    assert.equal(metrics.charWrong('あ', snapshot), 1);
    assert.equal(metrics.charAvg('あ', snapshot), 1000);
    assert.equal(metrics.dailyDone(snapshot.readingDaily, window.ModeAtlasDates.localDateKey(localBoundary)), true);
    assert.equal(metrics.streak({ '2026-08-12': {}, '2026-08-11': {} }, localBoundary), 2);
    metrics.masteryCounts(['あ', 'い'], snapshot);
    metrics.bestWeak(['あ', 'い'], snapshot);
    metrics.kanaStats(snapshot);
    assert.deepEqual([...reads.entries()], [...readsAfterSnapshot.entries()], 'snapshot-backed calculations must not reread storage');

    for (const key of [
      'reading:charStats', 'writing:charStats', 'reading:charTimes', 'writing:charTimes',
      'reading:dailyHistory', 'writing:dailyHistory', 'reading:highScore', 'writing:highScore'
    ]) {
      assert.equal(reads.get(key), 1, `${key} should be read once per snapshot`);
    }
  } finally {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  }
});


test('release metadata is centralized and formal test dates use local calendar time', () => {
  const schema = Number((VERSION_SOURCE.match(/var\s+SAVE_SCHEMA_VERSION\s*=\s*(\d+)/) || [])[1]);
  const backup = Number((VERSION_SOURCE.match(/var\s+BACKUP_FORMAT_VERSION\s*=\s*(\d+)/) || [])[1]);
  const cloud = Number((VERSION_SOURCE.match(/var\s+CLOUD_SNAPSHOT_VERSION\s*=\s*(\d+)/) || [])[1]);
  const buildDate = (VERSION_SOURCE.match(/var\s+BUILD_DATE\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  assert.equal(schema, 3);
  assert.equal(backup, 2);
  assert.equal(cloud, 2);
  assert.match(buildDate, /^\d{4}-\d{2}-\d{2}$/);

  const window = { ModeAtlasDates: { localDateKey() { return '2099-12-31'; } } };
  const context = { window, self: window, document: {}, navigator: {}, alert() {}, Date, JSON, Object, Array, Number, String, console };
  vm.createContext(context);
  vm.runInContext(TRAINER_CORE_SOURCE, context, { filename: 'mode-atlas-trainer-core.js' });
  const result = window.ModeAtlasTrainerCore.buildTestResult({ mode: 'reading', total: 1, correct: 1 });
  assert.equal(result.date, '2099-12-31');
});


test('2.46 Firebase startup restores Auth eagerly but defers Firestore until cloud data is needed', () => {
  const coreStart = CLOUD_SYNC_SOURCE.indexOf('async function loadFirebaseModules() {');
  const coreEnd = CLOUD_SYNC_SOURCE.indexOf('\n}\n\nconst CONFIG', coreStart) + 2;
  assert.ok(coreStart >= 0 && coreEnd > coreStart, 'core Firebase loader should remain a distinct patchable owner');
  const coreLoader = CLOUD_SYNC_SOURCE.slice(coreStart, coreEnd);
  assert.match(coreLoader, /ModeAtlasFirebase\.load\('app'\)/);
  assert.match(coreLoader, /ModeAtlasFirebase\.load\('auth'\)/);
  assert.doesNotMatch(coreLoader, /ModeAtlasFirebase\.load\('firestore'\)/, 'signed-out startup must not fetch Firestore');

  const firestoreStart = CLOUD_SYNC_SOURCE.indexOf('async function loadFirestoreModule() {');
  const firestoreEnd = CLOUD_SYNC_SOURCE.indexOf('\n}\n\nasync function ensureFirestore()', firestoreStart) + 2;
  assert.ok(firestoreStart >= 0 && firestoreEnd > firestoreStart, 'Firestore should have one lazy module loader');
  const firestoreLoader = CLOUD_SYNC_SOURCE.slice(firestoreStart, firestoreEnd);
  assert.match(firestoreLoader, /ModeAtlasFirebase\.load\('firestore'\)/);
  assert.match(CLOUD_SYNC_SOURCE, /async function ensureFirestore\(\)/);
  assert.equal((CLOUD_SYNC_SOURCE.match(/if \(!await ensureFirestore\(\)\) return false;/g) || []).length, 2);

  const setupStart = CLOUD_SYNC_SOURCE.indexOf('async function setupFirebase() {');
  const setupEnd = CLOUD_SYNC_SOURCE.indexOf('\n}\n\nfunction getDocRef', setupStart) + 2;
  const setup = CLOUD_SYNC_SOURCE.slice(setupStart, setupEnd);
  assert.doesNotMatch(setup, /db\s*=\s*getFirestore\(app\)/, 'Auth restoration must not instantiate Firestore for guests');
  assert.match(setup, /if \(user\) \{\s*initialHydrationPromise = hydrateFromCloud\(false\)\.catch/s);
});

test('backup entry points reject normal users and recheck access after asynchronous setup', async () => {
  const {context,window,localStorage}=createBaseContext();
  vm.runInContext(STORAGE_SOURCE,context);
  vm.runInContext(CLOUD_SYNC_SOURCE,context);
  localStorage.setItem('charStats',JSON.stringify({'あ':{correct:3,wrong:0}}));
  const snapshot=localStorage.getItem('charStats');
  assert.throws(()=>window.KanaCloudSync.createBackup(),/Developer access/);
  assert.throws(()=>window.KanaCloudSync.previewLocalBackup({}),/Developer access/);
  await assert.rejects(window.KanaCloudSync.importLocalBackup({}),/Developer access/);
  let eligible=true;
  window.ModeAtlasDevConsoleLoader={isEligible:()=>eligible};
  const backup=window.KanaCloudSync.createBackup();
  const pending=window.KanaCloudSync.importLocalBackup(backup);
  eligible=false;
  await assert.rejects(pending,/Developer access/);
  assert.equal(localStorage.getItem('charStats'),snapshot);
});

test('outgoing sync merges independent rewards and recall evidence, and reset clears the entire v3 state', async () => {
  const {context,window,localStorage}=createBaseContext({configured:true});
  let authCallback,remote=null,latestWrite;
  context.__mocks={
    initializeApp:()=>({}),getApps:()=>[],getApp:()=>({}),getAuth:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},getRedirectResult:async()=>null,
    onAuthStateChanged:(_auth,callback)=>{authCallback=callback;},getFirestore:()=>({}),doc:(_db,...parts)=>parts.join('/'),
    getDoc:async()=>({exists:()=>!!remote,data:()=>remote}),setDoc:async(_ref,payload)=>{latestWrite=JSON.parse(JSON.stringify(payload));}
  };
  for(const file of ['assets/app/mode-atlas-storage.js','assets/app/mode-atlas-date.js','assets/app/mode-atlas-reward-rules.js','assets/app/mode-atlas-progress.js','assets/app/mode-atlas-review.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context);
  vm.runInContext(patchFirebaseLoader(CLOUD_SYNC_SOURCE),context);
  for(let i=0;i<50&&!authCallback;i++)await delay(1);
  authCallback({uid:'learner'});await window.KanaCloudSync.waitForInitialHydration();
  const makeState=(id,count)=>({version:3,legacySeeded:true,sources:{[id]:{'kana.reading.correct':count}},credits:{[id]:{answer:count}},claims:{'v3:mastery:reading:あ:2':10}});
  const review=window.ModeAtlasReview;
  const first=review.answer({}, {id:'a',at:Date.now()-86400000,correct:true}).entry;
  const second=review.answer({}, {id:'b',at:Date.now(),correct:true}).entry;
  localStorage.setItem('modeAtlasProgress',JSON.stringify(makeState('a',2)));
  localStorage.setItem('modeAtlasProgressUpdatedAt','100');
  localStorage.setItem('charSrs',JSON.stringify({'あ':first}));
  remote={sections:{progress:{updatedAt:200,data:{state:makeState('b',3)}},reading:{updatedAt:200,data:{srs:{'あ':second}}}}};
  assert.equal(await window.KanaCloudSync.syncNow(),true);
  assert.equal(window.ModeAtlasProgress.getXP(),20,'both devices count; the same mastery milestone is credited once');
  assert.equal(latestWrite.sections.progress.data.state.sources.a['kana.reading.correct'],2);
  assert.equal(latestWrite.sections.progress.data.state.sources.b['kana.reading.correct'],3);
  assert.equal(latestWrite.sections.reading.data.srs['あ'].recent.length,2);
  function firestoreSafe(value){
    if(Array.isArray(value)){assert.ok(!value.some(Array.isArray),'Firestore cannot store directly nested arrays');value.forEach(firestoreSafe);}
    else if(value&&typeof value==='object')Object.values(value).forEach(firestoreSafe);
  }
  firestoreSafe(latestWrite);
  remote=latestWrite;await window.KanaCloudSync.syncNow();assert.equal(window.ModeAtlasProgress.getXP(),20);
  // Restore a pre-v3 backup. New fields must be explicitly empty, not retained
  // by Firestore's merge behaviour from the save being replaced.
  window.ModeAtlasDevConsoleLoader={isEligible:()=>true};
  const backup=window.KanaCloudSync.createBackup();
  backup.snapshot.sections.progress.data.state={version:2,legacySeeded:true,sources:{old:{'kana.reading.correct':7}}};
  const restored=await window.KanaCloudSync.importLocalBackup(backup);
  assert.equal(restored.cloudSynced,true);assert.equal(window.ModeAtlasProgress.getXP(),7);
  assert.deepEqual(latestWrite.sections.progress.data.state.credits,{});
  assert.deepEqual(latestWrite.sections.progress.data.state.claims,{});
  await window.KanaCloudSync.resetAllData();
  for(const key of ['sources','events','adjustments','credits','claims','activity','runs'])assert.deepEqual(latestWrite.sections.progress.data.state[key],{});
});


test('account switches preserve offline saves without uploading one account into another',async()=>{
  const {context,window,localStorage}=createBaseContext({configured:true});
  vm.runInContext(STORAGE_SOURCE,context);
  let changed;const writes=[];
  context.__mocks={initializeApp:()=>({}),getApps:()=>[],getAuth:()=>({}),getRedirectResult:async()=>null,
    GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:(_auth,callback)=>{changed=callback;},
    getFirestore:()=>({}),doc:(_db,...parts)=>parts.join('/'),getDoc:async()=>({exists:()=>false}),setDoc:async(ref,data)=>writes.push({ref,data})};
  vm.runInContext(patchFirebaseLoader(CLOUD_SYNC_SOURCE),context);
  for(let i=0;i<50&&!changed;i++)await delay(1);
  // First sign-in adopts genuine guest work.
  localStorage.setItem('charStats',JSON.stringify({'あ':{correct:3,wrong:0}}));
  changed({uid:'save-A'});await window.KanaCloudSync.waitForInitialHydration();await window.KanaCloudSync.syncNow();
  assert.equal(writes.at(-1).data.sections.reading.data.stats['あ'].correct,3);
  context.navigator.onLine=false;
  localStorage.setItem('charStats',JSON.stringify({'あ':{correct:8,wrong:0}}));
  localStorage.setItem('kanaWordBank',JSON.stringify([{english:'private A note'}]));
  changed(null);changed({uid:'save-B'});await window.KanaCloudSync.waitForInitialHydration();
  assert.equal(localStorage.getItem('charStats'),null);
  assert.equal(localStorage.getItem('kanaWordBank'),null);
  localStorage.setItem('charStats',JSON.stringify({'い':{correct:2,wrong:0}}));
  context.navigator.onLine=true;await window.KanaCloudSync.syncNow();
  assert.equal(writes.at(-1).ref,'users/save-B/appData/kanaTrainer');
  assert.equal(writes.at(-1).data.sections.reading.data.stats['あ'],undefined);
  assert.ok(!JSON.stringify(writes.at(-1).data).includes('private A note'));
  context.navigator.onLine=false;changed({uid:'save-A'});await window.KanaCloudSync.waitForInitialHydration();
  assert.equal(JSON.parse(localStorage.getItem('charStats'))['あ'].correct,8,'unsynced A progress survives account switching');
  assert.match(localStorage.getItem('kanaWordBank'),/private A note/);
  assert.equal(window.KanaCloudSync.getSyncStatus().state,'offline');
  // A quota failure partway through restoring B leaves a recoverable journal,
  // preserves A's cache and never permits the partial B save to sync.
  const setItem=localStorage.setItem.bind(localStorage);
  localStorage.setItem=(key,value)=>{if(key==='charStats')throw new Error('Storage quota');setItem(key,value);};
  changed({uid:'save-B'});await window.KanaCloudSync.waitForInitialHydration();
  assert.equal(window.KanaCloudSync.getSyncStatus().state,'paused');
  assert.ok(localStorage.getItem('modeAtlasPracticeTransaction'));
  const previousWrites=writes.length;context.navigator.onLine=true;
  await window.KanaCloudSync.syncNow();assert.equal(writes.length,previousWrites);
  assert.equal(JSON.parse(localStorage.getItem('modeAtlasAccountSave:save-A')).snapshot.sections.reading.data.stats['あ'].correct,8);
  localStorage.setItem=setItem;
  vm.runInContext(STORAGE_SOURCE,context); // Reopening replays the existing journal.
  assert.equal(localStorage.getItem('modeAtlasPracticeTransaction'),null);
  changed({uid:'save-B'});await window.KanaCloudSync.waitForInitialHydration();await window.KanaCloudSync.syncNow();
  assert.equal(writes.at(-1).data.sections.reading.data.stats['い'].correct,2);
  assert.equal(writes.at(-1).data.sections.reading.data.stats['あ'],undefined);
});
