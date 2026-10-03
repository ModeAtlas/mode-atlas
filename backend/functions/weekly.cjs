'use strict';
const {randomUUID,createHash}=require('node:crypto');
const {FieldPath}=require('firebase-admin/firestore');
const {HttpsError}=require('firebase-functions/v2/https');
const policy=require('./shared/mode-atlas-weekly-rules.js');
const kana=require('./shared/mode-atlas-kana-data.js');
const rewards=require('./shared/mode-atlas-reward-rules.js');
const progress=require('./shared/mode-atlas-progress.js')({ModeAtlasRewardRules:rewards});
const {publicProfile}=require('./projection.cjs');
const map=Object.assign({},...Object.values(kana.maps));
const fail=(code,message)=>{throw new HttpsError(code,message);};
function fields(data,allowed){if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!allowed.includes(key)))fail('invalid-argument','Unsupported weekly competition request.');}
function active(account){return account?.active&&!account.deleting&&!account.restricted&&account.weekly?.enabled===true;}
function scoreAnswers(run,answers,at){
  if(!Array.isArray(answers)||!answers.length||answers.length>policy.batchSize)fail('invalid-argument','Send at most 20 new answers.');
  let index=run.index,elapsed=run.elapsed,score=0;
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
    const response=run.direction==='reading'?item.answer.trim().toLowerCase().replace(/\s+/g,''):item.answer.trim();
    const written=kana.splitKana(response);
    const correct=run.direction==='reading'?response===expected:run.mode==='testMode'?response===item.kana:
      written.length===units.length&&written.every((char,i)=>pool.has(char)&&map[char]===map[units[i]]);
    // The declared pool cannot inflate scores from repeating only a few kana.
    if(correct)score+=units.length*rewards.kanaRate(Math.min(run.pool.length,seen.size),run.hints);
    index=item.index;elapsed=item.elapsed;
  }
  return {index,elapsed,seen:[...seen],score};
}
function createWeekly({db,now=Date.now}){
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
    fields(data,['id','pool','direction','mode','hints']);
    if(typeof data.id!=='string'||!/^[a-zA-Z0-9-]{8,100}$/.test(data.id)||!['reading','writing'].includes(data.direction)||!['guided','free','endless','dailyChallenge','testMode','speedRun','timeTrial','comboKana'].includes(data.mode)||typeof data.hints!=='boolean'||!Array.isArray(data.pool)||!data.pool.length||data.pool.length>512||data.pool.some(char=>typeof char!=='string'||!Object.hasOwn(map,char)))fail('invalid-argument','Choose a valid Kana practice session.');
    const period=policy.period(now());
    return db.runTransaction(async tx=>{
      const ref=runs.doc(uid),[self,old,week]=await tx.getAll(account(uid),ref,weeks.doc(period.id));
      if(!active(self.data()))return {enabled:false};
      const previous=old.data();
      if(previous?.id===data.id&&previous.week===period.id&&previous.expiresAt.toMillis()>now())return {enabled:true,token:previous.token,week:period.id,expiresAt:previous.expiresAt.toMillis(),index:previous.index,earned:previous.earned||0};
      const expiresAt=Math.min(now()+policy.runLifetime,period.endAt),token=randomUUID();
      tx.set(ref,{id:data.id,token,week:period.id,pool:[...new Set(data.pool)].sort(),direction:data.direction,mode:data.mode,hints:data.hints,index:0,elapsed:0,seen:[],startedAt:now(),expiresAt:new Date(expiresAt)});
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
      const day=new Date(at).toISOString().slice(0,10),earned=Math.min(result.score,Math.max(0,policy.dailyCap-(old.days[day]||0)));
      const runEarned=(run.earned||0)+earned;
      tx.update(ref,{index:result.index,elapsed:result.elapsed,seen:result.seen,earned:runEarned});
      if(result.index!==run.index)tx.set(entry,{uid,week:period.id,active:true,score:old.score+earned,days:{...old.days,[day]:(old.days[day]||0)+earned},updatedAt:at,expiresAt:new Date(period.endAt+90*86400000)});
      return {index:result.index,earned,runEarned,score:old.score+earned,week:period.id};
    });
  }
  async function state(uid){
    const period=policy.period(now()),[self,awards,place]=await Promise.all([account(uid).get(),db.doc('weeklyAwards/'+uid).get(),rank(uid,period.id)]);
    return {enabled:active(self.data()),period,...(place||{score:0,rank:null}),prizes:policy.prizes,minimumScore:policy.minimumScore,minimumPlayers:policy.minimumPlayers,
      awards:Object.values(awards.data()?.weeks||{}).sort((a,b)=>b.week.localeCompare(a.week)).slice(0,8)};
  }
  async function list(uid,data){
    fields(data,['scope','cursor']);if(!['global','friends'].includes(data.scope))fail('invalid-argument','Choose Global or Friends.');
    const period=policy.period(now()),a=(await account(uid).get()).data();
    if(!active(a))fail('failed-precondition','Join the weekly competition first.');
    let docs,nextCursor=null;
    if(data.scope==='friends'){
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
    if(data.scope==='global')await Promise.all([...new Set(rows.map(row=>row.score))].map(async score=>{
      const above=await entries(period.id).where('active','==',true).where('score','>',score).count().get();ranks.set(score,above.data().count+1);
    }));
    rows.forEach((row,i)=>{if(!ranks.has(row.score))ranks.set(row.score,i+1);row.rank=ranks.get(row.score);});
    return {rows,nextCursor,period,scope:data.scope};
  }
  async function syncAccount(uid){
    const a=(await account(uid).get()).data();
    for(const week of [policy.period(now()).id,policy.period(now()-7*86400000).id]){
      const ref=entries(week).doc(uid);await db.runTransaction(async tx=>{const doc=await tx.get(ref);if(doc.exists&&doc.data().active!==!!active(a))tx.update(ref,{active:!!active(a)});});
    }
  }
  async function settle(week){
    const ref=weeks.doc(week),period=(await ref.get()).data();
    if(!period||period.settled||period.endAt+300000>now())return;
    const qualified=entries(week).where('active','==',true).where('score','>=',policy.minimumScore);
    const podium=await qualified.orderBy('score','desc').limit(3).get();
    if(!period.topScores&&podium.size<policy.minimumPlayers){await ref.update({settled:true,settledAt:now(),reason:'minimum-players'});return;}
    const topScores=await db.runTransaction(async tx=>{
      const current=(await tx.get(ref)).data();
      if(current.topScores)return current.topScores;
      const scores=podium.docs.map(doc=>doc.data().score);
      tx.update(ref,{topScores:scores,frozenAt:now()});return scores;
    });
    const cutoff=topScores.at(-1);
    let cursor=period.awardCursor||null;
    // Bound one scheduled invocation; the durable cursor resumes large ties.
    let query=entries(week).where('active','==',true).where('score','>=',cutoff).orderBy('score','desc').orderBy(FieldPath.documentId()).limit(100);
    if(cursor)query=query.startAfter(cursor.score,cursor.uid);
    const found=await query.get();
    for(const entry of found.docs){
      const place=topScores.filter(score=>score>entry.data().score).length+1;
      if(place>3)continue;
      const uid=entry.id,xp=policy.prizes[place-1],prize=ref.collection('awards').doc(uid),saveRef=db.doc(`users/${uid}/appData/kanaTrainer`),history=db.doc('weeklyAwards/'+uid);
      await db.runTransaction(async tx=>{
        const [existing,self,save,receipt,barrier,current]=await tx.getAll(prize,account(uid),saveRef,history,db.doc('accountDeletions/'+uid),entry.ref);
        if(existing.exists||barrier.exists||!active(self.data())||!current.data()?.active)return;
        const value=save.data()||{},state=progress.normalizeState(value.sections?.progress?.data?.state||{legacySeeded:true});
        state.claims[`v5:weekly:${week}:prize`]=xp;state.updatedAt=now();
        const award={week,rank:place,xp,score:entry.data().score,at:now()};
        const historyRows={...(receipt.data()?.weeks||{}),[week]:award};
        tx.set(prize,{...award,uid,expiresAt:new Date(period.endAt+90*86400000)});
        tx.set(history,{weeks:Object.fromEntries(Object.entries(historyRows).sort(([a],[b])=>b.localeCompare(a)).slice(0,52))});
        tx.set(saveRef,{...value,updatedAt:now(),sections:{...value.sections,progress:{updatedAt:now(),data:{state}}}});
      });
    }
    const last=found.docs.at(-1);
    await ref.update(found.size===100?{awardCursor:{uid:last.id,score:last.data().score}}:{settled:true,settledAt:now(),awardCursor:null});
  }
  async function maintain(){
    const pending=await weeks.where('settled','==',false).where('endAt','<=',now()-300000).orderBy('endAt').limit(3).get();
    for(const week of pending.docs)await settle(week.id);
  }
  async function erase(uid){
    await Promise.all([runs.doc(uid).delete(),db.doc('weeklyAwards/'+uid).delete()]);
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
