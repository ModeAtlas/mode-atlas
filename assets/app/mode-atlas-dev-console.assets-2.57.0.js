(function ModeAtlasDevConsole(){
  'use strict';
  if (window.__modeAtlasDevConsoleLoaded) return;
  window.__modeAtlasDevConsoleLoaded = true;

  const DEV_EMAIL = 'admin@mode-atlas.com';
  const $ = (sel, root = document) => root.querySelector(sel);
  const toast = (message, type = 'info', ms = 2800) => {
    try { return window.ModeAtlas?.toast?.(message, type, ms); } catch { return null; }
  };

  function storeGet(key, fallback = '') {
    const store = window.ModeAtlasStorage;
    return store?.get?.(key, fallback) ?? localStorage.getItem(key) ?? fallback;
  }

  function storeJSON(key, fallback) {
    const store = window.ModeAtlasStorage;
    if (store?.json) return store.json(key, fallback);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }

  function currentUserEmail(){
    try {
      const user = window.KanaCloudSync?.getUser?.() || window.currentUser || null;
      return String(user?.email || '').trim().toLowerCase();
    } catch { return ''; }
  }

  function isLocalDevHost(){
    try {
      return !!window.ModeAtlasEnv?.isLocalhost || /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname || '');
    } catch { return false; }
  }

  function canUseDevTools(){
    return isLocalDevHost() || currentUserEmail() === DEV_EMAIL;
  }

  function pageName(){
    try { if (window.ModeAtlasPageName) return String(window.ModeAtlasPageName()).toLowerCase(); } catch {}
    return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  }

  function fmtDate(ts){
    const n = Number(ts || 0);
    if (!Number.isFinite(n) || !n) return 'never';
    try { return new Date(n).toLocaleString([], { hour:'numeric', minute:'2-digit', day:'numeric', month:'numeric', year:'2-digit' }); }
    catch { return 'never'; }
  }

  function safeJSON(key, fallback){
    try { return storeJSON(key, fallback); } catch { return fallback; }
  }

  function statTotals(key){
    const stats = safeJSON(key, {});
    let correct = 0, wrong = 0;
    Object.values(stats || {}).forEach(value => {
      if (!value || typeof value !== 'object') return;
      correct += Number(value.correct || value.right || 0);
      wrong += Number(value.wrong || value.incorrect || 0);
    });
    const total = correct + wrong;
    return { correct, wrong, total, accuracy: total ? Math.round((correct / total) * 100) : 0 };
  }

  function countArray(key){
    const value = safeJSON(key, []);
    return Array.isArray(value) ? value.length : 0;
  }

  function allStorageKeys(){
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i += 1) keys.push(localStorage.key(i));
    } catch {}
    return keys.filter(Boolean).sort();
  }

  function storageBytes(){
    let bytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        bytes += (key?.length || 0) + (localStorage.getItem(key)?.length || 0);
      }
    } catch {}
    return bytes;
  }

  function jsonStatus(key, fallback){
    try {
      const value = safeJSON(key, fallback);
      return {
        ok: true,
        type: Array.isArray(value) ? 'array' : typeof value,
        count: Array.isArray(value) ? value.length : (value && typeof value === 'object' ? Object.keys(value).length : 0)
      };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  }

  function sectionUpdatedAt(key){
    return fmtDate(storeGet(key, '0'));
  }

  function collectDataFlow(){
    const reading = statTotals('charStats');
    const writing = statTotals('reverseCharStats');
    const readingResults = countArray('readingTestModeResults') + countArray('testModeResults') + countArray('kanaTrainerReadingTestModeResults');
    const writingResults = countArray('writingTestModeResults') + countArray('kanaTrainerWritingTestModeResults');
    const wordBank = jsonStatus('kanaWordBank', []);
    const settings = jsonStatus('settings', {});
    const storage = window.ModeAtlasStorage;
    const snapshot = window.KanaCloudSync?.debugLocalSnapshot?.();
    const status = window.KanaCloudSync?.getSyncStatus?.() || {};
    return {
      readingAnswers: reading.total,
      readingAccuracy: `${reading.accuracy}%`,
      writingAnswers: writing.total,
      writingAccuracy: `${writing.accuracy}%`,
      readingResults,
      writingResults,
      wordBankEntries: wordBank.count,
      settingsValid: settings.ok,
      localKeys: allStorageKeys().length,
      localBytes: storageBytes(),
      storageApi: !!storage,
      cloudConfigured: !!window.KanaCloudSync?.isConfigured?.(),
      cloudSignedIn: !!status.user,
      cloudState: status.text || 'n/a',
      cloudLastSync: fmtDate(status.lastSync || storeGet('modeAtlasLastCloudSyncAt', '0')),
      snapshotSections: snapshot?.sections ? Object.keys(snapshot.sections).length : 0,
      readingUpdated: sectionUpdatedAt('kanaReadingUpdatedAt'),
      writingUpdated: sectionUpdatedAt('kanaWritingUpdatedAt'),
      resultsUpdated: sectionUpdatedAt('kanaResultsUpdatedAt'),
      wordBankUpdated: sectionUpdatedAt('kanaWordBankUpdatedAt')
    };
  }

  function withTimeout(promise, ms, fallback){
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(fallback), ms);
      Promise.resolve(promise)
        .then(value => { clearTimeout(timer); resolve(value); })
        .catch(error => { clearTimeout(timer); resolve({ error: error?.message || String(error) }); });
    });
  }

  async function getServiceWorkerInfo(){
    const info = {
      supported: 'serviceWorker' in navigator,
      controlled: !!navigator.serviceWorker?.controller,
      appVersion: (window.ModeAtlasEnv && window.ModeAtlasEnv.appVersion) || window.ModeAtlasVersion || 'dev-local',
      cacheRevision: (window.ModeAtlasEnv && window.ModeAtlasEnv.cacheRevision) || window.ModeAtlasCacheRevision || '',
      registration: 'none',
      controllerScript: navigator.serviceWorker?.controller?.scriptURL || 'none',
      caches: []
    };

    if (!info.supported) return info;

    try {
      const scoped = navigator.serviceWorker.getRegistration ? navigator.serviceWorker.getRegistration('/') : null;
      const reg = await withTimeout(scoped, 1500, null);
      const fallbackReg = reg || await withTimeout(navigator.serviceWorker.ready, 1500, null);

      if (fallbackReg && !fallbackReg.error) {
        info.registration = 'registered';
        info.active = fallbackReg.active?.scriptURL || 'none';
        info.waiting = fallbackReg.waiting?.scriptURL || 'none';
        info.installing = fallbackReg.installing?.scriptURL || 'none';
      }
    } catch (error) {
      info.registrationError = error?.message || String(error);
    }

    try {
      if (window.caches?.keys) info.caches = await withTimeout(caches.keys(), 1500, []);
    } catch (error) {
      info.cacheError = error?.message || String(error);
    }

    return info;
  }

  function devData(){
    const status = window.KanaCloudSync?.getSyncStatus?.() || {};
    let bytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        bytes += (key?.length || 0) + (localStorage.getItem(key)?.length || 0);
      }
    } catch {}
    const reading = statTotals('charStats');
    const writing = statTotals('reverseCharStats');
    const themePref = window.ModeAtlasTheme?.getPreference?.() || storeGet('modeAtlasThemePreference', 'system') || 'system';
    const themeEffective = window.ModeAtlasTheme?.getEffective?.() || themePref;
    return {
      version: (window.ModeAtlasEnv && window.ModeAtlasEnv.appVersion) || window.ModeAtlasVersion || 'dev-local',
      page: pageName(),
      url: location.href,
      theme: `${themePref} / ${themeEffective}`,
      online: navigator.onLine !== false,
      cloudState: status.text || 'n/a',
      cloudLastSync: fmtDate(status.lastSync || storeGet('modeAtlasLastCloudSyncAt', '0')),
      signedIn: !!status.user,
      localStorageKeys: localStorage.length,
      approximateLocalBytes: bytes,
      safeMode: sessionStorage.getItem('modeAtlasSafeMode') === '1',
      readingAccuracy: reading.accuracy,
      writingAccuracy: writing.accuracy,
      readingAnswers: reading.total,
      writingAnswers: writing.total,
      readingTests: countArray('testModeResults') + countArray('readingTestModeResults') + countArray('kanaTrainerReadingTestModeResults'),
      writingTests: countArray('writingTestModeResults') + countArray('kanaTrainerWritingTestModeResults'),
      atlasLevel: window.ModeAtlasProgress?.getSummary?.().level || 1,
      atlasXp: window.ModeAtlasProgress?.getSummary?.().xp || 0,
      dataFlow: JSON.stringify(collectDataFlow())
    };
  }


  function devEl(tag, className = '', text = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== '') el.textContent = String(text);
    return el;
  }

  function devButton(label, action, kind = 'action') {
    const button = devEl('button', `ma-button ma-button--small ma-dev-btn ${kind === 'diagnostic' ? 'diagnostic' : 'action'}`, label);
    button.type = 'button';
    button.dataset[action] = '';
    return button;
  }

  function renderKeyValueTable(data){
    const table = devEl('div', 'ma-dev-table');
    Object.entries(data || {}).forEach(([key, value]) => {
      const row = devEl('div', 'ma-dev-row');
      row.append(devEl('div', 'ma-dev-key', key), devEl('div', 'ma-dev-val', String(value)));
      table.append(row);
    });
    return table;
  }

  function renderJsonPanel(title, data){
    const wrap = devEl('div', 'ma-dev-json');
    wrap.append(devEl('h3', '', title));
    const pre = devEl('pre', '', JSON.stringify(data, null, 2));
    wrap.append(pre);
    return wrap;
  }

  function replaceDevBody(backdrop, panels){
    const body = backdrop.querySelector('[data-ma-dev-body]');
    if (!body) return;
    body.replaceChildren(...panels);
  }

  function safeDevData(){
    try { return devData(); }
    catch (error) { return { error: error?.message || String(error), page: pageName(), url: location.href }; }
  }

  function safeDataFlow(){
    try { return collectDataFlow(); }
    catch (error) { return { error: error?.message || String(error) }; }
  }

  function progressData(){
    const summary = window.ModeAtlasProgress?.getSummary?.() || {};
    const remaining = Math.max(0, Number(summary.levelRequirement || 0) - Number(summary.levelXp || 0));
    return {
      atlasLevel: summary.level || 1,
      xp: summary.xp || 0,
      xpToNextLevel: remaining,
      lifetimeCorrect: summary.lifetimeCorrect || 0,
      readingCorrect: summary.readingCorrect || 0,
      writingCorrect: summary.writingCorrect || 0
    };
  }

  function renderProgressPanel(){
    const panel = devEl('div', 'ma-dev-progress-panel');
    panel.append(renderKeyValueTable(progressData()));
    const controls = devEl('div', 'ma-dev-progress-controls');
    const label = devEl('label', 'ma-dev-progress-field');
    label.append(devEl('span', '', 'XP adjustment'));
    const input = devEl('input', 'ma-dev-progress-input');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.value = '100';
    input.dataset.maDevXpAmount = '';
    label.append(input);
    controls.append(
      label,
      devButton('Add XP', 'maDevXpAdd', 'action'),
      devButton('Remove XP', 'maDevXpRemove', 'action')
    );
    panel.append(controls);
    return panel;
  }

  function adjustDevXp(backdrop, direction){
    const input = backdrop.querySelector('[data-ma-dev-xp-amount]');
    const amount = Math.max(1, Math.floor(Number(input?.value || 0)));
    if (!Number.isFinite(amount)) {
      toast('Enter a valid XP amount.', 'warning');
      return;
    }
    const result = window.ModeAtlasProgress?.debugAdjustXP?.(direction * amount);
    if (!result) {
      toast('Progression debug controls are unavailable.', 'warning');
      return;
    }
    replaceDevBody(backdrop, [renderProgressPanel()]);
    const applied = Number(result.applied || 0);
    toast(`${applied >= 0 ? '+' : ''}${applied} XP applied · Level ${result.after?.level || 1}.`);
    if (Number(result.after?.level || 1) > Number(result.before?.level || 1)) {
      backdrop.classList.remove('open');
      void window.ModeAtlasProgressUI?.naturalBreak?.('dev-xp-adjustment');
    }
  }

  function openDevMenu(){
    if (!canUseDevTools()) {
      toast('Developer tools are only available locally or to the developer account.', 'err');
      return null;
    }
    const data = {
      version: (window.ModeAtlasEnv && window.ModeAtlasEnv.appVersion) || window.ModeAtlasVersion || 'dev-local',
      page: pageName(),
      localDev: isLocalDevHost(),
      signedInAs: currentUserEmail() || 'not signed in',
      status: 'Dev console ready. Choose a diagnostic panel.'
    };
    let backdrop = $('#maDevMenu');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'maDevMenu';
      backdrop.className = 'ma-dev-backdrop';
      document.body.appendChild(backdrop);
    }
    const modal = devEl('div', 'ma-dev-modal');
    const head = devEl('div', 'ma-dev-head');
    head.append(devEl('h2', '', 'Mode Atlas Dev Diagnostics'), devButton('Close', 'maDevClose'));

    const actions = devEl('div', 'ma-dev-actions');
    actions.append(
      devButton('Overview', 'maDevOverview', 'diagnostic'),
      devButton('Data flow', 'maDevDataFlow', 'diagnostic'),
      devButton('Storage keys', 'maDevStorageKeys', 'diagnostic'),
      devButton('Service worker', 'maDevServiceWorker', 'diagnostic'),
      devButton('Progress / XP', 'maDevProgress', 'diagnostic'),
      devButton('Copy diagnostics', 'maDevCopy', 'action'),
      devButton('Copy save snapshot', 'maDevCopySnapshot', 'action'),
      devButton('Repair save data', 'maDevRepair', 'action'),
      devButton('Force sync', 'maDevSync', 'action'),
      devButton('Request UI refresh', 'maDevUiRefresh', 'action'),
      devButton('Safe mode reload', 'maDevSafe', 'action'),
      devButton('Test sound', 'maDevTestSound', 'action'),
      devButton('Trigger first visit', 'maDevFirstVisit', 'action'),
      devButton('Trigger daily return', 'maDevDailyReturn', 'action'),
      devButton('Reset visit flags', 'maDevResetVisit', 'action'),
      devButton('Refresh app assets', 'maDevRefreshAssets', 'action')
    );

    const body = devEl('div');
    body.dataset.maDevBody = '';
    body.append(renderKeyValueTable(data));

    modal.append(head, actions, body);
    backdrop.replaceChildren(modal);
    backdrop.classList.add('open');
    backdrop.onclick = event => {
      if (event.target === backdrop || event.target.closest('[data-ma-dev-close]')) backdrop.classList.remove('open');
      if (event.target.closest('[data-ma-dev-overview]')) replaceDevBody(backdrop, [renderKeyValueTable(safeDevData())]);
      if (event.target.closest('[data-ma-dev-data-flow]')) replaceDevBody(backdrop, [renderKeyValueTable(safeDataFlow())]);
      if (event.target.closest('[data-ma-dev-storage-keys]')) replaceDevBody(backdrop, [renderJsonPanel('Storage keys', allStorageKeys())]);
      if (event.target.closest('[data-ma-dev-service-worker]')) {
        replaceDevBody(backdrop, [renderKeyValueTable({ loading: 'Checking Service Worker…' })]);
        getServiceWorkerInfo().then(info => replaceDevBody(backdrop, [renderJsonPanel('Service worker', info)])).catch(error => replaceDevBody(backdrop, [renderJsonPanel('Service worker error', { error: error?.message || String(error) })]));
      }
      if (event.target.closest('[data-ma-dev-progress]')) replaceDevBody(backdrop, [renderProgressPanel()]);
      if (event.target.closest('[data-ma-dev-xp-add]')) adjustDevXp(backdrop, 1);
      if (event.target.closest('[data-ma-dev-xp-remove]')) adjustDevXp(backdrop, -1);
      if (event.target.closest('[data-ma-dev-copy]')) navigator.clipboard?.writeText(JSON.stringify({ diagnostics: safeDevData(), dataFlow: safeDataFlow() }, null, 2)).then(() => toast('Diagnostics copied.'));
      if (event.target.closest('[data-ma-dev-copy-snapshot]')) navigator.clipboard?.writeText(JSON.stringify(window.KanaCloudSync?.debugLocalSnapshot?.() || {}, null, 2)).then(() => toast('Save snapshot copied.'));
      if (event.target.closest('[data-ma-dev-repair]')) {
        const result = window.ModeAtlas?.repairSaveData?.() || { summary: 'repair unavailable' };
        toast('Repair complete · ' + result.summary);
      }
      if (event.target.closest('[data-ma-dev-sync]')) {
        window.KanaCloudSync?.syncNow?.();
        toast('Sync requested.');
      }
      if (event.target.closest('[data-ma-dev-ui-refresh]')) {
        document.dispatchEvent(new CustomEvent('ma:ui-refresh', { detail: { source: 'dev-console' } }));
        window.ModeAtlasLifecycle?.requestUiRefresh?.('dev-console');
        toast('UI refresh requested.');
      }
      if (event.target.closest('[data-ma-dev-safe]')) {
        sessionStorage.setItem('modeAtlasSafeMode', '1');
        location.reload();
      }
      if (event.target.closest('[data-ma-dev-test-sound]')) {
        window.ModeAtlasSounds?.testSound?.();
      }
      if (event.target.closest('[data-ma-dev-first-visit]')) {
        if (typeof window.modeAtlasTriggerFirstVisit === 'function') window.modeAtlasTriggerFirstVisit();
        else toast('Visit-flow tools are not available on this page.', 'warning');
      }
      if (event.target.closest('[data-ma-dev-daily-return]')) {
        if (typeof window.modeAtlasTriggerDailyReturn === 'function') window.modeAtlasTriggerDailyReturn();
        else toast('Visit-flow tools are not available on this page.', 'warning');
      }
      if (event.target.closest('[data-ma-dev-reset-visit]')) {
        if (typeof window.modeAtlasResetVisitFlags === 'function') {
          window.modeAtlasResetVisitFlags();
          toast('Visit-flow flags reset.');
        } else toast('Visit-flow tools are not available on this page.', 'warning');
      }
      if (event.target.closest('[data-ma-dev-refresh-assets]')) {
        toast('Refreshing app assets…');
        const url = new URL(location.href);
        url.searchParams.set('v', String(window.ModeAtlasCacheRevision || window.MODE_ATLAS_CACHE_REVISION || Date.now()));
        url.searchParams.set('reload', String(Date.now()));
        location.replace(url.href);
      }
    };
  }

  function removeHiddenDevButton(){
    const button = $('#maHiddenDevTrigger');
    if (button) button.remove();
    const menu = $('#maDevMenu');
    if (menu) menu.classList.remove('open');
  }

  function syncHiddenDevButton(){
    const existing = $('#maHiddenDevTrigger');
    if (!canUseDevTools()) {
      removeHiddenDevButton();
      return;
    }
    if (existing) {
      existing.className = isLocalDevHost() ? 'ma-hidden-dev-trigger local-dev' : 'ma-hidden-dev-trigger';
      existing.textContent = isLocalDevHost() ? 'DEV' : '';
      return;
    }
    const button = document.createElement('button');
    button.id = 'maHiddenDevTrigger';
    button.className = isLocalDevHost() ? 'ma-hidden-dev-trigger local-dev' : 'ma-hidden-dev-trigger';
    button.type = 'button';
    button.textContent = isLocalDevHost() ? 'DEV' : '';
    button.setAttribute('aria-label', 'Developer diagnostics');
    button.addEventListener('click', openDevMenu);
    document.body.appendChild(button);
  }

  window.ModeAtlasDevConsole = { canUseDevTools, currentUserEmail, isLocalDevHost, open: openDevMenu, data: devData, dataFlow: collectDataFlow, serviceWorkerInfo: getServiceWorkerInfo };
  window.dev = function(){
    if (!canUseDevTools()) {
      toast('Developer tools are hidden in this build.');
      return null;
    }
    return openDevMenu();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncHiddenDevButton, { once: true });
  else syncHiddenDevButton();

  window.addEventListener('kanaCloudSyncStatusChanged', syncHiddenDevButton);
  window.addEventListener('storage', syncHiddenDevButton);
})();
