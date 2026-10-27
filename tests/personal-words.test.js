'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const factory=require('../assets/app/mode-atlas-wordbank.js');
const japanese=require('../assets/app/mode-atlas-japanese.js')(require('../assets/data/mode-atlas-kana-data.js'));
function fixture(rows=[]){
  const values=new Map([['kanaWordBank',JSON.stringify(rows)]]),habits=[];let fail=false;
  const root={ModeAtlasJapanese:japanese,crypto:require('node:crypto').webcrypto,
    ModeAtlasStorage:{json:(key,fallback)=>values.has(key)?JSON.parse(values.get(key)):fallback,setJSON:(key,value)=>{if(fail)return false;values.set(key,JSON.stringify(value));return true;},set:(key,value)=>values.set(key,String(value)),transaction:fn=>{const previous=new Map(values);try{return fn();}catch(error){values.clear();for(const [k,v]of previous)values.set(k,v);throw error;}}},
    ModeAtlasProgress:{recordHabit:value=>habits.push(value)},ModeAtlasWordLessonState:{read:()=>({})}};
  return {bank:factory(root),values,root,habits,fail:()=>{fail=true;}};
}
const item={id:'cat',written:'猫',reading:'ねこ',english:'cat',notes:'My own example',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z'};
const t=Date.parse('2026-10-27T00:00:00Z');
const plain=v=>JSON.parse(JSON.stringify(v));

test('personal collection retains incomplete words and exposes only answerable skills',()=>{
  const {bank}=fixture([{id:'unknown',written:'猫'}, {...item,id:'meaning',reading:''},{id:'kana',written:'いぬ',english:''}]);
  const rows=bank.read();assert.equal(rows.length,3);
  assert.deepEqual(bank.availableSkills(rows[0]),[]);assert.deepEqual(bank.availableSkills(rows[1]),['meaning']);assert.deepEqual(bank.availableSkills(rows[2]),['reading','listening']);
  assert.throws(()=>bank.review('unknown',true,t,'reading'),/reading/);
  assert.equal(bank.matchesMeaning('cat',rows[1]),null,'freeform personal English is not an objective answer key');
});

test('teaching and immediate learning recall do not award spaced retention levels',()=>{
  const {bank,habits}=fixture([item]);const before=bank.read()[0];bank.introduce(item.id,bank.snapshot(before,'teach'),t);
  let row=bank.read()[0];assert.equal(row.readingReview.introducedAt,t);assert.equal(row.readingReview.level,0);assert.equal(row.readingReview.events.length,0);
  bank.review(item.id,true,t+1000,'reading',{kind:'learn',snapshot:bank.snapshot(row,'reading')});row=bank.read()[0];
  assert.equal(row.readingReview.level,0);assert.equal(row.readingReview.due,t+1000+86400000);assert.equal(row.review.last,0);assert.equal(row.listeningReview.last,0);assert.equal(habits.length,1);
  bank.review(item.id,true,t+2000,'reading',{kind:'learn'});assert.equal(bank.read()[0].readingReview.due,row.readingReview.due);
  bank.review(item.id,true,row.readingReview.due,'reading');assert.equal(bank.read()[0].readingReview.level,1);
});

test('meaning, reading and listening answers keep independent evidence',()=>{
  const {bank}=fixture([item]);bank.review(item.id,true,t,'meaning');bank.review(item.id,false,t+1000,'reading');bank.review(item.id,true,t+2000,'listening');
  const row=bank.read()[0];assert.equal(row.review.events.length,1);assert.equal(row.readingReview.events.length,1);assert.equal(row.listeningReview.events.length,1);
  assert.equal(row.review.level,1);assert.equal(row.readingReview.level,0);assert.equal(row.listeningReview.level,1);
});

test('editing content resets only dependent evidence and retains unrelated metadata',()=>{
  const {bank}=fixture([item]);for(const skill of bank.SKILLS)bank.review(item.id,true,t,skill);
  let row=bank.read()[0];bank.save([{...row,english:'feline'}]);row=bank.read()[0];assert.equal(row.review.events.length,0);assert.equal(row.readingReview.events.length,1);assert.equal(row.listeningReview.events.length,1);assert.equal(row.notes,item.notes);
  bank.save([{...row,reading:'ネコ'}]);row=bank.read()[0];assert.equal(row.readingReview.events.length,0);assert.equal(row.listeningReview.events.length,0);
  bank.review(item.id,true,Date.now()+1000,'listening');row=bank.read()[0];bank.save([{...row,written:'ねこ'}]);row=bank.read()[0];assert.equal(row.listeningReview.events.length,1,'changing a visual prompt does not invalidate listening');
  const before=plain(row);bank.save([{...row,notes:'Changed note',favorite:true}]);row=bank.read()[0];for(const skill of bank.SKILLS)assert.deepEqual(row[bank.reviewKey(skill)],before[bank.reviewKey(skill)]);
});

test('a stale question cannot grade changed content but unaffected skills remain valid',()=>{
  const {bank}=fixture([item]),old=bank.read()[0],meaning=bank.snapshot(old,'meaning'),reading=bank.snapshot(old,'reading');
  bank.save([{...old,english:'feline'}]);assert.throws(()=>bank.review(item.id,true,t,'meaning',{snapshot:meaning}),/changed/);
  assert.doesNotThrow(()=>bank.review(item.id,true,t,'reading',{snapshot:reading}));
  bank.save([]);assert.throws(()=>bank.review(item.id,true,t,'reading',{snapshot:reading}),/removed/);
});

test('concurrent devices preserve separate skill reviews and same-skill answers without duplicates',()=>{
  const a=fixture([item]).bank,b=fixture([item]).bank;
  a.review(item.id,true,t,'meaning');a.review(item.id,true,t+1000,'reading');b.review(item.id,false,t+2000,'reading');b.review(item.id,true,t+3000,'listening');
  const merged=a.mergeRecords(a.read(),b.read()),reverse=a.mergeRecords(b.read(),a.read());assert.deepEqual(merged,reverse);assert.deepEqual(a.mergeRecords(merged,a.read()),merged);
  assert.equal(merged[0].review.events.length,1);assert.equal(merged[0].readingReview.events.length,2);assert.equal(merged[0].listeningReview.events.length,1);assert.equal(merged[0].readingReview.level,0);
});

test('content edits win over reviews of the old snapshot, including a later edit back',()=>{
  const a=fixture([item]).bank,b=fixture([item]).bank;
  a.review(item.id,true,t+1000,'meaning');a.review(item.id,true,t+2000,'reading');
  b.save([{...b.read()[0],english:'feline'}]);let merged=b.mergeRecords(a.read(),b.read());
  assert.equal(merged[0].english,'feline');assert.equal(merged[0].review.events.length,0);assert.equal(merged[0].readingReview.events.length,1);
  b.save([{...b.read()[0],english:'cat'}]);merged=b.mergeRecords(a.read(),b.read());assert.equal(merged[0].english,'cat');assert.equal(merged[0].review.events.length,0,'reverting the text must not resurrect evidence invalidated by its edit');
});

test('legacy schedules survive migration and tombstones always win',()=>{
  const {bank}=fixture([{...item,review:{level:4,due:t+1000,last:t-1000}}]);
  const old=bank.read()[0];assert.equal(old.review.level,4);assert.equal(old.review.due,t+1000);assert.equal(old.review.events.length,0);
  bank.review(item.id,true,t,'meaning');assert.equal(bank.read()[0].review.level,4);assert.equal(bank.read()[0].review.due,t+1000);
  assert.deepEqual(bank.mergeRecords(bank.read(),[item],{cat:t}),[]);
});

test('explicit answer lists can grade meaning, but editing freeform meaning clears a stale key',()=>{
  const {bank}=fixture([{...item,acceptedMeanings:['cat','feline']}]);assert.equal(bank.matchesMeaning(' Cat! ',bank.read()[0]),true);assert.equal(bank.matchesMeaning('dog',bank.read()[0]),false);
  bank.save([{...bank.read()[0],english:'a different meaning'}]);assert.equal(bank.matchesMeaning('cat',bank.read()[0]),null);
});

test('bounded history folds older events into a schedule baseline without losing retention',()=>{
  const {bank}=fixture([item]);let at=t;
  for(let i=0;i<80;i++){bank.review(item.id,true,at,'meaning');at=bank.read()[0].review.due;}
  const row=bank.read()[0];assert.equal(row.review.events.length,64);assert.equal(row.review.level,8);assert.ok(row.review.base.last>0);assert.deepEqual(bank.mergeRecords([row],[row])[0],row);
});

test('next action resumes a saved personal set before recommending new words',()=>{
  const {bank,root}=fixture([item]);assert.equal(bank.nextAction().kind,'learn');
  root.ModeAtlasWordLessonState.read=()=>({'wordbank-course':{course:{kind:'review',wordIds:['cat'],tasks:[{id:'cat',mode:'meaning',snapshot:bank.snapshot(bank.read()[0],'meaning')}],cursor:0,completedAt:0}}});
  assert.equal(bank.nextAction().kind,'review');assert.match(bank.nextAction().title,/Continue/);
});

test('changed pending content rebuilds only the original selection and preserves independent answers',()=>{
  const {bank,root}=fixture([item,{...item,id:'outside',written:'犬',reading:'いぬ',english:'dog'}]);
  root.ModeAtlasWordLessonState=require('../assets/app/mode-atlas-word-lesson-state.js')(root);
  bank.introduce('cat',bank.snapshot(bank.read()[0],'teach'),t);bank.review('cat',true,t+1,'reading',{kind:'learn'});
  const old=bank.read()[0];
  root.ModeAtlasWordLessonState.checkpoint('wordbank-course',{course:{id:'wordbank-course',kind:'learn',wordIds:['cat'],selectionIds:['cat'],tasks:[{id:'cat',mode:'meaning',snapshot:bank.snapshot(old,'meaning')}],cursor:0}});
  bank.save(bank.read().map(word=>word.id==='cat'?{...word,english:'feline'}:word));
  const pending=bank.pendingCourse();assert.equal(pending.restartRequired,true);assert.deepEqual(pending.selectionIds,['cat']);
  assert.equal(bank.read().find(word=>word.id==='cat').readingReview.events.length,1);
  bank.save(bank.read().filter(word=>word.id!=='cat'));
  assert.equal(bank.pendingCourse(),null,'a removed selection cannot trap Home in stale continuation');assert.doesNotMatch(bank.nextAction().title,/Continue/);
});

test('deleted or newly incomplete pending entries never widen a selection or resume an unusable task',()=>{
  const {bank,root}=fixture([item,{...item,id:'selected-dog',written:'犬',reading:'いぬ',english:'dog'},{...item,id:'outside'}]);
  root.ModeAtlasWordLessonState=require('../assets/app/mode-atlas-word-lesson-state.js')(root);
  root.ModeAtlasWordLessonState.checkpoint('wordbank-course',{course:{id:'wordbank-course',kind:'learn',wordIds:['cat','selected-dog'],selectionIds:['cat','selected-dog'],tasks:bank.read().slice(0,2).map(word=>({id:word.id,mode:'teach',snapshot:bank.snapshot(word,'teach')})),cursor:0}});
  bank.save(bank.read().filter(word=>word.id!=='cat'));assert.deepEqual(bank.pendingCourse().selectionIds,['selected-dog']);
  bank.save(bank.read().map(word=>word.id==='selected-dog'?{...word,reading:'',english:''}:word));
  assert.equal(bank.pendingCourse(),null);assert.deepEqual(bank.untaught([]),[]);
});

test('a completed five-word batch retains and resumes the full selected learning set',()=>{
  const rows=Array.from({length:7},(_,index)=>({...item,id:'selected-'+index}));
  const {bank,root}=fixture(rows);root.ModeAtlasWordLessonState=require('../assets/app/mode-atlas-word-lesson-state.js')(root);
  const selectionIds=rows.slice(0,6).map(word=>word.id),wordIds=selectionIds.slice(0,5);
  for(const id of wordIds)bank.introduce(id,bank.snapshot(bank.read().find(word=>word.id===id),'teach'),t);
  root.ModeAtlasWordLessonState.checkpoint('wordbank-course',{course:{id:'wordbank-course',kind:'learn',script:'personal',selectionIds,wordIds,tasks:wordIds.map(id=>({id,mode:'teach'})),cursor:5,phase:'complete',completedAt:t+1000}});
  const saved=bank.pendingCourse();assert.deepEqual(saved.selectionIds,selectionIds);assert.equal(saved.wordIds.length,5);assert.match(bank.nextAction().title,/Continue/);
  assert.deepEqual(bank.untaught(saved.selectionIds).map(word=>word.id),['selected-5'],'the unselected entry is not added to this lesson');
  bank.introduce('selected-5',bank.snapshot(bank.read().find(word=>word.id==='selected-5'),'teach'),t+2000);
  assert.equal(bank.pendingCourse(),null,'a fully introduced selection no longer resumes an old recap');
  assert.deepEqual(bank.untaught().map(word=>word.id),['selected-6']);
});

test('failed storage writes do not record a learning habit',()=>{
  const {bank,fail,habits,values}=fixture([item]),before=values.get('kanaWordBank');fail();assert.throws(()=>bank.review(item.id,true,t,'meaning'),/saved/);assert.equal(values.get('kanaWordBank'),before);assert.equal(habits.length,0);
});

test('real save-section merge is a no-op on normalized legacy and undated bank records',()=>{
  const {bank,root}=fixture();root.ModeAtlasWordBank=bank;
  root.ModeAtlasWordLessonState=require('../assets/app/mode-atlas-word-lesson-state.js')(root);
  const merge=require('../assets/app/mode-atlas-save-merge.js')(root);
  const input={updatedAt:1,data:{items:[{...item,createdAt:'2026-10-01',updatedAt:'2026-10-01'},{id:'undated',written:'いぬ',english:'dog'}]}};
  const once=merge.section('wordBank',input,{}),twice=merge.section('wordBank',once,once);
  assert.deepEqual(twice,once);assert.deepEqual(merge.section('wordBank',twice,once),once);
});
test('meeting a personal word records its continuation without inventing an answer or study credit',()=>{
 const {bank,root,habits,fail}=fixture([item]),visits=[];root.ModeAtlasVisitFlows={recordActivity:kind=>visits.push(kind)};
 bank.introduce(item.id,bank.snapshot(bank.read()[0],'teach'),t);assert.deepEqual(visits,['wordBank']);assert.equal(habits.length,0);assert.equal(bank.read()[0].readingReview.events.length,0);
 fail();assert.throws(()=>bank.introduce(item.id,bank.snapshot(bank.read()[0],'teach'),t+1));assert.deepEqual(visits,['wordBank']);
});
test('a stale content editor cannot erase newer evidence for unchanged skills',()=>{
 const {bank}=fixture([item]),stale=bank.read()[0];bank.review(item.id,true,t,'reading');bank.review(item.id,true,t,'listening');
 bank.save([{...stale,english:'feline'}]);const edited=bank.read()[0];assert.equal(edited.english,'feline');assert.equal(edited.readingReview.events.length,1);assert.equal(edited.listeningReview.events.length,1);assert.equal(edited.review.events.length,0);
});
