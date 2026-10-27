/* Kana curriculum, earned milestones and convergent learning saves. Existing
   trainers own recall evidence; this owner turns that evidence into one path. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.ModeAtlasKanaLearning=factory(root);
})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const KEY='modeAtlasKanaLearning',UPDATED='modeAtlasKanaLearningUpdatedAt';
  const data=root.ModeAtlasKanaData,review=root.ModeAtlasReview;
  const skills=Object.freeze(['reading','writing','handwriting']);
  const names=Object.freeze({reading:'Read',writing:'Recall',both:'Read + Recall',handwriting:'Handwrite'});
  const labels=Object.freeze(['New','Introduced','Learning','Familiar','Confident','Mastered','Mastered+']);
  const requirements=Object.freeze({familiar:Object.freeze({correct:3,accuracy:.8}),handwriting:Object.freeze({3:Object.freeze({correct:1,days:1}),4:Object.freeze({correct:3,days:2}),5:Object.freeze({correct:5,days:3})})});
  const scripts=Object.freeze(['hiragana','katakana']);
  const number=v=>['number','string'].includes(typeof v)&&Number.isFinite(Number(v))?Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(Number(v)))):0;
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const known=new Set(data.collections.all),confusable=new Set(['シ','ツ','ソ','ン','ぬ','め','れ','わ','ね','ク','ケ','タ','ナ','メ']);
  const map=Object.assign({},...Object.values(data.maps));
  const groups=[['base','Basics'],['dakuten','Voiced sounds'],['yoon','Joined sounds'],['extended','Extended sounds']];
  const rows=Object.freeze(scripts.flatMap(script=>{
    const prefix=script==='hiragana'?'h_':'k_';
    const sources={base:data[script+'Rows'],dakuten:data.dakutenRows,yoon:data.yoonRows,extended:script==='katakana'?data.extendedKatakanaRows:{}};
    return groups.flatMap(([group,groupName])=>Object.entries(sources[group]).filter(([key])=>key.startsWith(prefix)).map(([key,items])=>Object.freeze({
      id:script+':'+group+':'+key.slice(2),script,group,groupName,
      name:key.slice(2).replace('_dakuten',' voiced').replace(/^./,c=>c.toUpperCase())+' row',
      chars:Object.freeze(Object.keys(items))
    })));
  }));
  const rowById=new Map(rows.map(row=>[row.id,row]));
  function normalize(input){
    const value=object(input),out={version:1,startedAt:number(value.startedAt),startKind:['beginner','placement','existing'].includes(value.startKind)?value.startKind:'',introduced:{},lessonChecks:{},listeningChecks:{},sounds:{},earned:{},placed:{},handwriting:{},handwritingDays:{},course:normalizeCourse(value.course),updatedAt:number(value.updatedAt)};
    for(const [char,at]of Object.entries(object(value.introduced)).sort())if(known.has(char)&&number(at))out.introduced[char]=number(at);
    for(const field of ['lessonChecks','listeningChecks'])for(const [char,at]of Object.entries(object(value[field])).sort())if(known.has(char)&&number(at))out[field][char]=number(at);
    for(const key of ['sokuon','longVowels','katakanaLength'])if(number(value.sounds?.[key]))out.sounds[key]=number(value.sounds[key]);
    for(const skill of skills){
      out.earned[skill]={};out.placed[skill]={};
      for(const [char,stage]of Object.entries(object(value.earned?.[skill])).sort())if(known.has(char)&&number(stage))out.earned[skill][char]=Math.min(5,number(stage));
      for(const [id,at]of Object.entries(object(value.placed?.[skill])).sort())if(rowById.has(id)&&number(at))out.placed[skill][id]=number(at);
    }
    for(const [char,days]of Object.entries(object(value.handwritingDays)).sort())if(known.has(char)&&Array.isArray(days))out.handwritingDays[char]=[...new Set(days.filter(day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)))].sort().slice(-8);
    for(const [char,items]of Object.entries(object(value.handwriting)).sort()){
      if(!known.has(char)||!Array.isArray(items))continue;
      out.handwriting[char]=[...new Map(items.filter(r=>typeof r?.id==='string'&&/^[a-zA-Z0-9:_-]{1,120}$/.test(r.id)&&number(r.at)).map(r=>[r.id,{id:r.id,at:number(r.at),independent:r.independent===true}])).values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)).slice(-8);
    }
    return out;
  }
  function merge(left,right){
    const a=normalize(left),b=normalize(right);
    if(b.startedAt&&(!a.startedAt||b.startedAt<a.startedAt||b.startedAt===a.startedAt&&b.startKind<a.startKind)){a.startedAt=b.startedAt;a.startKind=b.startKind;}
    for(const [char,at]of Object.entries(b.introduced))a.introduced[char]=Math.min(a.introduced[char]||at,at);
    for(const field of ['lessonChecks','listeningChecks','sounds'])for(const [key,at]of Object.entries(b[field]))a[field][key]=Math.min(a[field][key]||at,at);
    for(const skill of skills){
      for(const [char,stage]of Object.entries(b.earned[skill]))a.earned[skill][char]=Math.max(a.earned[skill][char]||0,stage);
      for(const [id,at]of Object.entries(b.placed[skill]))a.placed[skill][id]=Math.min(a.placed[skill][id]||at,at);
    }
    for(const [char,items]of Object.entries(b.handwriting)){
      const events=new Map((a.handwriting[char]||[]).map(r=>[r.id,r]));
      for(const item of items){const old=events.get(item.id);events.set(item.id,old?{...item,at:Math.min(old.at,item.at),independent:old.independent&&item.independent}:item);}
      a.handwriting[char]=[...events.values()];
    }
    for(const [char,days]of Object.entries(b.handwritingDays))a.handwritingDays[char]=[...new Set([...(a.handwritingDays[char]||[]),...days])];
    a.course=mergeCourse(a.course,b.course);a.updatedAt=Math.max(a.updatedAt,b.updatedAt);return normalize(a);
  }
  function read(){return normalize(root.ModeAtlasStorage?.json(KEY,{}));}
  function save(state){
    const out=normalize(state);out.updatedAt=Date.now();
    if(!root.ModeAtlasStorage.setJSON(KEY,out))throw new Error('Your progress could not be saved. Free some storage and try again.');
    root.ModeAtlasStorage.set(UPDATED,String(out.updatedAt));
    root.KanaCloudSync?.markSectionUpdated?.('kanaLearning');root.KanaCloudSync?.scheduleSync?.(900);
    root.dispatchEvent?.(new root.CustomEvent('modeAtlasKanaLearningChanged'));
    return out;
  }
  function snapshot(){
    const out={};for(const skill of ['reading','writing']){
      out[skill+'Stats']=root.ModeAtlasStorage?.readModeJSON(skill,'charStats',{})||{};
      out[skill+'Review']=root.ModeAtlasStorage?.readModeJSON(skill,'srs',{})||{};
      out[skill+'Times']=root.ModeAtlasStorage?.readModeJSON(skill,'charTimes',{})||{};
    }return out;
  }
  function handwritingEvidence(char,state){
    const entries=state.handwriting[char]||[],independent=entries.filter(r=>r.independent),days=new Set([...(state.handwritingDays[char]||[]),...independent.map(r=>root.ModeAtlasDates.localDateKey(new Date(r.at)))]);
    return {attempts:entries.length,correct:independent.length,days:days.size};
  }
  function familiarEvidence(srs,stats,time){
    const recent=review.normalize(srs,stats,time).recent.filter(r=>r.quality!==1),correct=recent.filter(r=>r.quality===2).length;
    return {correct,accuracy:correct/Math.max(1,recent.length)};
  }
  function currentStage(char,skill,evidence,state){
    if(skill==='handwriting'){
      const evidence=handwritingEvidence(char,state);
      for(const next of [5,4,3]){const target=requirements.handwriting[next];if(evidence.correct>=target.correct&&evidence.days>=target.days)return next;}
      return evidence.attempts?2:state.introduced[char]?1:0;
    }
    const stats=evidence[skill+'Stats']?.[char]||{},srs=evidence[skill+'Review']?.[char],time=evidence[skill+'Times']?.[char];
    const stage=review.stage(srs,stats,time),attempts=number(stats.correct)+number(stats.wrong);
    if(stage===3)return 5;if(stage===2)return 4;
    const recent=familiarEvidence(srs,stats,time),course=state.course.records[skill+':'+char]||[];
    const independent=course.filter(r=>!r.assisted);if(independent.filter(r=>r.correct).length>=3&&independent.filter(r=>r.correct).length/Math.max(1,independent.length)>=.8)return 3;
    if(recent.correct>=requirements.familiar.correct&&recent.accuracy>=requirements.familiar.accuracy)return 3;
    return attempts?2:state.introduced[char]?1:0;
  }
  function earned(char,skill,state,evidence){return Math.max(state.earned[skill]?.[char]||0,currentStage(char,skill,evidence,state));}
  function stage(char,state=read(),evidence=snapshot()){
    const a=earned(char,'reading',state,evidence),b=earned(char,'writing',state,evidence),h=earned(char,'handwriting',state,evidence);
    if(a===5&&b===5)return h===5?6:5;
    if(a>=3&&b>=3&&Math.max(a,b)>=4)return 4;
    if(a>=3||b>=3)return 3;
    return Math.max(a,b,Math.min(2,h));
  }
  function capture(state,evidence=snapshot()){
    for(const skill of skills)for(const char of data.collections.all){const n=earned(char,skill,state,evidence);if(n)state.earned[skill][char]=n;}
    return state;
  }
  function hasEvidence(evidence){return ['reading','writing'].some(skill=>Object.values(evidence[skill+'Stats']||{}).some(r=>number(r.correct)+number(r.wrong)>0));}
  function initialize(){
    const state=read(),evidence=snapshot();if(state.startedAt)return state;
    if(!hasEvidence(evidence))return state;
    state.startedAt=Date.now();state.startKind='existing';capture(state,evidence);
    // Old counters cannot establish unassisted recall. They can preserve access
    // to rows a learner has already studied without inventing mastery evidence.
    for(const skill of ['reading','writing'])for(const row of rows){
      if(row.chars.some(char=>number(evidence[skill+'Stats'][char]?.correct)+number(evidence[skill+'Stats'][char]?.wrong)>0))state.placed[skill][row.id]=state.startedAt;
    }
    return save(state);
  }
  function start(kind='beginner'){
    const state=initialize();if(!state.startedAt){state.startedAt=Date.now();state.startKind=kind==='placement'?'placement':'beginner';save(state);}return state;
  }
  function rowComplete(row,skill,state,evidence){return (skill!=='handwriting'&&!!state.course.passed[row.id])||!!state.placed[skill][row.id]||row.chars.every(char=>earned(char,skill,state,evidence)>=3);}
  function path(script,skill,state=read(),evidence=snapshot()){
    if(skill==='both'){
      const recall=path(script,'writing',state,evidence);
      return path(script,'reading',state,evidence).map((row,i)=>({...row,unlocked:row.unlocked&&recall[i].unlocked,complete:row.complete&&recall[i].complete,ready:Math.min(row.ready,recall[i].ready)}));
    }
    const sequence=rows.filter(row=>row.script===script),lastPlaced=sequence.reduce((last,row,i)=>state.placed[skill][row.id]?i:last,-1);
    let previous=true;
    return sequence.map((row,i)=>{
      const unlocked=i===0||i<=lastPlaced+1||previous,complete=rowComplete(row,skill,state,evidence);
      previous=unlocked&&complete;
      return {...row,unlocked,complete,ready:row.chars.filter(char=>earned(char,skill,state,evidence)>=3).length};
    });
  }
  function available(skill,state=read(),evidence=snapshot()){
    return new Set(scripts.flatMap(script=>path(script,skill,state,evidence).filter(row=>row.unlocked||(skill==='handwriting'&&row.chars.every(c=>seen(c,state,evidence)))).flatMap(row=>row.chars)));
  }
  function testScripts(skill,state=read(),evidence=snapshot()){
    return scripts.filter(script=>path(script,skill,state,evidence).filter(row=>row.group==='base').every(row=>row.complete));
  }
  function selection(settings,skill,state=read(),evidence=snapshot()){
    const allowed=available(settings.kanaDirection==='both'?'both':skill,state,evidence),ids=Array.isArray(settings.kanaRows)?settings.kanaRows:[];
    const selected=Array.isArray(settings.kanaRows)?ids.filter(id=>rowById.has(id)).flatMap(id=>rowById.get(id).chars):Object.keys(data.selectedKanaMap(settings));
    return Object.fromEntries([...new Set(selected)].filter(char=>allowed.has(char)&&(!settings.confusableKana||confusable.has(char))).map(char=>[char,map[char]]));
  }
  function testPool(settings,skill,state=read(),evidence=snapshot()){
    const eligible=testScripts(skill,state,evidence),requested=settings.kanaTestScript;
    const chosen=eligible.includes(requested)?[requested]:requested==='both'?eligible:eligible.slice(0,1);
    return Object.fromEntries(chosen.flatMap(script=>path(script,skill,state,evidence).filter(row=>row.group==='base'||settings.kanaTestExtended&&row.unlocked).flatMap(row=>row.chars)).map(char=>[char,map[char]]));
  }
  function seen(char,state=read(),evidence=snapshot()){
    return !!state.introduced[char]||!!state.lessonChecks[char]||['reading','writing'].some(skill=>earned(char,skill,state,evidence)>0||rows.some(row=>row.chars.includes(char)&&state.placed[skill][row.id]));
  }
  function learnedPool(skill='reading',state=read(),evidence=snapshot()){
    return [...available(skill,state,evidence)].filter(char=>seen(char,state,evidence));
  }
  function journey(script='hiragana',state=read(),evidence=snapshot()){
    const readPath=path(script,'reading',state,evidence),recallPath=path(script,'writing',state,evidence);
    const index=readPath.findIndex((row,i)=>!row.complete||!recallPath[i].complete),row=readPath[index<0?readPath.length-1:index];
    const introduced=row.chars.filter(char=>seen(char,state,evidence)).length;
    const phase=index<0?'complete':introduced<row.chars.length?'learn':!row.complete?'reading':'writing';
    return {row,phase,introduced,total:row.chars.length,readReady:row.ready,recallReady:recallPath[index<0?readPath.length-1:index].ready,pool:learnedPool('reading',state,evidence)};
  }
  function completeLessonCharacter(char,{listened=false}={}){
    if(!known.has(char))return false;const state=start(),at=Date.now();
    state.introduced[char] ||= at;state.lessonChecks[char] ||= at;if(listened)state.listeningChecks[char] ||= at;
    save(state);return true;
  }
  function introduceSound(id){
    if(!['sokuon','longVowels','katakanaLength'].includes(id))return false;const state=start();state.sounds[id] ||= Date.now();save(state);return true;
  }
  function recordRecall(skill,char,evidence,track=true){
    if(!['reading','writing'].includes(skill)||!known.has(char))return;
    const state=read();if(!state.startedAt){state.startedAt=Date.now();state.startKind='existing';}
    const combinedBefore=stage(char,state,{}),before=state.earned[skill][char]||0,next=earned(char,skill,state,evidence);
    if(next>before){state.earned[skill][char]=next;save(state);if(track)root.ModeAtlasProgress?.recordKanaMilestone(char,stage(char,state,{}),combinedBefore,Date.now(),{deferAwards:true});}
  }
  function introduce(char){if(!known.has(char))return;const state=start();if(!state.introduced[char]){state.introduced[char]=Date.now();save(state);}}
  function place(skill,rowId){
    const state=start('placement');if(!['reading','writing'].includes(skill)||!rowById.has(rowId))return;
    if(!state.placed[skill][rowId]){state.placed[skill][rowId]=Date.now();save(state);}
  }
  function recordHandwriting(char,event){
    if(!known.has(char)||!event?.id||!number(event.at))return false;
    const state=start();if(!available('handwriting',state).has(char))return false;
    const before=stage(char,state,{}),entries=state.handwriting[char]||=[];if(entries.some(r=>r.id===event.id))return false;
    entries.push({id:event.id,at:event.at,independent:event.mode==='write'&&!event.assisted&&event.errors===0});
    if(event.mode==='write'&&!event.assisted&&event.errors===0)state.handwritingDays[char]=[...(state.handwritingDays[char]||[]),root.ModeAtlasDates.localDateKey(new Date(event.at))];
    state.earned.handwriting[char]=Math.max(state.earned.handwriting[char]||0,currentStage(char,'handwriting',{},state));
    root.ModeAtlasStorage.transaction(()=>{save(state);root.ModeAtlasProgress?.recordKanaMilestone(char,stage(char,state,{}),before,event.at);root.ModeAtlasProgress?.recordHabit?.({branch:'handwriting',id:event.id,at:event.at});});
    root.ModeAtlasVisitFlows?.recordActivity('handwriting');return true;
  }
  function details(char,state=read(),evidence=snapshot()){
    return {stage:stage(char,state,evidence),skills:skills.map(skill=>{
      const achieved=earned(char,skill,state,evidence),current=currentStage(char,skill,evidence,state),r=evidence[skill+'Review']?.[char];
      return {skill,name:names[skill],stage:achieved,current,review:skill!=='handwriting'&&(current<achieved||!!r?.due&&r.due<=Date.now()),due:r?.due||0};
    })};
  }
  function guidance(char,skill,state=read(),evidence=snapshot()){
    const achieved=earned(char,skill,state,evidence),target=Math.min(5,Math.max(3,achieved+1));
    let checks,legacy=false,due=0;
    if(skill==='handwriting'){
      const values=handwritingEvidence(char,state),goal=requirements.handwriting[target];
      checks=[{id:'independent',label:'Clean writes without a guide',value:values.correct,target:goal.correct},{id:'days',label:'Different study days',value:values.days,target:goal.days}];
    }else if(target===3){
      const values=familiarEvidence(evidence[skill+'Review']?.[char],evidence[skill+'Stats']?.[char],evidence[skill+'Times']?.[char]);
      checks=[{id:'recent-correct',label:'Recent unassisted correct',value:values.correct,target:requirements.familiar.correct},{id:'recent-accuracy',label:'Recent unassisted accuracy',value:values.accuracy*100,target:requirements.familiar.accuracy*100,percent:true}];
    }else{
      const guide=review.guidance(evidence[skill+'Review']?.[char],evidence[skill+'Stats']?.[char],evidence[skill+'Times']?.[char],target-2);
      checks=guide.checks;legacy=guide.legacy;due=guide.due;
    }
    return {achieved,target,label:labels[target],legacy,due,checks:checks.map(check=>({...check,met:Object.hasOwn(check,'met')?check.met:check.value>=check.target}))};
  }
  // Guided teaching is a resumable curriculum, separate from the custom trainer.
  // Existing introduced/placed/mastery values are never relabelled as new checks.
  const courseKinds=['teach','match','read','recall','listen','patternTeach','patternListen','patternApply'];
  const patternIds=['longVowels','sokuon','katakanaLength'];
  function normalizeCourse(input){
    const v=object(input),out={version:1,startedAt:number(v.startedAt),legacyEligible:v.legacyEligible===true,legacyLongVowels:v.legacyLongVowels===true,script:scripts.includes(v.script)?v.script:'hiragana',passed:{},checkpoints:{},patternListening:{},records:{},session:null,updatedAt:number(v.updatedAt)};
    for(const [id,at]of Object.entries(object(v.passed)).sort())if(rowById.has(id)&&number(at))out.passed[id]=number(at);
    for(const [id,at]of Object.entries(object(v.checkpoints)).sort())if(/^(hiragana|katakana):[0-9]{1,2}$/.test(id)&&number(at))out.checkpoints[id]=number(at);
    for(const id of patternIds)if(number(v.patternListening?.[id]))out.patternListening[id]=number(v.patternListening[id]);
    for(const [key,records]of Object.entries(object(v.records)).sort()){
      const [skill,char]=key.split(':');if(!['reading','writing','listening'].includes(skill)||!known.has(char)||!Array.isArray(records))continue;
      out.records[key]=[...new Map(records.filter(r=>typeof r?.id==='string'&&/^[a-zA-Z0-9:_-]{1,100}$/.test(r.id)&&number(r.at)).map(r=>[r.id,{id:r.id,at:number(r.at),correct:r.correct===true,assisted:r.assisted===true,phase:['practice','check','review'].includes(r.phase)?r.phase:'practice'}])).values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)).slice(-12);
    }
    const c=object(v.session);
    if(typeof c.id==='string'&&/^[a-zA-Z0-9:_-]{1,90}$/.test(c.id)&&typeof c.owner==='string'&&/^[a-zA-Z0-9:_-]{1,128}$/.test(c.owner)&&scripts.includes(c.script)&&['lesson','check','review','checkpoint','pattern'].includes(c.kind)&&Array.isArray(c.queue)&&c.queue.length>0&&c.queue.length<=220){
      const queue=c.queue.map(t=>({kind:t.kind,char:known.has(t.char)?t.char:'',choices:Array.isArray(t.choices)?t.choices.filter(x=>typeof x==='string'&&x.length<=80&&(String(t.kind).startsWith('pattern')||known.has(x))).slice(0,6):[],supported:t.supported===true,repair:t.repair===true,pattern:patternIds.includes(t.pattern)?t.pattern:'',taskId:typeof t.taskId==='string'?t.taskId.slice(0,80):''}));
      if(queue.every(t=>courseKinds.includes(t.kind)&&(t.kind.startsWith('pattern')?t.pattern:!!t.char))&&Number.isInteger(c.index)&&c.index>=0&&c.index<=queue.length){
        out.session={id:c.id,owner:c.owner,script:c.script,kind:c.kind,unit:rowById.has(c.unit)||patternIds.includes(c.unit)||/^(hiragana|katakana):[0-9]{1,2}$/.test(c.unit)?c.unit:'',chars:Array.isArray(c.chars)?c.chars.filter(x=>known.has(x)).slice(0,60):[],queue,index:c.index,startedAt:number(c.startedAt),complete:c.complete===true,passed:c.passed===true,audioSkipped:c.audioSkipped===true,helped:c.helped===true,feedback:null,results:[]};
        if(c.feedback&&typeof c.feedback.correct==='boolean')out.session.feedback={correct:c.feedback.correct,skipped:c.feedback.skipped===true,answer:String(c.feedback.answer||'').slice(0,80),assisted:c.feedback.assisted===true};
        if(Array.isArray(c.results))out.session.results=c.results.filter(r=>Number.isInteger(r.index)&&r.index>=0&&r.index<queue.length).map(r=>({index:r.index,correct:r.correct===true,assisted:r.assisted===true,skipped:r.skipped===true})).slice(-220);
      }
    }
    return out;
  }
  function mergeCourse(left,right){
    const a=normalizeCourse(left),b=normalizeCourse(right),winner=a.updatedAt>b.updatedAt||a.updatedAt===b.updatedAt&&JSON.stringify(a)>=JSON.stringify(b)?a:b;
    const out={...winner,startedAt:Math.min(a.startedAt||Infinity,b.startedAt||Infinity),legacyEligible:a.legacyEligible||b.legacyEligible,legacyLongVowels:a.legacyLongVowels||b.legacyLongVowels,passed:{...a.passed},checkpoints:{...a.checkpoints},patternListening:{...a.patternListening},records:{...a.records}};
    if(!Number.isFinite(out.startedAt))out.startedAt=0;
    for(const field of ['passed','checkpoints','patternListening'])for(const [id,at]of Object.entries(b[field]))out[field][id]=Math.min(out[field][id]||at,at);
    for(const [key,rs]of Object.entries(b.records)){const records=new Map((a.records[key]||[]).map(r=>[r.id,r]));for(const r of rs){const old=records.get(r.id);records.set(r.id,old?{...r,at:Math.min(old.at,r.at),correct:old.correct&&r.correct,assisted:old.assisted||r.assisted}:r);}out.records[key]=[...records.values()];}
    return normalizeCourse(out);
  }
  const courseOwner=()=>root.KanaCloudSync?.getUser?.()?.uid||root.ModeAtlasStorage?.get('modeAtlasLastUserId','guest')||'guest';
  const shuffle=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  function patterns(){return root.ModeAtlasKanaCoaching?.patterns?.()||[];}
  function patternTask(task){const pattern=patterns().find(p=>p.id===task.pattern);return task.kind==='patternTeach'?pattern:pattern?.tasks.find(t=>t.id===task.taskId);}
  function courseStatus(script='hiragana',state=read(),evidence=snapshot()){
    const base=rows.filter(r=>r.script===script&&r.group==='base'),checkedRows=base.filter(r=>state.course.passed[r.id]).length;
    const legacyEligible=state.course.startedAt?state.course.legacyEligible:base.filter(r=>r.script==='hiragana'&&r.chars.every(c=>earned(c,'reading',state,evidence)>=3)).length>=3;
    const checkpointAt=state.course.checkpoints['hiragana:3']||0;
    return {startedAt:state.course.startedAt,checkedRows,checkpointAt,legacyEligible,kanjiReady:!!checkpointAt||legacyEligible};
  }
  function courseRows(script,state=read(),evidence=snapshot()){
    const rp=path(script,'reading',state,evidence),wp=path(script,'writing',state,evidence);
    return rp.map((r,i)=>({...r,checked:!!state.course.passed[r.id],established:rp[i].complete&&wp[i].complete,encountered:r.chars.filter(c=>seen(c,state,evidence)).length}));
  }
  function repairCourse(state=read()){
    return [...new Set(Object.entries(state.course.records).filter(([key,events])=>!key.startsWith('listening:')&&events.filter(e=>!e.assisted).at(-1)?.correct===false).map(([key])=>key.split(':')[1]))];
  }
  function dueCourse(state=read()){
    const evidence=snapshot(),due=['reading','writing'].flatMap(skill=>review.due(evidence[skill+'Review']).filter(c=>seen(c,state,evidence)));
    return [...new Set([...due,...Object.entries(state.course.records).filter(([key,events])=>!key.startsWith('listening:')&&events.length&&Date.now()-events.at(-1).at>=86400000).map(([key])=>key.split(':')[1])])];
  }
  function nextAction(alphabet){
    const state=read(),active=state.course.session,script=scripts.includes(alphabet)?alphabet:active?.script||state.course.script;
    const href='/kana/?'+new URLSearchParams({view:'course',script});
    if(active&&!active.complete&&active.owner===courseOwner()&&active.script===script)return {kind:'resume',title:active.kind==='pattern'?'Continue your sound lesson':'Continue your '+(rowById.get(active.unit)?.name||'review'),label:'Continue session',detail:`${active.index} of ${active.queue.length} tasks completed`,href,row:rowById.get(active.unit)};
    if(active?.complete&&!active.passed&&active.owner===courseOwner()&&active.script===script){
      if(active.kind==='check')return {kind:'check',row:rowById.get(active.unit),title:'Check your '+rowById.get(active.unit)?.name+' again',label:'Try a fresh row check',detail:'Your practice is saved. Check each reading and shape without help.',href};
      if(active.kind==='checkpoint')return {kind:'checkpoint',unit:active.unit,title:'Try your checkpoint again',label:'Try a fresh checkpoint',detail:'A new mixed set, without the correction prompts.',href};
      if(active.kind==='pattern')return {kind:'pattern',unit:active.unit,title:'Try '+(patterns().find(p=>p.id===active.unit)?.title.toLowerCase()||'this sound pattern')+' again',label:'Try the sound lesson again',detail:'Hear the contrast, then use the spelling.',href};
    }
    const course=courseRows(script,state),base=course.filter(r=>r.group==='base');
    const repairs=repairCourse(state).filter(c=>course.some(r=>r.chars.includes(c))).slice(0,8);
    if(repairs.length)return {kind:'review',chars:repairs,title:'Practise the tricky characters',label:`Revisit ${repairs.length} kana`,detail:'A short set for the readings and shapes that need another look.',href};
    for(const count of [3,6,10])if(base.slice(0,count).every(r=>r.checked)&&!state.course.checkpoints[script+':'+count])return {kind:'checkpoint',unit:script+':'+count,title:count===3?'Your first three rows':`Check your ${count} rows`,label:'Start checkpoint',detail:'Read and recall the characters together.',href};
    const pattern=patterns().find(p=>!state.sounds[p.id]&&p.prerequisites.every(c=>seen(c,state)&&course.some(r=>r.established&&r.chars.includes(c)))&&(p.id==='katakanaLength'?script==='katakana':script==='hiragana'));
    if(pattern)return {kind:'pattern',unit:pattern.id,title:pattern.title,label:'Learn '+pattern.title.toLowerCase(),detail:'Hear the contrast, then use the spelling.',href};
    const due=dueCourse(state).filter(c=>course.some(r=>r.chars.includes(c))).slice(0,8);
    if(due.length)return {kind:'review',chars:due,title:'Keep your kana fresh',label:`Review ${due.length} kana`,detail:'A short mixed set from previous lessons.',href};
    const row=course.find(r=>!r.established);
    if(!row)return {kind:'complete',title:script==='hiragana'?'Hiragana course checked':'Katakana course checked',label:'Practise your kana',detail:'Keep reviewing, or explore another branch.',href:'/kana/?view=practice&script='+script};
    const unseen=row.chars.filter(c=>!seen(c,state)),chars=unseen.slice(0,3);
    return {kind:chars.length?'lesson':'check',row,chars,title:chars.length?`Learn ${chars.join(' · ')}`:`Check your ${row.name}`,label:chars.length?'Start lesson':'Start row check',detail:chars.length?`${row.name} · shape, sound and practice`:'Read and recall every character without hints.',href};
  }
  function makeTask(kind,char,pool,supported=false){return {kind,char,choices:shuffle([char,...shuffle(pool.filter(c=>c!==char&&(map[c]==='wo'?'o':map[c])!==(map[char]==='wo'?'o':map[char]))).slice(0,kind==='match'?2:4)]),supported,repair:false,pattern:'',taskId:''};}
  function taskTarget(task){if(!task)return '';return task.kind.startsWith('pattern')?(patternTask(task)?.audio||patternTask(task)?.answer||''):(['を','ヲ'].includes(task.char)?'o':map[task.char]||task.char);}
  function noRepeatedTargets(tasks,previous='',pool=[]){
    const rest=[...tasks],out=[],all=[...new Set([...pool,...tasks.map(t=>t.char).filter(Boolean)])];
    while(rest.length){
      const counts=new Map();for(const t of rest)counts.set(taskTarget(t),(counts.get(taskTarget(t))||0)+1);
      let choices=rest.map((t,i)=>({t,i})).filter(({t})=>taskTarget(t)!==previous);
      if(!choices.length){
        const other=all.find(char=>taskTarget({kind:'read',char})!==previous);
        if(other){out.push(makeTask('read',other,all));previous=taskTarget({kind:'read',char:other});continue;}
        // Pattern retries use a different authored application as an intervening task.
        const pending=rest[0],pattern=patterns().find(p=>p.id===pending.pattern),filler=pattern?.tasks.find(t=>t.kind==='apply'&&t.answer!==previous);
        if(filler){out.push({kind:'patternApply',pattern:pending.pattern,taskId:filler.id,char:'',choices:shuffle(filler.options),supported:false,repair:true});previous=filler.answer;continue;}
        choices=[{t:rest[0],i:0}];
      }
      choices.sort((a,b)=>counts.get(taskTarget(b.t))-counts.get(taskTarget(a.t)));
      const chosen=choices[0];out.push(rest.splice(chosen.i,1)[0]);previous=taskTarget(chosen.t);
    }
    return out;
  }
  function beginCourse({script,unit,kind}={}){
    let state=start(),c=state.course;
    if(c.session&&!c.session.complete&&c.session.owner===courseOwner()&&!unit&&(!script||c.session.script===script))return c.session;
    script=scripts.includes(script)?script:c.script;
    if(!c.startedAt){c.legacyEligible=courseStatus('hiragana',state).legacyEligible;c.legacyLongVowels=!!state.sounds.longVowels;c.startedAt=Date.now();}
    c.script=script;
    if(unit&&rowById.has(unit)&&!courseRows(script,state).some(r=>r.id===unit&&(r.unlocked||r.established)))return null;
    const action=unit&&rowById.has(unit)?{kind:kind||'lesson',row:rowById.get(unit),chars:rowById.get(unit).chars.filter(ch=>!seen(ch,state)).slice(0,3)}:nextAction(script);
    if(unit&&patternIds.includes(unit)){action.kind='pattern';action.unit=unit;}
    if(kind==='review'){action.kind='review';action.chars=dueCourse(state).slice(0,8);if(!action.chars.length)action.chars=learnedPool('reading',state).slice(0,8);}
    if(action.kind==='resume')return c.session;
    if(action.kind==='complete')return null;
    let chars=action.chars||action.row?.chars||[],queue=[];
    const previous=rows.filter(r=>r.script===script).flatMap(r=>r.chars).filter(ch=>seen(ch,state));
    if(action.kind==='lesson'){
      if(!chars.length)chars=action.row.chars.slice(0,3);
      const pool=[...new Set([...chars,...previous])];
      for(const char of chars)queue.push(makeTask('teach',char,[]));
      for(const char of shuffle(chars))queue.push(makeTask('match',char,pool,true));
      const practiceChars=[...new Set([...chars,...shuffle(previous).slice(0,Math.max(0,2-chars.length))])];
      const independent=shuffle(practiceChars).flatMap(char=>[makeTask('read',char,pool),makeTask('recall',char,pool),makeTask('listen',char,pool)]);
      queue.push(...noRepeatedTargets(independent,taskTarget(queue.at(-1)),pool));
    }else if(action.kind==='pattern'){
      const p=patterns().find(p=>p.id===action.unit);if(!p||!p.prerequisites.every(ch=>seen(ch,state)))return null;
      queue=[{kind:'patternTeach',pattern:p.id,taskId:'',char:'',choices:[],supported:true},...noRepeatedTargets(shuffle(p.tasks).map(t=>({kind:t.kind==='listen'?'patternListen':'patternApply',pattern:p.id,taskId:t.id,char:'',choices:shuffle(t.options),supported:false})),p.teaching.at(-1)?.audio||'')];
    }else{
      if(action.kind==='checkpoint'){const count=Number(action.unit.split(':')[1]);chars=rows.filter(r=>r.script===script&&r.group==='base').slice(0,count).flatMap(r=>r.chars);}
      chars=chars.length?chars:action.row.chars;
      const pool=[...new Set([...chars,...previous])];
      queue=noRepeatedTargets(shuffle(chars.flatMap(char=>[makeTask('read',char,pool),makeTask('recall',char,pool)])));
      // Listening targets are mixed independently; silent study never fails a row.
      queue.push(...noRepeatedTargets(shuffle(chars).slice(0,3).map(char=>makeTask('listen',char,pool)),taskTarget(queue.at(-1)),pool));
    }
    c.session={id:'course-'+(root.crypto?.randomUUID?.()||Date.now()),owner:courseOwner(),script,unit:action.unit||action.row?.id||'',kind:action.kind,chars,queue,index:0,startedAt:Date.now(),complete:false,passed:false,feedback:null,helped:false,results:[],audioSkipped:false};
    c.updatedAt=Math.max(Date.now(),c.updatedAt+1);save(state);return read().course.session;
  }
  function courseSession(){const c=read().course.session;return c?.owner===courseOwner()?c:null;}
  function helpCourse(){const state=read(),s=state.course.session;if(!s||s.owner!==courseOwner()||s.feedback||s.complete)return;s.helped=true;state.course.updatedAt=Math.max(Date.now(),state.course.updatedAt+1);save(state);}
  function answerCourse(value,options={}){return root.ModeAtlasStorage.transaction(()=>answerCourseTransaction(value,options));}
  function answerCourseTransaction(value,{played=false,skipAudio=false}={}){
    const state=read(),s=state.course.session;if(!s||s.owner!==courseOwner()||s.complete||s.feedback)return false;
    const task=s.queue[s.index],audio=['listen','patternListen'].includes(task.kind),teaching=['teach','patternTeach'].includes(task.kind);
    if(audio&&!played&&!skipAudio)return false;
    const p=task.kind.startsWith('pattern')?patternTask(task):null;
    const correct=teaching||skipAudio?false:task.kind==='read'?root.ModeAtlasKanaCoaching.matches(task.char,value):p?String(value)===String(p.answer):String(value)===task.char;
    const assisted=task.supported||task.repair||s.helped;
    s.feedback={correct,skipped:skipAudio,answer:String(value||'').slice(0,80),assisted};
    s.results.push({index:s.index,correct,assisted,skipped:skipAudio});
    if(skipAudio)s.audioSkipped=true;
    if(task.kind==='teach')state.introduced[task.char] ||= Date.now();
    if(!teaching&&!skipAudio&&task.char){
      const direction=task.kind==='read'?'reading':task.kind==='listen'?'listening':'writing',key=direction+':'+task.char;
      const records=state.course.records[key]||=[];records.push({id:s.id+':'+s.index,at:Date.now(),correct,assisted,phase:s.kind==='review'?'review':['check','checkpoint'].includes(s.kind)?'check':'practice'});
      if(direction!=='listening'){
        const stats=root.ModeAtlasStorage.readModeJSON(direction,'charStats',{}),srs=root.ModeAtlasStorage.readModeJSON(direction,'srs',{});
        const prior=stats[task.char]||{correct:0,wrong:0};stats[task.char]={...prior,correct:number(prior.correct)+Number(correct),wrong:number(prior.wrong)+Number(!correct)};
        srs[task.char]=review.answer(srs[task.char],{id:s.id+':'+s.index,at:Date.now(),correct,assisted},stats[task.char]).entry;
        if(!root.ModeAtlasStorage.writeModeJSON(direction,'charStats',stats)||!root.ModeAtlasStorage.writeModeJSON(direction,'srs',srs))throw new Error('Your practice could not be saved. Try again.');
        root.KanaCloudSync?.markSectionUpdated?.(direction);
      }
      if(direction==='listening'&&correct&&!assisted)state.listeningChecks[task.char] ||= Date.now();
    }
    if(!teaching&&!skipAudio&&!task.repair&&!task.supported&&['read','recall','listen','patternApply','patternListen'].includes(task.kind))root.ModeAtlasProgress?.recordHabit?.({branch:'kana',id:s.id+':'+s.index,at:Date.now()});
    if(!teaching&&!skipAudio&&(!correct||s.helped)&&!task.repair){
      // A correction is not another guess. Revisit after two different tasks.
      const retry={...task,choices:shuffle(task.choices),supported:false,repair:true};
      const tail=s.queue.slice(s.index+1),gap=tail.findIndex((t,i)=>i>=1&&t.char!==task.char);
      if(gap>=1)s.queue.splice(s.index+gap+2,0,retry);
      else {const fillers=shuffle(s.chars.filter(ch=>ch!==task.char)).slice(0,2).map(ch=>makeTask('read',ch,s.chars));s.queue.push(...fillers,retry);}
      const remaining=noRepeatedTargets(s.queue.slice(s.index+1),taskTarget(task),[...s.chars,...learnedPool('reading',state)]);s.queue.splice(s.index+1,s.queue.length-s.index-1,...remaining);
    }
    capture(state);state.course.updatedAt=Math.max(Date.now(),state.course.updatedAt+1);save(state);root.ModeAtlasVisitFlows?.recordActivity('kana');return s.feedback;
  }
  function advanceCourse(){
    const state=read(),s=state.course.session;if(!s||s.owner!==courseOwner()||!s.feedback||s.complete)return s;
    s.index++;s.feedback=null;s.helped=false;
    if(s.index>=s.queue.length){
      s.complete=true;
      const independent=s.results.filter(r=>r.correct&&!r.assisted&&!r.skipped&&!s.queue[r.index].repair).map(r=>s.queue[r.index]);
      // A correction can teach the answer, but it cannot retroactively pass an
      // assessment. Only the original response to each required item counts.
      const checked=(char,kind)=>{const first=s.results.find(r=>s.queue[r.index].char===char&&s.queue[r.index].kind===kind&&!s.queue[r.index].repair);return !!first&&first.correct&&!first.assisted&&!first.skipped;};
      s.passed=s.kind==='lesson'||s.kind==='review'||s.kind==='pattern'?s.kind!=='pattern'||patterns().find(p=>p.id===s.unit)?.tasks.filter(t=>t.kind!=='listen').every(t=>independent.some(q=>q.taskId===t.id)):s.chars.every(char=>['read','recall'].every(kind=>checked(char,kind)));
      if(s.kind==='check'&&s.passed){state.course.passed[s.unit] ||= Date.now();for(const char of s.chars)state.lessonChecks[char] ||= Date.now();}
      if(s.kind==='checkpoint'&&s.passed)state.course.checkpoints[s.unit] ||= Date.now();
      if(s.kind==='pattern'&&s.passed){state.sounds[s.unit] ||= Date.now();const listening=patterns().find(p=>p.id===s.unit)?.tasks.filter(t=>t.kind==='listen')||[];if(listening.length&&listening.every(t=>independent.some(q=>q.taskId===t.id)))state.course.patternListening[s.unit] ||= Date.now();}
    }
    state.course.updatedAt=Math.max(Date.now(),state.course.updatedAt+1);save(state);return read().course.session;
  }
  function leaveCourse(){root.ModeAtlasPronunciation?.stop?.();}
  function practiceUrl(skill,chars=[],extra={}){
    const target=chars.filter(char=>available(skill).has(char));
    if(skill==='handwriting')return '/kana/handwriting/'+(target.length?'?kana='+encodeURIComponent(target[0]):'');
    return '/'+(skill==='writing'?'writing':'reading')+'/?'+new URLSearchParams({practice:'20',...(target.length?{kana:target.join(',')}:{}),...extra});
  }
  return Object.freeze({KEY,UPDATED,skills,names,labels,requirements,scripts,confusable,rows,rowById,map,normalize,merge,read,save,snapshot,currentStage,earned,stage,capture,initialize,start,path,available,testScripts,selection,testPool,seen,learnedPool,journey,completeLessonCharacter,introduceSound,recordRecall,introduce,place,recordHandwriting,details,guidance,practiceUrl,normalizeCourse,mergeCourse,patterns,patternTask,courseStatus,courseRows,dueCourse,repairCourse,taskTarget,nextAction,beginCourse,courseSession,helpCourse,answerCourse,advanceCourse,leaveCourse});
});
