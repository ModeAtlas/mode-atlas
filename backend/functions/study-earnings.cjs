'use strict';
// Economic evidence is private server data. Personal saves are never an input.
const {HttpsError}=require('firebase-functions/v2/https');
const {scoreAnswers}=require('./answer-verification.cjs');
const kanji=require('./kanji-verification.cjs');
const kana=require('./shared/mode-atlas-kana-data.js');
const rewards=require('./shared/mode-atlas-reward-rules.js');
const dates=require('./shared/mode-atlas-date.js');
const createProgress=require('./shared/mode-atlas-progress.js');
const catalogue=require('./shared/mode-atlas-shop-catalogue.js');
const map=Object.assign({},...Object.values(kana.maps));
const DAY=86400000;
const fail=(code,message)=>{throw new HttpsError(code,message);};
function opening(wallet={}){
  const level=Math.max(1,Math.min(999,wallet.levelRewards?.throughLevel||1));
  let xp=0;for(let n=1;n<level;n++)xp+=rewards.levelRequirement(n);
  return {version:1,state:{version:7,legacySeeded:true,adjustments:xp?{'earned-opening':{id:'earned-opening',amount:xp,at:1}}:{}},
    answerOffset:(wallet.tokenRewards?.answers||0)*catalogue.studyTokens.answerDivisor,streakOffset:wallet.tokenRewards?.streaks||0,days:[]};
}
function asSave(ledger){return {sections:{progress:{data:{state:ledger.state}}}};}
function createEarnings({db,now=Date.now}){
  async function submit(uid,data){
    if(!data||Object.keys(data).some(k=>!['id','config','startedAt','answers','complete','completed'].includes(k))||!/^[a-zA-Z0-9-]{8,100}$/.test(data.id)||!Number.isInteger(data.startedAt)||data.startedAt<now()-7*DAY||data.startedAt>now()+60000||!Array.isArray(data.answers)||data.answers.length>20||typeof data.complete!=='boolean'||(data.completed!==undefined&&typeof data.completed!=='boolean'))fail('invalid-argument','This practice receipt could not be verified.');
    const cfg=data.config;
    if(!cfg||Object.keys(cfg).some(k=>!['branch','pool','direction','mode','hints'].includes(k)))fail('invalid-argument','Invalid practice selection.');
    const branch=cfg.branch||'kana';
    if(branch==='kanji'?!kanji.valid(cfg):branch!=='kana'||!['reading','writing','both'].includes(cfg.direction)||!['guided','free','endless','dailyChallenge','testMode','speedRun','timeTrial','comboKana'].includes(cfg.mode)||typeof cfg.hints!=='boolean'||!Array.isArray(cfg.pool)||!cfg.pool.length||cfg.pool.length>512||cfg.pool.some(c=>!Object.hasOwn(map,c)))fail('invalid-argument','Invalid practice selection.');
    return db.runTransaction(async tx=>{
      const ref=db.doc('studyEarnings/'+uid),receipt=ref.collection('runs').doc(data.id),day=new Date(data.startedAt).toISOString().slice(0,10),dayRef=ref.collection('days').doc(day);
      const [saved,prior,wallet,budget,deleting,profile]=await tx.getAll(ref,receipt,db.doc('commerceAccounts/'+uid),dayRef,db.doc('accountDeletions/'+uid),db.doc('socialAccounts/'+uid));
      if(deleting.exists)fail('unauthenticated','This account is being deleted.');
      const ledger=saved.data()||opening(wallet.data()),old=prior.data();
      const signature=JSON.stringify({...cfg,pool:[...new Set(cfg.pool)].sort()});
      if(old&&(old.signature!==signature||old.startedAt!==data.startedAt))fail('invalid-argument','This receipt already belongs to another session.');
      if(old?.done)return {index:old.index,done:true};
      const run=old||{...cfg,branch,zone:profile.data()?.profile?.timeZone||'UTC',signature,startedAt:data.startedAt,index:0,elapsed:0,seen:[],correct:0,streak:0,bestStreak:0};
      const result=data.answers.length?scoreAnswers(run,data.answers,now()):{index:run.index,elapsed:run.elapsed,seen:run.seen,score:0,verified:[]};
      const daily=budget.data()||{answers:0,elapsed:0};
      // A resumed offline session may span a night. Bound each answer's
      // contribution so suspended time does not consume the study allowance.
      let previousElapsed=run.elapsed;
      const elapsed=result.verified.reduce((sum,answer)=>{const interval=Math.max(0,answer.elapsed-previousElapsed);previousElapsed=answer.elapsed;return sum+Math.min(interval,300000);},0),added=result.index-run.index;
      if(daily.answers+added>4000||daily.elapsed+elapsed>18*3600000)fail('resource-exhausted','Today’s reward allowance is complete. Your personal practice still counts.');
      let state=ledger.state;
      const storage={json:(key,fallback)=>key==='modeAtlasProgress'?state:fallback,setJSON:(_key,value)=>{state=value;return true;},get:(key,fallback)=>key==='modeAtlasProgressDeviceId'?'verified-study':fallback,set:()=>true,readModeJSON:(_m,_k,fallback)=>fallback};
      const owner=createProgress({ModeAtlasStorage:storage,ModeAtlasRewardRules:rewards,ModeAtlasDates:{...dates,localDateKey:value=>dates.dateKeyInTimeZone(value,run.zone||'UTC')}});
      state=owner.normalizeState(state);state.runs[data.id]={answers:run.index,done:false,at:now()};
      owner.startRun(data.id);
      for(const answer of result.verified){
        run.correct+=Number(answer.correct);run.streak=answer.correct?run.streak+1:0;run.bestStreak=Math.max(run.bestStreak,run.streak);
        const common={runId:data.id,index:answer.index,at:data.startedAt+answer.elapsed,correct:answer.correct,assisted:cfg.hints,poolSize:answer.poolSize};
        if(branch==='kanji')owner.recordKanjiAnswer({...common,skill:cfg.direction});
        else {const chars=kana.splitKana(answer.char);owner.recordAnswer({...common,mode:answer.direction,units:chars.length,kana:chars,streak:run.streak,hiragana:chars.filter(c=>/^[ぁ-ゖ]+$/.test(c)).length,katakana:chars.filter(c=>/^[ァ-ヺー]+$/.test(c)).length,reviewed:[],milestones:[]});}
      }
      if(data.complete&&result.index)owner.finishRun({runId:data.id,branch,direction:branch==='kanji'?'kanji-'+cfg.direction:cfg.direction,mode:cfg.mode,count:result.index,poolSize:result.seen.length,answered:result.index,correct:run.correct,unique:result.seen.length,bestStreak:run.bestStreak,completed:data.completed===true,assisted:cfg.hints,hintsEnabled:cfg.hints,day:dates.dateKeyInTimeZone(data.startedAt+result.elapsed,run.zone||'UTC')});
      ledger.state=state;ledger.days=[...new Set([...ledger.days,...owner.studyDays(state)])].sort();
      // Keep recent goal evidence; compact its already-earned XP, not raw history.
      const before=owner.getSummary(state).xp,cutoff=new Date(now()-56*DAY).toISOString().slice(0,10);
      for(const key of ['activity','goalPlans','claims'])for(const id of Object.keys(state[key]||{})){const date=id.match(/\d{4}-\d{2}-\d{2}/)?.[0];if(date&&date<cutoff)delete state[key][id];}
      const lost=before-owner.getSummary(owner.normalizeState(state)).xp;
      if(lost){const id='earned-archive';state.adjustments[id]={id,amount:(state.adjustments[id]?.amount||0)+lost,at:now()};}
      tx.set(ref,ledger);
      tx.set(dayRef,{answers:daily.answers+added,elapsed:daily.elapsed+elapsed});
      tx.set(receipt,{...run,index:result.index,elapsed:result.elapsed,seen:result.seen,done:data.complete,updatedAt:now()});
      return {index:result.index,done:data.complete};
    });
  }
  return {submit};
}
module.exports={createEarnings,opening,asSave};
