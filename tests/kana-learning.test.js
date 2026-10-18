const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const plain=v=>JSON.parse(JSON.stringify(v));
function load(){
  const values=new Map();let now=Date.parse('2026-10-18T12:00:00Z'),serial=0,failed=false,uid='guest';
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(failed&&k==='modeAtlasKanaLearning'){failed=false;throw Error('Quota');}values.set(k,String(v));},removeItem:k=>values.delete(k),get length(){return values.size;},key:i=>[...values.keys()][i]??null};
  const root={Date:Clock,URLSearchParams,console,structuredClone,localStorage,sessionStorage:localStorage,crypto:{randomUUID:()=>String(++serial)},CustomEvent:class{},dispatchEvent(){},addEventListener(){},document:{addEventListener(){}},KanaCloudSync:{getUser:()=>uid==='guest'?null:{uid},scheduleSync(){},markSectionUpdated(){}}};root.window=root;
  const context=vm.createContext(root);
  for(const file of ['app/mode-atlas-date','app/mode-atlas-storage','app/mode-atlas-review','data/mode-atlas-kana-data','app/mode-atlas-kana-learning','app/mode-atlas-kana-placement'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets',file+'.js'),'utf8'),context);
  return {L:root.ModeAtlasKanaLearning,P:root.ModeAtlasKanaPlacement,root,values,advance:ms=>now+=ms,fail:()=>failed=true,owner:value=>uid=value};
}
test('fresh accounts choose an entry and each script/skill starts at its own A-row',()=>{
  const {L}=load();assert.equal(L.initialize().startedAt,0);L.start();
  for(const skill of L.skills)for(const script of L.scripts){const path=L.path(script,skill);assert.deepEqual(plain(path.filter(r=>r.unlocked).map(r=>r.id)),[script+':base:a']);}
  assert.deepEqual(plain(L.testScripts('reading')),[]);assert.equal(Object.keys(L.selection({kanaRows:[]},'reading')).length,0);
  assert.equal(Object.keys(L.selection({kanaRows:['hiragana:base:ka','katakana:base:a']},'reading')).join(''),'アイウエオ');
});
test('independent familiarity opens only the next row and persists when a new skill is attempted',()=>{
  const {L}=load(),s=L.start();for(const char of 'あいうえお')s.earned.reading[char]=3;L.save(s);
  assert.equal(L.path('hiragana','reading')[1].unlocked,true);assert.equal(L.path('hiragana','reading')[2].unlocked,false);assert.equal(L.path('hiragana','writing')[1].unlocked,false);assert.equal(L.path('katakana','reading')[1].unlocked,false);
  const before=L.stage('あ');L.recordRecall('writing','あ',{writingStats:{'あ':{wrong:1}},writingReview:{},writingTimes:{}});assert.equal(L.stage('あ'),before);
});
test('one map requires both recall skills for Mastered and optional independent handwriting for Mastered+',()=>{
  const {L}=load(),s=L.start();s.earned.reading['あ']=5;L.save(s);assert.equal(L.stage('あ'),3);
  s.earned.writing['あ']=5;L.save(s);assert.equal(L.stage('あ'),5);
  s.earned.handwriting['あ']=5;L.save(s);assert.equal(L.stage('あ'),6);
  assert.equal(L.details('あ').skills[0].stage,5);assert.equal(L.details('あ').skills[0].review,true);
});
test('hints do not substitute for independent familiarity, exact mastery evidence is still required',()=>{
  const {L}=load(),s=L.start(),e={readingStats:{'あ':{correct:55,wrong:1}},readingTimes:{'あ':{avg:1100,count:56}},readingReview:{'あ':{reviewVersion:1,recent:[1,2,3].map(id=>({id:String(id),at:1,quality:1}))}}};
  assert.equal(L.currentStage('あ','reading',e,s),2);
  e.readingReview['あ'].recent=[2,2,2,0].map((quality,id)=>({id:String(id),at:1,quality}));assert.equal(L.currentStage('あ','reading',e,s),2);
  e.readingReview['あ'].recent=[2,2,2].map((quality,id)=>({id:String(id),at:1,quality}));assert.equal(L.currentStage('あ','reading',e,s),3);
});
test('migration keeps studied row access and counters without inventing independent mastery',()=>{
  const {L,values}=load();values.set('charStats',JSON.stringify({'さ':{correct:8,wrong:4},'か':{correct:0,wrong:0}}));const original=values.get('charStats'),s=L.initialize();
  assert.equal(s.startKind,'existing');assert.equal(L.path('hiragana','reading')[3].unlocked,true);assert.equal(L.path('hiragana','writing')[1].unlocked,false);assert.equal(L.stage('さ'),2);assert.equal(values.get('charStats'),original);
  assert.equal(L.initialize().startedAt,s.startedAt);
});
test('placement assesses directions separately, grants rows once, and never awards stats or XP',()=>{
  const {L,P,root,values}=load();let s=P.begin(['hiragana']);
  for(let i=0;i<2;i++){s=P.answer(s,P.question(s).roman);s=root.ModeAtlasStorage.transaction(()=>P.advance(s));}
  assert.equal(L.path('hiragana','reading')[1].unlocked,true);assert.equal(L.stage('あ'),0);assert.equal(values.has('charStats'),false);
  s=P.answer(s,'wrong');s=P.advance(s);assert.equal(P.question(s).skill,'writing');assert.equal(P.question(s).row.id,'hiragana:base:a');
  const q=P.question(s);assert.equal(P.grade(q,q.roman),false);assert.equal(P.grade(q,q.char),true);assert.equal(P.choices(s).length,6);
  s=P.answer(s,'wrong');s=P.advance(s);assert.ok(s.finished);assert.equal(L.path('hiragana','writing')[1].unlocked,false);assert.equal(values.has('modeAtlasProgress'),false);
});
test('placement checkpoint survives reload, rejects malformed or foreign saves and retains partial grants',()=>{
  const {L,P,owner}=load();let s=P.begin(['katakana']);s=P.answer(s,P.question(s).roman);assert.deepEqual(plain(P.read()),plain(s));s=P.advance(s);s=P.answer(s,P.question(s).roman);s=P.advance(s);P.finish(s);assert.equal(L.path('katakana','reading')[1].unlocked,true);
  assert.equal(P.valid({...s,correct:-1}),null);assert.equal(P.valid({...s,feedback:{correct:true,char:'BAD',roman:'bad'}}),null);owner('different');assert.equal(P.read(),null);
});
test('placement reaches the end of each basic script and opens the correct test only',()=>{
  const {L,P}=load();let s=P.begin(['katakana']);let n=0;
  while(!s.finished){const q=P.question(s);assert.ok(q);s=P.advance(P.answer(s,q.skill==='reading'?q.roman:q.char));n++;assert.ok(n<=40);}
  assert.equal(n,40);assert.deepEqual(plain(L.testScripts('reading')),['katakana']);assert.equal(Object.keys(L.testPool({},'reading')).length,46);assert.equal(L.stage('ア'),0);
});
test('handwriting traces cannot earn Mastered+; receipts need independent completion across days',()=>{
  const {L,advance}=load();L.start();const event=(id,mode='write',errors=0)=>({id,mode,at:Date.now(),errors});
  assert.equal(L.recordHandwriting('か',event('locked')),false);L.recordHandwriting('あ',event('trace','trace'));assert.equal(L.earned('あ','handwriting',L.read(),{}),2);
  for(let i=0;i<5;i++){const at=Date.parse('2026-10-18T12:00:00Z')+Math.floor(i/2)*86400000;L.recordHandwriting('あ',{...event('clean'+i),at});}
  assert.equal(L.earned('あ','handwriting',L.read(),{}),5);assert.equal(L.recordHandwriting('あ',event('clean0')),false);
});
test('multi-device curriculum merges are commutative, associative, idempotent and bounded',()=>{
  const {L}=load(),a=L.normalize({earned:{reading:{'あ':5}},introduced:{'い':2},handwriting:{'あ':[{id:'x',at:3,independent:true}]}}),b=L.normalize({earned:{writing:{'あ':4}},introduced:{'あ':1},handwriting:{'あ':[{id:'x',at:3,independent:false}]}}),c=L.normalize({earned:{reading:{'い':3}}});
  assert.equal(JSON.stringify(L.merge(a,b)),JSON.stringify(L.merge(b,a)));assert.deepEqual(plain(L.merge(a,a)),plain(a));assert.deepEqual(plain(L.merge(L.merge(a,b),c)),plain(L.merge(a,L.merge(b,c))));
  const bad=L.normalize({earned:{reading:{'<script>':99,'あ':99}},placed:{reading:{bad:1}},handwriting:{'い':Array.from({length:100},(_,i)=>({id:'i'+i,at:i+1,independent:true}))}});assert.deepEqual(Object.keys(bad.earned.reading),['あ']);assert.equal(bad.earned.reading['あ'],5);assert.equal(bad.handwriting['い'].length,8);
});
test('failed curriculum saves report failure and placement checkpoint/grant recover together',()=>{
  const e=load();e.fail();assert.throws(()=>e.L.start(),/saved/);assert.equal(e.L.read().startedAt,0);
  let s=e.P.begin(['hiragana']);s=e.P.advance(e.P.answer(s,e.P.question(s).roman));s=e.P.answer(s,e.P.question(s).roman);e.fail();assert.throws(()=>e.root.ModeAtlasStorage.transaction(()=>e.P.advance(s)));e.root.ModeAtlasStorage.transaction(()=>{});
  assert.equal(e.P.read().row,1);assert.equal(e.L.path('hiragana','reading')[1].unlocked,true);
});

test('social profiles use earned skills and include Mastered+ in ordinary mastery totals',()=>{
  const {L}=load(),state=L.normalize({earned:{reading:{'あ':5,'い':5},writing:{'あ':5},handwriting:{'あ':5}}});
  const result=require('../backend/functions/projection.cjs').projectSave({sections:{kanaLearning:{data:{state}}}});
  assert.equal(result.readingMastered,2);assert.equal(result.writingMastered,1);assert.equal(result.combinedMastered,1);assert.equal(result.projectionVersion,5);
});
