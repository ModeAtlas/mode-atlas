/* Canonical kana recall policy. Pure data transformations; trainers own storage. */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory;
  else root.ModeAtlasReview = factory(root);
})(typeof window !== 'undefined' ? window : globalThis, function ModeAtlasReview(root){
  'use strict';
  const DAY = 86400000;
  const intervals = Object.freeze([60000,600000,DAY,3*DAY,7*DAY,14*DAY,30*DAY,60*DAY,90*DAY]);
  const labels = Object.freeze(['New','Learning','Reviewing','Mastered']);
  const requirements=Object.freeze({2:Object.freeze({attempts:4,accuracy:.75,days:2,level:2}),3:Object.freeze({attempts:8,accuracy:.9,days:4,level:4})});
  const number = value => ['number','string'].includes(typeof value) && Number.isFinite(Number(value)) ? Math.min(Number.MAX_SAFE_INTEGER,Math.max(0,Number(value))) : 0;
  const date = at => root.ModeAtlasDates.localDateKey(new Date(at));
  function legacyStage(stats={},time=0){
    stats=stats&&typeof stats==='object'?stats:{};
    const c=number(stats.correct ?? stats.right), w=number(stats.wrong ?? stats.incorrect), total=c+w;
    const avg=time&&typeof time==='object'?number(time.avg||time.average||time.time):number(time);
    const ms=avg&&avg<30?avg*1000:avg;
    return !total?0:c>=50&&c/total>=.95&&ms>0&&ms<=1000?3:c>=10&&c/total>=.85&&(!ms||ms<=2500)?2:1;
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
    const rows=[...new Map(recent.map(x=>[x.id,x])).values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)).slice(-12);
    return {reviewVersion:1,level:value.reviewVersion===1?Math.min(8,number(value.level)):0,
      due:number(value.due),lastSeen:number(value.lastSeen),lastWrong:number(value.lastWrong),
      recent:rows,days:[...new Set((Array.isArray(value.days)?value.days:[]).filter(x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)))].sort().slice(-8),
      peak:Math.min(3,value.reviewVersion===1?number(value.peak):legacyStage(stats,time)),legacy:value.reviewVersion===1?number(value.legacy):legacyStage(stats,time)};
  }
  function stage(input,stats={},time=0){
    if(input?.reviewVersion!==1)return legacyStage(stats,time);
    const row=normalize(input), independent=row.recent.filter(x=>x.quality!==1);
    if(!row.recent.length)return row.legacy;
    const accuracy=independent.filter(x=>x.quality===2).length/Math.max(1,independent.length);
    for(const next of [3,2]){const target=requirements[next];if(independent.length>=target.attempts&&accuracy>=target.accuracy&&row.days.length>=target.days&&row.level>=target.level)return next;}
    return 1;
  }
  function guidance(input,stats={},time=0){
    const current=stage(input,stats,time),row=normalize(input,stats,time),target=requirements[Math.max(2,current+1)];
    const attempts=row.recent.filter(x=>x.quality!==1),accuracy=attempts.filter(x=>x.quality===2).length/Math.max(1,attempts.length);
    return {stage:current,next:target?labels[Math.max(2,current+1)]:null,legacy:!row.recent.length&&current>0,due:row.due,
      checks:target?[
        {label:'Recent unassisted attempts',value:attempts.length,target:target.attempts},
        {label:'Recent unassisted accuracy',value:Math.round(accuracy*100),target:target.accuracy*100,percent:true},
        {label:'Days with independent recall',value:row.days.length,target:target.days},
        {label:'Spaced recall steps',value:row.level,target:target.level}
      ]:[]};
  }
  function help(){
    return [['New','No attempts yet.'],['Learning','Building independent recall. Hints help you learn; unassisted answers build mastery.'],
      ...[2,3].map(stage=>{const r=requirements[stage];return [labels[stage],`At least ${r.attempts} unassisted attempts in the last 12 answers, ${r.accuracy*100}% accuracy, independent recall on ${r.days} days, and ${r.level} spaced recall steps. Return when a review is due to advance the schedule.`];}),
      ['Reading, Writing & Both','Each direction has its own stage. Both reaches Reviewing or Mastered only when both directions do. Speed is shown separately. Earlier practice retains its legacy stage until new recall evidence is recorded.']];
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
    row.recent.push({id,at,quality:independent?2:event.correct?1:0});row.recent=row.recent.slice(-12);
    const next=stage(row),milestone=next>row.peak?next:0;
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
    return chars.filter(kana=>map[kana]?.reviewVersion===1&&map[kana].level>=2&&map[kana].due<=at).sort((a,b)=>map[a].due-map[b].due||a.localeCompare(b));
  }
  return Object.freeze({intervals,labels,requirements,legacyStage,timeMilliseconds,combinedStage,normalize,stage,guidance,help,answer,merge,mergeMaps,due});
});
