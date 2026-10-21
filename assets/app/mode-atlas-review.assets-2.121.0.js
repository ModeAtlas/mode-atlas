/* Canonical kana recall policy. Pure data transformations; trainers own storage. */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory;
  else root.ModeAtlasReview = factory(root);
})(typeof window !== 'undefined' ? window : globalThis, function ModeAtlasReview(root){
  'use strict';
  const DAY = 86400000;
  const intervals = Object.freeze([60000,600000,DAY,3*DAY,7*DAY,14*DAY,30*DAY,60*DAY,90*DAY]);
  const labels = Object.freeze(['New','Learning','Reviewing','Mastered']);
  const requirements=Object.freeze({2:Object.freeze({correct:10,lifetimeAccuracy:.85,maxTime:2500,attempts:4,accuracy:.75,days:2,level:2}),3:Object.freeze({correct:50,lifetimeAccuracy:.95,maxTime:1000,attempts:20,accuracy:.95,days:4,level:4})});
  const number = value => ['number','string'].includes(typeof value) && Number.isFinite(Number(value)) ? Math.min(Number.MAX_SAFE_INTEGER,Math.max(0,Number(value))) : 0;
  const date = at => root.ModeAtlasDates.localDateKey(new Date(at));
  function legacyStage(stats={},time=0){
    stats=stats&&typeof stats==='object'?stats:{};
    const c=number(stats.correct ?? stats.right), w=number(stats.wrong ?? stats.incorrect), total=c+w;
    const avg=time&&typeof time==='object'?number(time.avg||time.average||time.time):number(time);
    const ms=avg&&avg<30?avg*1000:avg;
    if(!total)return 0;
    for(const next of [3,2]){const target=requirements[next];if(c>=target.correct&&c/total>=target.lifetimeAccuracy&&(ms?ms<=target.maxTime:next===2))return next;}
    return 1;
  }
  function timeMilliseconds(value){
    const n=typeof value==='number'?number(value):number(value?.avg||value?.average||value?.time);
    return n&&n<30?n*1000:n;
  }
  function combinedStage(reading={},writing={}){
    const a=stage(reading.review,reading.stats,reading.time),b=stage(writing.review,writing.stats,writing.time);
    // Both requires evidence in both directions, including before Writing starts.
    return a||b?Math.max(1,Math.min(a,b)):0;
  }
  function normalize(input={},stats={},time=0){
    const value=input&&typeof input==='object'?input:{};
    // Firestore rejects arrays nested directly inside arrays. Store each recall
    // as a small object so the same snapshot works locally and in the cloud.
    const recent=Array.isArray(value.recent)?value.recent.filter(x=>x&&typeof x.id==='string'&&number(x.at)&&[0,1,2].includes(x.quality)).map(x=>({id:x.id,at:number(x.at),quality:x.quality})):[];
    const rows=[...new Map(recent.map(x=>[x.id,x])).values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)).slice(-24);
    return {reviewVersion:1,level:value.reviewVersion===1?Math.min(8,number(value.level)):0,
      due:number(value.due),lastSeen:number(value.lastSeen),lastWrong:number(value.lastWrong),
      recent:rows,days:[...new Set((Array.isArray(value.days)?value.days:[]).filter(x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)))].sort().slice(-8),
      peak:Math.min(3,value.reviewVersion===1?number(value.peak):legacyStage(stats,time)),legacy:value.reviewVersion===1?number(value.legacy):legacyStage(stats,time)};
  }
  function stage(input,stats={},time=0){
    if(input?.reviewVersion!==1)return legacyStage(stats,time);
    const row=normalize(input), independent=row.recent.filter(x=>x.quality!==1);
    const performance=legacyStage(stats,time);
    if(!row.recent.length)return performance;
    const accuracy=independent.filter(x=>x.quality===2).length/Math.max(1,independent.length);
    for(const next of [3,2]){const target=requirements[next];if(number(stats.correct??stats.right)>=target.correct&&independent.length>=target.attempts&&accuracy>=target.accuracy&&row.days.length>=target.days&&row.level>=target.level)return next;}
    return 1;
  }
  function guidance(input,stats={},time=0,targetStage){
    const current=stage(input,stats,time),row=normalize(input,stats,time),next=targetStage??Math.max(2,current+1),target=requirements[next];
    const attempts=row.recent.filter(x=>x.quality!==1),accuracy=attempts.filter(x=>x.quality===2).length/Math.max(1,attempts.length);
    const correct=number(stats?.correct??stats?.right),wrong=number(stats?.wrong??stats?.incorrect),ms=timeMilliseconds(time);
    const legacy=(input?.reviewVersion!==1||!row.recent.length)&&correct+wrong>0;
    const checks=target?[
        {id:'correct',label:'Correct answers',value:correct,target:target.correct},
        {id:'accuracy',label:'Lifetime accuracy (history)',value:correct/Math.max(1,correct+wrong)*100,target:target.lifetimeAccuracy*100,percent:true,required:legacy},
        {id:'time',label:'Response time (fluency)',value:ms||null,target:target.maxTime,maximum:true,unit:'ms',optional:true,required:legacy},
        {id:'recent-attempts',label:'Recent unassisted attempts',value:attempts.length,target:target.attempts,required:!legacy},
        {id:'recent-accuracy',label:'Recent unassisted accuracy',value:accuracy*100,target:target.accuracy*100,percent:true,required:!legacy},
        {id:'days',label:'Days with independent recall',value:row.days.length,target:target.days,required:!legacy},
        {id:'spacing',label:'Spaced recall steps',value:row.level,target:target.level,required:!legacy}
      ]:[];
    for(const check of checks)check.met=check.required===false?null:check.value===null?!!check.optional:check.maximum?check.value<=check.target:check.value>=check.target;
    return {stage:current,next:target?labels[next]:null,legacy,due:row.due,
      checks};
  }
  function help(){
    return [['New','No attempts yet.'],['Learning','Building independent recall. Hints help you learn; answers without hints build mastery.'],
      ...[2,3].map(stage=>{const r=requirements[stage];return [labels[stage],`At least ${r.correct} correct answers, including ${r.attempts} unassisted attempts in the most recent 24 answers at ${r.accuracy*100}% accuracy. Recall on ${r.days} different days and complete ${r.level} spaced recall steps. Lifetime accuracy and response speed describe your history and fluency; they do not block new mastery.`];}),
      ['Read, Recall & Both','Each direction keeps its own evidence. Both needs both directions. Earned mastery stays earned; due reviews show what to revisit. Handwriting is the extra step toward Mastered+.']];
  }
  function dueHelp(){
    return '“Due” counts characters ready to revisit, using spaced practice to help you remember them. Kana Read, Kana Recall and each Kanji skill have separate schedules. A short session can repeat characters, so this isn’t a question count. Reviews are suggestions, not deadlines. Five correct answers each day keep your study streak going—you don’t need to clear every due review.';
  }
  function answer(input,event,stats={},time=0){
    const row=normalize(input,stats,time), at=number(event.at), id=String(event.id||'');
    if(!id||!at||row.recent.some(x=>x.id===id))return {entry:row,duplicate:true,reviewed:false,milestone:0};
    const independent=event.correct&&!event.assisted;
    const reviewed=!!(independent&&input?.reviewVersion===1&&row.level>=2&&row.due<=at&&row.lastSeen<at-DAY/2);
    if(independent){
      // Early repetitions reinforce the answer without accelerating the schedule.
      if(!row.lastSeen||at>=row.due){row.level=Math.min(8,row.level+1);row.due=at+intervals[row.level];}
      row.days=[...new Set([...row.days,date(at)])].sort().slice(-8);
    }else{
      row.level=event.correct?Math.min(row.level,1):0;
      row.due=at+intervals[row.level];
      if(!event.correct)row.lastWrong=at;
    }
    row.lastSeen=at;
    row.recent.push({id,at,quality:independent?2:event.correct?1:0});row.recent=row.recent.slice(-24);
    const next=stage(row,stats,time),milestone=next>row.peak?next:0;
    row.peak=Math.max(row.peak,next);
    return {entry:row,duplicate:false,reviewed,milestone};
  }
  function merge(left={},right={}){
    if(left.reviewVersion!==1&&right.reviewVersion!==1)return number(left.lastSeen)>=number(right.lastSeen)?left:right;
    const a=normalize(left),b=normalize(right);
    const key=row=>`${String(row.lastSeen).padStart(16,'0')}:${row.recent.at(-1)?.id||''}`;
    const winner=key(a)>=key(b)?a:b;
    return normalize({...winner,recent:[...a.recent,...b.recent],days:[...a.days,...b.days],peak:Math.max(a.peak,b.peak),legacy:Math.max(a.legacy,b.legacy),lastWrong:Math.max(a.lastWrong,b.lastWrong)});
  }
  function mergeMaps(left={},right={}){
    const out={};for(const kana of [...new Set([...Object.keys(left),...Object.keys(right)])].sort())out[kana]=merge(left[kana]||{},right[kana]||{});return out;
  }
  function due(map={},chars=Object.keys(map),at=Date.now()){
    return chars.filter(kana=>map[kana]?.reviewVersion===1&&map[kana].lastSeen>0&&map[kana].due>0&&map[kana].due<=at).sort((a,b)=>map[a].due-map[b].due||a.localeCompare(b));
  }
  return Object.freeze({intervals,labels,requirements,legacyStage,timeMilliseconds,combinedStage,normalize,stage,guidance,help,dueHelp,answer,merge,mergeMaps,due});
});
