/* Mode Atlas shared local storage helpers.
   Keeps the existing localStorage key names intact while giving modules one safe API. */
(function () {
  'use strict';

  const KEYS = Object.freeze({
    readingSettings: 'settings', writingSettings: 'reverseSettings',
    readingStats: 'stats', writingStats: 'reverseStats',
    readingCharStats: 'charStats', writingCharStats: 'reverseCharStats',
    readingCharTimes: 'charTimes', writingCharTimes: 'reverseCharTimes',
    readingSrs: 'charSrs', writingSrs: 'reverseCharSrs',
    readingScoreHistory: 'scoreHistory', writingScoreHistory: 'reverseScoreHistory',
    readingDailyHistory: 'dailyChallengeHistory', writingDailyHistory: 'reverseDailyChallengeHistory',
    readingHighScore: 'highScore', writingHighScore: 'reverseHighScore',
    readingTestResults: 'testModeResults', writingTestResults: 'writingTestModeResults',
    readingTestResultsBackup: 'readingTestModeResults', writingTestResultsBackup: 'reverseTestModeResults',
    testResultsUpdatedAt: 'testModeResultsUpdatedAt', writingTestResultsUpdatedAt: 'writingTestModeResultsUpdatedAt',
    displayMode: 'modeAtlasDisplayMode', soundMode: 'modeAtlasSound',
    activePreset: 'modeAtlasActivePreset', startReadingPreset: 'modeAtlasStartReadingPreset',
    wordBank: 'kanaWordBank'
  });

  const GROUPS = Object.freeze({
    reading: Object.freeze({
      settings: KEYS.readingSettings,
      charStats: KEYS.readingCharStats,
      charTimes: KEYS.readingCharTimes,
      srs: KEYS.readingSrs,
      scoreHistory: KEYS.readingScoreHistory,
      dailyHistory: KEYS.readingDailyHistory,
      highScore: KEYS.readingHighScore,
      testResults: KEYS.readingTestResults
    }),
    writing: Object.freeze({
      settings: KEYS.writingSettings,
      charStats: KEYS.writingCharStats,
      charTimes: KEYS.writingCharTimes,
      srs: KEYS.writingSrs,
      scoreHistory: KEYS.writingScoreHistory,
      dailyHistory: KEYS.writingDailyHistory,
      highScore: KEYS.writingHighScore,
      testResults: KEYS.writingTestResults
    })
  });

  const SAVE_SCHEMA_VERSION = Number(window.ModeAtlasSaveSchemaVersion || 1);
  const SCHEMA_VERSION = SAVE_SCHEMA_VERSION;

  const COMPAT_KEYS = Object.freeze({
    readingTests: Object.freeze([
      KEYS.readingTestResults,
      KEYS.readingTestResultsBackup,
      'kanaTrainerTestModeResults',
      'kanaTrainerReadingTestModeResults'
    ]),
    writingTests: Object.freeze([
      KEYS.writingTestResults,
      KEYS.writingTestResultsBackup,
      'kanaTrainerWritingTestModeResults'
    ])
  });


  // Authoritative browser-storage boundary for Mode Atlas. Keep this list
  // explicit so Reset/Export/Import never operate on unrelated origin data.
  // Current app-owned keys use the modeAtlas* namespace wherever possible;
  // APP_CORE_EXACT preserves older trainer/save keys for compatibility.
  const APP_CORE_EXACT = Object.freeze([
    ...Object.values(KEYS),
    ...COMPAT_KEYS.readingTests,
    ...COMPAT_KEYS.writingTests,
    'kanaTrainerTestModeResults',
    'kanaTrainerReadingTestModeResults',
    'kanaTrainerWritingTestModeResults',
    'readingTestModeResultsUpdatedAt',
    'writingTestModeResultsUpdatedAt',
    'reverseSettingsUpdatedAt',
    'settingsUpdatedAt',
    'resultsUpdatedAt',
    'srsUpdatedAt',
    'dailyUpdatedAt',
    'profileUpdatedAt',
    'kanaWordBankUpdatedAt',
    'cloudReadingUpdatedAt',
    'cloudWritingUpdatedAt',
    'kanaReadingUpdatedAt',
    'kanaWritingUpdatedAt',
    'kanaResultsUpdatedAt',
    'theme',
    'displayMode',
    'soundMode',
    'maSoundMode'
  ].filter((value, index, list) => value && list.indexOf(value) === index));
  const APP_LOCAL_PREFIXES = Object.freeze(['modeAtlasVersionFileCheckedResetDay:', 'modeAtlasVersionFileAttemptedResetDay:']);
  const APP_SESSION_EXACT = Object.freeze([
    'modeAtlasForceFirstVisit',
    'modeAtlasForceDailyReturn',
    'modeAtlasShowWhatsNewAfterOnboarding',
    'modeAtlasSafeMode',
    'modeAtlasLegacyServiceWorkerRetirementReloaded:v1'
  ]);
  const APP_SESSION_PREFIXES = Object.freeze(['modeAtlasVersionFileAttemptedResetDay:']);
  const APP_BACKUP_EXACT = Object.freeze([
    ...APP_CORE_EXACT,
    'modeAtlasAchievementBaselineSet',
    'modeAtlasActivePreset',
    'modeAtlasConfusableMode',
    'modeAtlasDailyReturnSeenDate',
    'modeAtlasDefaultPreset',
    'modeAtlasDisplayMode',
    'modeAtlasInstallPromptDismissedAt',
    'modeAtlasInstallPromptSeen',
    'modeAtlasLastBackupAt',
    'modeAtlasLastExportAt',
    'modeAtlasLastKanaPage',
    'modeAtlasLastMode',
    'modeAtlasLastStudiedAt',
    'modeAtlasLastVisitStudyDate',
    'modeAtlasLegalAccepted',
    'modeAtlasLegalAcceptedAt',
    'modeAtlasLegalVersion',
    'modeAtlasOnboardingComplete',
    'modeAtlasOnboardingPreset',
    'modeAtlasPresetAchievementProgress',
    'modeAtlasPresetAchievementUpdatedAt',
    'modeAtlasSaveSchemaMigrated',
    'modeAtlasSaveSchemaVersion',
    'modeAtlasSeenAchievementUnlocks',
    'modeAtlasSound',
    'modeAtlasSoundMode',
    'modeAtlasStartReadingPreset',
    'modeAtlasStarterSeen',
    'modeAtlasThemePreference',
    'modeAtlasVisitStreak'
  ].filter((value, index, list) => value && list.indexOf(value) === index));
  const APP_LOCAL_EXACT = Object.freeze([
    ...APP_BACKUP_EXACT,
    'modeAtlasCloudAccessState',
    'modeAtlasLastCloudErrorAt',
    'modeAtlasLastCloudErrorMessage',
    'modeAtlasLastCloudSyncAt',
    'modeAtlasLastUserId',
    'modeAtlasLegacyServiceWorkerRetirement',
    'modeAtlasLocalImportGuardUntil',
    'modeAtlasSectionTimestamps',
    'modeAtlasSafeMode',
    'modeAtlasSmokeSeeded'
  ].filter((value, index, list) => value && list.indexOf(value) === index));
  const APP_LOCAL_SET = new Set(APP_LOCAL_EXACT);
  const APP_SESSION_SET = new Set(APP_SESSION_EXACT);
  const APP_BACKUP_SET = new Set(APP_BACKUP_EXACT);

  function matchesOwnedKey(key, exactSet, prefixes) {
    const name = String(key || '');
    if (!name) return false;
    if (exactSet.has(name)) return true;
    return prefixes.some((prefix) => name.startsWith(prefix));
  }
  function isAppLocalKey(key) { return matchesOwnedKey(key, APP_LOCAL_SET, APP_LOCAL_PREFIXES); }
  function isAppSessionKey(key) { return matchesOwnedKey(key, APP_SESSION_SET, APP_SESSION_PREFIXES); }
  function storageEntries(storage) {
    const entries = [];
    try {
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key != null) entries.push([key, storage.getItem(key)]);
      }
    } catch {}
    return entries;
  }
  function snapshotAppStorage(storage = localStorage, kind = 'local') {
    const owns = kind === 'session' ? isAppSessionKey : isAppLocalKey;
    const out = {};
    storageEntries(storage).forEach(([key, value]) => { if (owns(key)) out[key] = value; });
    return out;
  }
  function isBackupKey(key) { return APP_BACKUP_SET.has(String(key || '')); }
  function snapshotBackupStorage(storage = localStorage) {
    const out = {};
    storageEntries(storage).forEach(([key, value]) => { if (isBackupKey(key)) out[key] = value; });
    return out;
  }
  function filterAppMap(map) {
    const out = {};
    if (!map || typeof map !== 'object' || Array.isArray(map)) return out;
    Object.entries(map).forEach(([key, value]) => { if (isBackupKey(key)) out[key] = value; });
    return out;
  }
  function applyAppMap(map) {
    const filtered = filterAppMap(map);
    Object.entries(filtered).forEach(([key, value]) => {
      if (value === undefined) return;
      set(key, typeof value === 'string' ? value : JSON.stringify(value));
    });
    return Object.keys(filtered);
  }
  function clearOwnedStorage(storage, owns) {
    const keys = storageEntries(storage).map(([key]) => key).filter(owns);
    keys.forEach((key) => { try { storage.removeItem(key); } catch {} });
    return keys;
  }
  function clearAppData() {
    return {
      local: clearOwnedStorage(localStorage, isAppLocalKey),
      session: clearOwnedStorage(sessionStorage, isAppSessionKey),
    };
  }


  function modeKeys(mode) {
    return GROUPS[mode === 'writing' || mode === 'reverse' ? 'writing' : 'reading'];
  }
  function readModeJSON(mode, name, fallback) {
    const key = modeKeys(mode)?.[name];
    return key ? json(key, fallback) : fallback;
  }
  function writeModeJSON(mode, name, value) {
    const key = modeKeys(mode)?.[name];
    return key ? setJSON(key, value) : false;
  }
  function readModeNumber(mode, name, fallback = 0) {
    const key = modeKeys(mode)?.[name];
    return key ? number(key, fallback) : fallback;
  }
  function writeModeNumber(mode, name, value) {
    const key = modeKeys(mode)?.[name];
    return key ? set(key, value) : false;
  }


  function safeParse(value, fallback) {
    if (value == null || value === '') return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
  }
  function get(key, fallback = '') {
    try { const value = localStorage.getItem(key); return value == null ? fallback : value; } catch { return fallback; }
  }
  function set(key, value) { try { localStorage.setItem(key, String(value)); markUpdatedForKey(key); return true; } catch { return false; } }
  function remove(key) { try { localStorage.removeItem(key); return true; } catch { return false; } }
  function has(key) { try { return localStorage.getItem(key) !== null; } catch { return false; } }
  function json(key, fallback) { return safeParse(get(key, null), fallback); }
  function setJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); markUpdatedForKey(key); return true; } catch { return false; } }
  function number(key, fallback = 0) { const n = Number(get(key, '')); return Number.isFinite(n) ? n : fallback; }
  function now(key) { const ts = String(Date.now()); set(key, ts); return ts; }
  function removeMany(keys) { (keys || []).forEach(remove); }
  function collect(keys) { const out = {}; (keys || []).forEach(key => { out[key] = get(key, null); }); return out; }
  function apply(map) { Object.entries(map || {}).forEach(([key, value]) => { if (value !== undefined) set(key, typeof value === 'string' ? value : JSON.stringify(value)); }); }
  function snapshot(prefix) {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || (prefix && !key.startsWith(prefix))) continue;
        out[key] = localStorage.getItem(key);
      }
    } catch {}
    return out;
  }
  function markUpdatedForKey(key) {
    const name = String(key || '');
    if (/^(settings|reverseSettings|modeAtlasThemePreference|modeAtlasDisplayMode|modeAtlasSound|modeAtlasSoundMode)$/.test(name)) return now('settingsUpdatedAt');
    if (/(testModeResults|charStats|reverseCharStats|charTimes|reverseCharTimes|scoreHistory)/.test(name)) return now('resultsUpdatedAt');
    if (/(charSrs|reverseCharSrs)/.test(name)) return now('srsUpdatedAt');
    if (/dailyChallengeHistory/.test(name)) return now('dailyUpdatedAt');
    return '';
  }

  window.ModeAtlasStorage = Object.freeze({ KEYS, GROUPS, COMPAT_KEYS, APP_CORE_EXACT, APP_LOCAL_EXACT, APP_LOCAL_PREFIXES, APP_SESSION_EXACT, APP_SESSION_PREFIXES, APP_BACKUP_EXACT, SAVE_SCHEMA_VERSION, SCHEMA_VERSION, modeKeys, readModeJSON, writeModeJSON, readModeNumber, writeModeNumber, safeParse, get, set, remove, has, json, setJSON, number, now, removeMany, collect, apply, snapshot, isAppLocalKey, isAppSessionKey, isBackupKey, snapshotAppStorage, snapshotBackupStorage, filterAppMap, applyAppMap, clearAppData, markUpdatedForKey });
})();
