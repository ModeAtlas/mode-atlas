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
  const HIRA = Collections.hiragana;
  const KATA = Collections.katakana;
  const DAK = Collections.dakuten;
  const YOON = Collections.yoon;
  const EXT = Collections.extended;
  const ALL = Collections.all;
  const PRESET_TRACKERS = [
    {id:'presetStarter', name:'Starter', desc:'A-row with hints', chars:Object.freeze(Object.keys(KanaData.hiraganaRows.h_a))},
    {id:'presetIntermediate', name:'Intermediate', desc:'All Hiragana, no hints', chars:HIRA},
    {id:'presetAdvanced', name:'Advanced', desc:'Hiragana + Katakana + Dakuten', chars:Object.freeze([...HIRA,...KATA,...DAK])},
    {id:'presetPro', name:'Pro', desc:'Everything enabled', chars:ALL}
  ];
  let ACH_INDEX = {};
  function readJSON(k, fallback){ try{ return achStoreJSON(k, fallback); }catch(e){ return fallback; } }
  
function applyAchievementVisuals(root = document) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("[data-ma-ach-accent]").forEach(el => {
        el.style.setProperty("--ma-ach-accent", el.dataset.maAchAccent || "96,165,250");
    });
    scope.querySelectorAll("[data-ma-ach-rank-accent]").forEach(el => {
        el.style.setProperty("--ma-ach-rank", el.dataset.maAchRankAccent || "148,163,184");
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
  function formatAccuracyPercent(value){
    return `${(Number(value)||0).toFixed(2)}%`;
  }
  function latestTimestamp(keys){ let best=0; keys.forEach(k=>{ const v=achStoreGet(k, ''); const t=v?Date.parse(v):0; if(t>best) best=t; }); return best; }
  function countStats(){
    const snapshot=Metrics.createSnapshot();
    const r=snapshot.readingStats, w=snapshot.writingStats;
    const words=readJSON('kanaWordBank',[]);
    const progression=window.ModeAtlasProgress?.getSummary?.()||{};
    const readingTotals=Metrics.statTotals(r), writingTotals=Metrics.statTotals(w);
    const correct=readingTotals.c+writingTotals.c, wrong=readingTotals.w+writingTotals.w;
    const seen=ALL.reduce((count,ch)=>count+(Metrics.charCorrect(ch,snapshot)+Metrics.charWrong(ch,snapshot)>0?1:0),0);
    const mastery=Metrics.masteryCounts(ALL,snapshot);
    let under2=0, under1=0, speed3to2=0, speed2to1=0, speedUnder1=0, avgSum=0, avgCount=0;
    ALL.forEach(ch=>{
      const avg=Metrics.charAvg(ch,snapshot);
      if(avg){
        avgSum+=avg; avgCount++;
        if(avg<=2000) under2++;
        if(avg<=1000) under1++;
        if(avg>=2000 && avg<=3000) speed3to2++;
        else if(avg>=1000 && avg<2000) speed2to1++;
        else if(avg<1000) speedUnder1++;
      }
    });
    const presetValues = {};
    PRESET_TRACKERS.forEach(preset=>{
      presetValues[preset.id] = Math.min(100, preset.chars.reduce((sum,ch)=>sum+Metrics.charCorrect(ch,snapshot),0));
    });
    const wordCount = Array.isArray(words) ? words.length : (words&&typeof words==='object'?Object.keys(words).length:0);
    const resultCount = Metrics.formalTestCount(snapshot);
    const perfectSeen = new Set();
    Object.entries(snapshot.tests||{}).forEach(([storageKey,list])=>{
      (Array.isArray(list)?list:[]).forEach(test=>{
        if(!test || typeof test!=='object' || test.type==='average') return;
        const correctCount=Number(test.correct||test.right||0);
        const wrongCount=Number(test.wrong||test.incorrect||0);
        const accuracy=Number(test.accuracy||0);
        if(correctCount<=0 || !(wrongCount===0 || accuracy>=100)) return;
        const mode=test.mode==='writing' || /writing|reverse/i.test(storageKey) ? 'writing' : 'reading';
        const signature=String(test.id||test.createdAt||test.completedAt||test.startedAt||test.date||`${correctCount}|${wrongCount}`);
        perfectSeen.add(`${mode}|${signature}`);
      });
    });
    const cloud = achStoreGet('modeAtlasLastCloudSyncAt', '') ? 1 : 0;
    const backup = achStoreGet('modeAtlasLastExportAt', '') || achStoreGet('modeAtlasLastBackupAt', '') ? 1 : 0;
    const recentSave = latestTimestamp(['settingsUpdatedAt','resultsUpdatedAt','srsUpdatedAt','dailyUpdatedAt','profileUpdatedAt','kanaWordBankUpdatedAt']);
    return {
      correct,wrong,total:correct+wrong,seen,
      new:mastery.New,mastered:mastery.Mastered,reviewing:mastery.Reviewing,learning:mastery.Learning,
      under2,under1,speed3to2,speed2to1,speedUnder1,wordCount,resultCount,perfect:perfectSeen.size,cloud,backup,recentSave,
      atlasLevel:Number(progression.level||1),avg:avgCount?avgSum/avgCount:0,snapshot,...presetValues
    };
  }

  const CATEGORY_META = Object.freeze({
    modeAtlas:Object.freeze({title:'Mode Atlas',description:'Account-wide learning, progression, and app milestones.',accent:'245,195,93',icon:'✦'}),
    kana:Object.freeze({title:'Kana Trainer',description:'Recognition, recall, speed, mastery, presets, and formal Test Mode milestones.',accent:'167,139,250',icon:'あ'}),
    wordbank:Object.freeze({title:'Word Bank',description:'Milestones for building and maintaining your personal Japanese vocabulary collection.',accent:'96,165,250',icon:'語'})
  });

  const FUTURE_CATEGORIES = Object.freeze([
    Object.freeze({title:'Listening',icon:'聴',copy:'Listening achievements will appear here when the Listening branch launches.'}),
    Object.freeze({title:'Grammar',icon:'文',copy:'Grammar achievements will appear here when the Grammar branch launches.'}),
    Object.freeze({title:'Reading Comprehension',icon:'読',copy:'Reading Comprehension achievements will appear here when that branch launches.'})
  ]);

  const RANK_ACCENTS = Object.freeze(['180,119,74','148,163,184','245,195,93','167,139,250','103,232,249']);

  const ACHIEVEMENT_TRACKS = Object.freeze({
    modeAtlas:Object.freeze([
      Object.freeze({id:'study-rhythm',name:'Study Rhythm',icon:'◎',ranks:Object.freeze([
        Object.freeze({tier:'I',short:'25 answers',detail:'Answer 25 questions in Mode Atlas. This is the first step toward a sustained study rhythm.',target:25,key:'total',unlockId:'general-0'}),
        Object.freeze({tier:'II',short:'250 answers',detail:'Answer 250 total questions and establish a repeatable practice rhythm.',target:250,key:'total',unlockId:'general-1'}),
        Object.freeze({tier:'III',short:'1,000 answers',detail:'Answer 1,000 total questions across your study sessions.',target:1000,key:'total',unlockId:'general-2'}),
        Object.freeze({tier:'IV',short:'2,500 answers',detail:'Answer 2,500 total questions across Mode Atlas.',target:2500,key:'total',unlockId:'general-3'}),
        Object.freeze({tier:'V',short:'5,000 answers',detail:'Answer 5,000 total questions. This rank represents long-term study consistency.',target:5000,key:'total',unlockId:'general-4'})
      ])}),
      Object.freeze({id:'atlas-level',name:'Atlas Level',icon:'▲',ranks:Object.freeze([
        Object.freeze({tier:'I',short:'Reach Atlas Level 5',detail:'Reach Atlas Level 5 through learning activity across Mode Atlas.',target:5,key:'atlasLevel',unlockId:'modeatlas-level-5'}),
        Object.freeze({tier:'II',short:'Reach Atlas Level 10',detail:'Reach Atlas Level 10.',target:10,key:'atlasLevel',unlockId:'modeatlas-level-10'}),
        Object.freeze({tier:'III',short:'Reach Atlas Level 20',detail:'Reach Atlas Level 20.',target:20,key:'atlasLevel',unlockId:'modeatlas-level-20'}),
        Object.freeze({tier:'IV',short:'Reach Atlas Level 50',detail:'Reach Atlas Level 50 through sustained learning activity.',target:50,key:'atlasLevel',unlockId:'modeatlas-level-50'}),
        Object.freeze({tier:'V',short:'Reach Atlas Level 100',detail:'Reach Atlas Level 100, the highest milestone in the initial Atlas Level achievement track.',target:100,key:'atlasLevel',unlockId:'modeatlas-level-100'})
      ])}),
      Object.freeze({id:'cloud-ready',name:'Cloud Ready',icon:'☁',ranks:Object.freeze([
        Object.freeze({tier:'',short:'Complete a cloud sync',detail:'Sign in and complete at least one successful cloud save so progress can follow you across devices.',target:1,key:'cloud',unlockId:'general-5'})
      ])}),
      Object.freeze({id:'safety-net',name:'Safety Net',icon:'⟲',ranks:Object.freeze([
        Object.freeze({tier:'',short:'Export a backup',detail:'Export or copy a save backup at least once. Backups help protect progress before major changes.',target:1,key:'backup',unlockId:'general-6'})
      ])})
    ]),
    kana:Object.freeze([
      Object.freeze({id:'kana-discovery',name:'Kana Discovery',icon:'カ',ranks:Object.freeze([
        Object.freeze({tier:'I',short:'25 kana seen',detail:'Practise at least 25 unique kana in Reading or Writing.',target:25,key:'seen',unlockId:'kana-0'}),
        Object.freeze({tier:'II',short:'75 kana seen',detail:'Practise at least 75 unique kana in the Kana Trainer.',target:75,key:'seen',unlockId:'kana-1'}),
        Object.freeze({tier:'III',short:'125 kana seen',detail:'Practise at least 125 unique kana across the trainer.',target:125,key:'seen',unlockId:'kana-2'}),
        Object.freeze({tier:'IV',short:'175 kana seen',detail:'Practise 175 unique kana, covering most of the current Kana Trainer inventory.',target:175,key:'seen',unlockId:'kana-3'})
      ])}),
      Object.freeze({id:'preset-starter',name:'Starter Preset',icon:'賞',ranks:Object.freeze([
        Object.freeze({tier:'',short:'Starter 100/100',detail:'Reach 100 correct answers while progressing through the Starter preset.',target:100,key:'presetStarter',unlockId:'kana-4'})
      ])}),
      Object.freeze({id:'preset-intermediate',name:'Intermediate Preset',icon:'賞',ranks:Object.freeze([
        Object.freeze({tier:'',short:'Intermediate 100/100',detail:'Reach 100 correct answers while progressing through the Intermediate preset.',target:100,key:'presetIntermediate',unlockId:'kana-5'})
      ])}),
      Object.freeze({id:'preset-advanced',name:'Advanced Preset',icon:'賞',ranks:Object.freeze([
        Object.freeze({tier:'',short:'Advanced 100/100',detail:'Reach 100 correct answers while progressing through the Advanced preset.',target:100,key:'presetAdvanced',unlockId:'kana-6'})
      ])}),
      Object.freeze({id:'preset-pro',name:'Pro Preset',icon:'賞',ranks:Object.freeze([
        Object.freeze({tier:'',short:'Pro 100/100',detail:'Reach 100 correct answers while progressing through the Pro preset.',target:100,key:'presetPro',unlockId:'kana-7'})
      ])}),
      Object.freeze({id:'speed-goal',name:'Speed Goal',icon:'速',ranks:Object.freeze([
        Object.freeze({tier:'I',short:'25 kana under 2.0s',detail:'Build timing history until 25 kana average under 2.0 seconds.',target:25,key:'under2',unlockId:'kana-8'}),
        Object.freeze({tier:'II',short:'50 kana under 2.0s',detail:'Reach the 2.0 second recognition goal on 50 kana.',target:50,key:'under2',unlockId:'kana-9'}),
        Object.freeze({tier:'III',short:'100 kana under 2.0s',detail:'Reach the 2.0 second recognition goal on 100 kana.',target:100,key:'under2',unlockId:'kana-10'})
      ])}),
      Object.freeze({id:'fluent-target',name:'Fluent Target',icon:'流',ranks:Object.freeze([
        Object.freeze({tier:'I',short:'10 kana under 1.0s',detail:'Build timing history until 10 kana average under 1.0 second.',target:10,key:'under1',unlockId:'kana-11'}),
        Object.freeze({tier:'II',short:'25 kana under 1.0s',detail:'Reach fluent-speed timing on 25 kana.',target:25,key:'under1',unlockId:'kana-12'}),
        Object.freeze({tier:'III',short:'50 kana under 1.0s',detail:'Reach fluent-speed timing on 50 kana. This is a strong recognition milestone.',target:50,key:'under1',unlockId:'kana-13'})
      ])}),
      Object.freeze({id:'mastery-path',name:'Mastery Path',icon:'達',ranks:Object.freeze([
        Object.freeze({tier:'I',short:'20 mastered',detail:'Reach Mastered on 20 kana. Mastered combines attempts, accuracy, and speed.',target:20,key:'mastered',unlockId:'kana-14'}),
        Object.freeze({tier:'II',short:'50 mastered',detail:'Reach Mastered on 50 kana.',target:50,key:'mastered',unlockId:'kana-15'}),
        Object.freeze({tier:'III',short:'100 mastered',detail:'Reach Mastered on 100 kana.',target:100,key:'mastered',unlockId:'kana-16'})
      ])}),
      Object.freeze({id:'test-taker',name:'Test Taker',icon:'試',ranks:Object.freeze([
        Object.freeze({tier:'I',short:'1 formal test',detail:'Complete your first formal Kana Trainer Test Mode assessment.',target:1,key:'resultCount',unlockId:'kana-17'}),
        Object.freeze({tier:'II',short:'10 formal tests',detail:'Complete 10 formal Kana Trainer Test Mode assessments.',target:10,key:'resultCount',unlockId:'kana-18'})
      ])}),
      Object.freeze({id:'perfect-form',name:'Perfect Form',icon:'✓',ranks:Object.freeze([
        Object.freeze({tier:'I',short:'1 perfect test',detail:'Complete a formal Reading or Writing Test Mode assessment with no mistakes.',target:1,key:'perfect',unlockId:'kana-19'}),
        Object.freeze({tier:'II',short:'5 perfect tests',detail:'Complete five formal Test Mode assessments with no mistakes.',target:5,key:'perfect',unlockId:'kana-20'})
      ])})
    ]),
    wordbank:Object.freeze([
      Object.freeze({id:'word-collection',name:'Word Collection',icon:'語',ranks:Object.freeze([
        Object.freeze({tier:'I',short:'Save your first word',detail:'Save your first word in Word Bank.',target:1,key:'wordCount',unlockId:'wordbank-0'}),
        Object.freeze({tier:'II',short:'25 saved words',detail:'Build your Word Bank to 25 saved words.',target:25,key:'wordCount',unlockId:'wordbank-1'}),
        Object.freeze({tier:'III',short:'100 saved words',detail:'Build your Word Bank to 100 saved words.',target:100,key:'wordCount',unlockId:'wordbank-2'}),
        Object.freeze({tier:'IV',short:'250 saved words',detail:'Build your Word Bank to 250 saved words.',target:250,key:'wordCount',unlockId:'wordbank-3'}),
        Object.freeze({tier:'V',short:'500 saved words',detail:'Build your Word Bank to 500 saved words.',target:500,key:'wordCount',unlockId:'wordbank-4'})
      ])})
    ])
  });

  function valueFor(s,key){ return Number(s[key]||0); }
  function isRankDone(rank,s){ return valueFor(s,rank.key)>=Number(rank.target||0); }
  function rankAccent(index){ return RANK_ACCENTS[Math.min(RANK_ACCENTS.length-1,Math.max(0,index))]; }
  function rankProgress(track,index,s){
    const rank=track.ranks[index];
    if(!rank) return 0;
    const value=valueFor(s,rank.key);
    if(value>=rank.target) return 100;
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
  function milestoneList(){
    const out=[];
    Object.entries(ACHIEVEMENT_TRACKS).forEach(([category,tracks])=>tracks.forEach(track=>track.ranks.forEach((rank,rankIndex)=>out.push({category,track,rank,rankIndex}))));
    return out;
  }

  function achievementTile(track,s,categoryKey){
    const meta=CATEGORY_META[categoryKey];
    const state=trackState(track,s);
    const ranked=track.ranks.length>1;
    const id=`${categoryKey}:${track.id}`;
    ACH_INDEX[id]={track,state,categoryKey,meta,snapshot:s};

    const tile=achButton(`ma-achievement-tile category-${categoryKey} rank-${state.displayIndex+1}${state.completedCount?' has-rank':''}${state.complete?' done':''}`);
    tile.dataset.maAchAccent=meta.accent;
    tile.dataset.maAchRankAccent=rankAccent(state.displayIndex);
    tile.dataset.maAchId=id;
    tile.setAttribute('aria-label', state.complete ? `${track.name}, maximum rank unlocked` : `${track.name}, ${ranked?`Rank ${state.rank.tier}, `:''}${state.pct}% toward ${state.rank.short}`);

    const top=achEl('div','ma-ach-topline');
    top.append(
      achEl('span','ma-ach-rank-badge',ranked?`Rank ${state.rank.tier}`:(state.complete?'Unlocked':'Milestone')),
      achEl('span','ma-ach-status-text',state.complete?'Max rank':`${state.pct}%`)
    );

    const graphic=achEl('span','ma-ach-graphic',track.icon||meta.icon);
    graphic.setAttribute('aria-hidden','true');
    const meter=achEl('div','ma-ach-meter');
    meter.setAttribute('aria-hidden','true');
    meter.append(setProgress(achEl('span','ma-ach-meter-fill'),state.pct));

    tile.append(top,graphic,achEl('strong','',track.name),achEl('small','',state.rank.short),meter);
    return tile;
  }

  function categorySection(categoryKey,s){
    const meta=CATEGORY_META[categoryKey];
    const tracks=ACHIEVEMENT_TRACKS[categoryKey]||[];
    const milestones=tracks.flatMap(track=>track.ranks);
    const unlocked=milestones.filter(rank=>isRankDone(rank,s)).length;
    const section=achEl('section',`ma-achievement-section category-${categoryKey}`);
    section.dataset.maAchAccent=meta.accent;
    const head=achEl('div','ma-ach-section-head');
    const copy=document.createElement('div');
    copy.append(achEl('h3','',meta.title),achEl('p','ma-ach-section-copy',meta.description));
    head.append(copy,achEl('span','ma-ach-section-count',`${unlocked}/${milestones.length} milestones`));
    const grid=achEl('div','ma-achievement-grid');
    tracks.forEach(track=>grid.append(achievementTile(track,s,categoryKey)));
    section.append(head,grid);
    return section;
  }

  function futureSection(item){
    const section=achEl('section','ma-achievement-section ma-achievement-section--future');
    const head=achEl('div','ma-ach-section-head');
    const copy=document.createElement('div');
    copy.append(achEl('h3','',item.title),achEl('p','ma-ach-section-copy',item.copy));
    head.append(copy,achEl('span','ma-ach-future-status','Future branch'));
    const placeholder=achEl('div','ma-ach-future-placeholder');
    placeholder.append(achEl('span','ma-ach-future-icon',item.icon),achEl('strong','',`${item.title} achievements`),achEl('small','','Coming later'));
    section.append(head,placeholder);
    return section;
  }

  function currentUnlockedAchievements(){
    const s=countStats();
    return milestoneList().filter(({rank})=>isRankDone(rank,s)).map(({category,track,rank,rankIndex})=>({
      id:rank.unlockId||`${category}:${track.id}:${rankIndex}`,
      category,name:track.name,tier:rank.tier,ranked:track.ranks.length>1,rankIndex
    }));
  }
  function getSeenAchievementSet(){
    try { return new Set(achStoreJSON('modeAtlasSeenAchievementUnlocks', [])); }
    catch(e){ return new Set(); }
  }
  function saveSeenAchievementSet(set){
    try { achStoreSetJSON('modeAtlasSeenAchievementUnlocks', [...set]); } catch(e){}
  }
  function achievementToast(message){
    window.ModeAtlasFeedback?.toast?.(message, 'success', 4200);
  }
  function checkAchievementUnlocks({silent=false}={}){
    const unlocked=currentUnlockedAchievements();
    let seen=getSeenAchievementSet();
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

    const checkFromEvent = () => checkAchievementUnlocks();
    window.addEventListener('storage',e=>{
      if(e && e.key && /charStats|reverseCharStats|charTimes|testModeResults|kanaWordBank|modeAtlasProgress|modeAtlasLastCloudSyncAt|modeAtlasLastExportAt|modeAtlasLastBackupAt|modeAtlasPresetAchievementProgress/.test(e.key)) checkAchievementUnlocks();
    });
    window.addEventListener('modeAtlasProgressChanged',checkFromEvent);
    document.addEventListener('ma:progress-updated',checkFromEvent);
    document.addEventListener('ma:preset-progress-updated',checkFromEvent);
    window.addEventListener('modeAtlasCloudDataChanged',checkFromEvent);
    window.addEventListener('pageshow',event=>{ if(event.persisted===true) checkFromEvent(); });
  }
  function renderAchievements(){
    const s=countStats(); ACH_INDEX={};
    const milestones=milestoneList();
    const unlocked=milestones.filter(({rank})=>isRankDone(rank,s)).length;
    const trackCount=Object.values(ACHIEVEMENT_TRACKS).reduce((sum,tracks)=>sum+tracks.length,0);

    const wrap=document.createDocumentFragment();
    const overview=achEl('div','ma-ach-overview');
    [[unlocked,'Milestones unlocked'],[trackCount,'Achievement tracks'],[clamp(unlocked/Math.max(1,milestones.length)*100)+'%','Complete']].forEach(([value,label])=>{
      const item=document.createElement('div');
      item.append(achEl('b','',value), achEl('span','',label));
      overview.append(item);
    });

    const layout=achEl('div','ma-achievement-layout');
    layout.append(categorySection('modeAtlas',s),categorySection('kana',s),categorySection('wordbank',s));
    FUTURE_CATEGORIES.forEach(item=>layout.append(futureSection(item)));
    wrap.append(overview,layout);
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
    const back=achButton('ma-button ma-button--ghost ma-button--small ma-ach-info-back','Back'); back.dataset.maFeatureBack='';
    topbar.append(hero,back); return topbar;
  }

  function buildAchievementInfo(id,requestedRankIndex){
    const item=ACH_INDEX[id]; if(!item)return null;
    const {track,state,categoryKey,meta,snapshot}=item;
    const ranked=track.ranks.length>1;
    const viewIndex=Number.isInteger(requestedRankIndex)?Math.max(0,Math.min(track.ranks.length-1,requestedRankIndex)):state.displayIndex;
    const rank=track.ranks[viewIndex];
    const value=valueFor(snapshot,rank.key), done=value>=rank.target, pct=rankProgress(track,viewIndex,snapshot);
    const body=achEl('div','ma-ach-info-body');
    body.dataset.maAchId=id;
    const progress=achEl('div','ma-ach-info-progress'); progress.dataset.maAchRankAccent=rankAccent(viewIndex);
    const row=achEl('div','ma-ach-info-progress-row');
    const valueText=rank.key==='atlasLevel' ? `Level ${Math.min(value,rank.target)} / ${rank.target}` : `${Math.min(value,rank.target)} / ${rank.target}`;
    row.append(achEl('strong','',done?'Rank complete':'In progress'),achEl('span','',valueText));
    const meter=document.createElement('i'); meter.append(setProgress(document.createElement('b'),pct)); progress.append(row,meter);
    body.append(createInfoTopbar({branch:categoryKey,done:state.complete,accent:meta.accent,rankAccentValue:rankAccent(viewIndex),symbol:track.icon||meta.icon,kicker:meta.title,title:track.name,tier:ranked?`Rank ${rank.tier}`:''}),achEl('p','ma-ach-info-copy',rank.detail),progress);

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
      const nav=achEl('div','ma-ach-rank-nav');
      const previous=achButton('ma-button ma-button--ghost ma-button--small','← Previous rank');
      previous.dataset.maAchRankNav=id;
      previous.dataset.maAchRankIndex=String(Math.max(0,viewIndex-1));
      previous.disabled=viewIndex===0;
      const position=achEl('span','',`Rank ${viewIndex+1} of ${track.ranks.length}`);
      const next=achButton('ma-button ma-button--ghost ma-button--small','Next rank →');
      next.dataset.maAchRankNav=id;
      next.dataset.maAchRankIndex=String(Math.min(track.ranks.length-1,viewIndex+1));
      next.disabled=viewIndex===track.ranks.length-1;
      nav.append(previous,position,next);
      body.append(history,nav);
    }
    applyAchievementVisuals(body); return body;
  }

  function masteryLabel(ch,snapshot){
    const data=snapshot||Metrics.createSnapshot(); const c=Metrics.charCorrect(ch,data),x=Metrics.charWrong(ch,data),total=c+x,avg=Metrics.charAvg(ch,data); const avgText=avg?` · ${Metrics.formatMs(avg)}`:''; const label=Metrics.masteryLabel(ch,data);
    if(label==='New')return {label:'New',cls:'new',detail:'Not practised yet'}; return {label,cls:Metrics.masteryClass(label),detail:`${c}/${total} correct${avgText}`};
  }
  function masteryStats(ch,snapshot){
    const data=snapshot||Metrics.createSnapshot(); const rs=(data.readingStats&&data.readingStats[ch])||{},ws=(data.writingStats&&data.writingStats[ch])||{};
    const rc=Number(rs.correct||rs.right||0),rw=Number(rs.wrong||rs.incorrect||0),wc=Number(ws.correct||ws.right||0),ww=Number(ws.wrong||ws.incorrect||0); const correct=rc+wc,wrong=rw+ww,total=correct+wrong;
    const avgMs=Metrics.charAvg(ch,data),avg=avgMs?avgMs/1000:0,accuracy=total?(correct/total*100):0,label=masteryLabel(ch,data); return {ch,rc,rw,wc,ww,correct,wrong,total,accuracy,avg,label};
  }
  function buildMasteryKanaInfo(ch){
    const item=masteryStats(ch),avgText=item.avg?item.avg.toFixed(2)+'s':'No timing yet';
    const targetAttempts=Math.min(100,Math.round(item.correct/20*100)),targetAccuracy=item.total?Math.min(100,Math.round(item.accuracy)):0,speedPct=item.avg?Math.max(0,Math.min(100,Math.round((2/Math.max(0.1,item.avg))*100))):0;
    const body=achEl('div','ma-ach-info-body'),progress=achEl('div','ma-ach-info-progress'),row=achEl('div','ma-ach-info-progress-row'); row.append(achEl('strong','','Total progress'),achEl('span','',`${item.correct} correct / ${item.total} attempts`));
    const meter=document.createElement('i'); meter.append(setProgress(document.createElement('b'),Math.min(100,Math.round((targetAttempts+targetAccuracy+speedPct)/3)))); progress.append(row,meter);
    const stats=achEl('div','ma-ach-info-stats'); [['Reading',`${item.rc}✓ / ${item.rw}×`],['Writing',`${item.wc}✓ / ${item.ww}×`],['Accuracy',item.total?formatAccuracyPercent(item.accuracy):'No attempts yet'],['Avg time',avgText]].forEach(([label,value])=>{const stat=document.createElement('div');stat.append(achEl('b','',label),achEl('span','',value));stats.append(stat);});
    body.append(createInfoTopbar({branch:'kana',cls:item.label.cls,accent:'80,220,155',symbol:ch,kicker:'Mastery Map',title:ch,tier:item.label.label}),achEl('p','ma-ach-info-copy',item.label.detail),progress,stats,achEl('p','ma-ach-info-copy','Mastered needs 50+ correct, 95%+ accuracy, and an average recognition time of 1.0s or faster.'));
    applyAchievementVisuals(body); return body;
  }


  function grid(title, chars, snapshot){
    const section=achEl('section','ma-mastery-group');
    section.append(achEl('h3','',title));
    const gridEl=achEl('div','ma-mastery-grid');
    chars.forEach(ch=>{
      const m=masteryLabel(ch,snapshot);
      const btn=achButton(`ma-mastery-cell ${m.cls}`);
      btn.dataset.maMasteryKana=ch;
      btn.title=`${ch} · ${m.label} · ${m.detail}`;
      btn.setAttribute('aria-label', `${ch} mastery details: ${m.label}`);
      btn.append(achEl('strong','',ch), achEl('span','',m.label));
      gridEl.append(btn);
    });
    section.append(gridEl);
    return section;
  }

  function renderMasteryMap(){
    const s=countStats();
    const snapshot=s.snapshot;
    const wrap=document.createDocumentFragment();

    const legend=achEl('div','ma-mastery-legend');
    [
      ['new','New','Not practised yet.'],
      ['learning','Learning','At least 1 attempt, but not yet 10+ correct, 85%+ accuracy, and 2.5s or faster recognition.'],
      ['reviewing','Reviewing','10+ correct, 85%+ accuracy, and 2.5s or faster recognition.'],
      ['mastered','Mastered','50+ correct, 95%+ accuracy, and 1.0s or faster recognition.']
    ].forEach(([cls,label,copy])=>{
      const item=achEl('div',cls);
      item.append(achEl('b','',label), achEl('span','',copy));
      legend.append(item);
    });

    const summary=achEl('div','ma-mastery-summary ma-mastery-stage-summary');
    [['new',s.new,'new'],['learning',s.learning,'learning'],['reviewing',s.reviewing,'reviewing'],['mastered',s.mastered,'mastered']].forEach(([cls,value,label])=>{
      const item=achEl('span',cls);
      item.append(achEl('b','',value), document.createTextNode(' '+label));
      summary.append(item);
    });

    const speed=achEl('div','ma-speed-summary');
    [[s.speed3to2,'3.0s–2.0s'],[s.speed2to1,'2.0s–1.0s'],[s.speedUnder1,'Under 1.0s']].forEach(([value,label])=>{
      const item=document.createElement('span');
      item.append(achEl('b','',value), document.createTextNode(' '+label));
      speed.append(item);
    });

    wrap.append(legend,summary,speed,grid('Hiragana',HIRA,snapshot),grid('Katakana',KATA,snapshot),grid('Dakuten',DAK,snapshot),grid('Yōon',YOON,snapshot),grid('Extended Katakana',EXT,snapshot));
    return wrap;
  }

  let featureOpen=false;
  function buildFeatureContent(kind){
    const root=achEl('div','ma-ach-dialog-content'),view=achEl('div','ma-ach-dialog-view'); root.append(view);
    const showMain=()=>{view.replaceChildren(kind==='mastery'?renderMasteryMap():renderAchievements());applyAchievementVisuals(view);};
    root.addEventListener('click',e=>{
      if(e.target.closest('[data-ma-feature-back]')){e.preventDefault();showMain();return;}
      const rankNav=e.target.closest('[data-ma-ach-rank-nav]');
      if(rankNav && !rankNav.disabled){
        e.preventDefault();
        const id=rankNav.getAttribute('data-ma-ach-rank-nav');
        const index=Number(rankNav.getAttribute('data-ma-ach-rank-index'));
        const detail=buildAchievementInfo(id,Number.isFinite(index)?index:undefined);
        if(detail)view.replaceChildren(detail);
        return;
      }
      const ach=e.target.closest('[data-ma-ach-id]'); if(ach){e.preventDefault();const detail=buildAchievementInfo(ach.getAttribute('data-ma-ach-id'));if(detail)view.replaceChildren(detail);return;}
      const kana=e.target.closest('[data-ma-mastery-kana]'); if(kana){e.preventDefault();view.replaceChildren(buildMasteryKanaInfo(kana.getAttribute('data-ma-mastery-kana')));}
    });
    showMain(); return root;
  }
  function openModal(kind){
    if(featureOpen||!window.ModeAtlasDialog?.feature)return false; featureOpen=true;
    window.ModeAtlasDialog.feature({kicker:kind==='mastery'?'Kana progress':'Mode Atlas progress',title:kind==='mastery'?'Mastery Map':'Achievements',message:kind==='mastery'?'A full kana grid showing accuracy, repetition, and speed progress.':'Achievement tracks across Mode Atlas. Ranked tracks advance in place as you reach each milestone.',contentNode:buildFeatureContent(kind),size:'large'}).finally(()=>{featureOpen=false;});
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
  window.ModeAtlasFeatures={openAchievements:()=>openModal('achievements'), openMasteryMap:()=>openModal('mastery'), checkAchievements:()=>checkAchievementUnlocks(), version:VERSION};
})();
