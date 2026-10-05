'use strict';
const {createHash,randomUUID}=require('node:crypto');
const {FieldPath}=require('firebase-admin/firestore');
const {HttpsError}=require('firebase-functions/v2/https');
const dates=require('./shared/mode-atlas-date.js');
const rules=require('./shared/mode-atlas-reward-rules.js');
const weeklyRules=require('./shared/mode-atlas-weekly-rules.js');
const timing=require('./shared/mode-atlas-notification-rules.js');
const createProgress=require('./shared/mode-atlas-progress.js');
const kinds=['dailyGoals','weeklyGoals','streak','overtaken'];
const blank=()=>Object.fromEntries(kinds.map(kind=>[kind,false]));
const hash=value=>createHash('sha256').update(value).digest('hex');
function evening(save,preferences,timeZone,at,schedule){
  const day=dates.dateKeyInTimeZone(at,timeZone);
  if(!timing.allowed(at,timeZone,schedule,true))return null;
  const owner=createProgress({ModeAtlasRewardRules:rules,ModeAtlasDates:{...dates,localDateKey:value=>dates.dateKeyInTimeZone(value,timeZone)}});
  const state=owner.normalizeState(save?.sections?.progress?.data?.state),routine=owner.routine(state,at),parts=[];
  if(preferences.dailyGoals&&routine.goals.some(g=>g.period==='daily'&&g.value<g.target))parts.push('Your daily goals reset at midnight.');
  if(preferences.weeklyGoals&&new Date(day+'T12:00:00Z').getUTCDay()===0&&routine.goals.some(g=>g.period==='weekly'&&g.value<g.target))parts.push('Your weekly goals finish tonight.');
  if(preferences.streak&&routine.streak>0&&!owner.studyDays(state).includes(day))parts.push(`Keep your ${routine.streak}-day streak with five correct kana before midnight.`);
  return parts.length?{id:'evening-'+day,title:'Still time for a little practice',body:parts.join(' '),destination:'yourAtlas',expiresAt:timing.expiresAt(at,timeZone,schedule,true)}:null;
}
function createNotifications({db,messaging,weekly,now=Date.now}){
  const accounts=db.collection('notificationAccounts'),devices=db.collection('notificationDevices');
  async function state(uid){const doc=await accounts.doc(uid).get();return {preferences:{...blank(),...doc.data()?.preferences},schedule:timing.normalize(doc.data()?.schedule)};}
  async function configure(uid,data){
    if(!data||Object.keys(data).some(key=>!['preferences','token','timeZone','schedule','localReminder'].includes(key))||!data.preferences||Object.keys(data.preferences).length!==kinds.length||kinds.some(key=>typeof data.preferences[key]!=='boolean'))throw new HttpsError('invalid-argument','Choose valid notification preferences.');
    if(data.schedule!==undefined&&!timing.valid(data.schedule))throw new HttpsError('invalid-argument','Choose times in 15-minute steps and an alert time outside quiet hours.');
    const local=data.localReminder;
    if(local!==undefined&&(!local||Object.keys(local).length!==3||typeof local.enabled!=='boolean'||!Number.isInteger(local.hour)||local.hour<0||local.hour>23||!Number.isInteger(local.minute)||local.minute<0||local.minute>59))throw new HttpsError('invalid-argument','Choose a valid daily reminder.');
    const enabled=kinds.some(key=>data.preferences[key]),timeZone=String(data.timeZone||'');
    try{if(timeZone.length>64)throw new Error();new Intl.DateTimeFormat('en',{timeZone});}catch{throw new HttpsError('invalid-argument','Choose a valid notification time zone.');}
    const token=data.token;
    if(typeof token!=='string'||(token&&(token.length<20||token.length>4096||/[^\x21-\x7e]/.test(token))))throw new HttpsError('invalid-argument','Register this iPhone for notifications first.');
    return db.runTransaction(async tx=>{
      const ref=accounts.doc(uid),[old,barrier]=await tx.getAll(ref,db.doc('accountDeletions/'+uid));
      if(barrier.exists)throw new HttpsError('unauthenticated','This account is being deleted.');
      const previous=old.data()||{},id=enabled&&token?hash(token):null;
      const oldDevice=id?(await tx.get(devices.doc(id))).data():null;
      const schedule=timing.normalize(data.schedule??previous.schedule);
      if(enabled&&!id&&kinds.some(key=>data.preferences[key]&&!previous.preferences?.[key]))throw new HttpsError('invalid-argument','Register this iPhone for notifications first.');
      const devicesByTime={...previous.devices,...(id?{[id]:now()}:{})};
      const kept=Object.fromEntries(Object.entries(devicesByTime).sort((a,b)=>b[1]-a[1]).slice(0,5));
      tx.set(ref,{...previous,preferences:data.preferences,timeZone,schedule,enabled,devices:kept,updatedAt:now()});
      if(id)tx.set(devices.doc(id),{uid,token,localReminder:local||(oldDevice?.uid===uid&&oldDevice.localReminder)||{enabled:false,hour:19,minute:0},updatedAt:now(),expiresAt:new Date(now()+30*86400000)});
      // A token has exactly one owner even when accounts share the same iPhone.
      return {preferences:data.preferences,schedule};
    });
  }
  async function unregister(uid,data){
    if(!data||Object.keys(data).some(key=>key!=='token')||typeof data.token!=='string'||data.token.length>4096)throw new HttpsError('invalid-argument','Invalid device registration.');
    const id=hash(data.token);
    await db.runTransaction(async tx=>{
      const ref=accounts.doc(uid),tokenRef=devices.doc(id),[profile,device]=await tx.getAll(ref,tokenRef);
      if(device.data()?.uid===uid)tx.delete(tokenRef);
      if(profile.exists){const values={...profile.data().devices};delete values[id];tx.update(ref,{devices:values});}
    });return {ok:true};
  }
  async function send(uid,notice){
    if(!messaging)return;
    const ref=accounts.doc(uid),receipt=ref.collection('deliveries').doc(notice.id),lease=randomUUID();
    const tokens=await db.runTransaction(async tx=>{
      const [settings,existing,barrier]=await tx.getAll(ref,receipt,db.doc('accountDeletions/'+uid)),value=settings.data();
      if(!value?.enabled||barrier.exists||existing.exists||notice.expiresAt<=now())return [];
      if(!timing.allowed(now(),value.timeZone,value.schedule))return [];
      if(notice.kind&&!value.preferences?.[notice.kind])return [];
      if(!notice.kind&&!['dailyGoals','weeklyGoals','streak'].some(key=>value.preferences?.[key]))return [];
      if(!notice.kind){
        const save=await tx.get(db.doc(`users/${uid}/appData/kanaTrainer`));
        const fresh=evening(save.data(),value.preferences,value.timeZone,now(),value.schedule);
        if(!fresh)return [];notice=fresh;
      }
      notice.expiresAt=Math.min(notice.expiresAt,timing.expiresAt(now(),value.timeZone,value.schedule,!notice.kind));
      const ids=Object.keys(value.devices||{}),records=ids.length?await tx.getAll(...ids.map(id=>devices.doc(id))):[];
      const active=records.filter(doc=>doc.data()?.uid===uid&&doc.data().expiresAt.toMillis()>now()&&(notice.kind||!timing.overlaps(doc.data().localReminder,value.schedule))).map(doc=>({id:doc.id,token:doc.data().token}));
      if(!active.length)return [];
      // Claim before sending: a scheduler retry never creates a second alert.
      // A crash after this claim may miss an alert; it cannot spam the learner.
      tx.create(receipt,{lease,claimedAt:now(),expiresAt:new Date(now()+8*86400000)});
      return active;
    });
    if(!tokens.length)return;
    let user;
    try{user=await messaging.sendEachForMulticast({tokens:tokens.map(item=>item.token),notification:{title:notice.title,body:notice.body},data:{destination:notice.destination,owner:uid},
      apns:{headers:{'apns-collapse-id':notice.id,'apns-expiration':String(Math.floor(notice.expiresAt/1000))},payload:{aps:{sound:'default'}}}});}
    catch(error){await receipt.update({failedAt:now(),error:String(error.code||'send-failed')});return;}
    const batch=db.batch();
    user.responses.forEach((result,index)=>{if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(result.error?.code))batch.delete(devices.doc(tokens[index].id));});
    batch.update(receipt,{sentAt:now(),delivered:user.successCount});await batch.commit();
  }
  async function inspect(uid){
    const ref=accounts.doc(uid),settings=(await ref.get()).data();if(!settings?.enabled)return;
    const at=now(),save=(await db.doc(`users/${uid}/appData/kanaTrainer`).get()).data();
    const notice=evening(save,settings.preferences,settings.timeZone,at,settings.schedule);
    if(notice)await send(uid,notice);
    if(!settings.preferences.overtaken)return;
    const period=weeklyRules.period(at),place=await weekly.rank(uid,period.id),previous=settings.rank;
    if(!place)return;
    const day=dates.dateKeyInTimeZone(at,settings.timeZone);
    if(previous?.week===period.id&&place.rank>previous.value&&timing.allowed(at,settings.timeZone,settings.schedule))await send(uid,{id:'rank-'+day,kind:'overtaken',title:'A little friendly competition',body:`You’re now #${place.rank} in this week’s global ranking. Ready for another session?`,destination:'weekly',expiresAt:Math.min(timing.expiresAt(at,settings.timeZone,settings.schedule),period.endAt)});
    // Establish a baseline without an alert on first entry or after the reset.
    await ref.set({rank:{week:period.id,value:place.rank,score:place.score}},{merge:true});
  }
  async function maintain(){
    const stateRef=db.doc('engagementJobs/notifications'),state=(await stateRef.get()).data();
    let cursor=state?.cursor||null;
    // Process a bounded sweep, with a durable continuation for larger audiences.
    for(let page=0;page<10;page++){
      let query=accounts.where('enabled','==',true).orderBy(FieldPath.documentId()).limit(100);
      if(cursor)query=query.startAfter(cursor);
      const found=await query.get();
      for(let i=0;i<found.docs.length;i+=10)await Promise.all(found.docs.slice(i,i+10).map(doc=>inspect(doc.id)));
      cursor=found.size===100?found.docs.at(-1).id:null;
      await stateRef.set({cursor,updatedAt:now()});
      if(!cursor)break;
    }
  }
  async function erase(uid){
    let tokens;
    do{tokens=await devices.where('uid','==',uid).limit(400).get();const batch=db.batch();tokens.docs.forEach(doc=>batch.delete(doc.ref));await batch.commit();}while(tokens.size===400);
    await db.recursiveDelete(accounts.doc(uid));
  }
  return {state,configure,unregister,send,inspect,maintain,erase};
}
module.exports={createNotifications,evening};
