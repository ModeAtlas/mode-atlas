/* Mode Atlas toast notifications: one app-wide transient feedback surface. */
(function ModeAtlasToastModule(){
  'use strict';
  if (window.__modeAtlasToastLoaded) return;
  window.__modeAtlasToastLoaded = true;

  const TONE_ALIASES = Object.freeze({
    ok:'success', success:'success',
    info:'info', neutral:'info',
    warn:'warning', warning:'warning',
    err:'error', error:'error', bad:'error'
  });

  function normalizeTone(value){
    return TONE_ALIASES[String(value || 'success').toLowerCase()] || 'info';
  }

  function ensureWrap(){
    let wrap = document.querySelector('.ma-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'ma-toast-wrap';
      wrap.setAttribute('aria-live', 'polite');
      wrap.setAttribute('aria-relevant', 'additions');
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  function toast(message, type, ms){
    if (!message) return null;
    const tone = normalizeTone(type);
    const wrap = ensureWrap();
    const node = document.createElement('div');
    node.className = 'ma-toast ma-toast--' + tone;
    node.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    node.textContent = String(message);
    wrap.appendChild(node);

    window.setTimeout(() => {
      node.classList.add('is-leaving');
      window.setTimeout(() => node.remove(), 220);
    }, Number(ms || 3200));
    return node;
  }

  window.ModeAtlas = window.ModeAtlas || {};
  window.ModeAtlas.toast = toast;
  window.ModeAtlasToast = toast;
})();
