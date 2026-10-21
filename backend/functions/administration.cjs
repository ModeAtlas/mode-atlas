'use strict';
// Read-only administrator diagnostics. Raw Auth records and save bodies never
// leave this boundary; the response is deliberately an explicit projection.
const {HttpsError}=require('firebase-functions/v2/https');
const {isAdmin}=require('./identity.cjs');
const fail=(code,message)=>{throw new HttpsError(code,message);};
const stamp=value=>Number.isFinite(Date.parse(value))?Date.parse(value):0;
function createAdministration({db,auth,staff}){
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
    await authorize(actor);
    return {uid:data.uid,providers:(target.providerData||[]).map(row=>row.providerId),verified:target.emailVerified===true,disabled:target.disabled===true,
      save:{exists:docs[0].exists,version:save.storageVersion||save.schemaVersion||1,revision:save.revision||0,generation:save.generation||0,updatedAt:docs[0].updateTime?.toMillis()||0,
        sections:Object.entries(save.sections||{}).map(([name,section])=>({name,partitioned:!!section.storage,parts:Array.isArray(section.storage?.parts)?section.storage.parts.length:0}))},
      wallet:{exists:docs[1].exists,balance:wallet.balance||0,tokenBalance:wallet.tokenBalance||0,purchases:Object.keys(wallet.purchases||{}).length},
      social:{active:social.active===true,restricted:docs[4].exists||social.restricted===true,projectionVersion:social.summary?.projectionVersion||0,syncedAt:social.summary?.syncedAt||0,refreshQueued:docs[6].exists},
      warningCount:warnings.count||0,deleting:docs[5].exists||social.deleting===true,
      receipts:receipts.docs.map(doc=>{const row=doc.data();return {branch:row.branch||'kana',answers:row.index||0,finished:row.done===true,updatedAt:row.updatedAt||0};})};
  }
  return {directory,inspect};
}
module.exports={createAdministration};
