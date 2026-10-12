/* Mode Atlas trainer modifier menu and runtime UI. Owns modifier-menu rendering; trainer-control behavior is owned by mode-atlas-trainer-controls.js. */
/* === Mode Atlas trainer/runtime feature bindings: modifiers, sessions, import preview, empty states === */
(function ModeAtlasTrainerRuntimeFeatures(){
  if (window.__modeAtlasTrainerRuntimeFeaturesLoaded) return;
  window.__modeAtlasTrainerRuntimeFeaturesLoaded = true;

  const PAGE = (window.ModeAtlasPageName ? window.ModeAtlasPageName() : (location.pathname.split('/').pop() || 'index.html')).toLowerCase();
  const IS_TRAINER = PAGE === 'default.html' || PAGE === 'reverse.html';
  const IS_WRITING = PAGE === 'reverse.html';
  const SETTINGS_KEY = IS_WRITING ? 'reverseSettings' : 'settings';
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  function storeGet(key, fallback = '') {
    const store = window.ModeAtlasStorage;
    return store?.get?.(key, fallback) ?? localStorage.getItem(key) ?? fallback;
  }
  const readJSON = (k,f)=>{ try{ return window.ModeAtlasStorage?.json?.(k, f) ?? JSON.parse(localStorage.getItem(k) || 'null') ?? f; } catch { return f; } };

  function mmEl(tag, className='', text=''){
    const el=document.createElement(tag);
    if(className) el.className=className;
    if(text!=='') el.textContent=String(text);
    return el;
  }
  function mmLink(className='', text='', href=''){
    const a=mmEl('a', className, text);
    a.href=href;
    return a;
  }



  function trainerSettings(){
    let s = readJSON(SETTINGS_KEY, {});
    try { if (typeof settings === 'object' && settings) s = Object.assign({}, s, settings); } catch {}
    return s || {};
  }

  function makeBtn(label, active, key='', disabled=false){
    const b=document.createElement('button');
    b.type='button';
    b.className='ma-button ma-trainer-button ma-structured-toggle' + (active?' active':'');
    b.textContent=label;
    if (key) b.dataset.maControlKey = key;
    b.setAttribute('aria-pressed', active?'true':'false');
    b.disabled=!!disabled || (typeof isModeLocked === 'function' && isModeLocked());
    if(key && key!=='preset')b.addEventListener('click',()=>{
      if(!b.disabled)window.ModeAtlasTrainerControls.toggleMode(key);
    });
    return b;
  }

  function normalisePresetId(id){
    try{ return window.ModeAtlasPresets?.normaliseId?.(id) || String(id || '').trim().toLowerCase(); }catch{ return String(id || '').trim().toLowerCase(); }
  }
  function activePresetId(){
    try{
      const branch = IS_WRITING ? 'writing' : 'reading';
      return window.ModeAtlasPresets?.activePresetFor?.(branch) || '';
    }catch{
      return String(storeGet('modeAtlasActivePreset', '') || '').toLowerCase();
    }
  }
  function presetList(){
    return window.ModeAtlasPresets.list;
  }

  function makePresetBtn(preset, active){
    const id = normalisePresetId(preset && preset.id);
    const b = makeBtn('', active, 'preset');
    b.classList.add('ma-preset-toggle');
    b.dataset.preset = id;
    b.addEventListener('click',()=>{if(!b.disabled)window.ModeAtlasTrainerControls.applyPreset(id);});
    b.replaceChildren(mmEl('span','',String(preset?.label || id)), mmEl('small','',String(preset?.desc || '')));
    return b;
  }

  function installStructuredModifierMenu(){
    if(!IS_TRAINER) return;
    const content=$('#modifiersContent'); const stack=$('.options-stack', content); const mod=$('#modifierOptions');
    if(!content || !stack || !mod) return;

    const s=trainerSettings();
    const activePreset = activePresetId();
    const controls=Array.from(mod.querySelectorAll('[data-ma-control-key],[data-ma-mode]'));
    if(controls.length){
      const locked=typeof isModeLocked === 'function' && isModeLocked();
      controls.forEach(button=>{
        const active=button.dataset.maMode ? window.ModeAtlasPracticeModes.selected(s)===button.dataset.maMode : button.dataset.preset ? activePreset===button.dataset.preset : !!s[button.dataset.maControlKey];
        button.classList.toggle('active',active);
        button.setAttribute('aria-pressed',String(active));
        const key=button.dataset.maControlKey;
        const fixed=window.ModeAtlasPracticeModes.fixedPool(s);
        button.disabled=locked || (fixed && ['hint','srs','focusWeak','confusableKana','comboKana'].includes(key)) || (s.dailyChallenge && ['dakuten','yoon','extendedKatakana'].includes(key));
      });
      return;
    }
    const groups=[
      ['Session', window.ModeAtlasPracticeModes.list.map(mode=>({type:'mode',...mode}))],
      ['Study presets', presetList().map(p => Object.assign({ type:'preset' }, p))],
      ['Learning options', [
        ['hint','Hints'], ['srs','Smart repetition'], ['comboKana','Combo Kana'], ['focusWeak','Focus Weak'], ['confusableKana','Confusable Kana']
      ]],
      ['Content modifiers', [
        ['dakuten','Dakuten'], ['yoon','Yōon'], ['extendedKatakana','Extended Katakana']
      ]]
    ];
    mod.replaceChildren();
    mod.classList.remove('button-grid');
    mod.classList.add('ma-structured-modifiers');
    groups.forEach(([title,items])=>{
      const section=document.createElement(title==='Session'?'section':'details');
      section.className='ma-modifier-group';
      if(title==='Session')section.classList.add('ma-mode-group');
      const head=document.createElement(title==='Session'?'h3':'summary');
      head.className='ma-modifier-group-title';
      head.textContent=title;
      const grid=document.createElement('div');
      grid.className='ma-modifier-group-grid';
      items.forEach(item=>{
        if(item && item.type === 'mode') {
          const button=makeBtn('',window.ModeAtlasPracticeModes.selected(s)===item.id);
          button.dataset.maMode=item.id;
          button.classList.add('ma-mode-choice');
          button.append(mmEl('strong','',item.label),mmEl('span','',item.detail));
          button.addEventListener('click',()=>window.ModeAtlasTrainerControls.selectMode(item.id));
          grid.appendChild(button);
        } else if(item && item.type === 'preset') grid.appendChild(makePresetBtn(item, activePreset === normalisePresetId(item.id)));
        else { const [key,label] = item; grid.appendChild(makeBtn(label, !!s[key], key)); }
      });
      section.append(head,grid);
      mod.appendChild(section);
    });
    installStructuredModifierMenu();
    try{ window.ModeAtlas?.refreshTrainerControls?.(); }catch{}
  }

  window.ModeAtlasModifierMenu = Object.freeze({render:installStructuredModifierMenu});

  function saveKeyStatsForPreset(){
    // Preset achievements are tracked by the trainer controls only while that exact preset is active.
    // Do not infer progress from broad kana stats because smaller presets overlap larger presets.
    try { return window.ModeAtlasTrainerControls?.readPresetProgress?.() || readJSON('modeAtlasPresetAchievementProgress',{}); }
    catch { return readJSON('modeAtlasPresetAchievementProgress',{}); }
  }

  function installPresetChecklist(){
    if(PAGE !== 'kana.html') return;
    const anchor = $('#maPresetChecklist') || $('.ma-kana-pro-card') || $('main') || document.body;
    let panel=$('#maPresetChecklist');
    if(!panel){
      panel=document.createElement('section');
      panel.id='maPresetChecklist';
      panel.className='ma-kana-pro-card ma-preset-checklist';
      anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    }
    const progress=saveKeyStatsForPreset();
    const defs=window.ModeAtlasPresets.list.map(({id,label,desc})=>[id,label,desc]);

    const head=mmEl('div','ma-kana-pro-head');
    const copy=document.createElement('div');
    copy.append(
      mmEl('h2','ma-kana-pro-title','Preset achievements'),
      mmEl('div','ma-kana-pro-sub','Answer 100 questions correctly in each preset to complete its achievement.')
    );
    head.append(copy);

    const grid=mmEl('div','ma-achievement-grid');
    defs.forEach(([id,title,desc])=>{
      const n=progress[id]||0;
      const done=n>=100;
      const card=mmEl('article',`ma-achievement-card ${done?'done':''}`);
      const top=mmEl('div','ma-achievement-top');
      top.append(mmEl('b','',title), mmEl('span','',`${n}/100`));
      const track=mmEl('div','ma-progress-track');
      const fill=document.createElement('span');
      fill.dataset.maProgress=String(Math.min(100,n));
      track.append(fill);
      card.append(top, mmEl('small','',desc), track, mmEl('em','',done?'Complete':'In progress'));
      grid.append(card);
    });

    panel.replaceChildren(head, grid);
    window.ModeAtlasUi?.applyProgressWidths?.(panel);
  }

  function installNoDataStates(){
    if(PAGE === 'test.html'){
      const possibleLists=['testModeResults','readingTestModeResults','writingTestModeResults','kanaTrainerReadingTestModeResults','kanaTrainerWritingTestModeResults'];
      const has=possibleLists.some(k=>Array.isArray(readJSON(k,null)) && readJSON(k,[]).length);
      const existing=$('#maNoDataResults');
      if(has){ existing?.remove(); return; }
      if(existing) return;
      const target=$('.stored-tests, #storedTests, .results-list, main') || document.body;
      const box=document.createElement('section');
      box.id='maNoDataResults';
      box.className='ma-card ma-card--soft ma-no-data-card';
      const actions=mmEl('div','ma-no-data-actions');
      actions.append(mmLink('ma-button', 'Start Reading Test', window.ModeAtlasVersionFile?.appUrl?.('/reading/') || '/reading/'), mmLink('ma-button', 'Start Writing Test', window.ModeAtlasVersionFile?.appUrl?.('/writing/') || '/writing/'));
      box.replaceChildren(
        mmEl('h2','','No formal test results yet'),
        mmEl('p','','Complete a Reading or Writing Test Mode run to unlock detailed score cards, speed trends, and weak-kana breakdowns.'),
        actions
      );
      target.parentNode.insertBefore(box, target);
    }
    if(PAGE === 'kana.html'){
      const hasStats=Object.keys(readJSON('charStats',{})).length || Object.keys(readJSON('reverseCharStats',{})).length;
      const existing=$('#maNoDataKana');
      if(hasStats){ existing?.remove(); return; }
      if(!existing){
        const main=$('main')||document.body;
        const box=document.createElement('section');
        box.id='maNoDataKana';
        box.className='ma-card ma-card--soft ma-no-data-card ma-no-data-kana';
        box.replaceChildren(
          mmEl('h2','','Your Kana dashboard is ready'),
          mmEl('p','','Complete a few Reading or Writing sessions to fill this hub with streaks, mastery labels, speed goals, and review suggestions.')
        );
        main.appendChild(box);
      }
    }
  }


  function boot(){
    installStructuredModifierMenu();
    try{ window.ModeAtlasTrainerControls?.refresh?.(); }catch{}
    installPresetChecklist();
    installNoDataStates();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
  document.addEventListener('ma:preset-progress-updated', installPresetChecklist);
  window.addEventListener('pageshow', event => { if(event.persisted === true) boot(); });
  window.addEventListener('modeAtlasCloudDataChanged', event => {
    const sections = Array.isArray(event.detail?.sections) ? event.detail.sections : [];
    if(PAGE === 'test.html' && sections.length && !sections.includes('readingTests') && !sections.includes('writingTests')) return;
    if(PAGE === 'kana.html' && sections.length && !sections.includes('reading') && !sections.includes('writing')) return;
    installNoDataStates();
  });
  document.addEventListener('ma:ui-refresh', boot);
  document.addEventListener('ma:trainer-ready', boot);
})();
