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
  const skills=['pronunciation','meaning'];
  // correct, wrong, independent correct, consecutive independent correct,
  // active response milliseconds, last attempt, next review, spaced successes,
  // last four independent study dates (comma-separated, Firestore-safe).
  const C=0,W=1,I=2,S=3,T=4,AT=5,DUE=6,R=7,DAYS=8;
  const number=v=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(v))):0;
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const safe=id=>/^[a-zA-Z0-9-]{1,100}$/.test(id)&&!['constructor','prototype','__proto__'].includes(id);
  const date=at=>root.ModeAtlasDates.localDateKey(new Date(at));
  function row(input){
    const values=Array.isArray(input)?input:[];
    const out=Array.from({length:8},(_,i)=>number(values[i]));
    out[I]=Math.min(out[I],out[C]);out[S]=Math.min(out[S],out[I]);out[R]=Math.min(out[R],8);
    out[DAYS]=[...new Set(String(values[DAYS]||'').split(',').filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))].sort().slice(-4).join(',');
    return out;
  }
  function normalize(input){
    const value=object(input),sources={},lessons={},introductions={},completions={};
    for(const [id,items]of Object.entries(object(value.sources))){
      if(!safe(id))continue;const chars={};
      for(const [char,evidence]of Object.entries(object(items))){
        if(!levels.has(char))continue;const item={};
        for(const skill of skills)if(Array.isArray(evidence?.[skill]))item[skill]=row(evidence[skill]);
        if(Object.keys(item).length)chars[char]=item;
      }if(Object.keys(chars).length)sources[id]=chars;
    }
    for(const [char,at]of Object.entries(object(value.lessons)))if(levels.has(char)&&number(at))lessons[char]=number(at);
    for(const [char,at]of Object.entries(object(value.introductions)))if(levels.has(char)&&number(at))introductions[char]=number(at);
    for(const [char,at]of Object.entries(object(value.completions)))if(levels.has(char)&&number(at))completions[char]=number(at);
    const runs=Object.fromEntries(Object.entries(object(value.runs)).filter(([id,r])=>safe(id)&&number(r?.at)).sort((a,b)=>b[1].at-a[1].at||a[0].localeCompare(b[0])).slice(0,32).map(([id,r])=>[id,{index:number(r.index),at:number(r.at)}]));
    const settings=object(value.settings);
    return {version:1,sources,lessons,introductions,completions,runs,settings:{level:[1,2,3,4,5].includes(settings.level)?settings.level:5,romaji:settings.romaji===true,at:number(settings.at)},updatedAt:number(value.updatedAt)};
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
          a.sources[id][char][skill]=merged;
        }
      }
    }
    for(const [char,at]of Object.entries(b.lessons))a.lessons[char]=Math.min(a.lessons[char]||at,at);
    for(const [char,at]of Object.entries(b.introductions))a.introductions[char]=Math.min(a.introductions[char]||at,at);
    for(const [char,at]of Object.entries(b.completions))a.completions[char]=Math.min(a.completions[char]||at,at);
    for(const [id,r]of Object.entries(b.runs)){const old=a.runs[id];a.runs[id]={index:Math.max(old?.index||0,r.index),at:Math.max(old?.at||0,r.at)};}
    if(b.settings.at>a.settings.at||(b.settings.at===a.settings.at&&JSON.stringify(b.settings)>JSON.stringify(a.settings)))a.settings=b.settings;
    a.updatedAt=Math.max(a.updatedAt,b.updatedAt);return normalize(a);
  }
  function read(){return normalize(root.ModeAtlasStorage?.json(KEY,{}));}
  function save(state){
    state.updatedAt=Date.now();
    if(!root.ModeAtlasStorage.setJSON(KEY,normalize(state)))throw new Error('Your device could not save this answer. Free some storage and try again.');
    root.ModeAtlasStorage.set(UPDATED,String(state.updatedAt));
    root.KanaCloudSync?.scheduleSync?.(900);
  }
  function metrics(state,char,skill){
    const rows=Object.values(state.sources).map(source=>source[char]?.[skill]).filter(Boolean);
    const latest=[...rows].sort((a,b)=>b[AT]-a[AT]||JSON.stringify(b).localeCompare(JSON.stringify(a)))[0]||row();
    const sum=i=>rows.reduce((n,r)=>n+r[i],0),correct=sum(C),wrong=sum(W),attempts=correct+wrong;
    return {correct,wrong,attempts,independent:sum(I),streak:latest[S],average:attempts?sum(T)/attempts:0,last:latest[AT],due:latest[DUE],reviews:latest[R],days:[...new Set(rows.flatMap(r=>r[DAYS].split(',')).filter(Boolean))].sort(),accuracy:attempts?correct/attempts:0};
  }
  function completed(state,char){return !!state.completions[char]||skills.every(skill=>{const m=metrics(state,char,skill);return m.independent>=3&&m.accuracy>=.8;});}
  function stage(state,char,skill){
    if(!skill){const stages=skills.map(s=>stage(state,char,s));return Math.max(...stages)?Math.max(1,Math.min(...stages)):0;}
    const m=metrics(state,char,skill);
    if(m.independent>=30&&m.accuracy>=.95&&m.days.length>=4&&m.reviews>=4&&m.streak>=3)return 3;
    if(m.independent>=10&&m.accuracy>=.85&&m.days.length>=2&&m.reviews>=2)return 2;
    return m.attempts||state.lessons[char]?1:0;
  }
  function summary(state=read()){
    let unlocked=true;
    return bands.map(band=>{
      const chars=[...band.chars],complete=chars.filter(char=>completed(state,char)).length;
      const result={...band,total:chars.length,complete,unlocked,mastered:chars.filter(char=>stage(state,char)===3).length};
      unlocked=unlocked&&complete===chars.length;return result;
    });
  }
  function allowed(level,state=read()){return [1,2,3,4,5].includes(level)&&bands.filter(band=>band.level>level).every(band=>[...band.chars].every(char=>completed(state,char)));}
  const introductory=[...bands[0].intro];
  function introduced(state,char){return !!state.introductions[char]||completed(state,char);}
  function introReady(state=read()){return introductory.every(char=>introduced(state,char));}
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
    const state=read(),{char,skill,runId,index}=input;
    if(!levels.has(char)||!skills.includes(skill)||!safe(runId)||!Number.isInteger(index)||index<1||!allowed(levels.get(char),state))throw new Error('Choose an unlocked Kanji lesson.');
    if(index<=(state.runs[runId]?.index||0))return false;
    const id=root.ModeAtlasProgress.getDeviceId(),at=number(input.at)||Date.now(),before=metrics(state,char,skill);
    state.sources[id]||={};state.sources[id][char]||={};
    const r=row(state.sources[id][char][skill]),independent=input.correct&&!input.assisted;
    r[input.correct?C:W]++;r[T]+=Math.min(300000,number(input.elapsed));
    if(independent){r[I]++;r[S]=before.streak+1;r[DAYS]=[...new Set([...r[DAYS].split(',').filter(Boolean),date(at)])].sort().slice(-4).join(',');}
    else if(!input.correct)r[S]=0;
    const due=before.last&&at>=before.due;
    r[R]=input.correct?Math.min(8,before.reviews+(independent&&due?1:0)):0;
    r[AT]=at;r[DUE]=at+(input.correct?[60000,10*60000,DAY,3*DAY,7*DAY,14*DAY,30*DAY,60*DAY,90*DAY][r[R]]:60000);
    state.sources[id][char][skill]=r;state.runs[runId]={index,at};
    if(completed(state,char))state.completions[char]||=at;
    save(state);return true;
  }
  function settings(patch){const state=read();state.settings={...state.settings,...patch,at:Date.now()};save(state);return state.settings;}
  return Object.freeze({KEY,UPDATED,skills,levels,normalize,merge,read,save,metrics,completed,stage,summary,allowed,introductory,introduced,introReady,studyPool,reviewSets,lesson,introduction,record,settings});
});
