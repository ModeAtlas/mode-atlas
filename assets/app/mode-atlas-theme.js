/* One appearance owner: system modes and account-owned collection themes. */
(function ModeAtlasThemeModule(){
  if (window.__modeAtlasThemeLoaded) return;
  window.__modeAtlasThemeLoaded = true;

  var THEME_KEY = 'modeAtlasThemePreference';
  var lastEffective = '';

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
    return /^(dark|light|system|sakura|midnight)$/.test(pref) ? pref : 'dark';
  }

  function getEffective(pref){
    pref = normalizePreference(pref || getPreference());
    if(pref==='sakura')return 'light';
    if(pref==='midnight')return 'dark';
    return pref === 'system' ? (systemPrefersLight() ? 'light' : 'dark') : pref;
  }

  function collection(pref){return window.ModeAtlasRewardRules?.item('themes',pref);}
  function available(pref){return !['sakura','midnight'].includes(pref)||window.ModeAtlasRewardRules?.allowed('themes',pref,1,window.ModeAtlasRewardAccess?.presentation?.()||window.ModeAtlasRewardAccess?.current());}
  function updateButtons(){
    for(const host of document.querySelectorAll('[data-ma-owned-themes]')){
      const themes=(window.ModeAtlasRewardRules?.themes||[]).filter(item=>available(item.id));
      host.hidden=!themes.length;
      const signature=themes.map(item=>item.id).join(',');
      if(host.dataset.items!==signature){
        host.dataset.items=signature;host.replaceChildren();
        for(const item of themes){const choice=document.createElement('button');choice.type='button';choice.className='ma-button ma-theme-collection-choice';choice.dataset.maThemeChoice=item.id;choice.dataset.maThemeSample=item.id;choice.textContent=item.name;host.append(choice);}
      }
    }
    var pref = normalizePreference(getPreference());
    document.querySelectorAll('[data-ma-theme-choice], .ma-theme-choice-btn').forEach(function(btn){
      var val = btn.getAttribute('data-ma-theme-choice') || btn.dataset.theme || (btn.textContent || '').trim().toLowerCase();
      val = normalizePreference(val);
      var owned=available(val);
      if(collection(val)){btn.hidden=!owned;btn.disabled=!owned;}
      var active = owned && (val === pref || !available(pref) && val === getEffective(pref));
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.dataset.active = active ? 'true' : 'false';
    });
  }

  function apply(){
    var pref = normalizePreference(getPreference());
    var effective = getEffective(pref);
    const selected=collection(pref),usable=selected&&available(pref);
    if(usable)document.documentElement.dataset.maCollectionTheme=pref;
    else delete document.documentElement.dataset.maCollectionTheme;
    document.documentElement.dataset.maTheme = effective;
    document.documentElement.dataset.maThemePreference = pref;
    try {
      var meta = document.querySelector('meta[name="theme-color"]');
      var nativeCanvas = getComputedStyle(document.documentElement).getPropertyValue('--ma-native-page').trim();
      if (meta) meta.content = nativeCanvas || (effective === 'light' ? '#dbeaf6' : '#121a2b');
    } catch(e) {}
    // The platform adapter mirrors this preference for UIKit, not another theme
    // controller. Pass System through so a native override cannot pin the OS mode.
    if (window.AtlasPlatform?.isNative) {
      window.AtlasPlatform.setAppearance(usable?pref:['sakura','midnight'].includes(pref)?effective:pref,usable?nativeCanvas:undefined).catch(function(error){
        console.warn('Native appearance unavailable', error);
      });
    }
    updateButtons();
    if (lastEffective !== effective+':'+(usable?pref:'')) {
      lastEffective = effective+':'+(usable?pref:'');
      document.dispatchEvent(new CustomEvent('ma:theme-changed', {detail:{effective:effective, preference:pref}}));
    }
  }

  function set(pref, opts){
    pref = normalizePreference(pref);
    if(!available(pref))return false;
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
  window.addEventListener('modeAtlasRewardAccessChanged',apply);
  window.addEventListener('modeAtlasCloudDataChanged',apply);
  window.addEventListener('modeAtlasAccountSignedOut',apply);
  window.addEventListener('kanaCloudSyncStatusChanged',apply);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  apply();
})();
