'use strict';
// One server-owned role registry. Firebase Auth, never token email/client data,
// identifies Admin. Role reads participate in transactions that change accounts.
const {HttpsError}=require('firebase-functions/v2/https');
const {isAdmin}=require('./identity.cjs');
const fail=(code,message)=>{throw new HttpsError(code,message);};
const validUid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)&&!['__proto__','prototype','constructor'].includes(value);
function createStaff({db,auth,now=Date.now}){
  const registry=db.doc('socialStaff/roles');
  const enabled=user=>user?.emailVerified===true&&user.disabled!==true;
  function assignedRole(user,data){return !user?'member':isAdmin({...user,disabled:false})?'admin':Object.hasOwn(data?.moderators||{},user.uid)?'moderator':'member';}
  function role(user,data){return enabled(user)?assignedRole(user,data):'member';}
  async function user(uid){
    if(!validUid(uid))fail('invalid-argument','Choose an account.');
    try{return await auth.getUser(uid);}catch(error){if(error.code==='auth/user-not-found')return null;throw error;}
  }
  async function readMany(tx,actor,targets){
    const [record,restriction]=await tx.getAll(registry,db.doc('socialRestrictions/'+actor.uid));
    const data=record.data(),actorAssignedRole=role(actor,data),actorRole=actorAssignedRole==='moderator'&&restriction.exists?'member':actorAssignedRole;
    return targets.map(target=>{const targetRole=assignedRole(target,data);return {role:actorRole,targetRole,moderatorAssigned:!!target&&Object.hasOwn(data?.moderators||{},target.uid),canManage:actorRole==='admin',
      canAct:actorRole==='admin'||(actorRole==='moderator'&&targetRole==='member'&&actor.uid!==target?.uid)};});
  }
  async function read(tx,actor,target){return (await readMany(tx,actor,[target]))[0];}
  function requireStaff(access){if(access.role==='member')fail('permission-denied','This action is available to the moderation team.');}
  function requireAction(access){requireStaff(access);if(!access.canAct)fail('permission-denied','Only Admin can action accounts belonging to the moderation team.');}
  async function current(actor){return db.runTransaction(async tx=>(await read(tx,actor)).role);}
  async function assign(actor,data){
    if(!isAdmin(actor))fail('permission-denied','Only Admin can assign moderators.');
    if(!data||Object.keys(data).some(key=>!['uid','moderator'].includes(key))||!validUid(data.uid)||typeof data.moderator!=='boolean')fail('invalid-argument','Choose a moderator role.');
    const target=await user(data.uid);
    if(data.moderator&&(!enabled(target)||isAdmin(target)))fail('permission-denied','Choose a verified member account.');
    await db.runTransaction(async tx=>{
      const [record,account,deleting]=await tx.getAll(registry,db.doc('socialAccounts/'+data.uid),db.doc('accountDeletions/'+data.uid));
      const a=account.data();if(data.moderator&&(deleting.exists||a?.deleting||!a?.active||a.restricted))fail('failed-precondition','This profile must have active Friends access.');
      const moderators={...(record.data()?.moderators||{})};
      if(data.moderator){if(!Object.hasOwn(moderators,target.uid)&&Object.keys(moderators).length>=50)fail('resource-exhausted','The moderator team is full.');moderators[target.uid]={at:now(),by:actor.uid,label:a.profile.displayName};}
      else delete moderators[data.uid];
      tx.set(registry,{moderators});
    });return {ok:true};
  }
  async function list(actor,data){
    if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length)fail('invalid-argument','Refresh the moderator list.');
    return db.runTransaction(async tx=>{
      const access=await read(tx,actor);requireStaff(access);
      const roles=(await tx.get(registry)).data()?.moderators||{},ids=Object.keys(roles);
      const profiles=ids.length?await tx.getAll(...ids.map(uid=>db.doc('socialAccounts/'+uid))):[];
      return {canManage:access.canManage,rows:profiles.map(doc=>({uid:doc.id,displayName:doc.data()?.profile?.displayName||roles[doc.id].label||'Former Friends member'}))};
    });
  }
  async function badges(profiles){
    const ids=[...new Set(profiles.filter(Boolean).map(profile=>profile.uid))];if(!ids.length)return;
    const [record,users]=await Promise.all([registry.get(),auth.getUsers(ids.map(uid=>({uid})))]);
    const roles=new Map(users.users.map(user=>[user.uid,role(user,record.data())]));
    profiles.filter(Boolean).forEach(profile=>{profile.role=roles.get(profile.uid)||'member';});
  }
  async function erase(uid){await db.runTransaction(async tx=>{const doc=await tx.get(registry),moderators={...(doc.data()?.moderators||{})};if(Object.hasOwn(moderators,uid)){delete moderators[uid];tx.set(registry,{moderators});}});}
  return {read,readMany,current,assign,list,badges,erase,user,requireStaff,requireAction,validUid};
}
module.exports={createStaff};
