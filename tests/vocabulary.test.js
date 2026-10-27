const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const plain=v=>JSON.parse(JSON.stringify(v));
function fixture(){
 const values=new Map();let serial=0,fail=false;
 const localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(fail&&k==='modeAtlasWordLessons'){fail=false;throw Error('Quota');}values.set(k,String(v));},removeItem:k=>values.delete(k),get length(){return values.size;},key:i=>[...values.keys()][i]??null};
 const root={Date,console,URLSearchParams,structuredClone,localStorage,sessionStorage:localStorage,setTimeout:()=>0,clearTimeout(){},crypto:{randomUUID:()=>String(++serial)},CustomEvent:class{},dispatchEvent(){},addEventListener(){},document:{addEventListener(){}},KanaCloudSync:{scheduleSync(){},markSectionUpdated(){}}};root.window=root;
 const ctx=vm.createContext(root);
 for(const file of ['app/mode-atlas-date','app/mode-atlas-storage','app/mode-atlas-review','data/mode-atlas-kana-data','app/mode-atlas-japanese','app/mode-atlas-kana-learning','data/mode-atlas-kanji-curriculum','app/mode-atlas-kanji-state','app/mode-atlas-word-lesson-state','data/mode-atlas-vocabulary','app/mode-atlas-vocabulary'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets',file+'.js'),'utf8'),ctx);
 const see=chars=>{const s=root.ModeAtlasKanaLearning.read();for(const char of chars)s.introduced[char]=1;root.ModeAtlasKanaLearning.save(s);};
 return {root,V:root.ModeAtlasVocabulary,L:root.ModeAtlasWordLessonState,see,values,fail:()=>fail=true};
}
test('catalogue contains isolated words with unique IDs/readings, answer keys and valid kana',()=>{
 const {V,root}=fixture();assert.ok(V.data.length>=140);assert.equal(new Set(V.data.map(w=>w.id)).size,V.data.length);assert.equal(new Set(V.data.map(w=>w.reading)).size,V.data.length);
 for(const w of V.data){assert.match(w.reading,/^[ぁ-ゖァ-ヺー]+$/);assert.ok(w.answers.includes(w.english));assert.ok(V.answer(w.id,'decode',root.ModeAtlasJapanese.romaji(w.reading)),w.id);assert.ok(V.answer(w.id,'meaning',w.english));}
});
test('unlocked but unseen kana never enter the word pool; vowel learners get a useful small pool',()=>{
 const {V,see}=fixture();assert.equal(V.pool().length,0);see('あいうえお');const words=V.pool();assert.ok(words.length>=5&&words.length<15);assert.ok(words.some(w=>w.id==='house'));assert.ok(!words.some(w=>w.id==='station'));see('き');assert.ok(V.pool().some(w=>w.id==='station'));
});
test('mixed script requires real seen Kanji, and sound marks require their own taught patterns',()=>{
 const {V,root,see}=fixture();see(root.ModeAtlasKanaData.collections.all);let s=root.ModeAtlasKanjiState.read();s.sources={empty:{家:{meaning:[0,0,0,0,0,0,0,0,'']}}};root.ModeAtlasKanjiState.save(s);assert.ok(!V.pool('mixed').some(w=>w.id==='house'));s.introductions.家=1;root.ModeAtlasKanjiState.save(s);assert.ok(V.pool('mixed').some(w=>w.id==='house'));
 assert.ok(!V.pool().some(w=>w.reading.includes('ー')||w.reading.includes('っ')));const k=root.ModeAtlasKanaLearning.read();k.sounds={sokuon:1,longVowels:1};root.ModeAtlasKanaLearning.save(k);assert.ok(V.pool().some(w=>w.reading.includes('ー')));assert.ok(V.pool().some(w=>w.reading.includes('っ')));
});
test('decoding unlocks meaning but cannot supply translation evidence or production unlocks',()=>{
 const {V,see}=fixture();see('あいうえお');for(const id of ['love','house','above']){V.introduce(id);V.record(id,'decode',true);}
 assert.equal(V.unlocked().meaning,true);assert.equal(V.unlocked().produceRoman,false);assert.equal(V.evidence('love','meaning').length,0);assert.throws(()=>V.record('love','produceKana',true));
 for(const id of ['love','house','above'])V.record(id,'meaning',true);assert.equal(V.unlocked().produceRoman,true);assert.equal(V.unlocked().produceKana,false);
 for(const id of ['love','house','above'])V.record(id,'produceRoman',true);assert.equal(V.unlocked().produceKana,true);
});
test('hints cannot unlock skills and later mistakes do not revoke earned skill access',()=>{
 const {V,see}=fixture();see('あいうえお');for(const id of ['love','house','above']){V.introduce(id);V.record(id,'decode',true,{assisted:true});}assert.equal(V.unlocked().meaning,false);
 for(const id of ['love','house','above']){V.record(id,'decode',true);for(let i=0;i<20;i++)V.record(id,'decode',false);}assert.equal(V.unlocked().meaning,true);assert.equal(V.evidence('love','decode').length,16);
});
test('more than sixteen early reviews preserve a mature schedule and errors return to relearning',()=>{
 const {V,see}=fixture();see('あいうえお');V.introduce('love');let at=100000;
 for(let i=0;i<4;i++){V.record('love','decode',true,{at});at=V.schedule('love','decode').due;}
 const expected=V.schedule('love','decode');for(let i=0;i<24;i++)V.record('love','decode',true,{at:expected.due-1000+i});assert.equal(V.schedule('love','decode').level,expected.level);assert.equal(V.schedule('love','decode').due,expected.due);
 V.record('love','decode',false,{at:expected.due-1});assert.equal(V.schedule('love','decode').level,0);assert.equal(V.schedule('love','decode').due,expected.due-1+600000);
});
test('grading keeps kana output strict, accepts meaningful synonyms, macrons and alternate production readings',()=>{
 const {V}=fixture();assert.equal(V.answer('house','meaning','A home!'),true);assert.equal(V.answer('house','meaning','homework'),false);assert.equal(V.answer('house','produceKana','ie'),false);assert.equal(V.answer('house','produceKana','いえ'),true);
 assert.equal(V.answer('school','decode','gakkō'),true);assert.equal(V.answer('good','produceRoman','yoi'),true);assert.equal(V.answer('good','decode','yoi'),false);
});
test('vocabulary merges independently by skill and preserves phrase records beyond fifty words',()=>{
 const {L}=fixture(),base={learnedAt:1,decode:'a:2:p:left',achieved:{decode:10},schedules:{decode:{level:2,due:100,last:10}}};
 const a={'vocab-love':{vocabulary:base,updatedAt:10}},b={'vocab-love':{vocabulary:{learnedAt:2,meaning:'b:2:p:right',achieved:{meaning:11},schedules:{meaning:{level:1,due:200,last:11}}},updatedAt:11},polite:{phase:'complete',completedAt:4}};
 const merged=L.merge(a,b);assert.deepEqual(plain(merged),plain(L.merge(b,a)));assert.deepEqual(plain(merged),plain(L.merge(merged,merged)));assert.equal(merged['vocab-love'].vocabulary.schedules.decode.due,100);assert.equal(merged['vocab-love'].vocabulary.schedules.meaning.due,200);assert.equal(merged.polite.completedAt,4);
 const many=Object.fromEntries(Array.from({length:150},(_,i)=>['vocab-word-'+i,{vocabulary:base}]));assert.equal(Object.keys(L.normalize({...many,polite:b.polite})).length,151);
});
test('failed vocabulary saves roll back evidence and never grant a new skill',()=>{
 const {V,see,fail,L}=fixture();see('あいうえお');V.introduce('love');const before=plain(L.read());fail();assert.throws(()=>V.record('love','decode',true));assert.deepEqual(plain(L.read()),before);assert.equal(V.unlocked().meaning,false);
});
test('guided course teaches a whole small set before recall and resumes its exact task and feedback',()=>{
 const {V,see,L}=fixture();see('あいうえお');const first=V.begin();assert.equal(first.tasks.filter(t=>t.mode==='meet').length,3);assert.deepEqual(plain(first.tasks.slice(0,3).map(t=>t.mode)),['meet','meet','meet']);
 V.advance(first.id);const resumed=V.begin();assert.equal(resumed.id,first.id);assert.equal(resumed.cursor,1);assert.equal(L.read()['vocabulary-course'].completedAt,0);
 V.advance(first.id);V.advance(first.id);let now=V.session(),task=V.current();assert.equal(task.mode,'decode');V.respond(now.id,V.byId.get(task.id).readings[0]&&V.byId.get(task.id).readings[0],{skip:true,cursor:now.cursor});
 now=V.begin();assert.equal(now.phase,'feedback');assert.equal(V.evidence(task.id,'decode').length,1);V.respond(now.id,'wrong');assert.equal(V.evidence(task.id,'decode').length,1);
});
test('guided continuation introduces four distinct skills without a mode selector or fabricated mastery',()=>{
 const {V,see,root}=fixture();see('あいうえお');
 for(const expected of ['decode','meaning','produceRoman','produceKana']){
  let s=V.begin();for(let guard=0;s.phase!=='complete'&&guard<40;guard++){
   const t=V.current(s),w=V.byId.get(t.id);if(t.mode==='meet'||s.phase==='feedback')s=V.advance(s.id);
   else{assert.equal(t.mode,expected);s=V.respond(s.id,t.mode==='meaning'?w.english:t.mode==='produceKana'?w.reading:root.ModeAtlasJapanese.romaji(w.reading));}
  }assert.equal(s.phase,'complete');
 }
 for(const mode of V.modes)assert.equal(V.evidence('love',mode.id).length,1);
 assert.equal(V.plan().kind,'learn');
});
test('answer corrections require intervening words and checkpoint misses remain visible to the next action',()=>{
 const {V,see,root}=fixture();see('あいうえお');for(const id of ['love','house','above']){V.introduce(id);V.record(id,'decode',true);}
 let s=V.begin({custom:true,kind:'test',mode:'decode'});const first=V.current(s);s=V.respond(s.id,'wrong');s=V.advance(s.id);
 while(s.phase!=='complete'){const t=V.current(s);s=s.phase==='feedback'?V.advance(s.id):V.respond(s.id,root.ModeAtlasJapanese.romaji(V.byId.get(t.id).reading));}
 assert.equal(V.plan().title,'Revisit the tricky words');assert.equal(V.plan().tasks[0].id,first.id);assert.equal(V.history().filter(e=>e.quality===0).length,1);
});
test('stale cursor cannot grade the next task and course state merges without erasing vocabulary',()=>{
 const {V,see,L,root}=fixture();see('あいうえお');let s=V.begin();for(let i=0;i<3;i++)s=V.advance(s.id);
 const first=V.current(s),cursor=s.cursor;s=V.respond(s.id,root.ModeAtlasJapanese.romaji(V.byId.get(first.id).reading),{cursor});s=V.advance(s.id);
 const next=V.current(s);V.respond(s.id,'wrong',{cursor});assert.equal(V.evidence(next.id,'decode').length,0);
 const merged=L.merge(L.read(),{'vocab-house':{updatedAt:9,vocabulary:{learnedAt:1,meaning:'a:2:p:other'}}});assert.equal(merged['vocabulary-course'].course.cursor,s.cursor);assert.equal(merged['vocab-house'].vocabulary.meaning,'a:2:p:other');
});
test('two completed guided sets lead to a cumulative checkpoint without reporting long-term mastery',()=>{
 const {V,see,root}=fixture();see('あいうえお');for(let stage=0;stage<8;stage++){
  let s=V.begin();for(let guard=0;s.phase!=='complete'&&guard<40;guard++){const t=V.current(s),w=V.byId.get(t.id);s=t.mode==='meet'||s.phase==='feedback'?V.advance(s.id):V.respond(s.id,t.mode==='meaning'?w.english:t.mode==='produceKana'?w.reading:root.ModeAtlasJapanese.romaji(w.reading));}
 }
 const plan=V.plan();assert.equal(plan.kind,'checkpoint');assert.equal(new Set(plan.tasks.map(t=>t.mode)).size,4);assert.ok(plan.tasks.length>=6);assert.equal(V.schedule('love','decode').level,1);
});
test('a small Kana pool remains usable when the mixed-script setting has no encountered Kanji',()=>{
 const {V,see}=fixture();see('あいうえお');V.setPreference('mixed');assert.equal(V.pool('mixed').length,0);const next=V.nextAction();assert.equal(next.label,'Use Kana words');assert.equal(next.branchId,'words');assert.match(next.href,/script=kana/);
});
test('custom checks cannot award a guided checkpoint and later milestones test newly completed words',()=>{
 const {V,see,root,L}=fixture();see(root.ModeAtlasKanaData.collections.all);
 const selected=V.pool().slice(0,18);for(const word of selected)V.introduce(word.id);
 for(const skill of V.modes)for(const word of selected)V.record(word.id,skill.id,true);
 const finish=()=>{let s=V.session();for(let guard=0;s.phase!=='complete'&&guard<60;guard++){const t=V.current(s),word=V.byId.get(t.id);s=s.phase==='feedback'?V.advance(s.id):V.respond(s.id,t.mode==='meaning'?word.english:t.mode==='produceKana'?word.reading:root.ModeAtlasJapanese.romaji(word.reading));}return s;};
 let custom=V.begin({custom:true,kind:'test',mode:'decode'});assert.equal(custom.kind,'custom-test');finish();assert.equal(L.read()['vocabulary-course'].preferences?.checkpointWords||0,0);assert.equal(V.plan().milestone,6);
 for(const milestone of [6,12,18]){
  const plan=V.plan();assert.equal(plan.milestone,milestone);assert.deepEqual(plain(plan.tasks.slice(0,6).map(t=>t.id)),plain(selected.slice(milestone-6,milestone).map(w=>w.id)));
  V.begin();const saved=finish();assert.equal(saved.milestone,milestone);assert.equal(L.read()['vocabulary-course'].preferences.checkpointWords,milestone);
 }
});
test('checkpoint milestone requires its complete saved task coverage',()=>{
 const {V,see,L}=fixture();see('あいうえお');const course={id:'coverage',kind:'checkpoint',script:'kana',milestone:6,wordIds:['love','house'],tasks:[{id:'love',mode:'decode'},{id:'house',mode:'meaning'}],cursor:1,phase:'feedback',results:[{id:'love',mode:'decode',correct:true},{id:'love',mode:'meaning',correct:true}],startedAt:1};L.checkpoint('vocabulary-course',{course});V.advance('coverage');assert.equal(L.read()['vocabulary-course'].preferences?.checkpointWords||0,0);
});
test('a familiar Kana word is explicitly taught in its new Kanji form before due mixed retrieval',()=>{
 const {V,root,see,L}=fixture();see('あいうえお');V.introduce('house',10);V.record('house','decode',true,{at:100});const original=V.progress('house');assert.equal(original.formIntroducedAt,0);
 const k=root.ModeAtlasKanjiState.read();k.introductions.家=20;root.ModeAtlasKanjiState.save(k);V.setPreference('mixed');const plan=V.plan();assert.equal(plan.title,'Meet these Kanji spellings');assert.equal(plan.tasks[0].mode,'meet');
 let course=V.begin();course=V.advance(course.id);assert.ok(V.progress('house').formIntroducedAt>0);assert.equal(V.progress('house').learnedAt,10);assert.equal(V.evidence('house','meaning').length,0);assert.equal(V.current(course).mode,'decode');
 const merged=L.merge({'vocab-house':{vocabulary:original}},L.read());assert.ok(merged['vocab-house'].vocabulary.formIntroducedAt>0);assert.equal(L.normalize({'vocab-house':{vocabulary:{learnedAt:10}}})['vocab-house'].vocabulary.formIntroducedAt,0);
});
test('checked word identity survives newly eligible words appearing earlier in catalogue order',()=>{
 const {V,root,see,L}=fixture();see(root.ModeAtlasKanaData.collections.all);const eligible=V.pool(),later=eligible.slice(6,12),earlier=eligible.slice(0,6);
 const learn=words=>{for(const word of words)V.introduce(word.id);for(const skill of V.modes)for(const word of words)V.record(word.id,skill.id,true);};learn(later);
 let s=V.begin();for(let guard=0;s.phase!=='complete'&&guard<30;guard++){const t=V.current(s),w=V.byId.get(t.id);s=s.phase==='feedback'?V.advance(s.id):V.respond(s.id,t.mode==='meaning'?w.english:t.mode==='produceKana'?w.reading:root.ModeAtlasJapanese.romaji(w.reading));}
 learn(earlier);const plan=V.plan();assert.equal(plan.milestone,12);assert.deepEqual(plain(plan.milestoneIds),plain(earlier.map(w=>w.id)));assert.deepEqual(new Set(L.read()['vocabulary-course'].preferences.checkpointed),new Set(later.map(w=>w.id)));
});
test('a consolidated small pool leads back to character learning rather than an endless checkpoint',()=>{
 const {V,root,see,L}=fixture();see('え');const pool=V.pool();assert.ok(pool.length>0&&pool.length<3);
 for(const word of pool){V.introduce(word.id);V.record(word.id,'decode',true);}
 assert.equal(V.plan().kind,'grow');assert.equal(V.begin(),null);root.ModeAtlasKanaLearning={...root.ModeAtlasKanaLearning,nextAction:()=>({href:'/kana/?view=course'})};assert.equal(V.nextAction().href,'/kana/?view=course');
 const rows=L.read();assert.equal(Object.keys(rows).filter(id=>id.startsWith('vocab-')).length,pool.length);
});
test('the full catalogue checks its final remainder then reaches a bounded completion',()=>{
 const {V,root,see,L}=fixture();see(root.ModeAtlasKanaData.collections.all);const kana=root.ModeAtlasKanaLearning.read();kana.sounds={sokuon:1,longVowels:1,katakanaLength:1};root.ModeAtlasKanaLearning.save(kana);assert.equal(V.pool().length,V.data.length);
 const records=Object.fromEntries(V.data.map(word=>['vocab-'+word.id,{vocabulary:{learnedAt:1,achieved:Object.fromEntries(V.modes.map(mode=>[mode.id,1]))}}]));root.ModeAtlasStorage.setJSON(L.KEY,L.normalize(records));
 const completed=V.data.slice(0,144).map(w=>w.id);L.checkpoint('vocabulary-course',{preferences:{script:'kana',checkpointed:completed,checkpointWords:144}});
 let s=V.begin();assert.equal(s.finalCheckpoint,true);assert.equal(s.milestone,146);assert.equal(s.milestoneIds.length,2);
 for(let guard=0;s.phase!=='complete'&&guard<20;guard++){const t=V.current(s),w=V.byId.get(t.id);s=s.phase==='feedback'?V.advance(s.id):V.respond(s.id,t.mode==='meaning'?w.english:t.mode==='produceKana'?w.reading:root.ModeAtlasJapanese.romaji(w.reading));}
 assert.equal(L.read()['vocabulary-course'].preferences.checkpointed.length,146);assert.equal(V.plan().kind,'complete');assert.equal(V.begin(),null);assert.equal(V.nextAction().href,'/learn/');
});
test('a confident learner with the whole catalogue eligible still learns a second set before a checkpoint',()=>{
 const {V,root,see,L}=fixture();see(root.ModeAtlasKanaData.collections.all);const kana=root.ModeAtlasKanaLearning.read();kana.sounds={sokuon:1,longVowels:1,katakanaLength:1};root.ModeAtlasKanaLearning.save(kana);assert.equal(V.pool().length,V.data.length);
 const first=V.data.slice(0,3),records=Object.fromEntries(first.map(word=>['vocab-'+word.id,{vocabulary:{learnedAt:1,achieved:Object.fromEntries(V.modes.map(mode=>[mode.id,1]))}}]));root.ModeAtlasStorage.setJSON(L.KEY,L.normalize(records));
 assert.equal(V.plan().kind,'learn');assert.equal(V.plan().tasks.filter(t=>t.mode==='meet').length,3);
});
