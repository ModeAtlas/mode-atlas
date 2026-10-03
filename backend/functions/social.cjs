'use strict';
const {randomBytes,randomUUID,createHash}=require('node:crypto');
const {HttpsError}=require('firebase-functions/v2/https');
const {projectSave,publicProfile,rankProfiles,PROJECTION_VERSION}=require('./projection.cjs');
const identity=require('./shared/mode-atlas-social-identity.js');
const {createIdentityStore,mayUseName,accountPhoto}=require('./identity.cjs');
const {createModeration}=require('./moderation.cjs');
const {createStaff}=require('./staff.cjs');
const {createRewards}=require('./rewards.cjs');
const {createWeekly,active:weeklyActive}=require('./weekly.cjs');
const {createNotifications}=require('./notifications.cjs');
const rewardRules=require('./shared/mode-atlas-reward-rules.js');
const LIMITS=Object.freeze({friends:100,requests:50,blocks:100,page:20});
const fail=(code,message)=>{throw new HttpsError(code,message);};
const hash=value=>createHash('sha256').update(value).digest('hex');
const validUid=uid=>typeof uid==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(uid) && !['__proto__','prototype','constructor'].includes(uid);
const keys=value=>Object.keys(value||{});
const has=(map,key)=>Object.hasOwn(map||{},key);
function fields(data,allowed){
  if(!data || typeof data!=='object' || Array.isArray(data) || keys(data).some(key=>!allowed.includes(key)))fail('invalid-argument','The request contains unsupported fields.');
}
function codeValue(value){
  const code=String(value||'').replace(/[\s-]/g,'').toUpperCase();
  if(!/^[A-F0-9]{20}$/.test(code))fail('invalid-argument','Enter the full friend code.');
  return code;
}
function validateProfile(data,user){
  fields(data,['displayName','avatar','timeZone']);
  const displayName=identity.cleanName(data.displayName);
  if(!identity.validName(displayName))
    fail('invalid-argument','Use 2–24 letters or numbers for your name.');
  if(identity.objectionableName(displayName))fail('invalid-argument','Choose a display name without abusive or offensive language.');
  if(!mayUseName(displayName,user))fail('invalid-argument','That name is reserved. Choose another display name.');
  const avatar=identity.avatar(data.avatar);
  if(!avatar)fail('invalid-argument','Choose an avatar or a single emoji.');
  const avatarURL=avatar==='account'?accountPhoto(user):null;
  if(avatar==='account'&&!avatarURL)fail('failed-precondition','Your linked Google account has no available photo. Choose an emoji or an Atlas avatar.');
  const timeZone=String(data.timeZone||'');
  if(timeZone.length>64)fail('invalid-argument','Choose a valid time zone.');
  try{new Intl.DateTimeFormat('en',{timeZone}).format();}catch{fail('invalid-argument','Choose a valid time zone.');}
  return {displayName,nameKey:identity.nameKey(displayName),avatar,timeZone,...(avatarURL?{avatarURL}:{})};
}
function emptyAccount(){return {active:false,profile:null,code:null,friends:{},incoming:{},outgoing:{},blockedCount:0};}
function requireActive(account){
  if(account?.restricted)fail('permission-denied','Friends access is restricted. Contact support@mode-atlas.com to appeal.');
  if(account?.deleting)fail('failed-precondition','Your friends profile is being removed. Try again shortly.');
  if(!account?.active)fail('failed-precondition','Create your friends profile first.');
}
function unlink(a,b,uid,target){
  for(const key of ['friends','incoming','outgoing']){delete a[key][target];delete b[key][uid];}
}
function slicePage(items,cursor){
  if(cursor!=null && (typeof cursor!=='string' || cursor.length>128))fail('invalid-argument','Refresh the list and try again.');
  const start=cursor?items.findIndex(item=>item.uid===cursor)+1:0;
  if(cursor && start===0)fail('invalid-argument','The list changed. Refresh it to continue.');
  const rows=items.slice(start,start+LIMITS.page);
  return {rows,nextCursor:start+rows.length<items.length?rows.at(-1).uid:null};
}

function createSocial({db,auth,messaging,now=Date.now}){
  const identities=createIdentityStore({db,auth,now});
  const staff=createStaff({db,auth,now});
  const moderation=createModeration({db,identities,staff,now});
  const rewards=createRewards({db,now});
  const weekly=createWeekly({db,now});
  const notifications=createNotifications({db,messaging,weekly,now});
  async function decorate(profiles){
    profiles=profiles.filter(Boolean);if(!profiles.length)return;
    const users=await staff.badges(profiles);
    await Promise.all(profiles.filter(rewards.hasCustom).map(async profile=>rewards.sanitize(profile,await rewards.read(users.get(profile.uid)))));
  }
  const accounts=db.collection('socialAccounts'),codes=db.collection('socialCodes'),blocks=db.collection('socialBlocks'),limits=db.collection('socialLimits'),deleted=db.collection('socialDeleted');
  const accountRef=uid=>accounts.doc(uid);
  const saveRef=uid=>db.doc(`users/${uid}/appData/kanaTrainer`);
  const blockRef=(a,b)=>blocks.doc(hash([a,b].sort().join(':')));
  const deletionRef=uid=>deleted.doc(hash(uid));
  function rejectDeleted(marker,createdAt){
    if(marker.exists && createdAt<=marker.data().at)fail('unauthenticated','This account has been deleted.');
  }
  async function limit(uid,action,createdAt){
    const bucket=action==='lookup' || action==='sendRequest'?'lookup':['rewards','state','list','profile','weeklyState','weeklyList','notificationState','accountNotices','staffProfile','listWarnings','listModerators','listReports','listRestrictions'].includes(action)?'read':'write';
    const max={lookup:12,read:60,write:30}[bucket],at=now();
    await db.runTransaction(async tx=>{
      const ref=limits.doc(uid),[doc,marker]=await tx.getAll(ref,deletionRef(uid)),data=doc.data()||{};
      rejectDeleted(marker,createdAt);
      const old=data[bucket],row=old && at-old.at<60000?old:{at,count:0};
      if(row.count>=max)fail('resource-exhausted','Please wait a minute before trying again.');
      tx.set(ref,{...data,[bucket]:{at:row.at,count:row.count+1}});
    });
  }
  async function updateProfile(uid,data,createdAt,user){
    const profile=validateProfile(data,user),candidate=randomBytes(10).toString('hex').toUpperCase();
    return db.runTransaction(async tx=>{
      const ref=accountRef(uid),[self,save,marker,restriction]=await tx.getAll(ref,saveRef(uid),deletionRef(uid),db.doc('socialRestrictions/'+uid));
      if(restriction.exists)fail('permission-denied','Friends access is restricted. Contact support@mode-atlas.com to appeal.');
      rejectDeleted(marker,createdAt);
      const account=self.data()||emptyAccount();
      if(account.deleting)requireActive(account);
      const code=account.code||candidate,lookup=codes.doc(hash(code)),existing=await tx.get(lookup);
      if(existing.exists && existing.data().uid!==uid)fail('aborted','Please try creating your code again.');
      const commitName=await identities.claim(tx,uid,profile,account.profile);
      const rewardAccess=await rewards.read(user,tx);
      const summary=projectSave(save.data(),profile.timeZone,save.updateTime?.toMillis()||0,rewardAccess);
      if(rewardRules.item('avatars',profile.avatar)&&!rewardRules.allowed('avatars',profile.avatar,summary.level,rewardAccess))fail('permission-denied','This avatar is not available for your account.');
      commitName();
      tx.set(ref,{...account,active:true,profile,code,summary,rewardAccess,updatedAt:now()});
      tx.set(lookup,{uid});
      return {ok:true};
    });
  }
  async function rotateCode(uid){
    const code=randomBytes(10).toString('hex').toUpperCase();
    return db.runTransaction(async tx=>{
      const ref=accountRef(uid),doc=await tx.get(ref),a=doc.data();requireActive(a);
      const next=codes.doc(hash(code)),existing=await tx.get(next);
      if(existing.exists)fail('aborted','Please try creating your code again.');
      if(a.code)tx.delete(codes.doc(hash(a.code)));
      tx.set(next,{uid});tx.update(ref,{code});return {ok:true};
    });
  }
  async function codeTarget(tx,uid,code){
    const lookup=await tx.get(codes.doc(hash(code)));
    if(!lookup.exists)fail('not-found','No available profile matches that code.');
    const target=lookup.data().uid;
    const [self,other,block]=await tx.getAll(accountRef(uid),accountRef(target),blockRef(uid,target));
    const a=self.data(),b=other.data();requireActive(a);
    if(!b?.active || b.deleting || b.restricted || b.code!==code || block.exists)fail('not-found','No available profile matches that code.');
    if(uid===target)fail('invalid-argument','That is your own friend code.');
    return {target,a,b};
  }
  async function lookup(uid,data){
    fields(data,['code']);const code=codeValue(data.code);
    return db.runTransaction(async tx=>{
      const {target,a,b}=await codeTarget(tx,uid,code);
      return {profile:publicProfile(target,b,now(),false),relationship:has(a.friends,target)?'friend':has(a.incoming,target)?'incoming':has(a.outgoing,target)?'outgoing':'none'};
    });
  }
  async function sendRequest(uid,data){
    fields(data,['code']);const code=codeValue(data.code);
    return db.runTransaction(async tx=>{
      const {target,a,b}=await codeTarget(tx,uid,code);
      if(has(a.friends,target) || has(a.outgoing,target))return {ok:true};
      if(has(a.incoming,target))return {ok:true,incoming:true};
      if(keys(a.outgoing).length>=LIMITS.requests || keys(b.incoming).length>=LIMITS.requests)fail('resource-exhausted','There are too many pending requests. Try again later.');
      if(keys(a.friends).length>=LIMITS.friends || keys(b.friends).length>=LIMITS.friends)fail('resource-exhausted','The friends list is full.');
      a.outgoing={...a.outgoing,[target]:now()};b.incoming={...b.incoming,[uid]:now()};
      tx.set(accountRef(uid),a);tx.set(accountRef(target),b);return {ok:true};
    });
  }
  async function relationship(uid,action,data){
    fields(data,['uid']);const target=data.uid;
    if(!validUid(target) || target===uid)fail('invalid-argument','Choose another profile.');
    return db.runTransaction(async tx=>{
      const ref=blockRef(uid,target),[self,other,block]=await tx.getAll(accountRef(uid),accountRef(target),ref);
      const a=self.data(),b=other.data();requireActive(a);
      if(action==='unblock'){
        if(!block.exists || !block.data().by.includes(uid))return {ok:true};
        const by=block.data().by.filter(id=>id!==uid);
        if(by.length)tx.update(ref,{by});else tx.delete(ref);
        tx.update(accountRef(uid),{blockedCount:Math.max(0,a.blockedCount-1)});return {ok:true};
      }
      if(!b?.active || b.deleting)fail('not-found','This profile is no longer available.');
      if(action==='block'){
        const by=block.data()?.by||[];
        if(!by.includes(uid)){
          if(a.blockedCount>=LIMITS.blocks)fail('resource-exhausted','The blocked list is full.');
          by.push(uid);a.blockedCount++;
        }
        unlink(a,b,uid,target);tx.set(ref,{members:[uid,target].sort(),by});
      }else{
        if(block.exists)fail('not-found','This profile is no longer available.');
        if(action==='accept'){
          if(has(a.friends,target))return {ok:true};
          if(!has(a.incoming,target) || !has(b.outgoing,uid))fail('permission-denied','Only the recipient can accept a request.');
          if(keys(a.friends).length>=LIMITS.friends || keys(b.friends).length>=LIMITS.friends)fail('resource-exhausted','The friends list is full.');
          unlink(a,b,uid,target);a.friends={...a.friends,[target]:now()};b.friends={...b.friends,[uid]:now()};
        }else if(action==='decline'){
          delete a.incoming[target];delete b.outgoing[uid];
        }else if(action==='cancel'){
          delete a.outgoing[target];delete b.incoming[uid];
        }else if(action==='remove'){
          delete a.friends[target];delete b.friends[uid];
        }
      }
      tx.set(accountRef(uid),a);tx.set(accountRef(target),b);return {ok:true};
    });
  }
  async function state(uid,user){
    const doc=await accountRef(uid).get(),a=doc.data(),role=await staff.current(user),canModerate=role!=='member';
    if(await moderation.restriction(uid))return {active:false,restricted:true,canModerate};
    if(a?.deleting)return {active:false,deleting:true};
    if(!a?.active)return {active:false,accountPhoto:accountPhoto(user),canModerate,role};
    return {active:true,canModerate,role,profile:publicProfile(uid,a,now()),preferences:a.profile,accountPhoto:accountPhoto(user),code:a.code,
      counts:{friends:keys(a.friends).length,incoming:keys(a.incoming).length,outgoing:keys(a.outgoing).length,blocked:a.blockedCount}};
  }
  async function list(uid,data){
    fields(data,['kind','metric','cursor']);
    const kind=data.kind||'friends',metric=data.metric||'xp';
    if(!['friends','incoming','outgoing','blocked','rankings'].includes(kind))fail('invalid-argument','Choose a friends list.');
    if(kind==='rankings'&&!['xp','streak','mastery','reading','writing','correct'].includes(metric))fail('invalid-argument','Choose a ranking.');
    const result=await db.runTransaction(async tx=>{
      const self=await tx.get(accountRef(uid)),a=self.data();requireActive(a);
      let ids;
      if(kind==='blocked'){
        const found=await tx.get(blocks.where('by','array-contains',uid).limit(LIMITS.blocks));
        ids=found.docs.map(doc=>doc.data().members.find(id=>id!==uid)).sort();
      }else ids=keys(a[kind==='rankings'?'friends':kind]).sort();
      if(kind==='rankings')ids=[uid,...ids];
      const docs=ids.length?await tx.getAll(...ids.map(accountRef)):[];
      let profiles=docs.flatMap(doc=>{
        const b=doc.data();
        if(kind==='blocked'){
          const view=publicProfile(doc.id,b,now(),false);
          return [view?{uid:doc.id,displayName:view.displayName,avatar:view.avatar,...(view.avatarURL?{avatarURL:view.avatarURL}:{}),frame:'plain'}:{uid:doc.id,displayName:'Unavailable profile',avatar:'kana',frame:'plain'}];
        }
        if((kind==='rankings' || kind==='friends') && doc.id!==uid && !has(b?.friends,uid))return [];
        const view=publicProfile(doc.id,b,now(),kind==='friends'||kind==='rankings');return view?[view]:[];
      });
      if(kind==='rankings')profiles=rankProfiles(profiles,metric);
      else profiles.sort((a,b)=>a.displayName.localeCompare(b.displayName,'en')||a.uid.localeCompare(b.uid,'en'));
      const visible=new Set(profiles.map(row=>row.uid));
      const stale=kind==='friends'||kind==='rankings'?docs.filter(doc=>visible.has(doc.id)&&doc.data().summary?.projectionVersion!==PROJECTION_VERSION).map(doc=>doc.id):[];
      return {response:{...slicePage(profiles,data.cursor),total:profiles.length,metric},stale};
    });
    if(result.stale.length){
      // Only a policy migration loads private saves. Normal list requests retain
      // their original read cost; migrations use bounded, separate transactions.
      for(let i=0;i<result.stale.length;i+=10)await Promise.all(result.stale.slice(i,i+10).map(id=>refreshSummary(id,null,true)));
      return list(uid,data);
    }
    return result.response;
  }
  async function profile(uid,data){
    fields(data,['uid']);if(!validUid(data.uid))fail('invalid-argument','Choose a profile.');
    const result=await db.runTransaction(async tx=>{
      const [self,other,blocked]=await tx.getAll(accountRef(uid),accountRef(data.uid),blockRef(uid,data.uid));const a=self.data(),b=other.data();requireActive(a);
      const friend=uid===data.uid||(has(a.friends,data.uid)&&has(b?.friends,uid));
      if(blocked.exists||(!friend&&!(weeklyActive(a)&&weeklyActive(b))))fail('permission-denied','This profile is available to accepted friends or weekly competitors.');
      const value=publicProfile(data.uid,b,now(),friend);if(!value)fail('not-found','This profile is no longer available.');
      return {profile:value,friend,stale:friend&&b.summary?.projectionVersion!==PROJECTION_VERSION};
    });
    if(result.stale){await refreshSummary(data.uid,null,true);return profile(uid,data);}
    delete result.stale;return result;
  }
  async function refreshSummary(uid,user,cachedAccess=false){
    if(!validUid(uid))return;
    if(!user&&!cachedAccess)user=await staff.user(uid);
    await db.runTransaction(async tx=>{
      const ref=accountRef(uid),[doc,save]=await tx.getAll(ref,saveRef(uid)),a=doc.data();
      if(!a?.active || a.deleting)return;
      // Read the latest save inside the transaction: trigger delivery can repeat or reorder.
      const syncedAt=save.updateTime?.toMillis()||0;
      const rewardAccess=cachedAccess?a.rewardAccess||{}:await rewards.read(user,tx);
      if(a.summary?.version===5&&a.summary?.projectionVersion===PROJECTION_VERSION&&a.summary?.syncedAt===syncedAt&&a.rewardAccess&&rewards.key(a.rewardAccess)===rewards.key(rewardAccess))return;
      tx.update(ref,{rewardAccess,summary:projectSave(save.data(),a.profile.timeZone,syncedAt,rewardAccess)});
    });
  }
  async function beginErase(uid){
    if(!validUid(uid))return null;
    return db.runTransaction(async tx=>{
      const ref=accountRef(uid),doc=await tx.get(ref),a=doc.data();
      if(!a)return null;
      if(a.deleting)return a.deletionId;
      const deletionId=randomUUID();
      const releaseName=await identities.release(tx,uid,a.profile);
      releaseName();
      if(a.code)tx.delete(codes.doc(hash(a.code)));
      tx.update(ref,{active:false,profile:null,summary:null,code:null,deleting:true,deletionId});
      return deletionId;
    });
  }
  async function cleanup(uid,deletionId){
    if(!deletionId)return;
    const matches=a=>a?.deleting && a.deletionId===deletionId;
    const started=await db.runTransaction(async tx=>{
      const self=await tx.get(accountRef(uid)),a=self.data();if(!matches(a))return false;
      const ids=[...new Set([...keys(a.friends),...keys(a.incoming),...keys(a.outgoing)])];
      const others=ids.length?await tx.getAll(...ids.map(accountRef)):[];
      for(const other of others){if(!other.exists)continue;const b=other.data();unlink(a,b,uid,other.id);tx.set(other.ref,b);}
      tx.update(self.ref,{friends:{},incoming:{},outgoing:{}});return true;
    });
    if(!started)return;
    while(true){
      const found=await blocks.where('members','array-contains',uid).limit(100).get();
      if(found.empty)break;
      const continued=await db.runTransaction(async tx=>{
        const self=await tx.get(accountRef(uid));if(!matches(self.data()))return false;
        const records=await tx.getAll(...found.docs.map(doc=>doc.ref));
        const by=[...new Set(records.flatMap(doc=>doc.data()?.by||[]).filter(id=>id!==uid))];
        const others=by.length?await tx.getAll(...by.map(accountRef)):[];
        for(const other of others){if(other.exists)tx.update(other.ref,{blockedCount:Math.max(0,(other.data().blockedCount||0)-records.filter(doc=>doc.data()?.by.includes(other.id)).length)});}
        for(const record of records)tx.delete(record.ref);return true;
      });
      if(!continued)return;
    }
    await db.runTransaction(async tx=>{
      const doc=await tx.get(accountRef(uid));if(!matches(doc.data()))return;
      tx.delete(doc.ref);
    });
  }
  async function erase(uid,deletedAccount=false){
    // A non-profile deletion receipt prevents an already-authorized request from
    // recreating social data after Auth deletion. It stores no raw UID or scores.
    if(deletedAccount && validUid(uid))await deletionRef(uid).set({at:now(),expiresAt:new Date(now()+7*86400000)});
    const id=await beginErase(uid);await weekly.syncAccount(uid);await cleanup(uid,id);
    // Opting out must not reset rate limits. Auth deletion removes them too.
    if(deletedAccount && validUid(uid)){
      await Promise.all([weekly.erase(uid),notifications.erase(uid),rewards.erase(uid),staff.erase(uid),db.doc('socialWarnings/'+uid).delete(),limits.doc(uid).delete(),db.doc('socialRestrictions/'+uid).delete(),db.doc('socialReportLimits/'+uid).delete()]);
      for(const field of ['target','reporter'])while(true){
        const found=await db.collection('socialReports').where(field,'==',uid).limit(100).get();if(found.empty)break;
        const batch=db.batch();found.docs.forEach(doc=>batch.delete(doc.ref));await batch.commit();
      }
    }
    return {ok:true};
  }
  async function call(request){
    const uid=request.auth?.uid;
    if(!validUid(uid))fail('unauthenticated','Sign in to use Friends.');
    // Reject tokens belonging to accounts already deleted or disabled.
    let user;try{user=await auth.getUser(uid);}catch{fail('unauthenticated','Sign in again to use Friends.');}
    if(user.disabled || !user.emailVerified)fail('permission-denied','Use a verified account to join Friends.');
    fields(request.data,['action','data','expectedUid']);
    if(request.data.expectedUid!==uid)fail('unauthenticated','The signed-in account changed. Try again.');
    const {action,data={}}=request.data;
    const actions=['rewards','state','list','profile','weeklyState','weeklyList','weeklyPreference','weeklyStart','weeklySubmit','notificationState','configureNotifications','unregisterNotifications','updateProfile','rotateCode','lookup','sendRequest','accept','decline','cancel','remove','block','unblock','leave','reportProfile','listReports','reviewReport','listRestrictions','restoreProfile','staffProfile','assignModerator','listModerators','listWarnings','warnProfile','clearWarnings','accountNotices','acknowledgeWarnings'];
    if(!actions.includes(action))fail('invalid-argument','Unknown friends action.');
    if(['rewards','state','weeklyState','notificationState','rotateCode','leave'].includes(action))fields(data,[]);
    const createdAt=Date.parse(user.metadata?.creationTime)||0;
    await limit(uid,action,createdAt);
    if(action==='rewards')return rewards.read(user);
    if(action==='notificationState')return notifications.state(uid);
    if(action==='configureNotifications')return notifications.configure(uid,data);
    if(action==='unregisterNotifications')return notifications.unregister(uid,data);
    if(!['state','leave','listReports','reviewReport','listRestrictions','restoreProfile','staffProfile','assignModerator','listModerators','listWarnings','warnProfile','clearWarnings','accountNotices','acknowledgeWarnings'].includes(action)&&await moderation.restriction(uid))fail('permission-denied','Friends access is restricted. Contact support@mode-atlas.com to appeal.');
    if(action==='accountNotices')return moderation.notices(user,data);
    if(action==='acknowledgeWarnings')return moderation.notices(user,data,true);
    if(action==='staffProfile')return moderation.details(user,data);
    if(action==='listModerators')return staff.list(user,data);
    if(action==='listWarnings')return moderation.warningAccounts(user,data);
    if(action==='assignModerator')return staff.assign(user,data);
    if(action==='warnProfile')return moderation.warn(user,data);
    if(action==='clearWarnings')return moderation.clearWarnings(user,data);
    if(action!=='leave')await identities.ensureReady();
    if(action==='listRestrictions')return moderation.restricted(user,data);
    if(action==='restoreProfile')return moderation.restore(user,data);
    if(action==='reportProfile')return moderation.report(uid,data);
    if(action==='listReports')return moderation.list(user,data);
    if(action==='reviewReport')return moderation.review(user,data);
    if(action==='weeklyState')return weekly.state(uid);
    if(action==='weeklyPreference')return weekly.preference(uid,data);
    if(action==='weeklyStart')return weekly.start(uid,data);
    if(action==='weeklySubmit')return weekly.submit(uid,data);
    if(action==='weeklyList'){const result=await weekly.list(uid,data);await decorate(result.rows);return result;}
    if(action==='state'){await refreshSummary(uid,user);const result=await state(uid,user);if(result.profile){result.profile.role=result.role;rewards.sanitize(result.profile,await rewards.read(user));}return result;}
    if(action==='updateProfile')return updateProfile(uid,data,createdAt,user);
    if(action==='rotateCode')return rotateCode(uid);
    if(action==='lookup'){const result=await lookup(uid,data);await decorate(result.rows||[result.profile]);return result;}
    if(action==='sendRequest')return sendRequest(uid,data);
    if(action==='list'){const result=await list(uid,data);await decorate(result.rows||[result.profile]);return result;}
    if(action==='profile'){const result=await profile(uid,data);await decorate(result.rows||[result.profile]);return result;}
    if(action==='leave')return erase(uid);
    return relationship(uid,action,data);
  }
  return {call,refreshSummary,beginErase,cleanup,erase,
    refreshCompetition:weekly.syncAccount,
    maintainEngagement:async()=>{await weekly.maintain();await notifications.maintain();}};
}
module.exports={createSocial,LIMITS,validateProfile};
