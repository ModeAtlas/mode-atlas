/* Canonical achievement catalogue and read-only evidence. Shared by the app
   and friend-profile projection; UI and persistence remain separate owners. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.ModeAtlasAchievements=factory(root);
})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const KanaData=root.ModeAtlasKanaData,Metrics=root.ModeAtlasKanaMetrics;
  const {all:ALL,hiragana:HIRA,katakana:KATA,dakuten:DAK}=KanaData.collections;
  const readJSON=(key,fallback)=>root.ModeAtlasStorage?.json?.(key,fallback)??fallback;
  const count=value=>{const n=typeof value==='number'||typeof value==='string'?Number(value):0;return Number.isFinite(n)?Math.max(0,n):0;};
  const achStoreGet=(key,fallback='')=>root.ModeAtlasStorage?.get?.(key,fallback)??fallback;
  const latestTimestamp=keys=>Math.max(0,...keys.map(key=>Date.parse(achStoreGet(key,''))||0));
  const PRESET_TRACKERS = [
    {id:'presetStarter', name:'Starter', desc:'A-row with hints', chars:Object.freeze(Object.keys(KanaData.hiraganaRows.h_a))},
    {id:'presetIntermediate', name:'Intermediate', desc:'All Hiragana, no hints', chars:HIRA},
    {id:'presetAdvanced', name:'Advanced', desc:'Hiragana + Katakana + Dakuten', chars:Object.freeze([...HIRA,...KATA,...DAK])},
    {id:'presetPro', name:'Pro', desc:'Everything enabled', chars:ALL}
  ];
  function countStats(){
    const snapshot=Metrics.createSnapshot({includeStreak:false});
    const r=snapshot.readingStats, w=snapshot.writingStats;
    const words=readJSON('kanaWordBank',[]);
    const progressState=root.ModeAtlasProgress?.readSnapshot?.()||root.ModeAtlasProgress?.readState?.();
    const progression=root.ModeAtlasProgress?.getSummary?.(progressState)||{};
    const readingTotals=Metrics.statTotals(r), writingTotals=Metrics.statTotals(w);
    const kanji=kanjiEvidence();
    const correct=readingTotals.c+writingTotals.c+kanji.kanjiCorrect, wrong=readingTotals.w+writingTotals.w+kanji.kanjiWrong;
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
        const correctCount=count(test.correct||test.right||0);
        const wrongCount=count(test.wrong||test.incorrect||0);
        const accuracy=count(test.accuracy||0);
        if(correctCount<=0 || !(wrongCount===0 || accuracy>=100)) return;
        const mode=test.mode==='writing' || /writing|reverse/i.test(storageKey) ? 'writing' : 'reading';
        const signature=String(test.id||test.createdAt||test.completedAt||test.startedAt||test.date||`${correctCount}|${wrongCount}`);
        perfectSeen.add(`${mode}|${signature}`);
      });
    });
    const cloud = achStoreGet('modeAtlasLastCloudSyncAt', '') ? 1 : 0;
    const recentSave = latestTimestamp(['settingsUpdatedAt','resultsUpdatedAt','srsUpdatedAt','dailyUpdatedAt','profileUpdatedAt','kanaWordBankUpdatedAt']);
    return {
      ...kanji,correct,wrong,total:correct+wrong,seen,
      new:mastery.New,mastered:mastery.Mastered+mastery['Mastered+'],reviewing:mastery.Confident,learning:mastery.Learning+mastery.Introduced+mastery.Familiar,
      under2,under1,speed3to2,speed2to1,speedUnder1,wordCount,resultCount,perfect:perfectSeen.size,cloud,recentSave,
      atlasLevel:Number(progression.level||1),avg:avgCount?avgSum/avgCount:0,snapshot,...presetValues,
      earned:progressState?.achievements||{},
      ...root.ModeAtlasProgress?.achievementStats?.(progressState)
    };
  }

  const CATEGORY_META = Object.freeze({
    modeAtlas:Object.freeze({title:'Mode Atlas',description:'Account-wide learning, progression, and app milestones.',accent:'245,195,93',icon:'✦'}),
    kana:Object.freeze({title:'Kana Trainer',description:'Read, recall and recognise the shapes you have learned.',accent:'167,139,250',icon:'あ'}),
    kanji:Object.freeze({title:'Kanji',description:'Build recognition, readings and meaning.',accent:'100,193,164',icon:'kanji'}),
    wordbank:Object.freeze({title:'Word Bank',description:'Milestones for building and maintaining your personal Japanese vocabulary collection.',accent:'96,165,250',icon:'語'})
  });

  function progressTrack(id,name,icon,key,targets,noun,detail){
    return Object.freeze({id,name,icon,ranks:Object.freeze(targets.map((target,index)=>Object.freeze({
      tier:targets.length>1?['I','II','III','IV','V'][index]:'',target,key,
      short:`${target.toLocaleString()} ${target===1?noun.replace(/s$/,''):noun}`,detail:detail.replace('{n}',target.toLocaleString()),unlockId:`progress-${id}-${target}`
    })))});
  }

  const ACHIEVEMENT_TRACKS = Object.freeze({
    modeAtlas:Object.freeze([
      progressTrack('daily-dedication','Daily Dedication','☀','dailyGoals',[1,10,50,150,365],'daily goals','Complete {n} daily goals. Each completed rotating goal counts once.'),
      progressTrack('weekly-wayfinder','Weekly Wayfinder','◷','weeklyGoals',[1,5,20,50],'weekly goals','Complete {n} weekly goals across Mode Atlas.'),
      progressTrack('full-circle','Full Circle','◎','goalDays',[1,7,30,100],'complete goal days','Complete all three daily goals on {n} different days.'),
      progressTrack('steady-steps','Steady Steps','↗','studyDays',[7,30,100,365],'study days','Practise on {n} different days. Five correct answers make a study day; saved historic challenges and formal tests also count.'),
      progressTrack('special-delivery','Special Delivery','✦','exclusiveRewards',[1],'exclusive reward','Receive an exclusive reward for your account.'),
      progressTrack('seasonal-souvenir','Seasonal Souvenir','❖','eventRewards',[1],'event reward','Receive a limited-time event reward when an event is available. The achievement remains after the event ends.'),
      progressTrack('keepsakes','Keepsakes','◇','collectedRewards',[1,3,5],'reward sets','Receive {n} different exclusive or event reward sets. Items belonging to the same set count together; developer previews do not count.'),
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
      Object.freeze({id:'cloud-ready',legacy:true,name:'Cloud Ready',icon:'☁',ranks:Object.freeze([
        Object.freeze({tier:'',short:'Complete a cloud sync',detail:'Sign in and complete at least one successful cloud save so progress can follow you across devices.',target:1,key:'cloud',unlockId:'general-5'})
      ])})
    ]),
    kana:Object.freeze([
      progressTrack('set-builder','Set Builder','▦','guidedSets',[1,10,50,200],'guided sets','Complete {n} guided sets with at least 10 answers, three different kana and 25% accuracy.'),
      progressTrack('independent-recall','Independent Recall','✓','independent',[50,250,1000,5000],'unassisted recalls','Recall {n} kana correctly with hints switched off.'),
      progressTrack('wider-horizons','Wider Horizons','↔','broadRecall',[25,100,500,2000],'wide-pool recalls','Recall {n} kana correctly while practising a pool of at least 45 different kana.'),
      progressTrack('precision-practice','Precision Practice','⦿','preciseSets',[1,10,50,100],'precise sessions','Complete {n} guided sets, challenges, formal tests or timed sessions with at least 10 answers, three different kana, 90% accuracy and hints off.'),
      progressTrack('on-a-roll','On a Roll','⚡','bestStreak',[10,25,50,100],'correct in a row','Reach {n} consecutive correct answers in one session with hints switched off.'),
      Object.freeze({id:'kana-discovery',name:'Kana Discovery',icon:'カ',ranks:Object.freeze([
        Object.freeze({tier:'I',short:'25 kana seen',detail:'Practise at least 25 unique kana in Reading or Writing.',target:25,key:'seen',unlockId:'kana-0'}),
        Object.freeze({tier:'II',short:'75 kana seen',detail:'Practise at least 75 unique kana in the Kana Trainer.',target:75,key:'seen',unlockId:'kana-1'}),
        Object.freeze({tier:'III',short:'125 kana seen',detail:'Practise at least 125 unique kana across the trainer.',target:125,key:'seen',unlockId:'kana-2'}),
        Object.freeze({tier:'IV',short:'175 kana seen',detail:'Practise 175 unique kana, covering most of the current Kana Trainer inventory.',target:175,key:'seen',unlockId:'kana-3'})
      ])}),
      Object.freeze({id:'preset-starter',legacy:true,name:'Starter Preset',icon:'賞',ranks:Object.freeze([
        Object.freeze({tier:'',short:'Starter 100/100',detail:'Reach 100 correct answers while progressing through the Starter preset.',target:100,key:'presetStarter',unlockId:'kana-4'})
      ])}),
      Object.freeze({id:'preset-intermediate',legacy:true,name:'Intermediate Preset',icon:'賞',ranks:Object.freeze([
        Object.freeze({tier:'',short:'Intermediate 100/100',detail:'Reach 100 correct answers while progressing through the Intermediate preset.',target:100,key:'presetIntermediate',unlockId:'kana-5'})
      ])}),
      Object.freeze({id:'preset-advanced',legacy:true,name:'Advanced Preset',icon:'賞',ranks:Object.freeze([
        Object.freeze({tier:'',short:'Advanced 100/100',detail:'Reach 100 correct answers while progressing through the Advanced preset.',target:100,key:'presetAdvanced',unlockId:'kana-6'})
      ])}),
      Object.freeze({id:'preset-pro',legacy:true,name:'Pro Preset',icon:'賞',ranks:Object.freeze([
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
        Object.freeze({tier:'I',short:'20 mastered',detail:'Reach Mastered on 20 kana through accurate, unassisted recall spaced across days.',target:20,key:'mastered',unlockId:'kana-14'}),
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
    kanji:Object.freeze([
      progressTrack('kanji-introductions','First impressions','gate','kanjiIntroduced',[1,10,50,150,500],'kanji introduced','Complete the introduction for {n} different kanji.'),
      progressTrack('kanji-readings','Finding your voice','brush','kanjiReading',[10,100,500,2000],'independent readings','Recall {n} kanji readings correctly without hints.'),
      progressTrack('kanji-meanings','Meaning maker','tree','kanjiMeaning',[10,100,500,2000],'independent meanings','Recall {n} kanji meanings correctly without choices or hints.'),
      progressTrack('kanji-mastery','Lasting impressions','bonsai','kanjiMastered',[1,10,50,100,500],'kanji mastered','Master both the reading and meaning of {n} kanji through accurate, spaced recall.'),
      progressTrack('kanji-tests','Put it to the test','scroll','kanjiTests',[1,5,15,30],'Kanji tests','Complete {n} formal Kanji tests. Your saved test history counts.')
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


  function kanjiEvidence(){
    const owner=root.ModeAtlasKanjiState,state=owner.read(),known=new Set([...Object.keys(state.lessons),...Object.keys(state.introductions),...Object.keys(state.completions),...Object.values(state.sources).flatMap(source=>Object.keys(source))]);
    const result={kanjiIntroduced:0,kanjiReading:0,kanjiMeaning:0,kanjiMastered:0,kanjiConfident:0,kanjiLearning:0,kanjiCorrect:0,kanjiWrong:0,kanjiTotal:owner.levels.size,kanjiTests:0};
    for(const char of known){
      if(!owner.levels.has(char))continue;
      const evidence=owner.assessment(state,char);
      if(evidence.introduced)result.kanjiIntroduced++;
      const stage=evidence.stage;
      if(stage===3)result.kanjiMastered++;else if(stage===2)result.kanjiConfident++;else if(stage===1||state.lessons[char])result.kanjiLearning++;
      for(const skill of owner.skills){const m=evidence.metrics[skill];result[skill==='pronunciation'?'kanjiReading':'kanjiMeaning']+=m.independent;result.kanjiCorrect+=m.correct;result.kanjiWrong+=m.wrong;}
    }
    const tests=readJSON('modeAtlasKanjiTests',[]);
    result.kanjiTests=new Set((Array.isArray(tests)?tests:[]).filter(row=>row?.id&&row.answers?.length).map(row=>row.id)).size;
    return result;
  }
  const ranks=Object.entries(ACHIEVEMENT_TRACKS).flatMap(([category,tracks])=>tracks.flatMap(track=>track.ranks.map((rank,rankIndex)=>({category,track,rank,rankIndex}))));
  const special=new Set(['special-delivery','seasonal-souvenir','keepsakes']);
  const validIds=new Set(ranks.map(item=>item.rank.unlockId));
  const done=(rank,stats)=>!!stats.earned?.[rank.unlockId]||Number(stats[rank.key]||0)>=rank.target;
  function unlocked(stats=countStats()){return ranks.filter(item=>done(item.rank,stats)).map(({category,track,rank,rankIndex})=>({id:rank.unlockId,trackId:track.id,category,name:track.name,tier:rank.tier,ranked:track.ranks.length>1,rankIndex}));}
  function completion(stats=countStats()){
    const included=ranks.filter(item=>!item.track.legacy&&!special.has(item.track.id));
    const earned=included.filter(item=>done(item.rank,stats)).length;
    return {earned,total:included.length,percent:Math.floor(earned/Math.max(1,included.length)*100)};
  }
  function profile(stats=countStats()){
    const total=ALL.length;
    return {dailyGoals:stats.dailyGoals,weeklyGoals:stats.weeklyGoals,studyDays:stats.studyDays,
      dailyChallenges:Object.values(root.ModeAtlasProgress.readState().events).filter(event=>event.type.endsWith('.dailyComplete')).length,
      achievements:completion(stats),
      kana:{total,mastered:stats.mastered,confident:stats.reviewing,learning:stats.learning,percent:Math.floor(stats.mastered/Math.max(1,total)*1000)/10},
      kanji:{total:stats.kanjiTotal,mastered:stats.kanjiMastered,confident:stats.kanjiConfident,learning:stats.kanjiLearning,percent:Math.floor(stats.kanjiMastered/Math.max(1,stats.kanjiTotal)*1000)/10}};
  }
  return Object.freeze({tracks:ACHIEVEMENT_TRACKS,categories:CATEGORY_META,countStats,unlocked,completion,profile,done,validId:id=>validIds.has(id),special:id=>special.has(id)});
});
