'use strict';
// Weekly competition verifies Kanji against the same immutable learning data.
// Personal/offline progress remains in the account save, never a score receipt.
const {HttpsError}=require('firebase-functions/v2/https');
const curriculum=require('./shared/mode-atlas-kanji-curriculum.js');
const content=require('./shared/mode-atlas-kanji-content.js')({ModeAtlasKanjiData:require('./shared/mode-atlas-kanji-data.js'),ModeAtlasKanaData:require('./shared/mode-atlas-kana-data.js')});
const state=require('./shared/mode-atlas-kanji-state.js')({ModeAtlasKanjiCurriculum:curriculum});
const rewards=require('./shared/mode-atlas-reward-rules.js');
const policy=require('./shared/mode-atlas-weekly-rules.js');
const fail=(code,message)=>{throw new HttpsError(code,message);};
function valid(data){
  return ['pronunciation','meaning','match'].includes(data.direction)&&['guided','testMode'].includes(data.mode)&&Array.isArray(data.pool)&&data.pool.length>0&&data.pool.length<=40&&data.pool.every(char=>typeof char==='string'&&state.levels.has(char))&&new Set(data.pool.map(c=>state.levels.get(c))).size===1&&typeof data.hints==='boolean'&&(data.direction!=='match'||data.hints===true);
}
function unlocked(data,save){
  if(!state.allowed(state.levels.get(data.pool[0]),state.normalize(save?.sections?.kanji?.data?.state)))fail('failed-precondition','Complete the previous Kanji level before competing with this one.');
}
function score(run,answers,at){
  if(!Array.isArray(answers)||!answers.length||answers.length>policy.batchSize)fail('invalid-argument','Send at most 20 new answers.');
  const pool=new Set(run.pool),seen=new Set(run.seen);let index=run.index,elapsed=run.elapsed,total=0;const verified=[];
  for(const item of answers){
    if(!item||Object.keys(item).some(k=>!['index','kana','answer','elapsed'].includes(k))||!Number.isInteger(item.index)||item.index<1||typeof item.kana!=='string'||!pool.has(item.kana)||typeof item.answer!=='string'||item.answer.length>160||!Number.isInteger(item.elapsed))fail('invalid-argument','Invalid Kanji answer.');
    if(item.index<=run.index)continue;
    if(item.index!==index+1||item.elapsed<elapsed+200||item.elapsed>at-run.startedAt+60000)fail('failed-precondition','Weekly answers must arrive in order during live practice.');
    seen.add(item.kana);
    const correct=content.grade(item.kana,run.direction,item.answer)||(run.direction==='pronunciation'&&(content.get(item.kana).legacyReadings||[]).some(expected=>content.kana(item.answer)===content.hira(expected)));
    verified.push({index:item.index,char:item.kana,correct,elapsed:item.elapsed,poolSize:Math.min(run.pool.length,seen.size),units:1,direction:run.direction});
    if(correct)total+=rewards.kanaRate(Math.min(run.pool.length,seen.size),run.hints||run.direction==='match');
    index=item.index;elapsed=item.elapsed;
  }
  return {index,elapsed,seen:[...seen],score:total,verified};
}
module.exports={valid,unlocked,score};
