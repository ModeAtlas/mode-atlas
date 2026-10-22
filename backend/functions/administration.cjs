'use strict';
// Administrator diagnostics. Raw Auth records and save bodies never
// leave this boundary; the response is deliberately an explicit projection.
const {HttpsError}=require('firebase-functions/v2/https');
const {isAdmin}=require('./identity.cjs');
const {randomUUID}=require('node:crypto');
const {readSave}=require('./account-data.cjs');
const {levelFromSave}=require('./projection.cjs');
const kana=require('./shared/mode-atlas-kana-data.js');
const validKana=new Set(kana.collections.all);
const fail=(code,message)=>{throw new HttpsError(code,message);};
const stamp=value=>Number.isFinite(Date.parse(value))?Date.parse(value):0;
function createAdministration({db,auth,staff,now=Date.now}){
  async function authorize(actor){
    if(!isAdmin(actor)||await staff.current(actor)!=='admin')fail('permission-denied','Only Admin can access account diagnostics.');
  }
  function fields(data,allowed){if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!allowed.includes(key)))fail('invalid-argument','Refresh account diagnostics.');}
  async function directory(actor,data){
    await authorize(actor);fields(data,['cursor','query']);
    const query=typeof data.query==='string'?data.query.trim():'';
    if(data.query!==undefined&&(typeof data.query!=='string'||query.length>254)||data.cursor!==undefined&&(typeof data.cursor!=='string'||data.cursor.length>2048)||query&&data.cursor)fail('invalid-argument','Use an exact email address or account ID.');
    let page;
    try{
      if(query){const user=await(query.includes('@')?auth.getUserByEmail(query):auth.getUser(query));page={users:[user]};}
      else page=await auth.listUsers(25,data.cursor||undefined);
    }catch(error){
      if(error.code==='auth/user-not-found')return {rows:[],nextCursor:null};
      if(['auth/invalid-page-token','auth/invalid-uid','auth/invalid-email'].includes(error.code))fail('invalid-argument','Use an exact email address or account ID.');
      throw error;
    }
    const records=page.users.length?await db.getAll(...page.users.map(user=>db.doc('socialAccounts/'+user.uid))):[];
    const access=await db.runTransaction(tx=>staff.readMany(tx,actor,[null,...page.users]));
    if(!access[0].canManage)fail('permission-denied','Only Admin can access account diagnostics.');
    return {rows:page.users.map((user,i)=>({uid:user.uid,email:user.email||'',displayName:records[i].data()?.profile?.displayName||user.displayName||'Learner',
      role:access[i+1].targetRole,verified:user.emailVerified===true,disabled:user.disabled===true,createdAt:stamp(user.metadata?.creationTime),lastSignInAt:stamp(user.metadata?.lastSignInTime),
      friends:records[i].data()?.active===true,restricted:records[i].data()?.restricted===true})),nextCursor:page.pageToken||null};
  }
  async function inspect(actor,data){
    await authorize(actor);fields(data,['uid']);if(!staff.validUid(data.uid))fail('invalid-argument','Choose an account.');
    const target=await staff.user(data.uid);if(!target)fail('not-found','This account no longer exists.');
    const refs=[`users/${data.uid}/appData/kanaTrainer`,`commerceAccounts/${data.uid}`,`socialAccounts/${data.uid}`,`socialWarnings/${data.uid}`,`socialRestrictions/${data.uid}`,`accountDeletions/${data.uid}`,`socialProjectionQueue/${data.uid}`].map(path=>db.doc(path));
    const docs=await db.getAll(...refs),[save,wallet,social,warnings]=docs.map(doc=>doc.data()||{});
    const receipts=await db.collection('studyEarnings/'+data.uid+'/runs').orderBy('updatedAt','desc').limit(5).get();
    let restored={},saveProblem='';try{restored=await readSave(db,docs[0]);}catch(error){if(error.code!=='invalid-account-save')throw error;saveProblem='Invalid or oversized save. Keep the device copy and repair before syncing.';}
    const practiced=new Set();let correct=0,attempts=0;
    for(const mode of ['reading','writing'])for(const [char,row]of Object.entries(restored.sections?.[mode]?.data?.stats||{})){
      if(!validKana.has(char))continue;
      const right=Math.max(0,Math.min(10000000,Number(row?.correct)||0)),wrong=Math.max(0,Math.min(10000000,Number(row?.wrong)||0));
      if(right+wrong)practiced.add(char);correct+=right;attempts+=right+wrong;
    }
    await authorize(actor);
    return {uid:data.uid,providers:(target.providerData||[]).map(row=>row.providerId),verified:target.emailVerified===true,disabled:target.disabled===true,
      save:{problem:saveProblem,exists:docs[0].exists,version:save.storageVersion||save.schemaVersion||1,revision:save.revision||0,generation:save.generation||0,updatedAt:docs[0].updateTime?.toMillis()||0,
        sections:Object.entries(save.sections||{}).map(([name,section])=>({name,partitioned:!!section?.storage,parts:Array.isArray(section?.storage?.parts)?section.storage.parts.length:0}))},
      wallet:{exists:docs[1].exists,balance:wallet.balance||0,tokenBalance:wallet.tokenBalance||0,purchases:Object.keys(wallet.purchases||{}).length},
      social:{active:social.active===true,restricted:docs[4].exists||social.restricted===true,projectionVersion:social.summary?.projectionVersion||0,syncedAt:social.summary?.syncedAt||0,refreshQueued:docs[6].exists},
      warningCount:warnings.count||0,deleting:docs[5].exists||social.deleting===true,
      learning:saveProblem?null:{level:levelFromSave(restored),correct,attempts,kana:[...practiced],introduced:Object.keys(restored.sections?.kanaLearning?.data?.state?.introduced||{}).filter(char=>validKana.has(char))},
      receipts:receipts.docs.map(doc=>{const row=doc.data();return {branch:row.branch||'kana',answers:row.index||0,finished:row.done===true,updatedAt:row.updatedAt||0};})};
  }
  async function access(actor,data,token){
    await authorize(actor);fields(data,['uid','operation','reason']);
    if(!staff.validUid(data.uid)||!['revoke','suspend','restore'].includes(data.operation)||typeof data.reason!=='string'||data.reason.trim().length<5||data.reason.length>240)fail('invalid-argument','Choose an account, action and a short reason (5–240 characters).');
    const age=now()/1000-Number(token?.auth_time);
    if(!Number.isFinite(age)||age< -60||age>300)fail('failed-precondition','Confirm your sign-in again before changing account access.');
    const target=await staff.user(data.uid);if(!target)fail('not-found','This account no longer exists.');
    if(target.uid===actor.uid||isAdmin(target))fail('permission-denied','Owner accounts cannot be suspended or revoked from this console.');
    const at=now(),ref=db.doc('accountAccess/'+target.uid),audit=db.doc('securityAudit/'+randomUUID());
    // The barrier commits before Auth changes. An interrupted operation stays
    // blocked and is visible in the audit log; a deliberate retry completes it.
    await db.runTransaction(async tx=>{
      const old=(await tx.get(ref)).data()||{};
      tx.set(ref,{disabled:data.operation==='restore'?false:data.operation==='suspend'?true:old.disabled===true,revokedBefore:Math.max(old.revokedBefore||0,Math.floor(at/1000)),updatedAt:at});
      tx.set(audit,{actor:actor.uid,target:target.uid,operation:data.operation,reason:data.reason.trim(),at,status:'pending',expiresAt:new Date(at+90*86400000)});
    });
    try{
      if(data.operation!=='revoke')await auth.updateUser(target.uid,{disabled:data.operation==='suspend'});
      await auth.revokeRefreshTokens(target.uid);await audit.update({status:'complete'});
    }catch{fail('unavailable','Access is blocked, but the Auth change is pending. Retry the action and check the audit log.');}
    return {complete:true};
  }
  async function security(actor,data){
    await authorize(actor);fields(data,[]);
    const [audit,reviews,studyReviews]=await Promise.all([db.collection('securityAudit').where('at','>=',now()-90*86400000).orderBy('at','desc').limit(30).get(),db.collection('weeklyRewardReviews').orderBy('at','desc').limit(20).get(),db.collection('studyRewardReviews').orderBy('at','desc').limit(20).get()]);
    return {appCheckEnforced:process.env.MODE_ATLAS_ENFORCE_APP_CHECK==='true',usageRequiresAppCheck:true,
      studyReviews:studyReviews.docs.map(doc=>{const {uid,reason,at}=doc.data();return {uid,reason,at};}),
      rewardReviews:reviews.docs.map(doc=>{const {uid,week,rank,reason,at}=doc.data();return {uid,week,rank,reason,at};}),
      audit:audit.docs.map(doc=>{const {actor,target,operation,reason,at,status}=doc.data();return {actor,target,operation,reason,at,status};})};
  }
  async function usage(actor,data){
    await authorize(actor);fields(data,['cursor']);
    const cursor=data.cursor;
    if(cursor!==undefined&&(!cursor||Object.keys(cursor).some(key=>!['at','id'].includes(key))||!Number.isSafeInteger(cursor.at)||!/^[a-f0-9]{64}$/.test(cursor.id)))fail('invalid-argument','Refresh usage reports.');
    const cutoff=now()-30*86400000;
    let query=db.collection('usageReports').where('lastSeen','>=',cutoff).orderBy('lastSeen','desc').orderBy('__name__');
    if(cursor)query=query.startAfter(cursor.at,cursor.id);
    const [page,...counts]=await Promise.all([query.limit(25).get(),...[1,7,30].map(days=>db.collection('usageReports').where('lastSeen','>=',now()-days*86400000).count().get())]);
    return {counts:counts.map(result=>result.data().count),rows:page.docs.map(doc=>{const {platform,version,firstSeen,lastSeen,level,xp,kana,introduced,correct,attempts,branch,funnel}=doc.data();return {id:doc.id.slice(0,8),platform,version,firstSeen,lastSeen,level,xp,kana,introduced,correct,attempts,branch,funnel:funnel||null};}),
      nextCursor:page.size===25?{at:page.docs.at(-1).data().lastSeen,id:page.docs.at(-1).id}:null};
  }
  return {directory,inspect,access,security,usage};
}
module.exports={createAdministration};
