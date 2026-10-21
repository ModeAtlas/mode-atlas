'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),plain=value=>JSON.parse(JSON.stringify(value));
function browser(){
  const values=new Map(),storage={get:(k,f='')=>values.get(k)??f,set:(k,v)=>{values.set(k,String(v));return true;},remove:k=>values.delete(k),json:(k,f)=>values.has(k)?JSON.parse(values.get(k)):f,setJSON:(k,v)=>{values.set(k,JSON.stringify(v));return true;},readModeJSON:(_m,_k,f)=>f,transaction:fn=>fn()};
  const root={ModeAtlasStorage:storage,crypto:require('node:crypto').webcrypto,Blob,CompressionStream,DecompressionStream,btoa,atob,dispatchEvent:()=>{},addEventListener:()=>{}};
  const context=vm.createContext({window:root,self:root,console,Date,TextEncoder,TextDecoder,structuredClone,CustomEvent:class{},setTimeout,clearTimeout});
  for(const file of ['data/mode-atlas-kana-data','app/mode-atlas-date','app/mode-atlas-reward-rules','app/mode-atlas-progress','app/mode-atlas-review','app/mode-atlas-japanese','app/mode-atlas-kana-learning','app/mode-atlas-kana-evidence','data/mode-atlas-kanji-curriculum','app/mode-atlas-kanji-state','app/mode-atlas-kanji-codec','app/mode-atlas-wordbank','app/mode-atlas-save-merge','results/mode-atlas-results-storage','app/mode-atlas-account-transport'])vm.runInContext(fs.readFileSync(path.join(ROOT,'assets',file+'.js'),'utf8'),context);
  return {root,storage,values};
}
function database(){
  const rows=new Map();let writes=0;
  const ref=name=>({path:name,id:name.split('/').at(-1),collection:child=>({doc:id=>ref(name+'/'+child+'/'+id)})});
  const snap=r=>({ref:r,id:r.id,exists:rows.has(r.path),data:()=>structuredClone(rows.get(r.path)),updateTime:{toMillis:()=>Date.now()}});
  const db={doc:ref,getAll:async(...refs)=>refs.map(snap),runTransaction:async action=>{
    const pending=[];const result=await action({get:async r=>snap(r),getAll:async(...refs)=>refs.map(snap),set:(r,v)=>pending.push(()=>rows.set(r.path,structuredClone(v))),update:(r,v)=>pending.push(()=>rows.set(r.path,{...rows.get(r.path),...structuredClone(v)})),create:(r,v)=>pending.push(()=>{assert.ok(!rows.has(r.path));rows.set(r.path,structuredClone(v));}),delete:r=>pending.push(()=>rows.delete(r.path))});
    pending.forEach(write=>write());writes+=pending.length;return result;
  }};
  return {db,rows,writes:()=>writes};
}
function backend(file){
  const cache=new Map();
  function load(name){
    if(cache.has(name))return cache.get(name).exports;
    const mod={exports:{}};cache.set(name,mod);
    const local=require('node:module').createRequire(name);
    const req=id=>id==='firebase-functions/v2/https'?{HttpsError:class extends Error{constructor(code,message){super(message);this.code=code;}}}:id.endsWith('.cjs')?load(local.resolve(id)):local(id);
    vm.runInThisContext('(function(require,module,exports){'+fs.readFileSync(name,'utf8')+'\n})',{filename:name})(req,mod,mod.exports);return mod.exports;
  }
  return load(path.join(ROOT,'backend/functions',file));
}
test('new Kana evidence converges across devices, retries and both merge orders',()=>{
  const {root}=browser(),E=root.ModeAtlasKanaEvidence,M=root.ModeAtlasSaveMerge;
  const baseline=E.legacy({'あ':{correct:12,wrong:2}},{'あ':{avg:1000,count:14}});
  const a=E.normalize({...baseline,sources:{a:{'あ':{correct:3,wrong:1,totalMs:5200,timed:4}}}}),b=E.normalize({...baseline,sources:{b:{'あ':{correct:7,wrong:0,totalMs:7000,timed:7},'い':{correct:2,wrong:0,totalMs:1800,timed:2}}}});
  const merged=E.merge(a,b);assert.deepEqual(plain(merged),plain(E.merge(b,a)));assert.deepEqual(plain(merged),plain(E.merge(merged,a)));assert.equal(E.totals(merged).stats['あ'].correct,22);assert.equal(E.totals(merged).stats['あ'].wrong,3);
  const section=evidence=>({data:{evidence}});assert.equal(M.section('reading',section(a),section(b)).data.stats['い'].correct,2);
});
test('merging personal bests preserves numeric bests and top scores from both devices',()=>{
  const {root}=browser(),M=root.ModeAtlasSaveMerge;
  const wrap=scoreHistory=>({data:{scoreHistory}}),a=wrap({endlessBest:{correct:99},comboKanaBest:{same_row:50,random:2},speedRunTop3:[{score:9},{score:5}],timeTrialTop3:[{overTarget:5,ratio:10,score:10}]}),b=wrap({endlessBest:{correct:100},comboKanaBest:{same_row:9,random:60},speedRunTop3:[{score:100},{score:9}],timeTrialTop3:[{overTarget:7,ratio:12,score:12}]});
  const score=M.section('reading',a,b).data.scoreHistory;assert.equal(score.endlessBest.correct,100);assert.deepEqual(plain(score.comboKanaBest),{same_row:50,random:60});assert.deepEqual(plain(score.speedRunTop3.map(v=>v.score)),[100,9,5]);assert.equal(score.timeTrialTop3[0].overTarget,7);assert.deepEqual(plain(score),plain(M.section('reading',b,a).data.scoreHistory));
});
test('Word Bank record union, deletion tombstones and result migration retain independent history',()=>{
  const {root,storage}=browser(),M=root.ModeAtlasSaveMerge;
  const a={data:{items:[{id:'cat',kana:'猫',reading:'ねこ',english:'cat'}]}},b={data:{items:[{id:'dog',kana:'犬',reading:'いぬ',english:'dog'}]}};
  const union=M.section('wordBank',a,b);assert.equal(union.data.items.length,2);assert.equal(union.data.items.find(r=>r.id==='cat').romaji,'neko');
  const removed=M.section('wordBank',{data:{items:[],deleted:{cat:2}}},union);assert.deepEqual(plain(removed.data.items.map(r=>r.id)),['dog']);
  const legacy={correct:10,wrong:2,date:'2026-10-01'};storage.setJSON('testModeResults',[legacy]);storage.setJSON('kanaTrainerTestModeResults',[legacy]);
  const one=root.ModeAtlasResultsStorage.read('reading');assert.equal(one.length,1);assert.ok(one[0].id);assert.equal(storage.get('kanaTrainerTestModeResults',null),null);
  root.ModeAtlasResultsStorage.persist('reading',[]);assert.equal(M.section('readingTests',{data:{primary:one}},{data:{primary:[],deleted:storage.json('modeAtlasResultsDeleted:reading',{})}}).data.primary.length,0);
  const newer=M.snapshot({generation:2,sections:{wordBank:{data:{items:[]}}}},{generation:1,sections:{wordBank:a}});assert.equal(newer.generation,2);assert.equal(newer.sections.wordBank.data.items.length,0);
});
test('partitioned save round-trip exceeds 1 MiB, changes atomically and does not rewrite unchanged parts',async()=>{
  const {root}=browser(),{db,rows,writes}=database();let valid=true;
  const runTransaction=(_db,action)=>db.runTransaction(tx=>action({...tx,get:async ref=>{const result=await tx.get(ref);return {...result,exists:()=>result.exists,metadata:{fromCache:false}};}}));
  const transport=root.ModeAtlasAccountTransport.create({db,doc:(_db,...parts)=>db.doc(parts.join('/')),runTransaction,valid:()=>valid});
  const items=Array.from({length:1400},(_,i)=>({id:'word-'+i,written:'言葉'+i,reading:'ことば',english:'word',notes:'学'.repeat(400),createdAt:'2026-10-01',updatedAt:'2026-10-01'}));
  const input={generation:0,sections:{wordBank:{updatedAt:1,data:{items}},progress:{updatedAt:1,data:{state:{legacySeeded:true}}}}};
  const saved=await transport.write('a',input);assert.equal(saved.sections.wordBank.data.items.length,1400);assert.ok(rows.size>4);assert.ok(Buffer.byteLength(JSON.stringify(rows.get('users/a/appData/kanaTrainer')))<750000);
  const read=(await transport.read('a')).data();assert.equal(read.sections.wordBank.data.items[700].notes.length,400);
  const count=writes();await transport.write('a',saved);assert.equal(writes(),count,'unchanged partitioned accounts cause no writes');
  const reset=await transport.write('a',{sections:{wordBank:{data:{items:[]}}}},{replace:true});assert.equal(reset.generation,1);assert.equal(rows.size,1,'obsolete parts are removed in the reset transaction');
  const stale=await transport.write('a',saved);assert.equal(stale.generation,1);assert.equal(stale.sections.wordBank.data.items.length,0,'old device cannot resurrect reset history');
  valid=false;await assert.rejects(()=>transport.write('a',input),/account changed/);
});
test('early and failed reviews stay reachable, while Word Bank can distinguish written form and reading',()=>{
  const {root}=browser(),R=root.ModeAtlasReview,now=Date.now();
  const miss=R.answer({}, {id:'wrong',at:now-120000,correct:false}).entry;assert.equal(R.due({'あ':miss},['あ'],now).length,1);
  const word=root.ModeAtlasWordBank.add({written:'日本',reading:'にほん',english:'Japan'});assert.equal(word.romaji,'nihon');root.ModeAtlasWordBank.review(word.id,true,now);const due=root.ModeAtlasWordBank.read()[0].review.due;root.ModeAtlasWordBank.review(word.id,true,now+1000);assert.equal(root.ModeAtlasWordBank.read()[0].review.due,due);
});
test('economic receipts reject arbitrary XP, validate answers and remain idempotent despite forged personal saves',async()=>{
  const {db,rows}=database(),at=Date.parse('2026-10-21T12:00:00Z'),earnings=backend('study-earnings.cjs').createEarnings({db,now:()=>at});
  const receipt={id:'receipt-first',startedAt:at-10000,config:{pool:['あ','い'],direction:'reading',mode:'guided',hints:false},answers:[{index:1,kana:'あ',answer:'a',elapsed:1000},{index:2,kana:'い',answer:'wrong',elapsed:2000}],complete:true};
  const first=await earnings.submit('learner',receipt),state=structuredClone(rows.get('studyEarnings/learner'));assert.equal(first.index,2);assert.equal(first.done,true);
  await earnings.submit('learner',receipt);assert.deepEqual(rows.get('studyEarnings/learner'),state);
  rows.set('users/learner/appData/kanaTrainer',{sections:{progress:{data:{state:{legacySeeded:true,sources:{cheat:{'kana.reading.correct':9999999}}}}}}});
  await earnings.submit('learner',receipt);assert.deepEqual(rows.get('studyEarnings/learner'),state,'editable personal totals are not economic evidence');
  assert.equal(Object.values(state.state.sources).reduce((n,s)=>n+(s['kana.reading.correct']||0),0),1);
  await assert.rejects(()=>earnings.submit('learner',{...receipt,id:'other-receipt',xp:99999}),/verified/);
  await assert.rejects(()=>earnings.submit('learner',{...receipt,id:'other-receipt',answers:[{index:1,kana:'か',answer:'ka',elapsed:1000}]}),/outside/);
  await assert.rejects(()=>earnings.submit('learner',{...receipt,id:'other-receipt',startedAt:at-8*86400000}),/verified/);
});

test('closing an unfinished receipt keeps answer credit without awarding completion XP',async()=>{
  const {db,rows}=database(),at=Date.parse('2026-10-21T12:00:00Z'),earnings=backend('study-earnings.cjs').createEarnings({db,now:()=>at});
  const pool=['あ','い','う'],roman=['a','i','u'];const answers=Array.from({length:12},(_,i)=>({index:i+1,kana:pool[i%3],answer:roman[i%3],elapsed:(i+1)*1000}));
  const receipt={id:'unfinished-receipt',startedAt:at-15000,config:{pool,direction:'reading',mode:'guided',hints:false},answers,complete:true,completed:false};
  await earnings.submit('unfinished',receipt);await earnings.submit('finished',{...receipt,completed:true});
  const {root}=browser(),xp=id=>root.ModeAtlasProgress.getSummary(rows.get('studyEarnings/'+id).state).xp;
  assert.ok(xp('unfinished')>0);assert.ok(xp('finished')>xp('unfinished'));assert.equal(rows.get('studyEarnings/unfinished/runs/'+receipt.id).done,true);
});

test('resuming offline study after a night does not spend a whole day of reward allowance',async()=>{
  const {db,rows}=database(),at=Date.parse('2026-10-21T12:00:00Z'),earnings=backend('study-earnings.cjs').createEarnings({db,now:()=>at});
  await earnings.submit('offline',{id:'offline-resumed',startedAt:at-86400000,config:{pool:['あ'],direction:'reading',mode:'guided',hints:false},answers:[{index:1,kana:'あ',answer:'a',elapsed:86400000}],complete:true,completed:false});
  assert.equal(rows.get('studyEarnings/offline/days/2026-10-20').elapsed,300000);assert.equal(rows.get('studyEarnings/offline/days/2026-10-20').answers,1);
});

test('empty receipt retries do not refresh wallets and unfinished runs send their true completion state',async()=>{
  const {root}=browser(),calls=[],events=[];root.KanaCloudSync={getUser:()=>({uid:'owner'})};root.dispatchEvent=e=>events.push(e.type);root.ModeAtlasSocial={call:async(action,data)=>{calls.push(data);return {index:data.answers.at(-1)?.index||0,done:data.complete};}};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'assets/app/mode-atlas-study-earnings.js'),'utf8'),{window:root,document:{addEventListener(){}},CustomEvent:class{constructor(type){this.type=type;}},Date,setTimeout,clearTimeout,queueMicrotask});
  await root.ModeAtlasEarnings.flush();assert.equal(events.length,0);const run={runId:'partial-session'};root.ModeAtlasEarnings.start(run,{pool:['あ'],mode:'guided',direction:'reading',hints:false});root.ModeAtlasEarnings.answer(run,{kana:'あ',answer:'a'});root.ModeAtlasEarnings.finish(run,false);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);assert.equal(calls[0].complete,true);assert.equal(calls[0].completed,false);assert.equal(root.ModeAtlasEarnings.pending(),0);assert.deepEqual(events,['modeAtlasEarningsChanged']);await root.ModeAtlasEarnings.flush();assert.equal(events.length,1);
});

test('per-answer cloud status events cannot bypass receipt batching',async()=>{
  const {root}=browser(),listeners={},timers=new Map(),calls=[];let tick=0;
  root.addEventListener=(name,fn)=>{listeners[name]=fn;};root.KanaCloudSync={getUser:()=>({uid:'owner'})};
  root.ModeAtlasSocial={call:async(_action,data)=>{calls.push(data);return {index:data.answers.at(-1)?.index||0,done:data.complete};}};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'assets/app/mode-atlas-study-earnings.js'),'utf8'),{window:root,document:{addEventListener(){}},CustomEvent:class{},Date,queueMicrotask,setTimeout:fn=>{timers.set(++tick,fn);return tick;},clearTimeout:id=>timers.delete(id)});
  await new Promise(resolve=>setImmediate(resolve));const run={runId:'batch-session'};root.ModeAtlasEarnings.start(run,{pool:['あ'],direction:'reading',mode:'free',hints:false});
  for(let i=0;i<19;i++){root.ModeAtlasEarnings.answer(run,{kana:'あ',answer:'a'});for(let j=0;j<5;j++)listeners.kanaCloudSyncStatusChanged();}
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,0);assert.equal(timers.size,1);
  root.ModeAtlasEarnings.answer(run,{kana:'あ',answer:'a'});await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);assert.equal(calls[0].answers.length,20);
  root.ModeAtlasEarnings.answer(run,{kana:'あ',answer:'a'});const timer=[...timers.values()][0];timer();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,2);assert.equal(calls[1].answers.length,1);
});
