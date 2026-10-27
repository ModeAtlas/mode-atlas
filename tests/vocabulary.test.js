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
