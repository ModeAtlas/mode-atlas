const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const plain=v=>JSON.parse(JSON.stringify(v));
function load({experienced=true}={}){
  const values=new Map(),listeners=new Map();let now=Date.parse('2026-10-15T12:00:00Z'),serial=0,fail=false;
  const localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(fail&&key==='modeAtlasKanji'){fail=false;throw Error('Quota');}values.set(key,String(value));},removeItem:key=>values.delete(key),get length(){return values.size;},key:i=>[...values.keys()][i]??null};
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const root={setTimeout:()=>0,clearTimeout(){},Date:Clock,console,localStorage,sessionStorage:localStorage,structuredClone,TextEncoder,TextDecoder,Blob,CompressionStream,DecompressionStream,btoa,atob,crypto:{randomUUID:()=>`kanji-test-${++serial}`},CustomEvent:class{constructor(type){this.type=type;}},document:{addEventListener(){}},addEventListener:(type,cb)=>{const list=listeners.get(type)||[];list.push(cb);listeners.set(type,list);},dispatchEvent:event=>{for(const cb of listeners.get(event.type)||[])cb(event);},ModeAtlasWeekly:{start(){},answer(){},finish(){}}};root.window=root;root.self=root;
  const context=vm.createContext(root);
  for(const name of ['app/mode-atlas-date','app/mode-atlas-storage','app/mode-atlas-reward-rules','app/mode-atlas-progress','data/mode-atlas-kana-data','app/mode-atlas-japanese','data/mode-atlas-kanji-curriculum','data/mode-atlas-kanji-data','app/mode-atlas-kanji-state','app/mode-atlas-kanji-codec','app/mode-atlas-kanji-content','app/mode-atlas-kanji-results','app/mode-atlas-kanji-teaching','app/mode-atlas-kanji-session'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets',name+'.js'),'utf8'),context);
  if(experienced){const s=root.ModeAtlasKanjiState.read();for(const c of root.ModeAtlasKanjiCurriculum[0].chars){s.lessons[c]=now;s.introductions[c]=now;}root.ModeAtlasKanjiState.save(s);}
  return {root,values,now:()=>now,advance:ms=>now+=ms,fail:()=>fail=true,state:root.ModeAtlasKanjiState,content:root.ModeAtlasKanjiContent,session:root.ModeAtlasKanjiSession,progress:root.ModeAtlasProgress};
}
function evidence(correct=30,wrong=0){return [correct,wrong,correct,3,120000,1792022400000,1792108800000,4,'2026-10-10,2026-10-11,2026-10-12,2026-10-13',''];}
function learned(state,char,c=3,w=0){return state.normalize({sources:{a:{[char]:{pronunciation:evidence(c,w),meaning:evidence(c,w)}}}});}

test('licensed curriculum covers five distinct levels with valid prompts and answer keys',()=>{
  const e=load(),bands=e.root.ModeAtlasKanjiCurriculum,entries=e.content.entries();
  assert.deepEqual(plain(bands.map(b=>[b.level,[...b.chars].length])),[[5,84],[4,169],[3,387],[2,398],[1,1345]]);
  assert.equal(entries.length,2383);assert.equal(new Set(entries.map(r=>r.char)).size,2383);
  for(const entry of entries){
    assert.equal(e.state.levels.get(entry.char),entry.level);assert.ok(entry.meanings.length);
    const prompt=e.content.pronunciation(entry);assert.ok(prompt.prompt&&prompt.answers.length,entry.char);
    for(const answer of prompt.answers){assert.ok(e.content.grade(entry.char,'pronunciation',answer),entry.char+answer);assert.ok(e.content.grade(entry.char,'pronunciation',e.content.romaji(answer)),entry.char+e.content.romaji(answer));}
    assert.ok(e.content.grade(entry.char,'meaning',entry.meanings[0]),entry.char);
    if('水日土木人学大小川女'.includes(entry.char)){const choices=e.content.choices(entry.char,'curriculum');assert.equal(choices.filter(answer=>e.content.grade(entry.char,'match',answer)).length,1,entry.char);}
    if(entry.example){assert.ok(/^[ぁ-ゖー]+$/.test(entry.example.kana),entry.char);assert.ok(entry.example.word.includes(entry.char),entry.char);}
  }
});

test('pronunciation handles IME kana, katakana and romaji without conflating n, doubled consonants or meanings',()=>{
  const c=load().content;
  for(const [input,want]of [['gakkou','がっこう'],['shinbun','しんぶん'],['konnichiha','こんにちは'],["kin'en",'きんえん'],['kan','かん'],['kann','かん'],['kanta','かんた'],['kanntan','かんたん'],['コク','こく']])assert.equal(c.kana(input),want,input);
  assert.equal(c.romaji('しんよう'),"shin'you");assert.equal(c.romaji('がっこう'),'gakkou');
  assert.ok(c.grade('水','meaning','water'));assert.ok(!c.grade('水','meaning','fire'));assert.ok(c.grade('一','meaning','1'));
  assert.equal(c.english(' The colour '),'color');assert.ok(!c.grade('水','unknown','water'));
});

test('migration preserves earned milestones and separates current readiness from historical accuracy',()=>{
  const {state,root}=load(),s=learned(state,'水');
  assert.ok(state.completed(s,'水'));assert.equal(state.stage(s,'水'),1);assert.ok(!state.allowed(4,s));
  const weak=learned(state,'水',30,2);assert.equal(state.stage(weak,'水'),2);
  const strong=learned(state,'水',30,1);assert.equal(state.stage(strong,'水'),3);
  strong.sources.a['水'].meaning[8]='2026-10-13';assert.equal(state.stage(strong,'水'),3);assert.equal(state.readiness(strong,'水'),1);
  const assisted=learned(state,'水',100);assisted.sources.a['水'].meaning[2]=0;delete assisted.completions['水'];assert.ok(!state.completed(assisted,'水'));
  for(const char of root.ModeAtlasKanjiCurriculum[0].chars)s.completions[char]=1;
  assert.ok(state.allowed(4,s));assert.ok(!state.allowed(3,s));
  s.sources.a['水'].meaning[1]=100;assert.ok(state.completed(s,'水'),'completion is retained when later reviews are missed');
});

test('multi-device evidence merges converge without double-counting a retried device snapshot',()=>{
  const {state}=load(),a=learned(state,'水',3),b=state.normalize({sources:{b:{'水':{meaning:evidence(4),pronunciation:evidence(5)}}}}),c=learned(state,'水',6,1);
  c.sources.a['水'].meaning[5]++;c.sources.a['水'].meaning[6]++;
  const ab=state.merge(a,b);assert.equal(state.metrics(ab,'水','meaning').correct,7);
  assert.deepEqual(plain(ab),plain(state.merge(b,a)));assert.deepEqual(plain(ab),plain(state.merge(ab,a)));
  assert.deepEqual(plain(state.merge(state.merge(a,b),c)),plain(state.merge(a,state.merge(b,c))));
  assert.equal(state.metrics(state.merge(ab,c),'水','meaning').correct,10);
});

test('session transactions roll back failed saves and duplicate taps cannot award twice',()=>{
  const e=load(),s=e.session;s.start({mode:'meaning',chars:['水'],count:5});const initial=e.progress.getXP();
  e.fail();assert.throws(()=>s.answer('water'),/save|storage/i);assert.equal(e.state.metrics(e.state.read(),'水','meaning').attempts,0);assert.equal(e.progress.getXP(),initial);assert.equal(s.current().answers.length,0);
  s.answer('water');const xp=e.progress.getXP();assert.ok(xp>initial);assert.equal(s.answer('water'),null);assert.equal(e.progress.getXP(),xp);
  s.next();assert.equal(e.state.metrics(e.state.read(),'水','meaning').correct,1);assert.equal(s.saved(),null);
});

test('normalized Kanji snapshots cannot be mutated by readers and refresh after an external replacement',()=>{
 const e=load(),first=e.state.read();first.lessons['水']=123;
 assert.notEqual(e.state.read().lessons['水'],123);
 const imported={version:2,sources:{remote:{'水':{meaning:evidence(8)}}},lessons:{'水':44}};
 e.values.set('modeAtlasKanji',JSON.stringify(imported));
 assert.deepEqual(plain(e.state.read()),plain(e.state.normalize(imported)));
 e.values.delete('modeAtlasKanji');assert.deepEqual(plain(e.state.read()),plain(e.state.normalize({})));
});

test('answer updates keep the canonical shape and bounded receipts without rebuilding unchanged history',()=>{
 const e=load();
 for(let i=1;i<=40;i++){
  e.state.record({char:'水',skill:'meaning',runId:'bounded-run-'+i,index:1,correct:i%3!==0,assisted:i%4===0,elapsed:500,at:e.now()+i});
  const saved=e.state.read();assert.deepEqual(plain(saved),plain(e.state.normalize(saved)));
 }
 assert.equal(Object.keys(e.state.read().runs).length,32);
 assert.equal(e.state.metrics(e.state.read(),'水','meaning').attempts,40);
});

test('save observers run only after the outer durable commit and cannot turn a saved answer into an error',()=>{
 const e=load(),store=e.root.ModeAtlasStorage,seen=[];
 assert.throws(()=>store.transaction(()=>{store.afterCommit(()=>seen.push('failed'));throw Error('Stop');}),/Stop/);
 assert.deepEqual(seen,[]);
 store.transaction(()=>{
  store.setJSON('modeAtlasWordLessons',{polite:{index:1}});
  store.transaction(()=>store.afterCommit(()=>seen.push(JSON.parse(e.values.get('modeAtlasWordLessons')).polite.index)));
  assert.deepEqual(seen,[]);
  store.afterCommit(()=>{throw Error('Observer failed');});
 });
 assert.deepEqual(seen,[1]);assert.equal(store.json('modeAtlasWordLessons',{}).polite.index,1);
});

test('reordered receipt maps recover through a small journal without duplicating the large save',()=>{
 const e=load(),store=e.root.ModeAtlasStorage;
 const old={payload:'x'.repeat(70000),runs:{one:1,two:2}},next={payload:old.payload,runs:{two:2,one:3}};
 store.setJSON('modeAtlasKanji',old);e.fail();
 assert.throws(()=>store.transaction(()=>store.setJSON('modeAtlasKanji',next)),/Quota/);
 const journal=e.values.get('modeAtlasPracticeTransaction');assert.ok(journal.length<2000);
 assert.equal(JSON.parse(journal).modeAtlasKanji.kind,'json-patch-v1');
 store.transaction(()=>{});
 assert.equal(e.values.get('modeAtlasKanji'),JSON.stringify(next));assert.equal(e.values.has('modeAtlasPracticeTransaction'),false);
});

test('hints and matching cannot grant independent completion; pause excludes idle time',()=>{
  const e=load(),s=e.session;s.start({mode:'meaning',chars:['水']});e.advance(1000);s.pause();e.advance(60000);s.play();e.advance(500);s.hint();s.answer('water');
  const m=e.state.metrics(e.state.read(),'水','meaning');assert.equal(m.average,1500);assert.equal(m.independent,0);s.next();
  s.start({mode:'match',chars:['水']});s.answer('water');s.next();assert.equal(e.state.metrics(e.state.read(),'水','meaning').independent,0);
});

test('teaching resumes after page reload without XP; checkpoints are owned by the active account',()=>{
  const e=load({experienced:false}),s=e.session;s.start({mode:'learn',count:5});finishLesson(e);s.pause();assert.equal(s.saved().index,1);s.resume();assert.equal(s.current().index,1);assert.equal(e.progress.getXP(),0);
  e.values.set('modeAtlasLastUserId','account-b');e.root.dispatchEvent(new e.root.CustomEvent('modeAtlasAccountWillChange'));assert.equal(s.saved(),null);assert.equal(s.current(),null);assert.throws(()=>s.answer('water'),/ended/);
});

test('completed tests save independent history and count toward shared XP, goals and streaks',()=>{
  const e=load(),s=e.session;e.values.set('testResults','[{"id":"legacy"}]');s.start({mode:'meaning',test:true,count:20});
  for(let i=0;i<20;i++){const current=s.current(),entry=e.content.get(current.sequence[current.index]);s.answer(entry.meanings[0]);s.next();}
  assert.equal(e.root.ModeAtlasKanjiResults.read().length,1);assert.equal(e.root.ModeAtlasKanjiResults.read()[0].answers.length,20);assert.equal(e.values.get('testResults'),'[{"id":"legacy"}]');
  assert.equal(e.progress.getLifetimeCorrect(),20);assert.ok(e.progress.getXP()>=80);const recap=e.progress.weeklyRecap();assert.equal(recap.kanji,20);assert.equal(recap.reading,0);assert.equal(recap.sessions,1);assert.equal(recap.studyDays,1);
  assert.equal(e.root.ModeAtlasKanjiResults.merge(e.root.ModeAtlasKanjiResults.read(),e.root.ModeAtlasKanjiResults.read()).length,1);
});

test('five complete device histories fit cloud storage and survive compression without evidence loss',async()=>{
  const e=load(),state=e.state.normalize({updatedAt:e.now()});
  for(let d=0;d<5;d++){const source=state.sources['device-'+d]={};let i=0;for(const char of e.state.levels.keys()){const r=evidence(100+i%57,i%9);r[4]+=i*200;r[5]+=i*1000;source[char]={pronunciation:r,meaning:[...r]};i++;}}
  state.version=1;
  const packed=await e.root.ModeAtlasKanjiCodec.pack(state),bytes=Buffer.byteLength(JSON.stringify(packed));
  assert.ok(bytes<600000,`cloud bytes ${bytes}`);const unpacked=await e.root.ModeAtlasKanjiCodec.unpack(packed);
  assert.deepEqual(plain(unpacked.sources),plain(state.sources));assert.equal(Object.keys(unpacked.completions).length,2383);assert.ok(e.state.allowed(1,unpacked));
  assert.equal((await e.root.ModeAtlasKanjiCodec.pack({})).evidence,null);
  await assert.rejects(e.root.ModeAtlasKanjiCodec.unpack({...packed,evidence:{encoding:'future',data:'abc'}}),/newer/);
});

function finishLesson(e){
  const s=e.session,c=s.current(),entry=e.content.get(c.sequence[c.index]);
  s.lessonStep();s.lessonAnswer(entry.meanings[0]);s.lessonStep();s.lessonAnswer(e.root.ModeAtlasKanjiTeaching.lesson(entry).reading);s.next();
}
test('introductory lessons are ordered and require both checks before opening the wider N5 course',()=>{
  const e=load({experienced:false}),s=e.session,state=e.state;
  assert.throws(()=>s.start({mode:'meaning'}),/Learn a few/);
  assert.equal(s.start({mode:'learn',count:5}).sequence.join(''),'一二三人日');s.discard();
  assert.equal(s.start({mode:'learn',count:5}).sequence.join(''),'一二三人日');
  s.next();assert.equal(s.current().index,0);s.lessonStep();s.lessonAnswer('wrong');s.next();assert.equal(s.current().index,0);assert.ok(!state.read().introductions['一']);
  s.reviewLesson();for(let i=0;i<5;i++)finishLesson(e);
  assert.equal(s.start({mode:'learn',count:5}).sequence.join(''),'月木山川水');assert.equal(state.studyPool(5).length,10);
  for(let i=0;i<5;i++)finishLesson(e);
  assert.ok(state.introReady());assert.equal(state.studyPool(5).length,84);assert.ok(!state.allowed(4));assert.equal(e.progress.getXP(),0);
  assert.ok(s.start({mode:'meaning',count:20}).sequence.every(c=>state.introductory.includes(c)),'recall never adds unseen characters');
});
test('checked introductions merge, preserve old evidence and survive compressed cloud saves',async()=>{
  const e=load({experienced:false}),s=e.state;
  const a=s.normalize({introductions:{'一':10}}),b=s.normalize({introductions:{'二':20,'一':15}});
  assert.deepEqual(plain(s.merge(a,b).introductions),{'一':10,'二':20});assert.deepEqual(plain(s.merge(a,b)),plain(s.merge(b,a)));
  const historical=learned(s,'書',1);assert.ok(s.studyPool(5,historical).includes('書'));
  historical.introductions={'一':10};assert.deepEqual(plain((await e.root.ModeAtlasKanjiCodec.unpack(await e.root.ModeAtlasKanjiCodec.pack(historical))).introductions),{'一':10});
});
test('guided reading choices always include an accepted answer, including alternate readings',()=>{
  const e=load({experienced:false}),teaching=e.root.ModeAtlasKanjiTeaching;
  for(const char of e.state.introductory){for(const phase of ['recognise','reading']){
    const choices=teaching.choices(char,phase,'stable');assert.equal(choices.filter(x=>teaching.grade(char,phase,x)).length,1,char+phase);
  }}
});
test('stroke guidance accepts natural drift but rejects reversals, shortcuts and scribbles',()=>{
  const matcher=require('../assets/app/mode-atlas-stroke-matcher.js');
  const path=Array.from({length:30},(_,i)=>({x:12+i*2.8,y:50+Math.sin(i/6)*2}));
  assert.ok(matcher.matches(path.map((p,i)=>({x:p.x+Math.sin(i),y:p.y+1})),path));
  assert.ok(!matcher.matches([...path].reverse(),path));assert.ok(!matcher.matches(path.slice(0,6),path));
  assert.ok(!matcher.matches(path.map((p,i)=>({x:p.x,y:i%2?10:90})),path));
  assert.ok(!matcher.matches([{x:NaN,y:0}],path));
});
test('offline stroke data covers every kanji and kana unit with safe ordered paths',()=>{
  const e=load(),context={window:{}};
  for(const group of ['kana','n5','n4','n3','n2','n1'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,`../assets/data/mode-atlas-strokes-${group}.js`),'utf8'),context);
  const data=context.window.ModeAtlasStrokeData;
  const chars=new Set([...e.state.levels.keys(),...Object.values(e.root.ModeAtlasKanaData.maps).flatMap(map=>Object.keys(map).flatMap(k=>[...k]))]);
  for(const char of chars){assert.ok(data[char]?.length,char);for(const d of data[char])assert.match(d,/^[MmLlHhVvCcSsQqTtAaZz0-9.,+eE\s-]+$/);}
});

test('web pronunciation uses a Japanese voice and cancels requests waiting for voices',async()=>{
  let adapter,voices=[],listener;const played=[];
  const root={setTimeout,clearTimeout,ModeAtlasEnv:{},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},AtlasPlatform:{registerAdapter(_name,value){adapter=value;}},speechSynthesis:{getVoices:()=>voices,addEventListener(_name,fn){listener=fn;},removeEventListener(){},cancel(){},speak(value){played.push(value);value.onstart();}}};root.window=root;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/platform/mode-atlas-platform-web.js'),'utf8'),root);
  const waiting=adapter.speakJapanese('いち',false);adapter.stopSpeech();voices=[{lang:'ja-JP'}];listener();await waiting;assert.equal(played.length,0);
  assert.equal((await adapter.speakJapanese('に',true)).played,true);assert.equal(played[0].text,'に');assert.equal(played[0].voice.lang,'ja-JP');
  await adapter.speakJapanese('に',false);assert.ok(played[1].rate<1);assert.ok(played[0].rate<played[1].rate*.5);
  voices=[{lang:'en-US'}];assert.equal((await adapter.speakJapanese('さん',false)).played,false);assert.equal(played.length,2);
});

test('recent Kanji recall can recover after early mistakes and mastered milestones remain earned',()=>{
  const e=load(),s=e.state;
  for(const skill of s.skills){
    for(let i=1;i<=10;i++){s.record({char:'水',skill,runId:'early-'+skill,index:i,correct:false,at:e.now()});e.advance(1000);}
    for(let i=1;i<=30;i++){
      s.record({char:'水',skill,runId:'later-'+skill,index:i,correct:true,assisted:false,at:e.now()});e.advance(86400000*100);
    }
  }
  const learned=s.read();assert.ok(s.completed(learned,'水'));assert.equal(s.stage(learned,'水'),3);assert.equal(s.readiness(learned,'水'),3);
  assert.equal(s.metrics(learned,'水','meaning').accuracy,.75);assert.equal(s.metrics(learned,'水','meaning').recentAccuracy,1);
  s.record({char:'水',skill:'meaning',runId:'missed-review',index:1,correct:false,at:e.now()});
  assert.equal(s.stage(s.read(),'水'),3);assert.ok(s.readiness(s.read(),'水')<3);
  assert.ok(s.read().recent['水'].meaning.split(',').length<=16);
});

test('Kanji learning path connects introductions to independent meaning and reading before new lessons',()=>{
  const e=load({experienced:false}),s=e.state;
  s.enter('beginner');assert.equal(s.learningPath().step,'learn');
  const chars=[...s.introductory].slice(0,5);for(const char of chars)s.introduction(char);
  assert.equal(s.learningPath().mode,'meaning');assert.equal(s.learningPath().known,5);assert.equal(s.learningPath().testReady,false);
  for(const [i,char]of chars.entries())s.record({char,skill:'meaning',runId:'recognition-'+i,index:1,correct:true,assisted:true,elapsed:500,at:e.now()});
  assert.equal(s.learningPath().mode,'meaning','recognition is not independent recall');
  for(const [i,char]of chars.entries())s.record({char,skill:'meaning',runId:'meaning-'+i,index:1,correct:true,assisted:false,elapsed:500,at:e.now()});
  assert.equal(s.learningPath().mode,'pronunciation');assert.equal(s.learningPath().testReady,false);
  for(const [i,char]of chars.entries())s.record({char,skill:'pronunciation',runId:'reading-'+i,index:1,correct:true,assisted:false,elapsed:500,at:e.now()});
  assert.equal(s.learningPath().testReady,true);assert.equal(s.learningPath().recalled,5);assert.equal(s.learningPath().step,'learn');
  assert.ok(s.learningPath().nextDue>e.now());
  e.advance(60000);const due=s.learningPath();assert.equal(due.step,'review');assert.deepEqual(plain(due.chars),chars);assert.equal(due.mode,'meaning');
});

test('Kanji path never mistakes placement access for characters already encountered',()=>{
  const e=load({experienced:false}),s=e.state;s.enter('confident',[5,4,3,2,1]);
  assert.equal(s.learningPath().known,0);assert.equal(s.learningPath().recalled,0);assert.equal(s.learningPath().testReady,false);
  assert.equal(s.learningPath().step,'learn');assert.equal(s.allowed(1),true,'recommendations preserve experienced access');
});

test('Kanji path celebrates a completed foundation without claiming spaced mastery',()=>{
  const e=load({experienced:false}),s=e.state,current=s.read();
  for(const char of e.root.ModeAtlasKanjiCurriculum[0].chars)current.completions[char]=e.now();
  s.save(current);const path=s.learningPath();assert.equal(path.step,'complete');assert.equal(path.known,84);assert.equal(path.recalled,84);assert.equal(s.stage(s.read(),'一'),0);
  assert.equal(s.allowed(4),true);assert.equal(path.title,'N5 foundation complete');assert.equal(path.nextLevel,4);assert.equal(path.label,'Continue to N4');
});
