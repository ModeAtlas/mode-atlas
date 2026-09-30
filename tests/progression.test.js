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
  assert.deepEqual(plain(e.progress.finishRun(session).parts),{completion:5,accuracy:15,streak:5});
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
  assert.equal(a.progress.getXP(merged),80); // 40 answers + 20 direction milestones + two 10 XP goals.
  const same=b.progress.mergeStates(left,left);assert.equal(b.progress.getXP(same),30);
});
test('daily/test completion awards are capped per direction and day, with only improved accuracy topping up',()=>{
  const e=load();
  function finish(id,correct){e.progress.startRun(id);return e.progress.finishRun({runId:id,direction:'reading',day:'2026-09-30',mode:'dailyChallenge',answered:20,correct,unique:12,bestStreak:0,completed:true}).xp;}
  assert.equal(finish('first',16),15);assert.equal(finish('same',16),0);assert.equal(finish('better',20),10);assert.equal(finish('again',20),0);
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
