'use strict';
const {createHash,randomUUID}=require('node:crypto');
const {FieldPath}=require('firebase-admin/firestore');
const {HttpsError}=require('firebase-functions/v2/https');
const policy=require('./shared/mode-atlas-social-identity.js');
const hash=value=>createHash('sha256').update(value).digest('hex');
const isAdmin=user=>user?.emailVerified===true&&user.disabled!==true&&user.email?.toLowerCase()==='admin@mode-atlas.com';
const mayUseName=(name,user)=>policy.validName(name)&&(!policy.reservedName(name)||(policy.cleanName(name).toLowerCase()==='admin'&&isAdmin(user)));
function accountPhoto(user){return policy.photoURL(user?.providerData?.find(provider=>provider.providerId==='google.com')?.photoURL);}

function createIdentityStore({db,auth,now=Date.now}){
  const names=db.collection('socialNames'),accounts=db.collection('socialAccounts'),migration=db.doc('socialMigrations/identity-v1');
  const nameRef=key=>names.doc(hash(key));
  let ready=false,pending=null;
  async function migrateAccount(ref){
    const before=await ref.get();if(!before.data()?.active||before.data()?.deleting)return;
    let user=null;
    if(policy.reservedName(before.data().profile?.displayName)){
      try{user=await auth.getUser(ref.id);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
    }
    await db.runTransaction(async tx=>{
      const snapshot=await tx.get(ref),account=snapshot.data();if(!account?.active||account.deleting)return;
      const old=account.profile,displayName=policy.cleanName(old.displayName),key=policy.nameKey(displayName);
      const claim=await tx.get(nameRef(key));
      let chosen=displayName,chosenKey=key,requiresNameChange=old.requiresNameChange===true;
      if(!mayUseName(displayName,user)||(claim.exists&&claim.data().uid!==ref.id)){
        requiresNameChange=true;
        // A claimed fallback keeps every visible identity unique until its owner chooses a new name.
        for(let attempt=0;attempt<20;attempt++){
          chosen='Learner '+hash(ref.id+':'+attempt).slice(0,12);chosenKey=policy.nameKey(chosen);
          const fallback=await tx.get(nameRef(chosenKey));
          if(!fallback.exists||fallback.data().uid===ref.id)break;
          if(attempt===19)throw new HttpsError('unavailable','Friends is updating. Please try again shortly.');
        }
      }
      tx.set(nameRef(chosenKey),{uid:ref.id});
      if(key!==chosenKey&&claim.data()?.uid===ref.id)tx.delete(nameRef(key));
      tx.update(ref,{profile:{...old,displayName:chosen,nameKey:chosenKey,requiresNameChange}});
    });
  }
  async function migrate(){
    const token=randomUUID();
    const start=await db.runTransaction(async tx=>{
      const doc=await tx.get(migration),state=doc.data()||{};
      if(state.complete)return {complete:true};
      if(state.leaseUntil>now())throw new HttpsError('unavailable','Friends is updating. Please try again shortly.');
      tx.set(migration,{...state,token,leaseUntil:now()+120000});return state;
    });
    if(start.complete){ready=true;return;}
    try{
      let cursor=start.cursor||null;
      // Bounded, resumable backfill. Profile writes wait until every legacy name is claimed.
      for(let page=0;page<4;page++){
        let query=accounts.orderBy(FieldPath.documentId()).limit(25);if(cursor)query=query.startAfter(cursor);
        const rows=await query.get();
        for(const doc of rows.docs)await migrateAccount(doc.ref);
        if(rows.docs.length)cursor=rows.docs.at(-1).id;
        const complete=rows.size<25;
        await db.runTransaction(async tx=>{
          const state=(await tx.get(migration)).data();
          if(state?.token!==token)throw new HttpsError('unavailable','Friends is updating. Please try again shortly.');
          tx.set(migration,{cursor,complete,token,leaseUntil:complete?0:now()+120000});
        });
        if(complete){ready=true;return;}
      }
      throw new HttpsError('unavailable','Friends is updating. Please try again shortly.');
    }finally{
      await db.runTransaction(async tx=>{
        const state=(await tx.get(migration)).data();if(state?.token===token&&!state.complete)tx.update(migration,{leaseUntil:0});
      });
    }
  }
  async function ensureReady(){
    if(ready)return;
    if(!pending)pending=migrate().finally(()=>{pending=null;});
    return pending;
  }
  async function claim(tx,uid,profile,previous){
    const next=nameRef(profile.nameKey),old=previous?.nameKey?nameRef(previous.nameKey):null;
    const snapshots=await tx.getAll(next,...(old&&old.path!==next.path?[old]:[]));
    if(snapshots[0].exists&&snapshots[0].data().uid!==uid)throw new HttpsError('already-exists','That display name is taken. Choose another name.');
    return ()=>{
      tx.set(next,{uid});
      if(snapshots[1]?.data()?.uid===uid)tx.delete(old);
    };
  }
  async function release(tx,uid,profile){
    if(!profile?.nameKey)return ()=>{};
    const ref=nameRef(profile.nameKey),doc=await tx.get(ref);
    return ()=>{if(doc.data()?.uid===uid)tx.delete(ref);};
  }
  return {ensureReady,claim,release};
}
module.exports={createIdentityStore,isAdmin,mayUseName,accountPhoto};
