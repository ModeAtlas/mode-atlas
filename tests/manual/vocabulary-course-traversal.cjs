/* Manual whole-course audit (several minutes; deliberately outside release:check).
 * From the repository root:
 *   node tests/manual/vocabulary-course-traversal.cjs
 * Optional durable JSON evidence:
 *   node tests/manual/vocabulary-course-traversal.cjs --report .build/reports/words-course-traversal.json
 *
 * All character/sound prerequisites are introduced to make the catalogue
 * eligible. Vocabulary records start empty. Every introduction, response,
 * feedback advance and checkpoint is performed through the production model.
 * This checks progression and coverage, not physical-device behaviour or
 * educational effectiveness.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--report'))throw Error('Usage: node tests/manual/vocabulary-course-traversal.cjs [--report path.json]');
const values=new Map();let serial=0;
const localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),get length(){return values.size;},key:i=>[...values.keys()][i]??null};
const root={Date,console,URLSearchParams,structuredClone,localStorage,sessionStorage:localStorage,setTimeout:()=>0,clearTimeout(){},crypto:{randomUUID:()=>String(++serial)},CustomEvent:class{},dispatchEvent(){},addEventListener(){},document:{addEventListener(){}},KanaCloudSync:{scheduleSync(){},markSectionUpdated(){}}};
root.window=root;
const context=vm.createContext(root);
for(const owner of ['app/mode-atlas-date','app/mode-atlas-storage','app/mode-atlas-review','data/mode-atlas-kana-data','app/mode-atlas-japanese','app/mode-atlas-kana-learning','data/mode-atlas-kanji-curriculum','app/mode-atlas-kanji-state','app/mode-atlas-word-lesson-state','data/mode-atlas-vocabulary','app/mode-atlas-vocabulary']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../../assets',owner+'.js'),'utf8'),context,{filename:owner});
}
const V=root.ModeAtlasVocabulary,L=root.ModeAtlasWordLessonState;
const kana=root.ModeAtlasKanaLearning.read();
for(const character of root.ModeAtlasKanaData.collections.all)kana.introduced[character]=1;
kana.sounds={sokuon:1,longVowels:1,katakanaLength:1};
root.ModeAtlasKanaLearning.save(kana);
assert.equal(V.pool().length,V.data.length,'Every catalogue word should be eligible');
assert.equal(Object.keys(L.read()).length,0,'No vocabulary evidence may be seeded');
let sessions=0,answers=0;
const started=Date.now();
while(sessions<300){
  let session=V.begin();
  if(!session)break;
  sessions++;
  for(let step=0;session.phase!=='complete'&&step<50;step++){
    const task=V.current(session),word=V.byId.get(task.id);
    if(task.mode==='meet'||session.phase==='feedback')session=V.advance(session.id);
    else{
      answers++;
      const answer=task.mode==='meaning'?word.english:task.mode==='produceKana'?word.reading:root.ModeAtlasJapanese.romaji(word.reading);
      session=V.respond(session.id,answer);
    }
  }
  assert.equal(session.phase,'complete','Session must terminate: '+session.id);
  if(sessions%20===0)console.log('Completed '+sessions+' sessions; '+V.status().learned.length+' words introduced.');
}
const records=L.read();
for(const word of V.data)for(const mode of V.modes)assert.ok(V.progress(word.id,records).achieved[mode.id],word.id+' needs independent '+mode.id+' evidence');
const result={scope:'all curated vocabulary entries through guided model tasks',setup:'all character and sound prerequisites introduced; no seeded vocabulary introductions, answers or completions',catalogue:V.data.length,sessions,answers,learned:V.status().learned.length,checkpointCovered:records['vocabulary-course'].preferences.checkpointed.length,finalPlan:V.plan().kind,durationMs:Date.now()-started,passed:true};
assert.equal(result.finalPlan,'complete');
assert.equal(result.learned,V.data.length);
assert.equal(result.checkpointCovered,V.data.length);
assert.equal(V.begin(),null,'The completed course must not start another endless checkpoint');
if(args.length){const report=path.resolve(args[1]);fs.mkdirSync(path.dirname(report),{recursive:true});fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));
