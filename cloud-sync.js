let initializeApp, getApps, getApp;
let getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged;
let getFirestore, doc, getDoc, setDoc;
let firebaseModulesPromise = null;
let firebaseModulesLoaded = false;
async function loadFirebaseModules() {
  if (window.ModeAtlasEnv && window.ModeAtlasEnv.canUseFirebase === false) return false;
  if (location.protocol === 'file:') return false;
  if (firebaseModulesLoaded) return true;
  if (firebaseModulesPromise) return firebaseModulesPromise;

  const attempt = Promise.all([
    import('https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js')
  ]).then(([appMod, authMod, firestoreMod]) => {
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
    getFirestore = firestoreMod.getFirestore;
    doc = firestoreMod.doc;
    getDoc = firestoreMod.getDoc;
    setDoc = firestoreMod.setDoc;
    return true;
  }).catch((error) => {
    console.warn('Firebase modules could not be loaded.', error);
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

const SECTION_DEFS = {
  reading: {
    updatedAtKey: 'cloudReadingUpdatedAt',
    scalar: { highScore: keyOr('readingHighScore', 'highScore') },
    json: {
      settings: keyOr('readingSettings', 'settings'),
      stats: keyOr('readingCharStats', 'charStats'),
      times: keyOr('readingCharTimes', 'charTimes'),
      srs: keyOr('readingSrs', 'charSrs'),
      scoreHistory: keyOr('readingScoreHistory', 'scoreHistory'),
      dailyChallengeHistory: keyOr('readingDailyHistory', 'dailyChallengeHistory')
    }
  },
  writing: {
    updatedAtKey: 'cloudWritingUpdatedAt',
    scalar: { highScore: keyOr('writingHighScore', 'reverseHighScore') },
    json: {
      settings: keyOr('writingSettings', 'reverseSettings'),
      stats: keyOr('writingCharStats', 'reverseCharStats'),
      times: keyOr('writingCharTimes', 'reverseCharTimes'),
      srs: keyOr('writingSrs', 'reverseCharSrs'),
      scoreHistory: keyOr('writingScoreHistory', 'reverseScoreHistory'),
      dailyChallengeHistory: keyOr('writingDailyHistory', 'reverseDailyChallengeHistory')
    }
  },
  readingTests: {
    updatedAtKey: keyOr('testResultsUpdatedAt', 'testModeResultsUpdatedAt'),
    scalar: {},
    json: {
      primary: keyOr('readingTestResults', 'testModeResults'),
      backup: 'kanaTrainerTestModeResults',
      altPrimary: keyOr('readingTestResultsBackup', 'readingTestModeResults'),
      altBackup: 'kanaTrainerReadingTestModeResults'
    }
  },
  writingTests: {
    updatedAtKey: keyOr('writingTestResultsUpdatedAt', 'writingTestModeResultsUpdatedAt'),
    scalar: {},
    json: {
      primary: keyOr('writingTestResults', 'writingTestModeResults'),
      backup: 'kanaTrainerWritingTestModeResults'
    }
  },
  wordBank: {
    updatedAtKey: 'kanaWordBankUpdatedAt',
    scalar: {},
    json: {
      items: keyOr('wordBank', 'kanaWordBank')
    }
  }
};

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

const SECTION_TIMESTAMP_KEYS = {
  reading: 'settingsUpdatedAt',
  writing: 'settingsUpdatedAt',
  readingTests: 'resultsUpdatedAt',
  writingTests: 'resultsUpdatedAt',
  wordBank: 'profileUpdatedAt'
};
const SECTION_EXTRA_TIMESTAMP_KEYS = {
  reading: ['srsUpdatedAt', 'dailyUpdatedAt'],
  writing: ['srsUpdatedAt', 'dailyUpdatedAt'],
  readingTests: [],
  writingTests: [],
  wordBank: []
};

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
  const copy = { ...(data || {}) };
  Object.keys(copy).forEach((field) => {
    if (!Array.isArray(copy[field])) return;
    const seen = new Set();
    copy[field] = copy[field].map((item, index) => {
      if (!item || typeof item !== 'object') return item;
      const row = { ...item };
      const base = Date.parse(row.createdAt || row.completedAt || row.date || row.timestamp || '') || Number(row.timestamp || 0) || Date.now();
      if (!row.id) row.id = 'session_' + base.toString(36) + '_' + index.toString(36);
      if (seen.has(row.id)) row.id = row.id + '_' + index.toString(36);
      seen.add(row.id);
      if (!row.createdAt) row.createdAt = new Date(base).toISOString();
      if (!row.updatedAt) row.updatedAt = new Date(base).toISOString();
      if (!row.source) row.source = sectionName === 'writingTests' ? 'writing' : 'reading';
      return row;
    });
  });
  return copy;
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

function normalizeImportedTestItem(item, modeHint = '', index = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const row = { ...item };
  if (!row.mode) {
    if (modeHint === 'writing' || row.source === 'writing' || row.practiceMode === 'writing' || row.section === 'writing') row.mode = 'writing';
    else row.mode = 'reading';
  }
  const base = Date.parse(row.createdAt || row.completedAt || row.date || row.timestamp || '') || Number(row.timestamp || row.completedAtMs || 0) || Date.now();
  if (!row.id) row.id = `${row.mode}-test-${base}-${index}`;
  if (!row.createdAt) row.createdAt = new Date(base).toISOString();
  if (!row.updatedAt) row.updatedAt = row.createdAt;
  return row;
}

function normalizeImportedTestList(list, modeHint = '') {
  if (!Array.isArray(list)) return [];
  return list.map((item, index) => normalizeImportedTestItem(item, modeHint, index)).filter(Boolean);
}

function normalizeTestSectionPayload(sectionName, payload) {
  const data = coerceStorageMap(payload);
  if (sectionName === 'readingTests') {
    const primary = firstArrayFromData(data, ['primary', SECTION_DEFS.readingTests.json.primary, SECTION_DEFS.readingTests.json.altPrimary], 'reading')
      .filter((item) => (item.mode || 'reading') === 'reading');
    const backup = firstArrayFromData(data, ['backup', 'kanaTrainerTestModeResults'], 'reading')
      .filter((item) => (item.mode || 'reading') === 'reading');
    const altPrimary = firstArrayFromData(data, ['altPrimary', SECTION_DEFS.readingTests.json.altPrimary], 'reading')
      .filter((item) => (item.mode || 'reading') === 'reading');
    const altBackup = firstArrayFromData(data, ['altBackup', 'kanaTrainerReadingTestModeResults'], 'reading')
      .filter((item) => (item.mode || 'reading') === 'reading');
    return { ...data, primary, backup, altPrimary, altBackup };
  }
  if (sectionName === 'writingTests') {
    const primary = firstArrayFromData(data, ['primary', SECTION_DEFS.writingTests.json.primary, keyOr('writingTestResultsBackup', 'reverseTestModeResults')], 'writing')
      .filter((item) => item.mode === 'writing');
    const backup = firstArrayFromData(data, ['backup', SECTION_DEFS.writingTests.json.backup], 'writing')
      .filter((item) => item.mode === 'writing');
    return { ...data, primary, backup };
  }
  return data;
}

function snapshotSectionFixed(sectionName) {
  const def = SECTION_DEFS[sectionName];
  const data = {};
  Object.entries(def.scalar).forEach(([field, key]) => {
    data[field] = storeGet(key, '0') || '0';
  });
  Object.entries(def.json).forEach(([field, key]) => {
    let fallback = {};
    if (sectionName === 'readingTests' || sectionName === 'writingTests') fallback = [];
    if (sectionName === 'wordBank') fallback = [];
    data[field] = readJSON(key, fallback);
  });
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
    const data = {};
    Object.entries(def.scalar).forEach(([field, key]) => {
      data[field] = readStringFromMap(map, key, '0');
    });
    Object.entries(def.json).forEach(([field, key]) => {
      const fallback = sectionName === 'wordBank' || sectionName === 'readingTests' || sectionName === 'writingTests' ? [] : {};
      data[field] = readJSONFromMap(map, key, fallback);
    });
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
    wordBank: { items: [] }
  };
  const sections = {};
  Object.keys(SECTION_DEFS).forEach((name) => { sections[name] = { updatedAt: now, data: empty[name] || {} }; });
  return { version: 'cloud-v' + CLOUD_SNAPSHOT_VERSION + '-reset', updatedAt: now, sections };
}

function clearLocalAppData() {
  const store = window.ModeAtlasStorage;
  if (!store?.clearAppData) throw new Error('Mode Atlas storage boundary is unavailable');
  return store.clearAppData();
}

function writeSectionToLocal(sectionName, payload, updatedAt) {
  const def = SECTION_DEFS[sectionName];
  const data = ensureResultIdsInSectionData(sectionName, normalizeTestSectionPayload(sectionName, payload || {}));
  Object.entries(def.scalar).forEach(([field, key]) => {
    storeSet(key, String(data[field] ?? '0'));
  });
  Object.entries(def.json).forEach(([field, key]) => {
    const fallback = sectionName === 'wordBank' || sectionName === 'readingTests' || sectionName === 'writingTests' ? [] : {};
    writeJSON(key, data[field] ?? fallback);
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
  if (sectionName === 'wordBank') return arrayHasItems(data.items);
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

function mergeCloudIntoLocal(snapshot, options = {}) {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.sections) return { localPreferred: false, changedSections: [] };
  // A hydration read is asynchronous. If a local section changes after the read
  // begins, that user action is authoritative for this merge regardless of the
  // remote timestamp. This prevents a cold-start restore from erasing progress
  // created while Firestore was still responding.
  const localBaseline = options.localBaseline && typeof options.localBaseline === 'object' ? options.localBaseline : null;
  // A manual import is authoritative until it has been pushed to cloud. Any
  // hydration that overlaps that window must preserve the imported local save.
  if (hasLocalImportGuard()) return { localPreferred: true, changedSections: [] };
  const forceRemote = !!options.forceRemote;
  let localPreferred = false;
  const changedSections = [];
  const applyRemote = (name, data, updatedAt) => {
    writeSectionToLocal(name, data, updatedAt);
    changedSections.push(name);
  };

  Object.keys(SECTION_DEFS).forEach((name) => {
    const remoteSection = snapshot.sections[name];
    if (!remoteSection) return;
    const localUpdatedAt = normalizeTimestamp(storeGet(SECTION_DEFS[name].updatedAtKey, '0'));
    const remoteUpdatedAt = normalizeTimestamp(remoteSection.updatedAt);
    const remoteData = remoteSection.data || {};
    const localData = getLocalSectionData(name);
    const remoteHasData = sectionHasMeaningfulData(name, remoteData);
    const localHasData = sectionHasMeaningfulData(name, localData);
    const baselineUpdatedAt = localBaseline ? normalizeTimestamp(localBaseline[name]) : 0;

    if (localBaseline && localUpdatedAt > baselineUpdatedAt) {
      // This local mutation happened after the hydration read began. Promote its
      // logical section clock beyond the remote snapshot so the follow-up sync
      // cannot immediately undo the conflict decision because of device clock
      // skew or an older remote timestamp that happens to be numerically larger.
      const promotedUpdatedAt = Math.max(Date.now(), localUpdatedAt, remoteUpdatedAt + 1);
      storeSet(SECTION_DEFS[name].updatedAtKey, String(promotedUpdatedAt));
      setSectionTimestampAliases(name, promotedUpdatedAt);
      localPreferred = true;
      return;
    }

    // Repair for earlier builds that stamped a fresh timestamp onto blank/default local data.
    // If forceRemote is requested, trust Firestore for any section that contains real data.
    if (forceRemote && remoteHasData) {
      applyRemote(name, remoteData, remoteUpdatedAt || Date.now());
      return;
    }

    if (remoteHasData && !localHasData) {
      applyRemote(name, remoteData, remoteUpdatedAt || Date.now());
      return;
    }

    // Never let a newer-but-empty cloud section erase real local progress.
    if (!remoteHasData && localHasData) {
      localPreferred = true;
      return;
    }

    if (remoteUpdatedAt > localUpdatedAt && remoteHasData) {
      applyRemote(name, remoteData, remoteUpdatedAt);
    } else if (localUpdatedAt > remoteUpdatedAt && localHasData) {
      localPreferred = true;
    }
  });
  return { localPreferred, changedSections: Array.from(new Set(changedSections)) };
}


let app = null;
let auth = null;
let db = null;
let currentUser = null;
let authResolved = false;
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
  wordBank: 'Word Bank'
};

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
  if (!CONFIG_READY) {
    return { state: 'local', tone: 'neutral', text: 'Progress saves on this device', lastSync, user };
  }
  if (!user) {
    return { state: 'local', tone: 'neutral', text: 'Progress saves on this device · sign in to sync', lastSync, user };
  }
  if (!online || state === 'offline') {
    return { state: 'offline', tone: 'warning', text: 'Offline · changes will sync later', lastSync, user };
  }
  return { state: 'cloud', tone: 'ok', text: 'Synced across devices', lastSync, user };
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
  if (binding.statusEl) binding.statusEl.textContent = binding.customStatus || lastStatus;
  if (binding.nameEl) binding.nameEl.textContent = user?.displayName || user?.email || 'Guest';
  if (binding.emailEl) binding.emailEl.textContent = user?.email || (CONFIG_READY ? 'Not signed in' : 'Cloud sync unavailable');
  if (binding.photoEl) {
    if (user?.photoURL) {
      binding.photoEl.src = user.photoURL;
      binding.photoEl.alt = user.displayName || 'Google profile';
      setCloudElementVisible(binding.photoEl, true);
    } else {
      binding.photoEl.removeAttribute('src');
      binding.photoEl.alt = '';
      setCloudElementVisible(binding.photoEl, !binding.hidePhotoIfNoUser);
    }
  }
  if (binding.signInBtn) setCloudElementVisible(binding.signInBtn, !user);
  if (binding.signOutBtn) setCloudElementVisible(binding.signOutBtn, !!user);
  if (binding.authBtn) {
    const label = binding.authBtn.querySelector('[data-profile-auth-label]');
    const text = user ? 'Sign out' : 'Sign in with Google';
    if (label) label.textContent = text;
    else binding.authBtn.textContent = text;
    binding.authBtn.classList.toggle('ma-button--primary', !user);
    binding.authBtn.setAttribute('aria-label', text);
  }
  if (binding.signedInEls) binding.signedInEls.forEach((el) => setCloudElementVisible(el, !!user));
  if (binding.signedOutEls) binding.signedOutEls.forEach((el) => setCloudElementVisible(el, !user));
}


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
    customStatus: options.customStatus || ''
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
      if (currentUser) void signOutUser();
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
  if (app && auth && db && authListenerInstalled) return true;
  if (firebaseSetupPromise) return firebaseSetupPromise;

  const attempt = (async () => {
    if (!CONFIG_READY) {
      authResolved = true;
      resolveAuthReady?.();
      emitStatus();
      return false;
    }

    const modulesLoaded = await loadFirebaseModules();
    if (!modulesLoaded) {
      authResolved = true;
      resolveAuthReady?.();
      setCloudState(false, (window.ModeAtlasEnv && window.ModeAtlasEnv.canUseFirebase === false) ? 'Cloud sync unavailable in this environment' : 'Firebase modules unavailable');
      return false;
    }

    if (!provider && GoogleAuthProvider) {
      provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
    }

    if (!app) {
      app = getApps().length ? getApp() : initializeApp(CONFIG);
      auth = getAuth(app);
      db = getFirestore(app);
      try { await getRedirectResult(auth); } catch (error) { console.warn('Redirect sign-in result was not available.', error); }
    }

    if (!authListenerInstalled && auth && onAuthStateChanged) {
      onAuthStateChanged(auth, (user) => {
        const previousUid = currentUser?.uid || null;
        currentUser = user;
        if (!user || user.uid !== previousUid) hydratedForUserId = null;
        authResolved = true;
        resolveAuthReady?.();
        emitStatus();

        // Auth state owns initial cloud hydration. Pages wait for this owner;
        // they never start a competing Firestore read themselves.
        if (user && db) {
          initialHydrationPromise = hydrateFromCloud(false).catch((error) => {
            console.warn('Cloud hydrate after auth restore failed.', error);
            return false;
          });
        } else {
          initialHydrationPromise = Promise.resolve(false);
        }
      });
      authListenerInstalled = true;
    }

    return true;
  })();

  firebaseSetupPromise = (async () => {
    try {
      return await attempt;
    } finally {
      firebaseSetupPromise = null;
    }
  })();
  return firebaseSetupPromise;
}

function getDocRef(uid) {
  return doc(db, 'users', uid, 'appData', 'kanaTrainer');
}

async function hydrateFromCloud(force = false) {
  // Capture the local mutation clocks before the first await. In the auth
  // callback, authReady is resolved immediately before hydrateFromCloud() is
  // called; awaiting it still yields to the microtask queue, which previously
  // allowed a user edit to happen before the baseline was captured.
  const hydrationBaseline = Object.fromEntries(
    Object.keys(SECTION_DEFS).map((name) => [name, normalizeTimestamp(storeGet(SECTION_DEFS[name].updatedAtKey, '0'))])
  );
  await authReady;
  if (!CONFIG_READY || !currentUser || !db) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setCloudState(false, 'Browser is offline');
    return false;
  }
  if (!force && hydratedForUserId === currentUser.uid) return true;

  const uid = currentUser.uid;

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
      const snap = await getDoc(getDocRef(uid));
      if (!currentUser || currentUser.uid !== uid) return false;
      if (snap.exists()) {
        const { localPreferred, changedSections } = mergeCloudIntoLocal(snap.data(), {
          forceRemote: !!force,
          localBaseline: hydrationBaseline
        });
        hydratedForUserId = uid;
        setCloudState(true);
        emitCloudDataChanged('hydrate', changedSections);
        if (localPreferred || hasLocalImportGuard()) scheduleSync(250);
      } else {
        hydratedForUserId = uid;
        setCloudState(true);
        scheduleSync(250);
      }
      return true;
    } catch (error) {
      console.warn('Cloud save hydrate failed.', error);
      setCloudState(false, error?.message || 'Cloud hydrate failed');
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

async function beforePageLoad() {
  // Compatibility/readiness helper only. Cloud startup and initial hydration
  // are owned by setupFirebase() + onAuthStateChanged(), not by individual pages.
  await waitWithTimeout(setupFirebase(), 1400, 'cloud setup');
  await waitWithTimeout(authReady, 1400, 'auth check');
  return true;
}

async function waitForInitialHydration(timeoutMs = 2600) {
  await waitWithTimeout(setupFirebase(), 1400, 'cloud setup');
  await waitWithTimeout(authReady, 1400, 'auth check');
  if (!currentUser) return true;
  if (hydratedForUserId === currentUser.uid) return true;
  const result = await waitWithTimeout(initialHydrationPromise, timeoutMs, 'cloud hydrate');
  return result === true || hydratedForUserId === currentUser?.uid;
}

async function signInWithGoogle() {
  await setupFirebase();
  if (!CONFIG_READY || !auth) {
    await window.ModeAtlasFeedback?.alert?.({
      kicker: 'Cloud sync',
      title: 'Google sign-in is not configured',
      message: 'Add your Firebase project details to firebase-config.js before using Google sign-in.',
      tone: 'warning',
      confirmLabel: 'OK'
    });
    return;
  }
  try {
    await signInWithPopup(auth, provider);
    await hydrateFromCloud(false);
    await syncNow();
  } catch (error) {
    const code = String(error?.code || '');
    if (code.includes('popup') || code.includes('cancelled')) {
      await signInWithRedirect(auth, provider);
      return;
    }
    console.error('Google sign-in failed.', error);
    await window.ModeAtlasFeedback?.alert?.({
      kicker: 'Cloud sync',
      title: 'Google sign-in failed',
      message: 'Mode Atlas could not complete Google sign-in. Check your connection and Firebase Auth setup, then try again.',
      tone: 'error',
      confirmLabel: 'OK'
    });
  }
}

async function signOutUser() {
  if (!auth) return;
  await signOut(auth);
  hydratedForUserId = null;
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
  await authReady;
  if (!CONFIG_READY || !currentUser || !db) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setCloudState(false, 'Browser is offline');
    return false;
  }

  const uid = currentUser.uid;
  const snapshot = buildLocalSnapshot();
  const changedSections = [];

  try {
    const snap = await getDoc(getDocRef(uid));
    if (!currentUser || currentUser.uid !== uid) return false;

    if (snap.exists() && !hasLocalImportGuard()) {
      const existing = snap.data() || {};
      const existingSections = existing.sections || {};
      Object.keys(SECTION_DEFS).forEach((name) => {
        // getDoc() is asynchronous, so local data may have changed after the
        // sync snapshot was first captured. Always re-read the live section
        // before deciding whether a remote section is newer. Otherwise an
        // in-flight sync can overwrite a word/result/progress change made
        // while its Firestore read was pending.
        const localSection = snapshotSectionFixed(name);
        snapshot.sections[name] = localSection;
        const localData = localSection?.data || {};
        const remoteSection = existingSections[name];
        const remoteData = remoteSection?.data || {};
        const localUpdatedAt = normalizeTimestamp(localSection?.updatedAt);
        const remoteUpdatedAt = normalizeTimestamp(remoteSection?.updatedAt);
        if (!sectionHasMeaningfulData(name, localData) && sectionHasMeaningfulData(name, remoteData)) {
          snapshot.sections[name] = remoteSection;
        } else if (remoteUpdatedAt > localUpdatedAt && sectionHasMeaningfulData(name, remoteData)) {
          snapshot.sections[name] = remoteSection;
          writeSectionToLocal(name, remoteData, remoteUpdatedAt);
          changedSections.push(name);
        }
      });
    }

    // Never let an operation captured for one signed-in account write after
    // auth has moved to another account or signed out.
    if (!currentUser || currentUser.uid !== uid) return false;
    await setDoc(getDocRef(uid), snapshot, { merge: true });
    if (!currentUser || currentUser.uid !== uid) return false;

    if (hasLocalImportGuard()) clearLocalImportGuard();
    setCloudState(true);
    emitCloudDataChanged('sync-merge', changedSections);
    return true;
  } catch (error) {
    console.warn('Cloud save sync failed.', error);
    if (currentUser?.uid === uid) setCloudState(false, error?.message || 'Cloud sync failed');
    return false;
  }
}

function syncNow() {
  if (isSessionCloudPaused()) {
    deferredSessionSync = true;
    window.ModeAtlasDeferredCloudSync = true;
    return cloudSyncPromise || Promise.resolve(false);
  }
  if (cloudSyncPromise) {
    cloudSyncPending = true;
    return cloudSyncPromise;
  }

  const run = (async () => {
    let result = false;
    do {
      cloudSyncPending = false;
      result = await performSyncOnce();
    } while (cloudSyncPending && !isSessionCloudPaused());
    return result;
  })();

  cloudSyncPromise = run.finally(() => {
    cloudSyncPromise = null;
  });
  return cloudSyncPromise;
}

function scheduleSync(delay = 800) {
  if (isSessionCloudPaused()) {
    deferredSessionSync = true;
    window.ModeAtlasDeferredCloudSync = true;
    return false;
  }
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncNow().catch((error) => {
      console.warn('Cloud save sync failed.', error);
      setCloudState(false, error?.message || 'Cloud sync failed');
    });
  }, delay);
  return true;
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


function collectExportStorage() {
  const store = window.ModeAtlasStorage;
  if (!store?.snapshotBackupStorage) return {};
  return store.snapshotBackupStorage(localStorage);
}

function createBackup() {
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
  await waitWithTimeout(setupFirebase(), 1400, 'cloud setup');
  await waitWithTimeout(authReady, 1400, 'auth check');

  const restoreCloudActivity = !isSessionCloudPaused();
  if (restoreCloudActivity) setSessionCloudPause(true);
  clearTimeout(syncTimeout);
  if (cloudSyncPromise) {
    try { await cloudSyncPromise; } catch {}
  }

  try {
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

    // Manual import should restore the file the user selected. Empty imported
    // sections are skipped so they do not wipe useful current data.
    Object.keys(SECTION_DEFS).forEach((name) => {
      const incoming = snapshot.sections?.[name];
      if (!incoming) return;
      const incomingHasData = sectionHasMeaningfulData(name, incoming.data || {});
      if (incomingHasData) {
        writeSectionToLocal(name, incoming.data || {}, normalizeTimestamp(incoming.updatedAt) || Date.now());
        result.updated.push(name);
      } else {
        result.keptLocal.push(name);
      }
    });

    let cloudStatusEmitted = false;
    const importUid = currentUser?.uid || null;
    if (CONFIG_READY && importUid && db && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      try {
        await setDoc(getDocRef(importUid), buildLocalSnapshot(), { merge: true });
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

    emitCloudDataChanged('import', result.updated);
    if (!cloudStatusEmitted) emitStatus();
    return result;
  } finally {
    if (restoreCloudActivity) setSessionCloudPause(false);
  }
}

function describeImportResult(result) {
  const names = (list) => (list || []).map((name) => SECTION_LABELS[name] || name).join(', ');
  const lines = ['Save import checked by newest data.'];
  if (result.updated?.length) lines.push('Updated from backup: ' + names(result.updated) + '.');
  if (result.keptCloud?.length) lines.push('Kept newer cloud data: ' + names(result.keptCloud) + '.');
  if (result.keptLocal?.length) lines.push('Kept newer local data: ' + names(result.keptLocal) + '.');
  if (result.importedTests?.reading || result.importedTests?.writing) {
    const parts = [];
    if (result.importedTests.reading) parts.push(result.importedTests.reading + ' reading');
    if (result.importedTests.writing) parts.push(result.importedTests.writing + ' writing');
    lines.push('Imported test results: ' + parts.join(', ') + '.');
  }
  lines.push(result.cloudSynced ? 'This is now the definitive cloud save.' : (currentUser ? 'Cloud was unavailable, so local data will sync when cloud access returns.' : 'You are using local save data. Log in to sync this to cloud.'));
  return lines.join('\n');
}

async function resetAllData() {
  await authReady;
  const restoreCloudActivity = !isSessionCloudPaused();
  if (restoreCloudActivity) setSessionCloudPause(true);
  clearTimeout(syncTimeout);
  if (cloudSyncPromise) {
    try { await cloudSyncPromise; } catch {}
  }
  if (cloudHydrationPromise) {
    try { await cloudHydrationPromise; } catch {}
  }

  try {
    const resetUid = currentUser?.uid || null;
    if (CONFIG_READY && resetUid && db) {
      await setDoc(getDocRef(resetUid), buildEmptySnapshot());
      if (currentUser?.uid === resetUid) hydratedForUserId = resetUid;
    }
    clearLocalAppData();
    return true;
  } finally {
    if (restoreCloudActivity) setSessionCloudPause(false);
  }
}

setupFirebase().catch((error) => {
  console.warn('Firebase setup failed.', error);
  authResolved = true;
  resolveAuthReady?.();
  setCloudState(false, error?.message || 'Firebase setup failed');
});

try {
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
  signOut: signOutUser,
  scheduleSync,
  syncNow,
  setSessionCloudPause,
  flushDeferredSessionSync,
  markSectionUpdated,
  beginLocalImport,
  getUser,
  isConfigured: () => CONFIG_READY,
  getSyncStatus,
  createBackup,
  importLocalBackup,
  previewLocalBackup,
  describeImportResult,
  debugLocalSnapshot: buildLocalSnapshot,
  resetAllData
};
