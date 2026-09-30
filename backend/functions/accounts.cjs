'use strict';
const {HttpsError}=require('firebase-functions/v2/https');
const {randomUUID}=require('node:crypto');
// Auth deletion commits the operation. The existing retrying Auth trigger owns
// recovery after that point; private data and Friends are never removed first.
function createAccounts({db,auth,social,now=Date.now}){
  const receipts=db.collection('accountDeletions');
  async function userOrNull(uid){
    try{return await auth.getUser(uid);}catch(error){if(error.code==='auth/user-not-found')return null;throw error;}
  }
  async function cleanup(uid){
    if(await userOrNull(uid))return {deleted:false};
    const ref=receipts.doc(uid);
    await ref.set({state:'cleaning',updatedAt:now()},{merge:true});
    await db.recursiveDelete(db.doc('users/'+uid));
    await social.erase(uid,true);
    // Keep a short-lived access barrier beyond the lifetime of an issued token.
    await ref.set({state:'complete',updatedAt:now(),expiresAt:new Date(now()+7*86400000)},{merge:true});
    return {deleted:true,cleanupPending:false};
  }
  async function outcome(uid){
    const [user,receipt]=await Promise.all([userOrNull(uid),receipts.doc(uid).get()]);
    if(user)return {deleted:false,pending:receipt.exists};
    if(!receipt.exists)return {deleted:true,cleanupPending:true};
    return {deleted:true,cleanupPending:receipt.data().state!=='complete'};
  }
  async function limit(uid){
    const ref=db.doc('accountOperationLimits/'+uid),at=now();
    await db.runTransaction(async tx=>{
      const doc=await tx.get(ref),old=doc.data(),row=old&&at-old.at<60000?old:{at,count:0};
      if(row.count>=15)throw new HttpsError('resource-exhausted','Please wait a minute before checking account deletion again.');
      tx.set(ref,{at:row.at,count:row.count+1,expiresAt:new Date(at+86400000)});
    });
  }
  async function call(request){
    const uid=request.auth?.uid,data=request.data;
    if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||data?.expectedUid!==uid)
      throw new HttpsError('unauthenticated','The signed-in account changed. Try again.');
    if(!data||Object.keys(data).some(key=>!['action','data','expectedUid'].includes(key))||Object.keys(data.data||{}).length)
      throw new HttpsError('invalid-argument','Unsupported account request.');
    await limit(uid);
    if(data.action==='accountDeletionStatus')return outcome(uid);
    if(data.action!=='deleteAccount')throw new HttpsError('invalid-argument','Unknown account action.');
    const user=await userOrNull(uid);
    if(!user)return outcome(uid);
    const age=now()/1000-Number(request.auth.token?.auth_time);
    if(!Number.isFinite(age)||age< -60||age>300)throw new HttpsError('failed-precondition','Confirm your sign-in again before deleting your account.');
    if(user.disabled)throw new HttpsError('permission-denied','Contact support to delete this account.');
    const ref=receipts.doc(uid),id=randomUUID();
    await ref.set({state:'committing',id,updatedAt:now()});
    try{await auth.deleteUser(uid);}catch(error){
      if(error.code!=='auth/user-not-found'){
        // Check the actual account after an ambiguous Auth response. Never
        // report failure and restore access after Auth has already committed.
        if(await userOrNull(uid)){
          await db.runTransaction(async tx=>{const doc=await tx.get(ref);if(doc.data()?.id===id&&doc.data()?.state==='committing')tx.delete(ref);});
          throw new HttpsError('unavailable','Account deletion could not finish. Your learning data has been kept. Try again.');
        }
      }
    }
    try{return await cleanup(uid);}catch(error){
      console.error('Account cleanup will be retried by the Auth deletion trigger.',{uid,code:error.code||'cleanup-failed'});
      return {deleted:true,cleanupPending:true};
    }
  }
  return {call,cleanup};
}
module.exports={createAccounts};
