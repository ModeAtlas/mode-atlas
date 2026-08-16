/* Mode Atlas save repair and schema migration owner.
   Normal page loads only run migrations that have not yet been applied to the
   current save schema. The Repair button remains an explicit full integrity check. */
(function ModeAtlasSaveRepairModule(){
  if (window.__modeAtlasSaveRepairLoaded) return;
  window.__modeAtlasSaveRepairLoaded = true;

  const Store = window.ModeAtlasStorage;
  const K = Store?.KEYS || {};
  const SAVE_SCHEMA_KEY = 'modeAtlasSaveSchemaVersion';

  function currentSchemaVersion(){
    const value = Number(window.ModeAtlasSaveSchemaVersion ?? Store?.SAVE_SCHEMA_VERSION ?? Store?.SCHEMA_VERSION ?? 1);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
  }

  function storedSchemaVersion(){
    const value = Number(storeGet(SAVE_SCHEMA_KEY, '0') || 0);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  }

  function storeGet(key, fallback){
    return Store?.get?.(key, fallback) ?? localStorage.getItem(key) ?? fallback;
  }

  function storeSet(key, value){
    return Store?.set?.(key, value) ?? localStorage.setItem(key, String(value));
  }

  function readJSON(key, fallback){
    try {
      if (Store?.json) return Store.json(key, fallback);
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }
    catch(e) { return fallback; }
  }

  function writeJSON(key, value){
    try {
      if (Store?.setJSON) return Store.setJSON(key, value);
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }
    catch(e) { return false; }
  }

  function arrayValue(key){
    var value = readJSON(key, []);
    return Array.isArray(value) ? value : [];
  }

  function signature(item){
    if (item && typeof item === 'object') {
      return String(item.id || item.createdAt || item.completedAt || item.date || item.startedAt || '') + '|' + JSON.stringify(item).slice(0, 220);
    }
    return String(item);
  }

  function dedupeArrayKey(key){
    var input = arrayValue(key);
    if (!input.length) return 0;
    var seen = new Set();
    var output = [];
    input.forEach(function(item){
      var sig = signature(item);
      if (seen.has(sig)) return;
      seen.add(sig);
      output.push(item);
    });
    if (output.length === input.length) return 0;
    writeJSON(key, output);
    return input.length - output.length;
  }

  function ensureSectionTimestamps(){
    var now = Date.now();
    var changed = 0;
    var map = {
      settingsUpdatedAt: ['settings','reverseSettings','modeAtlasThemePreference','modeAtlasDisplayMode','modeAtlasSound'],
      resultsUpdatedAt: [K.readingTestResults||'testModeResults',K.readingTestResultsBackup||'readingTestModeResults',K.writingTestResults||'writingTestModeResults','kanaTrainerReadingTestModeResults','kanaTrainerWritingTestModeResults',K.readingCharStats||'charStats',K.writingCharStats||'reverseCharStats',K.readingCharTimes||'charTimes',K.writingCharTimes||'reverseCharTimes'],
      srsUpdatedAt: ['charSrs','reverseCharSrs'],
      dailyUpdatedAt: [K.readingDailyHistory||'dailyChallengeHistory',K.writingDailyHistory||'reverseDailyChallengeHistory'],
      profileUpdatedAt: ['modeAtlasLastCloudSyncAt','modeAtlasLastUserId']
    };
    Object.keys(map).forEach(function(tsKey){
      if (storeGet(tsKey, '')) return;
      var hasData = map[tsKey].some(function(key){ return storeGet(key, null) !== null; });
      if (hasData) { storeSet(tsKey, String(now)); changed += 1; }
    });
    return changed;
  }

  function repairSaveData(){
    var changed = 0;
    [
      'testModeResults',
      'readingTestModeResults',
      'kanaTrainerReadingTestModeResults',
      'writingTestModeResults',
      'kanaTrainerWritingTestModeResults'
    ].forEach(function(key){ changed += dedupeArrayKey(key); });
    return { changed: changed, summary: changed ? changed + ' cleanup change(s)' : 'no problems found' };
  }

  function scheduleCloudSyncIfChanged(changed){
    if (!(Number(changed) > 0)) return false;
    try { return !!window.KanaCloudSync?.scheduleSync?.(500); } catch(e) { return false; }
  }

  function repairDataModel(options){
    options = options || {};
    var result = repairSaveData();
    var timestampChanges = ensureSectionTimestamps();
    var changed = (result.changed || 0) + timestampChanges;
    var meta = {
      saveSchemaVersion: currentSchemaVersion(),
      settingsUpdatedAt: Number(storeGet('settingsUpdatedAt', '0') || 0),
      resultsUpdatedAt: Number(storeGet('resultsUpdatedAt', '0') || 0),
      srsUpdatedAt: Number(storeGet('srsUpdatedAt', '0') || 0),
      dailyUpdatedAt: Number(storeGet('dailyUpdatedAt', '0') || 0),
      profileUpdatedAt: Number(storeGet('profileUpdatedAt', '0') || 0)
    };
    if (options.sync !== false) scheduleCloudSyncIfChanged(changed);
    try { window.dispatchEvent(new CustomEvent('modeAtlasDataModelRepaired', { detail: meta })); } catch(e) {}
    return {
      changed: changed,
      summary: timestampChanges ? result.summary + ' · timestamps checked' : result.summary,
      meta: meta
    };
  }

  /* Schema migrations are deliberately explicit. A future schema bump must add
     its migration here before the save can be marked as that schema. */
  const MIGRATIONS = Object.freeze([
    Object.freeze({
      version: 3,
      run: function(){ return repairDataModel({ sync: false }); }
    })
  ]);

  function runPendingMigrations(){
    var target = currentSchemaVersion();
    var current = storedSchemaVersion();
    if (current >= target) return { changed: 0, from: current, to: current, migrated: false };

    var changed = 0;
    var applied = current;
    MIGRATIONS.forEach(function(migration){
      if (migration.version <= current || migration.version > target) return;
      var result = migration.run();
      changed += Number(result?.changed || 0);
      applied = migration.version;
      storeSet(SAVE_SCHEMA_KEY, String(applied));
    });

    if (applied < target) {
      console.warn('Mode Atlas save schema migration is missing for version', target);
      return { changed: changed, from: current, to: applied, migrated: applied > current, incomplete: true };
    }

    scheduleCloudSyncIfChanged(changed);
    try {
      window.dispatchEvent(new CustomEvent('modeAtlasSaveSchemaMigrated', {
        detail: { from: current, to: applied, changed: changed }
      }));
    } catch(e) {}
    return { changed: changed, from: current, to: applied, migrated: true };
  }

  function repairAfterCloudHydration(event){
    if (String(event?.detail?.source || '') !== 'hydrate') return;
    repairDataModel({ sync: true });
  }

  function handleRepairClick(event){
    var button = event?.target?.closest?.('[data-ma-repair-data]');
    if (!button) return;
    event.preventDefault();

    var result = repairDataModel({ sync: true });
    var message = 'Repair complete · ' + result.summary;
    try {
      if (window.ModeAtlasFeedback?.toast) window.ModeAtlasFeedback.toast(message, 'success', 4200);
      else button.setAttribute('aria-label', message);
    } catch(err) {}
  }

  window.ModeAtlas = window.ModeAtlas || {};
  window.ModeAtlas.repairSaveData = repairSaveData;
  window.ModeAtlas.repairDataModel = repairDataModel;
  window.ModeAtlas.runPendingSaveMigrations = runPendingMigrations;

  function boot(){ runPendingMigrations(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  // Settings is mounted dynamically after this module on every page. Delegate
  // the action once at document level so there is one repair owner regardless
  // of when the shared drawer is created or recreated.
  document.addEventListener('click', handleRepairClick);
  window.addEventListener('modeAtlasCloudDataChanged', repairAfterCloudHydration);
})();
