let initializeApp, getApps, getApp;
let getAuth, initializeAuth, browserLocalPersistence, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCredential, linkWithCredential, reauthenticateWithPopup, reauthenticateWithCredential, updateProfile, signOut, onAuthStateChanged;
let getFirestore, doc, getDoc, setDoc, runTransaction;
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
  if ([getFirestore, doc, getDoc, setDoc, runTransaction].every((fn) => typeof fn === 'function')) {
    firestoreModuleLoaded = true;
    return true;
  }
  if (firestoreModulePromise) return firestoreModulePromise;

  const attempt = window.ModeAtlasFirebase.load('firestore')
    .then((firestoreMod) => {
      getFirestore = firestoreMod.getFirestore;
      doc = firestoreMod.doc;
      getDoc = firestoreMod.getDoc;
      setDoc = firestoreMod.setDoc;
      runTransaction = firestoreMod.runTransaction;
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
  try {
    if (!app) {
      const setupReady = await setupFirebase();
      if (!setupReady || !app) return false;
    }
    const loaded = await loadFirestoreModule();
    if (!loaded || typeof getFirestore !== 'function') throw new Error('Cloud storage unavailable');
    if (!db) db = getFirestore(app);
    return !!db;
  } catch (error) {
    window.ModeAtlasDiagnostics?.record('cloud-sync',error);
    if (currentUser) setCloudState(false, 'Cloud storage could not be opened. Try again.');
    return false;
  }
}

async function loadFirebaseModules() {
  if (!firebaseEnvironmentAllowsModules()) return false;
  if (firebaseModulesLoaded) return true;
  if (firebaseModulesPromise) return firebaseModulesPromise;

  const attempt = Promise.all([
    window.ModeAtlasFirebase.load('app'),
    window.ModeAtlasFirebase.load('auth')
  ]).then(([appMod, authMod]) => {
    initializeApp = appMod.initializeApp;
    getApps = appMod.getApps;
    getApp = appMod.getApp;
    getAuth = authMod.getAuth;
    initializeAuth = authMod.initializeAuth;
    browserLocalPersistence = authMod.browserLocalPersistence;
    GoogleAuthProvider = authMod.GoogleAuthProvider;
    OAuthProvider = authMod.OAuthProvider;
    signInWithPopup = authMod.signInWithPopup;
    signInWithRedirect = authMod.signInWithRedirect;
    getRedirectResult = authMod.getRedirectResult;
    signInWithCredential = authMod.signInWithCredential;
    linkWithCredential = authMod.linkWithCredential;
    reauthenticateWithCredential = authMod.reauthenticateWithCredential;
    reauthenticateWithPopup = authMod.reauthenticateWithPopup;
    updateProfile = authMod.updateProfile;
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

const CONFIG = window.KANA_FIREBASE_CONFIG || null;
const CONFIG_READY = !!(CONFIG && CONFIG.apiKey && CONFIG.apiKey !== 'REPLACE_ME' && CONFIG.projectId && CONFIG.projectId !== 'REPLACE_ME' && CONFIG.appId && CONFIG.appId !== 'REPLACE_ME');
const DOC_PATH = ['users', null, 'appData', 'kanaTrainer'];
const LOCAL_IMPORT_GUARD_KEY = 'modeAtlasLocalImportGuardUntil';
const BACKUP_FORMAT_VERSION = Number(window.ModeAtlasBackupFormatVersion || 1);
const CLOUD_SNAPSHOT_VERSION = Number(window.ModeAtlasCloudSnapshotVersion || 1);
let provider = null;

const STORAGE = window.ModeAtlasStorage || {};
const STORAGE_KEYS = STORAGE.KEYS || {};
const STORAGE_COMPAT_KEYS = STORAGE.COMPAT_KEYS || {};
const keyOr = (name, fallback) => STORAGE_KEYS[name] || fallback;
const compatList = (name, fallback) => Array.isArray(STORAGE_COMPAT_KEYS[name]) ? STORAGE_COMPAT_KEYS[name] : fallback;

const SAVE_SECTIONS = window.ModeAtlasSaveSections;
const SECTION_DEFS = SAVE_SECTIONS.definitions;
const SECTION_TIMESTAMP_KEYS = SAVE_SECTIONS.timestamps;
const SECTION_EXTRA_TIMESTAMP_KEYS = SAVE_SECTIONS.extraTimestamps;

const READING_TEST_IMPORT_KEYS = compatList('readingTests', [
  keyOr('readingTestResults', 'testModeResults'),
  keyOr('readingTestResultsBackup', 'readingTestModeResults'),
  'kanaTrainerTestModeResults',
  'kanaTrainerReadingTestModeResults'
]);
const WRITING_TEST_IMPORT_KEYS = compatList('writingTests', [
  keyOr('writingTestResults', 'writingTestModeResults'),
  keyOr('writingTestResultsBackup', 'reverseTestModeResults'),
  'kanaTrainerWritingTestModeResults'
]);


function storeGet(key, fallback = '') {
  try {
    const store = window.ModeAtlasStorage;
    return store?.get?.(key, fallback) ?? localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function storeSet(key, value) {
  try {
    const store = window.ModeAtlasStorage;
    return store?.set?.(key, value) ?? localStorage.setItem(key, String(value));
  } catch {
    return false;
  }
}

function storeRemove(key) {
  try {
    const store = window.ModeAtlasStorage;
    return store?.remove?.(key) ?? localStorage.removeItem(key);
  } catch {
    return false;
  }
}

function storeJSON(key, fallback) {
  try {
    const store = window.ModeAtlasStorage;
    if (store?.json) return store.json(key, fallback);
    const raw = localStorage.getItem(key);
    if (raw == null || raw === '') return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function storeSetJSON(key, value) {
  try {
    const store = window.ModeAtlasStorage;
    if (store?.setJSON) return store.setJSON(key, value);
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function setSectionTimestampAliases(sectionName, updatedAt) {
  try {
    const ts = String(normalizeTimestamp(updatedAt) || Date.now());
    const primary = SECTION_TIMESTAMP_KEYS[sectionName];
    if (primary) storeSet(primary, ts);
    (SECTION_EXTRA_TIMESTAMP_KEYS[sectionName] || []).forEach((key) => { if (!storeGet(key, '')) storeSet(key, ts); });
    const meta = readJSON('modeAtlasSectionTimestamps', {});
    if (primary) meta[primary] = normalizeTimestamp(ts);
    storeSetJSON('modeAtlasSectionTimestamps', meta);
  } catch {}
}
function ensureResultIdsInSectionData(sectionName, data) {
  if (sectionName !== 'readingTests' && sectionName !== 'writingTests') return data;
  const mode = sectionName === 'writingTests' ? 'writing' : 'reading';
  return {...data,primary:window.ModeAtlasSaveMerge.testRecords(data.primary,mode)};
}

function readJSON(key, fallback) {
  try {
    return storeJSON(key, fallback);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  storeSetJSON(key, value);
}

function normalizeTimestamp(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}


function parseMaybeJSON(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!/^[\[{]/.test(trimmed)) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
}

function coerceStorageMap(value) {
  const parsed = parseMaybeJSON(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed;
}

function firstNonEmptyMap(...values) {
  for (const value of values) {
    const map = coerceStorageMap(value);
    if (Object.keys(map).length) return map;
  }
  return {};
}

function firstArrayFromData(data, fieldNames, modeHint = '') {
  for (const field of fieldNames) {
    const value = readJSONFromMap(data, field, null);
    if (Array.isArray(value)) {
      return value.map((item, index) => normalizeImportedTestItem(item, modeHint, index)).filter(Boolean);
    }
  }
  return [];
}

function normalizeImportedTestItem(item, modeHint = 'reading') {
  return window.ModeAtlasSaveMerge.testRecords([item],modeHint || 'reading')[0] || null;
}
function normalizeImportedTestList(list, modeHint = 'reading') {
  return window.ModeAtlasSaveMerge.testRecords(list,modeHint || 'reading');
}

function normalizeTestSectionPayload(sectionName,payload){
  const data=coerceStorageMap(payload);
  if(sectionName==='readingTests'||sectionName==='writingTests'){
    const mode=sectionName==='writingTests'?'writing':'reading';
    const keys=['primary','backup','altPrimary','altBackup',...(mode==='writing'?WRITING_TEST_IMPORT_KEYS:READING_TEST_IMPORT_KEYS)];
    const rows=keys.flatMap(key=>normalizeImportedTestList(data[key],mode));
    return {primary:window.ModeAtlasSaveMerge.records(rows,[],data.deleted),deleted:data.deleted||{}};
  }
  return data;
}

function snapshotSectionFixed(sectionName) {
  const def = SECTION_DEFS[sectionName];
  if(sectionName==='readingTests'||sectionName==='writingTests')window.ModeAtlasResultsStorage.read(sectionName==='writingTests'?'writing':'reading');
  const data = SAVE_SECTIONS.project(sectionName,{scalar:(key,fallback)=>storeGet(key,fallback)||fallback,json:readJSON});
  return {
    updatedAt: normalizeTimestamp(storeGet(def.updatedAtKey, '0')) || normalizeTimestamp(storeGet(SECTION_TIMESTAMP_KEYS[sectionName], '0')),
    data: ensureResultIdsInSectionData(sectionName, data)
  };
}


function readJSONFromMap(map, key, fallback) {
  if (!map || typeof map !== 'object' || !(key in map)) return fallback;
  const value = parseMaybeJSON(map[key]);
  if (typeof value !== 'string') return value == null ? fallback : clone(value);
  return value == null ? fallback : value;
}

function readStringFromMap(map, key, fallback = '0') {
  if (!map || typeof map !== 'object' || !(key in map)) return fallback;
  const value = map[key];
  if (value === undefined || value === null) return fallback;
  return typeof value === 'string' ? value : String(value);
}

function normalizeLegacyStorageMap(input) {
  const data = { ...(input || {}) };
  const mapLegacyKey = (from, to) => {
    if (data[from] !== undefined && data[to] === undefined) data[to] = data[from];
  };
  mapLegacyKey('stats', keyOr('readingCharStats', 'charStats'));
  mapLegacyKey('times', keyOr('readingCharTimes', 'charTimes'));
  mapLegacyKey('srs', keyOr('readingSrs', 'charSrs'));
  mapLegacyKey('reverseStats', keyOr('writingCharStats', 'reverseCharStats'));
  mapLegacyKey('reverseTimes', keyOr('writingCharTimes', 'reverseCharTimes'));
  mapLegacyKey('reverseSrs', keyOr('writingSrs', 'reverseCharSrs'));
  mapLegacyKey('writingStats', keyOr('writingCharStats', 'reverseCharStats'));
  mapLegacyKey('writingTimes', keyOr('writingCharTimes', 'reverseCharTimes'));
  mapLegacyKey('writingSrs', keyOr('writingSrs', 'reverseCharSrs'));
  mapLegacyKey('wordBank', keyOr('wordBank', 'kanaWordBank'));
  mapLegacyKey(keyOr('writingTestResultsBackup', 'reverseTestModeResults'), keyOr('writingTestResults', 'writingTestModeResults'));
  try {
    READING_TEST_IMPORT_KEYS.forEach((key) => {
      const list = readJSONFromMap(data, key, null);
      if (Array.isArray(list)) data[key] = JSON.stringify(normalizeImportedTestList(list, 'reading'));
    });
    WRITING_TEST_IMPORT_KEYS.forEach((key) => {
      const list = readJSONFromMap(data, key, null);
      if (Array.isArray(list)) data[key] = JSON.stringify(normalizeImportedTestList(list, 'writing'));
    });
    const tests = readJSONFromMap(data, keyOr('readingTestResults', 'testModeResults'), null);
    if (Array.isArray(tests) && data[keyOr('readingTestResultsBackup', 'readingTestModeResults')] === undefined && data[keyOr('writingTestResults', 'writingTestModeResults')] === undefined) {
      data[keyOr('readingTestResultsBackup', 'readingTestModeResults')] = JSON.stringify(tests.filter((item) => (item && (item.mode || 'reading')) === 'reading'));
      data[keyOr('writingTestResults', 'writingTestModeResults')] = JSON.stringify(tests.filter((item) => item && item.mode === 'writing'));
    }
  } catch {}
  return data;
}

function snapshotFromStorageMap(rawMap, fallbackTimestamp = 0) {
  const map = normalizeLegacyStorageMap(rawMap || {});
  const fallbackTs = normalizeTimestamp(fallbackTimestamp) || Date.now();
  const sections = {};
  Object.entries(SECTION_DEFS).forEach(([sectionName, def]) => {
    const data = SAVE_SECTIONS.project(sectionName,{scalar:(key,fallback)=>readStringFromMap(map,key,fallback),json:(key,fallback)=>readJSONFromMap(map,key,fallback)});
    sections[sectionName] = {
      updatedAt: normalizeTimestamp(map[def.updatedAtKey]) || fallbackTs,
      data: normalizeTestSectionPayload(sectionName, data)
    };
  });
  return { version: 'mode-atlas-import-snapshot-v2', updatedAt: fallbackTs, sections };
}

function repairImportSnapshotWithStorageMap(snapshot, rawMap, fallbackTimestamp = 0) {
  const map = coerceStorageMap(rawMap);
  const mapSnapshot = Object.keys(map).length ? snapshotFromStorageMap(map, fallbackTimestamp) : null;
  const repaired = clone(snapshot) || {};
  repaired.sections = repaired.sections && typeof repaired.sections === 'object' ? repaired.sections : {};
  ['readingTests','writingTests'].forEach((sectionName) => {
    if (repaired.sections[sectionName]?.data) {
      repaired.sections[sectionName].data = normalizeTestSectionPayload(sectionName, repaired.sections[sectionName].data);
    }
  });

  Object.keys(SECTION_DEFS).forEach((sectionName) => {
    const fromMap = mapSnapshot?.sections?.[sectionName];
    if (!fromMap) return;

    const existing = repaired.sections[sectionName];
    const existingHasData = sectionHasMeaningfulData(sectionName, existing?.data || {});
    const mapHasData = sectionHasMeaningfulData(sectionName, fromMap.data || {});

    if (!existing || (!existingHasData && mapHasData)) {
      repaired.sections[sectionName] = fromMap;
      return;
    }

    if ((sectionName === 'readingTests' || sectionName === 'writingTests') && mapHasData) {
      const mergedData = { ...(existing.data || {}) };
      Object.entries(fromMap.data || {}).forEach(([field, value]) => {
        if (Array.isArray(value) && value.length && (!Array.isArray(mergedData[field]) || !mergedData[field].length)) {
          mergedData[field] = value;
        }
      });
      repaired.sections[sectionName] = {
        ...existing,
        updatedAt: normalizeTimestamp(existing.updatedAt) || normalizeTimestamp(fromMap.updatedAt) || fallbackTimestamp,
        data: mergedData
      };
    }
  });

  return repaired;
}



function collectImportTestSources(obj) {
  const sources = [];
  const add = (value) => {
    const parsed = parseMaybeJSON(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    sources.push(parsed);
    if (parsed.data && typeof parsed.data === 'object') sources.push(coerceStorageMap(parsed.data));
    if (parsed.localStorage && typeof parsed.localStorage === 'object') sources.push(coerceStorageMap(parsed.localStorage));
    if (parsed.snapshot?.sections && typeof parsed.snapshot.sections === 'object') {
      const reading = parsed.snapshot.sections.readingTests?.data;
      const writing = parsed.snapshot.sections.writingTests?.data;
      if (reading && typeof reading === 'object') sources.push(reading);
      if (writing && typeof writing === 'object') sources.push(writing);
    }
    if (parsed.sections && typeof parsed.sections === 'object') {
      const reading = parsed.sections.readingTests?.data;
      const writing = parsed.sections.writingTests?.data;
      if (reading && typeof reading === 'object') sources.push(reading);
      if (writing && typeof writing === 'object') sources.push(writing);
    }
  };
  add(obj);
  return sources;
}

function collectImportedTestResults(obj) {
  const reading = [];
  const writing = [];
  const seen = { reading: new Set(), writing: new Set() };
  const addList = (list, modeHint) => {
    normalizeImportedTestList(list, modeHint).forEach((item, index) => {
      const mode = item.mode === 'writing' ? 'writing' : 'reading';
      if (mode !== modeHint) return;
      const key = item.id || `${mode}-${item.createdAt || item.date || index}`;
      if (seen[mode].has(key)) return;
      seen[mode].add(key);
      (mode === 'writing' ? writing : reading).push(item);
    });
  };
  collectImportTestSources(obj).forEach((source) => {
    [
      ...READING_TEST_IMPORT_KEYS.map((key) => [key, 'reading']),
      ['primary', 'reading'],
      ['altPrimary', 'reading'],
      ['backup', 'reading'],
      ['altBackup', 'reading'],
      ...WRITING_TEST_IMPORT_KEYS.map((key) => [key, 'writing']),
      ['primary', 'writing'],
      ['backup', 'writing']
    ].forEach(([key, mode]) => {
      const value = readJSONFromMap(source, key, null);
      if (Array.isArray(value)) addList(value, mode);
    });
  });
  return { reading, writing };
}

function applyImportedTestResultsToSnapshot(snapshot, saveObject, exportedAt) {
  const imported = collectImportedTestResults(saveObject);
  const ts = normalizeTimestamp(exportedAt) || Date.now();
  const out = clone(snapshot) || { sections: {} };
  out.sections = out.sections && typeof out.sections === 'object' ? out.sections : {};

  if (imported.reading.length) {
    out.sections.readingTests = {
      ...(out.sections.readingTests || {}),
      updatedAt: ts,
      data: normalizeTestSectionPayload('readingTests', {
        primary: imported.reading,
        backup: imported.reading,
        altPrimary: imported.reading,
        altBackup: imported.reading
      })
    };
  }

  if (imported.writing.length) {
    out.sections.writingTests = {
      ...(out.sections.writingTests || {}),
      updatedAt: ts,
      data: normalizeTestSectionPayload('writingTests', {
        primary: imported.writing,
        backup: imported.writing
      })
    };
  }

  return {
    snapshot: out,
    counts: { reading: imported.reading.length, writing: imported.writing.length }
  };
}

function buildLocalSnapshot() {
  const sections = {};
  Object.keys(SECTION_DEFS).forEach((name) => {
    sections[name] = snapshotSectionFixed(name);
  });
  const now = Date.now();
  Object.keys(sections).forEach((name) => setSectionTimestampAliases(name, sections[name].updatedAt || now));
  return {
    version: 'cloud-v' + CLOUD_SNAPSHOT_VERSION + '-restore-guard',
    generation:Number(storeGet('modeAtlasSaveGeneration','0'))||0,
    updatedAt: now,
    sectionTimestamps: {
      settingsUpdatedAt: normalizeTimestamp(storeGet('settingsUpdatedAt', '0')),
      resultsUpdatedAt: normalizeTimestamp(storeGet('resultsUpdatedAt', '0')),
      srsUpdatedAt: normalizeTimestamp(storeGet('srsUpdatedAt', '0')),
      dailyUpdatedAt: normalizeTimestamp(storeGet('dailyUpdatedAt', '0')),
      profileUpdatedAt: normalizeTimestamp(storeGet('profileUpdatedAt', '0'))
    },
    sections
  };
}

function buildEmptySnapshot() {
  const now = Date.now();
  const empty = {
    reading: { highScore: '0', settings: {}, stats: {}, times: {}, srs: {}, scoreHistory: {}, dailyChallengeHistory: {} },
    writing: { highScore: '0', settings: {}, stats: {}, times: {}, srs: {}, scoreHistory: {}, dailyChallengeHistory: {} },
    readingTests: { primary: [], backup: [], altPrimary: [], altBackup: [] },
    writingTests: { primary: [], backup: [] },
    wordBank: { items: [] },
    kanaLearning: {state:window.ModeAtlasKanaLearning.normalize({})},
    kanji: {state:window.ModeAtlasKanjiState.normalize({})},
    kanjiTests: {items:[]},
    progress: { state: window.ModeAtlasProgress.normalizeState({version:window.ModeAtlasProgress.STATE_VERSION,legacySeeded:true,updatedAt:now}) }
  };
  const sections = {};
  Object.keys(SECTION_DEFS).forEach((name) => { sections[name] = { updatedAt: now, data: empty[name] || {} }; });
  return { version: 'cloud-v' + CLOUD_SNAPSHOT_VERSION + '-reset', updatedAt: now, sections };
}

// Offline work belongs to the signed-in account. Leaving that account removes
// its device copy, including caches made by older releases; it never becomes guest work.
const LOCAL_SAVE_OWNER='modeAtlasLocalSaveOwner';
const ACCOUNT_SAVE_PREFIX='modeAtlasAccountSave:';
let accountSaveReady=true;
function activateAccountSave(uid){
  const owner=storeGet(LOCAL_SAVE_OWNER)||storeGet('modeAtlasLastUserId','guest');
  const next=uid||'guest';
  if(owner!=='guest'&&owner!==next){
    clearLocalAppData();
    if(storeSet(LOCAL_SAVE_OWNER,next)===false)return false;
    emitCloudDataChanged('account-switch',Object.keys(SECTION_DEFS));
  }
  // Account caches from before the private sign-out boundary are never restored.
  for(const key of Object.keys(window.ModeAtlasStorage?.snapshotAppStorage?.()||{}))if(key.startsWith(ACCOUNT_SAVE_PREFIX))storeRemove(key);
  if(storeGet('modeAtlasPracticeTransaction'))return false;
  return storeSet(LOCAL_SAVE_OWNER,next)!==false;
}

function clearLocalAppData() {
  const store = window.ModeAtlasStorage;
  if (!store?.clearAppData) throw new Error('Mode Atlas storage boundary is unavailable');
  return store.clearAppData();
}

function writeSectionToLocal(sectionName, payload, updatedAt) {
  const def = SECTION_DEFS[sectionName];
  let data = ensureResultIdsInSectionData(sectionName, normalizeTestSectionPayload(sectionName, payload || {}));
  if(sectionName==='kanaLearning')data={state:window.ModeAtlasKanaLearning.normalize(data.state)};
  if(sectionName==='kanji')data={state:window.ModeAtlasKanjiState.normalize(data.state)};
  if(sectionName==='kanjiTests')data={items:window.ModeAtlasKanjiResults.normalize(data.items),deleted:data.deleted||{}};
  if(sectionName==='progress'&&window.ModeAtlasProgress)data={...data,state:window.ModeAtlasProgress.normalizeState(data.state)};
  Object.entries(def.scalar).forEach(([field, key]) => {
    if(!storeSet(key, String(data[field] ?? '0')))throw Error('Your device could not finish saving.');
  });
  Object.entries(def.json).forEach(([field, key]) => {
    const fallback = SAVE_SECTIONS.empty(sectionName,field);
    if(!storeSetJSON(key, data[field] ?? fallback))throw Error('Your device could not finish saving.');
  });
  storeSet(def.updatedAtKey, String(normalizeTimestamp(updatedAt)));
  setSectionTimestampAliases(sectionName, updatedAt);
}

function arrayHasItems(value) {
  return Array.isArray(value) && value.length > 0;
}

function numberStringIsPositive(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) && num > 0;
}

function deepHasProgress(value) {
  if (!value) return false;
  if (Array.isArray(value)) return value.some(deepHasProgress);
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) && n > 0;
  }
  if (typeof value === 'object') return Object.values(value).some(deepHasProgress);
  return false;
}

function hasLocalImportGuard() {
  const until = Number(storeGet(LOCAL_IMPORT_GUARD_KEY, '0') || 0);
  return Number.isFinite(until) && Date.now() < until;
}

function beginLocalImport(ms = 10 * 60 * 1000) {
  storeSet(LOCAL_IMPORT_GUARD_KEY, String(Date.now() + ms));
}

function clearLocalImportGuard() {
  storeRemove(LOCAL_IMPORT_GUARD_KEY);
}

function sectionHasMeaningfulData(sectionName, data = {}) {
  if (!data || typeof data !== 'object') return false;
  if (sectionName === 'wordBank') return arrayHasItems(data.items) || Object.keys(data.lessons || {}).length > 0;
  if (sectionName === 'progress') return ['sources','events','adjustments','credits','claims','activity','achievements'].some(key=>deepHasProgress(data.state?.[key]));
  if (sectionName === 'readingTests' || sectionName === 'writingTests') {
    return arrayHasItems(data.primary) || arrayHasItems(data.backup) || arrayHasItems(data.altPrimary) || arrayHasItems(data.altBackup);
  }
  if (sectionName === 'reading' || sectionName === 'writing') {
    return deepHasProgress(data.stats) || deepHasProgress(data.times) || deepHasProgress(data.srs) || deepHasProgress(data.scoreHistory) || deepHasProgress(data.dailyChallengeHistory) || numberStringIsPositive(data.highScore);
  }
  return deepHasProgress(data);
}

function getLocalSectionData(sectionName) {
  return snapshotSectionFixed(sectionName).data || {};
}

function mergeCloudIntoLocal(snapshot) {
  if (!snapshot?.sections) return {localPreferred:false,changedSections:[]};
  if (hasLocalImportGuard()) return {localPreferred:true,changedSections:[]};
  const local=buildLocalSnapshot(), merged=window.ModeAtlasSaveMerge.snapshot(local,snapshot), changedSections=[];
  STORAGE.transaction(()=>{
  for(const [name,section] of Object.entries(merged.sections||{})) {
    if(!SECTION_DEFS[name])continue;
    if(stableJSON(section.data)!==stableJSON(local.sections[name]?.data)) {
      writeSectionToLocal(name,section.data,section.updatedAt);changedSections.push(name);
    }
  }
  if(!storeSet('modeAtlasSaveGeneration',String(merged.generation||0)))throw Error('Your device could not finish saving.');
  });
  return {localPreferred:snapshotData(merged)!==snapshotData(snapshot),changedSections};
}


let app = null;
let auth = null;
let db = null;
let currentUser = null;
let authResolved = false;
let authStartupFailed = false;
let resolveAuthReady;
const authReady = new Promise((resolve) => {
  resolveAuthReady = resolve;
});
let hydratedForUserId = null;
let firebaseSetupPromise = null;
let authListenerInstalled = false;
let cloudHydrationPromise = null;
let cloudHydrationUserId = null;
let initialHydrationPromise = Promise.resolve(false);
let cloudSyncPromise = null;
let cloudSyncPending = false;
let accountEpoch = 0;
let confirmedAccountData = null;
let syncStartedAt = 0;
let syncSlowTimer = null;
let signingOut = false;
let syncTimeout = null;
let sessionCloudPauseActive = false;
let deferredSessionSync = false;
let lastStatus = '';
const uiBindings = new Set();
const boundSignInButtons = new WeakSet();
const boundSignOutButtons = new WeakSet();
const boundAuthButtons = new WeakSet();
const LAST_CLOUD_SYNC_KEY = 'modeAtlasLastCloudSyncAt';
const CLOUD_STATE_KEY = 'modeAtlasCloudAccessState';
const CLOUD_ERROR_KEY = 'modeAtlasLastCloudErrorAt';
const CLOUD_ERROR_MESSAGE_KEY = 'modeAtlasLastCloudErrorMessage';
const SECTION_LABELS = {
  reading: 'Reading Practice',
  writing: 'Writing Practice',
  readingTests: 'Reading Test Results',
  writingTests: 'Writing Test Results',
  wordBank: 'Word Bank',
  kanaLearning: 'Kana learning path', kanji: 'Kanji learning', kanjiTests: 'Kanji tests',
  progress: 'Atlas Level'
};

function invalidateAccountWork(){
  accountEpoch++;
  confirmedAccountData=null;
  clearTimeout(syncSlowTimer);syncSlowTimer=null;syncStartedAt=0;
  clearTimeout(syncTimeout);syncTimeout=null;
  cloudSyncPending=false;cloudSyncPromise=null;
  cloudHydrationPromise=null;cloudHydrationUserId=null;
  deferredSessionSync=false;window.ModeAtlasDeferredCloudSync=false;
  sessionCloudPauseActive=false;window.ModeAtlasSessionCloudPause=false;
}
const sameAccount=(uid,epoch)=>currentUser?.uid===uid&&accountEpoch===epoch&&accountSaveReady;
// Firestore returns map keys in its own order. Compare data by value, keeping
// array order meaningful, so a read of an unchanged save cannot dirty it again.
const stableJSON=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const snapshotData=snapshot=>stableJSON(Object.keys(SECTION_DEFS).map(name=>snapshot?.sections?.[name]?.data));

function setCloudState(ok, message = '') {
  try {
    if (ok) {
      storeSet(LAST_CLOUD_SYNC_KEY, String(Date.now()));
      storeSet(CLOUD_STATE_KEY, 'ok');
      storeRemove(CLOUD_ERROR_KEY);
      storeRemove(CLOUD_ERROR_MESSAGE_KEY);
    } else {
      storeSet(CLOUD_STATE_KEY, 'offline');
      storeSet(CLOUD_ERROR_KEY, String(Date.now()));
      if (message) storeSet(CLOUD_ERROR_MESSAGE_KEY, String(message).slice(0, 180));
    }
  } catch {}
  // emitStatus() is the single owner of cloud status notifications.
  // Do not dispatch kanaCloudSyncStatusChanged a second time here.
  emitStatus();
}

function getSyncStatus() {
  const user = currentUser;
  const lastSync = normalizeTimestamp(storeGet(LAST_CLOUD_SYNC_KEY, '0'));
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  const state = storeGet(CLOUD_STATE_KEY, '') || '';
  const lastSyncLabel = lastSync ? new Date(lastSync).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'No cloud save confirmed yet';
  const value=(state,tone,text,detail,extra={})=>({state,tone,text,detail,lastSync,lastSyncLabel,user,...extra});
  if(CONFIG_READY&&!authResolved){
    if(authStartupFailed)return value('restore-error','warning','Couldn’t restore your account','Your device save is still available. Check your connection and try again.',{canRetry:true});
    return value('restoring','neutral','Restoring your account…','Your device save stays available while your sign-in is restored.');
  }
  if (!CONFIG_READY || !user) return value('local','neutral','Saved on this device','Sign in to save your progress to your account and use it on other devices.');
  if (!accountSaveReady) return value('paused','warning','Account switch paused','Free some device storage, then reopen Mode Atlas.');
  if (!online) return value('offline','warning','Offline · saved on this device','Keep practising. Your changes will sync when the connection returns.');
  if (cloudSyncPromise) {
    const slow=syncStartedAt&&Date.now()-syncStartedAt>=6000;
    return value('pending',slow?'warning':'neutral',slow?'Sync is taking longer than usual':'Syncing your progress…',slow?'Your changes are still on this device. Check your connection; this sync will finish when the server responds.':'Your changes are saved on this device while the cloud save is updated.',{phase:slow?'slow':'syncing'});
  }
  if (deferredSessionSync) return value('pending','neutral','Saved on this device','Cloud sync resumes when you pause or finish this session.',{phase:'studying'});
  if (syncTimeout) return value('pending','neutral','Waiting to sync','Your latest changes are saved on this device and will sync shortly.',{phase:'queued'});
  if (state === 'offline') return value('paused','warning','Cloud sync needs attention','Your changes are saved on this device. Check your connection and try again.',{canRetry:true});
  if (hydratedForUserId !== user.uid) return value('pending','neutral','Checking your cloud save…','Your device save stays available while we check your account.',{phase:'loading'});
  if (!confirmedAccountData) return value('pending','neutral','Cloud save not yet confirmed','Your progress is on this device. Sync now to confirm it is saved to your account.',{canRetry:true});
  return value('cloud','ok','All changes saved','Your latest progress is confirmed in your cloud account.',{canRetry:true});
}

function statusText() {
  const st = getSyncStatus();
  if (st.state === 'cloud') return 'Signed in. Your progress is synced across devices.';
  if (st.state === 'offline') return 'Signed in. You are offline, so changes will sync when connection returns.';
  return st.text;
}

function emitStatus() {
  lastStatus = statusText();
  uiBindings.forEach(updateUiBinding);
  try { window.dispatchEvent(new CustomEvent('kanaCloudSyncStatusChanged', { detail: getSyncStatus() })); } catch {}
}

function emitCloudDataChanged(source, sections = []) {
  const changedSections = Array.from(new Set((Array.isArray(sections) ? sections : []).filter(Boolean)));
  if (!changedSections.length) return false;
  try {
    window.dispatchEvent(new CustomEvent('modeAtlasCloudDataChanged', {
      detail: { source: String(source || 'cloud'), sections: changedSections }
    }));
    return true;
  } catch {
    return false;
  }
}


function setCloudElementVisible(el, visible = true) {
  if (!el) return;
  el.hidden = !visible;
}

function updateUiBinding(binding) {
  const user = currentUser;
  const restoring=CONFIG_READY&&!authResolved;
  if (binding.statusEl) binding.statusEl.textContent = binding.customStatus || lastStatus;
  if (binding.nameEl) binding.nameEl.textContent = (user && window.ModeAtlasAvatar?.current?.()?.displayName) || user?.displayName || user?.email || (restoring?'Your account':'Guest');
  if (binding.emailEl) binding.emailEl.textContent = user?.email || (restoring?(authStartupFailed?'Connection unavailable':'Restoring your sign-in…'):CONFIG_READY ? 'Not signed in' : 'Cloud sync unavailable');
  if (binding.photoEl) {
    if (user?.photoURL) {
      binding.photoEl.src = user.photoURL;
      binding.photoEl.alt = user.displayName || 'Mode Atlas profile';
      setCloudElementVisible(binding.photoEl, true);
    } else {
      binding.photoEl.removeAttribute('src');
      binding.photoEl.alt = '';
      setCloudElementVisible(binding.photoEl, !binding.hidePhotoIfNoUser);
    }
  }
  if (binding.signInBtn) setCloudElementVisible(binding.signInBtn, !user&&!restoring);
  if (binding.signOutBtn) setCloudElementVisible(binding.signOutBtn, !!user);
  if (binding.authBtn) {
    const label = binding.authBtn.querySelector('[data-profile-auth-label]');
    const text = user ? (signingOut ? 'Signing out…' : 'Sign out') : restoring?(authStartupFailed?'Retry connection':'Restoring account…'):(binding.signInLabel || 'Sign in with Google');
    if (label) label.textContent = text;
    else binding.authBtn.textContent = text;
    binding.authBtn.classList.toggle('ma-button--primary', !user);
    binding.authBtn.setAttribute('aria-label', text);
    binding.authBtn.disabled = !!accountActionPromise||(restoring&&!authStartupFailed);
    binding.authBtn.setAttribute('aria-busy',String(signingOut));
  }
  if (binding.signedInEls) binding.signedInEls.forEach((el) => setCloudElementVisible(el, !!user));
  if (binding.signedOutEls) binding.signedOutEls.forEach((el) => setCloudElementVisible(el, !user&&!restoring));
}


window.addEventListener('modeAtlasAvatarChanged',()=>uiBindings.forEach(updateUiBinding));

function findUiBinding(options = {}) {
  const signInBtn = options.signInBtn || null;
  const signOutBtn = options.signOutBtn || null;
  const authBtn = options.authBtn || null;
  const statusEl = options.statusEl || null;
  const nameEl = options.nameEl || null;
  const emailEl = options.emailEl || null;
  const photoEl = options.photoEl || null;
  for (const binding of uiBindings) {
    if (binding.signInBtn === signInBtn
      && binding.signOutBtn === signOutBtn
      && binding.authBtn === authBtn
      && binding.statusEl === statusEl
      && binding.nameEl === nameEl
      && binding.emailEl === emailEl
      && binding.photoEl === photoEl) return binding;
  }
  return null;
}

function bindUi(options = {}) {
  const existing = findUiBinding(options);
  if (existing) {
    existing.signedInEls = options.signedInEls || existing.signedInEls || null;
    existing.signedOutEls = options.signedOutEls || existing.signedOutEls || null;
    existing.hidePhotoIfNoUser = options.hidePhotoIfNoUser !== false;
    existing.customStatus = options.customStatus || '';
    existing.onSignIn = options.onSignIn || null;
    existing.signInLabel = options.signInLabel || '';
    updateUiBinding(existing);
    return existing;
  }

  const binding = {
    signInBtn: options.signInBtn || null,
    signOutBtn: options.signOutBtn || null,
    authBtn: options.authBtn || null,
    statusEl: options.statusEl || null,
    nameEl: options.nameEl || null,
    emailEl: options.emailEl || null,
    photoEl: options.photoEl || null,
    signedInEls: options.signedInEls || null,
    signedOutEls: options.signedOutEls || null,
    hidePhotoIfNoUser: options.hidePhotoIfNoUser !== false,
    customStatus: options.customStatus || '',
    onSignIn: options.onSignIn || null,
    signInLabel: options.signInLabel || ''
  };
  if (binding.signInBtn && !boundSignInButtons.has(binding.signInBtn)) {
    boundSignInButtons.add(binding.signInBtn);
    binding.signInBtn.addEventListener('click', signInWithGoogle);
  }
  if (binding.signOutBtn && !boundSignOutButtons.has(binding.signOutBtn)) {
    boundSignOutButtons.add(binding.signOutBtn);
    binding.signOutBtn.addEventListener('click', signOutUser);
  }
  if (binding.authBtn && !boundAuthButtons.has(binding.authBtn)) {
    boundAuthButtons.add(binding.authBtn);
    binding.authBtn.addEventListener('click', () => {
      if(CONFIG_READY&&!authResolved)void retryConnection();
      else if (currentUser) void signOutUser();
      else if (binding.onSignIn) binding.onSignIn();
      else void signInWithGoogle();
    });
  }
  uiBindings.add(binding);
  updateUiBinding(binding);
  return binding;
}

async function setupFirebase() {
  // setupFirebase() is the single Firebase setup owner. Concurrent callers join
  // one attempt; failed transient attempts are released so a later online event
  // or user action can retry without reloading the page.
  if (app && auth && authListenerInstalled) return true;
  if (firebaseSetupPromise) return firebaseSetupPromise;

  // Publish the pending owner before notifying listeners: visit/readiness
  // observers may synchronously join startup from the status event.
  const attempt = Promise.resolve().then(async () => {
    authStartupFailed = false;
    emitStatus();
    if (!CONFIG_READY) {
      authResolved = true;
      resolveAuthReady?.();
      emitStatus();
      return false;
    }

    const modulesLoaded = await loadFirebaseModules();
    if (!modulesLoaded) {
      authStartupFailed = true;
      setCloudState(false, (window.ModeAtlasEnv && window.ModeAtlasEnv.canUseFirebase === false) ? 'Cloud sync unavailable in this environment' : 'Firebase modules unavailable');
      return false;
    }

    if (!provider && GoogleAuthProvider) {
      provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
    }

    if (!app) app = getApps().length ? getApp() : initializeApp(CONFIG);
    await window.ModeAtlasAppCheck?.initialize(app);
    if (!auth) {
      // The native WebView navigates between bundled documents. Use its local
      // storage directly for the one JS Firebase session instead of getAuth's
      // browser dependency chain (which tries IndexedDB first on iOS).
      auth = window.ModeAtlasEnv?.isNativeApp
        ? initializeAuth(app, { persistence: browserLocalPersistence })
        : getAuth(app);
      if (!window.ModeAtlasEnv?.isNativeApp) {
        try { await getRedirectResult(auth); } catch (error) { console.warn('Redirect sign-in result was not available.', error); }
      }
    }

    if (!authListenerInstalled && auth && onAuthStateChanged) {
      onAuthStateChanged(auth, (user) => {
        const previousUid = currentUser?.uid || null;
        const localOwner=storeGet(LOCAL_SAVE_OWNER);
        if((authResolved&&previousUid!==(user?.uid||null))||(localOwner&&localOwner!=='guest'&&localOwner!==user?.uid)){
          window.dispatchEvent(new CustomEvent('modeAtlasAccountWillChange'));
          invalidateAccountWork();
        }
        currentUser = user;
        accountSaveReady=activateAccountSave(user?.uid);
        if(!user&&localOwner&&localOwner!=='guest')window.dispatchEvent(new CustomEvent('modeAtlasAccountSignedOut'));
        if(!accountSaveReady)setCloudState(false,'There is not enough device storage to switch saves. Free some space and reopen the app.');
        const accountId=user?.uid||'guest';
        storeSet('modeAtlasLastUserId',accountId);
        if (!user || user.uid !== previousUid) hydratedForUserId = null;
        authResolved = true;
        authStartupFailed = false;
        resolveAuthReady?.();
        emitStatus();

        // Auth state owns initial cloud hydration. Pages wait for this owner;
        // they never start a competing Firestore read themselves.
        if (user) {
          initialHydrationPromise = hydrateFromCloud(false).catch((error) => {
            console.warn('Cloud hydrate after auth restore failed.', error);
            return false;
          });
        } else {
          initialHydrationPromise = Promise.resolve(false);
          if(localOwner&&localOwner!=='guest'&&!accountActionPromise)location.reload?.();
        }
      });
      authListenerInstalled = true;
    }

    return true;
  });

  firebaseSetupPromise = (async () => {
    try {
      return await attempt;
    } catch (error) {
      authStartupFailed = true;
      console.warn('Firebase setup failed.', error);
      setCloudState(false, error?.message || 'Firebase setup failed');
      return false;
    } finally {
      firebaseSetupPromise = null;
    }
  })();
  return firebaseSetupPromise;
}

function getDocRef(uid) {
  return doc(db, 'users', uid, 'appData', 'kanaTrainer');
}

function accountTransport(uid,epoch=accountEpoch){
  return window.ModeAtlasAccountTransport.create({db,doc,runTransaction,valid:()=>sameAccount(uid,epoch)});
}
async function readAccountDocument(uid){return accountTransport(uid).read(uid);}
async function writeAccountDocument(uid,snapshot,merge=true){
  const epoch=accountEpoch;
  const saved=await accountTransport(uid,epoch).write(uid,snapshot,{replace:!merge||hasLocalImportGuard(),latest:()=>merge&&!hasLocalImportGuard()?buildLocalSnapshot():snapshot});
  if(!sameAccount(uid,epoch))throw Error('The signed-in account changed before this save finished.');
  storeSet('modeAtlasSaveGeneration',String(saved.generation||0));
  return saved;
}

async function hydrateFromCloud(force = false) {
  await authReady;
  if (!CONFIG_READY || !currentUser || !accountSaveReady) return false;
  const uid = currentUser.uid, epoch = accountEpoch;
  if (!await ensureFirestore()) return false;
  if(!sameAccount(uid,epoch))return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setCloudState(false, 'Browser is offline');
    return false;
  }
  if (!force && hydratedForUserId === currentUser.uid) return true;

  // There is one cloud hydration owner at a time. Multiple pages/components
  // asking for the same signed-in user's save join the in-flight read instead
  // of issuing overlapping Firestore reads and duplicate merge/render events.
  if (!force && cloudHydrationPromise && cloudHydrationUserId === uid) {
    return cloudHydrationPromise;
  }
  if (force && cloudHydrationPromise && cloudHydrationUserId === uid) {
    try { await cloudHydrationPromise; } catch {}
  }

  const hydration = (async () => {
    try {
      const snap = await readAccountDocument(uid);
      if (!sameAccount(uid,epoch)) return false;
      if (snap.exists()) {
        const { localPreferred, changedSections } = mergeCloudIntoLocal(snap.data());
        hydratedForUserId = uid;
        // A cache hit or a merged local change is not a confirmed cloud save.
        // Stamp the time only for matching server data or an acknowledged write.
        const localData=snapshotData(buildLocalSnapshot());
        const matches=!localPreferred&&!hasLocalImportGuard()&&!snap.metadata?.fromCache&&!snap.metadata?.hasPendingWrites
          &&snapshotData(snap.data())===localData;
        if(matches){confirmedAccountData=localData;setCloudState(true);}
        emitCloudDataChanged('hydrate', changedSections);
        if (!matches) scheduleSync(250);
      } else {
        hydratedForUserId = uid;
        scheduleSync(250);
      }
      return true;
    } catch (error) {
      console.warn('Cloud save hydrate failed.', error);
      window.ModeAtlasDiagnostics?.record('cloud-sync',error);
      if(sameAccount(uid,epoch))setCloudState(false, error?.message || 'Cloud hydrate failed');
      return false;
    }
  })();

  cloudHydrationPromise = hydration;
  cloudHydrationUserId = uid;

  try {
    return await hydration;
  } finally {
    if (cloudHydrationPromise === hydration) {
      cloudHydrationPromise = null;
      cloudHydrationUserId = null;
    }
  }
}


function waitWithTimeout(promise, ms = 1400, label = 'cloud startup') {
  let timeoutId = null;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      timeoutId = null;
      try { setCloudState(false, label + ' timed out'); } catch {}
      resolve(false);
    }, ms);
  });

  // A settled operation must cancel its deadline. The previous implementation
  // left the timer alive after Promise.race resolved, so successful Firebase
  // startup/hydration later emitted false "timed out" states and unnecessary
  // page refresh work.
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timeoutId !== null) clearTimeout(timeoutId);
  });
}

async function waitForAuthRestore(){
  if(!CONFIG_READY)return true;
  // Readiness observers wait; only explicit sync/sign-in/reconnect actions
  // retry failed startup. Otherwise a failure notification restarts itself.
  if(authStartupFailed)return false;
  if(!await waitWithTimeout(setupFirebase(),1400,'cloud setup'))return false;
  await waitWithTimeout(authReady, 1400, 'auth check');
  return authResolved;
}

async function beforePageLoad(){return waitForAuthRestore();}

async function waitForInitialHydration(timeoutMs = 2600) {
  if(!await waitForAuthRestore())return false;
  if (!currentUser) return true;
  if (hydratedForUserId === currentUser.uid) return true;
  const result = await waitWithTimeout(initialHydrationPromise, timeoutMs, 'cloud hydrate');
  return result === true || hydratedForUserId === currentUser?.uid;
}

function credentialFromNativeResult(providerId, nativeResult) {
  const credential = nativeResult?.credential;
  if (!nativeResult?.handled || !credential?.idToken) {
    const error = new Error('Native provider did not return a usable credential.');
    error.code = 'native-auth-missing-credential';
    throw error;
  }
  if (providerId === 'apple.com') {
    if (!credential.nonce || !OAuthProvider) throw new Error('Apple sign-in needs an ID token and raw nonce.');
    return new OAuthProvider('apple.com').credential({idToken:credential.idToken, rawNonce:credential.nonce});
  }
  return GoogleAuthProvider.credential(credential.idToken, credential.accessToken || undefined);
}
async function nativeProviderCredential(providerId) {
  return credentialFromNativeResult(providerId, await window.AtlasPlatform?.authenticate?.(providerId));
}

// One account mutation at a time: repeated taps cannot start competing provider
// choosers, link a different user mid-operation, or queue deletion confirmations.
let accountActionPromise = null;
function runAccountAction(action) {
  if (accountActionPromise) return Promise.resolve(false);
  accountActionPromise = Promise.resolve().then(action).finally(() => { accountActionPromise = null;signingOut=false;emitStatus(); });
  emitStatus();
  return accountActionPromise;
}
function signInWithProvider(providerId = 'google.com') {
  return runAccountAction(() => performProviderSignIn(providerId));
}
async function performProviderSignIn(providerId) {
  const isApple = providerId === 'apple.com';
  const providerName = isApple ? 'Apple' : 'Google';
  await setupFirebase();
  if (!CONFIG_READY || !auth) {
    await window.ModeAtlasFeedback?.alert?.({
      kicker: 'Cloud sync',
      title: providerName + ' sign-in is not configured',
      message: 'Mode Atlas cloud sign-in is not configured for this build.',
      tone: 'warning',
      confirmLabel: 'OK'
    });
    return false;
  }

  try {
    if (window.ModeAtlasEnv?.isNativeApp) {
      if (typeof signInWithCredential !== 'function') {
        const error = new Error('Firebase credential sign-in is unavailable.');
        error.code = 'native-auth-web-session-unavailable';
        throw error;
      }
      const nativeResult = await window.AtlasPlatform?.authenticate?.(providerId);
      const webCredential = credentialFromNativeResult(providerId, nativeResult);
      const handoff = signInWithCredential(auth, webCredential);
      let timer;
      try {
        const result = await Promise.race([
          handoff,
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              const stalled = new Error('Firebase did not finish the native credential handoff.');
              stalled.code = 'native-auth-handoff-timeout';
              reject(stalled);
            }, 15000);
          })
        ]);
        // Apple supplies the name only during the first authorization. Keep it
        // in the existing Firebase profile without overwriting a chosen name.
        if (isApple && nativeResult.displayName && result?.user && !result.user.displayName) {
          try { await updateProfile(result.user, {displayName:nativeResult.displayName}); }
          catch (error) { console.warn('Apple profile name could not be saved.', error?.code || 'profile-update-failed'); }
        }
      } finally {
        clearTimeout(timer);
      }
    } else {
      if (isApple) return false; // Apple is offered only by the iOS account chooser.
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        const code = String(error?.code || '');
        if (code.includes('popup') || code.includes('cancelled')) {
          await signInWithRedirect(auth, provider);
          return true;
        }
        throw error;
      }
    }

    await hydrateFromCloud(false);
    await syncNow();
    return true;
  } catch (error) {
    if (String(error?.code || '') === 'auth/cancelled-popup-request') return false;
    console.error(providerName + ' sign-in failed.', error);
    const code = String(error?.code || '');
    const nativeSetupProblem = (code.includes('native-auth') && code !== 'native-auth-handoff-timeout')
      || /GoogleService-Info|client id|configuration/i.test(String(error?.message || ''));
    await window.ModeAtlasFeedback?.alert?.({
      kicker: 'Cloud sync',
      title: code === 'native-auth-handoff-timeout' ? providerName + ' sign-in is taking too long' : providerName + ' sign-in failed',
      message: code === 'native-auth-handoff-timeout'
        ? providerName + ' returned to Mode Atlas, but Firebase has not finished signing in. Check Profile before trying again.'
        : nativeSetupProblem
          ? 'This iOS build is not yet configured for ' + providerName + ' sign-in.'
          : 'Mode Atlas could not complete ' + providerName + ' sign-in. Check your connection and provider setup, then try again.' + (code ? ` (${code})` : ''),
      tone: 'error',
      confirmLabel: 'OK'
    });
    return false;
  }
}
const signInWithGoogle = () => signInWithProvider('google.com');
const signInWithApple = () => signInWithProvider('apple.com');

function linkNativeProvider(providerId) {
  return runAccountAction(() => performProviderLink(providerId));
}
async function performProviderLink(providerId) {
  await authReady;
  const user = currentUser;
  if (!window.ModeAtlasEnv?.isNativeApp || !user || !['apple.com','google.com'].includes(providerId)) return false;
  if (user.providerData?.some((item) => item.providerId === providerId)) return true;
  const providerName = providerId === 'apple.com' ? 'Apple' : 'Google';
  const approved = await window.ModeAtlasFeedback?.confirm?.({
    kicker:'Sign-in methods', title:'Link ' + providerName + ' to this account?',
    message:'This connects your ' + providerName + ' identity to your current Mode Atlas account, including its profile and progress. Both sign-in methods will open the same account.',
    confirmLabel:'Link ' + providerName, cancelLabel:'Cancel'
  });
  if (!approved || currentUser?.uid !== user.uid) return false;
  try {
    const credential = await nativeProviderCredential(providerId);
    await linkWithCredential(user, credential);
    if (auth.currentUser?.uid !== user.uid) throw new Error('The signed-in account changed while linking.');
    emitStatus();
    window.ModeAtlasFeedback?.toast?.('Account linked. Both sign-in methods now use the same progress.', 'success');
    return true;
  } catch (error) {
    if (String(error?.code || '') === 'auth/cancelled-popup-request') return false;
    console.error('Provider linking failed.', error);
    await window.ModeAtlasFeedback?.alert?.({
      kicker:'Account', title:'Could not link account',
      message:String(error?.code || '').includes('credential-already-in-use')
        ? 'This sign-in method already belongs to another Mode Atlas account. Your accounts were not merged and your progress has not changed.'
        : 'The account could not be linked. Check the provider setup and try again.' + (error?.code ? ` (${error.code})` : ''),
      tone:'error', confirmLabel:'OK'
    });
    return false;
  }
}

function deleteAccount() {
  return runAccountAction(performAccountDeletion);
}
async function confirmCurrentSignIn() {
  await authReady;
  const user=currentUser;if(!user||!auth)throw new Error('Sign in again to continue.');
  const hasApple=user.providerData?.some(item=>item.providerId==='apple.com');
  const hasGoogle=user.providerData?.some(item=>item.providerId==='google.com');
  const providerId=hasApple&&(window.ModeAtlasEnv?.isNativeApp||!hasGoogle)?'apple.com':'google.com';
  let appleAuthorizationCode='';
  if(window.ModeAtlasEnv?.isNativeApp){
    const result=await window.AtlasPlatform?.authenticate?.(providerId);
    await reauthenticateWithCredential(user,credentialFromNativeResult(providerId,result));
    if(providerId==='apple.com')appleAuthorizationCode=result?.credential?.authorizationCode||'';
  }else await reauthenticateWithPopup(user,providerId==='apple.com'?new OAuthProvider('apple.com'):provider);
  if(auth.currentUser?.uid!==user.uid)throw new Error('The signed-in account changed. The action was cancelled.');
  await user.getIdToken(true);
  return {providerId,appleAuthorizationCode};
}

async function performAccountDeletion() {
  await authReady;
  const user = currentUser;
  if (!user || !auth || !CONFIG_READY) return false;
  if (navigator.onLine === false) {
    await window.ModeAtlasFeedback?.alert?.({title:'Connect to delete your account',message:'Account deletion needs a connection to remove your cloud data.',tone:'warning',confirmLabel:'OK'});
    return false;
  }
  const approved = await window.ModeAtlasFeedback?.confirm?.({
    kicker:'Account', title:'Delete your Mode Atlas account?',
    message:'This permanently deletes your account, cloud learning progress, friends profile and connections, and this device’s Mode Atlas save. This cannot be undone.',
    tone:'danger', confirmLabel:'Delete account', cancelLabel:'Keep account'
  });
  if (!approved) return false;
  try {
    const {providerId,appleAuthorizationCode}=await confirmCurrentSignIn();
    if (!window.ModeAtlasSocial?.deleteAccount) throw new Error('Account deletion is unavailable in this build.');
    setSessionCloudPause(true);
    clearTimeout(syncTimeout);
    syncTimeout = null;
    if (cloudSyncPromise) await cloudSyncPromise;
    if (cloudHydrationPromise) await cloudHydrationPromise;
    if (auth.currentUser?.uid !== user.uid) throw new Error('The signed-in account changed. Deletion was cancelled.');
    if (providerId === 'apple.com') {
      const firebaseIdToken = await user.getIdToken();
      if (auth.currentUser?.uid !== user.uid) throw new Error('The signed-in account changed. Deletion was cancelled.');
      if (!appleAuthorizationCode || !await window.AtlasPlatform?.revokeAppleAuthorization?.(appleAuthorizationCode, firebaseIdToken)) {
        throw new Error('Apple authorization could not be revoked. Please try again.');
      }
    }
    let result;
    try {
      if (auth.currentUser?.uid !== user.uid) throw new Error('The signed-in account changed. Deletion was cancelled.');
      result = await window.ModeAtlasSocial.deleteAccount(user.uid);
    }
    catch (error) {
      // A response can be lost after the server commits deletion. Check the
      // receipt before presenting a failure or leaving the device save intact.
      try { result = await window.ModeAtlasSocial.accountDeletionStatus(user.uid); } catch {}
      if (!result?.deleted) throw error;
    }
    if (!result?.deleted) throw new Error('Account deletion is still being confirmed. Please try again.');
    if (auth.currentUser && auth.currentUser.uid !== user.uid) throw new Error('The signed-in account changed.');
    try { await signOut(auth); } catch (error) { console.warn('Account deleted; local authentication cleanup will retry on launch.',error); }
    currentUser = null;
    emitStatus();
    window.dispatchEvent(new CustomEvent('modeAtlasAccountSignedOut'));
    try { clearLocalAppData(); }
    catch (error) { console.error('Account deleted but local save cleanup failed.', error); }
    hydratedForUserId = null;
    deferredSessionSync = false;
    window.ModeAtlasDeferredCloudSync = false;
    if (window.ModeAtlasEnv?.isNativeApp) {
      try { await window.AtlasPlatform?.signOutIdentityProvider?.(); } catch {}
    }
    window.ModeAtlasFeedback?.toast?.(result.cleanupPending ? 'Your account was deleted. Cloud data removal is finishing automatically.' : 'Your account and learning data were deleted.', 'success');
    location.reload?.();
    return true;
  } catch (error) {
    if (String(error?.code || '') === 'auth/cancelled-popup-request') return false;
    console.error('Account deletion failed.', error);
    await window.ModeAtlasFeedback?.alert?.({
      kicker:'Account', title:'Could not confirm account deletion',
      message:'Check your connection and try again. If deletion has already started, your remaining cloud data will be removed automatically.' + (error?.code ? ` (${error.code})` : ''),
      tone:'error', confirmLabel:'OK'
    });
    return false;
  } finally { setSessionCloudPause(false); }
}

function signOutUser() {
  return runAccountAction(performSignOut);
}
async function performSignOut() {
  if (!auth || !currentUser) return false;
  const uid=currentUser.uid,epoch=accountEpoch;
  // End the active run without manufacturing completion rewards. Its answered
  // questions are already saved and can now be flushed before clearing the device.
  window.suspendTrainerForAccountChange?.();
  setSessionCloudPause(false);
  const confirmed=()=>sameAccount(uid,epoch)&&confirmedAccountData!==null&&confirmedAccountData===snapshotData(buildLocalSnapshot())&&!(window.ModeAtlasEarnings?.pending?.());
  let update=null,open=true;
  const prompt=()=>{
    const status=getSyncStatus(),saved=confirmed();
    return {confirmLabel:saved?'Sign out':'Sign out and clear',message:[
      saved?'Your latest progress is saved to your account.':status.state==='cloud'?'Checking your latest changes…':status.text.replace(/[.…]+$/,'')+'.',
      'Last confirmed cloud save: '+status.lastSyncLabel+'.',
      window.ModeAtlasEarnings?.pending?.()?'Your latest study rewards are waiting to sync.':'',
      'Signing out clears this account’s data from this device. Your cloud save stays in your account.',
      saved?'':'Any changes that have not synced will be lost if you sign out now.'
    ].filter(Boolean).join('\n\n')};
  };
  const changed=()=>{if(open&&sameAccount(uid,epoch))update?.(prompt());};
  window.addEventListener('kanaCloudSyncStatusChanged',changed);
  window.addEventListener('modeAtlasEarningsChanged',changed);
  let proceed=false;
  try{
    // Open immediately. Sync runs behind the visible, cancellable confirmation;
    // no network deadline stands between the tap and an explanation.
    const choice=window.ModeAtlasFeedback?.confirm?.({title:'Sign out?',...prompt(),cancelLabel:'Keep studying',tone:'danger',
      onOpen:handle=>{update=handle.update;changed();}});
    if(!confirmed()&&navigator.onLine!==false)void syncNow().catch(()=>{});
    void window.ModeAtlasEarnings?.flush?.();
    proceed=await choice;
  }finally{open=false;window.removeEventListener?.('kanaCloudSyncStatusChanged',changed);window.removeEventListener?.('modeAtlasEarningsChanged',changed);}
  if(!proceed||!sameAccount(uid,epoch))return false;
  try{
    signingOut=true;emitStatus();
    // Notification cleanup may be offline. It must not hold account sign-out open.
    void window.ModeAtlasNotifications?.signOut?.();
    await signOut(auth);
    hydratedForUserId=null;
    if(window.ModeAtlasEnv?.isNativeApp){
      try{await window.AtlasPlatform?.signOutIdentityProvider?.();}catch{}
    }
    // Firestore uses its default memory cache. A fresh document also drops that
    // cache, closed dialogs and module-held snapshots of the previous account.
    location.reload?.();
    return true;
  }catch{
    await window.ModeAtlasFeedback?.alert?.({title:'Could not sign out',message:'Your account is still signed in. Please try again.',confirmLabel:'OK'});
    return false;
  }
}

function isSessionCloudPaused() {
  return sessionCloudPauseActive === true || window.ModeAtlasSessionCloudPause === true;
}

function setSessionCloudPause(active) {
  sessionCloudPauseActive = !!active;
  window.ModeAtlasSessionCloudPause = !!active;
  if (active) {
    window.ModeAtlasDeferredCloudSync = !!deferredSessionSync;
    return;
  }
  if (deferredSessionSync) {
    const shouldFlush = deferredSessionSync;
    deferredSessionSync = false;
    window.ModeAtlasDeferredCloudSync = false;
    if (shouldFlush) scheduleSync(650);
  }
}

function flushDeferredSessionSync(delay = 650) {
  sessionCloudPauseActive = false;
  window.ModeAtlasSessionCloudPause = false;
  const shouldFlush = deferredSessionSync;
  deferredSessionSync = false;
  window.ModeAtlasDeferredCloudSync = false;
  if (shouldFlush) scheduleSync(delay);
  return shouldFlush;
}

async function performSyncOnce() {
  if (isSessionCloudPaused()) {
    deferredSessionSync = true;
    window.ModeAtlasDeferredCloudSync = true;
    return false;
  }
  if (!await setupFirebase()) return false;
  await authReady;
  if (!CONFIG_READY || !currentUser || !accountSaveReady) return false;
  const uid = currentUser.uid, epoch = accountEpoch;
  if (!await ensureFirestore()) return false;
  if(!sameAccount(uid,epoch))return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setCloudState(false, 'Browser is offline');
    return false;
  }

  try {
    const local=buildLocalSnapshot();
    const saved=await writeAccountDocument(uid,local);
    if(!sameAccount(uid,epoch))return false;
    // Include edits made while a commit was pending in the next sync, without
    // marking those unacknowledged edits as already saved.
    if(hasLocalImportGuard())clearLocalImportGuard();
    const result=mergeCloudIntoLocal(saved);
    confirmedAccountData=snapshotData(saved);
    hydratedForUserId=uid;setCloudState(true);
    emitCloudDataChanged('sync-merge',result.changedSections);
    if(snapshotData(buildLocalSnapshot())!==confirmedAccountData)cloudSyncPending=true;
    return true;
  } catch(error) {
    console.warn('Cloud save sync failed.',error);
    window.ModeAtlasDiagnostics?.record('cloud-sync',error);
    if(sameAccount(uid,epoch))setCloudState(false,error?.message||'Cloud sync failed');
    return false;
  }
}

function syncNow() {
  clearTimeout(syncTimeout);
  syncTimeout = null;
  if (isSessionCloudPaused()) {
    deferredSessionSync = true;
    window.ModeAtlasDeferredCloudSync = true;
    emitStatus();
    return cloudSyncPromise || Promise.resolve(false);
  }
  if (cloudSyncPromise) {
    cloudSyncPending = true;
    return cloudSyncPromise;
  }

  const epoch=accountEpoch;
  syncStartedAt=Date.now();
  clearTimeout(syncSlowTimer);
  syncSlowTimer=setTimeout(()=>{if(epoch===accountEpoch&&cloudSyncPromise)emitStatus();},6000);
  const run = (async () => {
    let result = false;
    do {
      cloudSyncPending = false;
      result = await performSyncOnce();
    } while (epoch===accountEpoch && cloudSyncPending && !isSessionCloudPaused());
    return result;
  })();

  cloudSyncPromise = run.finally(() => {
    if(epoch===accountEpoch){cloudSyncPromise = null;clearTimeout(syncSlowTimer);syncSlowTimer=null;syncStartedAt=0;emitStatus();}
  });
  emitStatus();
  return cloudSyncPromise;
}

function scheduleSync(delay = 800) {
  if (isSessionCloudPaused()) {
    deferredSessionSync = true;
    window.ModeAtlasDeferredCloudSync = true;
    emitStatus();
    return false;
  }
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncTimeout = null;
    syncNow().catch((error) => {
      console.warn('Cloud save sync failed.', error);
      setCloudState(false, error?.message || 'Cloud sync failed');
    });
  }, delay);
  emitStatus();
  return true;
}

function retryConnection(){
  // Failed ES-module imports can remain cached for the life of a document. A
  // deliberate retry restarts that document, preserving its saved account data
  // and avoiding a second Firebase app/auth registry under cache-busted URLs.
  if(CONFIG_READY&&!authResolved&&authStartupFailed){location.reload();return Promise.resolve(false);}
  return syncNow();
}

function markSectionUpdated(sectionName) {
  const def = SECTION_DEFS[sectionName];
  if (!def) return;
  const now = Date.now();
  storeSet(def.updatedAtKey, String(now));
  setSectionTimestampAliases(sectionName, now);
}

function getUser() {
  return currentUser;
}

async function getFirebaseApp({allowGuest=false}={}) {
  if(!await setupFirebase())throw new Error('Firebase is unavailable.');
  await authReady;
  if(!app || (!allowGuest&&!currentUser))throw new Error('Sign in to continue.');
  return app;
}


function collectExportStorage() {
  const store = window.ModeAtlasStorage;
  if (!store?.snapshotBackupStorage) return {};
  return store.snapshotBackupStorage(localStorage);
}

// This is an application access check, not a server trust boundary. Local
// progress remains client-owned; competitive rankings must validate events.
function requireDeveloperBackupAccess(owner = currentUser?.uid || null) {
  if (!window.ModeAtlasDevConsoleLoader?.isEligible?.()) throw new Error('Developer access is required for save files.');
  if (owner !== (currentUser?.uid || null)) throw new Error('The account changed. Start the file action again.');
}

function createBackup() {
  requireDeveloperBackupAccess();
  return {
    app: 'Mode Atlas',
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    origin: typeof location !== 'undefined' ? location.origin : '',
    syncStatus: getSyncStatus(),
    snapshot: buildLocalSnapshot(),
    data: collectExportStorage()
  };
}

function getImportMapAndSnapshot(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Invalid save file');
  const exportedAt = Date.parse(obj.exportedAt || '') || Date.now();
  const fallbackMap = firstNonEmptyMap(obj.data, obj.localStorage);

  if (obj.snapshot && obj.snapshot.sections) {
    return {
      snapshot: repairImportSnapshotWithStorageMap(obj.snapshot, fallbackMap, exportedAt),
      map: fallbackMap,
      exportedAt
    };
  }

  if (obj.sections) {
    const sectionExportedAt = normalizeTimestamp(obj.updatedAt) || exportedAt;
    return {
      snapshot: repairImportSnapshotWithStorageMap(obj, fallbackMap, sectionExportedAt),
      map: fallbackMap,
      exportedAt: sectionExportedAt
    };
  }

  const legacyMap = firstNonEmptyMap(obj.localStorage, obj.data, obj);
  if (!legacyMap || typeof legacyMap !== 'object' || Array.isArray(legacyMap)) throw new Error('Invalid save file');
  return { snapshot: snapshotFromStorageMap(legacyMap, exportedAt), map: legacyMap, exportedAt };
}

function countObjectKeys(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).length : 0;
}

function countArrayItems(value) {
  return Array.isArray(value) ? value.length : 0;
}

function summarizeImportSection(sectionName, data) {
  const safe = data && typeof data === 'object' ? data : {};
  if (sectionName === 'reading') {
    return [
      countObjectKeys(safe.stats) + ' kana stats',
      countObjectKeys(safe.times) + ' timing records',
      countObjectKeys(safe.srs) + ' SRS entries'
    ].join(' · ');
  }
  if (sectionName === 'writing') {
    return [
      countObjectKeys(safe.stats) + ' kana stats',
      countObjectKeys(safe.times) + ' timing records',
      countObjectKeys(safe.srs) + ' SRS entries'
    ].join(' · ');
  }
  if (sectionName === 'readingTests') {
    const count = Math.max(countArrayItems(safe.primary), countArrayItems(safe.altPrimary), countArrayItems(safe.backup), countArrayItems(safe.altBackup));
    return count + ' reading test' + (count === 1 ? '' : 's');
  }
  if (sectionName === 'writingTests') {
    const count = Math.max(countArrayItems(safe.primary), countArrayItems(safe.backup));
    return count + ' writing test' + (count === 1 ? '' : 's');
  }
  if (sectionName === 'wordBank') {
    const count = countArrayItems(safe.items);
    return count + ' word bank item' + (count === 1 ? '' : 's');
  }
  return sectionHasMeaningfulData(sectionName, safe) ? 'Has data' : 'No data';
}

function prepareManualImport(obj) {
  const imported = getImportMapAndSnapshot(obj);
  const appliedImport = applyImportedTestResultsToSnapshot(imported.snapshot, obj, imported.exportedAt);
  return {
    snapshot: appliedImport.snapshot,
    exportedAt: imported.exportedAt,
    importedTests: appliedImport.counts
  };
}

function previewLocalBackup(obj) {
  requireDeveloperBackupAccess();

  const prepared = prepareManualImport(obj);
  const local = buildLocalSnapshot();
  const sections = Object.keys(SECTION_DEFS).map((name) => {
    const current = local.sections?.[name] || { data: {}, updatedAt: 0 };
    const incoming = prepared.snapshot.sections?.[name] || { data: {}, updatedAt: 0 };
    const currentHasData = sectionHasMeaningfulData(name, current.data || {});
    const incomingHasData = sectionHasMeaningfulData(name, incoming.data || {});
    return {
      name,
      label: SECTION_LABELS[name] || name,
      current: summarizeImportSection(name, current.data || {}),
      incoming: summarizeImportSection(name, incoming.data || {}),
      currentUpdatedAt: normalizeTimestamp(current.updatedAt),
      incomingUpdatedAt: normalizeTimestamp(incoming.updatedAt),
      action: incomingHasData ? 'Will replace from backup' : (currentHasData ? 'Will keep current data' : 'No data to import'),
      willImport: !!incomingHasData
    };
  });
  return {
    exportedAt: prepared.exportedAt,
    sections,
    importedTests: prepared.importedTests,
    summary: {
      willImport: sections.filter((section) => section.willImport).length,
      willKeep: sections.filter((section) => !section.willImport).length
    }
  };
}

async function importLocalBackup(obj) {
  const importUid = currentUser?.uid || null;
  const access=()=>requireDeveloperBackupAccess(importUid);
  access();
  await waitWithTimeout(setupFirebase(), 1400, 'cloud setup');
  await waitWithTimeout(authReady, 1400, 'auth check');
  access();

  const restoreCloudActivity = !isSessionCloudPaused();
  if (restoreCloudActivity) setSessionCloudPause(true);
  clearTimeout(syncTimeout);
  syncTimeout = null;
  if (cloudSyncPromise) {
    try { await cloudSyncPromise; } catch {}
  }

  try {
    access();
    const prepared = prepareManualImport(obj);
    const snapshot = prepared.snapshot;
    const result = {
      updated: [],
      keptCloud: [],
      keptLocal: [],
      cloudSynced: false,
      usedCloud: false,
      importedTests: prepared.importedTests
    };

    // Mark the selected backup as authoritative before waiting on any hydrate
    // already in flight. Overlapping hydration/sync then preserves local import
    // data instead of racing newer cloud timestamps over it.
    beginLocalImport(2 * 60 * 1000);
    if (cloudHydrationPromise) {
      try { await cloudHydrationPromise; } catch {}
    }
    access();

    // Manual import should restore the file the user selected. Empty imported
    // sections are skipped so they do not wipe useful current data.
    STORAGE.transaction(()=>Object.keys(SECTION_DEFS).forEach((name) => {
      const incoming = snapshot.sections?.[name];
      if (!incoming) return;
      const incomingHasData = sectionHasMeaningfulData(name, incoming.data || {});
      if (incomingHasData) {
        writeSectionToLocal(name, incoming.data || {}, normalizeTimestamp(incoming.updatedAt) || Date.now());
        result.updated.push(name);
      } else {
        result.keptLocal.push(name);
      }
    }));

    let cloudStatusEmitted = false;
    const importedSnapshot = buildLocalSnapshot();
    const firestoreReady = importUid ? await ensureFirestore() : false;
    access();
    if (CONFIG_READY && importUid && firestoreReady && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      try {
        await writeAccountDocument(importUid, importedSnapshot);
        if (currentUser?.uid === importUid) {
          clearLocalImportGuard();
          hydratedForUserId = importUid;
          result.cloudSynced = true;
          setCloudState(true);
          cloudStatusEmitted = true;
        }
      } catch (error) {
        console.warn('Imported save could not be synced to cloud yet.', error);
        if (currentUser?.uid === importUid) {
          setCloudState(false, error?.message || 'Cloud unavailable after import');
          cloudStatusEmitted = true;
        }
      }
    }

    access();
    emitCloudDataChanged('import', result.updated);
    if (!cloudStatusEmitted) emitStatus();
    return result;
  } finally {
    if ((currentUser?.uid || null) !== importUid) clearLocalImportGuard();
    if (restoreCloudActivity) setSessionCloudPause(false);
  }
}

async function resetAllData() {
  await authReady;
  const restoreCloudActivity = !isSessionCloudPaused();
  if (restoreCloudActivity) setSessionCloudPause(true);
  clearTimeout(syncTimeout);
  syncTimeout = null;
  if (cloudSyncPromise) {
    try { await cloudSyncPromise; } catch {}
  }
  if (cloudHydrationPromise) {
    try { await cloudHydrationPromise; } catch {}
  }

  let resetGeneration=Number(storeGet('modeAtlasSaveGeneration','0'))+1;
  try {
    const resetUid = currentUser?.uid || null;
    const firestoreReady = resetUid ? await ensureFirestore() : false;
    if (CONFIG_READY && resetUid && firestoreReady) {
      const saved=await writeAccountDocument(resetUid, buildEmptySnapshot(),false);
      resetGeneration=saved.generation;
      if (currentUser?.uid === resetUid) hydratedForUserId = resetUid;
    }
    clearLocalAppData();
    storeSet('modeAtlasSaveGeneration',String(resetGeneration));
    return true;
  } finally {
    if (restoreCloudActivity) setSessionCloudPause(false);
  }
}

void setupFirebase();

try {
  window.addEventListener('storage',event=>{
    if(event.key!==LOCAL_SAVE_OWNER||event.newValue===(currentUser?.uid||'guest'))return;
    // Another tab owns the new save. Stop old in-memory trainers before a late
    // answer can write to it, and reload through Firebase's shared auth state.
    window.dispatchEvent(new CustomEvent('modeAtlasAccountWillChange'));
    invalidateAccountWork();accountSaveReady=false;
    location.reload?.();
  });
  window.addEventListener('online', () => {
    emitStatus();
    const joinedExistingSetup = !!firebaseSetupPromise;
    setupFirebase().then(async (ready) => {
      // If reconnect happened while the original failed setup was still settling,
      // the first call above intentionally joined it. Once that owner releases,
      // make one real reconnect attempt instead of requiring another online event.
      if (!ready && joinedExistingSetup && navigator.onLine !== false) ready = await setupFirebase();
      if (ready && currentUser) scheduleSync(200);
    }).catch((error) => {
      console.warn('Firebase retry after reconnect failed.', error);
      setCloudState(false, error?.message || 'Firebase setup failed');
    });
  });
  window.addEventListener('offline', () => setCloudState(false, 'Browser is offline'));
} catch {}



window.KanaCloudSync = {
  ready: authReady,
  beforePageLoad,
  waitForInitialHydration,
  hydrateFromCloud,
  bindUi,
  signInWithGoogle,
  signInWithApple,
  linkNativeProvider,
  deleteAccount,
  signOut: signOutUser,
  scheduleSync,
  syncNow,
  setSessionCloudPause,
  flushDeferredSessionSync,
  markSectionUpdated,
  beginLocalImport,
  getUser,
  isAuthResolved: () => authResolved,
  getFirebaseApp,
  confirmCurrentSignIn,
  isConfigured: () => CONFIG_READY,
  getSyncStatus,
  retryConnection,
  createBackup,
  importLocalBackup,
  previewLocalBackup,
  debugLocalSnapshot: buildLocalSnapshot,
  resetAllData
};
