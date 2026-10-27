const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const plain=v=>JSON.parse(JSON.stringify(v));
function load(){
  const values=new Map();let now=Date.parse('2026-10-18T12:00:00Z'),serial=0,failed=false,uid='guest';
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(failed&&k==='modeAtlasKanaLearning'){failed=false;throw Error('Quota');}values.set(k,String(v));},removeItem:k=>values.delete(k),get length(){return values.size;},key:i=>[...values.keys()][i]??null};
  const root={setTimeout:()=>0,clearTimeout(){},Date:Clock,URLSearchParams,console,structuredClone,localStorage,sessionStorage:localStorage,crypto:{randomUUID:()=>String(++serial)},CustomEvent:class{},dispatchEvent(){},addEventListener(){},document:{addEventListener(){}},KanaCloudSync:{getUser:()=>uid==='guest'?null:{uid},scheduleSync(){},markSectionUpdated(){}}};root.window=root;
  const context=vm.createContext(root);
  for(const file of ['app/mode-atlas-date','app/mode-atlas-storage','app/mode-atlas-review','data/mode-atlas-kana-data','app/mode-atlas-kana-learning','app/mode-atlas-kana-placement','app/mode-atlas-japanese','data/mode-atlas-kana-coaching'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets',file+'.js'),'utf8'),context);
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
  s=P.advance(P.answer(s,'wrong'));assert.equal(P.question(s).skill,'reading','one error gets a confirmation question');s=P.advance(P.answer(s,'wrong'));assert.equal(P.question(s).skill,'writing');assert.equal(P.question(s).row.id,'hiragana:base:a');
  const q=P.question(s);assert.equal(P.grade(q,q.roman),false);assert.equal(P.grade(q,q.char),true);assert.equal(P.choices(s).length,6);
  s=P.advance(P.answer(s,'wrong'));s=P.advance(P.answer(s,'wrong'));assert.ok(s.finished);assert.equal(L.path('hiragana','writing')[1].unlocked,false);assert.equal(values.has('modeAtlasProgress'),false);
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
  assert.equal(result.readingMastered,2);assert.equal(result.writingMastered,1);assert.equal(result.combinedMastered,1);assert.equal(result.projectionVersion,7);
});

test('malformed scalar fields and placement tracks cannot break curriculum or public profiles',()=>{
  const {L,P}=load(),bad={toString:5};
  const state=L.normalize({startedAt:bad,updatedAt:bad,earned:{reading:{'あ':bad}},introduced:{'あ':bad},handwriting:{'あ':[{id:'x',at:bad}]}});
  assert.equal(state.startedAt,0);assert.equal(state.updatedAt,0);assert.equal(Object.keys(state.earned.reading).length,0);
  const placement=P.begin();assert.equal(P.valid({...placement,tracks:[null]}),null);
  const result=require('../backend/functions/projection.cjs').projectSave({sections:{reading:{data:{stats:{'あ':null,'い':{correct:bad,wrong:bad}},times:{'あ':null,'い':bad},srs:{'う':{reviewVersion:1,level:bad,days:[bad,null],recent:[{id:'bad',at:bad,quality:2}]}}}},kanaLearning:{data:{state}}}});
  assert.equal(result.readingMastered,0);assert.equal(result.combinedMastered,0);
});

test('mastery guidance distinguishes required recall evidence from lifetime and fluency diagnostics',()=>{
  const {L}=load(),s=L.start();s.earned.reading['あ']=4;
  const record={reviewVersion:1,level:4,days:['2026-10-12','2026-10-13','2026-10-14','2026-10-15'],recent:Array.from({length:19},(_,i)=>({id:String(i),at:i+1,quality:2}))};
  const e={readingStats:{'あ':{correct:52,wrong:30}},readingTimes:{'あ':1600},readingReview:{'あ':record}};
  let guide=L.guidance('あ','reading',s,e);assert.equal(guide.label,'Mastered');
  const checks=Object.fromEntries(guide.checks.map(c=>[c.id,c]));assert.equal(checks.correct.met,true);assert.equal(checks.accuracy.met,null);assert.equal(checks.time.met,null);assert.equal(checks['recent-attempts'].met,false);assert.equal(checks.spacing.met,true);
  record.recent.push({id:'last',at:20,quality:2});
  assert.equal(L.currentStage('あ','reading',e,s),5);assert.ok(L.guidance('あ','reading',s,e).checks.filter(c=>c.required!==false).every(c=>c.met));
  s.earned.reading['あ']=5;record.recent[0].quality=0;record.recent[1].quality=0;
  assert.equal(L.earned('あ','reading',s,e),5);assert.equal(L.guidance('あ','reading',s,e).checks.find(c=>c.id==='recent-accuracy').met,false);
});
test('familiar and handwriting targets use the same evidence as advancement, with no hinted shortcuts',()=>{
  const {L}=load(),s=L.start(),e={readingStats:{'あ':{correct:20,wrong:1}},readingReview:{'あ':{reviewVersion:1,recent:[2,2,2,1,0].map((quality,i)=>({id:String(i),at:i+1,quality}))}}};
  const guide=L.guidance('あ','reading',s,e);assert.equal(guide.target,3);assert.deepEqual(plain(guide.checks.map(c=>[c.value,c.met])),[[3,true],[75,false]]);assert.equal(L.currentStage('あ','reading',e,s),2);
  e.readingReview['あ'].recent.pop();assert.equal(L.currentStage('あ','reading',e,s),3);assert.equal(L.guidance('あ','reading',s,e).achieved,3);assert.equal(L.guidance('あ','reading',s,e).target,4);
  s.handwriting['あ']=[{id:'trace',at:1,independent:false}];assert.equal(L.guidance('あ','handwriting',s,e).checks[0].met,false);
  s.handwriting['あ'].push({id:'write',at:2,independent:true});assert.equal(L.currentStage('あ','handwriting',e,s),3);assert.equal(L.guidance('あ','handwriting',s,e).label,'Confident');
});
test('legacy and optional evidence is labelled honestly until new practice adds review history',()=>{
  const {L}=load(),s=L.start();s.earned.reading['あ']=3;
  const e={readingStats:{'あ':{correct:10,wrong:0}},readingReview:{}};
  let guide=L.guidance('あ','reading',s,e);assert.equal(guide.target,5);assert.equal(guide.legacy,true);assert.equal(guide.checks.find(c=>c.id==='days').met,null);
  e.readingStats['あ'].correct=3;e.readingReview['あ']={reviewVersion:1,recent:[{id:'x',at:1,quality:2}]};
  guide=L.guidance('あ','reading',s,e);assert.equal(guide.target,4);assert.equal(guide.legacy,false);assert.equal(guide.checks.find(c=>c.id==='days').met,false);assert.equal(guide.checks.find(c=>c.id==='time').met,null);assert.equal(guide.checks.find(c=>c.id==='time').optional,true);
});

test('lesson checkpoints introduce characters without inventing recall or listening mastery',()=>{
  const {L,values}=load();L.start();L.completeLessonCharacter('あ');L.completeLessonCharacter('い',{listened:true});
  const state=L.read();assert.ok(state.lessonChecks['あ']);assert.ok(state.introduced['あ']);assert.equal(state.listeningChecks['あ'],undefined);assert.ok(state.listeningChecks['い']);
  assert.equal(L.stage('あ'),1);assert.equal(L.path('hiragana','reading')[1].unlocked,false);assert.equal(values.has('charStats'),false);assert.equal(values.has('modeAtlasProgress'),false);
  assert.equal(L.completeLessonCharacter('invalid'),false);assert.equal(L.introduceSound('invalid'),false);
});
test('guided journey balances each row before advancing and mixed practice excludes merely unlocked kana',()=>{
  const {L}=load();let s=L.start();assert.equal(L.journey().phase,'learn');assert.deepEqual(plain(L.learnedPool()),[]);
  for(const c of 'あいうえお')L.completeLessonCharacter(c);assert.equal(L.journey().phase,'reading');assert.equal(L.learnedPool().join(''),'あいうえお');
  s=L.read();for(const c of 'あいうえお')s.earned.reading[c]=3;L.save(s);
  assert.equal(L.path('hiragana','reading')[1].unlocked,true);assert.equal(L.learnedPool().includes('か'),false);assert.equal(L.journey().phase,'writing');assert.equal(L.journey().row.id,'hiragana:base:a');
  for(const c of 'あいうえお')s.earned.writing[c]=3;L.save(s);assert.equal(L.journey().phase,'learn');assert.equal(L.journey().row.id,'hiragana:base:ka');
});
test('full-script assessments require familiar rows, while placed experience keeps its access',()=>{
  const {L}=load(),s=L.start(),base=L.rows.filter(r=>r.script==='hiragana'&&r.group==='base');
  for(const row of base.slice(0,-1))for(const c of row.chars)s.earned.reading[c]=3;L.save(s);
  assert.ok(L.path('hiragana','reading').filter(r=>r.group==='base').every(r=>r.unlocked));assert.equal(L.testScripts('reading').includes('hiragana'),false);
  L.place('reading',base.at(-1).id);assert.equal(L.testScripts('reading').includes('hiragana'),true);
});
test('lesson and sound introductions merge across devices without duplicate or foreign evidence',()=>{
  const {L}=load(),a=L.normalize({lessonChecks:{'あ':8},listeningChecks:{'あ':9},sounds:{longVowels:10}}),b=L.normalize({lessonChecks:{'あ':7,'い':12},sounds:{sokuon:11,longVowels:15}});
  const result=L.merge(a,b);assert.equal(result.lessonChecks['あ'],7);assert.equal(result.sounds.longVowels,10);assert.deepEqual(plain(result),plain(L.merge(b,a)));assert.deepEqual(plain(L.merge(result,result)),plain(result));
  assert.deepEqual(plain(L.normalize({lessonChecks:{bad:1,'あ':{}},sounds:{unknown:3,sokuon:{}}}).sounds),{});
});

test('lesson sound checks accept chart aliases and spoken o for wo, without accepting copied kana',()=>{
  const {root}=load(),grade=root.ModeAtlasKanaCoaching.matches;
  for(const [char,answer]of [['を','o'],['ヲ','wo'],['し','si'],['ち','ti'],['ん','nn']])assert.equal(grade(char,answer),true);
  assert.equal(grade('あ','あ'),false);assert.equal(grade('お','wo'),false);assert.equal(grade('し','chi'),false);
});
