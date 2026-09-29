(function ModeAtlasStudyNavHidden(){
  'use strict';

  const storageKey = 'kanaTrainerNavHidden';

  function readHidden(){
    try {
      const store = window.ModeAtlasStorage;
      if (store?.get) return store.get(storageKey, '0') === '1';
      return window.ModeAtlasStorage?.get?.(storageKey) === '1';
    } catch {
      return false;
    }
  }

  function writeHidden(hidden){
    try {
      const store = window.ModeAtlasStorage;
      if (store?.set) store.set(storageKey, hidden ? '1' : '0');
      else window.ModeAtlasStorage?.set?.(storageKey, hidden ? '1' : '0');
    } catch {}
  }

  const focusButton = document.getElementById('studyNavHideBtn');
  const exitButton = document.getElementById('studyNavShowBtn');

  function syncFocusControls(hidden) {
    if (focusButton) {
      focusButton.setAttribute('aria-label', hidden ? 'Exit focus mode' : 'Enter focus mode');
      focusButton.title = hidden ? 'Exit focus mode' : 'Focus mode';
      const label = focusButton.querySelector('.ma-nav__action-label');
      if (label) label.textContent = hidden ? 'Exit focus' : 'Focus';
      focusButton.setAttribute('aria-pressed', hidden ? 'true' : 'false');
    }
  }

  function setNavHidden(hidden) {
    const next = !!hidden;
    document.body.classList.toggle('study-nav-hidden', next);
    syncFocusControls(next);
    writeHidden(next);
    if (window.ModeAtlasEnv?.isNativeApp) {
      window.requestAnimationFrame(() => window.scrollTo({ top:0, behavior:'instant' }));
    }
  }

  const initialHidden = readHidden();
  document.body.classList.toggle('study-nav-hidden', initialHidden);
  syncFocusControls(initialHidden);

  focusButton?.addEventListener('click', () => setNavHidden(!document.body.classList.contains('study-nav-hidden')));
  exitButton?.addEventListener('click', () => setNavHidden(false));
})();
