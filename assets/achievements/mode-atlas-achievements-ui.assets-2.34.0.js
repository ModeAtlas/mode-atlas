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
    const words=readJSON('kanaWordBank',[]), tests=readJSON('testModeResults',[]);
    const readingTotals=Metrics.statTotals(r), writingTotals=Metrics.statTotals(w);
    const correct=readingTotals.c+writingTotals.c, wrong=readingTotals.w+writingTotals.w;
    const seen=ALL.reduce((count,ch)=>count+(Metrics.charCorrect(ch,snapshot)+Metrics.charWrong(ch,snapshot)>0?1:0),0);
    const mastery=Metrics.masteryCounts(ALL,snapshot);
    let under2=0, under1=0, speed3to2=0, speed2to1=0, speedUnder1=0, perfect=0, avgSum=0, avgCount=0;
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
    try { perfect = (Array.isArray(tests)?tests:[]).filter(t=>Number(t.accuracy||0)>=100 || (Number(t.wrong||t.incorrect||0)===0 && Number(t.correct||0)>0)).length; } catch {}
    const cloud = achStoreGet('modeAtlasLastCloudSyncAt', '') ? 1 : 0;
    const backup = achStoreGet('modeAtlasLastExportAt', '') || achStoreGet('modeAtlasLastBackupAt', '') ? 1 : 0;
    const recentSave = latestTimestamp(['settingsUpdatedAt','resultsUpdatedAt','srsUpdatedAt','dailyUpdatedAt','profileUpdatedAt','kanaWordBankUpdatedAt']);
    return {
      correct,wrong,total:correct+wrong,seen,
      new:mastery.New,mastered:mastery.Mastered,reviewing:mastery.Reviewing,learning:mastery.Learning,
      under2,under1,speed3to2,speed2to1,speedUnder1,wordCount,resultCount,perfect,cloud,backup,recentSave,
      avg:avgCount?avgSum/avgCount:0,snapshot,...presetValues
    };
  }
  const DEFINITIONS = {
    general: [
      {name:'First Steps', tier:'I', short:'25 answers', detail:'Answer 25 questions anywhere in Mode Atlas. Reading, Writing, Tests, and future branches all count.', target:25, key:'total'},
      {name:'Study Rhythm', tier:'I', short:'250 answers', detail:'Answer 250 total questions. This rewards steady practice across the app.', target:250, key:'total'},
      {name:'Study Rhythm', tier:'II', short:'1,000 answers', detail:'Answer 1,000 total questions across Mode Atlas.', target:1000, key:'total'},
      {name:'Study Rhythm', tier:'III', short:'2,500 answers', detail:'Answer 2,500 total questions across Mode Atlas.', target:2500, key:'total'},
      {name:'Study Rhythm', tier:'IV', short:'5,000 answers', detail:'Answer 5,000 total questions. This is for long-term consistency.', target:5000, key:'total'},
      {name:'Cloud Ready', tier:'Sync', short:'Cloud synced', detail:'Sign in and complete at least one successful cloud save so progress can follow you across devices.', target:1, key:'cloud'},
      {name:'Safety Net', tier:'Backup', short:'Export backup', detail:'Export or copy a save backup at least once. Backups help protect progress before big app updates.', target:1, key:'backup'}
    ],
    kana: [
      {name:'Kana Started', tier:'I', short:'25 kana seen', detail:'Practise at least 25 unique kana in Reading or Writing.', target:25, key:'seen'},
      {name:'Kana Collector', tier:'I', short:'75 kana seen', detail:'Practise at least 75 unique kana in the Kana Trainer.', target:75, key:'seen'},
      {name:'Kana Collector', tier:'II', short:'125 kana seen', detail:'Practise at least 125 unique kana across the trainer.', target:125, key:'seen'},
      {name:'Kana Collector', tier:'III', short:'175 kana seen', detail:'Practise 175 unique kana, covering most of the app’s kana set.', target:175, key:'seen'},
      {name:'Preset Complete', tier:'Starter', short:'Starter 100/100', detail:'Reach 100 correct answers in the Starter preset.', target:100, key:'presetStarter'},
      {name:'Preset Complete', tier:'Intermediate', short:'Intermediate 100/100', detail:'Reach 100 correct answers in the Intermediate preset.', target:100, key:'presetIntermediate'},
      {name:'Preset Complete', tier:'Advanced', short:'Advanced 100/100', detail:'Reach 100 correct answers in the Advanced preset.', target:100, key:'presetAdvanced'},
      {name:'Preset Complete', tier:'Pro', short:'Pro 100/100', detail:'Reach 100 correct answers in the Pro preset.', target:100, key:'presetPro'},
      {name:'Speed Goal', tier:'I', short:'25 under 2.0s', detail:'Build timing history until 25 kana average under 2.0 seconds.', target:25, key:'under2'},
      {name:'Speed Goal', tier:'II', short:'50 under 2.0s', detail:'Reach the 2.0 second recognition goal on 50 kana.', target:50, key:'under2'},
      {name:'Speed Goal', tier:'III', short:'100 under 2.0s', detail:'Reach the 2.0 second recognition goal on 100 kana.', target:100, key:'under2'},
      {name:'Fluent Target', tier:'I', short:'10 under 1.0s', detail:'Build timing history until 10 kana average under 1.0 second.', target:10, key:'under1'},
      {name:'Fluent Target', tier:'II', short:'25 under 1.0s', detail:'Reach fluent-speed timing on 25 kana. This is the second tier after the first fluent target.', target:25, key:'under1'},
      {name:'Fluent Target', tier:'III', short:'50 under 1.0s', detail:'Reach fluent-speed timing on 50 kana. This is a strong recognition milestone.', target:50, key:'under1'},
      {name:'Mastery Path', tier:'I', short:'20 mastered', detail:'Reach Mastered on 20 kana. Mastered combines attempts, accuracy, and speed.', target:20, key:'mastered'},
      {name:'Mastery Path', tier:'II', short:'50 mastered', detail:'Reach Mastered on 50 kana.', target:50, key:'mastered'},
      {name:'Mastery Path', tier:'III', short:'100 mastered', detail:'Reach Mastered on 100 kana.', target:100, key:'mastered'},
      {name:'Test Taker', tier:'I', short:'1 formal test', detail:'Complete your first formal Kana Trainer test.', target:1, key:'resultCount'},
      {name:'Test Taker', tier:'II', short:'10 formal tests', detail:'Complete 10 formal Kana Trainer tests.', target:10, key:'resultCount'},
      {name:'Perfect Form', tier:'I', short:'1 perfect test', detail:'Complete a formal test with no mistakes.', target:1, key:'perfect'},
      {name:'Perfect Form', tier:'II', short:'5 perfect tests', detail:'Complete five formal tests with no mistakes.', target:5, key:'perfect'}
    ],
    wordbank: [
      {name:'First Saved Word', tier:'I', short:'1 word', detail:'Save your first word in Word Bank.', target:1, key:'wordCount'},
      {name:'Word Stash', tier:'I', short:'25 words', detail:'Save 25 words in Word Bank.', target:25, key:'wordCount'},
      {name:'Word Stash', tier:'II', short:'100 words', detail:'Save 100 words in Word Bank.', target:100, key:'wordCount'},
      {name:'Word Archive', tier:'I', short:'250 words', detail:'Save 250 words in Word Bank.', target:250, key:'wordCount'},
      {name:'Word Archive', tier:'II', short:'500 words', detail:'Save 500 words in Word Bank.', target:500, key:'wordCount'}
    ]
  };
  function valueFor(s,key){ return Number(s[key]||0); }
  function achievementVisual(item,branch){
    const name=String(item&&item.name||'').toLowerCase();
    const out={
      branchLabel: branch==='kana' ? 'Kana Trainer' : branch==='wordbank' ? 'Word Bank' : 'General',
      accent: branch==='kana' ? '80,220,155' : branch==='wordbank' ? '96,165,250' : '245,195,93',
      icon: branch==='kana' ? 'あ' : branch==='wordbank' ? '語' : '✦'
    };
    if(branch==='general'){
      if(name.includes('rhythm')) out.icon='◎';
      else if(name.includes('cloud')) out.icon='☁';
      else if(name.includes('safety')) out.icon='⟲';
      else if(name.includes('first')) out.icon='✦';
    }
    if(branch==='kana'){
      if(name.includes('preset')) out.icon='賞';
      else if(name.includes('collector')) out.icon='カ';
      else if(name.includes('speed')) out.icon='速';
      else if(name.includes('fluent')) out.icon='流';
      else if(name.includes('mastery')) out.icon='達';
      else if(name.includes('test')) out.icon='試';
      else if(name.includes('perfect')) out.icon='✓';
    }
    if(branch==='wordbank'){
      if(name.includes('first')) out.icon='初';
      else if(name.includes('stash')) out.icon='帳';
      else if(name.includes('archive')) out.icon='保';
    }
    return out;
  }
  function achievement(item,s,branch,index){
    const value=valueFor(s,item.key), done=value>=item.target, pct=clamp(item.target ? value/item.target*100 : 0);
    const id=branch+'-'+index;
    const visual=achievementVisual(item,branch);
    ACH_INDEX[id]={...item, ...visual, value, pct, done, branch};

    const tile=achButton(`ma-achievement-tile branch-${branch} ${done?'done':''}`);
    tile.dataset.maAchAccent=visual.accent;
    tile.dataset.maAchId=id;
    tile.setAttribute('aria-label', `${item.name} ${item.tier} achievement details`);

    const top=achEl('div','ma-ach-topline');
    top.append(achEl('span','ma-ach-status-text', done?'Unlocked':pct+'%'));

    const graphic=achEl('span','ma-ach-graphic', visual.icon);
    graphic.setAttribute('aria-hidden','true');

    const meter=achEl('div','ma-ach-meter');
    meter.setAttribute('aria-hidden','true');
    meter.append(setProgress(achEl('span','ma-ach-meter-fill'), pct), achEl('span','ma-ach-meter-label', pct+'%'));

    tile.append(
      top,
      graphic,
      achEl('strong','',item.name),
      achEl('em','',item.tier),
      achEl('small','',item.short),
      meter
    );
    return tile;
  }

  function branchSection(title,key,s){
    const list=DEFINITIONS[key]||[];
    const unlocked=list.filter(item=>valueFor(s,item.key)>=item.target).length;
    const section=achEl('section','ma-achievement-section');
    const head=achEl('div','ma-ach-section-head');
    head.append(achEl('h3','',title), achEl('span','',`${unlocked}/${list.length} unlocked`));

    const grid=achEl('div','ma-achievement-grid');
    list.forEach((x,i)=>grid.append(achievement(x,s,key,i)));
    section.append(head,grid);
    return section;
  }

  function currentUnlockedAchievements(){
    const s=countStats();
    const out=[];
    Object.keys(DEFINITIONS).forEach(branch=>{
      (DEFINITIONS[branch]||[]).forEach((item,index)=>{
        if(valueFor(s,item.key)>=item.target){
          out.push({id:branch+'-'+index, branch, index, name:item.name, tier:item.tier});
        }
      });
    });
    return out;
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
        achievementToast(`Achievement unlocked: ${first.name} ${first.tier}${suffix}`);
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
      if(e && e.key && /charStats|reverseCharStats|charTimes|testModeResults|kanaWordBank|modeAtlasLastCloudSyncAt|modeAtlasLastExportAt|modeAtlasLastBackupAt|modeAtlasPresetAchievementProgress/.test(e.key)) checkAchievementUnlocks();
    });
    document.addEventListener('ma:progress-updated',checkFromEvent);
    document.addEventListener('ma:preset-progress-updated',checkFromEvent);
    window.addEventListener('modeAtlasCloudDataChanged',checkFromEvent);
    window.addEventListener('pageshow',event=>{ if(event.persisted===true) checkFromEvent(); });
  }
  function renderAchievements(){
    const s=countStats(); ACH_INDEX={};
    const totalDefs=[...DEFINITIONS.general,...DEFINITIONS.kana,...DEFINITIONS.wordbank];
    const unlocked=totalDefs.filter(item=>valueFor(s,item.key)>=item.target).length;

    const wrap=document.createDocumentFragment();

    const overview=achEl('div','ma-ach-overview');
    [[unlocked,'Unlocked'],[totalDefs.length,'Total'],[clamp(unlocked/Math.max(1,totalDefs.length)*100)+'%','Complete']].forEach(([value,label])=>{
      const item=document.createElement('div');
      item.append(achEl('b','',value), achEl('span','',label));
      overview.append(item);
    });

    const layout=achEl('div','ma-achievement-layout');
    layout.append(branchSection('General','general',s), branchSection('Kana Trainer','kana',s), branchSection('Word Bank','wordbank',s));

    wrap.append(overview,layout);
    return wrap;
  }

  function createInfoTopbar({branch, cls='', done=false, accent='96,165,250', symbol='✦', kicker='', title='', tier=''}){
    const topbar=achEl('div','ma-ach-info-topbar');
    const hero=achEl('div',`ma-ach-info-hero branch-${branch} ${cls || (done?'done':'')}`); hero.dataset.maAchAccent=accent;
    const sym=achEl('span','ma-ach-info-symbol',symbol); sym.setAttribute('aria-hidden','true');
    const titleWrap=document.createElement('div'); titleWrap.append(achEl('span','ma-ach-info-kicker',kicker));
    const h3=achEl('h3','',title); if(tier)h3.append(document.createTextNode(' '),achEl('em','',tier)); titleWrap.append(h3); hero.append(sym,titleWrap);
    const back=achButton('ma-button ma-button--ghost ma-button--small ma-ach-info-back','Back'); back.dataset.maFeatureBack='';
    topbar.append(hero,back); return topbar;
  }

  function buildAchievementInfo(id){
    const item=ACH_INDEX[id]; if(!item)return null;
    const body=achEl('div','ma-ach-info-body'); const progress=achEl('div','ma-ach-info-progress'); const row=achEl('div','ma-ach-info-progress-row');
    row.append(achEl('strong','',item.done?'Unlocked':'In progress'),achEl('span','',`${Math.min(item.value,item.target)} / ${item.target}`));
    const meter=document.createElement('i'); meter.append(setProgress(document.createElement('b'),item.pct)); progress.append(row,meter);
    body.append(createInfoTopbar({branch:item.branch,done:item.done,accent:item.accent||'96,165,250',symbol:item.icon||'✦',kicker:item.branchLabel||item.branch.replace(/^./,c=>c.toUpperCase()),title:item.name,tier:item.tier}),achEl('p','ma-ach-info-copy',item.detail),progress);
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
      const ach=e.target.closest('[data-ma-ach-id]'); if(ach){e.preventDefault();const detail=buildAchievementInfo(ach.getAttribute('data-ma-ach-id'));if(detail)view.replaceChildren(detail);return;}
      const kana=e.target.closest('[data-ma-mastery-kana]'); if(kana){e.preventDefault();view.replaceChildren(buildMasteryKanaInfo(kana.getAttribute('data-ma-mastery-kana')));}
    });
    showMain(); return root;
  }
  function openModal(kind){
    if(featureOpen||!window.ModeAtlasDialog?.feature)return false; featureOpen=true;
    window.ModeAtlasDialog.feature({kicker:kind==='mastery'?'Kana progress':'Mode Atlas progress',title:kind==='mastery'?'Mastery Map':'Achievements',message:kind==='mastery'?'A full kana grid showing accuracy, repetition, and speed progress.':'Milestones across Mode Atlas. Select a tile to see the full unlock requirement.',contentNode:buildFeatureContent(kind),size:'large'}).finally(()=>{featureOpen=false;});
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
