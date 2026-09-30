'use strict';
const {createHash}=require('node:crypto');
const {FieldPath}=require('firebase-admin/firestore');
const {HttpsError}=require('firebase-functions/v2/https');
const {isAdmin}=require('./identity.cjs');
const policy=require('./shared/mode-atlas-social-identity.js');
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(code,message)=>{throw new HttpsError(code,message);};
const reasons=new Set(['name','avatar','harassment','other']);
function fields(data,allowed){if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!allowed.includes(key)))fail('invalid-argument','Unsupported report request.');}
function createModeration({db,identities,now=Date.now}){
  const reports=db.collection('socialReports'),restrictions=db.collection('socialRestrictions');
  const account=uid=>db.doc('socialAccounts/'+uid);
  function admin(user){if(!isAdmin(user))fail('permission-denied','This action is available to the moderation team.');}
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
    admin(user);fields(data,['cursor']);
    if(data.cursor!=null&&!/^[a-f0-9]{64}$/.test(data.cursor))fail('invalid-argument','Refresh the reports list.');
    let query=reports.where('state','==','open').orderBy(FieldPath.documentId()).limit(20);
    if(data.cursor)query=query.startAfter(data.cursor);
    const found=await query.get(),rows=[];
    for(const doc of found.docs){
      const report=doc.data(),current=(await account(report.target).get()).data();
      rows.push({id:doc.id,target:report.target,reason:report.reason,note:report.note,snapshot:report.snapshot,createdAt:report.createdAt,
        current:current?.profile?{displayName:current.profile.displayName,avatar:current.profile.avatar,avatarURL:current.profile.avatarURL||null,restricted:current.restricted===true}:null});
    }
    return {rows,nextCursor:found.size===20?found.docs.at(-1).id:null};
  }
  async function review(user,data){
    admin(user);fields(data,['id','decision']);
    if(!/^[a-f0-9]{64}$/.test(data.id||'')||!['dismiss','reset','restrict'].includes(data.decision))fail('invalid-argument','Choose a moderation action.');
    await identities.ensureReady();
    return db.runTransaction(async tx=>{
      const ref=reports.doc(data.id),doc=await tx.get(ref),report=doc.data();
      if(!report)fail('not-found','This report has expired or was removed.');
      if(report.target===user.uid)fail('permission-denied','You cannot review a report about yourself.');
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
      tx.update(ref,{state:'closed',decision:data.decision,reviewedAt:now()});return {ok:true};
    });
  }
  async function restricted(user,data){
    admin(user);fields(data,['cursor']);
    if(data.cursor!=null&&!/^[A-Za-z0-9_-]{1,128}$/.test(data.cursor))fail('invalid-argument','Refresh the list.');
    let query=restrictions.orderBy(FieldPath.documentId()).limit(20);if(data.cursor)query=query.startAfter(data.cursor);
    const found=await query.get(),rows=[];
    for(const doc of found.docs){const a=(await account(doc.id).get()).data();rows.push({uid:doc.id,displayName:a?.profile?.displayName||'Unavailable profile'});}
    return {rows,nextCursor:found.size===20?found.docs.at(-1).id:null};
  }
  async function restore(user,data){
    admin(user);fields(data,['uid']);
    if(typeof data.uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(data.uid))fail('invalid-argument','Choose a profile.');
    await db.runTransaction(async tx=>{
      const ref=account(data.uid),doc=await tx.get(ref);
      tx.delete(restrictions.doc(data.uid));if(doc.exists)tx.update(ref,{restricted:false});
    });return {ok:true};
  }
  return {report,list,review,restricted,restore,restriction:async uid=>(await restrictions.doc(uid).get()).exists};
}
module.exports={createModeration};
