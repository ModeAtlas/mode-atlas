/* Durable lesson checkpoints and contextual recall. Word schedules belong to WordBank.
   This section travels with Word Bank through sync, backup and account reset. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.ModeAtlasWordLessonState=factory(root);
})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const KEY='modeAtlasWordLessons';
  const phases=['meet','recall','apply','complete'];
  const DAY=86400000,INTERVALS=Object.freeze([DAY,7*DAY,14*DAY,30*DAY]);
  const vocabularySkills=Object.freeze(['decode','meaning','produceRoman','produceKana']);
  const eventPattern=/^[0-9a-z]+:[012]:[pt]:[0-9a-z-]{1,60}$/;
  function events(value){return String(value||'').split(',').filter(v=>eventPattern.test(v)).map(v=>{const [at,q,kind,id]=v.split(':');return {at:parseInt(at,36),quality:Number(q),kind,id,encoded:v};});}
  function mergeEvents(a,b){return [...new Map([...events(a),...events(b)].sort((a,b)=>a.encoded.localeCompare(b.encoded)).map(e=>[e.id,e])).values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)).slice(-16).map(e=>e.encoded).join(',');}
  function vocabulary(value){if(!value||typeof value!=='object')return null;return {learnedAt:count(value.learnedAt),formIntroducedAt:count(value.formIntroducedAt),...Object.fromEntries(vocabularySkills.map(k=>[k,mergeEvents(value[k],'')])),achieved:Object.fromEntries(vocabularySkills.map(k=>[k,count(value.achieved?.[k])])),schedules:Object.fromEntries(vocabularySkills.filter(k=>value.schedules?.[k]).map(k=>[k,{level:Math.min(5,count(value.schedules[k].level)),due:count(value.schedules[k].due),last:count(value.schedules[k].last)}]))};}
  const count=value=>Number.isFinite(Number(value))?Math.max(0,Math.floor(Number(value))):0;
  // Both word courses keep their resumable task cursor in this existing synced
  // section. It is not word mastery and never contributes to phrase completion.
  function course(value){
    if(!value||typeof value!=='object'||typeof value.id!=='string')return null;
    const text=v=>typeof v==='string'?v.slice(0,128):'';
    const task=t=>({id:text(t?.id),mode:text(t?.mode),snapshot:text(t?.snapshot),retry:t?.retry===true,assisted:t?.assisted===true});
    const taskModes=new Set(['meet','teach',...vocabularySkills,'reading','listening']);
    const tasks=(Array.isArray(value.tasks)?value.tasks:[]).slice(0,100).map(task).filter(t=>t.id&&taskModes.has(t.mode));
    return {id:text(value.id),kind:text(value.kind),script:['mixed','personal'].includes(value.script)?value.script:'kana',wordIds:(Array.isArray(value.wordIds)?value.wordIds:[]).map(text).filter(Boolean).slice(0,50),selectionIds:(Array.isArray(value.selectionIds)?value.selectionIds:[]).map(text).filter(Boolean).slice(0,500),milestoneIds:(Array.isArray(value.milestoneIds)?value.milestoneIds:[]).map(text).filter(Boolean).slice(0,6),tasks,
      cursor:Math.min(tasks.length,count(value.cursor)),phase:['active','task','feedback','complete'].includes(value.phase)?value.phase:'task',
      results:(Array.isArray(value.results)?value.results:[]).slice(0,100).map(t=>({...task(t),correct:t?.correct===true})),
      milestone:Math.min(512,count(value.milestone)),finalCheckpoint:value.finalCheckpoint===true,startedAt:count(value.startedAt),completedAt:count(value.completedAt),updatedAt:count(value.updatedAt)};
  }
  function normalizeReview(row,completedAt=0){
    if(!completedAt)return null;
    return {dueAt:count(row?.dueAt)||completedAt+DAY,
      interval:Math.min(INTERVALS.length-1,count(row?.interval)),
      variant:count(row?.variant)%2,relearning:row?.relearning===true,lastAt:count(row?.lastAt),updatedAt:count(row?.updatedAt)||completedAt};
  }
  function normalize(input){
    return Object.fromEntries(Object.entries(input||{}).filter(([id,row])=>
      /^[a-z][a-z0-9-]{0,39}$/.test(id)&&!['constructor','prototype'].includes(id)&&row&&typeof row==='object'
    ).slice(0,512).map(([id,row])=>[id,{
      index:Math.min(50,count(row.index)),phase:phases.includes(row.phase)?row.phase:'meet',
      application:Math.min(20,count(row.application)),startedAt:count(row.startedAt),
      updatedAt:count(row.updatedAt),completedAt:count(row.completedAt),
      review:normalizeReview(row.review,count(row.completedAt)),
      ...(vocabulary(row.vocabulary)?{vocabulary:vocabulary(row.vocabulary)}:{}),
      ...(course(row.course)?{course:course(row.course)}:{}),
      ...(row.preferences?{preferences:{script:row.preferences.script==='mixed'?'mixed':'kana',checkpointWords:count(row.preferences.checkpointWords),checkpointed:[...new Set((Array.isArray(row.preferences.checkpointed)?row.preferences.checkpointed:[]).filter(id=>typeof id==='string'&&id.length<=128))].slice(0,512).sort()}}:{})
    }]));
  }
  function read(){return normalize(root.ModeAtlasStorage.json(KEY,{}));}
  function merge(left,right){
    const a=normalize(left),b=normalize(right),out={...a};
    for(const [id,row]of Object.entries(b)){
      const old=out[id];
      const newer=!old||row.updatedAt>old.updatedAt||(row.updatedAt===old.updatedAt&&JSON.stringify(row)>JSON.stringify(old));
      const reviews=[old?.review,row.review].filter(Boolean).sort((a,b)=>b.updatedAt-a.updatedAt||JSON.stringify(b).localeCompare(JSON.stringify(a)));
      out[id]={...(newer?row:old),completedAt:Math.max(old?.completedAt||0,row.completedAt),review:reviews[0]||null};
      if(old?.preferences||row.preferences){const checkpointed=[...new Set([...(old?.preferences?.checkpointed||[]),...(row.preferences?.checkpointed||[])])].sort();out[id].preferences={...(out[id].preferences||old?.preferences||row.preferences),checkpointed,checkpointWords:Math.max(checkpointed.length,old?.preferences?.checkpointWords||0,row.preferences?.checkpointWords||0)};}
      if(old?.vocabulary||row.vocabulary){const av=old?.vocabulary||{},bv=row.vocabulary||{};out[id].vocabulary={learnedAt:Math.min(av.learnedAt||bv.learnedAt||0,bv.learnedAt||av.learnedAt||0),formIntroducedAt:Math.min(av.formIntroducedAt||bv.formIntroducedAt||0,bv.formIntroducedAt||av.formIntroducedAt||0),...Object.fromEntries(vocabularySkills.map(k=>[k,mergeEvents(av[k],bv[k])])),achieved:Object.fromEntries(vocabularySkills.map(k=>[k,Math.max(av.achieved?.[k]||0,bv.achieved?.[k]||0)])),schedules:Object.fromEntries(vocabularySkills.map(k=>{const choices=[av.schedules?.[k],bv.schedules?.[k]].filter(Boolean).sort((a,b)=>b.last-a.last||JSON.stringify(b).localeCompare(JSON.stringify(a)));return [k,choices[0]];}).filter(([,v])=>v))};}
    }
    return normalize(out);
  }
  function checkpoint(id,patch){
    const state=read(),now=Date.now();
    const next=normalize({...state,[id]:{...state[id],startedAt:state[id]?.startedAt||now,...patch,updatedAt:Math.max(now,(state[id]?.updatedAt||0)+1)}});
    if(!next[id]||!root.ModeAtlasStorage.setJSON(KEY,next))throw Error('Your lesson could not be saved. Please try again.');
    root.ModeAtlasStorage.set('kanaWordBankUpdatedAt',String(now));
    const notify=()=>{
      root.KanaCloudSync?.markSectionUpdated?.('wordBank');
      root.KanaCloudSync?.scheduleSync?.();
      root.dispatchEvent?.(new CustomEvent('modeAtlasWordLessonsChanged'));
    };
    if(root.ModeAtlasStorage.afterCommit)root.ModeAtlasStorage.afterCommit(notify);else notify();
    return next[id];
  }
  function next(units){
    const state=read();
    return units.filter(unit=>state[unit.id]?.startedAt&&state[unit.id]?.phase!=='complete')
      .sort((a,b)=>state[b.id].updatedAt-state[a.id].updatedAt)[0]
      ||units.find(unit=>!state[unit.id]?.completedAt)||null;
  }
  function due(now=Date.now()){
    return Object.entries(read()).filter(([,row])=>row.review?.dueAt<=now)
      .sort((a,b)=>a[1].review.dueAt-b[1].review.dueAt).map(([id])=>id);
  }
  function review(id,correct,now=Date.now()){
    const previous=read()[id];
    if(!previous?.completedAt)throw Error('Finish this lesson before reviewing it.');
    const old=previous.review,isDue=old.dueAt<=now;
    const interval=correct&&isDue?(old.relearning?0:Math.min(INTERVALS.length-1,old.interval+1)):correct?old.interval:0;
    const updated={...old,interval,lastAt:now,updatedAt:Math.max(now,old.updatedAt+1)};
    if(!correct){updated.dueAt=now+600000;updated.relearning=true;}
    else if(isDue){updated.dueAt=now+INTERVALS[interval];updated.variant=(old.variant+1)%2;updated.relearning=false;}
    // Saving and the personal habit receipt must commit together. No competitive reward.
    return root.ModeAtlasStorage.transaction(()=>{
      const saved=checkpoint(id,{review:updated});
      root.ModeAtlasProgress?.recordHabit?.({branch:'wordbank',id:'phrase-'+id,at:now});
      return saved.review;
    });
  }
  function vocabularyOverview(now=Date.now()){const rows=Object.values(read()).filter(row=>row.vocabulary?.learnedAt);return {introduced:rows.length,attempts:rows.reduce((n,row)=>n+vocabularySkills.reduce((s,k)=>s+events(row.vocabulary[k]).length,0),0),due:rows.filter(row=>vocabularySkills.some(k=>{const list=events(row.vocabulary[k]);return list.length&&(row.vocabulary.schedules?.[k]||vocabularySchedule(list)).due<=now;})).length};}
  function vocabularySchedule(list){let level=0,due=0;for(const event of list){if(event.quality!==2){level=0;due=event.at+600000;}else if(!due||event.at>=due){level=Math.min(5,level+1);due=event.at+[0,86400000,259200000,604800000,1209600000,2592000000][level];}}return {level,due};}
  return Object.freeze({KEY,INTERVALS,normalize,read,merge,checkpoint,next,due,review,vocabularySkills,events,mergeEvents,vocabularySchedule,vocabularyOverview});
});
