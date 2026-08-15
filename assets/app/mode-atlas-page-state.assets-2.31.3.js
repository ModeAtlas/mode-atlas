(function ModeAtlasPageState(){
  'use strict';
  if (window.__modeAtlasPageStateLoaded) return;
  window.__modeAtlasPageStateLoaded = true;

  const LAST_PAGE_KEY = 'modeAtlasLastKanaPage';

  function pageName(){
    try { if (window.ModeAtlasPageName) return String(window.ModeAtlasPageName()).toLowerCase(); } catch {}
    const path = String(location.pathname || '').replace(/\/$/, '');
    const last = path.split('/').pop() || 'index.html';
    if (last === 'reading') return 'default.html';
    if (last === 'writing') return 'reverse.html';
    if (last === 'results') return 'test.html';
    if (last === 'kana') return 'kana.html';
    return last.toLowerCase();
  }

  function rememberKanaPage(){
    const page = pageName();
    const map = { 'default.html': '/reading/', 'reverse.html': '/writing/', 'test.html': '/results/' };
    if (map[page]) {
      try { window.ModeAtlasStorage?.set?.(LAST_PAGE_KEY, map[page]); } catch {}
    }
  }

  function normalizeInputs(){
    document.querySelectorAll('input,textarea').forEach((el, index) => {
      if (el.dataset.maInputNormalised === '1') return;
      el.dataset.maInputNormalised = '1';
      try {
        el.autocomplete = 'off';
        el.autocorrect = 'off';
        el.autocapitalize = 'off';
        el.spellcheck = false;
        const name = String(el.getAttribute('name') || '').toLowerCase();
        if (!name || ['name','email','address','card','location','password'].includes(name)) {
          el.setAttribute('name', `mode_atlas_input_${index}`);
        }
      } catch {}
    });
  }

  function emitLifecycle(name, detail = {}) {
    try {
      document.dispatchEvent(new CustomEvent(`ma:${name}`, { detail }));
    } catch {}
  }

  function onLifecycle(name, handler, options) {
    if (typeof handler !== 'function') return () => {};
    const eventName = `ma:${name}`;
    document.addEventListener(eventName, handler, options);
    return () => document.removeEventListener(eventName, handler, options);
  }

  function requestUiRefresh(source = 'unknown', detail = {}) {
    emitLifecycle('ui-refresh', { source, ...detail });
  }

  function boot(){
    rememberKanaPage();
    normalizeInputs();
    emitLifecycle('page-state-ready', { page: pageName() });
  }

  window.ModeAtlasLifecycle = Object.freeze({ emit: emitLifecycle, on: onLifecycle, requestUiRefresh });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('pageshow', function(event){ if (event.persisted === true) boot(); });
})();


(function(){
  "use strict";

  function clampPercent(value){
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(100, num));
  }

  function applyProgressWidths(root){
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("[data-ma-progress]").forEach(el => {
      el.style.width = `${clampPercent(el.dataset.maProgress)}%`;
    });
  }

  window.ModeAtlasUi = Object.assign(window.ModeAtlasUi || {}, {
    clampPercent,
    applyProgressWidths
  });
})();

