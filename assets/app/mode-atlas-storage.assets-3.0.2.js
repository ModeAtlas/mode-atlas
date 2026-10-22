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
    wordBank: 'kanaWordBank',
    kanaLearning: 'modeAtlasKanaLearning', kanaLearningUpdatedAt: 'modeAtlasKanaLearningUpdatedAt',
    kanji: 'modeAtlasKanji', kanjiUpdatedAt: 'modeAtlasKanjiUpdatedAt',
    kanjiTests: 'modeAtlasKanjiTests', kanjiTestsUpdatedAt: 'modeAtlasKanjiTestsUpdatedAt',
    progress: 'modeAtlasProgress', progressUpdatedAt: 'modeAtlasProgressUpdatedAt'
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
    'modeAtlasWordLessons',
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
  const APP_LOCAL_PREFIXES = Object.freeze(['modeAtlasVersionFileCheckedResetDay:', 'modeAtlasVersionFileAttemptedResetDay:', 'modeAtlasAccountSave:']);
  const APP_SESSION_EXACT = Object.freeze([
    'modeAtlasDiagnostics',
    'modeAtlasActiveTour',
    'modeAtlasForceFirstVisit',
    'modeAtlasForceDailyReturn',
    'modeAtlasShowWhatsNewAfterOnboarding',
    'modeAtlasTourPending',
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
    'modeAtlasKanaSetupComplete',
    'modeAtlasKanaEvidence:reading',
    'modeAtlasKanaEvidence:writing',
    'modeAtlasResultsDeleted:reading',
    'modeAtlasResultsDeleted:writing',
    'modeAtlasResultsDeleted:kanji',
    'modeAtlasWordBankDeleted',
    'modeAtlasPresetAchievementProgress',
    'modeAtlasPresetAchievementUpdatedAt',
    'modeAtlasSaveSchemaMigrated',
    'modeAtlasSaveSchemaVersion',
    'modeAtlasSeenAchievementUnlocks',
    'modeAtlasSound',
    'modeAtlasHaptics',
    'modeAtlasSoundMode',
    'modeAtlasStartReadingPreset',
    'modeAtlasStarterSeen',
    'modeAtlasThemePreference',
    'modeAtlasVisitStreak'
  ].filter((value, index, list) => value && list.indexOf(value) === index));
  const APP_LOCAL_EXACT = Object.freeze([
    ...APP_BACKUP_EXACT,
    'modeAtlasCloudAccessState',
    'modeAtlasRewardAccess',
    'modeAtlasShopState',
    'modeAtlasSocialProfile',
    'modeAtlasAvatarProfile',
    'modeAtlasInstallPromptDismissedAt',
    'modeAtlasInstallPromptSeen',
    'modeAtlasLastCloudErrorAt',
    'modeAtlasLastCloudErrorMessage',
    'modeAtlasLastCloudSyncAt',
    'modeAtlasLastUserId',
    'modeAtlasLocalSaveOwner',
    'modeAtlasWidgetSuspended',
    'modeAtlasWidgetWeekly',
    'modeAtlasTourSeen',
    'modeAtlasLegacyServiceWorkerRetirement',
    'modeAtlasLocalImportGuardUntil',
    'modeAtlasPendingDestination',
    'modeAtlasProgressDeviceId',
    'modeAtlasSectionTimestamps',
    'modeAtlasSafeMode',
    'modeAtlasSmokeSeeded',
    'modeAtlasPracticeTransaction',
    'modeAtlasPracticeCheckpoint:reading',
    'modeAtlasPracticeCheckpoint:writing',
    'modeAtlasSaveGeneration',
    'modeAtlasEarningsOutbox',
    'modeAtlasUsageFunnel',
    'modeAtlasBranchToursSeen',
    'modeAtlasKanjiPlacement',
    'modeAtlasKanjiCheckpoint',
    'modeAtlasKanaPlacementCheckpoint'
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
    const result = {
      local: clearOwnedStorage(localStorage, isAppLocalKey),
      session: clearOwnedStorage(sessionStorage, isAppSessionKey),
    };
    window.dispatchEvent(new CustomEvent('modeAtlasDataCleared'));
    return result;
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
  const TRANSACTION_KEY='modeAtlasPracticeTransaction';
  let pendingWrites=null,pendingEffects=null;
  function notifyCommitted(effect){
    try{effect();}catch(error){window.ModeAtlasDiagnostics?.record?.('save-observer',error);}
  }
  function afterCommit(effect){
    if(typeof effect!=='function')return;
    if(pendingWrites)pendingEffects.push(effect);else notifyCommitted(effect);
  }
  // Large JSON saves use a small, checksummed change journal. The authoritative
  // value is still committed synchronously; no debounce can lose the last answer.
  function digest(text){let a=2166136261,b=2246822519;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,3266489917);}return text.length+':'+(a>>>0)+':'+(b>>>0);}
  function applyPatch(text,patch){
    const checksum=digest(text);
    if(checksum===patch.after)return text;
    if(checksum!==patch.before)throw Error('A pending save no longer matches this device. Keep the recovery data and restore a backup.');
    const value=JSON.parse(text);
    if(!Array.isArray(patch.ops)||patch.ops.length>10000)throw Error('Invalid save recovery.');
    for(const op of patch.ops){
      if(!Array.isArray(op.path)||!op.path.length||op.path.length>32||op.path.some(key=>typeof key!=='string'||['__proto__','constructor','prototype'].includes(key)))throw Error('Invalid save recovery path.');
      let target=value;for(const key of op.path.slice(0,-1)){if(!target||!Object.hasOwn(target,key))throw Error('Invalid save recovery parent.');target=target[key];}
      const key=op.path.at(-1);if(op.remove)delete target[key];else Object.defineProperty(target,key,{value:op.value,writable:true,enumerable:true,configurable:true});
    }
    const result=JSON.stringify(value);if(digest(result)!==patch.after)throw Error('The pending save could not be verified.');return result;
  }
  function journalValue(key,next){
    if(typeof next!=='string'||next.length<65536)return next;
    const previous=localStorage.getItem(key);if(!previous||previous.length<65536)return next;
    try{
      const ops=[],map=value=>value&&typeof value==='object'&&!Array.isArray(value);
      function equal(a,b){
        if(a===b)return true;
        if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((value,index)=>equal(value,b[index]));
        if(a&&b&&typeof a==='object'&&typeof b==='object')return JSON.stringify(a)===JSON.stringify(b);
        return false;
      }
      function diff(a,b,path=[]){
        if(a===b)return;
        if(ops.length>10000||path.length>32)throw Error('Full save required');
        if(map(a)&&map(b)){
          const before=Object.keys(a),after=Object.keys(b);
          const rebuilt=before.filter(key=>Object.hasOwn(b,key)).concat(after.filter(key=>!Object.hasOwn(a,key)));
          // Reordered bounded maps (for example recent session receipts) need
          // their own replacement, not a second copy of the entire large save.
          if(rebuilt.some((key,index)=>key!==after[index])){
            if(!path.length)throw Error('Full save required');
            ops.push({path,value:b});return;
          }
          for(const key of before){
            if(['__proto__','constructor','prototype'].includes(key))throw Error('Full save required');
            if(!Object.hasOwn(b,key))ops.push({path:[...path,key],remove:true});
            else diff(a[key],b[key],[...path,key]);
          }
          for(const key of after)if(!Object.hasOwn(a,key)){
            if(['__proto__','constructor','prototype'].includes(key))throw Error('Full save required');
            ops.push({path:[...path,key],value:b[key]});
          }
        }else if(!equal(a,b)){
          if(!path.length)throw Error('Full save required');
          ops.push({path,value:b});
        }
      }
      diff(JSON.parse(previous),JSON.parse(next));
      const patch={kind:'json-patch-v1',before:digest(previous),after:digest(next),ops};
      // Replay verifies both checksums. Do not parse, apply and stringify the
      // entire save a second time just to dry-run the same deterministic ops.
      return JSON.stringify(patch).length<next.length/2?patch:next;
    }catch{return next;}
  }

  // A synchronous write-ahead journal commits answer stats, XP and the local
  // checkpoint together. Replay happens before any progression owner loads.
  function commitTransaction(entries){
    if(!entries||typeof entries!=='object'||Array.isArray(entries))return;
    for(const [key,value]of Object.entries(entries))if(isAppLocalKey(key)&&key!==TRANSACTION_KEY){if(value===null)localStorage.removeItem(key);else if(typeof value==='string')localStorage.setItem(key,value);else if(value?.kind==='json-patch-v1')localStorage.setItem(key,applyPatch(localStorage.getItem(key)||'',value));}
    localStorage.removeItem(TRANSACTION_KEY);
  }
  function replayTransaction(){commitTransaction(safeParse(localStorage.getItem(TRANSACTION_KEY),null));}
  try{const pending=!!localStorage.getItem(TRANSACTION_KEY);replayTransaction();if(pending)window.__maRecoveredPractice=true;}catch(error){console.warn('Practice recovery is waiting for available storage.',error);}
  function transaction(action){
    if(pendingWrites)return action();
    const started=window.performance?.now?.();
    // Preserve an interrupted commit until it can finish; a later answer must
    // never replace its recovery journal when storage is still unavailable.
    if(localStorage.getItem(TRANSACTION_KEY)){replayTransaction();window.ModeAtlasUsage?.event('saveRecovered');}
    pendingWrites={};pendingEffects=[];
    try{
      const result=action(),writes=pendingWrites,effects=pendingEffects;pendingWrites=null;pendingEffects=null;
      if(Object.keys(writes).length){
        const journal=Object.fromEntries(Object.entries(writes).map(([key,value])=>[key,journalValue(key,value)]));
        localStorage.setItem(TRANSACTION_KEY,JSON.stringify(journal));
        // The original, serialized values are still available on this stack.
        // Commit those directly after the recovery journal is durable. Only an
        // interrupted commit needs to reconstruct and verify a JSON patch.
        commitTransaction(writes);
      }
      effects.forEach(notifyCommitted);
      return result;
    }catch(error){pendingWrites=null;pendingEffects=null;window.ModeAtlasUsage?.event('saveFailed');throw error;}
    finally{if(started!==undefined)window.ModeAtlasDiagnostics?.duration?.('local-save',window.performance.now()-started);}
  }
  function get(key, fallback = '') {
    try { const value = pendingWrites&&Object.prototype.hasOwnProperty.call(pendingWrites,key)?pendingWrites[key]:localStorage.getItem(key); return value == null ? fallback : value; } catch { return fallback; }
  }
  function set(key, value) { try { if(pendingWrites){if(!isAppLocalKey(key))throw new Error('Unowned practice storage key');pendingWrites[key]=String(value);}else localStorage.setItem(key,String(value));markUpdatedForKey(key);return true; } catch { return false; } }
  function remove(key) { try { if(pendingWrites)pendingWrites[key]=null;else localStorage.removeItem(key);return true; } catch { return false; } }
  function has(key) { return get(key,null)!==null; }
  function json(key, fallback) { return safeParse(get(key, null), fallback); }
  function setJSON(key, value) { try { return set(key,JSON.stringify(value)); } catch { return false; } }
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

  window.ModeAtlasStorage = Object.freeze({ KEYS, GROUPS, COMPAT_KEYS, APP_CORE_EXACT, APP_LOCAL_EXACT, APP_LOCAL_PREFIXES, APP_SESSION_EXACT, APP_SESSION_PREFIXES, APP_BACKUP_EXACT, SAVE_SCHEMA_VERSION, SCHEMA_VERSION, transaction, afterCommit, modeKeys, readModeJSON, writeModeJSON, readModeNumber, writeModeNumber, safeParse, get, set, remove, has, json, setJSON, number, now, removeMany, collect, apply, snapshot, isAppLocalKey, isAppSessionKey, isBackupKey, snapshotAppStorage, snapshotBackupStorage, filterAppMap, applyAppMap, clearAppData, markUpdatedForKey });
})();
