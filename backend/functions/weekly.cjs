'use strict';
const {readSave,writeSection}=require('./account-data.cjs');
const {randomUUID,createHash}=require('node:crypto');
const {FieldPath}=require('firebase-admin/firestore');
const {HttpsError}=require('firebase-functions/v2/https');
const policy=require('./shared/mode-atlas-weekly-rules.js');
const kana=require('./shared/mode-atlas-kana-data.js');
const kanji=require('./kanji-verification.cjs');
const rewards=require('./shared/mode-atlas-reward-rules.js');
const progress=require('./shared/mode-atlas-progress.js')({ModeAtlasRewardRules:rewards,ModeAtlasDates:require('./shared/mode-atlas-date.js')});
const {publicProfile}=require('./projection.cjs');
const {createCommerce}=require('./commerce.cjs');
const map=Object.assign({},...Object.values(kana.maps));
const fail=(code,message)=>{throw new HttpsError(code,message);};
function fields(data,allowed){if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!allowed.includes(key)))fail('invalid-argument','Unsupported weekly competition request.');}
function active(account){return account?.active&&!account.deleting&&!account.restricted&&account.weekly?.enabled===true;}
const {scoreAnswers}=require('./answer-verification.cjs');
function createWeekly({db,now=Date.now,commerce=createCommerce({db,now})}){
  const account=uid=>db.doc('socialAccounts/'+uid),weeks=db.collection('weeklyCompetitions');
  const entries=week=>weeks.doc(week).collection('entries');
  const runs=db.collection('weeklyRuns');
  const eligible=week=>entries(week).where('active','==',true).where('score','>',0);
  async function rank(uid,week=policy.period(now()).id){
    const entry=(await entries(week).doc(uid).get()).data();
    if(!entry?.active||!entry.score)return null;
    const above=await entries(week).where('active','==',true).where('score','>',entry.score).count().get();
    return {score:entry.score,rank:above.data().count+1};
  }
  async function preference(uid,data){
    fields(data,['enabled']);if(typeof data.enabled!=='boolean')fail('invalid-argument','Choose whether to join the weekly competition.');
    await db.runTransaction(async tx=>{
      const period=policy.period(now()),ref=account(uid),entry=entries(period.id).doc(uid);
      const [self,current]=await tx.getAll(ref,entry);const a=self.data();
      if(!a?.active||a.deleting||a.restricted)fail('failed-precondition','Create an available Friends profile first.');
      tx.update(ref,{weekly:{enabled:data.enabled,consentedAt:data.enabled?(a.weekly?.consentedAt||now()):0}});
      if(current.exists)tx.update(entry,{active:data.enabled});
      if(!data.enabled)tx.delete(runs.doc(uid));
    });return {enabled:data.enabled};
  }
  async function start(uid,data){
    fields(data,['id','pool','direction','mode','hints','branch','studyToken']);
    const branch=data.branch||'kana';
    const kanaValid=['reading','writing','both'].includes(data.direction)&&['guided','free','endless','dailyChallenge','testMode','speedRun','timeTrial','comboKana'].includes(data.mode)&&!(data.direction==='both'&&['dailyChallenge','testMode','comboKana'].includes(data.mode))&&typeof data.hints==='boolean'&&Array.isArray(data.pool)&&data.pool.length>0&&data.pool.length<=512&&data.pool.every(char=>typeof char==='string'&&Object.hasOwn(map,char));
    if(typeof data.id!=='string'||!/^[a-zA-Z0-9-]{8,100}$/.test(data.id)||!['kana','kanji'].includes(branch)||(branch==='kanji'?!kanji.valid(data):!kanaValid))fail('invalid-argument','Choose a valid practice session.');
    const period=policy.period(now());
    return db.runTransaction(async tx=>{
      const ref=runs.doc(uid),[self,old,week,issued,save]=await tx.getAll(account(uid),ref,weeks.doc(period.id),db.doc('studyEarnings/'+uid+'/runs/'+data.id),...(branch==='kanji'?[db.doc('users/'+uid+'/appData/kanaTrainer')]:[]));
      if(!active(self.data()))return {enabled:false};
      if(branch==='kanji')kanji.unlocked(data,await readSave(tx,save));
      const authority=issued.data();
      if(!authority?.seed||authority.token!==data.studyToken||authority.expiresAt.toMillis()<=now()||JSON.stringify(authority.pool)!==JSON.stringify([...new Set(data.pool)].sort())||authority.direction!==data.direction||authority.mode!==data.mode||authority.hints!==data.hints||authority.branch!==branch)fail('failed-precondition','Start a server-issued practice session first.');
      const previous=old.data();
      if(previous?.id===data.id&&previous.week===period.id&&previous.expiresAt.toMillis()>now())return {enabled:true,token:previous.token,week:period.id,expiresAt:previous.expiresAt.toMillis(),index:previous.index,earned:previous.earned||0};
      const expiresAt=Math.min(now()+policy.runLifetime,period.endAt),token=randomUUID();
      tx.set(ref,{id:data.id,branch,token,week:period.id,pool:[...new Set(data.pool)].sort(),direction:data.direction,mode:data.mode,hints:data.hints,index:0,elapsed:0,seen:[],startedAt:authority.startedAt,seed:authority.seed,retries:[],authorityStreak:0,expiresAt:new Date(expiresAt)});
      if(!week.exists)tx.create(weeks.doc(period.id),{...period,settled:false});
      return {enabled:true,token,week:period.id,expiresAt,index:0,earned:0};
    });
  }
  async function submit(uid,data){
    fields(data,['token','answers']);if(typeof data.token!=='string'||data.token.length>100)fail('invalid-argument','Invalid weekly session.');
    return db.runTransaction(async tx=>{
      const at=now(),period=policy.period(at),ref=runs.doc(uid),entry=entries(period.id).doc(uid);
      const [self,record,current]=await tx.getAll(account(uid),ref,entry);const run=record.data();
      if(!active(self.data()))fail('failed-precondition','Join the weekly competition to submit practice.');
      if(!run||run.token!==data.token||run.week!==period.id||run.expiresAt.toMillis()<=at)fail('failed-precondition','This weekly session has ended. Start a new practice session.');
      const result=scoreAnswers(run,data.answers,at),old=current.data()||{score:0,days:{}};
      const day=new Date(at).toISOString().slice(0,10),added=result.index-run.index,attempts={...old.attempts,[day]:(old.attempts?.[day]||0)+added};
      if(attempts[day]>policy.maxDailyAnswers)fail('resource-exhausted','Today’s ranked practice allowance is complete. Your personal practice still counts.');
      const integrity={answers:old.integrity?.answers||0,nearMinimum:old.integrity?.nearMinimum||0,reviewRequired:old.integrity?.reviewRequired===true};
      let elapsed=run.elapsed;for(const answer of result.verified){integrity.answers++;if(answer.elapsed-elapsed<220)integrity.nearMinimum++;elapsed=answer.elapsed;}
      if(integrity.answers>=500&&integrity.nearMinimum/integrity.answers>.98)integrity.reviewRequired=true;
      const earned=Math.min(result.score,Math.max(0,policy.dailyCap-(old.days[day]||0)));
      const runEarned=(run.earned||0)+earned;
      tx.update(ref,{index:result.index,elapsed:result.elapsed,seen:result.seen,retries:run.retries,authorityStreak:run.authorityStreak,earned:runEarned});
      if(result.index!==run.index)tx.set(entry,{uid,week:period.id,active:true,score:old.score+earned,attempts,integrity,days:{...old.days,[day]:(old.days[day]||0)+earned},updatedAt:at,expiresAt:new Date(period.endAt+90*86400000)});
      return {index:result.index,earned,runEarned,score:old.score+earned,week:period.id};
    });
  }
  async function state(uid){
    const period=policy.period(now()),[self,awards,place]=await Promise.all([account(uid).get(),db.doc('weeklyAwards/'+uid).get(),rank(uid,period.id)]);
    return {enabled:active(self.data()),period,...(place||{score:0,rank:null}),prizes:policy.prizes,coinPrizes:policy.coinPrizes,minimumScore:policy.minimumScore,minimumPlayers:policy.minimumPlayers,
      awards:Object.values(awards.data()?.weeks||{}).sort((a,b)=>b.week.localeCompare(a.week)).slice(0,8),
      results:Object.values({...awards.data()?.weeks,...awards.data()?.results}).sort((a,b)=>b.week.localeCompare(a.week)).slice(0,8)};
  }
  async function list(uid,data){
    fields(data,['scope','cursor']);if(!['global','friends','nearby'].includes(data.scope))fail('invalid-argument','Choose Global, Nearby or Friends.');
    const period=policy.period(now()),a=(await account(uid).get()).data();
    if(!active(a))fail('failed-precondition','Join the weekly competition first.');
    let docs,nextCursor=null;
    if(data.scope==='nearby'){
      if(data.cursor)fail('invalid-argument','Refresh your nearby ranking.');
      const self=await entries(period.id).doc(uid).get(),score=self.data()?.score;
      if(!self.data()?.active||!score)return {rows:[],nextCursor:null,period,scope:data.scope};
      const [above,below]=await Promise.all([
        eligible(period.id).orderBy('score','asc').orderBy(FieldPath.documentId(),'desc').startAfter(score,uid).limit(8).get(),
        eligible(period.id).orderBy('score','desc').orderBy(FieldPath.documentId()).startAfter(score,uid).limit(8).get()
      ]);
      docs=[...above.docs,self,...below.docs];
    }else if(data.scope==='friends'){
      if(data.cursor)fail('invalid-argument','Refresh this week’s friends ranking.');
      docs=await db.getAll(...[uid,...Object.keys(a.friends||{})].map(id=>entries(period.id).doc(id)));
    }else{
      let query=eligible(period.id).orderBy('score','desc').orderBy(FieldPath.documentId()).limit(40);
      if(data.cursor){
        if(typeof data.cursor!=='object'||!Number.isInteger(data.cursor.score)||data.cursor.score<1||typeof data.cursor.uid!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(data.cursor.uid))fail('invalid-argument','Refresh the weekly ranking.');
        query=query.startAfter(data.cursor.score,data.cursor.uid);
      }
      const found=await query.get();docs=found.docs;
      if(found.size===40){const last=docs.at(-1);nextCursor={score:last.data().score,uid:last.id};}
    }
    const visible=docs.filter(doc=>doc.exists&&doc.data().active&&doc.data().score>0);
    const accounts=visible.length?await db.getAll(...visible.map(doc=>account(doc.id)),...visible.map(doc=>db.doc('socialBlocks/'+createHash('sha256').update([uid,doc.id].sort().join(':')).digest('hex')))):[];
    const rows=[];
    for(let i=0;i<visible.length;i++){
      const doc=visible[i],other=accounts[i].data();if(!active(other)||accounts[i+visible.length].exists)continue;
      if(data.scope==='friends'&&doc.id!==uid&&!Object.hasOwn(other.friends||{},uid))continue;
      const profile=publicProfile(doc.id,other,now(),false);if(profile)rows.push({...profile,score:doc.data().score});
    }
    rows.sort((a,b)=>b.score-a.score||a.uid.localeCompare(b.uid));
    const ranks=new Map();
    if(data.scope==='global'&&docs.length){
      const first=docs[0],score=first.data().score;
      // Two bounded aggregates per page preserve absolute ranks and ties, even
      // if a cursor splits a tie or privacy removes some displayed profiles.
      const [position,higher]=await Promise.all([
        eligible(period.id).orderBy('score','desc').orderBy(FieldPath.documentId()).endBefore(score,first.id).count().get(),
        eligible(period.id).where('score','>',score).count().get()
      ]);
      let last=score,place=higher.data().count+1;
      docs.forEach((doc,i)=>{const value=doc.data().score;if(value!==last){place=position.data().count+i+1;last=value;}ranks.set(value,place);});
    }else if(data.scope==='nearby'){
      // Older clients may still request this retired view. Its small, fixed
      // neighborhood retains compatibility without affecting the global page.
      await Promise.all([...new Set(rows.map(row=>row.score))].map(async score=>{
        const above=await eligible(period.id).where('score','>',score).count().get();ranks.set(score,above.data().count+1);
      }));
    }
    rows.forEach((row,i)=>{if(!ranks.has(row.score))ranks.set(row.score,i+1);row.rank=ranks.get(row.score);});
    return {rows,nextCursor,period,scope:data.scope};
  }
  async function syncAccount(uid){
    for(const week of [policy.period(now()).id,policy.period(now()-7*86400000).id]){
      const ref=entries(week).doc(uid);
      await db.runTransaction(async tx=>{
        const [doc,period,self]=await tx.getAll(ref,weeks.doc(week),account(uid));
        // A closed week's eligibility freezes before results are recorded. Its
        // public board is no longer exposed; private results survive opt-out.
        if(!period.data()?.frozenAt&&doc.exists&&doc.data().active!==!!active(self.data()))tx.update(ref,{active:!!active(self.data())});
      });
    }
  }
  async function settle(week){
    const ref=weeks.doc(week),initial=(await ref.get()).data();
    if(!initial||initial.settled||initial.endAt+300000>now())return;
    const period=await db.runTransaction(async tx=>{
      const current=(await tx.get(ref)).data();if(current.settled||current.frozenAt)return current;
      const podium=await tx.get(entries(week).where('active','==',true).where('score','>=',policy.minimumScore).orderBy('score','desc').orderBy(FieldPath.documentId()).limit(3));
      const frozen={...current,topScores:current.topScores||podium.docs.map(doc=>doc.data().score),frozenAt:now()};
      if(frozen.topScores.length<policy.minimumPlayers)frozen.reason='minimum-players';
      tx.set(ref,frozen);return frozen;
    });
    if(period.settled)return;
    const cursor=period.resultsCursor||null;
    let query=eligible(week).orderBy('score','desc').orderBy(FieldPath.documentId()).limit(100);
    if(cursor)query=query.startAfter(cursor.score,cursor.uid);
    const found=await query.get();
    let count=period.resultCount||0,lastScore=period.lastScore??null,lastRank=period.lastRank||0;
    const ranked=found.docs.map(entry=>{
      count++;const score=entry.data().score,place=score===lastScore?lastRank:count;
      lastScore=score;lastRank=place;return {entry,score,place};
    });
    // Results and prizes share one idempotent transaction per learner. Bound the
    // invocation to 100 entries, with ten concurrent transactions and a cursor.
    for(let index=0;index<ranked.length;index+=10)await Promise.all(ranked.slice(index,index+10).map(async({entry,score,place})=>{
      const uid=entry.id,prize=ref.collection('awards').doc(uid),saveRef=db.doc(`users/${uid}/appData/kanaTrainer`),history=db.doc('weeklyAwards/'+uid);
      const eligiblePrize=period.topScores.length>=policy.minimumPlayers&&score>=policy.minimumScore&&place<=3;
      await db.runTransaction(async tx=>{
        const [existing,self,receipt,barrier,current]=await tx.getAll(prize,account(uid),history,db.doc('accountDeletions/'+uid),entry.ref);
        if(barrier.exists||!self.exists||!current.exists||receipt.data()?.results?.[week])return;
        let held=eligiblePrize&&current.data()?.integrity?.reviewRequired===true;
        let awardPrize=eligiblePrize&&!held&&active(self.data())&&!existing.exists,saveInvalid=false,value;
        const save=awardPrize?await tx.get(saveRef):null;
        if(save)try{value=await readSave(tx,save);}catch(error){if(error.code!=='invalid-account-save')throw error;held=true;awardPrize=false;saveInvalid=true;}
        const coinAward=awardPrize&&policy.coinPrizes[place-1]?await commerce.prepareWeeklyPrize(tx,uid,week,policy.coinPrizes[place-1]):null;
        const xp=existing.data()?.xp||(awardPrize?policy.prizes[place-1]:0),coins=coinAward?.amount||existing.data()?.coins||0,result={week,rank:place,xp,coins,score,at:now(),...(held?{rewardStatus:'review'}:{})};
        if(held)tx.set(db.doc('weeklyRewardReviews/'+week+'-'+uid),{uid,week,rank:place,score,reason:saveInvalid?'invalid-save':'timing-pattern',at:now()});
        const previous=receipt.data()||{},results={...previous.results,[week]:result},awards={...previous.weeks};
        if(awardPrize){
          coinAward?.commit();
          const state=progress.normalizeState(value.sections?.progress?.data?.state||{legacySeeded:true});
          state.claims[`v5:weekly:${week}:prize`]=xp;state.updatedAt=now();
          awards[week]=result;
          tx.set(prize,{...result,uid,expiresAt:new Date(period.endAt+90*86400000)});
          writeSection(tx,save,'progress',{updatedAt:now(),data:{state}});
        }
        const recent=rows=>Object.fromEntries(Object.entries(rows).sort(([a],[b])=>b.localeCompare(a)).slice(0,52));
        tx.set(history,{weeks:recent(awards),results:recent(results)});
        tx.update(entry.ref,{finalRank:place,finalizedAt:now()});
      });
    }));
    const last=found.docs.at(-1);
    await db.runTransaction(async tx=>{
      const current=(await tx.get(ref)).data();
      if(current.settled||JSON.stringify(current.resultsCursor||null)!==JSON.stringify(cursor))return;
      tx.update(ref,{resultCount:count,lastScore,lastRank,...(found.size===100?{resultsCursor:{uid:last.id,score:last.data().score}}:{settled:true,settledAt:now(),resultsCursor:null})});
    });
  }
  async function maintain(){
    const pending=await weeks.where('settled','==',false).where('endAt','<=',now()-300000).orderBy('endAt').limit(3).get();
    for(const week of pending.docs)await settle(week.id);
  }
  async function erase(uid){
    await Promise.all([runs.doc(uid).delete(),db.doc('weeklyAwards/'+uid).delete()]);
    const held=await db.collection('weeklyRewardReviews').where('uid','==',uid).get();
    if(!held.empty){const batch=db.batch();held.docs.forEach(doc=>batch.delete(doc.ref));await batch.commit();}
    for(const collection of ['entries','awards']){
      let found;
      do{
        found=await db.collectionGroup(collection).where('uid','==',uid).limit(400).get();
        const batch=db.batch();found.docs.forEach(doc=>batch.delete(doc.ref));await batch.commit();
      }while(found.size===400);
    }
  }
  return {preference,start,submit,state,list,rank,syncAccount,settle,maintain,erase};
}
module.exports={createWeekly,scoreAnswers,active};
