const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const plain=v=>JSON.parse(JSON.stringify(v));
function load(){
  const values=new Map(),listeners=new Map();let now=Date.parse('2026-10-15T12:00:00Z'),serial=0,fail=false;
  const localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(fail&&key==='modeAtlasKanji'){fail=false;throw Error('Quota');}values.set(key,String(value));},removeItem:key=>values.delete(key),get length(){return values.size;},key:i=>[...values.keys()][i]??null};
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const root={Date:Clock,console,localStorage,sessionStorage:localStorage,structuredClone,TextEncoder,TextDecoder,Blob,CompressionStream,DecompressionStream,btoa,atob,crypto:{randomUUID:()=>`kanji-test-${++serial}`},CustomEvent:class{constructor(type){this.type=type;}},document:{addEventListener(){}},addEventListener:(type,cb)=>{const list=listeners.get(type)||[];list.push(cb);listeners.set(type,list);},dispatchEvent:event=>{for(const cb of listeners.get(event.type)||[])cb(event);},ModeAtlasWeekly:{start(){},answer(){},finish(){}}};root.window=root;root.self=root;
  const context=vm.createContext(root);
  for(const name of ['app/mode-atlas-date','app/mode-atlas-storage','app/mode-atlas-reward-rules','app/mode-atlas-progress','data/mode-atlas-kana-data','data/mode-atlas-kanji-curriculum','data/mode-atlas-kanji-data','app/mode-atlas-kanji-state','app/mode-atlas-kanji-codec','app/mode-atlas-kanji-content','app/mode-atlas-kanji-results','app/mode-atlas-kanji-session'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets',name+'.js'),'utf8'),context);
  return {root,values,now:()=>now,advance:ms=>now+=ms,fail:()=>fail=true,state:root.ModeAtlasKanjiState,content:root.ModeAtlasKanjiContent,session:root.ModeAtlasKanjiSession,progress:root.ModeAtlasProgress};
}
function evidence(correct=30,wrong=0){return [correct,wrong,correct,3,120000,1792022400000,1792108800000,4,'2026-10-10,2026-10-11,2026-10-12,2026-10-13'];}
function learned(state,char,c=3,w=0){return state.normalize({sources:{a:{[char]:{pronunciation:evidence(c,w),meaning:evidence(c,w)}}}});}

test('licensed curriculum covers five distinct levels with valid prompts and answer keys',()=>{
  const e=load(),bands=e.root.ModeAtlasKanjiCurriculum,entries=e.content.entries();
  assert.deepEqual(plain(bands.map(b=>[b.level,[...b.chars].length])),[[5,84],[4,169],[3,387],[2,398],[1,1345]]);
  assert.equal(entries.length,2383);assert.equal(new Set(entries.map(r=>r.char)).size,2383);
  for(const entry of entries){
    assert.equal(e.state.levels.get(entry.char),entry.level);assert.ok(entry.meanings.length);
    const prompt=e.content.pronunciation(entry);assert.ok(prompt.prompt&&prompt.answers.length,entry.char);
    for(const answer of prompt.answers)assert.ok(e.content.grade(entry.char,'pronunciation',answer),entry.char+answer);
    assert.ok(e.content.grade(entry.char,'meaning',entry.meanings[0]),entry.char);
    if('水日土木人学大小川女'.includes(entry.char)){const choices=e.content.choices(entry.char,'curriculum');assert.equal(choices.filter(answer=>e.content.grade(entry.char,'match',answer)).length,1,entry.char);}
    if(entry.example){assert.ok(/^[ぁ-ゖー]+$/.test(entry.example.kana),entry.char);for(const c of entry.example.word)if(e.state.levels.has(c))assert.ok(e.state.levels.get(c)>=entry.level,entry.char);}
  }
});

test('pronunciation handles IME kana, katakana and romaji without conflating n, doubled consonants or meanings',()=>{
  const c=load().content;
  for(const [input,want]of [['gakkou','がっこう'],['shinbun','しんぶん'],['konnichiha','こんにちは'],["kin'en",'きんえん'],['kan','かん'],['kann','かん'],['kanta','かんた'],['kanntan','かんたん'],['コク','こく']])assert.equal(c.kana(input),want,input);
  assert.equal(c.romaji('しんよう'),"shin'you");assert.equal(c.romaji('がっこう'),'gakkou');
  assert.ok(c.grade('水','meaning','water'));assert.ok(!c.grade('水','meaning','fire'));assert.ok(c.grade('一','meaning','1'));
  assert.equal(c.english(' The colour '),'color');assert.ok(!c.grade('水','unknown','water'));
});

test('completion opens levels permanently; mastery keeps exact accuracy and independent spaced recall',()=>{
  const {state,root}=load(),s=learned(state,'水');
  assert.ok(state.completed(s,'水'));assert.equal(state.stage(s,'水'),1);assert.ok(!state.allowed(4,s));
  const weak=learned(state,'水',30,2);assert.equal(state.stage(weak,'水'),2);
  const strong=learned(state,'水',30,1);assert.equal(state.stage(strong,'水'),3);
  strong.sources.a['水'].meaning[8]='2026-10-13';assert.equal(state.stage(strong,'水'),1);
  const assisted=learned(state,'水',100);assisted.sources.a['水'].meaning[2]=0;assert.ok(!state.completed(assisted,'水'));
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

test('hints and matching cannot grant independent completion; pause excludes idle time',()=>{
  const e=load(),s=e.session;s.start({mode:'meaning',chars:['水']});e.advance(1000);s.pause();e.advance(60000);s.play();e.advance(500);s.hint();s.answer('water');
  const m=e.state.metrics(e.state.read(),'水','meaning');assert.equal(m.average,1500);assert.equal(m.independent,0);s.next();
  s.start({mode:'match',chars:['水']});s.answer('water');s.next();assert.equal(e.state.metrics(e.state.read(),'水','meaning').independent,0);
});

test('teaching resumes after page reload without XP; checkpoints are owned by the active account',()=>{
  const e=load(),s=e.session;s.start({mode:'learn',count:5});s.next();s.pause();assert.equal(s.saved().index,1);s.resume();assert.equal(s.current().index,1);assert.equal(e.progress.getXP(),0);
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
  const packed=await e.root.ModeAtlasKanjiCodec.pack(state),bytes=Buffer.byteLength(JSON.stringify(packed));
  assert.ok(bytes<600000,`cloud bytes ${bytes}`);const unpacked=await e.root.ModeAtlasKanjiCodec.unpack(packed);
  assert.deepEqual(plain(unpacked.sources),plain(state.sources));assert.equal(Object.keys(unpacked.completions).length,2383);assert.ok(e.state.allowed(1,unpacked));
  assert.equal((await e.root.ModeAtlasKanjiCodec.pack({})).evidence,null);
  await assert.rejects(e.root.ModeAtlasKanjiCodec.unpack({...packed,evidence:{encoding:'future',data:'abc'}}),/newer/);
});
