/* Kanji learning evidence and convergent saves. Compact skill rows keep a full
   curriculum inside the existing account document; arrays never nest directly. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.ModeAtlasKanjiState=factory(root);
})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const KEY='modeAtlasKanji',UPDATED='modeAtlasKanjiUpdatedAt',DAY=86400000;
  const bands=root.ModeAtlasKanjiCurriculum;
  const levels=new Map(bands.flatMap(band=>[...band.chars].map(char=>[char,band.level])));
  const skills=['pronunciation','meaning'],evidenceSkills=[...skills,'wordMeaning'];
  const courseUnits=()=>root.ModeAtlasKanjiCourse?.units||[];
  function courseData(input){
    const value=object(input),units={},writing={};
    const ids=courseUnits().length?courseUnits().map(unit=>unit.id):Object.keys(object(value.units)).filter(safe).slice(0,100);
    for(const id of ids){
      const old=object(value.units?.[id]);
      if(Object.keys(old).length)units[id]=Object.fromEntries(['introducedAt','checkedAt','retainedAt','reviewAt','reviews','lastAt','lastPassed'].map(key=>[key,number(old[key])]));
    }
    for(const [char,item]of Object.entries(object(value.writing)))if(levels.has(char))writing[char]={traceAt:number(item.traceAt),independentAt:number(item.independentAt)};
    return {units,writing};
  }
  // correct, wrong, independent correct, consecutive independent correct,
  // active response milliseconds, last attempt, next review, spaced successes,
  // last four independent study dates (comma-separated, Firestore-safe).
  const C=0,W=1,I=2,S=3,T=4,AT=5,DUE=6,R=7,DAYS=8,RECENT=9;
  const number=v=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(v))):0;
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const safe=id=>/^[a-zA-Z0-9-]{1,100}$/.test(id)&&!['constructor','prototype','__proto__'].includes(id);
  const date=at=>root.ModeAtlasDates.localDateKey(new Date(at));
  const hash=value=>{let n=2166136261;for(const c of value)n=Math.imul(n^c.charCodeAt(0),16777619);return(n>>>0).toString(36);};
  function recent(value){return String(value||'').split(',').filter(v=>/^[0-9a-z]{1,12}:[012]:[0-9a-z]{1,8}$/.test(v)).map(v=>{const [at,q,id]=v.split(':');return {at:parseInt(at,36),q:Number(q),id,encoded:v};});}
  function mergeRecent(a,b){return [...new Map([...recent(a),...recent(b)].sort((a,b)=>a.encoded.localeCompare(b.encoded)).map(event=>[event.id,event])).values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)).slice(-16).map(event=>event.encoded).join(',');}
  function row(input){
    const values=Array.isArray(input)?input:[];
    const out=Array.from({length:8},(_,i)=>number(values[i]));
    out[I]=Math.min(out[I],out[C]);out[S]=Math.min(out[S],out[I]);out[R]=Math.min(out[R],8);
    out[DAYS]=[...new Set(String(values[DAYS]||'').split(',').filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))].sort().slice(-4).join(',');
    out[RECENT]=mergeRecent(values[RECENT],'');
    return out;
  }
  function normalize(input){
    const value=object(input),sources={},lessons={},introductions={},completions={},recentEvidence={};
    for(const [char,item]of Object.entries(object(value.recent)))if(levels.has(char))recentEvidence[char]=Object.fromEntries(evidenceSkills.map(skill=>[skill,mergeRecent(item?.[skill],'')]));
    for(const [id,items]of Object.entries(object(value.sources))){
      if(!safe(id))continue;const chars={};
      for(const [char,evidence]of Object.entries(object(items))){
        if(!levels.has(char))continue;const item={};
        for(const skill of evidenceSkills)if(Array.isArray(evidence?.[skill])){item[skill]=row(evidence[skill]);if(item[skill][RECENT]){recentEvidence[char]||={};recentEvidence[char][skill]=mergeRecent(recentEvidence[char][skill],item[skill][RECENT]);item[skill][RECENT]='';}}
        if(Object.keys(item).length)chars[char]=item;
      }if(Object.keys(chars).length)sources[id]=chars;
    }
    for(const [char,at]of Object.entries(object(value.lessons)))if(levels.has(char)&&number(at))lessons[char]=number(at);
    for(const [char,at]of Object.entries(object(value.introductions)))if(levels.has(char)&&number(at))introductions[char]=number(at);
    for(const [char,at]of Object.entries(object(value.completions)))if(levels.has(char)&&number(at))completions[char]=number(at);
    const runs=Object.fromEntries(Object.entries(object(value.runs)).filter(([id,r])=>safe(id)&&number(r?.at)).sort((a,b)=>b[1].at-a[1].at||a[0].localeCompare(b[0])).slice(0,32).map(([id,r])=>[id,{index:number(r.index),at:number(r.at)}]));
    const settings=object(value.settings);
    const earned={};for(const [char,item]of Object.entries(object(value.earned)))if(levels.has(char))earned[char]=Object.fromEntries(skills.map(skill=>[skill,Math.min(3,number(item?.[skill]))]));
    const out={version:3,sources,recent:recentEvidence,lessons,introductions,completions,earned,runs,course:courseData(value.course),entry:{mode:['beginner','placement','confident'].includes(value.entry?.mode)?value.entry.mode:'',bands:[...new Set((Array.isArray(value.entry?.bands)?value.entry.bands:[]).filter(n=>[1,2,3,4,5].includes(n)))],at:number(value.entry?.at)},settings:{level:[1,2,3,4,5].includes(settings.level)?settings.level:5,romaji:settings.romaji===true,at:number(settings.at)},updatedAt:number(value.updatedAt)};
    if(!value.version||value.version<2){
      for(const char of new Set(Object.values(sources).flatMap(source=>Object.keys(source)))){
        const evidence=skills.map(skill=>metrics(out,char,skill));
        for(const [index,skill]of skills.entries()){const m=evidence[index],stage=legacyStage(m);if(stage>1){out.earned[char]||={};out.earned[char][skill]=Math.max(out.earned[char][skill]||0,stage);}}
        if(evidence.every(m=>m.independent>=3&&m.accuracy>=.8))out.completions[char]||=Math.max(...evidence.map(m=>m.last),1);
      }
    }
    return out;
  }
  function merge(left,right){
    const a=normalize(left),b=normalize(right);
    for(const [id,items]of Object.entries(b.sources)){
      a.sources[id]||={};
      for(const [char,evidence]of Object.entries(items)){
        a.sources[id][char]||={};
        for(const [skill,value]of Object.entries(evidence)){
          const old=a.sources[id][char][skill];
          if(!old){a.sources[id][char][skill]=value;continue;}
          const latest=value[AT]>old[AT]||(value[AT]===old[AT]&&JSON.stringify(value)>JSON.stringify(old))?value:old;
          const merged=[...latest];for(const i of [C,W,I,T])merged[i]=Math.max(old[i],value[i]);
          merged[DAYS]=[...new Set([...old[DAYS].split(','),...value[DAYS].split(',')].filter(Boolean))].sort().slice(-4).join(',');
          merged[RECENT]=mergeRecent(old[RECENT],value[RECENT]);
          a.sources[id][char][skill]=merged;
        }
      }
    }
    for(const [char,item]of Object.entries(b.recent)){a.recent[char]||={};for(const skill of evidenceSkills)a.recent[char][skill]=mergeRecent(a.recent[char][skill],item[skill]);}
    for(const [char,at]of Object.entries(b.lessons))a.lessons[char]=Math.min(a.lessons[char]||at,at);
    for(const [char,at]of Object.entries(b.introductions))a.introductions[char]=Math.min(a.introductions[char]||at,at);
    for(const [char,at]of Object.entries(b.completions))a.completions[char]=Math.min(a.completions[char]||at,at);
    for(const [char,item]of Object.entries(b.earned)){a.earned[char]||={};for(const skill of skills)a.earned[char][skill]=Math.max(a.earned[char][skill]||0,item[skill]||0);}
    for(const [id,r]of Object.entries(b.runs)){const old=a.runs[id];a.runs[id]={index:Math.max(old?.index||0,r.index),at:Math.max(old?.at||0,r.at)};}
    for(const [id,item]of Object.entries(b.course.units)){
      const old=a.course.units[id]||{},latest=item.lastAt>(old.lastAt||0)?item:old;
      a.course.units[id]={...old,...latest};
      for(const key of ['introducedAt','checkedAt','retainedAt','reviews'])a.course.units[id][key]=Math.max(old[key]||0,item[key]||0);
      // Identical-time successful evidence wins; merge order cannot change a schedule.
      if(item.lastAt===old.lastAt){a.course.units[id].lastPassed=Math.max(old.lastPassed||0,item.lastPassed||0);a.course.units[id].reviewAt=Math.max(old.reviewAt||0,item.reviewAt||0);}
    }
    for(const [char,item]of Object.entries(b.course.writing)){const old=a.course.writing[char]||{};a.course.writing[char]={traceAt:Math.max(old.traceAt||0,item.traceAt),independentAt:Math.max(old.independentAt||0,item.independentAt)};}
    if(b.settings.at>a.settings.at||(b.settings.at===a.settings.at&&JSON.stringify(b.settings)>JSON.stringify(a.settings)))a.settings=b.settings;
    if(b.entry.at>a.entry.at||(b.entry.at===a.entry.at&&JSON.stringify(b.entry)>JSON.stringify(a.entry)))a.entry=b.entry;
    a.updatedAt=Math.max(a.updatedAt,b.updatedAt);return normalize(a);
  }
  // Cache only a normalized, privately owned snapshot. The serialized storage
  // value is the cache key, including staged transaction writes. A failed commit,
  // import, sync or account switch therefore cannot leave a stale cached save.
  let cachedText=null,cachedState=null;
  const copy=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
  function clearCache(){cachedText=null;cachedState=null;}
  for(const event of ['modeAtlasAccountWillChange','modeAtlasDataCleared'])root.addEventListener?.(event,clearCache);
  function snapshot(){
    const text=root.ModeAtlasStorage?.get?.(KEY,null);
    if(typeof text!=='string')return normalize(root.ModeAtlasStorage?.json(KEY,{}));
    if(text!==cachedText||!cachedState){
      let value;try{value=JSON.parse(text||'{}');}catch{value={};}
      cachedState=normalize(value);cachedText=text;
    }
    return cachedState;
  }
  function read(){return copy(snapshot());}
  function commit(state){
    state.updatedAt=Date.now();
    if(!root.ModeAtlasStorage.setJSON(KEY,state))throw new Error('Your device could not save this answer. Free some storage and try again.');
    cachedText=root.ModeAtlasStorage.get?.(KEY,'')??null;cachedState=state;
    root.ModeAtlasStorage.set(UPDATED,String(state.updatedAt));
    root.KanaCloudSync?.scheduleSync?.(900);
  }
  function save(state){commit(normalize(state));}
  function metrics(state,char,skill){
    const rows=Object.values(state.sources).map(source=>source[char]?.[skill]).filter(Boolean);
    const latest=[...rows].sort((a,b)=>b[AT]-a[AT]||JSON.stringify(b).localeCompare(JSON.stringify(a)))[0]||row();
    const sum=i=>rows.reduce((n,r)=>n+r[i],0),correct=sum(C),wrong=sum(W),attempts=correct+wrong;
    const events=recent(rows.reduce((all,r)=>mergeRecent(all,r[RECENT]),state.recent?.[char]?.[skill]||'')).filter(event=>event.q!==1).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)).slice(-12),recentCorrect=events.filter(event=>event.q===2).length;
    return {correct,wrong,attempts,independent:sum(I),streak:latest[S],average:attempts?sum(T)/attempts:0,last:latest[AT],due:latest[DUE],reviews:latest[R],days:[...new Set(rows.flatMap(r=>r[DAYS].split(',')).filter(Boolean))].sort(),accuracy:attempts?correct/attempts:0,recentCorrect,recentAttempts:events.length,recentAccuracy:recentCorrect/Math.max(1,events.length)};
  }
  function completed(state,char){return !!state.completions[char]||skills.every(skill=>{const m=metrics(state,char,skill);return m.recentCorrect>=3&&m.recentAccuracy>=.8&&m.days.length>=2&&m.reviews>=1;});}
  function legacyStage(m){
    if(m.independent>=30&&m.accuracy>=.95&&m.days.length>=4&&m.reviews>=4&&m.streak>=3)return 3;
    if(m.independent>=10&&m.accuracy>=.85&&m.days.length>=2&&m.reviews>=2)return 2;
    return 0;
  }
  function stageFromMetrics(m,lesson){
    if(m.independent>=30&&m.recentCorrect>=10&&m.recentAccuracy>=.9&&m.days.length>=4&&m.reviews>=4&&m.streak>=3)return 3;
    if(m.independent>=10&&m.recentCorrect>=5&&m.recentAccuracy>=.8&&m.days.length>=2&&m.reviews>=2)return 2;
    return m.attempts||lesson?1:0;
  }
  function assessment(state,char){
    const evidence=Object.fromEntries(skills.map(skill=>[skill,metrics(state,char,skill)]));
    const current=skills.map(skill=>stageFromMetrics(evidence[skill],state.lessons[char])),stages=skills.map((skill,index)=>Math.max(current[index],state.earned?.[char]?.[skill]||0));
    return {metrics:evidence,stage:Math.max(...stages)?Math.max(1,Math.min(...stages)):0,current:Math.max(...current)?Math.max(1,Math.min(...current)):0,introduced:!!state.introductions[char]||completed(state,char)};
  }
  function readiness(state,char,skill){return skill?stageFromMetrics(metrics(state,char,skill),state.lessons[char]):assessment(state,char).current;}
  function stage(state,char,skill){return skill?Math.max(readiness(state,char,skill),state.earned?.[char]?.[skill]||0):assessment(state,char).stage;}
  function summary(state=read()){
    let unlocked=true;
    return bands.map(band=>{
      const chars=[...band.chars],complete=chars.filter(char=>completed(state,char)).length;
      const result={...band,total:chars.length,complete,unlocked:allowed(band.level,state),mastered:chars.filter(char=>stage(state,char)===3).length};
      unlocked=unlocked&&complete===chars.length;return result;
    });
  }
  function allowed(level,state=read()){return [1,2,3,4,5].includes(level)&&(state.entry?.mode==='confident'||state.entry?.bands.includes(level)||bands.filter(band=>band.level>level).every(band=>[...band.chars].every(char=>completed(state,char))));}
  const introductory=[...bands[0].intro];
  function introduced(state,char){return !!state.introductions[char]||completed(state,char);}
  function encountered(state,char){return introduced(state,char)||!!state.lessons[char]||evidenceSkills.some(skill=>metrics(state,char,skill).attempts>0);}
  function courseStatus(unit,state=read()){
    const evidence=state.course.units[unit.id]||{};
    return {...evidence,introduced:[...unit.chars].every(char=>introduced(state,char)),checked:!!evidence.checkedAt,retained:!!evidence.retainedAt};
  }
  function nextAction(state=read(),at=Date.now()){
    const units=courseUnits(),saved=root.ModeAtlasStorage?.json('modeAtlasKanjiCheckpoint',null),owner=root.KanaCloudSync?.getUser?.()?.uid||root.ModeAtlasStorage?.get('modeAtlasLastUserId','guest')||'guest';
    if(saved?.owner===owner&&!saved.finished&&saved.version===1&&['learn','course','meaning','pronunciation','match'].includes(saved.mode)&&safe(saved.runId)&&number(saved.at)&&at-saved.at<7*DAY&&saved.at<=at+60000&&Array.isArray(saved.sequence)&&saved.sequence.length<=200&&saved.sequence.every(char=>levels.get(char)===saved.level)&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<saved.sequence.length&&allowed(saved.level,state)){
      const unit=units.find(unit=>unit.id===saved.unitId);
      const validCourse=unit&&['lesson','checkpoint','review'].includes(saved.courseKind)&&Array.isArray(saved.tasks)&&saved.tasks.length===saved.sequence.length&&saved.tasks.every((task,index)=>task.char===saved.sequence[index]&&['teach','recognition','retrieve'].includes(task.kind)&&(task.kind==='teach'||evidenceSkills.includes(task.skill)));
      const run=root.ModeAtlasProgress?.readState?.().runs?.[saved.runId],validCustom=saved.mode==='learn'||run&&!run.done&&run.answers===saved.answers?.length;
      if(saved.mode==='course'?validCourse:validCustom)return {kind:'resume',title:unit?.title||'Your Kanji practice',label:'Resume',detail:'Pick up at the task you left.',href:'/kanji/?continue=1',unitId:unit?.id||null};
    }
    const due=units.filter(unit=>{const m=courseStatus(unit,state);return m.checked&&m.reviewAt&&m.reviewAt<=at;}).sort((a,b)=>courseStatus(a,state).reviewAt-courseStatus(b,state).reviewAt)[0];
    const unit=due||units.find(unit=>!courseStatus(unit,state).checked);
    if(!unit)return {kind:'complete',title:'Foundation checks complete',label:'View my path',detail:'Your scheduled reviews keep these words active.',href:'/kanji/?view=path',unitId:null};
    const status=courseStatus(unit,state),kind=due?'review':status.introduced?'checkpoint':'learn';
    return {kind,title:unit.title,label:'Continue',detail:kind==='review'?'Bring this unit back from memory.':kind==='checkpoint'?'Check the character meanings, word readings and word meanings.':unit.goal,href:'/kanji/?continue=1',unitId:unit.id};
  }
  function finishCourse({unitId,kind,answers=[],at=Date.now()}){
    const unit=courseUnits().find(unit=>unit.id===unitId);if(!unit)throw new Error('This course unit is unavailable.');
    const value=read(),old=value.course.units[unitId]||{};
    const passed=[...unit.chars].every(char=>evidenceSkills.every(skill=>answers.some(answer=>answer.char===char&&answer.skill===skill&&answer.first&&answer.correct&&!answer.assisted)))&&answers.filter(answer=>answer.first).every(answer=>answer.correct&&!answer.assisted);
    const item={...old,lastAt:at,lastPassed:Number(passed)};
    if(kind==='lesson'&&[...unit.chars].every(char=>introduced(value,char)))item.introducedAt||=at;
    if(kind==='checkpoint'&&passed){item.checkedAt||=at;item.reviewAt||=at+DAY;}
    if(kind==='review'){
      const delayed=old.checkedAt&&at-old.checkedAt>=DAY&&old.reviewAt&&at>=old.reviewAt;
      if(passed&&delayed){item.retainedAt||=at;item.reviews=(old.reviews||0)+1;item.reviewAt=at+[3,7,14,30,60][Math.min(4,item.reviews-1)]*DAY;}
      else item.reviewAt=at+DAY;
    }
    value.course.units[unitId]=item;save(value);return {passed,retained:!!item.retainedAt,kind};
  }
  function recordWriting(char,event){
    if(!levels.has(char))return;const value=read(),old=value.course.writing[char]||{traceAt:0,independentAt:0};
    const key=event.mode==='write'&&!event.assisted&&!event.errors?'independentAt':'traceAt';old[key]=Math.max(old[key]||0,number(event.at)||Date.now());value.course.writing[char]=old;save(value);
  }
  function introReady(state=read()){return ['placement','confident'].includes(state.entry?.mode)||introductory.every(char=>introduced(state,char));}
  function studyPool(level,state=read()){
    const band=bands.find(b=>b.level===level);if(!band||!allowed(level,state))return [];
    if(level!==5||introReady(state))return [...band.chars];
    // Keep existing study/review access when upgrading an established account.
    const known=new Set([...Object.keys(state.lessons),...Object.values(state.sources).flatMap(source=>Object.keys(source))]);
    return [...new Set([...introductory,...[...band.chars].filter(c=>known.has(c))])];
  }
  function reviewSets(state=read(),at=Date.now()){
    const counts=new Map(),known=new Set(Object.values(state.sources).flatMap(source=>Object.keys(source)));
    for(const char of known)for(const skill of skills){const m=metrics(state,char,skill);if(m.last&&m.due<=at){const key=levels.get(char)+':'+skill;counts.set(key,(counts.get(key)||0)+1);}}
    return bands.filter(band=>allowed(band.level,state)).flatMap(band=>skills.filter(skill=>counts.has(band.level+':'+skill)).map(skill=>({level:band.level,skill,count:counts.get(band.level+':'+skill)})));
  }
  function lesson(char){const state=read();if(!allowed(levels.get(char),state))return false;state.lessons[char]||=Date.now();save(state);return true;}
  function introduction(char){const state=read();if(!allowed(levels.get(char),state))return false;state.lessons[char]||=Date.now();state.introductions[char]||=Date.now();save(state);return true;}
  function record(input){
    const previous=snapshot(),{char,skill,runId,index}=input;
    if(!levels.has(char)||!evidenceSkills.includes(skill)||!safe(runId)||!Number.isInteger(index)||index<1||!allowed(levels.get(char),previous))throw new Error('Choose an unlocked Kanji lesson.');
    if(index<=(previous.runs[runId]?.index||0))return false;
    const id=root.ModeAtlasProgress.getDeviceId(),at=number(input.at)||Date.now();
    // Copy only branches this answer can change. Unchanged evidence remains
    // private and immutable; rollback can still read the old stored snapshot.
    const state={...previous,sources:{...previous.sources,[id]:{...previous.sources[id],[char]:{...previous.sources[id]?.[char]}}},
      earned:{...previous.earned,[char]:{...Object.fromEntries(skills.map(name=>[name,0])),...previous.earned[char]}},
      recent:{...previous.recent,[char]:{...Object.fromEntries(evidenceSkills.map(name=>[name,''])),...previous.recent[char]}},
      completions:{...previous.completions},runs:{...previous.runs}};
    const before=metrics(state,char,skill);
    const r=row(state.sources[id][char][skill]),independent=input.correct&&!input.assisted;
    r[input.correct?C:W]++;r[T]+=Math.min(300000,number(input.elapsed));
    if(independent){r[I]++;r[S]=before.streak+1;r[DAYS]=[...new Set([...r[DAYS].split(',').filter(Boolean),date(at)])].sort().slice(-4).join(',');}
    else if(!input.correct)r[S]=0;
    const due=before.last&&at>=before.due;
    r[R]=input.correct?Math.min(8,before.reviews+(independent&&due?1:0)):0;
    r[AT]=at;r[DUE]=input.correct&&before.last&&!due?before.due:at+(input.correct?[60000,10*60000,DAY,3*DAY,7*DAY,14*DAY,30*DAY,60*DAY,90*DAY][r[R]]:60000);
    r[RECENT]=mergeRecent(r[RECENT],`${at.toString(36)}:${input.assisted?1:input.correct?2:0}:${hash(runId+':'+index)}`);
    // Only this row and the bounded run receipts changed. Re-normalizing every
    // character here repeats work already done by read() and blocks input.
    state.sources[id][char][skill]=row(r);state.runs[runId]={index,at};
    state.runs=Object.fromEntries(Object.entries(state.runs).sort((a,b)=>b[1].at-a[1].at||a[0].localeCompare(b[0])).slice(0,32));
    state.earned[char]||=Object.fromEntries(skills.map(name=>[name,0]));if(skills.includes(skill))state.earned[char][skill]=Math.max(state.earned[char][skill]||0,readiness(state,char,skill));
    state.recent[char]||=Object.fromEntries(evidenceSkills.map(name=>[name,'']));state.recent[char][skill]=mergeRecent(state.recent[char][skill],r[RECENT]);state.sources[id][char][skill][RECENT]='';
    if(completed(state,char))state.completions[char]||=at;
    commit(state);return true;
  }
  function entered(state=read()){return !!state.entry?.mode||Object.keys(state.lessons).length>0||Object.keys(state.sources).length>0;}
  function overview(state=read()){
    const chars=new Set(Object.values(state.sources).flatMap(source=>Object.keys(source)));
    return {started:entered(state),studied:chars.size,attempts:[...chars].reduce((n,char)=>n+skills.reduce((total,skill)=>total+metrics(state,char,skill).attempts,0),0)};
  }
  function access(state,char){return state.entry?.mode==='confident'||state.entry?.mode==='placement'&&state.entry.bands.includes(levels.get(char));}
  function enter(mode,bands=[5]){const value=read();value.entry={mode,bands:mode==='beginner'?[]:bands,at:Math.max(Date.now(),value.entry.at+1)};save(value);return value;}
  function settings(patch){const state=read();state.settings={...state.settings,...patch,at:Date.now()};save(state);return state.settings;}
  return Object.freeze({KEY,UPDATED,skills,evidenceSkills,levels,normalize,merge,read,save,metrics,completed,stage,readiness,assessment,summary,overview,allowed,introductory,introduced,encountered,introReady,studyPool,reviewSets,courseStatus,nextAction,finishCourse,recordWriting,lesson,introduction,record,settings,entered,enter,access});
});
