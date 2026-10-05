/* The same owner is instantiated with browser storage or read-only server data. */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory;
  else if(!root.ModeAtlasProgress){
    root.ModeAtlasProgress = factory(root);
    root.ModeAtlasProgress.ensureSeeded({sync:false,emit:false});
    root.addEventListener('modeAtlasRewardAccessChanged',()=>root.ModeAtlasProgress.recordRewardGrants());
  }
})(typeof window !== 'undefined' ? window : globalThis, function ModeAtlasProgressOwner(root){
  'use strict';

  const STORAGE_KEY = 'modeAtlasProgress';
  const UPDATED_AT_KEY = 'modeAtlasProgressUpdatedAt';
  const DEVICE_KEY = 'modeAtlasProgressDeviceId';
  const STATE_VERSION = 5;
  const LEGACY_SOURCE = 'legacy-baseline';

  const COUNTER_XP = Object.freeze({
    'kana.reading.correct': 1,
    'kana.writing.correct': 1
  });
  const EVENT_XP = Object.freeze({
    'kana.reading.dailyComplete': 5,
    'kana.writing.dailyComplete': 5,
    'kana.reading.testComplete': 10,
    'kana.writing.testComplete': 10
  });

  function store(){ return root.ModeAtlasStorage; }
  const scalar = value => ['number','string','boolean'].includes(typeof value) ? value : '';
  function finiteCount(value){
    const number = Number(scalar(value) || 0);
    return Number.isFinite(number) && number > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(number)) : 0;
  }
  function finiteInteger(value){
    const number = Number(scalar(value) || 0);
    return Number.isFinite(number) ? Math.max(-Number.MAX_SAFE_INTEGER, Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(number))) : 0;
  }
  function object(value){ return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }

  const safeKey = key => !['__proto__','prototype','constructor'].includes(key);

  function normalizeSource(source){
    const out = {};
    Object.entries(object(source)).forEach(([type, value]) => {
      if (!Object.hasOwn(COUNTER_XP, type)) return;
      const count = finiteCount(value);
      if (count) out[type] = count;
    });
    return out;
  }

  function normalizeEvent(event, fallbackKey = ''){
    if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
    const type = String(scalar(event.type) || '');
    if (!Object.hasOwn(EVENT_XP, type)) return null;
    const id = String(scalar(event.id) || fallbackKey.split('|').slice(1).join('|') || '');
    if (!id) return null;
    return { type, id, at: finiteCount(event.at) || Date.now() };
  }

  function normalizeAdjustment(adjustment, fallbackKey = ''){
    if (!adjustment || typeof adjustment !== 'object' || Array.isArray(adjustment)) return null;
    const id = String(scalar(adjustment.id) || fallbackKey || '').trim();
    const amount = finiteInteger(adjustment.amount);
    if (!id || !safeKey(id) || !amount) return null;
    return { id, amount, at: finiteCount(adjustment.at) || Date.now() };
  }

  function normalizeState(input){
    const value = object(input);
    const sources = {};
    Object.entries(object(value.sources)).forEach(([sourceId, counters]) => {
      if (!safeKey(sourceId)) return;
      const normalized = normalizeSource(counters);
      if (Object.keys(normalized).length) sources[String(sourceId)] = normalized;
    });
    const events = {};
    Object.entries(object(value.events)).forEach(([key, event]) => {
      const normalized = normalizeEvent(event, key);
      if (normalized) events[`${normalized.type}|${normalized.id}`] = normalized;
    });
    const adjustments = {};
    Object.entries(object(value.adjustments)).forEach(([key, adjustment]) => {
      const normalized = normalizeAdjustment(adjustment, key);
      if (normalized) adjustments[normalized.id] = normalized;
    });
    const state = {
      version: STATE_VERSION,
      legacySeeded: value.legacySeeded === true,
      sources,
      events,
      adjustments,
      credits: normalizeCredits(value.credits),
      claims: normalizeClaims(value.claims),
      goalPlans: normalizeGoalPlans(value.goalPlans),
      activity: normalizeActivity(value.activity),
      runs: normalizeRuns(value.runs),
      appearance: normalizeAppearance(value.appearance),
      collections: normalizeCollections(value.collections),
      updatedAt: finiteCount(value.updatedAt)
    };
    // All accounts use earned XP on the same curve. Discard v4's threshold-only
    // migration credit, including when an older device or backup is merged.
    return state;
  }

  function mergeStates(left, right){
    const a = normalizeState(left);
    const b = normalizeState(right);
    const merged = {
      version: STATE_VERSION,
      legacySeeded: a.legacySeeded || b.legacySeeded,
      sources: {},
      events: {},
      adjustments: {},
      credits: mergeCredits(a.credits,b.credits),
      claims: mergeClaims(a.claims,b.claims),
      goalPlans: mergeGoalPlans(a.goalPlans,b.goalPlans),
      activity: mergeActivity(a.activity,b.activity),
      runs: normalizeRuns({...a.runs,...b.runs}),
      appearance: mergeAppearance(a.appearance,b.appearance),
      collections: Object.fromEntries([...new Set([...Object.keys(a.collections),...Object.keys(b.collections)])].sort().map(id=>[id,[a.collections[id],b.collections[id]].includes('event')?'event':'exclusive'])),
      updatedAt: Math.max(a.updatedAt, b.updatedAt)
    };
    const sourceIds = new Set([...Object.keys(a.sources), ...Object.keys(b.sources)]);
    sourceIds.forEach((sourceId) => {
      const source = {};
      const types = new Set([...Object.keys(a.sources[sourceId] || {}), ...Object.keys(b.sources[sourceId] || {})]);
      types.forEach((type) => {
        const value = Math.max(finiteCount(a.sources[sourceId]?.[type]), finiteCount(b.sources[sourceId]?.[type]));
        if (value) source[type] = value;
      });
      if (Object.keys(source).length) merged.sources[sourceId] = source;
    });
    Object.assign(merged.events, a.events);
    Object.entries(b.events).forEach(([key, event]) => {
      if (!merged.events[key] || finiteCount(event.at) < finiteCount(merged.events[key].at)) merged.events[key] = event;
    });
    Object.assign(merged.adjustments, a.adjustments);
    Object.entries(b.adjustments).forEach(([key, adjustment]) => {
      if (!merged.adjustments[key] || finiteCount(adjustment.at) < finiteCount(merged.adjustments[key].at)) merged.adjustments[key] = adjustment;
    });
    for (const id of Object.keys(a.runs)) {
      if (b.runs[id]) merged.runs[id]={...a.runs[id],answers:Math.max(a.runs[id].answers,b.runs[id].answers),done:a.runs[id].done||b.runs[id].done,at:Math.max(a.runs[id].at,b.runs[id].at)};
    }
    merged.runs=normalizeRuns(merged.runs);
    const weeks=new Set();
    for(const day of Object.keys(merged.activity)){
      const totals=activityTotals(merged,day);
      if(merged.activity[day].goalVersion>=4)reconcileGoals(merged,day,false);
      else {
        if(totals.correct>=20)claim(merged,`${day}:goal:recall`,10);
        if(totals.reading>=5&&totals.writing>=5)claim(merged,`${day}:goal:balance`,10);
        if(totals.reviewed>=5)claim(merged,`${day}:goal:review`,10);
      }
      for(const mode of ['reading','writing'])claim(merged,`${day}:review:${mode}`,merged.activity[day].reviews[mode].length*2);
      weeks.add(weekKey(day));
    }
    for(const week of weeks){
      const days=Object.keys(merged.activity).filter(day=>weekKey(day)===week);
      if(days.some(day=>merged.activity[day].goalVersion>=4))reconcilePeriod(merged,week,'weekly');
      else if(weekDays(merged,week)>=4)claim(merged,`${week}:goal:week`,25);
    }
    return merged;
  }

  // Cumulative device counters retain their original one-XP weight. Credits
  // carry the rest of each answer's current rate without revaluing old answers.
  const creditKinds=['answer','completion','accuracy','streak'];
  function normalizeCredits(input){
    const out={};for(const [id,row] of Object.entries(object(input))){if(!safeKey(id))continue;out[id]={};for(const key of creditKinds)out[id][key]=finiteCount(row?.[key]);}return out;
  }
  function mergeCredits(a,b){
    const out=normalizeCredits(a);for(const [id,row]of Object.entries(normalizeCredits(b))){out[id]||={};for(const key of creditKinds)out[id][key]=Math.max(out[id][key]||0,row[key]);}return out;
  }
  function normalizeClaims(input){
    const out={};for(const [id,value]of Object.entries(object(input)))if(/^v[345]:/.test(id)&&id.length<180)out[id]=Math.min(1000,finiteCount(value));return out;
  }
  function mergeClaims(a,b){const out=normalizeClaims(a);for(const [id,n]of Object.entries(normalizeClaims(b)))out[id]=Math.max(out[id]||0,n);return out;}
  function normalizeActivity(input){
    const out={};for(const [day,row]of Object.entries(object(input))){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!row||typeof row!=='object')continue;
      const sources={};for(const [id,counts]of Object.entries(object(row.sources)))if(safeKey(id))sources[id]=[finiteCount(counts?.[0]),finiteCount(counts?.[1])];
      const reviews={};for(const mode of ['reading','writing'])reviews[mode]=[...new Set((Array.isArray(row.reviews?.[mode])?row.reviews[mode]:[]).filter(x=>typeof x==='string'&&x.length<8))].sort().slice(0,5);
      const metrics={};for(const [id,counts]of Object.entries(object(row.metrics)))if(safeKey(id))metrics[id]=normalizeMetrics(counts);
      const kana=[...new Set((Array.isArray(row.kana)?row.kana:[]).filter(k=>typeof k==='string'&&k.length<8))].sort().slice(0,512);
      out[day]={sources,reviews,metrics,kana,goalVersion:row.goalVersion===4?4:3};
    }return out;
  }
  function mergeActivity(left,right){
    const out=normalizeActivity(left);for(const [day,b]of Object.entries(normalizeActivity(right))){
      const a=out[day]||emptyActivity();
      for(const [id,counts]of Object.entries(b.sources))a.sources[id]=[0,1].map(i=>Math.max(a.sources[id]?.[i]||0,counts[i]));
      for(const mode of ['reading','writing'])a.reviews[mode]=[...new Set([...a.reviews[mode],...b.reviews[mode]])].sort().slice(0,5);
      for(const [id,metrics]of Object.entries(b.metrics)){
        a.metrics[id]||={};for(const [key,n]of Object.entries(metrics))a.metrics[id][key]=Math.max(a.metrics[id][key]||0,n);
      }
      a.kana=[...new Set([...a.kana,...b.kana])].sort().slice(0,512);
      a.goalVersion=Math.max(a.goalVersion,b.goalVersion);
      out[day]=a;
    }return out;
  }
  function emptyActivity(){return {sources:{},reviews:{reading:[],writing:[]},metrics:{},kana:[],goalVersion:3};}
  function normalizeMetrics(input){
    return Object.fromEntries(Object.entries(object(input)).filter(([key])=>/^(kana|wordbank|listening|grammar|comprehension)\.[a-zA-Z]+$/.test(key)).map(([key,n])=>[key,finiteCount(n)]));
  }
  function normalizeCollections(input){
    return Object.fromEntries(Object.entries(object(input)).filter(([id,kind])=>safeKey(id)&&/^[a-z0-9-]{1,80}$/.test(id)&&['exclusive','event'].includes(kind)));
  }
  function normalizeRuns(input){
    return Object.fromEntries(Object.entries(object(input)).filter(([id,row])=>safeKey(id)&&id.length<100&&row&&finiteCount(row.at)).sort((a,b)=>b[1].at-a[1].at||a[0].localeCompare(b[0])).slice(0,64).map(([id,row])=>[id,{answers:finiteCount(row.answers),done:!!row.done,at:finiteCount(row.at)}]));
  }
  function normalizeAppearance(input={}){return {landmark:String(scalar(input?.landmark)||'trail').slice(0,24),at:finiteCount(input?.at),banner:String(scalar(input?.banner)||'plain').slice(0,24),bannerAt:finiteCount(input?.bannerAt)};}
  function mergeAppearance(a,b){
    const title=a.at>b.at||(a.at===b.at&&a.landmark>b.landmark)?a:b;
    const banner=a.bannerAt>b.bannerAt||(a.bannerAt===b.bannerAt&&a.banner>b.banner)?a:b;
    return {landmark:title.landmark,at:title.at,banner:banner.banner,bannerAt:banner.bannerAt};
  }
  const dayKey=at=>root.ModeAtlasDates.localDateKey(new Date(at||Date.now()));
  function activityTotals(state,day){
    const row=state.activity[day]||{sources:{},reviews:{}};
    const counts=Object.values(row.sources).reduce((sum,n)=>[sum[0]+n[0],sum[1]+n[1]],[0,0]);
    const metrics={};for(const source of Object.values(row.metrics||{}))for(const [key,n]of Object.entries(source))metrics[key]=key.endsWith('.streak')?Math.max(metrics[key]||0,n):(metrics[key]||0)+n;
    return {reading:counts[0],writing:counts[1],correct:counts[0]+counts[1],reviewed:(row.reviews.reading||[]).length+(row.reviews.writing||[]).length,metrics};
  }
  function weekKey(day){const d=new Date(day+'T12:00:00Z');return root.ModeAtlasDates.shiftDateKey(day,-((d.getUTCDay()+6)%7));}
  function correctAcrossBranches(totals){return totals.correct+Object.entries(totals.metrics).filter(([id])=>id.endsWith('.correct')&&!id.startsWith('kana.')).reduce((sum,[,n])=>sum+n,0);}
  function weekDays(state,day){const first=weekKey(day);return Object.keys(state.activity).filter(key=>weekKey(key)===first&&correctAcrossBranches(activityTotals(state,key))>=5).length;}
  function claim(state,id,value){const key='v3:'+id,old=state.claims[key]||0;state.claims[key]=Math.max(old,finiteCount(value));return state.claims[key]-old;}
  function goalClaimKey(period,key,goal){return `v4:${period}:${key}:goal:${goal.id}`;}
  function goalAwards(state,key,period){
    const slots={};
    for(const goal of root.ModeAtlasRewardRules.goalCatalogue.filter(goal=>goal.period===period)){
      const xp=state.claims[goalClaimKey(period,key,goal)]||0;
      if(xp)slots[goal.slot]=Math.max(slots[goal.slot]||0,xp);
    }return slots;
  }
  function goalCount(state,key,period){
    const legacy=period==='daily'?['recall','balance','review'].filter(id=>state.claims[`v3:${key}:goal:${id}`]).length:Number(!!state.claims[`v3:${key}:goal:week`]);
    return Math.max(legacy,Object.keys(goalAwards(state,key,period)).length);
  }
  function normalizeGoalPlans(input){
    const out={};
    for(const [key,plan]of Object.entries(object(input))){
      const match=/^(daily|weekly):(\d{4}-\d{2}-\d{2})$/.exec(key);
      if(!match||!plan||![0,1].includes(plan.version)||!Array.isArray(plan.ids))continue;
      const instant=Date.parse(match[2]+'T12:00:00Z');
      if(!Number.isFinite(instant)||new Date(instant).toISOString().slice(0,10)!==match[2]||(match[1]==='weekly'&&weekKey(match[2])!==match[2]))continue;
      const goals=plan.ids.map(id=>root.ModeAtlasRewardRules.goalCatalogue.find(goal=>goal.id===id&&goal.period===match[1]));
      const size=match[1]==='daily'?3:2;
      if(goals.length!==size||goals.some((goal,index)=>!goal||goal.slot!==index))continue;
      out[key]={version:plan.version,at:finiteCount(plan.at),assisted:plan.assisted===true,ids:goals.map(goal=>goal.id)};
    }return out;
  }
  function mergeGoalPlans(left,right){
    const out=normalizeGoalPlans(left);
    for(const [key,plan]of Object.entries(normalizeGoalPlans(right))){
      const previous=out[key];
      // Earliest assignment wins; deterministic tie-breaking converges offline devices.
      if(!previous||plan.at<previous.at||(plan.at===previous.at&&JSON.stringify(plan)<JSON.stringify(previous)))out[key]=plan;
    }return out;
  }
  function ensureGoalPlans(state,day,at){
    let changed=false;
    for(const period of ['daily','weekly']){
      const key=period==='daily'?day:weekKey(day),id=period+':'+key;if(state.goalPlans[id])continue;
      const active=Object.entries(state.activity).filter(([date])=>period==='daily'?date===day:weekKey(date)===key);
      const legacy=active.some(([,row])=>row.goalVersion===4)||Object.keys(state.claims).some(claim=>claim.startsWith(`v4:${period}:${key}:goal:`));
      const known=new Set(),profile={variety:0,katakana:0,independent:0,daysAvailable:7-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7)};
      for(const [date,row]of Object.entries(state.activity))if(date<=day){
        for(const kana of row.kana)known.add(kana);
        const metrics=activityTotals(state,date).metrics;profile.katakana+=metrics['kana.katakana']||0;profile.independent+=metrics['kana.independent']||0;
      }
      profile.variety=known.size;
      state.goalPlans[id]={version:legacy?0:1,at:finiteCount(at),assisted:!legacy&&profile.independent<20,ids:root.ModeAtlasRewardRules.goals(key,period,legacy?undefined:profile).map(goal=>goal.id)};
      changed=true;
    }return changed;
  }
  function periodGoals(state,key,period){
    const plan=state.goalPlans[period+':'+key];
    return plan?plan.ids.map(id=>({...root.ModeAtlasRewardRules.goalCatalogue.find(goal=>goal.id===id),planVersion:plan.version,assisted:plan.assisted})):root.ModeAtlasRewardRules.goals(key,period);
  }
  function dailyGoalCount(state,day){return goalCount(state,day,'daily');}
  function periodMetrics(state,key,period){
    const days=period==='daily'?[key]:Object.keys(state.activity).filter(day=>weekKey(day)===key);
    const metrics={},kana=new Set();let reading=0,writing=0;
    for(const day of days){
      const totals=activityTotals(state,day);reading+=totals.reading;writing+=totals.writing;
      for(const [id,n]of Object.entries(totals.metrics))metrics[id]=id.endsWith('.streak')?Math.max(metrics[id]||0,n):(metrics[id]||0)+n;
      for(const char of state.activity[day]?.kana||[])kana.add(char);
      metrics['study.goals']=(metrics['study.goals']||0)+dailyGoalCount(state,day);
      if(correctAcrossBranches(totals)>=5)metrics['study.days']=(metrics['study.days']||0)+1;
    }
    return {...metrics,'kana.correct':reading+writing,'kana.reading':reading,'kana.writing':writing,'kana.balance':Math.min(10,reading)+Math.min(10,writing),'kana.variety':kana.size};
  }
  function reconcilePeriod(state,key,period){
    const metrics=periodMetrics(state,key,period),awarded=goalAwards(state,key,period);let xp=0;
    for(const goal of periodGoals(state,key,period))if(!awarded[goal.slot]&&(metrics[goal.metric]||0)>=goal.target){
      const id=goalClaimKey(period,key,goal),old=state.claims[id]||0;state.claims[id]=Math.max(old,goal.xp);xp+=state.claims[id]-old;
    }
    return xp;
  }
  function reconcileGoals(state,day,weekly=true){return reconcilePeriod(state,day,'daily')+(weekly?reconcilePeriod(state,weekKey(day),'weekly'):0);}
  function addActivity(state,day,metrics,kana=[]){
    ensureGoalPlans(state,day,Date.now());
    const row=state.activity[day]||emptyActivity(),id=getDeviceId();row.goalVersion=4;
    row.metrics[id]||={};for(const [key,n]of Object.entries(normalizeMetrics(metrics)))row.metrics[id][key]=key.endsWith('.streak')?Math.max(row.metrics[id][key]||0,n):(row.metrics[id][key]||0)+n;
    row.kana=[...new Set([...row.kana,...kana])].sort().slice(0,512);state.activity[day]=row;return row;
  }
  function recordActivity(input){
    const state=ensureSeeded({sync:false,emit:false}),run=state.runs[input.runId];
    if(!run||run.done||input.index!==run.answers+1)return {duplicate:true,xp:0,parts:{}};
    const metrics=normalizeMetrics(input.metrics);if(!Object.keys(metrics).length)return {duplicate:false,xp:0,parts:{}};
    const at=Number(input.at||Date.now()),day=dayKey(at);addActivity(state,day,metrics);
    const goals=reconcileGoals(state,day);run.answers=input.index;run.at=at;persistState(state,{source:'activity'});
    return {duplicate:false,xp:goals,parts:{goals}};
  }
  function addCredit(state,kind,value){const id=getDeviceId();state.credits[id]||={answer:0,completion:0,accuracy:0,streak:0};state.credits[id][kind]+=finiteCount(value);}
  function startRun(id){const state=ensureSeeded({sync:false,emit:false});if(!state.runs[id])state.runs[id]={answers:0,done:false,at:Date.now()};persistState(state,{source:'practice.start',emit:false});}
  function recordAnswer(input){
    const state=ensureSeeded({sync:false,emit:false}),run=state.runs[input.runId];
    if(!run||run.done||input.index!==run.answers+1)return {duplicate:true,xp:0,parts:{}};
    const at=Number(input.at||Date.now()),day=dayKey(at),mode=input.mode==='writing'?'writing':'reading';
    const count=input.correct?finiteCount(input.units):0,sourceId=getDeviceId();
    const rate=root.ModeAtlasRewardRules.kanaRate(input.poolSize,input.assisted),parts={answers:count*rate};
    const source=state.sources[sourceId]||{};source[`kana.${mode}.correct`]=finiteCount(source[`kana.${mode}.correct`])+count;state.sources[sourceId]=source;
    addCredit(state,'answer',count*(rate-1));
    const metrics={'kana.independent':input.assisted?0:count,'kana.broad':input.poolSize>=45?count:0,'kana.hiragana':input.correct?finiteCount(input.hiragana):0,'kana.katakana':input.correct?finiteCount(input.katakana):0,'kana.streak':input.assisted?0:finiteCount(input.streak)};
    const activity=addActivity(state,day,metrics,input.correct?(input.kana||[]):[]);
    activity.sources[sourceId]||=[0,0];activity.sources[sourceId][mode==='writing'?1:0]+=count;
    activity.reviews[mode]=[...new Set([...activity.reviews[mode],...(input.reviewed||[])])].sort().slice(0,5);state.activity[day]=activity;
    parts.review=claim(state,`${day}:review:${mode}`,activity.reviews[mode].length*2);
    parts.mastery=0;for(const item of input.milestones||[])if(item.stage>=2)parts.mastery+=claim(state,`mastery:${mode}:${item.kana}:${item.stage}`,item.stage===3?25:10);
    parts.goals=reconcileGoals(state,day);
    run.answers=input.index;run.at=at;
    persistState(state,{source:'practice.answer'});
    return {duplicate:false,xp:Object.values(parts).reduce((a,b)=>a+b,0),parts};
  }
  function finishRun(input){
    const state=ensureSeeded({sync:false,emit:false}),run=state.runs[input.runId];
    if(!run||run.done)return {xp:0,parts:{}};
    const rewards=root.ModeAtlasRewardRules.session(input),parts={completion:0,accuracy:0,streak:0};
    const day=input.day||dayKey();
    if(rewards.daily)parts.daily=claim(state,`${day}:daily:${input.direction}`,rewards.daily);
    else if(rewards.test)parts.test=claim(state,`${day}:test:${input.direction}`,rewards.test);
    else{parts.completion=rewards.completion;parts.accuracy=rewards.accuracy;addCredit(state,'completion',parts.completion);addCredit(state,'accuracy',parts.accuracy);}
    parts.streak=rewards.streak;addCredit(state,'streak',parts.streak);
    if(rewards.eligible){
      const finite=['guided','dailyChallenge','testMode','speedRun','timeTrial'].includes(input.mode);
      const complete=input.completed&&finite;
      addActivity(state,day,{'kana.sessions':1,'kana.guided':complete&&input.mode==='guided'?1:0,'kana.daily':complete&&input.mode==='dailyChallenge'?1:0,'kana.tests':complete&&input.mode==='testMode'?1:0,'kana.precise':complete&&!input.assisted&&!input.hintsEnabled&&input.correct/input.answered>=.9?1:0});
      parts.goals=reconcileGoals(state,day);
    }
    run.done=true;run.at=Date.now();persistState(state,{source:'practice.finish'});
    return {xp:Object.values(parts).reduce((a,b)=>a+b,0),parts};
  }
  function legacyStudyDays(){
    const legacyDays=new Set([...Object.keys(store()?.readModeJSON?.('reading','dailyHistory',{})||{}),...Object.keys(store()?.readModeJSON?.('writing','dailyHistory',{})||{})]);
    for(const mode of ['reading','writing']){
      const results=store()?.readModeJSON?.(mode,'testResults',[]);
      for(const result of Array.isArray(results)?results:[]){
        const raw=result?.date||result?.completedAt||result?.createdAt||result?.startedAt;
        const parsed=typeof raw==='number'?dayKey(raw):String(scalar(raw)||'').slice(0,10);
        if(/^\d{4}-\d{2}-\d{2}$/.test(parsed))legacyDays.add(parsed);
      }
    }
    return [...legacyDays];
  }
  function studyDays(input,legacy=legacyStudyDays()){
    const state=input?normalizeState(input):readState();
    return [...new Set([...Object.keys(state.activity).filter(day=>correctAcrossBranches(activityTotals(state,day))>=5),...legacy])]
      .filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day)).sort();
  }
  function studyStreak(days,today){
    const learned=new Set(days);
    let day=learned.has(today)?today:root.ModeAtlasDates.shiftDateKey(today,-1),streak=0;
    while(learned.has(day)){streak++;day=root.ModeAtlasDates.shiftDateKey(day,-1);}
    return streak;
  }
  function routine(input,at=Date.now()){
    const state=input?normalizeState(input):readState(),today=dayKey(at);
    const changed=ensureGoalPlans(state,today,at);
    if(changed&&!input)persistState(state,{source:'goals.assign',emit:false});
    const streak=studyStreak(studyDays(state),today);
    const goals=[];
    for(const period of ['daily','weekly']){
      const key=period==='daily'?today:weekKey(today),metrics=periodMetrics(state,key,period);
      goals.push(...periodGoals(state,key,period).map(goal=>({...goal,value:goalAwards(state,key,period)[goal.slot]?goal.target:metrics[goal.metric]||0})));
    }
    return {streak,weekDays:weekDays(state,today),goals};
  }
  function weeklyRecap(input,at=Date.now(),previous=false){
    const state=input?normalizeState(input):readState(),today=dayKey(at),start=weekKey(root.ModeAtlasDates.shiftDateKey(today,previous?-7:0));
    const metrics=periodMetrics(state,start,'weekly'),daily=activityTotals(state,today);
    const weeklyGoals=goalCount(state,start,'weekly');
    return {start,end:root.ModeAtlasDates.shiftDateKey(start,6),studyDays:metrics['study.days']||0,
      reading:metrics['kana.reading']||0,writing:metrics['kana.writing']||0,variety:metrics['kana.variety']||0,
      sessions:metrics['kana.sessions']||0,dailyGoals:metrics['study.goals']||0,weeklyGoals,
      todayReading:daily.reading,todayWriting:daily.writing};
  }
  function achievementStats(input){
    const state=input?normalizeState(input):readState(),days=new Set(),dailyKeys=new Set(),weeklyKeys=new Set();
    for(const [key,n]of Object.entries(state.claims))if(n){
      const daily=/^v4:daily:(\d{4}-\d{2}-\d{2}):/.exec(key)||/^v3:(\d{4}-\d{2}-\d{2}):goal:(recall|balance|review)$/.exec(key);
      const weekly=/^v4:weekly:(\d{4}-\d{2}-\d{2}):/.exec(key)||/^v3:(\d{4}-\d{2}-\d{2}):goal:week$/.exec(key);
      if(daily){dailyKeys.add(daily[1]);if(dailyGoalCount(state,daily[1])>=3)days.add(daily[1]);}
      if(weekly)weeklyKeys.add(weekly[1]);
    }
    const dailyGoals=[...dailyKeys].reduce((sum,key)=>sum+dailyGoalCount(state,key),0),weeklyGoals=[...weeklyKeys].reduce((sum,key)=>sum+goalCount(state,key,'weekly'),0);
    const metrics={};let bestStreak=0;
    for(const day of Object.keys(state.activity))for(const [key,n]of Object.entries(activityTotals(state,day).metrics)){metrics[key]=(metrics[key]||0)+n;if(key==='kana.streak')bestStreak=Math.max(bestStreak,n);}
    const collections=Object.values(state.collections);
    return {dailyGoals,weeklyGoals,goalDays:days.size,studyDays:studyDays(state).length,guidedSets:metrics['kana.guided']||0,independent:metrics['kana.independent']||0,broadRecall:metrics['kana.broad']||0,preciseSets:metrics['kana.precise']||0,bestStreak,exclusiveRewards:collections.filter(kind=>kind==='exclusive').length,eventRewards:collections.filter(kind=>kind==='event').length,collectedRewards:collections.length};
  }
  function recordRewardGrants(){
    const grants=root.ModeAtlasRewardAccess?.current()?.grants||[];if(!grants.length)return;
    const state=ensureSeeded({sync:false,emit:false});let changed=false;
    for(const rewards of Object.values(root.ModeAtlasRewardRules.catalogue))for(const reward of rewards){
      if(reward.grant&&grants.includes(reward.grant)&&!state.collections[reward.grant]){state.collections[reward.grant]=reward.kind==='event'?'event':'exclusive';changed=true;}
    }
    if(changed)persistState(state,{source:'reward.received'});
  }
  function selectAppearance(id){
    const state=readState(),item=root.ModeAtlasRewardRules.landmarks.find(x=>x.id===id);
    if(!root.ModeAtlasRewardRules.unlocked(item,getSummary(state).level,root.ModeAtlasRewardAccess?.current()))return false;
    state.appearance={...state.appearance,landmark:id,at:Math.max(Date.now(),state.appearance.at+1)};persistState(state,{source:'appearance'});return true;
  }
  function selectBanner(id){
    const state=readState(),item=root.ModeAtlasRewardRules.banners.find(x=>x.id===id);
    if(!root.ModeAtlasRewardRules.unlocked(item,getSummary(state).level,root.ModeAtlasRewardAccess?.current()))return false;
    state.appearance={...state.appearance,banner:id,bannerAt:Math.max(Date.now(),state.appearance.bannerAt+1)};persistState(state,{source:'appearance'});return true;
  }

  function makeDeviceId(){
    try { if (root.crypto?.randomUUID) return `device-${root.crypto.randomUUID()}`; } catch {}
    return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function getDeviceId(){
    const storage = store();
    let id = String(storage?.get?.(DEVICE_KEY, '') || '').trim();
    if (!id) {
      id = makeDeviceId();
      storage?.set?.(DEVICE_KEY, id);
    }
    return id;
  }

  function readState(){
    return normalizeState(store()?.json?.(STORAGE_KEY, {}) || {});
  }

  function emit(summary, source = 'local', previousSummary = summary){
    try {
      root.dispatchEvent(new CustomEvent('modeAtlasProgressChanged', {
        detail: {
          ...summary,
          source,
          previousLevel: Number(previousSummary?.level || summary.level || 1),
          previousXp: Number(previousSummary?.xp || 0)
        }
      }));
    } catch {}
  }

  function persistState(input, options = {}){
    const storage = store();
    if (!storage?.setJSON) return normalizeState(input);
    const previousSummary = getSummary(readState());
    const state = normalizeState(input);
    state.updatedAt = Math.max(Date.now(), finiteCount(state.updatedAt));
    storage.setJSON(STORAGE_KEY, state);
    storage.set(UPDATED_AT_KEY, String(state.updatedAt));
    if (options.sync !== false) {
      try { root.KanaCloudSync?.markSectionUpdated?.('progress'); } catch {}
      try { root.KanaCloudSync?.scheduleSync?.(); } catch {}
    }
    const summary = getSummary(state);
    if (options.emit !== false) emit(summary, options.source || 'local', previousSummary);
    return state;
  }

  function correctFromStats(mode){
    const stats = store()?.readModeJSON?.(mode, 'charStats', {}) || {};
    return Object.values(object(stats)).reduce((sum, row) => {
      if (!row || typeof row !== 'object') return sum;
      return sum + finiteCount(row.correct ?? row.right);
    }, 0);
  }

  function ensureSeeded(options = {}){
    let state = readState();
    if (state.legacySeeded){
      const raw=store()?.json?.(STORAGE_KEY,{})||{};
      return Number(raw.version)<STATE_VERSION?persistState(state,{sync:false,emit:false,source:'curve.migration'}):state;
    }
    const readingCorrect = correctFromStats('reading');
    const writingCorrect = correctFromStats('writing');
    const legacy = {};
    if (readingCorrect) legacy['kana.reading.correct'] = readingCorrect;
    if (writingCorrect) legacy['kana.writing.correct'] = writingCorrect;
    if (Object.keys(legacy).length) state.sources[LEGACY_SOURCE] = legacy;
    state.legacySeeded = true;
    return persistState(state, { sync: options.sync === true, emit: options.emit !== false, source: 'legacy-seed' });
  }

  function award(type, amount = 1){
    if (!Object.hasOwn(COUNTER_XP, type)) return false;
    const increment = finiteCount(amount);
    if (!increment) return false;
    const state = ensureSeeded({ sync: false, emit: false });
    const sourceId = getDeviceId();
    const source = state.sources[sourceId] || {};
    source[type] = finiteCount(source[type]) + increment;
    state.sources[sourceId] = source;
    persistState(state, { source: type });
    return true;
  }

  function awardOnce(type, eventId){
    if (!Object.hasOwn(EVENT_XP, type)) return false;
    const id = String(eventId || '').trim();
    if (!id) return false;
    const state = ensureSeeded({ sync: false, emit: false });
    const key = `${type}|${id}`;
    if (state.events[key]) return false;
    state.events[key] = { type, id, at: Date.now() };
    persistState(state, { source: type });
    return true;
  }

  function counterTotal(state, type){
    return Object.values(normalizeState(state).sources).reduce((sum, source) => Math.min(Number.MAX_SAFE_INTEGER, sum + finiteCount(source[type])), 0);
  }

  function getLifetimeCorrect(input){
    const state = input ? normalizeState(input) : ensureSeeded({ sync: false, emit: false });
    return Math.min(Number.MAX_SAFE_INTEGER, counterTotal(state, 'kana.reading.correct') + counterTotal(state, 'kana.writing.correct'));
  }

  function getXP(input){
    const state = input ? normalizeState(input) : ensureSeeded({ sync: false, emit: false });
    return sumXP(state);
  }
  function sumXP(state){
    let xp = 0;
    Object.values(state.sources).forEach((source) => {
      Object.entries(source).forEach(([type, count]) => { xp += finiteCount(count) * (COUNTER_XP[type] || 0); });
    });
    Object.values(state.events).forEach((event) => { xp += EVENT_XP[event.type] || 0; });
    Object.values(state.adjustments).forEach((adjustment) => { xp += finiteInteger(adjustment.amount); });
    Object.values(state.credits).forEach(row=>{xp+=Object.values(row).reduce((n,value)=>n+value,0);});
    // Claim IDs retain the compatible v4 format. Each period has one award per
    // slot, even if two offline devices were assigned different eligible goals.
    const periods=new Map();
    for(const [id,value]of Object.entries(state.claims)){
      const match=/^v4:(daily|weekly):(\d{4}-\d{2}-\d{2}):goal:/.exec(id);
      if(match)periods.set(match[1]+':'+match[2],[match[1],match[2]]);else xp+=value;
    }
    for(const [period,key]of periods.values())xp+=Object.values(goalAwards(state,key,period)).reduce((sum,value)=>sum+value,0);
    return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(xp)));
  }

  function levelRequirement(level){
    return root.ModeAtlasRewardRules.levelRequirement(level);
  }
  function getLevelFromXP(value){
    const xp = Math.max(0, Math.floor(Number(scalar(value) || 0)));
    let level = 1;
    let floor = 0;
    let required = levelRequirement(level);
    while (xp >= floor + required && level < 999) {
      floor += required;
      level += 1;
      required = levelRequirement(level);
    }
    return { level, floor, required, intoLevel: xp - floor, nextAt: floor + required };
  }

  function getSummary(input){
    const state = input ? normalizeState(input) : ensureSeeded({ sync: false, emit: false });
    const xp = getXP(state);
    const levelInfo = getLevelFromXP(xp);
    const readingCorrect = counterTotal(state, 'kana.reading.correct');
    const writingCorrect = counterTotal(state, 'kana.writing.correct');
    return {
      level: levelInfo.level,
      xp,
      levelXp: levelInfo.intoLevel,
      levelRequirement: levelInfo.required,
      nextLevelAt: levelInfo.nextAt,
      progress: levelInfo.required ? Math.min(1, levelInfo.intoLevel / levelInfo.required) : 0,
      readingCorrect,
      writingCorrect,
      lifetimeCorrect: Math.min(Number.MAX_SAFE_INTEGER, readingCorrect + writingCorrect)
    };
  }

  function debugAdjustXP(amount){
    const requested = finiteInteger(amount);
    if (!requested) return false;
    const state = ensureSeeded({ sync: false, emit: false });
    const before = getSummary(state);
    const applied = requested < 0 ? Math.max(requested, -before.xp) : requested;
    if (!applied) return { requested, applied: 0, before, after: before };
    const sourceId = getDeviceId();
    const id = `dev-xp-${sourceId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    state.adjustments[id] = { id, amount: applied, at: Date.now() };
    const persisted = persistState(state, { source: 'dev.xpAdjust' });
    return { requested, applied, before, after: getSummary(persisted) };
  }

  return Object.freeze({
    STORAGE_KEY, UPDATED_AT_KEY, DEVICE_KEY, STATE_VERSION,
    COUNTER_XP, EVENT_XP,
    normalizeState, mergeStates, readState, persistState, ensureSeeded,
    award, awardOnce, debugAdjustXP, startRun, recordAnswer, recordActivity, finishRun, routine, weeklyRecap, achievementStats, recordRewardGrants, studyDays, studyStreak, selectAppearance, selectBanner, levelRequirement,
    getXP, getLifetimeCorrect, getLevelFromXP, getSummary
  });

});
