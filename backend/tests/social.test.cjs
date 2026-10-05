'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const functionsRequire=require('node:module').createRequire(require.resolve('../functions/package.json'));
const {initializeApp,deleteApp}=functionsRequire('firebase-admin/app');
const {getFirestore}=functionsRequire('firebase-admin/firestore');
const {getAuth}=functionsRequire('firebase-admin/auth');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc}=require('firebase/firestore');
const {createSocial}=require('../functions/social.cjs');
const {createService}=require('../functions/service.cjs');
const {createAccounts}=require('../functions/accounts.cjs');
const {projectSave,publicProfile}=require('../functions/projection.cjs');
const config=require('../functions/shared/mode-atlas-social-config.js');
const projectId='demo-mode-atlas';
if(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('These tests require Firebase emulators.');
const app=initializeApp({projectId}),db=getFirestore(app),auth=getAuth(app),service=createService({db,auth});
const directService=process.env.MODE_ATLAS_DIRECT_SOCIAL==='1';
let rules,serial=0;
console.log(directService?'Validation: direct service + Auth/Firestore/rules (no function transport or triggers)':'Validation: callable transport + Auth/Firestore/rules + function triggers');
before(async()=>{rules=await initializeTestEnvironment({projectId,firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});});
after(async()=>{await rules.cleanup();await deleteApp(app);});
async function learner(label,correct=20){
  const uid=`${label.replace(/[^a-z0-9]/gi,'')}-${++serial}`,email=`${uid}@example.test`,password='emulator-password';
  await auth.createUser({uid,email,password,emailVerified:true});
  const login=await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})}).then(r=>r.json());
  assert.ok(login.idToken,JSON.stringify(login));
  const call=async(action,data={},expectedUid=uid)=>{
    if(directService){
      try{return await service.call({auth:{uid,token:{auth_time:Math.floor(Date.now()/1000)}},data:{action,data,expectedUid}});}
      catch(error){error.code=String(error.code).replaceAll('-','_').toUpperCase();throw error;}
    }
    const response=await fetch(`http://127.0.0.1:5001/${projectId}/${config.region}/modeAtlasSocial`,{method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${login.idToken}`},body:JSON.stringify({data:{action,data,expectedUid}})});
    const result=await response.json();if(result.error)throw Object.assign(new Error(result.error.message),{code:result.error.status});return result.result;
  };
  await db.doc(`users/${uid}/appData/kanaTrainer`).set(save(correct));
  await call('updateProfile',{displayName:label,avatar:'kana',timeZone:'Australia/Melbourne'});
  return {uid,email,call,token:login.idToken,code:(await call('state')).code};
}
function save(correct){return {sections:{progress:{data:{state:{version:3,legacySeeded:true,sources:{device:{'kana.reading.correct':correct}},appearance:{landmark:'horizon',at:1}}}},reading:{data:{stats:{'あ':{correct:60,wrong:0}},times:{'あ':800},srs:{}}},wordBank:{data:{items:[{english:'private word'}]}}}};}
async function friend(a,b){await a.call('sendRequest',{code:b.code});await b.call('accept',{uid:a.uid});}
async function until(check){for(let i=0;i<200;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,100));}assert.fail('Expected emulator trigger did not finish');}

test('an older client cannot overwrite migrated progress; current saves and explicit current resets remain allowed',async()=>{
  const mine=rules.authenticatedContext('curve-migration').firestore(),ref=doc(mine,'users/curve-migration/appData/kanaTrainer');
  await assertSucceeds(setDoc(ref,save(6175)));
  const migrated=save(6175);Object.assign(migrated.sections.progress.data.state,{version:4,curveCredit:20000,collections:{'hunny-tester':'exclusive'}});
  await assertSucceeds(setDoc(ref,migrated));
  await assertFails(setDoc(ref,save(6300)));
  await assertFails(setDoc(ref,{sections:{reading:{data:{stats:{}}}}}));
  assert.equal((await getDoc(ref)).data().sections.progress.data.state.curveCredit,20000);
  const oldCurve=structuredClone(migrated);migrated.sections.progress.data.state.version=5;delete migrated.sections.progress.data.state.curveCredit;
  await assertSucceeds(setDoc(ref,migrated));await assertFails(setDoc(ref,oldCurve));
  migrated.sections.progress.data.state.sources.device['kana.reading.correct']=6180;
  await assertSucceeds(setDoc(ref,migrated));
  const reset=save(0);reset.sections.progress.data.state.version=5;
  await assertSucceeds(setDoc(ref,reset));
});

test('rules preserve owner-only profile/app-data access and deny every direct social read/write',async()=>{
  const mine=rules.authenticatedContext('rules-owner').firestore(),other=rules.authenticatedContext('rules-other').firestore(),anon=rules.unauthenticatedContext().firestore();
  for(const path of ['users/rules-owner','users/rules-owner/appData/kanaTrainer','users/rules-owner/appData/otherSave']){
    await assertSucceeds(setDoc(doc(mine,path),save(5)));
    await assertSucceeds(getDoc(doc(mine,path)));
    for(const stranger of [other,anon]){
      await assertFails(getDoc(doc(stranger,path)));
      await assertFails(setDoc(doc(stranger,path),save(999)));
    }
  }
  for(const path of ['users/rules-owner/private/noAccess','users/rules-owner/appData/kanaTrainer/nested/noAccess']){
    await assertFails(getDoc(doc(mine,path)));
    await assertFails(setDoc(doc(mine,path),{}));
  }
  for(const collection of ['socialAccounts','socialCodes','socialBlocks','socialLimits','socialDeleted','socialNames','socialMigrations','socialReports','socialReportLimits','socialRestrictions','socialStaff','socialWarnings','rewardEntitlements','accountDeletions','weeklyRuns','weeklyAwards','weeklyCompetitions','notificationAccounts','notificationDevices']){
    await assertFails(setDoc(doc(mine,`${collection}/rules-owner`),{xp:99999}));
    await assertFails(getDoc(doc(mine,`${collection}/rules-owner`)));
  }
});
test('identity migration claims legacy names, resolves collisions and protects the verified admin',async()=>{
  const {createIdentityStore}=require('../functions/identity.cjs');
  const records=[['legacy-a','Legacy Name'],['legacy-b','Légacy.Name'],['legacy-c','Staff'],['legacy-admin','admin']];
  for(const [uid,name]of records){
    await auth.createUser({uid,email:uid==='legacy-admin'?'admin@mode-atlas.com':uid+'@example.test',emailVerified:true});
    await db.doc(`socialAccounts/${uid}`).set({active:true,profile:{displayName:name,avatar:'kana',timeZone:'UTC'},friends:{'old-friend':1},incoming:{},outgoing:{},blockedCount:0,code:'keep-code'});
  }
  const store=createIdentityStore({db,auth});await store.ensureReady();await store.ensureReady();
  const migrated=await db.getAll(...records.map(([uid])=>db.doc(`socialAccounts/${uid}`)));
  const profiles=migrated.map(doc=>doc.data().profile);
  assert.equal(new Set(profiles.map(profile=>profile.nameKey)).size,4);
  assert.equal(profiles[0].displayName,'Legacy Name');assert.equal(profiles[3].displayName,'admin');
  for(const index of [1,2]){assert.equal(profiles[index].requiresNameChange,true);assert.match(profiles[index].displayName,/^Learner /);}
  for(const doc of migrated){assert.deepEqual(doc.data().friends,{'old-friend':1});assert.equal(doc.data().code,'keep-code');}
  assert.equal((await db.doc('socialMigrations/identity-v2').get()).data().complete,true);
  const claims=await db.collection('socialNames').get();assert.equal(claims.size,4);
});
test('profiles are opt-in, projected from the save and never expose private fields',async()=>{
  const a=await learner('Alice'),b=await learner('Bob');
  const preview=await b.call('lookup',{code:a.code});
  assert.equal(preview.profile.displayName,'Alice');assert.equal(preview.profile.stats,undefined);
  const self=await a.call('state');assert.equal(self.profile.stats.xp,20);assert.equal(self.profile.frame,'plain');
  assert.equal(self.profile.stats.readingMastered,1);
  assert.ok(!JSON.stringify(self).includes(a.email));assert.ok(!JSON.stringify(self).includes('private word'));
  await assert.rejects(a.call('updateProfile',{displayName:'Alice',avatar:'kana',timeZone:'UTC',xp:999}),{code:'INVALID_ARGUMENT'});
  await assert.rejects(b.call('profile',{uid:a.uid}),{code:'PERMISSION_DENIED'});
  await assert.rejects(a.call('lookup',{code:a.code}),{code:'INVALID_ARGUMENT'});
  await assert.rejects(a.call('leave',{},b.uid),{code:'UNAUTHENTICATED'});
  assert.equal((await a.call('state')).active,true);
});
test('recipient-only acceptance, duplicate requests and crossed requests keep both sides consistent',async()=>{
  const a=await learner('Charlie'),b=await learner('Dylan'),c=await learner('Evelyn');
  await Promise.all([a.call('sendRequest',{code:b.code}),b.call('sendRequest',{code:a.code})]);
  const stateA=await a.call('state'),recipient=stateA.counts.incoming? a:b,sender=recipient===a?b:a;
  await sender.call('sendRequest',{code:recipient.code});
  await assert.rejects(sender.call('accept',{uid:recipient.uid}),{code:'PERMISSION_DENIED'});
  await assert.rejects(c.call('accept',{uid:sender.uid}),{code:'PERMISSION_DENIED'});
  await recipient.call('accept',{uid:sender.uid});await recipient.call('accept',{uid:sender.uid});
  assert.equal((await a.call('state')).counts.friends,1);assert.equal((await b.call('state')).counts.friends,1);
  assert.equal((await a.call('state')).counts.outgoing,0);
});
test('decline, cancellation and removal affect only the caller’s connection',async()=>{
  const a=await learner('Felix'),b=await learner('Grace');
  await a.call('sendRequest',{code:b.code});await b.call('decline',{uid:a.uid});
  assert.equal((await a.call('state')).counts.outgoing,0);
  await a.call('sendRequest',{code:b.code});await a.call('cancel',{uid:b.uid});
  assert.equal((await b.call('state')).counts.incoming,0);
  await friend(a,b);await a.call('remove',{uid:b.uid});
  assert.equal((await b.call('list',{kind:'friends'})).total,0);
});
test('blocking revokes visibility and both request directions; unblocking does not restore a friendship',async()=>{
  const a=await learner('Hana'),b=await learner('Iris');await friend(a,b);
  await a.call('block',{uid:b.uid});
  assert.equal((await b.call('list',{kind:'rankings'})).total,1);
  await assert.rejects(b.call('lookup',{code:a.code}),{code:'NOT_FOUND'});
  await assert.rejects(a.call('sendRequest',{code:b.code}),{code:'NOT_FOUND'});
  const blocked=(await a.call('list',{kind:'blocked'})).rows[0];
  assert.equal(blocked.uid,b.uid);assert.equal(blocked.stats,undefined);assert.equal(blocked.level,undefined);
  await a.call('unblock',{uid:b.uid});assert.equal((await a.call('state')).counts.friends,0);
});
test('rotated codes stop working and code lookup is rate limited across opt-out',async()=>{
  const a=await learner('Jun'),b=await learner('Kai');const old=a.code;
  await a.call('rotateCode');await assert.rejects(b.call('lookup',{code:old}),{code:'NOT_FOUND'});
  for(let i=0;i<11;i++)await assert.rejects(b.call('lookup',{code:old}));
  await assert.rejects(b.call('lookup',{code:(await a.call('state')).code}),{code:'RESOURCE_EXHAUSTED'});
  await b.call('leave');await b.call('updateProfile',{displayName:'Kai',avatar:'book',timeZone:'UTC'});
  await assert.rejects(b.call('lookup',{code:(await a.call('state')).code}),{code:'RESOURCE_EXHAUSTED'});
});
test('rankings include the learner, tie fairly, paginate and accept no client score',async()=>{
  const a=await learner('Leaderboard',100),selfRef=db.doc(`socialAccounts/${a.uid}`),own=(await selfRef.get()).data();
  const batch=db.batch();
  for(let i=0;i<25;i++){
    const uid=`rank-${i.toString().padStart(2,'0')}`;own.friends[uid]=1;
    batch.set(db.doc(`socialAccounts/${uid}`),{active:true,profile:{displayName:`Learner ${i}`,avatar:'book',timeZone:'UTC'},friends:{[a.uid]:1},incoming:{},outgoing:{},blockedCount:0,
      summary:projectSave(save(i<2?200:50-i),'UTC',1)});
  }
  batch.set(selfRef,own);await batch.commit();
  const first=await a.call('list',{kind:'rankings',metric:'xp'});
  assert.equal(first.rows.length,20);assert.deepEqual(first.rows.slice(0,3).map(row=>row.rank),[1,1,3]);
  assert.equal(first.rows[2].uid,a.uid);assert.equal(first.total,26);
  const second=await a.call('list',{kind:'rankings',metric:'xp',cursor:first.nextCursor});assert.equal(second.rows.length,6);assert.equal(second.nextCursor,null);
  assert.equal(new Set([...first.rows,...second.rows].map(row=>row.uid)).size,26);
  await assert.rejects(a.call('list',{kind:'rankings',metric:'xp',score:9999}),{code:'INVALID_ARGUMENT'});
});
test('projection refresh reads the current save, clamps frames and ignores unknown kana',async()=>{
  const a=await learner('Luna');const snapshot=save(2);
  snapshot.sections.reading.data.stats.forged={correct:1000,wrong:0};snapshot.sections.reading.data.times.forged=800;
  await db.doc(`users/${a.uid}/appData/kanaTrainer`).set(snapshot);
  await Promise.all([service.refreshSummary(a.uid),service.refreshSummary(a.uid)]);
  const state=await a.call('state');assert.equal(state.profile.stats.xp,2);assert.equal(state.profile.stats.readingMastered,1);assert.equal(state.profile.frame,'plain');
});
test('study streak uses the profile time zone and expires without a new save',()=>{
  const snapshot=save(3);snapshot.sections.progress.data.state.activity={'2026-09-29':{sources:{device:[5,0]}},'2026-09-30':{sources:{device:[5,0]}}};
  const account={active:true,profile:{displayName:'Time',avatar:'moon',timeZone:'Australia/Melbourne'},summary:projectSave(snapshot,'Australia/Melbourne',1)};
  assert.equal(publicProfile('time',account,Date.parse('2026-10-01T12:00:00Z')).stats.streak,2);
  assert.equal(publicProfile('time',account,Date.parse('2026-10-01T15:00:00Z')).stats.streak,0);
});
test('opt-out hides immediately; retries and stale cleanup cannot delete a new profile',async()=>{
  const a=await learner('Mika'),b=await learner('Nora');await friend(a,b);
  const generation=await service.beginErase(a.uid);
  assert.equal((await b.call('list',{kind:'friends'})).total,0);
  await assert.rejects(b.call('lookup',{code:a.code}),{code:'NOT_FOUND'});
  await Promise.all([service.cleanup(a.uid,generation),service.cleanup(a.uid,generation)]);
  await a.call('updateProfile',{displayName:'Mika Again',avatar:'sakura',timeZone:'UTC'});
  await service.cleanup(a.uid,generation);assert.equal((await a.call('state')).profile.displayName,'Mika Again');
  assert.equal((await b.call('state')).counts.friends,0);
});
test('account deletion cleans profiles, codes, blocks and relationships; deleted users cannot recreate them',async()=>{
  const a=await learner('Owen'),b=await learner('Pia'),c=await learner('Quinn');await friend(a,b);await c.call('block',{uid:a.uid});
  await auth.deleteUser(a.uid);
  if(directService)await service.erase(a.uid,true);
  await until(async()=>{
    const documents=await db.getAll(db.doc(`socialAccounts/${a.uid}`),db.doc(`socialLimits/${a.uid}`));
    return documents.every(doc=>!doc.exists);
  });
  await assert.rejects(b.call('lookup',{code:a.code}),{code:'NOT_FOUND'});
  assert.equal((await b.call('state')).counts.friends,0);assert.equal((await c.call('state')).counts.blocked,0);
  await assert.rejects(a.call('updateProfile',{displayName:'Gone',avatar:'kana',timeZone:'UTC'}),{code:'UNAUTHENTICATED'});
  assert.equal((await db.doc(`socialLimits/${a.uid}`).get()).exists,false);
});

test('the last friends slot is protected against concurrent acceptance',async()=>{
  const a=await learner('Capacity'),b=await learner('Last Slot'),c=await learner('Another Slot');
  await b.call('sendRequest',{code:a.code});await c.call('sendRequest',{code:a.code});
  await db.doc(`socialAccounts/${a.uid}`).update({friends:Object.fromEntries(Array.from({length:99},(_,i)=>['capacity-'+i,1]))});
  const results=await Promise.allSettled([a.call('accept',{uid:b.uid}),a.call('accept',{uid:c.uid})]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.find(result=>result.status==='rejected').reason.code,'RESOURCE_EXHAUSTED');
  assert.equal((await a.call('state')).counts.friends,100);
  assert.equal((await b.call('state')).counts.friends+(await c.call('state')).counts.friends,1);
});

test('save and deletion events refresh and remove projections',async()=>{
  const a=await learner('Trigger Lifecycle');
  await db.doc(`users/${a.uid}/appData/kanaTrainer`).set(save(31));
  if(directService)await service.refreshSummary(a.uid);
  await until(async()=>(await db.doc(`socialAccounts/${a.uid}`).get()).data()?.summary?.xp===31);
  const deletionId=await service.beginErase(a.uid);
  if(directService)await service.cleanup(a.uid,deletionId);
  await until(async()=>!(await db.doc(`socialAccounts/${a.uid}`).get()).exists);
});
test('an in-flight profile update cannot recreate a deleted account’s social data',async()=>{
  const a=await learner('Deletion Race');
  const user=await auth.getUser(a.uid);
  let resume,started;
  const checked=new Promise(resolve=>{started=resolve;});
  const gated=createSocial({db,auth:{getUser:async()=>{started();await new Promise(resolve=>{resume=resolve;});return user;}}});
  const pending=gated.call({auth:{uid:a.uid},data:{action:'updateProfile',expectedUid:a.uid,data:{displayName:'Stale Request',avatar:'kana',timeZone:'UTC'}}});
  await checked;await auth.deleteUser(a.uid);await service.erase(a.uid,true);resume();
  await assert.rejects(pending,{code:'unauthenticated'});
  assert.equal((await db.doc(`socialAccounts/${a.uid}`).get()).exists,false);
});

test('malformed scalar fields and null mastery records cannot crash a save projection',()=>{
  const bad={toString:5};
  const snapshot=save(bad),state=snapshot.sections.progress.data.state;
  state.appearance.landmark=bad;state.events={bad:{type:bad,id:bad}};state.adjustments={bad:{id:bad,amount:bad}};
  snapshot.sections.reading.data.stats={'あ':null,'い':{correct:bad,wrong:bad}};
  snapshot.sections.reading.data.times={'あ':null,'い':bad};
  snapshot.sections.reading.data.srs={'う':{reviewVersion:1,level:bad,days:[bad,null],recent:[{id:'bad',at:bad,quality:2}]}};
  const result=projectSave(snapshot);assert.equal(result.xp,0);assert.equal(result.readingMastered,0);assert.equal(result.level,1);
});


test('name claims are case/accent/separator insensitive, atomic and released on rename or opt-out',async()=>{
  const a=await learner('Unique First'),b=await learner('Unique Second');
  const update=(person,displayName)=>person.call('updateProfile',{displayName,avatar:'kana',timeZone:'UTC'});
  const results=await Promise.allSettled([update(a,'Shared.Name'),update(b,'Sháred name')]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.find(result=>result.status==='rejected').reason.code,'ALREADY_EXISTS');
  const winner=results[0].status==='fulfilled'?a:b,loser=winner===a?b:a;
  await update(winner,'Moved On');await update(loser,'SHARED-NAME');
  await loser.call('leave');await update(winner,'shared name');
});
test('official names require the actual verified admin record, not client token claims',async()=>{
  const a=await learner('Ordinary Learner');
  for(const name of ['Owner','STAFF','Admіn','Admin 1','Mode Atlas Support'])await assert.rejects(a.call('updateProfile',{displayName:name,avatar:'kana',timeZone:'UTC'}),{code:'INVALID_ARGUMENT'});
  const payload={action:'updateProfile',expectedUid:a.uid,data:{displayName:'admin',avatar:'kana',timeZone:'UTC'}};
  await assert.rejects(service.call({auth:{uid:a.uid,token:{email:'admin@mode-atlas.com',email_verified:true}},data:payload}),/reserved/);
  await service.call({auth:{uid:'legacy-admin'},data:{...payload,expectedUid:'legacy-admin'}});
  await assert.rejects(service.call({auth:{uid:'legacy-admin'},data:{...payload,expectedUid:'legacy-admin',data:{...payload.data,displayName:'Owner'}}}),/reserved/);
});
test('emoji avatars round trip and account photos come only from the linked provider',async()=>{
  const a=await learner('Avatar Learner'),b=await learner('Avatar Friend');
  await a.call('updateProfile',{displayName:'Avatar Learner',avatar:'emoji:👩🏽‍🚀',timeZone:'UTC'});
  assert.equal((await b.call('lookup',{code:a.code})).profile.avatar,'emoji:👩🏽‍🚀');
  await assert.rejects(a.call('updateProfile',{displayName:'Avatar Learner',avatar:'emoji:🌸🌙',timeZone:'UTC'}),{code:'INVALID_ARGUMENT'});
  await assert.rejects(a.call('updateProfile',{displayName:'Avatar Learner',avatar:'account',avatarURL:'https://evil.test/photo',timeZone:'UTC'}),{code:'INVALID_ARGUMENT'});
  const {accountPhoto}=require('../functions/identity.cjs');
  assert.equal(accountPhoto({photoURL:'https://lh3.googleusercontent.com/client-edited',providerData:[]}),null);
  await auth.updateUser(a.uid,{providerToLink:{providerId:'google.com',uid:'avatar-google',photoUrl:'https://lh3.googleusercontent.com/a/verified'}});
  await a.call('updateProfile',{displayName:'Avatar Learner',avatar:'account',timeZone:'UTC'});
  const shown=(await b.call('lookup',{code:a.code})).profile;
  assert.equal(shown.avatarURL,'https://lh3.googleusercontent.com/a/verified');assert.equal(shown.email,undefined);
  await a.call('updateProfile',{displayName:'Avatar Learner',avatar:'moon',timeZone:'UTC'});
  assert.equal((await b.call('lookup',{code:a.code})).profile.avatarURL,undefined);
});


test('deletion commits Auth first, removes every private document and blocks stale tokens',async()=>{
  const a=await learner('DeleteOwner'),b=await learner('DeleteFriend');await friend(a,b);
  await db.doc(`users/${a.uid}`).set({private:'profile'});
  await db.doc(`users/${a.uid}/appData/otherSave`).set({private:'other'});
  await db.doc(`users/${a.uid}/appData/kanaTrainer/private/nested`).set({private:'nested'});
  const mine=rules.authenticatedContext(a.uid).firestore();
  const result=await a.call('deleteAccount');assert.equal(result.deleted,true);
  if(!directService)await until(async()=>!(await db.doc(`socialAccounts/${a.uid}`).get()).exists);
  assert.equal((await db.doc(`users/${a.uid}`).get()).exists,false);
  assert.equal((await db.doc(`users/${a.uid}/appData/otherSave`).get()).exists,false);
  assert.equal((await db.doc(`users/${a.uid}/appData/kanaTrainer/private/nested`).get()).exists,false);
  assert.equal((await b.call('state')).counts.friends,0);
  await assertFails(setDoc(doc(mine,`users/${a.uid}/appData/kanaTrainer`),save(999)));
  assert.equal((await a.call('accountDeletionStatus')).deleted,true);
  assert.equal((await a.call('deleteAccount')).deleted,true,'retries are idempotent');
});
test('failed Auth deletion leaves private saves and Friends untouched; cleanup failure is resumable',async()=>{
  const a=await learner('DeletionFailure'),b=await learner('StillFriend');await friend(a,b);
  const request={auth:{uid:a.uid,token:{auth_time:Math.floor(Date.now()/1000)}},data:{action:'deleteAccount',data:{},expectedUid:a.uid}};
  const denied=createAccounts({db,auth:{getUser:uid=>auth.getUser(uid),deleteUser:async()=>{throw Object.assign(new Error('Unavailable'),{code:'auth/internal-error'});}},social:service});
  await assert.rejects(denied.call(request),{code:'unavailable'});
  assert.ok((await db.doc(`users/${a.uid}/appData/kanaTrainer`).get()).exists);
  assert.equal((await a.call('state')).counts.friends,1);
  assert.equal((await db.doc('accountDeletions/'+a.uid).get()).exists,false);
  const stale={...request,auth:{uid:a.uid,token:{auth_time:1}}};await assert.rejects(denied.call(stale),{code:'failed-precondition'});
  const interrupted=createAccounts({db,auth,social:{erase:async()=>{throw new Error('Transient cleanup failure');}}});
  const result=await interrupted.call(request);assert.deepEqual(result,{deleted:true,cleanupPending:true});
  await service.cleanupAccount(a.uid);assert.equal((await db.doc(`socialAccounts/${a.uid}`).get()).exists,false);
  await service.cleanupAccount(a.uid);assert.equal((await b.call('state')).counts.friends,0);
});
test('reporting is scoped, deduplicated and private; only the verified admin can moderate',async()=>{
  const a=await learner('ReportSender'),b=await learner('ReportTarget'),stranger=await learner('ReportStranger');await friend(a,b);
  await assert.rejects(stranger.call('reportProfile',{uid:b.uid,reason:'name'}),{code:'PERMISSION_DENIED'});
  await a.call('reportProfile',{uid:b.uid,reason:'name',note:'Please review this display name.'});
  await a.call('reportProfile',{uid:b.uid,reason:'avatar',note:'Duplicate'});
  let records=await db.collection('socialReports').where('target','==',b.uid).get();assert.equal(records.size,1);
  await assert.rejects(a.call('listReports'),{code:'PERMISSION_DENIED'});
  const adminUser=await auth.getUser('legacy-admin');
  const adminCall=async(action,data={})=>{
    if(directService)return service.call({auth:{uid:adminUser.uid},data:{action,data,expectedUid:adminUser.uid}});
    const custom=await auth.createCustomToken(adminUser.uid);
    const login=await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=test`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:custom,returnSecureToken:true})}).then(r=>r.json());
    const response=await fetch(`http://127.0.0.1:5001/${projectId}/${config.region}/modeAtlasSocial`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${login.idToken}`},body:JSON.stringify({data:{action,data,expectedUid:adminUser.uid}})}).then(r=>r.json());
    if(response.error)throw new Error(JSON.stringify(response.error));return response.result;
  };
  const list=await adminCall('listReports');assert.ok(list.rows.some(row=>row.id===records.docs[0].id));
  assert.ok(!JSON.stringify(await b.call('state')).includes('ReportSender'));
  await assert.rejects(a.call('reviewReport',{id:records.docs[0].id,decision:'restrict'}),{code:'PERMISSION_DENIED'});
  await adminCall('reviewReport',{id:records.docs[0].id,decision:'restrict'});
  assert.equal((await b.call('state')).restricted,true);
  assert.equal((await a.call('list')).rows.length,0,'restricted profiles disappear from friends and rankings');
  await b.call('leave');await assert.rejects(b.call('updateProfile',{displayName:'Back Again',avatar:'kana',timeZone:'UTC'}),{code:'PERMISSION_DENIED'});
  const restricted=await adminCall('listRestrictions');assert.ok(restricted.rows.some(row=>row.uid===b.uid));
  await adminCall('restoreProfile',{uid:b.uid});await b.call('updateProfile',{displayName:'Back Again',avatar:'kana',timeZone:'UTC'});
  await assert.rejects(b.call('updateProfile',{displayName:'f.u.c.k',avatar:'kana',timeZone:'UTC'}),{code:'INVALID_ARGUMENT'});
  const lookup=await stranger.call('lookup',{code:(await b.call('state')).code});assert.equal(lookup.profile.uid,b.uid);
  await stranger.call('reportProfile',{uid:b.uid,reason:'other',code:(await b.call('state')).code});
  records=await db.collection('socialReports').where('target','==',b.uid).where('state','==','open').get();
  await adminCall('reviewReport',{id:records.docs[0].id,decision:'reset'});
  const changed=await b.call('state');assert.match(changed.profile.displayName,/^Learner /);assert.equal(changed.preferences.requiresNameChange,true);
  assert.equal((await db.doc(`users/${b.uid}/appData/kanaTrainer`).get()).data().sections.progress.data.state.sources.device['kana.reading.correct'],20);
});


test('Admin and Moderator permissions, official badges, warning privacy, acknowledgement and cleanup',async()=>{
  const adminUid='legacy-admin';
  const adminCall=async(action,data={})=>{
    if(directService)return service.call({auth:{uid:adminUid},data:{action,data,expectedUid:adminUid}});
    const token=await auth.createCustomToken(adminUid);
    const login=await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=test`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,returnSecureToken:true})}).then(r=>r.json());
    const result=await fetch(`http://127.0.0.1:5001/${projectId}/${config.region}/modeAtlasSocial`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${login.idToken}`},body:JSON.stringify({data:{action,data,expectedUid:adminUid}})}).then(r=>r.json());
    if(result.error)throw new Error(JSON.stringify(result.error));return result.result;
  };
  const mod=await learner('ModFriend'),peer=await learner('OfficialPeer'),member=await learner('WarningMember'),other=await learner('WarningObserver');
  await friend(mod,member);await friend(other,member);
  await assert.rejects(member.call('warnProfile',{uid:'nonexistent-profile',message:'Unauthorized warning',requestId:crypto.randomUUID()}),{code:'PERMISSION_DENIED'});
  await assert.rejects(member.call('assignModerator',{uid:member.uid,moderator:true}),{code:'PERMISSION_DENIED'});
  await assert.rejects(member.call('listWarnings'),{code:'PERMISSION_DENIED'});
  await adminCall('assignModerator',{uid:mod.uid,moderator:true});await adminCall('assignModerator',{uid:peer.uid,moderator:true});
  assert.equal((await mod.call('listModerators')).canManage,false);assert.equal((await adminCall('listModerators')).canManage,true);
  assert.equal((await mod.call('state')).profile.role,'moderator');assert.equal((await adminCall('state')).profile.role,'admin');
  assert.equal((await member.call('list')).rows.find(row=>row.uid===mod.uid).role,'moderator');
  await assert.rejects(mod.call('assignModerator',{uid:member.uid,moderator:true}),{code:'PERMISSION_DENIED'});
  for(const uid of [adminUid,mod.uid,peer.uid]){
    await assert.rejects(mod.call('warnProfile',{uid,message:'Please change this.',requestId:crypto.randomUUID()}),{code:'PERMISSION_DENIED'});
    const ref=db.collection('socialReports').doc(require('node:crypto').createHash('sha256').update('staff-report-'+uid).digest('hex'));
    await ref.set({target:uid,reporter:member.uid,state:'open',snapshot:{displayName:'Official'},createdAt:Date.now()});
    await assert.rejects(mod.call('reviewReport',{id:ref.id,decision:'dismiss'}),{code:'PERMISSION_DENIED'});
    if(uid===peer.uid){await auth.updateUser(uid,{disabled:true});await assert.rejects(mod.call('reviewReport',{id:ref.id,decision:'dismiss'}),{code:'PERMISSION_DENIED'});await auth.updateUser(uid,{disabled:false});}
    await adminCall('reviewReport',{id:ref.id,decision:'dismiss'});
    assert.equal((await ref.get()).data().state,'closed');
  }
  const warning={uid:member.uid,message:'Please keep your display name welcoming.',requestId:crypto.randomUUID()};
  await db.doc('socialRestrictions/'+mod.uid).set({restricted:true});
  await assert.rejects(mod.call('warnProfile',warning),{code:'PERMISSION_DENIED'});
  await assert.rejects(mod.call('listReports'),{code:'PERMISSION_DENIED'});
  await assert.rejects(mod.call('listWarnings'),{code:'PERMISSION_DENIED'});
  await assert.rejects(mod.call('listModerators'),{code:'PERMISSION_DENIED'});
  await db.doc('socialRestrictions/'+mod.uid).delete();
  await mod.call('warnProfile',warning);await mod.call('warnProfile',warning);
  assert.equal((await mod.call('staffProfile',{uid:member.uid})).count,1,'retries must not duplicate warnings');
  const warned=(await mod.call('listWarnings')).rows.find(row=>row.uid===member.uid);
  assert.equal(warned.count,1);assert.equal(warned.canAct,true);
  assert.deepEqual(Object.keys(warned).sort(),['uid','displayName','role','canAct','count','lastWarnedAt'].sort());
  assert.equal(JSON.stringify(warned).includes(warning.message),false);
  await assert.rejects(mod.call('listWarnings',{cursor:'bad/path'}),{code:'INVALID_ARGUMENT'});
  await adminCall('warnProfile',{uid:peer.uid,message:'An Admin warning.',requestId:crypto.randomUUID()});
  assert.equal((await mod.call('listWarnings')).rows.find(row=>row.uid===peer.uid).canAct,false);
  assert.equal((await adminCall('listWarnings')).rows.find(row=>row.uid===peer.uid).canAct,true);
  const pending=await member.call('accountNotices');assert.equal(pending.warnings[0].message,warning.message);assert.equal(pending.count,undefined);assert.equal(pending.warnings[0].by,undefined);
  await assert.rejects(member.call('staffProfile',{uid:member.uid}),{code:'PERMISSION_DENIED'});
  assert.equal(JSON.stringify(await other.call('profile',{uid:member.uid})).includes('warning'),false);
  assert.equal(JSON.stringify(await other.call('list',{kind:'rankings'})).includes(warning.message),false);
  await assert.rejects(mod.call('clearWarnings',{uid:member.uid}),{code:'PERMISSION_DENIED'});
  await member.call('acknowledgeWarnings',{ids:[warning.requestId]});assert.deepEqual((await member.call('accountNotices')).warnings,[]);
  assert.equal((await mod.call('staffProfile',{uid:member.uid})).count,1,'acknowledgement does not clear history');
  await member.call('leave');assert.equal((await mod.call('staffProfile',{uid:member.uid})).count,1,'opt-out must not erase warnings');
  assert.equal((await mod.call('listWarnings')).rows.find(row=>row.uid===member.uid).count,1);
  await adminCall('clearWarnings',{uid:member.uid});assert.equal((await mod.call('staffProfile',{uid:member.uid})).count,0);
  assert.equal((await mod.call('listWarnings')).rows.some(row=>row.uid===member.uid),false);
  await mod.call('leave');
  await auth.updateUser(mod.uid,{disabled:true});
  assert.ok((await adminCall('listModerators')).rows.some(row=>row.uid===mod.uid),'Admin can find former or disabled moderators');
  await assert.rejects(member.call('listModerators'),{code:'PERMISSION_DENIED'});
  await adminCall('assignModerator',{uid:mod.uid,moderator:false});
  await auth.updateUser(mod.uid,{disabled:false});
  await mod.call('updateProfile',{displayName:'ModFriend',avatar:'kana',timeZone:'UTC'});
  await assert.rejects(mod.call('listReports'),{code:'PERMISSION_DENIED'});
  await assert.rejects(mod.call('listWarnings'),{code:'PERMISSION_DENIED'});
  await assert.rejects(mod.call('listModerators'),{code:'PERMISSION_DENIED'});
  await assert.rejects(mod.call('warnProfile',{...warning,requestId:crypto.randomUUID()}),{code:'PERMISSION_DENIED'});
  assert.equal((await mod.call('state')).profile.role,'member');
  await adminCall('warnProfile',{uid:peer.uid,message:'An Admin warning.',requestId:crypto.randomUUID()});
  const pagedIds=Array.from({length:21},(_,index)=>'warn-page-'+String(index).padStart(2,'0'));
  await Promise.all(pagedIds.map(async uid=>{await auth.createUser({uid});await db.doc('socialWarnings/'+uid).set({count:1,history:[{id:'fixture',at:Date.now(),message:'private fixture'}],pending:[]});}));
  let cursor=null;const found=[];
  do{const page=await adminCall('listWarnings',cursor?{cursor}:{});assert.ok(page.rows.length<=20);found.push(...page.rows.map(row=>row.uid));cursor=page.nextCursor;}while(cursor);
  assert.equal(new Set(found).size,found.length);for(const uid of pagedIds)assert.ok(found.includes(uid));
  await Promise.all(pagedIds.map(uid=>db.doc('socialWarnings/'+uid).delete()));
  await peer.call('deleteAccount');if(directService)await service.erase(peer.uid,true);
  await until(async()=>!(await db.doc('socialWarnings/'+peer.uid).get()).exists);
  assert.equal((await adminCall('listWarnings')).rows.some(row=>row.uid===peer.uid),false);
  assert.equal(Object.hasOwn((await db.doc('socialStaff/roles').get()).data().moderators,peer.uid),false);
});

test('reward policy verifies the audience, admin role, event windows and revocations',()=>{
  const {entitlement}=require('../functions/rewards.cjs'),{createHash}=require('node:crypto');
  const email='tester@example.test',audience=createHash('sha256').update(email).digest('hex');
  const account={uid:'reward-owner',email:email.toUpperCase(),emailVerified:true},at=10000;
  assert.deepEqual(entitlement(account,{},at,audience).grants,['hunny-tester']);
  for(const change of [{emailVerified:false},{disabled:true},{email:'other@example.test'}])assert.deepEqual(entitlement({...account,...change},{},at,audience).grants,[]);
  assert.deepEqual(entitlement(account,{grants:{'hunny-tester':{revoked:true}}},at,audience).grants,[]);
  const other={...account,email:'other@example.test'};
  for(const row of [{startsAt:at+1},{expiresAt:at},{revoked:true},{expiresAt:'later'}])assert.deepEqual(entitlement(other,{grants:{'hunny-tester':row}},at).grants,[]);
  assert.deepEqual(entitlement(other,{grants:{'hunny-tester':{startsAt:at,expiresAt:at+100}}},at),{allCustom:false,grants:['hunny-tester'],validUntil:at+100});
  assert.equal(entitlement({...account,email:'admin@mode-atlas.com'}, {},at).allCustom,true);
  assert.equal(entitlement({...account,email:'admin@mode-atlas.com',emailVerified:false}, {},at).allCustom,false);
});

test('custom rewards need no Friends enrolment and never trust forged tokens or save grants',async()=>{
  const a=await learner('RewardTester'),b=await learner('RewardViewer');await friend(a,b);
  const selected=save(0);selected.sections.progress.data.state.appearance.banner='hunny';
  selected.sections.progress.data.state.rewardAccess={allCustom:true,grants:['hunny-tester']};
  await db.doc(`users/${a.uid}/appData/kanaTrainer`).set(selected);
  assert.deepEqual((await a.call('rewards')).grants,[]);
  assert.equal((await a.call('state')).profile.banner,'plain');
  const forged=await service.call({auth:{uid:a.uid,token:{email:'admin@mode-atlas.com',email_verified:true}},data:{action:'rewards',data:{},expectedUid:a.uid}});
  assert.equal(forged.allCustom,false);assert.deepEqual(forged.grants,[]);
  await assert.rejects(a.call('rewards',{uid:b.uid}),{code:'INVALID_ARGUMENT'});
  await assert.rejects(a.call('rewards',{},b.uid),{code:'UNAUTHENTICATED'});
  await db.doc(`rewardEntitlements/${a.uid}`).set({grants:{'hunny-tester':{awardedAt:Date.now()}}});
  assert.deepEqual((await a.call('rewards')).grants,['hunny-tester']);
  assert.equal((await a.call('state')).profile.banner,'hunny');
  const view=(await b.call('list')).rows.find(row=>row.uid===a.uid);assert.equal(view.banner,'hunny');assert.equal(view.rewardAccess,undefined);
  await db.doc(`rewardEntitlements/${a.uid}`).set({grants:{'hunny-tester':{revoked:true}}});
  assert.equal((await b.call('list')).rows.find(row=>row.uid===a.uid).banner,'plain','revocation takes effect in Friends before the owner returns');
  await db.doc(`rewardEntitlements/${a.uid}`).set({grants:{'hunny-tester':{}}});
  await a.call('leave');assert.deepEqual((await a.call('rewards')).grants,['hunny-tester']);
  assert.equal((await a.call('state')).active,false);
  const admin=await service.call({auth:{uid:'legacy-admin'},data:{action:'rewards',data:{},expectedUid:'legacy-admin'}});assert.equal(admin.allCustom,true);
  await auth.deleteUser(a.uid);await service.cleanupAccount(a.uid);assert.equal((await db.doc(`rewardEntitlements/${a.uid}`).get()).exists,false);
});

test('weekly callables require explicit participation and never accept client scores',async()=>{
  const a=await learner('Weekly Transport',7003);
  assert.equal((await a.call('weeklyState')).enabled,false);
  await assert.rejects(a.call('weeklyList',{scope:'global'}),{code:'FAILED_PRECONDITION'});
  await a.call('weeklyPreference',{enabled:true});
  assert.equal((await a.call('weeklyState')).score,0);
  await assert.rejects(a.call('weeklyStart',{id:'transport-run',pool:['あ'],direction:'reading',mode:'guided',hints:false,score:9999}),{code:'INVALID_ARGUMENT'});
  assert.equal((await a.call('weeklyStart',{id:'transport-run',pool:['あ'],direction:'reading',mode:'guided',hints:false})).enabled,true);
  await a.call('weeklyPreference',{enabled:false});
  assert.equal((await a.call('weeklyState')).enabled,false);
});

test('weekly study receipts check answers, sequences, account tokens, retries and the UTC boundary',async()=>{
  const {createWeekly}=require('../functions/weekly.cjs');
  const policy=require('../functions/shared/mode-atlas-weekly-rules.js');
  let at=Date.parse('2099-09-30T12:00:00Z');const weekly=createWeekly({db,now:()=>at});
  const a=await learner('Weekly Receipts',7003),b=await learner('Weekly Other',0);
  const config={id:'receipt-run',pool:['あ','い','う','え','お'],direction:'reading',mode:'guided',hints:false};
  assert.equal((await weekly.start(a.uid,config)).enabled,false);
  await weekly.preference(a.uid,{enabled:true});await weekly.preference(b.uid,{enabled:true});
  const first=await weekly.start(a.uid,config),other=await weekly.start(b.uid,config);
  assert.equal((await weekly.start(a.uid,config)).token,first.token);
  at+=5000;const answers=[{index:1,kana:'あ',answer:'a',elapsed:500},{index:2,kana:'い',answer:'u',elapsed:1000},{index:3,kana:'う',answer:'u',elapsed:1500}];
  const result=await weekly.submit(a.uid,{token:first.token,answers});assert.equal(result.earned,4);
  const replay=await weekly.submit(a.uid,{token:first.token,answers});assert.equal(replay.earned,0);assert.equal(replay.runEarned,4);
  await assert.rejects(weekly.submit(a.uid,{token:other.token,answers}),{code:'failed-precondition'});
  await assert.rejects(weekly.submit(a.uid,{token:first.token,answers:[{index:5,kana:'あ',answer:'a',elapsed:2000}]}),{code:'failed-precondition'});
  await assert.rejects(weekly.submit(a.uid,{token:first.token,answers:[{index:4,kana:'カ',answer:'ka',elapsed:2000}]}),{code:'invalid-argument'});
  await assert.rejects(weekly.submit(a.uid,{token:first.token,answers:[{index:4,kana:'あ',answer:'a',elapsed:2000,correct:true}]}),{code:'invalid-argument'});
  assert.equal((await weekly.state(a.uid)).score,4);
  const hinted=await weekly.start(b.uid,{...config,id:'hinted-run',hints:true});at+=1000;
  assert.equal((await weekly.submit(b.uid,{token:hinted.token,answers:[answers[0]]})).earned,1);
  at=policy.period(at).endAt;
  await assert.rejects(weekly.submit(a.uid,{token:first.token,answers}),{code:'failed-precondition'});
  assert.equal((await weekly.state(a.uid)).score,0);
  assert.equal(policy.period(at-1).endAt,at);assert.equal(policy.period(at).startAt,at);
});

test('weekly rankings honor friends, mutual blocking, shared ranks, opt-out and current levels',async()=>{
  const {createWeekly}=require('../functions/weekly.cjs');let at=Date.parse('2098-09-30T12:00:00Z');const weekly=createWeekly({db,now:()=>at});
  const a=await learner('Weekly Circle',7003),b=await learner('Weekly Rival',5800),c=await learner('Weekly Third',0);
  for(const p of [a,b,c])await weekly.preference(p.uid,{enabled:true});
  const week=(await weekly.state(a.uid)).period.id;
  for(const [p,score]of [[a,200],[b,200],[c,100]])await db.doc(`weeklyCompetitions/${week}/entries/${p.uid}`).set({uid:p.uid,week,active:true,score,days:{}});
  await db.doc('socialAccounts/'+a.uid).update({'summary.level':21});
  const board=await weekly.list(a.uid,{scope:'global'});
  assert.deepEqual((await weekly.list(a.uid,{scope:'nearby'})).rows.map(row=>row.uid),board.rows.map(row=>row.uid));
  assert.deepEqual(board.rows.map(row=>row.rank),[1,1,3]);assert.equal(board.rows.find(row=>row.uid===a.uid).level,12);
  assert.ok(board.rows.every(row=>!row.stats));
  assert.equal((await weekly.list(a.uid,{scope:'friends'})).rows.length,1);
  await friend(a,b);assert.equal((await weekly.list(a.uid,{scope:'friends'})).rows.length,2);
  await a.call('block',{uid:b.uid});assert.ok(!(await weekly.list(a.uid,{scope:'global'})).rows.some(row=>row.uid===b.uid));
  assert.ok(!(await weekly.list(b.uid,{scope:'global'})).rows.some(row=>row.uid===a.uid));
  assert.ok(!(await weekly.list(a.uid,{scope:'nearby'})).rows.some(row=>row.uid===b.uid));
  await weekly.preference(c.uid,{enabled:false});assert.ok(!(await weekly.list(a.uid,{scope:'global'})).rows.some(row=>row.uid===c.uid));
  await weekly.preference(c.uid,{enabled:true});assert.equal((await weekly.state(c.uid)).score,100);
});

test('weekly prizes settle once, honor ties and preserve private saves without feeding the next competition',async()=>{
  const {createWeekly}=require('../functions/weekly.cjs');const policy=require('../functions/shared/mode-atlas-weekly-rules.js');
  let at=Date.parse('2097-09-30T12:00:00Z');const weekly=createWeekly({db,now:()=>at});
  const a=await learner('Prize One',7003),b=await learner('Prize Two',5800),c=await learner('Prize Three',0);
  const period=policy.period(at);await db.doc('weeklyCompetitions/'+period.id).set({...period,settled:false});
  for(const [p,score]of [[a,250],[b,250],[c,100]]){await weekly.preference(p.uid,{enabled:true});await db.doc(`weeklyCompetitions/${period.id}/entries/${p.uid}`).set({uid:p.uid,active:true,score,days:{}});}
  at=period.endAt+300001;
  await Promise.all([weekly.settle(period.id),weekly.settle(period.id)]);await weekly.settle(period.id);
  for(const [p,base,prize,rank]of [[a,7003,500,1],[b,5800,500,1],[c,0,150,3]]){
    const saved=(await db.doc(`users/${p.uid}/appData/kanaTrainer`).get()).data();
    assert.equal(projectSave(saved).xp,base+prize);assert.equal(saved.sections.wordBank.data.items[0].english,'private word');
    const status=await weekly.state(p.uid);assert.equal(status.score,0);assert.equal(status.awards[0].xp,prize);assert.equal(status.awards[0].rank,rank);assert.deepEqual(status.results[0],status.awards[0]);
  }
  const next=policy.period(at);await db.doc('weeklyCompetitions/'+next.id).set({...next,settled:false});
  await db.doc(`weeklyCompetitions/${next.id}/entries/${a.uid}`).set({uid:a.uid,active:true,score:100});at=next.endAt+300001;
  await weekly.settle(next.id);assert.equal((await db.doc('weeklyCompetitions/'+next.id).get()).data().reason,'minimum-players');
  assert.equal((await weekly.state(a.uid)).results[0].xp,0);assert.equal((await weekly.state(a.uid)).results[0].rank,1);
  await weekly.preference(a.uid,{enabled:false});await weekly.syncAccount(a.uid);assert.equal((await weekly.state(a.uid)).results[0].score,100);
});

test('account notification tokens move between owners and alerts are once per day with quiet hours',async()=>{
  const {createNotifications}=require('../functions/notifications.cjs');
  const policy=require('../functions/shared/mode-atlas-weekly-rules.js');
  let at=Date.parse('2096-10-01T20:15:00Z'),position=2;const sent=[];
  const notifications=createNotifications({db,now:()=>at,weekly:{rank:async()=>({score:100,rank:position})},messaging:{sendEachForMulticast:async request=>{sent.push(request);return {successCount:request.tokens.length,responses:request.tokens.map(()=>({success:true}))};}}});
  const a=await learner('Notify One'),b=await learner('Notify Two');
  const preferences={dailyGoals:true,weeklyGoals:true,streak:true,overtaken:true},token='test-push-token-'.repeat(5);
  await notifications.configure(a.uid,{preferences,token,timeZone:'UTC'});
  await notifications.inspect(a.uid);await notifications.inspect(a.uid);assert.equal(sent.length,1);
  at+=2*3600000;position=3;await notifications.inspect(a.uid);assert.equal(sent.length,1,'No rank alerts after quiet hours start');
  at+=10*3600000;position=4;await notifications.inspect(a.uid);assert.equal(sent.length,1,'No rank alerts before 9am');
  at+=3600000;position=5;await notifications.inspect(a.uid);assert.equal(sent.length,2);assert.match(sent[1].notification.body,/#5/);
  position=6;await notifications.inspect(a.uid);assert.equal(sent.length,2,'One rank alert per local day');
  await notifications.configure(b.uid,{preferences,token,timeZone:'UTC'});
  at+=86400000;position=7;await notifications.inspect(a.uid);assert.equal(sent.length,2,'A previous account cannot send to a reassigned token');
  await notifications.inspect(b.uid);position=8;await notifications.inspect(b.uid);assert.equal(sent.length,3);assert.equal(sent[2].data.owner,b.uid);
  await notifications.configure(b.uid,{preferences:{dailyGoals:false,weeklyGoals:false,streak:false,overtaken:false},token:'',timeZone:'UTC'});
  at+=86400000;position=9;await notifications.inspect(b.uid);assert.equal(sent.length,3);
  await notifications.erase(a.uid);await notifications.erase(b.uid);
  assert.equal((await db.doc('notificationAccounts/'+a.uid).get()).exists,false);
});

test('goal and streak notices use the saved account time zone and suppress completed work',()=>{
  const {evening}=require('../functions/notifications.cjs'),rules=require('../functions/shared/mode-atlas-reward-rules.js');
  const at=Date.parse('2026-10-04T09:15:00Z'); // Sunday 8:15pm after Melbourne daylight saving begins.
  const day='2026-10-04',week='2026-09-28';
  const value={sections:{progress:{data:{state:{version:5,legacySeeded:true,activity:{'2026-10-03':{sources:{a:[5,0]}}}}}}}};
  const preferences={dailyGoals:true,weeklyGoals:true,streak:true,overtaken:false};
  let notice=evening(value,preferences,'Australia/Melbourne',at);
  assert.match(notice.body,/daily goals/);assert.match(notice.body,/weekly goals/);assert.match(notice.body,/1-day streak/);
  value.sections.progress.data.state.activity[day]={sources:{a:[5,0]}};
  value.sections.progress.data.state.claims=Object.fromEntries(['daily','weekly'].flatMap(period=>rules.goals(period==='daily'?day:week,period).map(goal=>[`v4:${period}:${period==='daily'?day:week}:goal:${goal.id}`,goal.xp])));
  assert.equal(evening(value,preferences,'Australia/Melbourne',at),null);
  assert.equal(evening(value,preferences,'UTC',at),null);
});

test('non-ranking friends lists ignore legacy ranking filters while lifetime rankings validate metrics',async()=>{
  const a=await learner('List Regression');
  for(const kind of ['friends','incoming','outgoing','blocked'])assert.deepEqual((await a.call('list',{kind,metric:'weekly'})).rows,[]);
  await assert.rejects(a.call('list',{kind:'rankings',metric:'weekly'}),{code:'INVALID_ARGUMENT'});
});

test('weekly results resume a tie across the bounded cursor and preserve every private finish once',async()=>{
  const {createWeekly}=require('../functions/weekly.cjs'),policy=require('../functions/shared/mode-atlas-weekly-rules.js');
  const period=policy.period(Date.parse('2093-09-30T12:00:00Z')),weekly=createWeekly({db,now:()=>period.endAt+300001});
  const ref=db.doc('weeklyCompetitions/'+period.id),batch=db.batch();batch.set(ref,{...period,settled:false});
  for(let i=0;i<103;i++){
    const uid='cursor-result-'+String(i).padStart(3,'0'),score=i<101?200:50;
    batch.set(db.doc('socialAccounts/'+uid),{active:true,weekly:{enabled:true}});
    batch.set(ref.collection('entries').doc(uid),{uid,active:true,score});
  }
  await batch.commit();await weekly.settle(period.id);
  assert.equal((await ref.get()).data().settled,false);assert.equal((await ref.get()).data().resultCount,100);
  await weekly.settle(period.id);await weekly.settle(period.id);
  assert.equal((await ref.get()).data().settled,true);assert.equal((await ref.get()).data().resultCount,103);
  for(const [id,rank,xp]of [['000',1,500],['100',1,500],['101',102,0],['102',102,0]]){
    const uid='cursor-result-'+id,status=await weekly.state(uid);assert.equal(status.results[0].rank,rank);assert.equal(status.results[0].xp,xp);
    const saved=(await db.doc(`users/${uid}/appData/kanaTrainer`).get()).data();assert.equal(projectSave(saved||{}).xp,xp);
  }
  await weekly.erase('cursor-result-100');assert.equal((await db.doc('weeklyAwards/cursor-result-100').get()).exists,false);
});

test('notification timing preserves old-client schedules and suppresses overlap per device',async()=>{
  const {createNotifications}=require('../functions/notifications.cjs');
  let at=Date.parse('2092-10-01T20:15:00Z');const sent=[];
  const notifications=createNotifications({db,now:()=>at,weekly:{rank:async()=>null},messaging:{sendEachForMulticast:async request=>{sent.push(request);return {successCount:request.tokens.length,responses:request.tokens.map(()=>({success:true}))};}}});
  const a=await learner('Timed Alerts'),preferences={dailyGoals:true,weeklyGoals:false,streak:false,overtaken:false};
  const schedule={reminderMinute:1200,quietStart:1290,quietEnd:480};
  await notifications.configure(a.uid,{preferences,token:'local-overlap-token-12345',timeZone:'UTC',schedule,localReminder:{enabled:true,hour:19,minute:30}});
  await notifications.configure(a.uid,{preferences,token:'other-device-token-12345',timeZone:'UTC',localReminder:{enabled:false,hour:19,minute:0}});
  assert.deepEqual((await notifications.state(a.uid)).schedule,schedule);
  await notifications.inspect(a.uid);await notifications.inspect(a.uid);assert.equal(sent.length,1);assert.deepEqual(sent[0].tokens,['other-device-token-12345']);
  assert.equal(Number(sent[0].apns.headers['apns-expiration'])*1000,Date.parse('2092-10-01T21:30:00Z'));
  await assert.rejects(notifications.configure(a.uid,{preferences,token:'',timeZone:'UTC',schedule:{...schedule,reminderMinute:1305}}),{code:'invalid-argument'});
  at=Date.parse('2092-10-02T21:45:00Z');await notifications.send(a.uid,{id:'late-test',kind:'dailyGoals',title:'Late',body:'No delivery',destination:'yourAtlas',expiresAt:at+3600000});assert.equal(sent.length,1);
});

test('cached mastery projections refresh on Friends views without waiting for another study session',async()=>{
  const a=await learner('Mastery Reader'),b=await learner('Mastery Friend');await friend(a,b);
  await db.doc('socialAccounts/'+b.uid).update({'summary.projectionVersion':1,'summary.combinedMastered':1});
  const result=await a.call('list',{kind:'rankings',metric:'mastery'}),peer=result.rows.find(row=>row.uid===b.uid);
  assert.equal(peer.stats.readingMastered,1);assert.equal(peer.stats.writingMastered,0);assert.equal(peer.stats.combinedMastered,0);
  assert.equal((await db.doc('socialAccounts/'+b.uid).get()).data().summary.projectionVersion,2);
  const saved=(await db.doc('socialAccounts/'+b.uid).get()).updateTime.toMillis();
  await a.call('list',{kind:'friends'});assert.equal((await db.doc('socialAccounts/'+b.uid).get()).updateTime.toMillis(),saved);
  await db.doc('socialAccounts/'+b.uid).update({'summary.projectionVersion':1,'summary.combinedMastered':1});
  assert.equal((await a.call('profile',{uid:b.uid})).profile.stats.combinedMastered,0);
});


test('account alert timezone survives device reconnects until explicitly changed',async()=>{
  const {createNotifications}=require('../functions/notifications.cjs');
  const n=createNotifications({db,weekly:{rank:async()=>null}}),user=await learner('Zone Reader');
  const preferences={dailyGoals:true,weeklyGoals:false,streak:false,overtaken:false};
  await n.configure(user.uid,{preferences,token:'timezone-first-device-12345',timeZone:'UTC'});
  await n.configure(user.uid,{preferences,token:'timezone-second-device-12345',timeZone:'Australia/Melbourne'});
  assert.equal((await n.state(user.uid)).timeZone,'UTC');
  await n.configure(user.uid,{preferences,token:'timezone-second-device-12345',timeZone:'Australia/Melbourne',updateTimeZone:true});
  await n.configure(user.uid,{preferences,token:'timezone-first-device-12345',timeZone:'UTC'});
  assert.equal((await n.state(user.uid)).timeZone,'Australia/Melbourne');
  await assert.rejects(n.configure(user.uid,{preferences,token:'',timeZone:'UTC',updateTimeZone:'yes'}),{code:'invalid-argument'});
});
