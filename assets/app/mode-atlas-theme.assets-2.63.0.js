/* Mode Atlas theme controller: one owner for Dark / Light / System. */
(function ModeAtlasThemeModule(){
  if (window.__modeAtlasThemeLoaded) return;
  window.__modeAtlasThemeLoaded = true;

  var THEME_KEY = 'modeAtlasThemePreference';

  function systemPrefersLight(){
    try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches; }
    catch(e) { return false; }
  }

  function getPreference(){
    try {
      var store = window.ModeAtlasStorage;
      if (store && typeof store.get === 'function') return store.get(THEME_KEY, 'dark') || 'dark';
      return localStorage.getItem(THEME_KEY) || 'dark';
    }
    catch(e) { return 'dark'; }
  }

  function normalizePreference(pref){
    pref = String(pref || '').toLowerCase();
    return /^(dark|light|system)$/.test(pref) ? pref : 'dark';
  }

  function getEffective(pref){
    pref = normalizePreference(pref || getPreference());
    return pref === 'system' ? (systemPrefersLight() ? 'light' : 'dark') : pref;
  }

  function updateButtons(){
    var pref = normalizePreference(getPreference());
    document.querySelectorAll('[data-ma-theme-choice], .ma-theme-choice-btn').forEach(function(btn){
      var val = btn.getAttribute('data-ma-theme-choice') || btn.dataset.theme || (btn.textContent || '').trim().toLowerCase();
      val = normalizePreference(val);
      var active = val === pref;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.dataset.active = active ? 'true' : 'false';
    });
  }

  function apply(){
    var pref = normalizePreference(getPreference());
    var effective = getEffective(pref);
    document.documentElement.dataset.maTheme = effective;
    document.documentElement.dataset.maThemePreference = pref;
    try {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = effective === 'light' ? '#dbeaf6' : '#121a2b';
    } catch(e) {}
    updateButtons();
  }

  function set(pref, opts){
    pref = normalizePreference(pref);
    try {
      var store = window.ModeAtlasStorage;
      if (store && typeof store.set === 'function') store.set(THEME_KEY, pref);
      else localStorage.setItem(THEME_KEY, pref);
    } catch(e) {}
    apply();
    if (!opts || opts.toast !== false) {
      var label = pref === 'system' ? 'System' : pref.charAt(0).toUpperCase() + pref.slice(1);
      try { window.ModeAtlas && window.ModeAtlas.toast && window.ModeAtlas.toast(label + ' appearance applied.'); } catch(e) {}
    }
  }

  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('[data-ma-theme-choice]');
    if (!btn) return;
    e.preventDefault();
    set(btn.getAttribute('data-ma-theme-choice'));
  }, true);

  try {
    var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)');
    if (mq && mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq && mq.addListener) mq.addListener(apply);
  } catch(e) {}

  window.addEventListener('storage', function(event){
    if (event && event.key === THEME_KEY) apply();
  });

  window.ModeAtlas = window.ModeAtlas || {};
  window.ModeAtlas.setTheme = set;
  window.ModeAtlasTheme = {
    key: THEME_KEY,
    getPreference: getPreference,
    getEffective: getEffective,
    apply: apply,
    set: set,
    updateButtons: updateButtons
  };

  window.addEventListener('modeAtlasSettingsMenuReady', updateButtons);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  apply();
})();
