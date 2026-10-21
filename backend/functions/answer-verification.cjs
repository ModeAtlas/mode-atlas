'use strict';
const {HttpsError}=require('firebase-functions/v2/https');
const policy=require('./shared/mode-atlas-weekly-rules.js');
const kana=require('./shared/mode-atlas-kana-data.js');
const kanji=require('./kanji-verification.cjs');
const rewards=require('./shared/mode-atlas-reward-rules.js');
const map=Object.assign({},...Object.values(kana.maps));
const fail=(code,message)=>{throw new HttpsError(code,message);};
function fields(data,allowed){if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!allowed.includes(key)))fail('invalid-argument','Invalid study receipt.');}
function scoreAnswers(run,answers,at){
  if(run.branch==='kanji')return kanji.score(run,answers,at);
  if(!Array.isArray(answers)||!answers.length||answers.length>policy.batchSize)fail('invalid-argument','Send at most 20 new answers.');
  let index=run.index,elapsed=run.elapsed,score=0;const verified=[];
  const seen=new Set(run.seen),pool=new Set(run.pool);
  for(const item of answers){
    fields(item,['index','kana','answer','elapsed']);
    if(!Number.isInteger(item.index)||item.index<1||typeof item.kana!=='string'||item.kana.length>20||typeof item.answer!=='string'||item.answer.length>40||!Number.isInteger(item.elapsed))fail('invalid-argument','Invalid study answer.');
    if(item.index<=run.index)continue; // Retry after a lost response: no second credit.
    if(item.index!==index+1||item.elapsed<elapsed+200||item.elapsed>at-run.startedAt+60000)fail('failed-precondition','Weekly answers must arrive in order during live practice.');
    const units=kana.splitKana(item.kana);
    if(!units.length||units.length>5||units.some(char=>!pool.has(char)))fail('invalid-argument','That kana is outside this session.');
    units.forEach(char=>seen.add(char));
    const expected=units.map(char=>map[char]).join('');
    const direction=run.direction==='both'?(item.index%2?'reading':'writing'):run.direction;
    const response=direction==='reading'?item.answer.trim().toLowerCase().replace(/\s+/g,''):item.answer.trim();
    const written=kana.splitKana(response);
    const correct=direction==='reading'?response===expected:run.mode==='testMode'?response===item.kana:
      written.length===units.length&&written.every((char,i)=>pool.has(char)&&map[char]===map[units[i]]);
    // The declared pool cannot inflate scores from repeating only a few kana.
    if(correct)score+=units.length*rewards.kanaRate(Math.min(run.pool.length,seen.size),run.hints);
    verified.push({index:item.index,char:item.kana,correct,elapsed:item.elapsed,poolSize:Math.min(run.pool.length,seen.size),units:units.length,direction});
    index=item.index;elapsed=item.elapsed;
  }
  return {index,elapsed,seen:[...seen],score,verified};
}
module.exports={scoreAnswers};
