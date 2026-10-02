const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const plain=value=>JSON.parse(JSON.stringify(value));
function load(seed={}){
  const values=new Map(Object.entries(seed).map(([key,value])=>[key,typeof value==='string'?value:JSON.stringify(value)]));
  const localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),get length(){return values.size;},key:index=>[...values.keys()][index]??null};
  let now=Date.parse('2026-09-30T12:00:00Z');
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const root={localStorage,sessionStorage:localStorage,Date:Clock,console,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},dispatchEvent(){},addEventListener(){}};
  root.window=root;root.self=root;
  const context=vm.createContext(root);
  for(const file of ['app/mode-atlas-date','app/mode-atlas-storage','app/mode-atlas-reward-rules','app/mode-atlas-progress','data/mode-atlas-kana-data','app/mode-atlas-review'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets',file+'.js'),'utf8'),context);
  return {root,values,now:()=>now,setNow:value=>{now=value;},progress:root.ModeAtlasProgress,review:root.ModeAtlasReview};
}
function answer(env,id,index,options={}){return env.progress.recordAnswer({runId:id,index,mode:'reading',correct:true,units:1,at:env.now(),...options});}
test('the new curve grows after the introductory levels and preserves an existing level without adding XP',()=>{
  const e=load({modeAtlasProgress:{version:3,legacySeeded:true,sources:{old:{'kana.reading.correct':6175}}}}),p=e.progress;
  assert.deepEqual([1,5,10,20,30,50].map(p.levelRequirement),[100,300,1000,4600,11800,37000]);
  const migrated=p.readState();assert.equal(p.getXP(),6175);assert.equal(p.getSummary().level,20);assert.equal(p.getSummary().progress,0);
  p.startRun('endless');let answerXP=0;
  for(let i=1;i<=111;i++)answerXP+=answer(e,'endless',i,{poolSize:150}).parts.answers;
  assert.equal(answerXP,888);assert.equal(p.getSummary().level,20);assert.ok(p.getSummary().progress<.25);
  assert.equal(p.readState().curveCredit,migrated.curveCredit);
  const reloaded=load({modeAtlasProgress:p.readState()}).progress;
  assert.deepEqual(plain(reloaded.getSummary()),plain(p.getSummary()));
  const halfway=load({modeAtlasProgress:{version:3,legacySeeded:true,sources:{old:{'kana.reading.correct':6405}}}}).progress;
  assert.equal(halfway.getSummary().level,20);assert.equal(halfway.getSummary().progress,.4);assert.equal(halfway.getXP(),6405);
});
test('legacy conversion is stable across offline merges, including a zero-credit migrated account',()=>{
  const p=load().progress;
  const old={version:3,legacySeeded:true,sources:{a:{'kana.reading.correct':6175}}};
  const current=p.normalizeState(old),laterOld={...old,sources:{a:{'kana.reading.correct':6300}}};
  const merged=p.mergeStates(current,laterOld);
  assert.equal(merged.curveCredit,current.curveCredit);assert.equal(p.getXP(merged),6300);
  assert.deepEqual(plain(merged),plain(p.mergeStates(laterOld,current)));
  assert.deepEqual(plain(merged),plain(p.mergeStates(merged,merged)));
  const early=p.normalizeState({version:3,sources:{a:{'kana.reading.correct':10}}});
  assert.equal(p.mergeStates(early,laterOld).curveCredit,0,'A completed zero-credit migration must not be repeated');
  const other={version:3,sources:{b:{'kana.writing.correct':230}}};
  assert.equal(p.getSummary(p.mergeStates(old,other)).progress,.4,'Two old saves convert their combined existing progress once');
});
test('correct-answer XP reflects the actual kana pool and hints, with no retroactive revaluation',()=>{
  const e=load(),p=e.progress;p.startRun('rates');
  const cases=[[5,false,2],[5,true,1],[10,false,3],[20,false,4],[46,false,6],[92,false,7],[150,false,8],[150,true,4]];
  for(const [i,[poolSize,assisted,expected]]of cases.entries())assert.equal(answer(e,'rates',i+1,{poolSize,assisted}).parts.answers,expected);
  assert.equal(answer(e,'rates',9,{correct:false,poolSize:150}).parts.answers,0);
  assert.equal(answer(e,'rates',10,{units:3,poolSize:150}).parts.answers,24);
  assert.equal(p.getLifetimeCorrect(),11);
  assert.equal(p.getXP(),59);
  assert.equal(load({modeAtlasProgress:p.readState()}).progress.getXP(),59);
});
test('daily and Monday-based weekly goals rotate deterministically with only launched branches',()=>{
  const e=load(),rules=e.root.ModeAtlasRewardRules,seen=new Set();
  for(let i=0;i<28;i++){
    const at=Date.parse('2026-09-28T12:00:00Z')+i*86400000;
    const goals=plain(e.progress.routine(undefined,at).goals);
    assert.equal(goals.length,5);assert.equal(new Set(goals.map(g=>g.id)).size,5);
    assert.equal(goals.filter(g=>g.period==='daily').length,3);assert.equal(goals.filter(g=>g.period==='weekly').length,2);
    goals.forEach(g=>{seen.add(g.id);assert.ok(rules.goalBranches.includes(g.branch));});
    assert.deepEqual(goals,plain(e.progress.routine(undefined,at+1000).goals));
  }
  assert.ok(seen.size>=20);
  const weekly=day=>plain(e.progress.routine(undefined,Date.parse(day+'T12:00:00Z')).goals.filter(g=>g.period==='weekly').map(g=>g.id));
  assert.deepEqual(weekly('2026-09-28'),weekly('2026-10-04'));assert.notDeepEqual(weekly('2026-10-04'),weekly('2026-10-05'));
});
test('rotating goals complete once when offline device evidence is combined',()=>{
  const a=load({modeAtlasProgressDeviceId:'a'}),b=load({modeAtlasProgressDeviceId:'b'});
  for(const [e,id]of [[a,'a'],[b,'b']]){e.progress.startRun(id);for(let i=1;i<=10;i++)answer(e,id,i);}
  const left=a.progress.readState(),right=b.progress.readState(),merged=a.progress.mergeStates(left,right);
  assert.equal(merged.claims['v4:daily:2026-09-30:goal:read-20'],40);assert.equal(a.progress.getXP(merged),80);
  assert.deepEqual(plain(merged),plain(a.progress.mergeStates(right,left)));
  assert.deepEqual(plain(merged),plain(a.progress.mergeStates(merged,left)));
  assert.equal(a.progress.achievementStats(merged).dailyGoals,1);
});
test('new branch activity uses shared run receipts and study days without enabling unreleased goals',()=>{
  const e=load(),p=e.progress;p.startRun('listening');
  const input={runId:'listening',index:1,at:e.now(),metrics:{'listening.correct':5,'unknown.correct':100,'constructor':100}};
  assert.equal(p.recordActivity(input).duplicate,false);assert.equal(p.recordActivity(input).duplicate,true);
  assert.equal(p.routine().weekDays,1);assert.equal(p.achievementStats().studyDays,1);assert.equal(p.getXP(),0);
  const row=Object.values(p.readState().activity['2026-09-30'].metrics)[0];assert.deepEqual(plain(row),{'listening.correct':5});
  assert.ok(p.routine().goals.every(g=>g.branch==='kana'));
});
test('achievement evidence counts real goal completions, unassisted streaks and received reward sets',()=>{
  const e=load(),p=e.progress;p.startRun('set');
  for(let i=1;i<=20;i++)answer(e,'set',i,{poolSize:46,streak:i,kana:['あ','い','う','え','お'][i%5].split(''),hiragana:1});
  p.finishRun({runId:'set',direction:'reading',mode:'guided',count:20,answered:20,correct:20,unique:5,poolSize:46,bestStreak:20,completed:true});
  let stats=p.achievementStats();assert.equal(stats.dailyGoals,3);assert.equal(stats.goalDays,1);assert.equal(stats.guidedSets,1);assert.equal(stats.preciseSets,1);assert.equal(stats.bestStreak,20);assert.equal(stats.independent,20);assert.equal(stats.broadRecall,20);
  e.root.ModeAtlasRewardAccess={current:()=>({allCustom:true,grants:[]})};p.recordRewardGrants();assert.equal(p.achievementStats().collectedRewards,0);
  e.root.ModeAtlasRewardRules={...e.root.ModeAtlasRewardRules,catalogue:{...e.root.ModeAtlasRewardRules.catalogue,avatars:[{grant:'autumn-2026',kind:'event'}]}};
  e.root.ModeAtlasRewardAccess={current:()=>({grants:['hunny-tester','autumn-2026','unknown-grant']})};
  const xp=p.getXP();p.recordRewardGrants();p.recordRewardGrants();stats=p.achievementStats();
  assert.equal(stats.exclusiveRewards,1);assert.equal(stats.eventRewards,1);assert.equal(stats.collectedRewards,2);assert.equal(p.getXP(),xp);
  e.root.ModeAtlasRewardAccess={current:()=>({grants:[]})};p.recordRewardGrants();assert.equal(p.achievementStats().collectedRewards,2);
  assert.equal(load().progress.achievementStats().collectedRewards,0,'A different account does not inherit receipts');
});
test('banner rewards migrate safely and stay independent of titles, frames and XP',()=>{
  const e=load({modeAtlasProgress:{version:3,legacySeeded:true,sources:{old:{'kana.reading.correct':700}},appearance:{landmark:'grove',at:10}}}),p=e.progress;
  assert.deepEqual(plain(p.readState().appearance),{landmark:'grove',at:10,banner:'plain',bannerAt:0});
  const xp=p.getXP();
  assert.equal(p.selectBanner('summit'),false);assert.equal(p.selectBanner('<script>'),false);
  assert.equal(p.selectBanner('grove'),true);assert.equal(p.selectAppearance('trail'),true);
  assert.equal(p.readState().appearance.banner,'grove');assert.equal(p.readState().appearance.landmark,'trail');
  const first=p.readState().appearance.bannerAt;
  assert.equal(p.selectBanner('plain'),true);assert.ok(p.readState().appearance.bannerAt>first);
  assert.equal(p.readState().appearance.landmark,'trail');assert.equal(p.getXP(),xp);
});
test('offline banner and frame changes merge independently in either order, including resets and ties',()=>{
  const p=load().progress;
  const left={appearance:{landmark:'summit',at:30,banner:'grove',bannerAt:10}},right={appearance:{landmark:'trail',at:5,banner:'bridge',bannerAt:20}};
  const merged=p.mergeStates(left,right);
  assert.deepEqual(plain(merged.appearance),{landmark:'summit',at:30,banner:'bridge',bannerAt:20});
  assert.deepEqual(plain(merged),plain(p.mergeStates(right,left)));
  assert.deepEqual(plain(merged),plain(p.mergeStates(merged,merged)));
  const reset=p.mergeStates(merged,{appearance:{banner:'plain',bannerAt:21}});
  assert.equal(reset.appearance.banner,'plain');assert.equal(reset.appearance.landmark,'summit');
  const a={appearance:{banner:'grove',bannerAt:40}},b={appearance:{banner:'horizon',bannerAt:40}};
  assert.deepEqual(plain(p.mergeStates(a,b)),plain(p.mergeStates(b,a)));
});
test('v1/v2 migration preserves every earned XP and lifetime count, and never lowers a level',()=>{
  for(const xp of [0,99,100,249,700,2700,10450,63700,250000]){
    const {progress:p}=load({modeAtlasProgress:{version:2,legacySeeded:true,sources:{old:{'kana.reading.correct':xp}},events:{},adjustments:{}}});
    assert.equal(p.getXP(),xp);assert.equal(p.getLifetimeCorrect(),xp);
    let oldLevel=1,remaining=xp;while(remaining>=100+(oldLevel-1)*50&&oldLevel<999){remaining-=100+(oldLevel-1)*50;oldLevel++;}
    assert.ok(p.getSummary().level>=oldLevel);
  }
  const {progress:p}=load({modeAtlasProgress:{legacySeeded:true,sources:{old:{'kana.reading.correct':15,'kana.writing.correct':8}},events:{daily:{type:'kana.reading.dailyComplete',id:'old'}},adjustments:{credit:{id:'credit',amount:7,at:1}}}});
  assert.equal(p.getXP(),35);assert.equal(p.getLifetimeCorrect(),23);
});
test('new answers earn 2 XP; duplicate, out-of-order and completed-run answers cannot award again',()=>{
  const e=load();e.progress.startRun('one');assert.equal(answer(e,'one',1).xp,2);
  assert.equal(answer(e,'one',1).duplicate,true);assert.equal(answer(e,'one',3).duplicate,true);
  assert.equal(e.progress.getXP(),2);assert.equal(e.progress.getLifetimeCorrect(),1);
  e.progress.finishRun({runId:'one',direction:'reading',mode:'guided',count:10,answered:1,correct:1,unique:1,bestStreak:1,completed:false});
  assert.equal(answer(e,'one',2).duplicate,true);
});
test('completion, accuracy and streak rewards are earned once and exclude incomplete or assisted perfection',()=>{
  const e=load();e.progress.startRun('set');for(let i=1;i<=10;i++)answer(e,'set',i);
  const session={runId:'set',direction:'reading',mode:'guided',count:10,answered:10,correct:10,unique:5,bestStreak:10,completed:true};
  assert.deepEqual(plain(e.progress.finishRun(session).parts),{completion:5,accuracy:13,streak:4,goals:0});
  assert.equal(e.progress.finishRun(session).xp,0);
  const rules=e.root.ModeAtlasRewardRules;
  assert.equal(rules.session({...session,completed:false}).completion,0);
  assert.equal(rules.session({...session,completed:false}).accuracy,0);
  assert.equal(rules.session({...session,assisted:1}).accuracy,0);
  assert.equal(rules.session({...session,assisted:1}).streak,0);
  assert.equal(rules.session({...session,correct:0}).completion,0);
});
test('offline devices merge counters, goals and one-time mastery without double-credit',()=>{
  const a=load({'modeAtlasProgressDeviceId':'device-a'}),b=load({'modeAtlasProgressDeviceId':'device-b'});
  a.progress.startRun('a');b.progress.startRun('b');
  for(let i=1;i<=10;i++){answer(a,'a',i,{milestones:i===1?[{kana:'あ',stage:2}]:[]});answer(b,'b',i,{mode:'writing',milestones:i===1?[{kana:'あ',stage:2}]:[]});}
  const left=a.progress.readState(),right=b.progress.readState(),merged=a.progress.mergeStates(left,right);
  assert.deepEqual(plain(merged),plain(a.progress.mergeStates(right,left)));
  assert.deepEqual(plain(merged),plain(a.progress.mergeStates(merged,merged)));
  assert.equal(a.progress.getLifetimeCorrect(merged),20);
  assert.equal(a.progress.getXP(merged),60); // 40 answers + 20 direction milestones; today's Reading goal needs 20 Reading answers.
  const same=b.progress.mergeStates(left,left);assert.equal(b.progress.getXP(same),30);
});
test('daily/test completion awards are capped per direction and day, with only improved accuracy topping up',()=>{
  const e=load();
  function finish(id,correct){e.progress.startRun(id);return e.progress.finishRun({runId:id,direction:'reading',day:'2026-09-30',mode:'dailyChallenge',answered:20,correct,unique:12,poolSize:150,bestStreak:0,completed:true}).parts.daily;}
  assert.equal(finish('first',16),80);assert.equal(finish('same',16),0);assert.equal(finish('better',20),30);assert.equal(finish('again',20),0);
});
test('review bonuses are limited to five distinct due kana per direction per day',()=>{
  const e=load();e.progress.startRun('review');
  answer(e,'review',1,{reviewed:['あ']});answer(e,'review',2,{reviewed:['あ']});
  assert.equal(e.progress.readState().claims['v3:2026-09-30:review:reading'],2);
  answer(e,'review',3,{reviewed:['い','う','え','お','か','き']});
  assert.equal(e.progress.readState().claims['v3:2026-09-30:review:reading'],10);
});
test('review schedules cross days and weeks; rapid or assisted repeats do not accelerate them',()=>{
  const e=load(),r=e.review;let row={};
  row=r.answer(row,{id:'1',at:e.now(),correct:true}).entry;
  assert.equal(row.level,1);const due=row.due;
  row=r.answer(row,{id:'2',at:e.now()+1000,correct:true}).entry;assert.equal(row.due,due);assert.equal(row.level,1);
  row=r.answer(row,{id:'3',at:due,correct:true}).entry;assert.equal(row.due-due,86400000);
  const later=r.answer(row,{id:'4',at:row.due,correct:true});assert.equal(later.reviewed,true);assert.equal(later.entry.due-row.due,3*86400000);
  const assisted=r.answer(later.entry,{id:'5',at:later.entry.due,correct:true,assisted:true});assert.equal(assisted.reviewed,false);assert.ok(assisted.entry.level<=1);
});
test('mastery depends on recent independent recall across days and retains an earned peak after mistakes',()=>{
  const e=load(),r=e.review;let row={};
  for(let i=0;i<8;i++){const at=Math.max(e.now()+i*86400000,row.due||0);row=r.answer(row,{id:String(i),at,correct:true}).entry;}
  assert.equal(r.stage(row),3);assert.equal(row.peak,3);
  for(let i=0;i<4;i++)row=r.answer(row,{id:'wrong'+i,at:row.lastSeen+1000,correct:false}).entry;
  assert.equal(r.stage(row),1);assert.equal(row.peak,3);assert.ok(row.recent.length<=12);
  assert.equal(r.stage(undefined,{correct:50,wrong:0},{avg:900}),3,'legacy accomplishments remain visible before new evidence');
});
test('review evidence merges independent offline answers in both orders',()=>{
  const e=load(),r=e.review;
  const a=r.answer({}, {id:'a',at:e.now(),correct:true}).entry;
  const b=r.answer({}, {id:'b',at:e.now()+1000,correct:false}).entry;
  const merged=r.merge(a,b);assert.deepEqual(plain(merged),plain(r.merge(b,a)));assert.deepEqual(plain(merged),plain(r.merge(merged,merged)));
  assert.equal(merged.recent.length,2);assert.equal(merged.level,0);assert.equal(merged.lastWrong,e.now()+1000);
});
test('study streak spans both directions, survives until the next day ends, and weekly goals merge',()=>{
  const e=load();for(let day=0;day<4;day++){e.setNow(Date.parse('2026-09-28T12:00:00Z')+day*86400000);e.progress.startRun('d'+day);for(let i=1;i<=5;i++)answer(e,'d'+day,i,{mode:day%2?'writing':'reading'});}
  assert.equal(e.progress.routine().streak,4);assert.equal(e.progress.routine().weekDays,4);
  e.setNow(e.now()+86400000);assert.equal(e.progress.routine().streak,4);
  e.setNow(e.now()+86400000);assert.equal(e.progress.routine().streak,0);
});
test('storage journal replays interrupted answer writes before progress loads and stays out of backups',()=>{
  const e=load({modeAtlasPracticeTransaction:{charStats:JSON.stringify({'あ':{correct:3}}),modeAtlasProgress:JSON.stringify({version:3,legacySeeded:true,sources:{old:{'kana.reading.correct':3}}}),'unrelated':'leave alone'}});
  assert.equal(e.progress.getXP(),3);assert.equal(e.root.ModeAtlasStorage.readModeJSON('reading','charStats',{})['あ'].correct,3);
  assert.equal(e.values.has('modeAtlasPracticeTransaction'),false);assert.equal(e.values.has('unrelated'),false);
  e.root.ModeAtlasStorage.setJSON('modeAtlasPracticeCheckpoint:reading',{private:true});assert.equal('modeAtlasPracticeCheckpoint:reading' in e.root.ModeAtlasStorage.snapshotBackupStorage(),false);
  const previous=e.progress.getXP();assert.throws(()=>e.root.ModeAtlasStorage.transaction(()=>{e.progress.award('kana.reading.correct',5);throw new Error('abort');}));assert.equal(e.progress.getXP(),previous);
});
test('run recovery receipts stay bounded without trimming lifetime XP',()=>{
  const e=load();for(let i=0;i<120;i++){e.setNow(e.now()+1000);e.progress.startRun('run'+i);answer(e,'run'+i,1);}
  assert.equal(Object.keys(e.progress.readState().runs).length,64);assert.equal(e.progress.getLifetimeCorrect(),120);assert.ok(e.progress.getXP()>=240);
});

test('untrusted progress rejects prototype keys and keeps oversized counters finite',()=>{
  const {progress:p}=load();
  const input=JSON.parse('{"legacySeeded":true,"sources":{"__proto__":{"kana.reading.correct":100},"normal":{"constructor":99,"kana.reading.correct":1e308}},"events":{"fake":{"type":"constructor","id":"bad"}},"credits":{"__proto__":{"answer":100}},"activity":{"2026-09-30":null},"adjustments":{"bad":{"id":"__proto__","amount":5}}}');
  const result=p.getSummary(input),normalized=p.normalizeState(input);
  assert.equal(result.xp,Number.MAX_SAFE_INTEGER);assert.equal(result.lifetimeCorrect,Number.MAX_SAFE_INTEGER);
  assert.deepEqual(Object.keys(normalized.sources),['normal']);assert.equal(Object.keys(normalized.events).length,0);
  assert.equal(Object.keys(normalized.credits).length,0);assert.equal(Object.keys(normalized.adjustments).length,0);
  assert.equal({}.answer,undefined);
});

test('exclusive rewards are hidden and locked without a matching grant; admin custom access does not grant levels',()=>{
  const e=load(),rules=e.root.ModeAtlasRewardRules,custom=rules.item('banners','hunny');
  assert.equal(rules.visible(custom,50,{}),false);assert.equal(e.progress.selectBanner('hunny'),false);
  assert.equal(rules.banner('hunny',50,{}).id,'plain');
  for(const access of [{grants:['hunny-tester']},{allCustom:true}]){
    e.root.ModeAtlasRewardAccess={current:()=>access};
    assert.equal(rules.visible(custom,1,access),true);assert.equal(e.progress.selectBanner('hunny'),true);
    assert.equal(e.progress.selectBanner('horizon'),false);
    for(const type of ['banners','frames','icons','avatars']){
      assert.ok(rules.catalogue[type].length);assert.equal(rules.allowed(type,'missing',50,access),false);
    }
  }
  assert.equal(e.progress.getXP(),0);
});

test('reward access survives offline reload for its owner only and ignores delayed responses after an account switch',async()=>{
  const createAccess=require('../assets/app/mode-atlas-reward-access.js');
  let uid='tester',cache=null,online=true,clock=100000,finish;
  const deps={user:()=>uid,online:()=>online,read:()=>cache,write:value=>{cache=value;},now:()=>clock,fetch:()=>new Promise(resolve=>{finish=resolve;})};
  const a=createAccess(deps),pending=a.refresh();finish({grants:['hunny-tester'],allCustom:false,validUntil:clock+1000});await pending;
  assert.deepEqual(a.current().grants,['hunny-tester']);
  online=false;const restored=createAccess(deps);await restored.refresh();assert.deepEqual(restored.current().grants,['hunny-tester']);
  uid='stranger';assert.deepEqual(restored.current().grants,[]);
  online=true;uid='tester';const delayed=a.refresh(true);a.clear();uid='stranger';finish({grants:[],allCustom:true,validUntil:clock+1000});await delayed;
  assert.deepEqual(a.current().grants,[]);assert.equal(a.current().allCustom,false);assert.equal(cache,null);
  const ordinary=a.refresh();finish({grants:[],allCustom:false,validUntil:clock+1000});await ordinary;assert.equal(a.current().allCustom,false);
  cache={uid,checkedAt:clock,access:{grants:['hunny-tester'],validUntil:clock+1000}};clock+=1001;assert.deepEqual(a.current().grants,[]);
  uid='';assert.deepEqual(a.current().grants,[]);
});

test('reward access shares in-flight reads, handles older backends and keeps grant data outside save exports',async()=>{
  const createAccess=require('../assets/app/mode-atlas-reward-access.js');let cache=null,calls=0,clock=100000;
  const a=createAccess({user:()=> 'tester',online:()=>true,read:()=>cache,write:value=>{cache=value;},now:()=>clock,fetch:async()=>{calls++;return {ok:true};}});
  await Promise.all([a.refresh(),a.refresh()]);assert.equal(calls,1);assert.equal(a.status(),'error');assert.deepEqual(a.current().grants,[]);
  const e=load();assert.equal(e.root.ModeAtlasStorage.isBackupKey('modeAtlasRewardAccess'),false);
  e.root.ModeAtlasStorage.setJSON('modeAtlasRewardAccess',{allCustom:true});e.root.ModeAtlasStorage.clearAppData();assert.equal(e.root.ModeAtlasStorage.get('modeAtlasRewardAccess',null),null);
});
