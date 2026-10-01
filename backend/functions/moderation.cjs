'use strict';
const {createHash}=require('node:crypto');
const {FieldPath}=require('firebase-admin/firestore');
const {HttpsError}=require('firebase-functions/v2/https');
const policy=require('./shared/mode-atlas-social-identity.js');
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(code,message)=>{throw new HttpsError(code,message);};
const reasons=new Set(['name','avatar','harassment','other']);
function fields(data,allowed){if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!allowed.includes(key)))fail('invalid-argument','Unsupported report request.');}
function createModeration({db,identities,staff,now=Date.now}){
  const reports=db.collection('socialReports'),restrictions=db.collection('socialRestrictions');
  const account=uid=>db.doc('socialAccounts/'+uid);
  const warnings=db.collection('socialWarnings');
  async function requireStaff(user){if(await staff.current(user)==='member')fail('permission-denied','This action is available to the moderation team.');}
  async function report(uid,data){
    fields(data,['uid','reason','note','code']);
    const target=data.uid,note=typeof data.note==='string'?data.note.trim():'';
    if(typeof target!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(target)||target===uid||!reasons.has(data.reason)||note.length>500)
      fail('invalid-argument','Choose a profile and report reason. Keep details under 500 characters.');
    return db.runTransaction(async tx=>{
      const block=db.doc('socialBlocks/'+hash([uid,target].sort().join(':'))),limit=db.doc('socialReportLimits/'+uid);
      const [self,other,blocked,limitDoc]=await tx.getAll(account(uid),account(target),block,limit);
      const a=self.data(),b=other.data();
      if(!a?.active||a.deleting||a.restricted||!b?.active||b.deleting)fail('not-found','This profile is no longer available.');
      const connected=['friends','incoming','outgoing'].some(key=>Object.hasOwn(a[key]||{},target));
      const code=typeof data.code==='string'?data.code.replace(/[\s-]/g,'').toUpperCase():'';
      if(!connected&&!blocked.data()?.by?.includes(uid)&&!(code&&code===b.code))fail('permission-denied','Report a profile you have encountered in Friends.');
      const snapshot={displayName:b.profile.displayName,avatar:b.profile.avatar,avatarURL:b.profile.avatarURL||null};
      const ref=reports.doc(hash(uid+':'+target+':'+JSON.stringify(snapshot))),existing=await tx.get(ref);
      if(existing.exists)return {ok:true};
      const at=now(),old=limitDoc.data(),window=old&&at-old.at<3600000?old:{at,count:0};
      if(window.count>=5)fail('resource-exhausted','You have sent several reports. Please wait before sending another.');
      tx.set(limit,{at:window.at,count:window.count+1,expiresAt:new Date(at+86400000)});
      tx.set(ref,{reporter:uid,target,reason:data.reason,note,snapshot,state:'open',createdAt:at,expiresAt:new Date(at+90*86400000)});
      return {ok:true};
    });
  }
  async function list(user,data){
    await requireStaff(user);fields(data,['cursor']);
    if(data.cursor!=null&&!/^[a-f0-9]{64}$/.test(data.cursor))fail('invalid-argument','Refresh the reports list.');
    let query=reports.where('state','==','open').orderBy(FieldPath.documentId()).limit(20);
    if(data.cursor)query=query.startAfter(data.cursor);
    const found=await query.get(),rows=[];
    for(const doc of found.docs){
      const report=doc.data(),current=(await account(report.target).get()).data();
      const target=await staff.user(report.target),access=await db.runTransaction(tx=>staff.read(tx,user,target));
      staff.requireStaff(access);
      rows.push({id:doc.id,target:report.target,canAct:access.canAct,role:access.targetRole,reason:report.reason,note:report.note,snapshot:report.snapshot,createdAt:report.createdAt,
        current:current?.profile?{displayName:current.profile.displayName,avatar:current.profile.avatar,avatarURL:current.profile.avatarURL||null,restricted:current.restricted===true}:null});
    }
    return {rows,nextCursor:found.size===20?found.docs.at(-1).id:null};
  }
  async function review(user,data){
    await requireStaff(user);fields(data,['id','decision']);
    if(!/^[a-f0-9]{64}$/.test(data.id||'')||!['dismiss','reset','restrict'].includes(data.decision))fail('invalid-argument','Choose a moderation action.');
    await identities.ensureReady();
    const preliminary=(await reports.doc(data.id).get()).data();
    if(!preliminary)fail('not-found','This report has expired or was removed.');
    const targetUser=await staff.user(preliminary.target);
    return db.runTransaction(async tx=>{
      const access=await staff.read(tx,user,targetUser);staff.requireAction(access);
      const ref=reports.doc(data.id),doc=await tx.get(ref),report=doc.data();
      if(!report)fail('not-found','This report has expired or was removed.');
      if(report.target!==preliminary.target)fail('aborted','The report changed. Refresh the list.');
      if(report.target===user.uid&&data.decision!=='dismiss')fail('permission-denied','You can dismiss reports about yourself. Edit your name and avatar from your profile.');
      if(report.state==='closed')return {ok:true};
      const target=account(report.target),snapshot=await tx.get(target),a=snapshot.data();
      if(data.decision==='reset'&&a?.active&&!a.deleting){
        const name='Learner '+hash(report.target+data.id).slice(0,12);
        const profile={displayName:name,nameKey:policy.nameKey(name),avatar:'kana',timeZone:a.profile.timeZone,requiresNameChange:true};
        const claim=await identities.claim(tx,report.target,profile,a.profile);claim();tx.update(target,{profile});
      }
      if(data.decision==='restrict'){
        tx.set(restrictions.doc(report.target),{restricted:true,at:now(),report:data.id});
        if(a&&!a.deleting)tx.update(target,{restricted:true});
      }
      tx.update(ref,{state:'closed',decision:data.decision,reviewedAt:now(),reviewedBy:user.uid});return {ok:true};
    });
  }
  async function restricted(user,data){
    await requireStaff(user);fields(data,['cursor']);
    if(data.cursor!=null&&!/^[A-Za-z0-9_-]{1,128}$/.test(data.cursor))fail('invalid-argument','Refresh the list.');
    let query=restrictions.orderBy(FieldPath.documentId()).limit(20);if(data.cursor)query=query.startAfter(data.cursor);
    const found=await query.get(),rows=[];
    for(const doc of found.docs){const a=(await account(doc.id).get()).data(),target=await staff.user(doc.id);
      const access=await db.runTransaction(tx=>staff.read(tx,user,target));staff.requireStaff(access);
      rows.push({uid:doc.id,displayName:a?.profile?.displayName||'Unavailable profile',canAct:access.canAct,role:access.targetRole});}
    return {rows,nextCursor:found.size===20?found.docs.at(-1).id:null};
  }
  async function restore(user,data){
    await requireStaff(user);fields(data,['uid']);
    if(typeof data.uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(data.uid))fail('invalid-argument','Choose a profile.');
    const target=await staff.user(data.uid);
    await db.runTransaction(async tx=>{
      staff.requireAction(await staff.read(tx,user,target));
      const ref=account(data.uid),doc=await tx.get(ref);
      tx.delete(restrictions.doc(data.uid));if(doc.exists)tx.update(ref,{restricted:false});
    });return {ok:true};
  }
  async function details(user,data){
    await requireStaff(user);fields(data,['uid']);const target=await staff.user(data.uid);
    return db.runTransaction(async tx=>{
      const access=await staff.read(tx,user,target);staff.requireStaff(access);
      const [record,profile]=await tx.getAll(warnings.doc(data.uid),account(data.uid));
      if(!target)fail('not-found','This account no longer exists.');
      const value=record.data();
      return {uid:data.uid,displayName:profile.data()?.profile?.displayName||'Member',role:access.targetRole,
        canAct:access.canAct,canManage:access.canManage,moderatorAssigned:access.moderatorAssigned,canAssign:target.emailVerified&&!target.disabled&&profile.data()?.active===true&&!profile.data()?.restricted,count:value?.count||0,
        history:(value?.history||[]).map(({id,message,at})=>({id,message,at}))};
    });
  }
  async function warningAccounts(user,data){
    await requireStaff(user);fields(data,['cursor']);
    if(data.cursor!=null&&!staff.validUid(data.cursor))fail('invalid-argument','Refresh the warnings list.');
    let query=warnings.orderBy(FieldPath.documentId()).limit(20);if(data.cursor)query=query.startAfter(data.cursor);
    const found=await query.get(),targets=await Promise.all(found.docs.map(doc=>staff.user(doc.id)));
    return db.runTransaction(async tx=>{
      // Recheck the actor and every protected target against one role snapshot.
      const access=await staff.readMany(tx,user,[null,...targets]);staff.requireStaff(access[0]);
      const records=found.size?await tx.getAll(...found.docs.map(doc=>doc.ref),...found.docs.map(doc=>account(doc.id))):[];
      const rows=found.docs.flatMap((doc,index)=>{
        const warning=records[index].data(),profile=records[index+found.size].data();
        if(!targets[index]||!warning?.count||profile?.deleting)return [];
        return [{uid:doc.id,displayName:profile?.profile?.displayName||'Former Friends member',role:access[index+1].targetRole,
          canAct:access[index+1].canAct,count:warning.count,lastWarnedAt:warning.history?.[0]?.at||0}];
      });
      return {rows,nextCursor:found.size===20?found.docs.at(-1).id:null};
    });
  }
  async function warn(user,data){
    await requireStaff(user);fields(data,['uid','message','requestId']);const target=await staff.user(data.uid);
    const message=typeof data.message==='string'?data.message.trim():'';
    if(!target||target.disabled)fail('not-found','This account is unavailable.');
    if(message.length<3||message.length>500||!/^[-a-zA-Z0-9]{16,64}$/.test(data.requestId||''))fail('invalid-argument','Enter a warning of 3–500 characters.');
    return db.runTransaction(async tx=>{
      const access=await staff.read(tx,user,target);staff.requireAction(access);
      const ref=warnings.doc(target.uid),[doc,deleting]=await tx.getAll(ref,db.doc('accountDeletions/'+target.uid));
      if(deleting.exists)fail('not-found','This account is being deleted.');
      const old=doc.data()||{count:0,history:[],pending:[]};
      if(old.history.some(row=>row.id===data.requestId))return {ok:true};
      if(old.pending.length>=20)fail('resource-exhausted','This account has 20 unread warnings. Wait for them to be read.');
      const row={id:data.requestId,message,at:now(),by:user.uid};
      tx.set(ref,{count:old.count+1,history:[row,...old.history].slice(0,50),pending:[...old.pending,row]});
      return {ok:true};
    });
  }
  async function clearWarnings(user,data){
    if(await staff.current(user)!=='admin')fail('permission-denied','Only Admin can clear warnings.');
    fields(data,['uid']);const target=await staff.user(data.uid);
    await db.runTransaction(async tx=>{
      const access=await staff.read(tx,user,target);if(!access.canManage)fail('permission-denied','Only Admin can clear warnings.');
      tx.delete(warnings.doc(data.uid));
    });return {ok:true};
  }
  async function notices(user,data,ack=false){
    fields(data,ack?['ids']:[]);
    if(ack&&(!Array.isArray(data.ids)||data.ids.length>20||data.ids.some(id=>typeof id!=='string'||id.length>64)))fail('invalid-argument','Refresh this notice.');
    return db.runTransaction(async tx=>{
      const ref=warnings.doc(user.uid),doc=await tx.get(ref),record=doc.data();
      if(ack){if(record)tx.update(ref,{pending:record.pending.filter(row=>!data.ids.includes(row.id))});return {ok:true};}
      return {warnings:(record?.pending||[]).map(({id,message,at})=>({id,message,at})),role:(await staff.read(tx,user)).role};
    });
  }
  return {report,list,review,restricted,restore,details,warningAccounts,warn,clearWarnings,notices,restriction:async uid=>(await restrictions.doc(uid).get()).exists};
}
module.exports={createModeration};
