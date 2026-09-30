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
const {projectSave,publicProfile}=require('../functions/projection.cjs');
const config=require('../functions/shared/mode-atlas-social-config.js');
const projectId='demo-mode-atlas';
if(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('These tests require Firebase emulators.');
const app=initializeApp({projectId}),db=getFirestore(app),auth=getAuth(app),service=createSocial({db,auth});
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
      try{return await service.call({auth:{uid},data:{action,data,expectedUid}});}
      catch(error){error.code=String(error.code).replaceAll('-','_').toUpperCase();throw error;}
    }
    const response=await fetch(`http://127.0.0.1:5001/${projectId}/${config.region}/modeAtlasSocial`,{method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${login.idToken}`},body:JSON.stringify({data:{action,data,expectedUid}})});
    const result=await response.json();if(result.error)throw Object.assign(new Error(result.error.message),{code:result.error.status});return result.result;
  };
  await db.doc(`users/${uid}/appData/kanaTrainer`).set(save(correct));
  await call('updateProfile',{displayName:label,avatar:'kana',timeZone:'Australia/Melbourne'});
  return {uid,email,call,code:(await call('state')).code};
}
function save(correct){return {sections:{progress:{data:{state:{version:3,legacySeeded:true,sources:{device:{'kana.reading.correct':correct}},appearance:{landmark:'horizon',at:1}}}},reading:{data:{stats:{'あ':{correct:60,wrong:0}},times:{'あ':800},srs:{}}},wordBank:{data:{items:[{english:'private word'}]}}}};}
async function friend(a,b){await a.call('sendRequest',{code:b.code});await b.call('accept',{uid:a.uid});}
async function until(check){for(let i=0;i<200;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,100));}assert.fail('Expected emulator trigger did not finish');}

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
  for(const collection of ['socialAccounts','socialCodes','socialBlocks','socialLimits','socialDeleted']){
    await assertFails(setDoc(doc(mine,`${collection}/rules-owner`),{xp:99999}));
    await assertFails(getDoc(doc(mine,`${collection}/rules-owner`)));
  }
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
