/* Mode Atlas trainer controls. Owns trainer modifier click handling, preset application, and active control state. */
(function ModeAtlasTrainerControlsModule(){
  const resolvedPage=(window.ModeAtlasPageName ? window.ModeAtlasPageName() : (location.pathname.split('/').pop()||'')).toLowerCase();
  function isTrainerDocument(){
    return resolvedPage==='default.html' || resolvedPage==='reverse.html' ||
      !!document.querySelector('#modifiersContent,#modifierOptions,#rowOptions,#katakanaRowOptions') ||
      document.body?.classList?.contains('ma-reading-page') ||
      document.body?.classList?.contains('ma-writing-page');
  }
  if(window.__modeAtlasTrainerControlsLoaded) return;
  window.__modeAtlasTrainerControlsLoaded=true;

  const isWriting=resolvedPage==='reverse.html' || document.body?.classList?.contains('ma-writing-page') || /\/writing\/?$/i.test(location.pathname || '');
  const storeKey=isWriting?'reverseSettings':'settings';
  const CONF_HIRA_ROWS=['h_na','h_ma','h_ra','h_wa'];
  const CONF_KATA_ROWS=['k_sa','k_ta','k_ka','k_na','k_ma','k_wa'];

  function storeGet(key, fallback = '') {
    const store = window.ModeAtlasStorage;
    return store?.get?.(key, fallback) ?? localStorage.getItem(key) ?? fallback;
  }
  function storeSet(key, value) {
    const store = window.ModeAtlasStorage;
    return store?.set?.(key, value) ?? localStorage.setItem(key, String(value));
  }
  function storeRemove(key) {
    const store = window.ModeAtlasStorage;
    return store?.remove?.(key) ?? localStorage.removeItem(key);
  }
  function storeJSON(key, fallback) {
    const store = window.ModeAtlasStorage;
    if (store?.json) return store.json(key, fallback);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }
  function storeSetJSON(key, value) {
    const store = window.ModeAtlasStorage;
    return store?.setJSON?.(key, value) ?? localStorage.setItem(key, JSON.stringify(value));
  }

  function readJSON(k,f){try{return storeJSON(k,f);}catch{return f;}}
  function writeJSON(k,v){try{storeSetJSON(k,v);}catch{}}
  function getSettings(){
    try{ if(typeof settings==='object' && settings) return settings; }catch{}
    const s=readJSON(storeKey,{});
    return s && typeof s==='object'?s:{};
  }
  function setSettings(next){
    const s=getSettings();
    Object.assign(s,next);
    try{ if(typeof settings==='object' && settings) Object.assign(settings,s); }catch{}
    writeJSON(storeKey,s);
    try{storeSet(isWriting?'reverseSettingsUpdatedAt':'settingsUpdatedAt',String(Date.now()));}catch{}
    try{window.KanaCloudSync?.markSectionUpdated?.(isWriting?'writing':'reading');window.KanaCloudSync?.scheduleSync?.();}catch{}
    return s;
  }
  function matchesPreset(id){ return window.ModeAtlasPresets.matchesSettings(getSettings(), id); }
  function inferActivePreset(){
    const branch = isWriting ? 'writing' : 'reading';
    const fromPresetModule = window.ModeAtlasPresets?.activePresetFor?.(branch) || '';
    if (fromPresetModule && matchesPreset(fromPresetModule)) return fromPresetModule;
    const stored=(window.__maStableActivePreset||storeGet('modeAtlasActivePreset','')||'').toLowerCase();
    if(stored && matchesPreset(stored)) return stored;
    return window.ModeAtlasPresets.ids().find(matchesPreset)||'';
  }
  function saveAndRefresh(){
    try{ if(typeof rebuildCharMap==='function') rebuildCharMap(); }catch{}
    try{ if(typeof ensureDataObjects==='function') ensureDataObjects(); }catch{}
    try{ if(typeof updateTrialConfigVisibility==='function') updateTrialConfigVisibility(); }catch{}
    try{ if(typeof updateTopStats==='function') updateTopStats(); }catch{}
    try{ if(typeof renderHeatmap==='function') renderHeatmap(); }catch{}
    try{ if(typeof renderScoreHistory==='function') renderScoreHistory(); }catch{}
    try{ if(typeof saveAll==='function') saveAll(); }catch{ writeJSON(storeKey,getSettings()); }
    markActive();
    window.ModeAtlasLifecycle?.requestUiRefresh?.('trainer-controls-save');
  }
  function setActivePreset(id){
    if(id){window.__maStableActivePreset=id;storeSet('modeAtlasActivePreset',id);} else {window.__maStableActivePreset='';storeRemove('modeAtlasActivePreset');}
  }

  const PRESET_PROGRESS_KEY = 'modeAtlasPresetAchievementProgress';
  function readPresetProgress(){
    const data = readJSON(PRESET_PROGRESS_KEY, {});
    const out = {};
    window.ModeAtlasPresets.ids().forEach(id => out[id] = Math.max(0, Math.min(100, Number(data && data[id] || 0))));
    return out;
  }
  function writePresetProgress(progress){
    writeJSON(PRESET_PROGRESS_KEY, progress || {});
    try { storeSet('modeAtlasPresetAchievementUpdatedAt', String(Date.now())); } catch {}
  }
  function recordPresetCorrect(count = 1){
    const active = inferActivePreset();
    if(!active || !matchesPreset(active)) return '';
    const progress = readPresetProgress();
    progress[active] = Math.min(100, Math.max(0, Number(progress[active] || 0)) + Math.max(1, Number(count) || 1));
    writePresetProgress(progress);
    try { document.dispatchEvent(new CustomEvent('ma:preset-progress-updated', { detail: { id: active, value: progress[active] } })); } catch {}
    return active;
  }
  function clearPresetForCustom(showToast){
    setActivePreset('');
    if(showToast) window.ModeAtlas?.toast?.('Custom practice settings selected.','warn',2800);
  }
  function applyPreset(id){
    if(typeof isModeLocked === 'function' && isModeLocked())return;
    if(!window.ModeAtlasPresets.apply(id, {target:'both',source:'trainer-controls',notify:true}))return;
    const current=readJSON(storeKey,{});
    Object.assign(getSettings(),current);
    saveAndRefresh();
  }
  function toggleMode(key){
    if(typeof isModeLocked === 'function' && isModeLocked())return;
    const s=getSettings();
    const wasPreset=!!inferActivePreset();
    if(key==='speedRun'){
      s.speedRun=!s.speedRun; if(s.speedRun){s.endless=false;s.timeTrial=false;s.dailyChallenge=false;s.testMode=false;s.comboKana=false;}
    } else if(key==='timeTrial'){
      s.timeTrial=!s.timeTrial; if(s.timeTrial){s.endless=false;s.dailyChallenge=false;s.testMode=false;s.speedRun=false;}
    } else if(key==='endless'){
      s.endless=!s.endless; if(s.endless){s.timeTrial=false;s.dailyChallenge=false;s.testMode=false;s.speedRun=false;}
    } else if(key==='dailyChallenge'){
      s.dailyChallenge=!s.dailyChallenge; if(s.dailyChallenge){s.timeTrial=false;s.endless=false;s.testMode=false;s.comboKana=false;s.speedRun=false;s.hint=false;}
    } else if(key==='testMode'){
      s.testMode=!s.testMode; if(s.testMode){s.timeTrial=false;s.endless=false;s.dailyChallenge=false;s.comboKana=false;s.speedRun=false;s.hint=false;}
    } else if(key==='comboKana'){
      s.comboKana=!s.comboKana; if(s.comboKana){s.dailyChallenge=false;s.testMode=false;s.speedRun=false;}
    } else if(key==='confusableKana'){
      s.confusableKana=!s.confusableKana;
      if(s.confusableKana){
        s.hiraganaRows=CONF_HIRA_ROWS.slice(); s.katakanaRows=CONF_KATA_ROWS.slice();
        s.dakuten=false; s.yoon=false; s.extendedKatakana=false;
        s.dailyChallenge=false; s.testMode=false; s.comboKana=false; s.speedRun=false; s.focusWeak=false;
      }
    } else {
      s[key]=!s[key];
    }
    setSettings(s);
    if(wasPreset) clearPresetForCustom(true);
    else if(key!=='confusableKana') setActivePreset('');
    saveAndRefresh();
  }
  function toggleRow(rowKey,settingsKey){
    if(typeof isModeLocked === 'function' && isModeLocked())return;
    const s=getSettings(); const wasPreset=!!inferActivePreset();
    const list=Array.isArray(s[settingsKey])?s[settingsKey].slice():[];
    s[settingsKey]=list.includes(rowKey)?list.filter(x=>x!==rowKey):list.concat(rowKey);
    setSettings(s);
    if(wasPreset) clearPresetForCustom(true);
    saveAndRefresh();
  }
  function labelToKey(label){
    if (label && typeof label === 'object' && label.dataset?.maControlKey) return label.dataset.maControlKey;
    const n=String(label||'').toLowerCase().replace(/[\s\u00a0]+/g,' ').trim();
    if(n==='hint mode'||n==='hint')return'hint';
    if(n==='srs mode'||n==='srs')return'srs';
    if(n==='endless mode'||n==='endless')return'endless';
    if(n==='time trial mode'||n==='time trial')return'timeTrial';
    if(n==='daily challenge')return'dailyChallenge';
    if(n==='test mode')return'testMode';
    if(n==='combo kana mode'||n==='combo kana')return'comboKana';
    if(n==='focus weak')return'focusWeak';
    if(n==='dakuten')return'dakuten';
    if(n==='yōon'||n==='yoon')return'yoon';
    if(n==='extended katakana')return'extendedKatakana';
    if(n==='confusable kana'||n==='confusing kana')return'confusableKana';
    if(n==='speed run'||n==='speed run mode')return'speedRun';
    return'';
  }
  function rowKeyFromButton(btn,container){
    if(btn.dataset.rowKey) return btn.dataset.rowKey;
    const text=(btn.textContent||'').trim();
    if(container?.id==='rowOptions') return 'h_'+text;
    if(container?.id==='katakanaRowOptions') return 'k_'+text;
    return '';
  }
  function markActive(){
    const s=getSettings();
    const active=inferActivePreset();
    if(active){window.__maStableActivePreset=active;} else {window.__maStableActivePreset='';}
    document.querySelectorAll('#modifierOptions [data-preset]').forEach(btn=>{
      const on=!!active && btn.dataset.preset===active;
      btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',on?'true':'false');
    });
    document.querySelectorAll('#modifierOptions .toggle-btn,#modifierOptions button').forEach(btn=>{
      if (btn.hasAttribute('data-preset')) return;
      const key=labelToKey(btn); if(!key || key === 'preset') return;
      const on=!!s[key]; btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',on?'true':'false');
    });
    document.querySelectorAll('#rowOptions .toggle-btn,#rowOptions button,#katakanaRowOptions .toggle-btn,#katakanaRowOptions button').forEach(btn=>{
      const cont=btn.closest('#rowOptions,#katakanaRowOptions'); const key=rowKeyFromButton(btn,cont); if(!key) return;
      const list=cont.id==='rowOptions'?s.hiraganaRows:s.katakanaRows;
      const on=Array.isArray(list)&&list.includes(key); btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',on?'true':'false');
    });
  }
  function bootFromHub(){
    try{
      const params=new URLSearchParams(location.search);
      const confusable = params.get('confusable')==='1'||storeGet('modeAtlasConfusableMode')==='1';
      const daily = params.get('mode')==='daily';
      const review = params.get('mode')==='review'||params.get('focusWeak')==='1';
      if(confusable){
        const s=getSettings();
        Object.assign(s,{confusableKana:true,hint:false,srs:true,focusWeak:false,endless:false,timeTrial:false,dailyChallenge:false,testMode:false,comboKana:false,speedRun:false,dakuten:false,yoon:false,extendedKatakana:false,hiraganaRows:CONF_HIRA_ROWS.slice(),katakanaRows:CONF_KATA_ROWS.slice(),activeBottomTab:'modifiers'});
        setSettings(s); setActivePreset(''); storeRemove('modeAtlasConfusableMode');
        saveAndRefresh();
      } else if(daily || review){
        const s=getSettings();
        Object.assign(s, {confusableKana:false,focusWeak:review,srs:true,endless:false,timeTrial:false,dailyChallenge:daily,testMode:false,comboKana:false,speedRun:false});
        if(daily) s.hint=false;
        setSettings(s); setActivePreset('');
        saveAndRefresh();
      }
      if(params.has('confusable') || params.has('mode') || params.has('focusWeak')){
        params.delete('confusable'); params.delete('mode'); params.delete('focusWeak');
        if(history.replaceState) history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():'')+location.hash);
      }
    }catch{}
  }



  function install(){
    if(!isTrainerDocument()) return;
    document.body.classList.toggle('ma-reading-page',!isWriting);
    document.body.classList.toggle('ma-writing-page',isWriting);
    bootFromHub(); markActive();
  }
  window.ModeAtlasTrainerControls = Object.assign(window.ModeAtlasTrainerControls || {}, {
    refresh: function(){ install(); },
    applyPreset,
    toggleMode,
    toggleRow,
    recordPresetCorrect,
    readPresetProgress
  });
  window.ModeAtlas=window.ModeAtlas||{};
  window.ModeAtlas.applyPracticePreset=applyPreset;
  window.ModeAtlas.refreshTrainerControls=markActive;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
  window.addEventListener('pageshow', event => { if(event.persisted === true) install(); });
  document.addEventListener('ma:trainer-ready', install);
  window.addEventListener('modeAtlasPresetChanged', markActive);
})();
