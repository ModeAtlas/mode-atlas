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
  const names=Object.freeze({reading:'Read',writing:'Recall',handwriting:'Handwrite'});
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
    const value=object(input),out={version:1,startedAt:number(value.startedAt),startKind:['beginner','placement','existing'].includes(value.startKind)?value.startKind:'',introduced:{},earned:{},placed:{},handwriting:{},handwritingDays:{},updatedAt:number(value.updatedAt)};
    for(const [char,at]of Object.entries(object(value.introduced)).sort())if(known.has(char)&&number(at))out.introduced[char]=number(at);
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
    a.updatedAt=Math.max(a.updatedAt,b.updatedAt);return normalize(a);
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
    const recent=familiarEvidence(srs,stats,time);
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
  function rowComplete(row,skill,state,evidence){return !!state.placed[skill][row.id]||row.chars.every(char=>earned(char,skill,state,evidence)>=3);}
  function path(script,skill,state=read(),evidence=snapshot()){
    const sequence=rows.filter(row=>row.script===script),lastPlaced=sequence.reduce((last,row,i)=>state.placed[skill][row.id]?i:last,-1);
    let previous=true;
    return sequence.map((row,i)=>{
      const unlocked=i===0||i<=lastPlaced+1||previous,complete=rowComplete(row,skill,state,evidence);
      previous=unlocked&&complete;
      return {...row,unlocked,complete,ready:row.chars.filter(char=>earned(char,skill,state,evidence)>=3).length};
    });
  }
  function available(skill,state=read(),evidence=snapshot()){
    return new Set(scripts.flatMap(script=>path(script,skill,state,evidence).filter(row=>row.unlocked).flatMap(row=>row.chars)));
  }
  function testScripts(skill,state=read(),evidence=snapshot()){
    return scripts.filter(script=>path(script,skill,state,evidence).filter(row=>row.group==='base').every(row=>row.unlocked));
  }
  function selection(settings,skill,state=read(),evidence=snapshot()){
    const allowed=available(skill,state,evidence),ids=Array.isArray(settings.kanaRows)?settings.kanaRows:[];
    const selected=Array.isArray(settings.kanaRows)?ids.filter(id=>rowById.has(id)).flatMap(id=>rowById.get(id).chars):Object.keys(data.selectedKanaMap(settings));
    return Object.fromEntries([...new Set(selected)].filter(char=>allowed.has(char)&&(!settings.confusableKana||confusable.has(char))).map(char=>[char,map[char]]));
  }
  function testPool(settings,skill,state=read(),evidence=snapshot()){
    const eligible=testScripts(skill,state,evidence),requested=settings.kanaTestScript;
    const chosen=eligible.includes(requested)?[requested]:requested==='both'?eligible:eligible.slice(0,1);
    return Object.fromEntries(chosen.flatMap(script=>path(script,skill,state,evidence).filter(row=>row.group==='base'||settings.kanaTestExtended&&row.unlocked).flatMap(row=>row.chars)).map(char=>[char,map[char]]));
  }
  function recordRecall(skill,char,evidence){
    if(!['reading','writing'].includes(skill)||!known.has(char))return;
    const state=read();if(!state.startedAt){state.startedAt=Date.now();state.startKind='existing';}
    const before=state.earned[skill][char]||0,next=earned(char,skill,state,evidence);
    if(next>before){state.earned[skill][char]=next;save(state);}
  }
  function introduce(char){if(!known.has(char))return;const state=start();if(!state.introduced[char]){state.introduced[char]=Date.now();save(state);}}
  function place(skill,rowId){
    const state=start('placement');if(!['reading','writing'].includes(skill)||!rowById.has(rowId))return;
    if(!state.placed[skill][rowId]){state.placed[skill][rowId]=Date.now();save(state);}
  }
  function recordHandwriting(char,event){
    if(!known.has(char)||!event?.id||!number(event.at))return false;
    const state=start();if(!available('handwriting',state).has(char))return false;
    const entries=state.handwriting[char]||=[];if(entries.some(r=>r.id===event.id))return false;
    entries.push({id:event.id,at:event.at,independent:event.mode==='write'&&!event.assisted&&event.errors===0});
    if(event.mode==='write'&&!event.assisted&&event.errors===0)state.handwritingDays[char]=[...(state.handwritingDays[char]||[]),root.ModeAtlasDates.localDateKey(new Date(event.at))];
    state.earned.handwriting[char]=Math.max(state.earned.handwriting[char]||0,currentStage(char,'handwriting',{},state));save(state);return true;
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
  function practiceUrl(skill,chars=[],extra={}){
    const target=chars.filter(char=>available(skill).has(char));
    if(skill==='handwriting')return '/kana/handwriting/'+(target.length?'?kana='+encodeURIComponent(target[0]):'');
    return '/'+(skill==='writing'?'writing':'reading')+'/?'+new URLSearchParams({practice:'20',...(target.length?{kana:target.join(',')}:{}),...extra});
  }
  return Object.freeze({KEY,UPDATED,skills,names,labels,requirements,scripts,confusable,rows,rowById,map,normalize,merge,read,save,snapshot,currentStage,earned,stage,capture,initialize,start,path,available,testScripts,selection,testPool,recordRecall,introduce,place,recordHandwriting,details,guidance,practiceUrl});
});
