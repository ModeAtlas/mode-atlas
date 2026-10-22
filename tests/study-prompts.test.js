const test=require('node:test'),assert=require('node:assert/strict');
const prompts=require('../assets/app/mode-atlas-study-prompts.js');
test('issued questions cover the chosen pool, are reproducible and retry mistakes after intervening retrieval',()=>{
 const run={seed:'server-nonce',branch:'kana',mode:'guided',pool:['あ','い','う','え','お']};
 assert.equal(new Set(Array.from({length:5},(_,i)=>prompts.question(run,i+1))).size,5);
 const char=prompts.question(run,1);prompts.advance(run,1,char,false);
 assert.equal(prompts.question(run,4),char);const copy=structuredClone(run);assert.equal(prompts.question(copy,4),char);
 prompts.advance(run,4,char,true);assert.equal(run.retries.length,0);
 assert.equal(prompts.question({...run,seed:''},1),'');assert.equal(prompts.question(run,4001),'');
});
test('each issued seed changes the order, and Kanji/checkpoint pools stay bounded',()=>{
 const run={seed:'nonce-one',pool:['水','木','人','日','月','火','土','金'],branch:'kanji',mode:'guided'};
 const first=Array.from({length:8},(_,i)=>prompts.question(run,i+1));
 assert.notDeepEqual(first,Array.from({length:8},(_,i)=>prompts.question({...run,seed:'nonce-two'},i+1)));
 prompts.advance(run,1,first[0],false);assert.deepEqual(run.retries,[]);
});
