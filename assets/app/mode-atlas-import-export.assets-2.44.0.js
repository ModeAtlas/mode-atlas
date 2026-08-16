/* Mode Atlas import/export UI. Owns save, backup import preview, and reset-data controls. */
(function ModeAtlasUnifiedSaveSyncUi(){
  if (window.__modeAtlasUnifiedSaveSyncUiLoaded) return;
  window.__modeAtlasUnifiedSaveSyncUiLoaded = true;

  // Save/import controls are rendered by assets/ui/mode-atlas-settings-menu.js.


  const BACKUP_FORMAT_VERSION = Number(window.ModeAtlasBackupFormatVersion || 1);

  const RESET_WARNING = 'This clears Mode Atlas save data on this device. If you are signed in and cloud is available, it also clears the cloud save for this account. This cannot be undone.';

  function fallbackBackup(){
    const store = window.ModeAtlasStorage;
    const data = store?.snapshotBackupStorage ? store.snapshotBackupStorage(localStorage) : {};
    return { app: 'Mode Atlas', version: BACKUP_FORMAT_VERSION, exportedAt: new Date().toISOString(), data };
  }

  function getBackup(){
    try { return window.KanaCloudSync?.createBackup?.() || fallbackBackup(); }
    catch { return fallbackBackup(); }
  }

  const SAVE_STATUS_SELECTOR = '[data-ma-save-status]';

  function setStatus(message, tone = 'info'){
    window.ModeAtlasFeedback?.status?.(SAVE_STATUS_SELECTOR, message, tone);
  }

  function clearStatus(){
    window.ModeAtlasFeedback?.clearStatus?.(SAVE_STATUS_SELECTOR);
  }

  function notify(message, tone = 'info', duration = 2800){
    window.ModeAtlasFeedback?.toast?.(message, tone, duration);
  }

  function markBackupExported(){
    try {
      const now = String(Date.now());
      window.ModeAtlasStorage?.set?.('modeAtlasLastExportAt', now) ?? localStorage.setItem('modeAtlasLastExportAt', now);
      window.ModeAtlasStorage?.set?.('modeAtlasLastBackupAt', now) ?? localStorage.setItem('modeAtlasLastBackupAt', now);
      document.dispatchEvent(new CustomEvent('ma:progress-updated', { detail: { source: 'backup-export' } }));
      window.ModeAtlasFeatures?.checkAchievements?.();
    } catch {}
  }

  function downloadBackup(){
    const backup = getBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mode-atlas-save-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    markBackupExported();
    clearStatus();
    notify('Save exported.', 'success');
    refreshSyncPills();
  }

  async function copyBackup(){
    const txt = JSON.stringify(getBackup(), null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      markBackupExported();
      clearStatus();
      notify('Save copied.', 'success');
    } catch {
      downloadBackup();
    }
    refreshSyncPills();
  }




  function createImportEl(tag, className = '', text = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== '') el.textContent = text;
    return el;
  }

  function appendStrongLine(parent, label, value) {
    const span = document.createElement('span');
    span.append(document.createTextNode(label + ': '));
    const strong = document.createElement('strong');
    strong.textContent = String(value);
    span.append(strong);
    parent.append(span);
  }

  function fallbackImportPreview(parsed){
    const Store = window.ModeAtlasStorage;
    const K = Store?.KEYS || {};
    const readingKeys = Store?.modeKeys?.('reading') || {};
    const writingKeys = Store?.modeKeys?.('writing') || {};
    const legacy = {
      readingTests: ['testModeResults', K.readingTestResultsBackup, 'kanaTrainerTestModeResults', 'kanaTrainerReadingTestModeResults'].filter(Boolean),
      writingTests: [K.writingTestResults, K.writingTestResultsBackup, 'kanaTrainerWritingTestModeResults'].filter(Boolean)
    };

    const data = parsed?.data || parsed?.localStorage || parsed;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid save file');

    const has = (key) => !!key && Object.prototype.hasOwnProperty.call(data, key);
    const readArray = (key) => {
      if (!has(key)) return [];
      const value = data[key];
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try { const parsedValue = JSON.parse(value); return Array.isArray(parsedValue) ? parsedValue : []; }
        catch { return []; }
      }
      return [];
    };
    const countObj = (key) => {
      if (!has(key)) return 0;
      const value = data[key];
      let parsedValue = value;
      if (typeof value === 'string') {
        try { parsedValue = JSON.parse(value); } catch { parsedValue = null; }
      }
      return parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue) ? Object.keys(parsedValue).length : 0;
    };
    const modeWillImport = (keys) => Object.values(keys || {}).some(has);
    const maxArrayCount = (keys) => Math.max(0, ...(keys || []).map((key) => readArray(key).length));

    const sections = [
      {
        name:'reading',
        label:'Reading Practice',
        current: Object.keys(Store?.readModeJSON?.('reading','charStats',{}) || {}).length + ' kana stats',
        incoming: countObj(readingKeys.charStats) + ' kana stats',
        willImport: modeWillImport(readingKeys)
      },
      {
        name:'writing',
        label:'Writing Practice',
        current: Object.keys(Store?.readModeJSON?.('writing','charStats',{}) || {}).length + ' kana stats',
        incoming: countObj(writingKeys.charStats) + ' kana stats',
        willImport: modeWillImport(writingKeys)
      },
      {
        name:'readingTests',
        label:'Reading Test Results',
        current: readArrayFromLocal(K.readingTestResults || 'testModeResults').length + ' reading tests',
        incoming: maxArrayCount(legacy.readingTests).toString() + ' reading tests',
        willImport: legacy.readingTests.some(has)
      },
      {
        name:'writingTests',
        label:'Writing Test Results',
        current: readArrayFromLocal(K.writingTestResults || 'writingTestModeResults').length + ' writing tests',
        incoming: maxArrayCount(legacy.writingTests).toString() + ' writing tests',
        willImport: legacy.writingTests.some(has)
      },
      {
        name:'wordBank',
        label:'Word Bank',
        current: readArrayFromLocal(K.wordBank || 'kanaWordBank').length + ' word bank items',
        incoming: readArray(K.wordBank || 'kanaWordBank').length + ' word bank items',
        willImport: has(K.wordBank || 'kanaWordBank')
      }
    ].map((section) => ({ ...section, action: section.willImport ? 'Will replace from backup' : 'Will keep current data' }));
    return { exportedAt: Date.parse(parsed?.exportedAt || '') || 0, sections };
  }

  function readArrayFromLocal(key){
    try { const value = window.ModeAtlasStorage?.json?.(key, []) ?? []; return Array.isArray(value) ? value : []; }
    catch { return []; }
  }

  function buildImportPreview(parsed){
    if (window.KanaCloudSync?.previewLocalBackup) return window.KanaCloudSync.previewLocalBackup(parsed);
    return fallbackImportPreview(parsed);
  }

  function formatImportDate(ts){
    const n = Number(ts || 0);
    if (!Number.isFinite(n) || !n) return 'unknown export date';
    const date = new Date(n);
    if (Number.isNaN(date.getTime())) return 'unknown export date';
    return date.toLocaleString([], { day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit' });
  }

  async function showImportConfirm(parsed){
    const preview = buildImportPreview(parsed);
    const content = createImportEl('div', 'ma-import-confirm-content');
    const meta = createImportEl('div', 'ma-import-confirm-meta');
    const table = createImportEl('div', 'ma-import-confirm-table');
    const importing = (preview.sections || []).filter((section) => section.willImport).length;

    appendStrongLine(meta, 'Backup exported', formatImportDate(preview.exportedAt));
    appendStrongLine(meta, 'Sections to import', importing);

    const head = createImportEl('div', 'ma-import-confirm-row head');
    ['Section', 'Current loaded', 'Imported save', 'Action'].forEach(label => head.append(createImportEl('span', '', label)));

    const rows = (preview.sections || []).map((section) => {
      const row = createImportEl('div', 'ma-import-confirm-row');
      const label = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = String(section.label || '');
      label.append(strong);
      row.append(label, createImportEl('span', '', section.current || ''), createImportEl('span', '', section.incoming || ''));
      row.append(createImportEl('span', section.willImport ? 'will-import' : 'will-keep', section.action || ''));
      return row;
    });

    table.replaceChildren(head, ...rows);
    content.append(meta, table);

    return window.ModeAtlasFeedback?.confirm?.({
      kicker: 'Save import',
      title: 'Review imported save',
      message: 'Backup sections containing real data will replace the matching local section. Empty backup sections will keep the useful data already on this device.',
      contentNode: content,
      confirmLabel: 'Continue import',
      cancelLabel: 'Cancel',
      tone: 'warning',
      wide: true
    }) ?? false;
  }

  async function applyImportPayload(parsed){
    if (window.KanaCloudSync?.importLocalBackup) {
      return window.KanaCloudSync.importLocalBackup(parsed);
    }
    const data = parsed.data || parsed.localStorage || parsed;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid save file');
    const store = window.ModeAtlasStorage;
    if (!store?.applyAppMap) throw new Error('Mode Atlas storage boundary is unavailable');
    const importedKeys = store.applyAppMap(data);
    return { updated: importedKeys.length ? ['local'] : [], keptLocal: [], cloudSynced: false, importedKeys };
  }

  async function previewAndImport(parsed, options = {}){
    const confirmed = await showImportConfirm(parsed);
    if (!confirmed) {
      clearStatus();
      notify('Import cancelled.', 'info', 2200);
      return false;
    }
    setStatus('Importing backup…', 'info');
    const result = await applyImportPayload(parsed);
    setStatus('Save imported. Reloading…', 'success');
    if (typeof options.afterImport === 'function') options.afterImport(result);
    else setTimeout(() => location.reload(), 350);
    return true;
  }

  async function importBackupFile(file){
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text || '{}');
      setStatus('Review import before continuing…', 'info');
      await previewAndImport(parsed);
    } catch (error) {
      console.warn('Save import failed.', error);
      setStatus('Import failed. Please choose a valid Mode Atlas save file.', 'error');
      notify('Import failed. Please choose a valid Mode Atlas save file.', 'error', 4200);
    }
  }

  async function resetData(){
    const confirmed = await window.ModeAtlasFeedback?.confirm?.({
      kicker: 'Save management',
      title: 'Reset all Mode Atlas data?',
      message: RESET_WARNING,
      confirmLabel: 'Reset data',
      cancelLabel: 'Keep data',
      tone: 'danger'
    });
    if (!confirmed) return;
    try {
      setStatus('Resetting save data…', 'warning');
      if (window.KanaCloudSync?.ready) await window.KanaCloudSync.ready;
      if (window.KanaCloudSync?.resetAllData) await window.KanaCloudSync.resetAllData();
      else {
        const store = window.ModeAtlasStorage;
        if (!store?.clearAppData) throw new Error('Mode Atlas storage boundary is unavailable');
        store.clearAppData();
      }
      if (window.ModeAtlasVersionFile?.navigate) window.ModeAtlasVersionFile.navigate('/');
      else location.href = '/';
    } catch (error) {
      console.warn('Reset failed.', error);
      setStatus('Reset failed. Please check your connection and try again.', 'error');
      notify('Reset failed. Please check your connection and try again.', 'error', 4200);
    }
  }

  function refreshSyncPills(){
    window.ModeAtlasProfile?.refresh?.();
  }

  document.addEventListener('click', (event) => {
    const exportBtn = event.target.closest('[data-ma-unified-export]');
    const copyBtn = event.target.closest('[data-ma-unified-copy]');
    const importBtn = event.target.closest('[data-ma-unified-import]');
    const resetBtn = event.target.closest('[data-ma-unified-reset]');
    if (!exportBtn && !copyBtn && !importBtn && !resetBtn) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (exportBtn) downloadBackup();
    if (copyBtn) copyBackup();
    if (importBtn) importBtn.closest('.ma-save-section')?.querySelector('[data-ma-unified-file]')?.click();
    if (resetBtn) resetData();
  }, true);

  document.addEventListener('change', (event) => {
    const input = event.target.closest('[data-ma-unified-file]');
    if (!input) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    importBackupFile(input.files && input.files[0]);
    input.value = '';
  }, true);

  // Profile/Settings owns live sync-state rendering. Save management only asks
  // Profile for a refresh after operations that actually change backup metadata.
})();
