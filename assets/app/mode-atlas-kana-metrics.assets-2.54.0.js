/* Mode Atlas Kana metrics.
   Shared data helpers for Kana dashboard, achievements, and mastery UI.
   Kana inventory is owned exclusively by ModeAtlasKanaData. Expensive storage
   objects are read once into a snapshot and reused for all per-kana calculations. */
(function(){
  if(window.ModeAtlasKanaMetrics) return;

  const KanaData=window.ModeAtlasKanaData;
  const Collections=KanaData?.collections;
  if(!Collections){
    console.error('Mode Atlas Kana metrics requires ModeAtlasKanaData.');
    return;
  }

  const HIRA=Collections.hiragana;
  const KATA=Collections.katakana;
  const DAK=Collections.dakuten;
  const YOON=Collections.yoon;
  const EXT=Collections.extended;
  const ALL=Collections.all;
  const CONFUSABLE=Object.freeze(['シ','ツ','ソ','ン','ぬ','め','れ','わ','ね','ク','ケ','タ','ナ','メ']);
  const READING_TEST_KEYS=['testModeResults','kanaTrainerTestModeResults','readingTestModeResults','kanaTrainerReadingTestModeResults'];
  const WRITING_TEST_KEYS=['writingTestModeResults','kanaTrainerWritingTestModeResults','reverseTestModeResults'];
  const PRESET_TRACKERS=[
    {id:'starter',name:'Starter',desc:'A-row with hints',chars:Object.freeze(Object.keys(KanaData.hiraganaRows.h_a)),href:(window.ModeAtlasVersionFile?.appUrl?.('/reading/?starter=starter') || '/reading/?starter=starter')},
    {id:'intermediate',name:'Intermediate',desc:'All Hiragana, no hints',chars:HIRA,href:(window.ModeAtlasVersionFile?.appUrl?.('/reading/?starter=intermediate') || '/reading/?starter=intermediate')},
    {id:'advanced',name:'Advanced',desc:'Hiragana + Katakana + Dakuten',chars:Object.freeze([...HIRA,...KATA,...DAK]),href:(window.ModeAtlasVersionFile?.appUrl?.('/reading/?starter=advanced') || '/reading/?starter=advanced')},
    {id:'pro',name:'Pro',desc:'Everything enabled',chars:ALL,href:(window.ModeAtlasVersionFile?.appUrl?.('/reading/?starter=pro') || '/reading/?starter=pro')}
  ];

  function pageName(){ try{return (window.ModeAtlasPageName?window.ModeAtlasPageName():(location.pathname.split('/').filter(Boolean).pop()||'index.html')).toLowerCase();}catch{return '';} }
  function json(key,fallback){ try{return window.ModeAtlasStorage?.json?.(key,fallback) ?? fallback;}catch{return fallback;} }
  function number(key,fallback=0){ try{return window.ModeAtlasStorage?.number?.(key,fallback) ?? fallback;}catch{return fallback;} }
  function obj(key){ const v=json(key,{}); return v&&typeof v==='object'&&!Array.isArray(v)?v:{}; }
  function modeObj(mode,name){ try{ const v=window.ModeAtlasStorage?.readModeJSON?.(mode,name,{}); return v&&typeof v==='object'&&!Array.isArray(v)?v:{}; }catch{return {}; } }
  function modeNumber(mode,name,fallback=0){ try{return window.ModeAtlasStorage?.readModeNumber?.(mode,name,fallback) ?? fallback;}catch{return fallback;} }
  function arr(key){ const v=json(key,[]); return Array.isArray(v)?v:[]; }
  function countKeys(o){ return o&&typeof o==='object'?Object.keys(o).length:0; }
  function localDateKey(value){
    if(window.ModeAtlasDates?.localDateKey) return window.ModeAtlasDates.localDateKey(value);
    const d=value instanceof Date?new Date(value.getTime()):(value?new Date(value):new Date());
    const safe=Number.isNaN(d.getTime())?new Date():d;
    return `${safe.getFullYear()}-${String(safe.getMonth()+1).padStart(2,'0')}-${String(safe.getDate()).padStart(2,'0')}`;
  }

  function createSnapshot(){
    const tests={};
    [...READING_TEST_KEYS,...WRITING_TEST_KEYS].forEach(key=>{ tests[key]=arr(key); });
    return Object.freeze({
      __modeAtlasKanaMetricsSnapshot:true,
      readingStats:modeObj('reading','charStats'),
      writingStats:modeObj('writing','charStats'),
      readingTimes:modeObj('reading','charTimes'),
      writingTimes:modeObj('writing','charTimes'),
      readingDaily:modeObj('reading','dailyHistory'),
      writingDaily:modeObj('writing','dailyHistory'),
      readingHigh:modeNumber('reading','highScore',0),
      writingHigh:modeNumber('writing','highScore',0),
      tests:Object.freeze(tests)
    });
  }
  function useSnapshot(snapshot){ return snapshot?.__modeAtlasKanaMetricsSnapshot===true?snapshot:createSnapshot(); }

  function statTotals(stats){ let c=0,w=0; Object.values(stats||{}).forEach(s=>{ if(s&&typeof s==='object'){ c+=Number(s.correct||s.right||0); w+=Number(s.wrong||s.incorrect||0); } }); return {c,w,t:c+w,acc:c+w?Math.round((c/(c+w))*100):0}; }
  function accuracy(stats){ return statTotals(stats).acc; }
  function difficult(stats,strongest=false){ let pick=null; Object.entries(stats||{}).forEach(([kana,s])=>{ if(!s||typeof s!=='object') return; const c=Number(s.correct||s.right||0), w=Number(s.wrong||s.incorrect||0), t=c+w; if(!t) return; const score=(c/t)-(w*0.04); const row={kana,score,t,c,w}; if(!pick || (strongest?score>pick.score:score<pick.score)) pick=row; }); return pick; }
  function dailyDone(hist,today=localDateKey()){ if(Array.isArray(hist)) return hist.some(x=>String(x?.date||x?.day||'').slice(0,10)===today); return !!(hist&&hist[today]); }
  function streak(hist,startDate=new Date()){
    const set=new Set();
    if(Array.isArray(hist)) hist.forEach(x=>{const d=String(x?.date||x?.day||'').slice(0,10); if(d)set.add(d);});
    else Object.keys(hist||{}).forEach(k=>{const d=String(k).slice(0,10); if(d)set.add(d);});
    let n=0;
    const d=startDate instanceof Date?new Date(startDate.getTime()):new Date(startDate);
    if(Number.isNaN(d.getTime())) return 0;
    for(;;){ const key=localDateKey(d); if(!set.has(key)) break; n++; d.setDate(d.getDate()-1); }
    return n;
  }
  function normalizeResultForCount(item,expectedMode){
    if(!item||typeof item!=='object') return null;
    const mode=item.mode==='writing'?'writing':'reading';
    if(expectedMode&&mode!==expectedMode) return null;
    if(item.type==='average') return null;
    const id=String(item.id||item.createdAt||item.completedAt||item.date||item.startedAt||'');
    const sig=id||(mode+'|'+String(item.date||'')+'|'+String(item.startedAt||'')+'|'+String(item.correct||'')+'|'+String(item.wrong||''));
    return {mode,sig};
  }
  function formalTestCount(snapshot){
    const data=useSnapshot(snapshot);
    const seen=new Set();
    READING_TEST_KEYS.forEach(key=>(data.tests[key]||[]).forEach(item=>{const n=normalizeResultForCount(item,'reading'); if(n) seen.add('reading|'+n.sig);}));
    WRITING_TEST_KEYS.forEach(key=>(data.tests[key]||[]).forEach(item=>{const n=normalizeResultForCount(item,'writing'); if(n) seen.add('writing|'+n.sig);}));
    return seen.size;
  }
  function charCorrect(ch,snapshot){ const data=useSnapshot(snapshot), r=data.readingStats[ch]||{}, w=data.writingStats[ch]||{}; return Number(r.correct||r.right||0)+Number(w.correct||w.right||0); }
  function charWrong(ch,snapshot){ const data=useSnapshot(snapshot), r=data.readingStats[ch]||{}, w=data.writingStats[ch]||{}; return Number(r.wrong||r.incorrect||0)+Number(w.wrong||w.incorrect||0); }
  function timeValue(v){ let n=0; if(typeof v==='number') n=Number(v); else if(v&&typeof v==='object') n=Number(v.avg||v.average||v.time||0); return n?n<30?n*1000:n:0; }
  function charAvg(ch,snapshot){ const data=useSnapshot(snapshot), vals=[timeValue(data.readingTimes[ch]),timeValue(data.writingTimes[ch])].filter(Boolean); return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0; }
  function masteryLabel(ch,snapshot){ const data=useSnapshot(snapshot), c=charCorrect(ch,data), w=charWrong(ch,data), t=c+w, avg=charAvg(ch,data), acc=t?c/t:0; if(!t) return 'New'; if(c>=50 && acc>=.95 && avg>0 && avg<=1000) return 'Mastered'; if(c>=10 && acc>=.85 && (!avg || avg<=2500)) return 'Reviewing'; return 'Learning'; }
  function masteryClass(label){ return String(label||'').toLowerCase(); }
  function masteryCounts(chars=ALL,snapshot){ const data=useSnapshot(snapshot), out={New:0,Learning:0,Reviewing:0,Mastered:0}; chars.forEach(ch=>{ out[masteryLabel(ch,data)]++; }); return out; }
  function bestWeak(chars=ALL,snapshot){ const data=useSnapshot(snapshot), rows=[]; [...new Set(chars)].forEach(ch=>{ const c=charCorrect(ch,data), w=charWrong(ch,data), avg=charAvg(ch,data), t=c+w; if(t) rows.push({ch,c,w,t,avg,score:(c/(t||1))-(w*.05)-(avg?Math.min(avg/7000,.5):0)}); }); return rows.sort((a,b)=>a.score-b.score).slice(0,4); }
  function formatMs(ms){ return !ms?'—':ms<1000?Math.round(ms)+'ms':(ms/1000).toFixed(1)+'s'; }
  function kanaStats(snapshot){
    const data=useSnapshot(snapshot);
    const rw=difficult(data.readingStats,false), rb=difficult(data.readingStats,true), ww=difficult(data.writingStats,false), wb=difficult(data.writingStats,true);
    const rt=statTotals(data.readingStats), wt=statTotals(data.writingStats);
    return {
      readingAccuracy:rt.acc, writingAccuracy:wt.acc, readingAnswers:rt.t, writingAnswers:wt.t,
      readingHigh:data.readingHigh, writingHigh:data.writingHigh,
      readingKnown:countKeys(data.readingStats), writingKnown:countKeys(data.writingStats),
      readingWorst:rw?.kana||'—', readingBest:rb?.kana||'—', writingWorst:ww?.kana||'—', writingBest:wb?.kana||'—',
      readingTests:(data.tests.testModeResults||[]).length+(data.tests.readingTestModeResults||[]).length+(data.tests.kanaTrainerReadingTestModeResults||[]).length,
      writingTests:(data.tests.writingTestModeResults||[]).length+(data.tests.kanaTrainerWritingTestModeResults||[]).length,
      dailyDone:dailyDone(data.readingDaily)||dailyDone(data.writingDaily), streak:Math.max(streak(data.readingDaily),streak(data.writingDaily)),
      readingTotals:rt, writingTotals:wt, known:Math.max(countKeys(data.readingStats),countKeys(data.writingStats)), tests:formalTestCount(data)
    };
  }

  window.ModeAtlas=window.ModeAtlas||{};
  window.ModeAtlas.formalTestCount=formalTestCount;
  window.ModeAtlas.getKanaMasteryLabel=masteryLabel;
  window.ModeAtlasKanaMetrics=Object.freeze({
    HIRA,KATA,DAK,YOON,EXT,CONFUSABLE,ALL,PRESET_TRACKERS,
    pageName,json,obj,arr,number,statTotals,accuracy,difficult,dailyDone,streak,
    createSnapshot,formalTestCount,charCorrect,charWrong,charAvg,masteryLabel,masteryClass,masteryCounts,bestWeak,formatMs,kanaStats
  });
})();
