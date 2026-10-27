/* Personal vocabulary owns content, skill-specific evidence and its merge rules.
   Content edits invalidate only questions whose prompt/answer changed. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.ModeAtlasWordBank=factory(root);
})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const KEY='kanaWordBank',DELETED='modeAtlasWordBankDeleted',SKILLS=['meaning','reading','listening'];
  const DAY=86400000,INTERVALS=[600000,600000,DAY,3*DAY,7*DAY,14*DAY,30*DAY,60*DAY,90*DAY];
  const number=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
  const clock=value=>number(value)||Date.parse(value)||0;
  const clean=value=>String(value||'').normalize('NFKC').trim();
  const hash=value=>{let n=2166136261;for(const c of value)n=Math.imul(n^c.codePointAt(0),16777619);return (n>>>0).toString(36);};
  const reading=value=>/^[ぁ-ゖァ-ヺー\s]+$/.test(clean(value))?clean(value).replace(/\s+/g,''):'';
  const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
  const reviewKey=skill=>skill==='reading'?'readingReview':skill==='listening'?'listeningReview':'review';
  const plain=value=>({level:Math.min(8,Math.floor(number(value?.level))),due:number(value?.due),last:number(value?.last)});
  const contentKey=(word,skill)=>skill+'-'+hash(JSON.stringify(skill==='meaning'?[word.written,word.english,word.acceptedMeanings||[]]:skill==='reading'?[word.written,word.reading]:[word.reading]));
  function advance(base,event){
    const next={...base},due=!next.last||next.due<=event.at;
    if(!event.correct){next.level=0;next.due=event.at+600000;}
    else if(event.kind==='learn'){if(!next.due)next.due=event.at+DAY;}
    else if(due){next.level=Math.min(8,next.level+1);next.due=event.at+INTERVALS[next.level];}
    next.last=Math.max(next.last,event.at);return next;
  }
  function schedule(value,key){
    const valid=!value?.contentKey||value.contentKey===key,resetAt=number(value?.resetAt);
    let base=valid?plain(value?.base||value):plain(),events=[];
    if(valid)events=[...new Map((Array.isArray(value?.events)?value.events:[]).filter(e=>e&&typeof e.id==='string'&&e.id.length<=128&&number(e.at)>=resetAt).map(e=>({id:e.id,at:number(e.at),correct:e.correct===true,kind:e.kind==='learn'?'learn':'review'})).sort((a,b)=>stable(a).localeCompare(stable(b))).map(e=>[e.id,e])).values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
    while(events.length>64)base=advance(base,events.shift());
    const result=events.reduce(advance,base);
    return {...result,base,events,contentKey:key,resetAt,introducedAt:valid?number(value?.introducedAt):0};
  }
  function normalize(input){
    const map=new Map();
    for(const item of Array.isArray(input)?input:[]){
      if(!item||typeof item!=='object'||typeof(item.written??item.kana)!=='string')continue;
      const written=clean(item.written||item.kana).slice(0,200);if(!written)continue;
      let id=typeof item.id==='string'&&item.id.length>0&&item.id.length<=128?item.id:'word-'+hash(written+'|'+(item.createdAt||''));
      if(map.has(id)&&map.get(id).written!==written)id=id+'-'+hash(written);
      if(['__proto__','constructor','prototype'].includes(id))continue;
      const kana=reading(item.reading||written),text=key=>typeof item[key]==='string'?item[key]:'';
      const row={id,written,reading:kana,romaji:kana?root.ModeAtlasJapanese.romaji(kana):'',english:text('english').slice(0,1000),example:text('example').slice(0,2000),exampleTranslation:text('exampleTranslation').slice(0,2000),notes:text('notes').slice(0,10000),favorite:item.favorite===true,createdAt:text('createdAt'),updatedAt:text('updatedAt'),contentUpdatedAt:clock(item.contentUpdatedAt)||clock(item.updatedAt)||clock(item.createdAt),acceptedMeanings:[...new Set((Array.isArray(item.acceptedMeanings)?item.acceptedMeanings:[]).filter(s=>typeof s==='string').map(s=>clean(s).slice(0,200)).filter(Boolean))].slice(0,32)};
      for(const skill of SKILLS)row[reviewKey(skill)]=schedule(item[reviewKey(skill)],contentKey(row,skill));
      map.set(id,row);
    }
    return [...map.values()];
  }
  function read(){return normalize(root.ModeAtlasStorage.json(KEY,[]));}
  function save(input){
    const previous=read(),next=normalize(input),ids=new Set(next.map(row=>row.id)),now=Date.now();
    for(const row of next){
      const old=previous.find(item=>item.id===row.id);if(!old)continue;
      const fields=['written','reading','english','example','exampleTranslation','notes','favorite','acceptedMeanings'];
      if(fields.some(key=>stable(row[key])!==stable(old[key]))){
        // Editing the freeform meaning does not silently retain an old objective answer key.
        if(row.english!==old.english&&stable(row.acceptedMeanings)===stable(old.acceptedMeanings))row.acceptedMeanings=[];
        row.contentUpdatedAt=Math.max(now,old.contentUpdatedAt+1);row.updatedAt=new Date(Math.max(row.contentUpdatedAt,clock(old.updatedAt)+1)).toISOString();
      }
      // A collection editor can predate a learning session. Its stale schedules
      // must not erase newer answers for content that has not changed.
      const merged=mergeRecords([old],[row])[0];
      for(const skill of SKILLS){const key=reviewKey(skill);row[key]=contentKey(row,skill)!==contentKey(old,skill)?schedule({resetAt:row.contentUpdatedAt},contentKey(row,skill)):merged[key];}
    }
    const deleted=root.ModeAtlasStorage.json(DELETED,{});
    for(const row of previous)if(!ids.has(row.id))deleted[row.id]=now;
    root.ModeAtlasStorage.transaction(()=>{
      if(!root.ModeAtlasStorage.setJSON(KEY,next)||!root.ModeAtlasStorage.setJSON(DELETED,deleted))throw Error('Your word could not be saved.');
      root.ModeAtlasStorage.set('kanaWordBankUpdatedAt',String(now));
    });
    const notify=()=>{root.KanaCloudSync?.markSectionUpdated?.('wordBank');root.KanaCloudSync?.scheduleSync?.();root.dispatchEvent?.(new CustomEvent('modeAtlasWordsChanged'));};
    if(root.ModeAtlasStorage.afterCommit)root.ModeAtlasStorage.afterCommit(notify);else notify();
    if(next.some(row=>!previous.some(old=>old.id===row.id)))root.ModeAtlasVisitFlows?.recordActivity('wordBank');
    return next;
  }
  function add({written,reading:kana='',english='',example='',exampleTranslation='',notes='',acceptedMeanings=[]}={}){
    const items=read(),existing=items.find(item=>item.written===clean(written)&&item.reading===(reading(kana)||reading(written)));if(existing)return existing;
    const at=new Date().toISOString(),row={id:root.crypto?.randomUUID?.()||'word-'+Date.now()+'-'+Math.random().toString(36).slice(2),written,reading:kana,english,example,exampleTranslation,notes,acceptedMeanings,createdAt:at,updatedAt:at};
    return save([row,...items]).find(item=>item.id===row.id);
  }
  function snapshot(word,skill){return skill==='teach'?'teach-'+hash(SKILLS.map(k=>snapshot(word,k)).join('|')):contentKey(word,skill)+':'+number(word[reviewKey(skill)]?.resetAt);}
  function availableSkills(word){return SKILLS.filter(skill=>skill==='meaning'?word.english.trim():word.reading);}
  function due(at=Date.now(),skill='all'){
    const ready=(word,kind)=>availableSkills(word).includes(kind)&&word[reviewKey(kind)].due<=at;
    return read().filter(word=>skill==='all'?SKILLS.some(kind=>ready(word,kind)):ready(word,skill)).sort((a,b)=>a[reviewKey(skill)].due-b[reviewKey(skill)].due);
  }
  function current(id,skill,expected){
    const items=read(),row=items.find(item=>item.id===id);if(!row)throw Error('This word was removed. Return to your collection.');
    if(expected&&snapshot(row,skill)!==expected)throw Error('This word changed. Return to your collection to learn the updated entry.');
    if(skill!=='teach'&&!availableSkills(row).includes(skill))throw Error(skill==='meaning'?'Add a meaning to this word first.':'Add a kana reading to this word first.');
    return {items,row};
  }
  function introduce(id,expected,at=Date.now()){
    const {items,row}=current(id,'teach',expected);for(const skill of availableSkills(row))row[reviewKey(skill)].introducedAt=row[reviewKey(skill)].introducedAt||at;
    row.updatedAt=new Date(Math.max(at,clock(row.updatedAt)+1)).toISOString();save(items);
    const visit=()=>root.ModeAtlasVisitFlows?.recordActivity('wordBank');
    if(root.ModeAtlasStorage.afterCommit)root.ModeAtlasStorage.afterCommit(visit);else visit();
    return row;
  }
  function review(id,remembered,at=Date.now(),skill='meaning',options={}){
    if(!SKILLS.includes(skill))throw Error('Choose a valid word skill.');
    const {items,row}=current(id,skill,options.snapshot),key=reviewKey(skill),state=row[key];
    const event={id:root.crypto?.randomUUID?.()||at.toString(36)+'-'+Math.random().toString(36).slice(2),at,correct:remembered===true,kind:options.kind==='learn'?'learn':'review'};
    row[key]=schedule({...state,events:[...state.events,event]},contentKey(row,skill));
    row.updatedAt=new Date(Math.max(at,clock(row.updatedAt)+1)).toISOString();
    root.ModeAtlasStorage.transaction(()=>{save(items);root.ModeAtlasProgress?.recordHabit?.({branch:'wordbank',id:'word-'+hash(row.id),at});});
    root.ModeAtlasVisitFlows?.recordActivity('wordBank');return row[key];
  }
  function mergeRecords(left,right,deleted={}){
    const map=new Map();
    for(const row of [...normalize(left),...normalize(right)]){
      if(Object.hasOwn(deleted,row.id))continue;const old=map.get(row.id);if(!old){map.set(row.id,row);continue;}
      const winner=row.contentUpdatedAt!==old.contentUpdatedAt?(row.contentUpdatedAt>old.contentUpdatedAt?row:old):(stable(row)>stable(old)?row:old),next={...winner};
      // Preserve the original spelling when clocks are equal. Reformatting a
      // legacy date only on the second merge needlessly rewrites cloud parts.
      next.updatedAt=clock(old.updatedAt)>clock(row.updatedAt)?old.updatedAt:clock(old.updatedAt)<clock(row.updatedAt)?row.updatedAt:[old.updatedAt,row.updatedAt].sort().at(-1);
      for(const skill of SKILLS){
        const key=reviewKey(skill),signature=contentKey(next,skill),resetAt=next[key].resetAt;
        const candidates=[old[key],row[key]].filter(s=>s.contentKey===signature&&s.resetAt===resetAt);
        const base=candidates.map(s=>s.base).sort((a,b)=>b.last-a.last||stable(b).localeCompare(stable(a)))[0]||plain();
        const introductions=candidates.map(s=>s.introducedAt).filter(Boolean);
        next[key]=schedule({base,contentKey:signature,resetAt,introducedAt:introductions.length?Math.min(...introductions):0,events:candidates.flatMap(s=>s.events).filter(e=>e.at>base.last)},signature);
      }
      map.set(row.id,next);
    }
    return [...map.values()].sort((a,b)=>clock(b.createdAt)-clock(a.createdAt)||a.id.localeCompare(b.id));
  }
  function untaught(ids){
    const selected=Array.isArray(ids)?new Set(ids):null;
    return read().filter(word=>(!selected||selected.has(word.id))&&availableSkills(word).some(skill=>!word[reviewKey(skill)].introducedAt));
  }
  function pendingCourse(){
    const course=root.ModeAtlasWordLessonState?.read?.()['wordbank-course']?.course;if(!course)return null;
    if(!course.completedAt&&course.cursor<course.tasks.length){
      const items=read(),byId=new Map(items.map(word=>[word.id,word]));
      const current=task=>{const word=byId.get(task.id);return word&&snapshot(word,task.mode)===task.snapshot&&(task.mode==='teach'||availableSkills(word).includes(task.mode));};
      if(course.tasks.slice(course.cursor).every(current))return course;
      const wanted=course.selectionIds?.length?course.selectionIds:course.wordIds||course.tasks.map(task=>task.id);
      const selected=items.filter(word=>wanted.includes(word.id)&&availableSkills(word).length);
      const ready=course.kind==='learn'?selected:selected.filter(word=>availableSkills(word).some(skill=>word[reviewKey(skill)].due<=Date.now()));
      // Rebuild from current content without deleting any recorded skill events.
      // If the selected words are all gone/unanswerable, there is nothing to resume.
      return ready.length?{...course,selectionIds:selected.map(word=>word.id),restartRequired:true}:null;
    }
    // A finished five-word batch still owns the rest of the original selection.
    if(course.kind==='learn'&&course.selectionIds?.length&&untaught(course.selectionIds).length)return course;
    return null;
  }
  function nextAction(){
    const pending=pendingCourse();if(pending)return {kind:pending.kind,title:'Continue your words',label:'Continue',detail:'Pick up your saved set.',href:'/wordbank/?view=bank&session=bank'};
    const items=read(),newWords=untaught();
    if(newWords.length)return {kind:'learn',title:'Learn your saved words',label:'Learn words',detail:`${newWords.length} ready to meet`,href:'/wordbank/?view=bank&session=bank'};
    const reviews=due();if(reviews.length)return {kind:'review',title:'Review your words',label:'Review words',detail:`${reviews.length} due`,href:'/wordbank/?view=bank&session=bank'};
    return {kind:'bank',title:'Your Word Bank',label:'Open collection',detail:items.length?'Your collection is up to date.':'Add a word you want to remember.',href:'/wordbank/?view=bank'};
  }
  function matchesMeaning(value,word){
    if(!word.acceptedMeanings.length)return null;
    const normalizeAnswer=s=>clean(s).toLocaleLowerCase().replace(/[.!?]+$/g,'').replace(/\s+/g,' ');
    return word.acceptedMeanings.some(answer=>normalizeAnswer(answer)===normalizeAnswer(value));
  }
  return Object.freeze({KEY,DELETED,SKILLS,normalize,read,save,add,due,review,reviewKey,snapshot,introduce,availableSkills,untaught,mergeRecords,pendingCourse,nextAction,matchesMeaning});
});
