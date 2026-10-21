/* Developer-only file UI. Cloud sync owns the backup format and import policy. */
(function ModeAtlasDevBackups(root){
  'use strict';
  if (root.ModeAtlasDevBackups) return;
  let busy = false;
  const userId = () => root.KanaCloudSync?.getUser?.()?.uid || null;
  function assertAccess(owner){
    if (!root.ModeAtlasDevConsoleLoader?.isEligible?.()) throw new Error('Developer access is required.');
    if (owner !== userId()) throw new Error('The account changed. Start the file action again.');
    if (!root.KanaCloudSync) throw new Error('Save management is unavailable. Reload and try again.');
  }
  function status(message, tone = 'info'){
    root.ModeAtlasFeedback?.status?.('[data-ma-dev-backup-status]', message, tone);
  }
  function exported(){
    const now = String(Date.now());
    root.ModeAtlasStorage.set('modeAtlasLastExportAt', now);
    root.ModeAtlasStorage.set('modeAtlasLastBackupAt', now);
  }
  async function run(action){
    if (busy) return false;
    busy = true;
    const owner = userId();
    try {
      assertAccess(owner);
      return await action(owner);
    } catch (error) {
      console.warn('Developer save file action failed.', error);
      status(error.message || 'Save file action failed.', 'error');
      root.ModeAtlasFeedback?.toast?.(error.message || 'Save file action failed.', 'error', 4200);
      return false;
    } finally { busy = false; }
  }
  async function share(backup, owner){
    const result = await root.AtlasPlatform.exportBackup({
      contents: JSON.stringify(backup, null, 2),
      filename: 'mode-atlas-save-' + new Date().toISOString().slice(0,10) + '.json'
    });
    assertAccess(owner);
    if (result.supported === false) throw new Error('Save export is unavailable.');
    if (result.completed) exported();
    status(result.completed ? 'Save exported.' : 'Export cancelled.', result.completed ? 'success' : 'info');
    return !!result.completed;
  }
  function exportFile(){
    return run(owner => share(root.KanaCloudSync.createBackup(), owner));
  }
  function copyFile(){
    return run(async owner => {
      const backup = root.KanaCloudSync.createBackup();
      try { await navigator.clipboard.writeText(JSON.stringify(backup, null, 2)); }
      catch { assertAccess(owner); return share(backup, owner); }
      assertAccess(owner);
      exported();
      status('Save copied.', 'success');
      return true;
    });
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

  function formatImportDate(ts){
    const n = Number(ts || 0);
    if (!Number.isFinite(n) || !n) return 'unknown export date';
    const date = new Date(n);
    if (Number.isNaN(date.getTime())) return 'unknown export date';
    return date.toLocaleString([], { day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit' });
  }

  async function showImportConfirm(parsed){
    const preview = window.KanaCloudSync.previewLocalBackup(parsed);
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
      kicker: 'Developer save import',
      title: 'Review imported save',
      message: 'Importing replaces the matching data on this device. Empty sections keep their current data. If signed in, this test data can replace the account’s cloud save.',
      contentNode: content,
      confirmLabel: 'Continue import',
      cancelLabel: 'Cancel',
      tone: 'warning',
      wide: true
    }) ?? false;
  }

  function importFile(file){
    if (!file) return Promise.resolve(false);
    return run(async owner => {
      const parsed = JSON.parse(await file.text());
      assertAccess(owner);
      const confirmed = await showImportConfirm(parsed);
      if (!confirmed) return false;
      assertAccess(owner);
      status('Importing save…');
      await root.KanaCloudSync.importLocalBackup(parsed);
      assertAccess(owner);
      root.ModeAtlasFeedback?.toast?.('Save imported. Reloading…', 'success');
      setTimeout(() => { if (owner === userId()) location.reload(); }, 350);
      return true;
    });
  }
  root.ModeAtlasDevBackups = Object.freeze({exportFile, copyFile, importFile});
})(window);
