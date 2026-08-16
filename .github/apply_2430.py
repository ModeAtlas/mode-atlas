from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text()


def write(path, text):
    (ROOT / path).write_text(text)


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


# Release metadata.
version_path = 'assets/app/mode-atlas-version.js'
version = read(version_path)
version = replace_once(version, "var VERSION = '2.42.0';", "var VERSION = '2.43.0';", 'version')
version = replace_once(version, "var CACHE_REVISION = 'assets-2.42.0';", "var CACHE_REVISION = 'assets-2.43.0';", 'cache revision')
write(version_path, version)

for path in ['package.json', 'package-lock.json']:
    text = read(path)
    if '2.42.0' not in text:
        raise SystemExit(f'{path}: 2.42.0 not found')
    write(path, text.replace('2.42.0', '2.43.0'))

readme = read('README.md')
readme = replace_once(readme, 'Version: 2.42.0', 'Version: 2.43.0', 'README version')
write('README.md', readme)

changelog = read('CHANGELOG.md')
entry = """## 2.43.0 - 2026-08-16
- Reorganized Achievements into Mode Atlas, Kana Trainer, and Word Bank categories with placeholder sections for Listening, Grammar, and Reading Comprehension.
- Consolidated sequential milestones into ranked achievement tracks so one tile advances through its next rank instead of filling the menu with separate tier tiles.
- Added rank-aware visual progression and achievement detail navigation for reviewing earlier completed ranks or inspecting later requirements.
- Added the Atlas Level achievement track at Levels 5, 10, 20, 50, and 100, consuming the shared ModeAtlasProgress level rather than calculating progression locally.
- Preserved legacy per-rank unlock IDs so existing achievement history remains stable while the visible menu becomes substantially less cluttered.

"""
if not changelog.startswith('## 2.42.0'):
    raise SystemExit('CHANGELOG: expected 2.42.0 at top')
write('CHANGELOG.md', entry + changelog)


# Rebuild the achievement presentation/model while preserving the mastery map below it.
ach_path = 'assets/achievements/mode-atlas-achievements-ui.js'
ach = read(ach_path)
start = ach.find('  function countStats(){')
end = ach.find('  function masteryLabel(')
if start < 0 or end < 0 or end <= start:
    raise SystemExit('Achievements block boundaries not found')

new_block = r'''  function countStats(){
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
    if(rankAccentValue) hero.dataset.maAchRankAccent=rankAccentValue;
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
    const progress=achEl('div','ma-ach-info-progress');
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

'''
ach = ach[:start] + new_block + ach[end:]

old_visuals = '''    scope.querySelectorAll("[data-ma-ach-accent]").forEach(el => {\n        el.style.setProperty("--ma-ach-accent", el.dataset.maAchAccent || "96,165,250");\n    });\n    window.ModeAtlasUi?.applyProgressWidths?.(scope);'''
new_visuals = '''    scope.querySelectorAll("[data-ma-ach-accent]").forEach(el => {\n        el.style.setProperty("--ma-ach-accent", el.dataset.maAchAccent || "96,165,250");\n    });\n    scope.querySelectorAll("[data-ma-ach-rank-accent]").forEach(el => {\n        el.style.setProperty("--ma-ach-rank", el.dataset.maAchRankAccent || "148,163,184");\n    });\n    window.ModeAtlasUi?.applyProgressWidths?.(scope);'''
ach = replace_once(ach, old_visuals, new_visuals, 'achievement visual variables')

old_feature = r'''  function buildFeatureContent(kind){
    const root=achEl('div','ma-ach-dialog-content'),view=achEl('div','ma-ach-dialog-view'); root.append(view);
    const showMain=()=>{view.replaceChildren(kind==='mastery'?renderMasteryMap():renderAchievements());applyAchievementVisuals(view);};
    root.addEventListener('click',e=>{
      if(e.target.closest('[data-ma-feature-back]')){e.preventDefault();showMain();return;}
      const ach=e.target.closest('[data-ma-ach-id]'); if(ach){e.preventDefault();const detail=buildAchievementInfo(ach.getAttribute('data-ma-ach-id'));if(detail)view.replaceChildren(detail);return;}
      const kana=e.target.closest('[data-ma-mastery-kana]'); if(kana){e.preventDefault();view.replaceChildren(buildMasteryKanaInfo(kana.getAttribute('data-ma-mastery-kana')));}
    });
    showMain(); return root;
  }'''
new_feature = r'''  function buildFeatureContent(kind){
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
  }'''
ach = replace_once(ach, old_feature, new_feature, 'feature content rank navigation')
ach = replace_once(ach, "'Milestones across Mode Atlas. Select a tile to see the full unlock requirement.'", "'Achievement tracks across Mode Atlas. Ranked tracks advance in place as you reach each milestone.'", 'achievement dialog message')
write(ach_path, ach)


# Replace accumulated Achievement CSS with one canonical presentation source while preserving Mastery Map styles.
css = r'''.ma-ach-overview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0 22px}
.ma-ach-overview>div{padding:14px 15px;border:1px solid var(--ma-border);border-radius:var(--ma-radius-lg);background:var(--ma-surface-soft)}
.ma-ach-overview b{display:block;color:var(--ma-text);font-size:1.45rem;line-height:1;font-weight:950;letter-spacing:-.04em}
.ma-ach-overview span{display:block;margin-top:6px;color:var(--ma-muted);font-size:.72rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
.ma-achievement-layout{display:grid;gap:28px}
.ma-achievement-section{--ma-ach-accent:148,163,184;min-width:0}
.ma-ach-section-head{display:flex;align-items:end;justify-content:space-between;gap:18px;padding-bottom:12px;margin-bottom:14px;border-bottom:1px solid var(--ma-border)}
.ma-ach-section-head h3{margin:0;color:var(--ma-text);font-size:1.15rem;letter-spacing:-.025em}
.ma-ach-section-copy{margin:5px 0 0;max-width:720px;color:var(--ma-muted);font-size:.84rem;line-height:1.45}
.ma-ach-section-count,.ma-ach-future-status{flex:0 0 auto;color:var(--ma-muted);font-size:.74rem;font-weight:900;white-space:nowrap}
.ma-achievement-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.ma-achievement-tile{--ma-ach-rank:148,163,184;position:relative;min-height:160px;appearance:none;border:1px solid rgba(var(--ma-ach-rank),.38);border-radius:22px;padding:12px;text-align:left;color:var(--ma-text);background:radial-gradient(circle at 18% 0%,rgba(var(--ma-ach-accent),.14),transparent 48%),var(--ma-surface-soft);box-shadow:var(--ma-shadow-soft);cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
.ma-achievement-tile:hover,.ma-achievement-tile:focus-visible{transform:translateY(-2px);border-color:rgba(var(--ma-ach-rank),.7);box-shadow:var(--ma-shadow);outline:none}
.ma-achievement-tile.done{background:radial-gradient(circle at 18% 0%,rgba(var(--ma-ach-rank),.22),transparent 48%),var(--ma-surface-soft);border-color:rgba(var(--ma-ach-rank),.62)}
.ma-ach-topline{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ma-ach-rank-badge,.ma-ach-status-text{display:inline-flex;align-items:center;min-height:25px;padding:4px 7px;border-radius:999px;font-size:.67rem;font-weight:950;letter-spacing:.055em;text-transform:uppercase}
.ma-ach-rank-badge{color:rgb(var(--ma-ach-rank));background:rgba(var(--ma-ach-rank),.12);border:1px solid rgba(var(--ma-ach-rank),.22)}
.ma-ach-status-text{color:var(--ma-muted);background:var(--ma-control);border:1px solid var(--ma-border)}
.ma-achievement-tile.done .ma-ach-status-text{color:rgb(var(--ma-ach-rank));border-color:rgba(var(--ma-ach-rank),.25)}
.ma-ach-graphic{display:grid;place-items:center;width:48px;height:48px;margin:16px 0 13px;border-radius:16px;color:rgb(var(--ma-ach-rank));background:rgba(var(--ma-ach-rank),.12);border:1px solid rgba(var(--ma-ach-rank),.2);font-size:1.45rem;font-weight:950}
.ma-achievement-tile strong{display:block;color:var(--ma-text);font-size:1rem;line-height:1.12;letter-spacing:-.025em}
.ma-achievement-tile small{display:block;margin-top:5px;color:var(--ma-muted);font-size:.78rem;font-weight:760;line-height:1.3}
.ma-ach-meter{position:absolute;left:12px;right:12px;bottom:11px;height:5px;border-radius:999px;background:var(--ma-control);overflow:hidden}
.ma-ach-meter-fill{display:block;height:100%;width:var(--ma-progress,0%);border-radius:999px;background:rgb(var(--ma-ach-rank));transition:width .2s ease}
.ma-achievement-section--future{opacity:.78}
.ma-ach-future-placeholder{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:14px 16px;border:1px dashed var(--ma-border-strong);border-radius:18px;background:var(--ma-surface-soft);color:var(--ma-muted)}
.ma-ach-future-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:13px;background:var(--ma-control);color:var(--ma-text);font-weight:950}
.ma-ach-future-placeholder strong{color:var(--ma-text);font-size:.9rem}.ma-ach-future-placeholder small{font-weight:900;text-transform:uppercase;letter-spacing:.06em;font-size:.68rem}

.ma-ach-info-topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
.ma-ach-info-hero{--ma-ach-accent:148,163,184;--ma-ach-rank:148,163,184;display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;min-width:0}
.ma-ach-info-symbol{display:grid;place-items:center;width:56px;height:56px;border-radius:18px;background:rgba(var(--ma-ach-rank),.13);border:1px solid rgba(var(--ma-ach-rank),.26);color:rgb(var(--ma-ach-rank));font-size:1.65rem;font-weight:950}
.ma-ach-info-kicker{display:inline-flex;margin-bottom:7px;color:rgb(var(--ma-ach-accent));font-weight:950;font-size:.7rem;text-transform:uppercase;letter-spacing:.1em}
.ma-ach-info-body h3{margin:0;color:var(--ma-text);font-size:1.65rem;letter-spacing:-.045em;line-height:1}
.ma-ach-info-body h3 em{font-style:normal;color:rgb(var(--ma-ach-rank));font-size:.92rem;vertical-align:middle;margin-left:6px}
.ma-ach-info-copy{color:var(--ma-muted);line-height:1.58;margin:18px 0}
.ma-ach-info-progress{--ma-ach-rank:148,163,184;border:1px solid var(--ma-border);border-radius:18px;padding:14px;background:var(--ma-surface-soft)}
.ma-ach-info-progress-row{display:flex;justify-content:space-between;gap:14px}.ma-ach-info-progress strong{color:var(--ma-text)}.ma-ach-info-progress span{color:var(--ma-muted);font-weight:850;text-align:right}
.ma-ach-info-progress i{display:block;margin-top:10px;height:7px;border-radius:999px;background:var(--ma-control);overflow:hidden}.ma-ach-info-progress i b{display:block;width:var(--ma-progress,0%);height:100%;border-radius:999px;background:rgb(var(--ma-ach-rank))}
.ma-ach-rank-history{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.ma-ach-rank-step{--ma-ach-rank:148,163,184;appearance:none;border:1px solid rgba(var(--ma-ach-rank),.25);border-radius:999px;padding:7px 10px;background:transparent;color:var(--ma-muted);font:inherit;font-size:.73rem;font-weight:900;cursor:pointer}
.ma-ach-rank-step.done{color:rgb(var(--ma-ach-rank));background:rgba(var(--ma-ach-rank),.09)}.ma-ach-rank-step.current{box-shadow:0 0 0 2px rgba(var(--ma-ach-rank),.2);border-color:rgba(var(--ma-ach-rank),.62)}
.ma-ach-rank-nav{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--ma-border)}
.ma-ach-rank-nav span{text-align:center;color:var(--ma-muted);font-size:.76rem;font-weight:900}.ma-ach-rank-nav button:last-child{justify-self:end}.ma-ach-rank-nav button:disabled{opacity:.35;cursor:not-allowed}

/* Mastery Map remains a separate Kana analysis feature within the same shared dialog owner. */
.ma-mastery-legend{display:grid;gap:12px;margin-bottom:14px}
.ma-mastery-legend div{padding:14px 15px;border-radius:18px;border:1px solid var(--ma-border);background:var(--ma-surface-soft)}
.ma-mastery-legend b{display:block;color:var(--ma-text);margin-bottom:5px}.ma-mastery-legend span{color:var(--ma-muted);font-size:.88rem;line-height:1.35}
.ma-mastery-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
.ma-mastery-summary span{border:1px solid var(--ma-border);background:var(--ma-surface-soft);border-radius:18px;padding:14px 16px;color:var(--ma-muted)}
.ma-mastery-summary b{display:block;color:var(--ma-text);font-size:1.8rem;line-height:1.1}
.ma-speed-summary{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}.ma-speed-summary span{padding:8px 10px;border-radius:999px;background:var(--ma-control);border:1px solid var(--ma-border);color:var(--ma-muted);font-size:.78rem}.ma-speed-summary b{color:var(--ma-text)}
.ma-mastery-group{margin-top:22px}.ma-mastery-group h3{margin:0 0 14px;color:var(--ma-text);font-size:1.15rem}
.ma-mastery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:9px}
.ma-mastery-cell{appearance:none;border:1px solid var(--ma-border);border-radius:18px;min-height:74px;background:var(--ma-surface-soft);color:var(--ma-text);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer}
.ma-mastery-cell:hover,.ma-mastery-cell:focus-visible{outline:none;border-color:var(--ma-control-active-border);box-shadow:0 0 0 3px var(--ma-focus-ring)}
.ma-mastery-cell strong{font-size:1.45rem}.ma-mastery-cell span{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;font-weight:900}.ma-mastery-cell.new{opacity:.62}.ma-mastery-cell.learning{background:color-mix(in srgb,var(--ma-warning) 12%,var(--ma-surface-soft));border-color:color-mix(in srgb,var(--ma-warning) 35%,var(--ma-border))}.ma-mastery-cell.reviewing{background:color-mix(in srgb,var(--ma-writing) 12%,var(--ma-surface-soft));border-color:color-mix(in srgb,var(--ma-writing) 35%,var(--ma-border))}.ma-mastery-cell.mastered{background:color-mix(in srgb,var(--ma-success) 12%,var(--ma-surface-soft));border-color:color-mix(in srgb,var(--ma-success) 35%,var(--ma-border))}
.ma-ach-info-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}.ma-ach-info-stats>div{padding:12px;border-radius:16px;background:var(--ma-surface-soft);border:1px solid var(--ma-border)}.ma-ach-info-stats b,.ma-ach-info-stats span{display:block}.ma-ach-info-stats span{margin-top:5px;color:var(--ma-muted);font-size:.78rem}
.ma-kana-pro-head .ma-mastery-open-btn{margin-top:0;align-self:flex-start;white-space:nowrap}
.ma-mastery-breakdown{grid-template-columns:repeat(4,minmax(0,1fr))}

@media(max-width:760px){
  .ma-ach-overview{gap:8px}.ma-ach-overview>div{padding:11px}.ma-ach-overview b{font-size:1.15rem}.ma-ach-overview span{font-size:.63rem}
  .ma-ach-section-head{align-items:flex-start;flex-direction:column;gap:7px}.ma-ach-section-count,.ma-ach-future-status{white-space:normal}
  .ma-achievement-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.ma-achievement-tile{min-height:148px;border-radius:18px;padding:10px}.ma-ach-graphic{width:42px;height:42px;margin:13px 0 11px}.ma-achievement-tile strong{font-size:.9rem}.ma-achievement-tile small{font-size:.71rem}.ma-ach-meter{left:10px;right:10px}
  .ma-ach-info-topbar{align-items:center}.ma-ach-info-body h3{font-size:1.35rem}.ma-ach-rank-nav{grid-template-columns:1fr 1fr}.ma-ach-rank-nav span{grid-column:1/-1;grid-row:1}.ma-ach-rank-nav button:last-child{justify-self:stretch}.ma-ach-rank-nav button{justify-content:center}
  .ma-mastery-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.ma-mastery-grid{grid-template-columns:repeat(auto-fill,minmax(58px,1fr));gap:8px}.ma-mastery-cell{min-height:60px;border-radius:14px}.ma-mastery-cell strong{font-size:1.18rem}.ma-ach-info-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:480px){.ma-ach-overview{grid-template-columns:1fr}.ma-achievement-grid{grid-template-columns:1fr}.ma-achievement-tile{min-height:140px}.ma-ach-future-placeholder{grid-template-columns:auto 1fr}.ma-ach-future-placeholder small{grid-column:2}.ma-ach-info-symbol{width:48px;height:48px}.ma-ach-info-back{flex:0 0 auto}}
@media(prefers-reduced-motion:reduce){.ma-achievement-tile{transition:none}.ma-achievement-tile:hover,.ma-achievement-tile:focus-visible{transform:none}.ma-ach-meter-fill{transition:none}}
'''
write('assets/css/mode-atlas-achievements.css', css)


# Add a focused regression contract for ranked/category ownership.
test_path = 'tests/frontend.test.js'
tests = read(test_path)
new_test = r'''

test('2.43 Achievements are category-owned and sequential milestones rank up in place', () => {
  const achievements = read('assets/achievements/mode-atlas-achievements-ui.js');
  const css = read('assets/css/mode-atlas-achievements.css');

  for (const category of ['Mode Atlas', 'Kana Trainer', 'Word Bank']) assert.match(achievements, new RegExp(`title:'${category.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}'`));
  for (const future of ['Listening', 'Grammar', 'Reading Comprehension']) assert.match(achievements, new RegExp(`title:'${future}'`));

  assert.match(achievements, /const ACHIEVEMENT_TRACKS/);
  assert.match(achievements, /id:'speed-goal',name:'Speed Goal'/);
  assert.match(achievements, /id:'word-collection',name:'Word Collection'/);
  assert.match(achievements, /state\.complete\?'Max rank'/);
  assert.match(achievements, /Achievement ranked up/);
  assert.match(achievements, /data\.maAchRankNav/);
  assert.match(achievements, /← Previous rank/);
  assert.match(achievements, /Next rank →/);

  for (const level of [5,10,20,50,100]) assert.match(achievements, new RegExp(`target:${level},key:'atlasLevel'`));
  assert.match(achievements, /ModeAtlasProgress\?\.getSummary/);
  assert.match(achievements, /modeAtlasProgressChanged/);

  // Existing milestone IDs remain behind the ranked presentation, preventing false re-unlocks.
  for (const id of ['general-0','general-4','kana-8','kana-10','wordbank-0','wordbank-4']) assert.match(achievements, new RegExp(`unlockId:'${id}'`));
  assert.doesNotMatch(achievements, /const DEFINITIONS =/);

  assert.match(css, /--ma-ach-rank/);
  assert.match(css, /\.ma-ach-rank-history/);
  assert.match(css, /\.ma-achievement-section--future/);
});
'''
if "test('2.43 Achievements are category-owned" in tests:
    raise SystemExit('2.43 test already present')
write(test_path, tests.rstrip() + new_test + '\n')

print('Applied Mode Atlas 2.43.0 ranked achievements source changes')
