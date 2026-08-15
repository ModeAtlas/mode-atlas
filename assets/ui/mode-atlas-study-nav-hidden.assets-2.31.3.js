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

  function setNavHidden(hidden) {
    document.body.classList.toggle('study-nav-hidden', !!hidden);
    writeHidden(!!hidden);
  }

  if (readHidden()) document.body.classList.add('study-nav-hidden');

  document.getElementById('studyNavHideBtn')?.addEventListener('click', () => setNavHidden(true));
  document.getElementById('studyNavShowBtn')?.addEventListener('click', () => setNavHidden(false));
})();
