/* Mode Atlas achievements and mastery UI. */
(function(){
  'use strict';
  const VERSION = (window.ModeAtlasEnv && window.ModeAtlasEnv.appVersion) || window.ModeAtlasVersion || 'dev-local';
  const KanaData = window.ModeAtlasKanaData;
  const Metrics = window.ModeAtlasKanaMetrics;
  const Collections = KanaData?.collections;
  if (!Collections || !Metrics) {
    console.error('Mode Atlas Achievements requires ModeAtlasKanaData and ModeAtlasKanaMetrics.');
    return;
  }
  let ACH_INDEX = {};
  
function applyAchievementVisuals(root = document) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("[data-ma-ach-accent]").forEach(el => {
        el.style.setProperty("--ma-ach-accent", el.dataset.maAchAccent || "96,165,250");
    });
    scope.querySelectorAll("[data-ma-ach-rank-accent]").forEach(el => {
        el.style.setProperty("--ma-ach-rank", el.dataset.maAchRankAccent || "148,163,184");
        const rankIndex = RANK_ACCENTS.indexOf(el.dataset.maAchRankAccent);
        el.style.setProperty("--ma-ach-native-rank", rankIndex >= 0 ? `var(--ma-native-rank-${rankIndex + 1})` : 'var(--ma-native-text)');
    });
    window.ModeAtlasUi?.applyProgressWidths?.(scope);
}


  function achEl(tag, className='', text=''){
    const el=document.createElement(tag);
    if(className) el.className=className;
    if(text!=='') el.textContent=String(text);
    return el;
  }
  function achButton(className='', text=''){
    const btn=achEl('button', className, text);
    btn.type='button';
    return btn;
  }
  function achStoreGet(key, fallback=''){
    const store = window.ModeAtlasStorage;
    return store?.get?.(key, fallback) ?? localStorage.getItem(key) ?? fallback;
  }

  function achStoreSet(key, value){
    const store = window.ModeAtlasStorage;
    return store?.set?.(key, value) ?? localStorage.setItem(key, String(value));
  }

  function achStoreJSON(key, fallback){
    const store = window.ModeAtlasStorage;
    if (store?.json) return store.json(key, fallback);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }

  function achStoreSetJSON(key, value){
    const store = window.ModeAtlasStorage;
    return store?.setJSON?.(key, value) ?? localStorage.setItem(key, JSON.stringify(value));
  }

  function setProgress(el,pct){
    el.dataset.maProgress=String(clamp(pct));
    return el;
  }
  function clamp(n){return Math.round(Math.max(0, Math.min(100, Number(n)||0)));}
  const {tracks:ACHIEVEMENT_TRACKS,categories:CATEGORY_META,countStats}=window.ModeAtlasAchievements;
  const RANK_ACCENTS = Object.freeze([1,2,3,4,5].map(rank=>`var(--ma-rank-${rank}-rgb)`));

  function valueFor(s,key){ return Number(s[key]||0); }
  function isRankDone(rank,s){ return window.ModeAtlasAchievements.done(rank,s); }
  function rankAccent(index){ return RANK_ACCENTS[Math.min(RANK_ACCENTS.length-1,Math.max(0,index))]; }
  function trackRankAccent(track,index,done=false){
    return track?.ranks?.length===1 && done ? RANK_ACCENTS[RANK_ACCENTS.length-1] : rankAccent(index);
  }
  function rankProgress(track,index,s){
    const rank=track.ranks[index];
    if(!rank) return 0;
    const value=valueFor(s,rank.key);
    if(isRankDone(rank,s)) return 100;
    const previous=index>0?track.ranks[index-1]:null;
    const floor=previous && previous.key===rank.key ? Number(previous.target||0) : 0;
    const span=Math.max(1,Number(rank.target||0)-floor);
    return clamp((value-floor)/span*100);
  }
  function trackState(track,s){
    const completedCount=track.ranks.filter(rank=>isRankDone(rank,s)).length;
    const complete=completedCount>=track.ranks.length;
    const displayIndex=complete?track.ranks.length-1:Math.min(completedCount,track.ranks.length-1);
    return {completedCount,complete,displayIndex,rank:track.ranks[displayIndex],pct:rankProgress(track,displayIndex,s)};
  }

  function achievementTile(track,s,categoryKey){
    const meta=CATEGORY_META[categoryKey],state=trackState(track,s),ranked=track.ranks.length>1,id=`${categoryKey}:${track.id}`;
    ACH_INDEX[id]={track,state,categoryKey,meta,snapshot:s};
    const tile=achButton(`ma-achievement-tile${state.completedCount?' has-rank':''}${state.complete?' done':''}`);
    tile.dataset.maAchId=id;tile.dataset.maAchRankAccent=trackRankAccent(track,Math.max(0,state.completedCount-1),state.complete);
    tile.setAttribute('aria-label',state.complete?`${track.name}, maximum rank unlocked`:`${track.name}, ${ranked?`Rank ${state.rank.tier}, `:''}${state.pct}% toward ${state.rank.short}`);
    const graphic=achEl('span','ma-ach-graphic');graphic.append(window.ModeAtlasAchievementArt.badge(track.id,Math.max(0,state.completedCount-1),{earned:state.completedCount>0}));
    const copy=achEl('span','ma-ach-copy');copy.append(achEl('strong','',track.name),achEl('small','',state.complete?'All milestones earned':state.rank.short));
    const foot=achEl('span','ma-ach-tile-foot');foot.append(achEl('span','',state.completedCount?ranked?`Rank ${track.ranks[state.completedCount-1].tier}`:'Earned':'First milestone'),achEl('span','',state.complete?'✓':`${state.pct}%`));
    const meter=achEl('span','ma-ach-meter');meter.setAttribute('aria-hidden','true');meter.append(setProgress(achEl('span','ma-ach-meter-fill'),state.pct));
    tile.append(graphic,copy,foot,meter);return tile;
  }

  function currentUnlockedAchievements(){return window.ModeAtlasAchievements.unlocked();}
  function getSeenAchievementSet(){
    try { return new Set(achStoreJSON('modeAtlasSeenAchievementUnlocks', [])); }
    catch(e){ return new Set(); }
  }
  function saveSeenAchievementSet(set){
    try { achStoreSetJSON('modeAtlasSeenAchievementUnlocks', [...set]); } catch(e){}
  }
  function achievementToast(message){
    window.ModeAtlasFeedback?.toast?.(message, 'success', 4200, {sound:'achievement'});
  }
  function checkAchievementUnlocks({silent=false}={}){
    const unlocked=currentUnlockedAchievements();
    let seen=getSeenAchievementSet();
    window.ModeAtlasProgress.recordAchievements([...seen,...unlocked.map(item=>item.id)]);
    if(!achStoreGet('modeAtlasAchievementBaselineSet', '')){
      unlocked.forEach(a=>seen.add(a.id));
      saveSeenAchievementSet(seen);
      try { achStoreSet('modeAtlasAchievementBaselineSet','1'); } catch(e){}
      return [];
    }
    const fresh=unlocked.filter(a=>!seen.has(a.id));
    if(fresh.length){
      fresh.forEach(a=>seen.add(a.id));
      saveSeenAchievementSet(seen);
      if(!silent){
        const first=fresh[0];
        const suffix=fresh.length>1 ? ` +${fresh.length-1} more` : '';
        const action=first.ranked && first.rankIndex>0 ? 'Achievement ranked up' : 'Achievement unlocked';
        achievementToast(`${action}: ${first.name}${first.tier?` ${first.tier}`:''}${suffix}`);
      }
    }
    return fresh;
  }
  function startAchievementWatcher(){
    if(window.__maAchievementWatcherStarted) return;
    window.__maAchievementWatcherStarted=true;
    checkAchievementUnlocks({silent:true});

    let scheduled=false;
    const checkFromEvent=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;checkAchievementUnlocks();});};
    window.addEventListener('storage',e=>{
      if(e && e.key && /charStats|reverseCharStats|charTimes|testModeResults|kanaWordBank|modeAtlasProgress|modeAtlasLastCloudSyncAt|modeAtlasPresetAchievementProgress/.test(e.key)) checkFromEvent();
    });
    window.addEventListener('modeAtlasProgressChanged',checkFromEvent);
    window.addEventListener('modeAtlasKanjiChanged',checkFromEvent);
    document.addEventListener('ma:progress-updated',checkFromEvent);
    document.addEventListener('ma:preset-progress-updated',checkFromEvent);
    window.addEventListener('modeAtlasCloudDataChanged',checkFromEvent);
    window.addEventListener('pageshow',event=>{ if(event.persisted===true) checkFromEvent(); });
  }
  function renderAchievements(selection,onSelect){
    const s=countStats();ACH_INDEX={};
    const completed=window.ModeAtlasAchievements.completion(s);
    const wrap=achEl('div','ma-ach-collection'),hero=achEl('header','ma-ach-collection-hero'),copy=achEl('div');
    copy.append(achEl('p','ma-ach-eyebrow','Your collection'),achEl('h3','',`${completed.earned} milestones earned`),achEl('p','ma-ach-collection-total',`${completed.percent}% of study milestones`));
    const help=achEl('details','ma-ach-definition');help.append(achEl('summary','','How milestones count'),achEl('p','','Each rank is a milestone. Completion counts current study milestones across Atlas, Kana, Kanji and Words. Special rewards and retired milestones stay in your collection without affecting the percentage. Earned ranks stay earned.'));copy.append(help);
    const art=achEl('img','ma-ach-collection-art');art.src=window.ModeAtlasVersionFile.appUrl('/assets/illustrations/achievement-scene.svg');art.alt='';hero.append(copy,art);wrap.append(hero);
    const controls=achEl('div','ma-ach-controls');
    for(const [key,label,options]of [
      ['category','Achievement branch',[['all','For you'],['modeAtlas','Atlas'],['kana','Kana'],['kanji','Kanji'],['wordbank','Words']]],
      ['filter','Achievement status',[['progress','Within reach'],['unlocked','Earned'],['all','All']]]
    ]){
      const group=achEl('div','ma-ach-switch ma-ach-switch--'+key);group.setAttribute('role','group');group.setAttribute('aria-label',label);
      for(const [value,text]of options){const control=achButton('',text);control.setAttribute('aria-pressed',String(selection[key]===value));control.dataset.maAchChoice=`${key}:${value}`;control.addEventListener('click',()=>onSelect(key,value));group.append(control);}controls.append(group);
    }
    wrap.append(controls);
    let tracks=Object.entries(ACHIEVEMENT_TRACKS).flatMap(([category,items])=>items.map(track=>({category,track,state:trackState(track,s)})))
      .filter(item=>(selection.category==='all'||selection.category===item.category)&&(!item.track.legacy||selection.filter==='unlocked'&&item.state.completedCount)&&(!window.ModeAtlasAchievements.special(item.track.id)||item.state.completedCount))
      .filter(item=>selection.filter==='all'||(selection.filter==='unlocked'?item.state.completedCount:!item.state.complete));
    if(selection.filter==='progress')tracks.sort((a,b)=>b.state.pct-a.state.pct||b.state.completedCount-a.state.completedCount);
    if(selection.filter==='unlocked')tracks.sort((a,b)=>Math.max(...b.track.ranks.map(rank=>s.earned[rank.unlockId]||0))-Math.max(...a.track.ranks.map(rank=>s.earned[rank.unlockId]||0)));
    const total=tracks.length;if(selection.category==='all'&&selection.filter==='progress')tracks=tracks.slice(0,6);
    const section=achEl('section','ma-achievement-section'),head=achEl('div','ma-ach-section-head');
    head.append(achEl('h3','',selection.filter==='progress'?'Your next milestones':selection.filter==='unlocked'?'In your collection':'Explore milestones'),achEl('span','ma-ach-section-count',`${total} ${total===1?'achievement':'achievements'}`));section.append(head);
    const grid=achEl('div','ma-achievement-grid');tracks.forEach(({track,category})=>grid.append(achievementTile(track,s,category)));
    if(!tracks.length)grid.append(achEl('p','ma-ach-empty',selection.filter==='unlocked'?'Your first milestone is ahead. A little practice will get you there.':'Every milestone in this selection is earned.'));
    section.append(grid);wrap.append(section);
    if(tracks.length<total){const more=achButton('ma-button ma-button--ghost','Explore all milestones');more.addEventListener('click',()=>onSelect('filter','all'));wrap.append(more);}
    return wrap;
  }

  function createInfoTopbar({branch, cls='', done=false, accent='96,165,250', rankAccentValue='', symbol='✦', kicker='', title='', tier=''}){
    const topbar=achEl('div','ma-ach-info-topbar');
    const hero=achEl('div',`ma-ach-info-hero branch-${branch} ${cls || (done?'done':'')}`);
    hero.dataset.maAchAccent=accent;
    hero.dataset.maAchRankAccent=rankAccentValue||accent;
    const sym=achEl('span','ma-ach-info-symbol',symbol); sym.setAttribute('aria-hidden','true');
    const titleWrap=document.createElement('div'); titleWrap.append(achEl('span','ma-ach-info-kicker',kicker));
    const h3=achEl('h3','',title); if(tier)h3.append(document.createTextNode(' '),achEl('em','',tier)); titleWrap.append(h3); hero.append(sym,titleWrap);
    topbar.append(hero); return topbar;
  }

  function buildAchievementInfo(id,requestedRankIndex){
    const item=ACH_INDEX[id]; if(!item)return null;
    const {track,state,categoryKey,meta,snapshot}=item;
    const ranked=track.ranks.length>1;
    const viewIndex=Number.isInteger(requestedRankIndex)?Math.max(0,Math.min(track.ranks.length-1,requestedRankIndex)):state.displayIndex;
    const rank=track.ranks[viewIndex];
    const value=valueFor(snapshot,rank.key), done=isRankDone(rank,snapshot), pct=rankProgress(track,viewIndex,snapshot);
    const rankAccentValue=trackRankAccent(track,viewIndex,done);
    const body=achEl('div','ma-ach-info-body');
    body.dataset.maAchId=id;
    const progress=achEl('div','ma-ach-info-progress'); progress.dataset.maAchRankAccent=rankAccentValue;
    const row=achEl('div','ma-ach-info-progress-row');
    const valueText=rank.key==='atlasLevel' ? `Level ${(done?rank.target:Math.min(value,rank.target))} / ${rank.target}` : `${(done?rank.target:Math.min(value,rank.target))} / ${rank.target}`;
    row.append(achEl('strong','',done?'Rank complete':'In progress'),achEl('span','',valueText));
    const meter=document.createElement('i'); meter.append(setProgress(document.createElement('b'),pct)); progress.append(row,meter);
    body.append(createInfoTopbar({branch:categoryKey,done:state.complete,accent:meta.accent,rankAccentValue,symbol:track.icon||meta.icon,kicker:meta.title,title:track.name,tier:ranked?`Rank ${rank.tier}`:''}),achEl('p','ma-ach-info-copy',rank.detail),progress);

    if(ranked){
      const history=achEl('div','ma-ach-rank-history');
      track.ranks.forEach((entry,index)=>{
        const step=achButton(`ma-ach-rank-step${isRankDone(entry,snapshot)?' done':''}${index===viewIndex?' current':''}`,`Rank ${entry.tier}`);
        step.dataset.maAchRankNav=id;
        step.dataset.maAchRankIndex=String(index);
        step.dataset.maAchRankAccent=rankAccent(index);
        step.setAttribute('aria-label',`View ${track.name} Rank ${entry.tier}`);
        history.append(step);
      });
      body.append(history);
    }
    const art=body.querySelector('.ma-ach-info-symbol');if(art)art.replaceChildren(window.ModeAtlasAchievementArt.badge(track.id,viewIndex,{earned:done}));
    applyAchievementVisuals(body); return body;
  }

  let featureOpen=false;
  function buildFeatureContent(kind,branch='kana'){
    const root=achEl('div','ma-ach-dialog-content'),view=achEl('div','ma-ach-dialog-view');
    const native=window.AtlasPlatform?.isNative===true;
    if(native&&kind!=='mastery')root.classList.add('ma-ach-native');
    const selection=kind==='mastery'?{branch:branch==='kanji'?'kanji':'kana',level:5}:{category:'all',filter:'progress'};
    let atRoot=true;
    let lastAchievement='',lastKana='';
    let lastScroll=0;
    root.append(view);
    const showMain=()=>{
      atRoot=true;
      view.replaceChildren();
      if(kind==='mastery'){
        const branches=achEl('div','ma-mastery-branches');branches.setAttribute('role','group');branches.setAttribute('aria-label','Mastery branch');
        for(const [id,label]of [['kana','Kana'],['kanji','Kanji']]){const button=achButton('ma-button ma-button--ghost',label);button.setAttribute('aria-pressed',String(selection.branch===id));button.addEventListener('click',()=>{selection.branch=id;showMain();});branches.append(button);}view.append(branches);
        if(selection.branch==='kanji')view.append(window.ModeAtlasKanjiMastery.render(selection,(key,value)=>{selection[key]=value;if(key==='level')selection.kanjiPage=0;showMain();},showDetail));
        else view.append(window.ModeAtlasKanaMastery.render((char,detail)=>{lastScroll=root.closest('.ma-dialog')?.scrollTop||0;lastKana=char;showDetail(detail);}));
      }else view.append(renderAchievements(selection,(key,value)=>{
        selection[key]=value;showMain();view.querySelector(`[data-ma-ach-choice="${key}:${value}"]`)?.focus({preventScroll:true});
      }));
      applyAchievementVisuals(view);
    };
    const showDetail=detail=>{
      if(!detail)return;
      atRoot=false;view.replaceChildren(detail);
      const dialog=root.closest('.ma-dialog');if(dialog)dialog.scrollTop=0;
      const heading=detail.querySelector('h3');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
    };
    root.handleFeatureCloseRequest=()=>{
      if(atRoot) return false;
      showMain();
      const dialog=root.closest('.ma-dialog');if(dialog)dialog.scrollTop=lastScroll;
      if(lastKana)view.querySelector(`[data-ma-mastery-kana="${lastKana}"]`)?.focus({preventScroll:true});
      if(lastAchievement)view.querySelector(`[data-ma-ach-id="${lastAchievement}"]`)?.focus({preventScroll:true});
      return true;
    };
    root.addEventListener('click',e=>{
      const rankNav=e.target.closest('[data-ma-ach-rank-nav]');
      if(rankNav && !rankNav.disabled){
        e.preventDefault();
        const id=rankNav.getAttribute('data-ma-ach-rank-nav');
        const index=Number(rankNav.getAttribute('data-ma-ach-rank-index'));
        const detail=buildAchievementInfo(id,Number.isFinite(index)?index:undefined);
        showDetail(detail);
        return;
      }
      const ach=e.target.closest('[data-ma-ach-id]');
      if(ach){
        e.preventDefault();
        lastScroll=root.closest('.ma-dialog')?.scrollTop||0;
        lastAchievement=ach.getAttribute('data-ma-ach-id');
        const detail=buildAchievementInfo(ach.getAttribute('data-ma-ach-id'));
        showDetail(detail);
        return;
      }

    });
    showMain(); return root;
  }
  function openModal(kind,branch='kana'){
    if(featureOpen||!window.ModeAtlasDialog?.feature)return false;
    featureOpen=true;
    const content=buildFeatureContent(kind,branch);
    window.ModeAtlasDialog.feature({
      kicker:kind==='mastery'?'Learning progress':'Mode Atlas progress',
      title:kind==='mastery'?'Mastery Map':'Achievements',
      message:'',
      contentNode:content,
      size:'large',
      closeLabel:'×',
      closeAriaLabel:kind==='mastery'?'Close Mastery Map or return to the map':'Close achievements or return to achievements',
      closeIcon:true,
      onCloseRequest:()=>content.handleFeatureCloseRequest?.()===true
    }).finally(()=>{featureOpen=false;});
    return true;
  }

  function init(){
    startAchievementWatcher();
    if(!window.__maFeatureClickBound){
      window.__maFeatureClickBound=true;
      document.addEventListener('click',e=>{
        if(e.target.closest('[data-ma-achievements-open]')) {
          e.preventDefault();
          openModal('achievements');
          return;
        }
        if(e.target.closest('[data-ma-mastery-open]')) {
          e.preventDefault();
          openModal('mastery');
        }
      });
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
  window.ModeAtlasFeatures={openAchievements:()=>openModal('achievements'), openMasteryMap:(branch='kana')=>openModal('mastery',branch), checkAchievements:()=>checkAchievementUnlocks(), achievementSnapshot:()=>{checkAchievementUnlocks({silent:true});return currentUnlockedAchievements().map(item=>item.id);}, sessionAchievements:baseline=>{if(!Array.isArray(baseline))return [];checkAchievementUnlocks();const before=new Set(baseline);return currentUnlockedAchievements().filter(item=>!before.has(item.id));}, version:VERSION};
})();
