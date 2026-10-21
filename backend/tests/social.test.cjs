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

test('combined weekly sessions verify alternating directions on the server',()=>{
  const {scoreAnswers}=require('../functions/weekly.cjs');
  const run={direction:'both',mode:'guided',pool:['あ'],index:0,elapsed:0,seen:[],startedAt:0,hints:false};
  const read={index:1,kana:'あ',answer:'a',elapsed:300},recall={index:2,kana:'あ',answer:'あ',elapsed:600};
  const right=scoreAnswers(run,[read,recall],1000),wrong=scoreAnswers(run,[read,{...recall,answer:'a'}],1000);
  assert.equal(right.index,2);assert.ok(right.score>wrong.score);
  assert.throws(()=>scoreAnswers(run,[{...read,direction:'writing'}],1000),/Invalid study receipt/);
});

const {createService}=require('../functions/service.cjs');
const {createAccounts}=require('../functions/accounts.cjs');
const {projectSave,publicProfile}=require('../functions/projection.cjs');
const config=require('../functions/shared/mode-atlas-social-config.js');
const catalogue=require('../functions/shared/mode-atlas-shop-catalogue.js');
const projectId='demo-mode-atlas';
if(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('These tests require Firebase emulators.');
const app=initializeApp({projectId}),db=getFirestore(app),auth=getAuth(app),service=createService({db,auth});
const directService=process.env.MODE_ATLAS_DIRECT_SOCIAL==='1';
let rules,serial=0;
console.log(directService?'Validation: direct service + Auth/Firestore/rules (no function transport or triggers)':'Validation: callable transport + Auth/Firestore/rules + function triggers');
before(async()=>{rules=await initializeTestEnvironment({projectId,firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});});
after(async()=>{await rules.cleanup();await deleteApp(app);});
function verifiedContext(uid){return rules.authenticatedContext(uid,{email_verified:true,auth_time:Math.floor(Date.now()/1000)});}
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
  await seedEarned(uid,save(correct));
  await call('updateProfile',{displayName:label,avatar:'kana',timeZone:'Australia/Melbourne'});
  return {uid,email,call,token:login.idToken,code:(await call('state')).code};
}
function save(correct){return {sections:{progress:{data:{state:{version:3,legacySeeded:true,sources:{device:{'kana.reading.correct':correct}},appearance:{landmark:'horizon',at:1}}}},reading:{data:{stats:{'あ':{correct:60,wrong:0}},times:{'あ':800},srs:{}}},wordBank:{data:{items:[{english:'private word'}]}}}};}
// Admin-only fixture: economic evidence is seeded separately from editable
// learning saves. Tests that mutate a personal save do not implicitly earn money.
async function seedEarned(uid,data){
  const progress=require('../functions/shared/mode-atlas-progress.js')({ModeAtlasRewardRules:require('../functions/shared/mode-atlas-reward-rules.js'),ModeAtlasDates:require('../functions/shared/mode-atlas-date.js')});
  await db.doc('studyEarnings/'+uid).set({version:1,state:progress.normalizeState(data.sections?.progress?.data?.state),answerOffset:0,streakOffset:0,days:require('../functions/projection.cjs').studyDaysFromSave(data,'UTC')});
}
async function friend(a,b){await a.call('sendRequest',{code:b.code});await b.call('accept',{uid:a.uid});}
async function until(check){for(let i=0;i<200;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,100));}assert.fail('Expected emulator trigger did not finish');}

test('owned save sections replace removed map fields and retain repeating personal goals',async()=>{
  const client=verifiedContext('section-replace').firestore(),ref=doc(client,'users/section-replace/appData/kanaTrainer');
  const old=save(20);old.sections.progress.data.state.version=7;
  old.sections.progress.data.state.personalGoals={daily:{id:'kana-correct',target:20,repeat:true,start:'2026-10-20',at:1792454400000},weekly:{id:'kana-correct',target:100,repeat:false,start:'2026-10-19',at:1792454400000}};
  old.sections.reading.data.stats['い']={correct:3,wrong:0};
  await assertSucceeds(setDoc(ref,{...old,unrelated:'preserved'}));
  const next=structuredClone(old);delete next.sections.progress.data.state.personalGoals.weekly;delete next.sections.reading.data.stats['い'];
  await assertSucceeds(setDoc(ref,next,{mergeFields:Object.keys(next)}));
  const saved=(await getDoc(ref)).data();
  assert.equal(saved.sections.progress.data.state.personalGoals.daily.repeat,true);
  assert.equal(saved.sections.progress.data.state.personalGoals.weekly,undefined);
  assert.equal(saved.sections.reading.data.stats['い'],undefined);
  assert.equal(saved.unrelated,'preserved');
});

test('an older client cannot overwrite migrated progress; current saves and explicit current resets remain allowed',async()=>{
  const mine=verifiedContext('curve-migration').firestore(),ref=doc(mine,'users/curve-migration/appData/kanaTrainer');
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
  const prePersonal=structuredClone(migrated);migrated.sections.progress.data.state.version=6;migrated.sections.progress.data.state.personalGoals={daily:{id:'learn-kana',target:3,repeat:true,start:'2026-10-20',at:1792454400000}};
  await assertSucceeds(setDoc(ref,migrated));await assertFails(setDoc(ref,prePersonal));
  const reset=save(0);reset.sections.progress.data.state.version=6;
  await assertSucceeds(setDoc(ref,reset));
});

test('partitioned account saves require atomic revisions and protect private chunks from other accounts',async()=>{
  const client=verifiedContext('partition-owner').firestore(),stranger=verifiedContext('partition-other').firestore();
  const root=doc(client,'users/partition-owner/appData/kanaTrainer'),part=doc(client,'users/partition-owner/appData/kanaTrainer/parts/section-progress-0');
  const value={storageVersion:2,revision:1,generation:0,sections:{progress:{updatedAt:1,data:{},storage:{format:'json-parts-v1',parts:['section-progress-0'],schemaVersion:7}}}};
  await assertFails(setDoc(part,{text:'orphan'}));
  const batch=require('firebase/firestore').writeBatch(client);batch.set(part,{text:JSON.stringify({state:{version:7}})});batch.set(root,value);await assertSucceeds(batch.commit());
  await assertFails(getDoc(doc(stranger,part.path)));await assertFails(setDoc(doc(stranger,part.path),{text:'stolen'}));
  await assertFails(setDoc(root,save(1000)));await assertFails(setDoc(root,{...value,revision:1}));await assertSucceeds(setDoc(root,{...value,revision:2,generation:1}));
  await assertFails(require('firebase/firestore').deleteDoc(root));
});

test('rules preserve owner-only profile/app-data access and deny every direct social read/write',async()=>{
  const mine=verifiedContext('rules-owner').firestore(),other=verifiedContext('rules-other').firestore(),anon=rules.unauthenticatedContext().firestore();
  for(const path of ['users/rules-owner','users/rules-owner/appData/kanaTrainer']){
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
  for(const collection of ['avatarProfiles','commerceMigrations','socialAccounts','socialCodes','socialBlocks','socialLimits','socialDeleted','socialNames','socialMigrations','socialReports','socialReportLimits','socialRestrictions','socialStaff','socialWarnings','rewardEntitlements','commerceAccounts','shopCatalogue','accountDeletions','weeklyRuns','weeklyAwards','weeklyCompetitions','notificationAccounts','notificationDevices','studyEarnings','weeklyRewardReviews','socialProjectionQueue','accountAccess','securityAudit','usageReports','usageOptOuts','usageLimits']){
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
  await friend(a,b);
  const home=await a.call('state',{listKind:'friends'});
  assert.equal(home.list.kind,'friends');assert.equal(home.list.rows.length,1);assert.equal(home.list.rows[0].uid,b.uid);
  assert.ok(!JSON.stringify(home.list).includes('private word'));assert.ok(!JSON.stringify(home.list).includes(b.email));
  await assert.rejects(a.call('state',{listKind:'reports'}),{code:'INVALID_ARGUMENT'});
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
  const pending=gated.call({auth:{uid:a.uid,token:{auth_time:Math.floor(Date.now()/1000)}},data:{action:'updateProfile',expectedUid:a.uid,data:{displayName:'Stale Request',avatar:'kana',timeZone:'UTC'}}});
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
  await assert.rejects(service.call({auth:{uid:a.uid,token:{auth_time:Math.floor(Date.now()/1000),email:'admin@mode-atlas.com',email_verified:true}},data:payload}),/reserved/);
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
  const mine=verifiedContext(a.uid).firestore();
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
  assert.equal((await b.call('state',{listKind:'friends'})).list,undefined,'restricted accounts cannot obtain an embedded friends list');
  assert.equal((await a.call('list')).rows.length,0,'restricted profiles disappear from friends and rankings');
  await b.call('leave');await assert.rejects(b.call('updateProfile',{displayName:'Back Again',avatar:'kana',timeZone:'UTC'}),{code:'PERMISSION_DENIED'});
  const restricted=await adminCall('listRestrictions');assert.ok(restricted.rows.some(row=>row.uid===b.uid));
  await adminCall('restoreProfile',{uid:b.uid});await b.call('updateProfile',{displayName:'Back Again',avatar:'kana',timeZone:'UTC'});
  await assert.rejects(b.call('updateProfile',{displayName:'f.u.c.k',avatar:'kana',timeZone:'UTC'}),{code:'INVALID_ARGUMENT'});
  const lookup=await stranger.call('lookup',{code:(await b.call('state')).code});assert.equal(lookup.profile.uid,b.uid);
  await stranger.call('reportProfile',{uid:b.uid,reason:'other',code:(await b.call('state')).code});
  records=await db.collection('socialReports').where('target','==',b.uid).where('state','==','open').get();
  await adminCall('reviewReport',{id:records.docs[0].id,decision:'reset'});
  const changed=await b.call('state');assert.match(changed.profile.displayName,/^Learner /);assert.equal(changed.preferences.requiresNameChange,true);assert.equal((await b.call('avatarState')).avatar,'kana');
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
  const characters=require('../functions/shared/mode-atlas-avatar-rules.js'),look={...characters.defaults,outfit:'hunny',headwear:'hunny',accessory:'hunny'};
  const bought={grants:{'shop-hunny-jumper':{},'shop-hunny-pendant':{}}};
  assert.equal(characters.allowed(look,1,entitlement(account,{},at,audience)),false);
  for(const [user,allowed]of [[account,true],[{...account,email:'ordinary@example.test'},false],[{...account,emailVerified:false},false],[{...account,disabled:true},false],[{...account,email:'admin@mode-atlas.com'},true]])assert.equal(characters.allowed(look,1,entitlement(user,bought,at,audience)),allowed);
});

test('custom rewards need no Friends enrolment and never trust forged tokens or save grants',async()=>{
  const a=await learner('RewardTester'),b=await learner('RewardViewer');await friend(a,b);
  const selected=save(0);selected.sections.progress.data.state.appearance.banner='hunny';
  selected.sections.progress.data.state.rewardAccess={allCustom:true,grants:['hunny-tester']};
  await db.doc(`users/${a.uid}/appData/kanaTrainer`).set(selected);
  assert.deepEqual((await a.call('rewards')).grants,[]);
  assert.equal((await a.call('state')).profile.banner,'plain');
  const forged=await service.call({auth:{uid:a.uid,token:{auth_time:Math.floor(Date.now()/1000),email:'admin@mode-atlas.com',email_verified:true}},data:{action:'rewards',data:{},expectedUid:a.uid}});
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

test('shop wallet is account-bound, read-only and preserved on social opt-out; deletion removes it',async()=>{
  const a=await learner('ShopLearner'),b=await learner('ShopViewer');
  await a.call('leave');
  assert.deepEqual(await a.call('shop'),{version:1,currency:'atlas-tokens',balance:0,purchasesEnabled:false});
  const ref=db.doc(`commerceAccounts/${a.uid}`);
  await ref.set({version:1,currency:'atlas-tokens',balance:250});
  await ref.collection('transactions').doc('verified-example').set({amount:250});
  const forged=save(999);forged.sections.progress.data.state.wallet={balance:999999};forged.sections.progress.data.state.appearance={landmark:'sakura',banner:'sakura',at:10,bannerAt:10};
  await db.doc(`users/${a.uid}/appData/kanaTrainer`).set(forged);
  assert.equal((await a.call('shop')).balance,250,'No coin milestone is reached; the embedded wallet is ignored');assert.equal((await b.call('shop')).balance,0);
  assert.deepEqual((await a.call('rewards')).grants,[]);
  await assert.rejects(a.call('shop',{uid:b.uid}),{code:'INVALID_ARGUMENT'});
  await assert.rejects(a.call('shop',{},b.uid),{code:'UNAUTHENTICATED'});
  await assert.rejects(a.call('shop',{balance:1000}),{code:'INVALID_ARGUMENT'});
  await assert.rejects(a.call('purchase',{product:'sakura'}),{code:'INVALID_ARGUMENT'});
  await ref.update({balance:-1});await assert.rejects(a.call('shop'),{code:'FAILED_PRECONDITION'});
  await ref.update({balance:250});
  await a.call('leave');assert.equal((await a.call('shop')).balance,250);
  await auth.deleteUser(a.uid);await service.cleanupAccount(a.uid);
  assert.equal((await ref.get()).exists,false);assert.equal((await ref.collection('transactions').get()).empty,true);
});
test('shop cosmetics require private grants and never project a wallet into social profiles',async()=>{
  const a=await learner('ShopOwner'),b=await learner('ShopFriend');await friend(a,b);
  const saved=save(20);saved.sections.progress.data.state.appearance={landmark:'sakura',banner:'sakura',at:10,bannerAt:10};
  await db.doc(`users/${a.uid}/appData/kanaTrainer`).set(saved);
  assert.equal((await a.call('state')).profile.banner,'plain');
  await db.doc(`rewardEntitlements/${a.uid}`).set({grants:{'shop-sakura':{}}});
  await db.doc(`commerceAccounts/${a.uid}`).set({version:1,currency:'atlas-tokens',balance:500});
  const own=(await a.call('state')).profile;assert.equal(own.banner,'sakura');assert.equal(own.frame,'sakura');assert.equal(own.stats.xp,20);
  const other=(await b.call('list')).rows.find(row=>row.uid===a.uid);assert.equal(other.banner,'sakura');assert.equal(other.balance,undefined);assert.equal(other.wallet,undefined);
  await db.doc(`rewardEntitlements/${a.uid}`).set({grants:{'shop-sakura':{revoked:true}}});
  assert.equal((await b.call('list')).rows.find(row=>row.uid===a.uid).banner,'plain');
});
test('coin purchases are atomic, retry-safe and reject forged prices, insufficient funds and direct writes',async()=>{
  const a=await learner('CoinBuyer'),b=await learner('CoinOther'),timeZone='Australia/Melbourne';
  const ref=db.doc('commerceAccounts/'+a.uid);await ref.set({version:1,currency:'atlas-tokens',balance:1500});
  const request={requestId:crypto.randomUUID(),productId:'sakura',coinPrice:catalogue.item('sakura').coinPrice,timeZone};
  const results=await Promise.all([a.call('shopPurchase',request),a.call('shopPurchase',request)]);
  for(const result of results){assert.equal(result.balance,750);assert.deepEqual(result.owned,['sakura']);}
  assert.equal((await ref.collection('operations').where('action','==','shopPurchase').get()).size,1);
  assert.deepEqual((await a.call('rewards')).grants,['shop-sakura']);
  await assert.rejects(a.call('shopPurchase',{...request,requestId:crypto.randomUUID()}),{code:'ALREADY_EXISTS'});
  await assert.rejects(a.call('shopPurchase',{...request,productId:'midnight'}),{code:'INVALID_ARGUMENT'});
  await assert.rejects(a.call('shopPurchase',{...request,requestId:crypto.randomUUID(),productId:'midnight',coinPrice:1}),{code:'FAILED_PRECONDITION'});
  await assert.rejects(b.call('shopPurchase',{...request,requestId:crypto.randomUUID()}),{code:'FAILED_PRECONDITION'});
  await assert.rejects(a.call('shopPurchase',{...request,uid:b.uid}),{code:'INVALID_ARGUMENT'});
  await assert.rejects(a.call('shopPurchase',request,b.uid),{code:'UNAUTHENTICATED'});
  const freeze=()=>a.call('shopPurchase',{requestId:crypto.randomUUID(),productId:'streak-freeze',coinPrice:catalogue.item('streak-freeze').coinPrice,timeZone});
  await Promise.all([freeze(),freeze()]);const wallet=await a.call('shop',{version:2,timeZone});
  assert.equal(wallet.balance,450);assert.equal(wallet.inventory['streak-freeze'],2);
  await assert.rejects(freeze(),{code:'FAILED_PRECONDITION'});
  const mine=verifiedContext(a.uid).firestore();
  await assertFails(setDoc(doc(mine,'commerceAccounts/'+a.uid+'/operations/forged'),{balanceAfter:999999}));
  await assertFails(setDoc(doc(mine,'shopCatalogue/current'),{offers:{sakura:{coinPrice:0}}}));
  await db.doc('accountDeletions/'+a.uid).set({state:'committing'});
  await assert.rejects(a.call('shopPurchase',{requestId:crypto.randomUUID(),productId:'midnight',coinPrice:catalogue.item('midnight').coinPrice,timeZone}),{code:'UNAUTHENTICATED'});
  assert.equal((await ref.get()).data().balance,450);
});
for(const productId of ['midnight','skyline','evergreen'])test(`rotating ${productId} out blocks new sales while existing cosmetic and theme ownership survives`,async()=>{
  const a=await learner('Collector '+productId),b=await learner('Visitor '+productId),timeZone='UTC';
  for(const user of [a,b])await db.doc('commerceAccounts/'+user.uid).set({version:1,currency:'atlas-tokens',balance:1000});
  await a.call('shopPurchase',{requestId:crypto.randomUUID(),productId:productId,coinPrice:catalogue.item(productId).coinPrice,timeZone});
  const listing=db.doc('shopCatalogue/current');
  try{
    await listing.set({offers:{[productId]:{enabled:false}}});
    const state=await a.call('shop',{version:2,timeZone});assert.ok(!state.offers.some(p=>p.id===productId));assert.ok(state.owned.includes(productId));
    const grants=await a.call('rewards'),rules=require('../functions/shared/mode-atlas-reward-rules.js');assert.equal(rules.allowed('themes',productId,1,grants),true);
    await assert.rejects(b.call('shopPurchase',{requestId:crypto.randomUUID(),productId:productId,coinPrice:catalogue.item(productId).coinPrice,timeZone}),{code:'FAILED_PRECONDITION'});
    await listing.set({offers:{[productId]:{startsAt:Date.now()+86400000}}});
    await assert.rejects(b.call('shopPurchase',{requestId:crypto.randomUUID(),productId:productId,coinPrice:catalogue.item(productId).coinPrice,timeZone}),{code:'FAILED_PRECONDITION'});
    await listing.set({offers:{[productId]:{endsAt:Date.now()-1000}}});
    await assert.rejects(b.call('shopPurchase',{requestId:crypto.randomUUID(),productId:productId,coinPrice:catalogue.item(productId).coinPrice,timeZone}),{code:'FAILED_PRECONDITION'});
    await listing.set({offers:{[productId]:{enabled:true}}});
    assert.ok((await b.call('shopPurchase',{requestId:crypto.randomUUID(),productId:productId,coinPrice:catalogue.item(productId).coinPrice,timeZone})).owned.includes(productId));
  }finally{await listing.delete();}
});
test('developer coin credits and purchase reset use actual Auth role, keep earned/event rewards and audit retries',async()=>{
  const a=await learner('NotDeveloper'),timeZone='UTC',credit={requestId:crypto.randomUUID(),operation:'credit',amount:2000,timeZone};
  await assert.rejects(a.call('shopDeveloper',credit),{code:'PERMISSION_DENIED'});
  await assert.rejects(service.call({auth:{uid:a.uid,token:{auth_time:Math.floor(Date.now()/1000),email:'admin@mode-atlas.com',email_verified:true}},data:{action:'shopDeveloper',data:credit,expectedUid:a.uid}}),{code:'permission-denied'});
  const uid='legacy-admin';await db.doc('socialLimits/'+uid).delete();
  const custom=await auth.createCustomToken(uid),login=await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=test`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:custom,returnSecureToken:true})}).then(r=>r.json());
  const call=async(action,data)=>{
    if(directService)return service.call({auth:{uid},data:{action,data,expectedUid:uid}});
    const result=await fetch(`http://127.0.0.1:5001/${projectId}/${config.region}/modeAtlasSocial`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${login.idToken}`},body:JSON.stringify({data:{action,data,expectedUid:uid}})}).then(r=>r.json());
    if(result.error)throw Object.assign(new Error(result.error.message),{code:result.error.status});return result.result;
  };
  await db.doc('rewardEntitlements/'+uid).set({grants:{'hunny-tester':{}}});
  await db.doc('commerceAccounts/'+uid).delete();
  await Promise.all([call('shopDeveloper',credit),call('shopDeveloper',credit)]);assert.equal((await call('shop',{version:2,timeZone})).balance,2000);
  await call('shopPurchase',{requestId:crypto.randomUUID(),productId:'sakura',coinPrice:catalogue.item('sakura').coinPrice,timeZone});
  await call('shopPurchase',{requestId:crypto.randomUUID(),productId:'streak-repair',coinPrice:catalogue.item('streak-repair').coinPrice,timeZone});
  const reset={requestId:crypto.randomUUID(),operation:'resetPurchases',timeZone};
  await call('shopDeveloper',reset);const after=await call('shopDeveloper',reset);assert.equal(after.balance,950);assert.deepEqual(after.owned,[]);assert.equal(after.inventory['streak-repair'],0);
  const grants=await call('rewards',{});assert.deepEqual(grants.grants,['hunny-tester']);assert.equal(grants.allCustom,true);
  assert.equal(require('../functions/shared/mode-atlas-reward-rules.js').allowed('themes','sakura',99,grants),false);
  await call('shopDeveloper',credit);assert.equal((await call('shop',{version:2,timeZone})).balance,950,'An old credit receipt cannot mint coins after a reset');
});
test('streak inventory uses local calendar boundaries, refunds late offline practice and repairs an eligible gap',async()=>{
  const a=await learner('StreakItems'),{createCommerce}=require('../functions/commerce.cjs'),timeZone='Australia/Melbourne';
  let clock=Date.parse('2026-10-03T23:00:00+10:00');const commerce=createCommerce({db,now:()=>clock}),user=await auth.getUser(a.uid);
  const ref=db.doc('commerceAccounts/'+a.uid),saveRef=db.doc('users/'+a.uid+'/appData/kanaTrainer');
  const studied=days=>{const data=save(100);data.sections.reading.data.dailyChallengeHistory=Object.fromEntries(days.map(day=>[day,{}]));return data;};
  await saveRef.set(studied(['2026-10-01','2026-10-02','2026-10-03']));await ref.set({version:1,currency:'atlas-tokens',balance:2000});
  const buy=productId=>commerce.run(user,'shopPurchase',{requestId:crypto.randomUUID(),productId,coinPrice:catalogue.item(productId).coinPrice,timeZone});
  await buy('streak-freeze');await buy('streak-repair');
  clock=Date.parse('2026-10-05T00:00:00+11:00');
  const state=()=>commerce.run(user,'shop',{version:2,timeZone});let value=await state();assert.deepEqual(value.protection,['2026-10-04']);assert.equal(value.inventory['streak-freeze'],0);
  assert.deepEqual((await state()).protection,value.protection);
  await saveRef.set(studied(['2026-10-01','2026-10-02','2026-10-03','2026-10-04']));value=await state();assert.deepEqual(value.protection,[]);assert.equal(value.inventory['streak-freeze'],1);
  clock=Date.parse('2026-10-07T00:00:00+11:00');value=await state();assert.deepEqual(value.protection,['2026-10-05']);assert.equal(value.repairDay,'2026-10-06');
  const request={requestId:crypto.randomUUID(),productId:'streak-repair',timeZone};await commerce.run(user,'shopUse',request);value=await commerce.run(user,'shopUse',request);
  assert.equal(value.inventory['streak-repair'],0);assert.deepEqual(value.protection,['2026-10-05','2026-10-06']);
  assert.deepEqual((await saveRef.get()).data(),studied(['2026-10-01','2026-10-02','2026-10-03','2026-10-04']),'Using items must not write learning data or XP');
  clock=Date.parse('2026-10-11T00:00:00+11:00');await buy('streak-repair');assert.equal((await state()).repairDay,null);
  await assert.rejects(commerce.run(user,'shopUse',{...request,requestId:crypto.randomUUID()}),{code:'failed-precondition'});
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
  const prizeSave=save(7003);prizeSave.sections.progress.data.state.version=6;prizeSave.sections.progress.data.state.personalGoals={daily:{id:'learn-kana',target:3,repeat:true,start:'2097-09-30',at}};
  await db.doc(`users/${a.uid}/appData/kanaTrainer`).set(prizeSave);
  at=period.endAt+300001;
  await Promise.all([weekly.settle(period.id),weekly.settle(period.id)]);await weekly.settle(period.id);
  for(const [p,base,prize,rank]of [[a,7003,500,1],[b,5800,500,1],[c,0,150,3]]){
    const saved=(await db.doc(`users/${p.uid}/appData/kanaTrainer`).get()).data();
    assert.equal(projectSave(saved).xp,base+prize);assert.equal(saved.sections.wordBank.data.items[0].english,'private word');
    if(p.uid===a.uid)assert.equal(saved.sections.progress.data.state.personalGoals.daily.target,3);
    const status=await weekly.state(p.uid);assert.equal(status.score,0);assert.equal(status.awards[0].xp,prize);assert.equal(status.awards[0].rank,rank);assert.deepEqual(status.results[0],status.awards[0]);
    const coins=rank===1?100:0;assert.equal(status.awards[0].coins,coins);
    const wallet=(await db.doc('commerceAccounts/'+p.uid).get()).data();
    assert.equal((wallet?.balance||0)-(wallet?.levelRewards?.total||0),coins);
    const receipt=await db.doc(`commerceAccounts/${p.uid}/operations/weekly-v1-${period.id}`).get();
    assert.equal(receipt.exists,rank===1);if(receipt.exists)assert.equal(receipt.data().amount,100);
  }
  const next=policy.period(at);await db.doc('weeklyCompetitions/'+next.id).set({...next,settled:false});
  await db.doc(`weeklyCompetitions/${next.id}/entries/${a.uid}`).set({uid:a.uid,active:true,score:100});at=next.endAt+300001;
  await weekly.settle(next.id);assert.equal((await db.doc('weeklyCompetitions/'+next.id).get()).data().reason,'minimum-players');
  assert.equal((await weekly.state(a.uid)).results[0].xp,0);assert.equal((await weekly.state(a.uid)).results[0].coins,0);assert.equal((await weekly.state(a.uid)).results[0].rank,1);
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
  const wallet={version:2,currency:'atlas-coins',balance:0,inventory:{'streak-freeze':[{id:'ready-freeze',at:at-86400000}],'streak-repair':[]},purchases:{},covered:{}};
  const protectedNotice=evening(value,preferences,'Australia/Melbourne',at,undefined,wallet);
  assert.match(protectedNotice.body,/daily goals/);assert.doesNotMatch(protectedNotice.body,/streak/,'A held freeze must suppress false midnight urgency');
  assert.equal(evening(value,{streak:true},'Australia/Melbourne',at,undefined,wallet),null);
  assert.equal(wallet.inventory['streak-freeze'].length,1,'Notification projection cannot spend an item');
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
    batch.set(db.doc('socialAccounts/'+uid),{active:true,profile:{displayName:uid,avatar:'kana',timeZone:'UTC'},weekly:{enabled:true}});
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

test('Friends lists queue stale projections without loading every private save',async()=>{
  const a=await learner('Mastery Reader'),b=await learner('Mastery Friend');await friend(a,b);
  const snapshot=save(20),review={reviewVersion:1,level:4,peak:3,days:['2026-10-01','2026-10-02','2026-10-03','2026-10-04'],recent:Array.from({length:12},(_,i)=>({id:'recall-'+i,at:1791000000000+i*86400000,quality:2}))};
  snapshot.sections.reading.data={stats:{'あ':{correct:52,wrong:3},'お':{correct:86,wrong:14}},times:{'あ':1100,'お':1600},srs:{'あ':review,'お':review}};
  await db.doc(`users/${b.uid}/appData/kanaTrainer`).set(snapshot);
  await b.call('state');
  if(directService)await service.refreshSummary(b.uid);
  await until(async()=>(await db.doc('socialAccounts/'+b.uid).get()).data().summary.readingMastered===0);
  await db.doc('socialAccounts/'+b.uid).update({'summary.projectionVersion':2,'summary.readingMastered':2,'summary.combinedMastered':1});
  const result=await a.call('list',{kind:'rankings',metric:'mastery'}),peer=result.rows.find(row=>row.uid===b.uid);
  const queued=await db.doc('socialProjectionQueue/'+b.uid).get(),projected=await db.doc('socialAccounts/'+b.uid).get();
  // A delayed save trigger may finish the same migration before this read.
  // Both states are valid; the final assertions below still require fresh data.
  assert.ok(queued.exists||projected.data().summary.projectionVersion===7);
  await service.maintainEngagement();
  const refreshed=(await a.call('list',{kind:'rankings',metric:'mastery'})).rows.find(row=>row.uid===b.uid);
  Object.assign(peer,refreshed);
  assert.equal(peer.stats.readingMastered,0);assert.equal(peer.stats.writingMastered,0);assert.equal(peer.stats.combinedMastered,0);
  assert.equal(peer.stats.insights.kana.mastered,0);assert.equal(peer.stats.insights.kana.total,240);assert.equal(peer.stats.insights.achievements.total,91);
  assert.equal((await db.doc('socialAccounts/'+b.uid).get()).data().summary.projectionVersion,7);
  const saved=(await db.doc('socialAccounts/'+b.uid).get()).updateTime.toMillis();
  await a.call('list',{kind:'friends'});assert.equal((await db.doc('socialAccounts/'+b.uid).get()).updateTime.toMillis(),saved);
  await db.doc('socialAccounts/'+b.uid).update({'summary.projectionVersion':2,'summary.combinedMastered':1});
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

test('level catch-up uses the current curve, preserves an existing wallet and cannot repeat after retries or a progress reset',async()=>{
  const a=await learner('CoinCatchup'),ref=db.doc('commerceAccounts/'+a.uid),saveRef=db.doc(`users/${a.uid}/appData/kanaTrainer`),timeZone='UTC';
  await ref.set({version:1,currency:'atlas-tokens',balance:73});
  const old=save(7003);old.sections.progress.data.state.version=4;old.sections.progress.data.state.curveCredit=999999;
  await saveRef.set(old);
  assert.equal((await a.call('shop',{version:2,timeZone})).balance,73,'editable totals cannot retroactively mint coins');
  await seedEarned(a.uid,old);
  const wallets=await Promise.all(Array.from({length:4},()=>a.call('shop',{version:2,timeZone})));
  for(const wallet of wallets){assert.equal(wallet.balance,98);assert.equal(wallet.levelRewards.throughLevel,12);assert.equal(wallet.levelRewards.total,25);}
  assert.equal((await ref.collection('operations').where('action','==','levelReward').get()).size,1);
  const spend={requestId:crypto.randomUUID(),productId:'quiff',coinPrice:catalogue.item('quiff').coinPrice,timeZone};
  await a.call('shopPurchase',spend);await a.call('shopPurchase',spend);
  await saveRef.set(save(0));assert.equal((await a.call('shop',{version:2,timeZone})).balance,48);
  await saveRef.set(save(7003));assert.equal((await a.call('shop',{version:2,timeZone})).balance,48);
  await saveRef.set(save(10000));await seedEarned(a.uid,save(10000));const increased=await a.call('shop',{version:2,timeZone});assert.equal(increased.balance,48);assert.equal(increased.levelRewards.throughLevel,14);
  await assert.rejects(a.call('shop',{version:2,timeZone,level:999}),{code:'INVALID_ARGUMENT'});
});
test('a resumed coin backfill reaches accounts outside Friends and checkpoints pages without re-awarding coins',async()=>{
  const a=await learner('DormantCoins'),b=await learner('DormantCoinsTwo');await a.call('leave');await b.call('leave');
  await db.doc(`users/${a.uid}/appData/kanaTrainer`).set(save(7003));await db.doc(`users/${b.uid}/appData/kanaTrainer`).set(save(10000));await seedEarned(a.uid,save(7003));await seedEarned(b.uid,save(10000));
  const records=await Promise.all([auth.getUser(a.uid),auth.getUser(b.uid)]),marker=db.doc('commerceMigrations/study-currency-v2');await marker.delete();
  let failOnce=true,pages=0;
  const {createCommerce}=require('../functions/commerce.cjs');
  const commerce=createCommerce({db,auth:{getUser:uid=>auth.getUser(uid),listUsers:async(limit,token)=>{assert.equal(limit,50);pages++;if(!token)return {users:[records[0]],pageToken:'page-two'};assert.equal(token,'page-two');if(failOnce){failOnce=false;throw Error('temporary failure');}return {users:[records[1]]};}}});
  try{
    await commerce.backfillLevels();assert.equal((await marker.get()).data().pageToken,'page-two');
    await assert.rejects(commerce.backfillLevels(),/temporary failure/);assert.equal((await marker.get()).data().pageToken,'page-two');
    await commerce.backfillLevels();assert.equal((await marker.get()).data().complete,true);await commerce.backfillLevels();assert.equal(pages,3);
    assert.equal((await a.call('shop',{version:2,timeZone:'UTC'})).balance,25);assert.equal((await b.call('shop',{version:2,timeZone:'UTC'})).balance,25);
    assert.equal((await a.call('state')).active,false);
  }finally{await marker.delete();}
});
test('trusted earnings award coins without Friends; editable saves and deletion barriers cannot mint coins',async()=>{
  const a=await learner('TriggerCoins');await a.call('leave');const ref=db.doc('commerceAccounts/'+a.uid);
  await db.doc(`users/${a.uid}/appData/kanaTrainer`).set(save(7003));
  await service.refreshSummary(a.uid);assert.equal((await ref.get()).data()?.balance||0,0);
  await seedEarned(a.uid,save(7003));
  await service.refreshSummary(a.uid);
  if(directService)await service.refreshSummary(a.uid);
  await until(async()=> (await ref.get()).data()?.levelRewards?.throughLevel===12);
  assert.equal((await ref.get()).data().balance,25);
  await db.doc('accountDeletions/'+a.uid).set({state:'committing'});await ref.delete();
  await service.refreshSummary(a.uid);assert.equal((await ref.get()).exists,false);
});
test('character saves stay private without Friends, synchronize public portraits, enforce ownership and reject stale edits',async()=>{
  const a=await learner('AvatarOwner'),b=await learner('AvatarViewer'),defaults=require('../functions/shared/mode-atlas-avatar-rules.js').defaults;
  let state=await a.call('avatarState');assert.equal(state.avatar,'kana');
  await a.call('leave');
  const value={avatar:'character',character:{...defaults,skin:'cocoa',hair:'coils',outfit:'linen'},revision:state.revision};
  state=await a.call('avatarUpdate',value);assert.equal((await a.call('state')).active,false);assert.equal(state.character.skin,'cocoa');
  await assert.rejects(a.call('avatarUpdate',value),{code:'ABORTED'});
  await assert.rejects(a.call('avatarUpdate',{...value,revision:state.revision,character:{...defaults,outfit:'grove'}}),{code:'PERMISSION_DENIED'});
  await assert.rejects(a.call('avatarUpdate',{...value,revision:state.revision,character:{...defaults,skin:'<script>'}}),{code:'INVALID_ARGUMENT'});
  await assert.rejects(a.call('avatarUpdate',{...value,revision:state.revision,character:{...defaults,outfit:'sakura'}}),{code:'PERMISSION_DENIED'});
  await db.doc('rewardEntitlements/'+a.uid).set({grants:{'shop-sakura':{source:'shop'}}});
  const look={...defaults,outfit:'sakura',headwear:'sakura'};state=await a.call('avatarUpdate',{avatar:'character',character:look,revision:state.revision});
  await a.call('updateProfile',{displayName:'AvatarOwner',avatar:'character',character:look,avatarRevision:state.revision,timeZone:'UTC'});
  const profile=(await b.call('lookup',{code:(await a.call('state')).code})).profile;assert.equal(profile.character.outfit,'sakura');assert.equal(profile.revision,undefined);assert.equal(profile.accountPhoto,undefined);
  await db.doc('rewardEntitlements/'+a.uid).set({grants:{'shop-sakura':{revoked:true}}});
  assert.equal((await b.call('lookup',{code:(await a.call('state')).code})).profile.character.outfit,'everyday');
  state=await a.call('avatarState');assert.equal(state.character.headwear,'none');
  await a.call('updateProfile',{displayName:'AvatarOwner',avatar:'emoji:🦊',timeZone:'UTC'});assert.equal((await a.call('avatarState')).avatar,'emoji:🦊');
  await db.doc('accountDeletions/'+a.uid).set({state:'committing'});await assert.rejects(a.call('avatarState'),{code:'UNAUTHENTICATED'});
});
test('pants and dyes enforce ownership, remain compatible with older clients and survive name-only edits',async()=>{
  const a=await learner('NewWardrobe'),chars=require('../functions/shared/mode-atlas-avatar-rules.js');
  let current=await a.call('avatarState',{characterVersion:2});assert.equal(current.character.version,2);assert.equal(current.character.pants,'classic');
  const update=look=>a.call('avatarUpdate',{avatar:'character',character:look,revision:current.revision});
  for(const look of [{...chars.defaults,pants:'pinstripe'},{...chars.defaults,pants:'trail'},{...chars.defaults,hairColor:'rose-gold'}])await assert.rejects(update(look),{code:'PERMISSION_DENIED'});
  await db.doc('rewardEntitlements/'+a.uid).set({grants:{'shop-pinstripe':{source:'shop'},'shop-rose-gold':{source:'shop'},'shop-evergreen':{source:'shop'}}});
  current=await update({...chars.defaults,pants:'pinstripe',hairColor:'rose-gold'});
  const older=await a.call('avatarState');assert.equal(older.character.version,1);assert.equal(older.character.pants,undefined);assert.equal(older.character.hairColor,'rose');
  await a.call('avatarUpdate',{avatar:'character',character:{...older.character,hair:'bob'},revision:older.revision});
  current=await a.call('avatarState',{characterVersion:2});assert.equal(current.character.pants,'pinstripe');assert.equal(current.character.hairColor,'rose-gold');assert.equal(current.character.hair,'bob');
  await a.call('updateProfile',{displayName:'NewWardrobeName',timeZone:'UTC'});const renamed=await a.call('avatarState',{characterVersion:2});assert.deepEqual(renamed.character,current.character);current=renamed;
  current=await update({...current.character,pants:'evergreen'});assert.equal(current.character.pants,'evergreen');
  await db.doc('rewardEntitlements/'+a.uid).set({grants:{}});current=await a.call('avatarState',{characterVersion:2});assert.equal(current.character.pants,'classic');assert.equal(current.character.hairColor,'espresso');
  const revoked=await a.call('avatarState');await a.call('avatarUpdate',{avatar:'character',character:{...revoked.character,hair:'sweep'},revision:revoked.revision});current=await a.call('avatarState',{characterVersion:2});assert.equal(current.character.pants,'classic');assert.equal(current.character.hairColor,'espresso');
});
test('avatar messages are bounded, friends-only, preserved by old edits and available as moderation evidence',async()=>{
  const a=await learner('GreetingOwner'),b=await learner('GreetingFriend');
  for(const person of [a,b])await person.call('weeklyPreference',{enabled:true});
  const message='A little progress every day! 🌱';await a.call('updateProfile',{displayName:'GreetingOwner',timeZone:'UTC',greeting:message});
  for(const greeting of ['x'.repeat(121),'<img onerror=alert(1)>','hello\u202eworld',42])await assert.rejects(a.call('updateProfile',{displayName:'GreetingOwner',timeZone:'UTC',greeting}),{code:'INVALID_ARGUMENT'});
  assert.equal((await b.call('lookup',{code:a.code})).profile.greeting,undefined);
  let shown=await b.call('profile',{uid:a.uid});assert.equal(shown.profile.greeting,undefined);assert.equal(shown.profile.character.version,3);assert.equal(shown.profile.stats,undefined);
  await b.call('sendRequest',{uid:a.uid});assert.equal((await b.call('profile',{uid:a.uid})).profile.greeting,undefined);await a.call('accept',{uid:b.uid});
  assert.equal((await b.call('profile',{uid:a.uid})).profile.greeting,message);
  await a.call('updateProfile',{displayName:'GreetingChanged',timeZone:'UTC'});assert.equal((await b.call('profile',{uid:a.uid})).profile.greeting,message);
  await b.call('reportProfile',{uid:a.uid,reason:'greeting',note:'Message review'});
  const report=(await db.collection('socialReports').where('target','==',a.uid).get()).docs[0].data();assert.equal(report.snapshot.greeting,message);
  await a.call('updateProfile',{displayName:'GreetingChanged',timeZone:'UTC',greeting:''});assert.equal((await b.call('profile',{uid:a.uid})).profile.greeting,undefined);
  await a.call('updateProfile',{displayName:'GreetingChanged',timeZone:'UTC',greeting:message});await b.call('remove',{uid:a.uid});assert.equal((await b.call('profile',{uid:a.uid})).profile.greeting,undefined);
});
test('simultaneous avatar edits use revisions and account deletion removes the private character',async()=>{
  const a=await learner('AvatarRace'),defaults=require('../functions/shared/mode-atlas-avatar-rules.js').defaults,state=await a.call('avatarState');
  const results=await Promise.allSettled(['crop','bob'].map(hair=>a.call('avatarUpdate',{avatar:'character',character:{...defaults,hair},revision:state.revision})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'ABORTED');
  await a.call('deleteAccount');assert.equal((await db.doc('avatarProfiles/'+a.uid).get()).exists,false);
});

test('name-only Friends edits preserve the canonical character and new wardrobe access is enforced',async()=>{
  const a=await learner('WardrobeOwner'),b=await learner('WardrobeViewer'),defaults=require('../functions/shared/mode-atlas-avatar-rules.js').defaults;
  let state=await a.call('avatarState');
  const select=character=>a.call('avatarUpdate',{avatar:'character',character,revision:state.revision});
  await db.doc('rewardEntitlements/'+a.uid).set({grants:{'shop-curtains':{},'shop-crewneck':{}}});
  state=await select({...defaults,hair:'curtains',skin:'ivory',outfit:'crewneck'});
  await a.call('updateProfile',{displayName:'WardrobeRenamed',timeZone:'UTC'});
  assert.deepEqual((await a.call('avatarState',{characterVersion:3})).character,state.character);
  assert.deepEqual((await b.call('lookup',{code:a.code})).profile.character,state.character);
  for(const character of [{...defaults,hair:'textured-fade'},{...defaults,hair:'ribbon-waves'},{...defaults,outfit:'varsity'},{...defaults,outfit:'hunny'},{...defaults,headwear:'hunny'},{...defaults,accessory:'hunny'}]){
    state=await a.call('avatarState');await assert.rejects(select(character),{code:'PERMISSION_DENIED'});
  }
  await db.doc('commerceAccounts/'+a.uid).set({version:1,currency:'atlas-tokens',balance:500});
  await a.call('shopPurchase',{requestId:crypto.randomUUID(),productId:'textured-fade',coinPrice:catalogue.item('textured-fade').coinPrice,timeZone:'UTC'});
  state=await select({...defaults,hair:'textured-fade'});
  await db.doc('shopCatalogue/current').set({offers:{'textured-fade':{enabled:false}}});
  try{state=await select({...defaults,hair:'textured-fade',skin:'apricot'});assert.equal(state.character.hair,'textured-fade');}
  finally{await db.doc('shopCatalogue/current').delete();}
  await db.doc('rewardEntitlements/'+a.uid).set({grants:{'shop-textured-fade':{revoked:true}}});
  assert.equal((await b.call('lookup',{code:a.code})).profile.character.hair,'sweep');
});

test('moderation preserves the reported character and members cannot read the report queue',async()=>{
  const a=await learner('AvatarReported'),b=await learner('AvatarReporter');
  const defaults=require('../functions/shared/mode-atlas-avatar-rules.js').defaults;
  const avatar=await a.call('avatarState'),original={...defaults,hair:'coils',outfit:'linen'};
  const saved=await a.call('avatarUpdate',{avatar:'character',character:original,revision:avatar.revision});
  await b.call('reportProfile',{uid:a.uid,reason:'avatar',note:'Please review this look.',code:a.code});
  await a.call('avatarUpdate',{avatar:'character',character:{...defaults,hair:'crop'},revision:saved.revision});
  await assert.rejects(b.call('listReports'),{code:'PERMISSION_DENIED'});
  let cursor,report;
  do{
    const result=await service.call({auth:{uid:'legacy-admin'},data:{action:'listReports',data:cursor?{cursor}:{},expectedUid:'legacy-admin'}});
    report=result.rows.find(row=>row.target===a.uid);cursor=result.nextCursor;
  }while(!report&&cursor);
  assert.ok(report);
  assert.deepEqual(report.snapshot.character,original);assert.equal(report.current.character.hair,'crop');
  assert.equal(report.reporter,undefined);assert.ok(!JSON.stringify(report).includes(a.email));
});

test('Hunny offers require eligibility and separate priced purchases, with atomic retries and revocation',async()=>{
  const a=await learner('HunnyEligible'),b=await learner('HunnyOther');
  const defaults=require('../functions/shared/mode-atlas-avatar-rules.js').defaults;
  await db.doc('rewardEntitlements/'+a.uid).set({grants:{'hunny-tester':{}}});
  await db.doc('commerceAccounts/'+a.uid).set({version:1,currency:'atlas-tokens',balance:30});
  const before=await a.call('shop',{version:2,timeZone:'UTC'});
  assert.deepEqual(before.offers.filter(p=>p.id.startsWith('hunny-')).map(p=>p.coinPrice),[15,15]);
  assert.equal((await b.call('shop',{version:2,timeZone:'UTC'})).offers.some(p=>p.id.startsWith('hunny-')),false);
  for(const id of ['hunny-jumper','hunny-pendant'])await assert.rejects(b.call('shopPurchase',{requestId:crypto.randomUUID(),productId:id,coinPrice:catalogue.item(id).coinPrice,timeZone:'UTC'}),{code:'FAILED_PRECONDITION'});
  let avatar=await a.call('avatarState');
  await assert.rejects(a.call('avatarUpdate',{avatar:'character',character:{...defaults,outfit:'hunny'},revision:avatar.revision}),{code:'PERMISSION_DENIED'});
  const buy={requestId:crypto.randomUUID(),productId:'hunny-jumper',coinPrice:catalogue.item('hunny-jumper').coinPrice,timeZone:'UTC'};
  await a.call('shopPurchase',buy);assert.equal((await a.call('shopPurchase',buy)).balance,before.balance-15);
  await a.call('shopPurchase',{...buy,requestId:crypto.randomUUID(),productId:'hunny-pendant'});
  avatar=await a.call('avatarUpdate',{avatar:'character',character:{...defaults,outfit:'hunny',accessory:'hunny',headwear:'hunny'},revision:avatar.revision});
  assert.equal(avatar.character.outfit,'hunny');assert.equal(avatar.character.accessory,'hunny');
  await db.doc('shopCatalogue/current').set({offers:{'hunny-jumper':{enabled:false}}});
  try{assert.equal((await a.call('avatarState')).character.outfit,'hunny');}
  finally{await db.doc('shopCatalogue/current').delete();}
  await db.doc('rewardEntitlements/'+a.uid).set({grants:{'hunny-tester':{revoked:true},'shop-hunny-jumper':{},'shop-hunny-pendant':{}}});
  assert.equal((await a.call('avatarState')).character.outfit,'everyday');
  assert.equal((await b.call('lookup',{code:a.code})).profile.character.accessory,'none');
});

test('weekly coins migrate a legacy wallet, keep purchases and do not backfill settled prizes',async()=>{
  const {createWeekly}=require('../functions/weekly.cjs'),policy=require('../functions/shared/mode-atlas-weekly-rules.js');
  let at=Date.parse('2098-04-03T12:00:00Z');const weekly=createWeekly({db,now:()=>at}),period=policy.period(at);
  const a=await learner('LegacyWinner',0),b=await learner('LegacyRunner',0);
  await db.doc('commerceAccounts/'+a.uid).set({version:1,currency:'atlas-tokens',balance:250,purchases:{sakura:{at:1,price:500}}});
  await db.doc('weeklyCompetitions/'+period.id).set({...period,settled:false});
  for(const [p,score]of [[a,200],[b,100]]){await weekly.preference(p.uid,{enabled:true});await db.doc(`weeklyCompetitions/${period.id}/entries/${p.uid}`).set({uid:p.uid,active:true,score,days:{}});}
  at=period.endAt+300001;await Promise.all([weekly.settle(period.id),weekly.settle(period.id)]);
  let w=(await db.doc('commerceAccounts/'+a.uid).get()).data();
  assert.equal(w.version,3);assert.equal(w.currency,'atlas-coins');assert.equal(w.balance-w.levelRewards.total,350);assert.deepEqual(w.purchases,{sakura:{at:1,price:500}});
  const past=policy.period(period.startAt-86400000);await db.doc('weeklyCompetitions/'+past.id).set({...past,settled:true});
  await db.doc(`weeklyCompetitions/${past.id}/awards/${a.uid}`).set({xp:500,rank:1,week:past.id});
  await weekly.settle(past.id);assert.equal((await db.doc(`commerceAccounts/${a.uid}/operations/weekly-v1-${past.id}`).get()).exists,false);
});


test('weekly profile requests require both opt-ins, retain private stats until acceptance and are idempotent',async()=>{
  const a=await learner('ForestWalker'),b=await learner('ForestReader');
  await assert.rejects(a.call('sendRequest',{uid:b.uid}),{code:'NOT_FOUND'});
  await a.call('weeklyPreference',{enabled:true});
  await assert.rejects(a.call('sendRequest',{uid:b.uid}),{code:'NOT_FOUND'});
  await b.call('weeklyPreference',{enabled:true});
  let preview=await a.call('profile',{uid:b.uid});assert.equal(preview.canRequest,true);assert.equal(preview.relationship,'none');assert.equal(preview.profile.stats,undefined);
  await assert.rejects(a.call('sendRequest',{uid:a.uid}),{code:'INVALID_ARGUMENT'});
  await assert.rejects(a.call('sendRequest',{uid:b.uid,code:b.code}),{code:'INVALID_ARGUMENT'});
  await assert.rejects(a.call('sendRequest',{}),{code:'INVALID_ARGUMENT'});
  await Promise.all([a.call('sendRequest',{uid:b.uid}),a.call('sendRequest',{uid:b.uid})]);
  preview=await a.call('profile',{uid:b.uid});assert.equal(preview.relationship,'outgoing');assert.equal(preview.canRequest,false);assert.equal(preview.profile.stats,undefined);
  assert.equal((await b.call('profile',{uid:a.uid})).relationship,'incoming');
  await b.call('sendRequest',{uid:a.uid});assert.equal((await b.call('state')).counts.incoming,1);
  await b.call('accept',{uid:a.uid});preview=await a.call('profile',{uid:b.uid});assert.equal(preview.relationship,'friend');assert.equal(preview.friend,true);assert.ok(preview.profile.stats);
  assert.equal((await a.call('state')).counts.friends,1);
});

test('weekly UID requests respect blocks, restriction, opt-out and the shared lookup rate limit',async()=>{
  const a=await learner('RequestSender'),b=await learner('RequestReceiver');
  for(const user of [a,b])await user.call('weeklyPreference',{enabled:true});
  await b.call('block',{uid:a.uid});await assert.rejects(a.call('sendRequest',{uid:b.uid}),{code:'NOT_FOUND'});
  await assert.rejects(b.call('sendRequest',{uid:a.uid}),{code:'NOT_FOUND'});await b.call('unblock',{uid:a.uid});
  await db.doc('socialAccounts/'+b.uid).update({restricted:true});await assert.rejects(a.call('sendRequest',{uid:b.uid}),{code:'NOT_FOUND'});
  await db.doc('socialAccounts/'+b.uid).update({restricted:false});await b.call('weeklyPreference',{enabled:false});
  await assert.rejects(a.call('sendRequest',{uid:b.uid}),{code:'NOT_FOUND'});await b.call('weeklyPreference',{enabled:true});
  await db.doc('socialLimits/'+a.uid).delete();
  for(let i=0;i<6;i++){await a.call('lookup',{code:b.code});await a.call('sendRequest',{uid:b.uid});}
  await assert.rejects(a.call('sendRequest',{uid:b.uid}),{code:'RESOURCE_EXHAUSTED'});
  assert.equal((await b.call('state')).counts.incoming,1);
});

test('repair policy covers one to three missed days and expires after seven calendar days without penalising resumed study',()=>{
  const {repairGap}=require('../functions/commerce.cjs'),w={covered:{}};
  assert.deepEqual(repairGap(w,['2026-10-01','2026-10-02','2026-10-06'],'2026-10-07'),{days:['2026-10-03','2026-10-04','2026-10-05'],expiresOn:'2026-10-12'});
  assert.equal(repairGap(w,['2026-10-01','2026-10-02'],'2026-10-07'),null);
  const resumed=['2026-10-01',...Array.from({length:7},(_,i)=>`2026-10-${String(i+3).padStart(2,'0')}`)];
  assert.deepEqual(repairGap(w,resumed,'2026-10-09'),{days:['2026-10-02'],expiresOn:'2026-10-09'});
  assert.equal(repairGap(w,resumed,'2026-10-10'),null);
  assert.equal(repairGap(w,[],'2026-10-07'),null);
  assert.equal(repairGap(w,['2026-10-07'],'2026-10-07'),null);
  assert.equal(repairGap({covered:{'2026-10-05':{},'2026-10-06':{}}},[],'2026-10-07'),null);
});

test('one repair bridges three dates atomically; partial and complete offline catch-up never duplicate the item',async()=>{
  const a=await learner('LongRepair'),{createCommerce}=require('../functions/commerce.cjs'),timeZone='UTC';
  const commerce=createCommerce({db,now:()=>Date.parse('2026-10-07T12:00:00Z')}),user=await auth.getUser(a.uid);
  const ref=db.doc('commerceAccounts/'+a.uid),saveRef=db.doc('users/'+a.uid+'/appData/kanaTrainer');
  const studied=days=>{const data=save(100);data.sections.reading.data.dailyChallengeHistory=Object.fromEntries(days.map(day=>[day,{}]));return data;};
  const original=['2026-10-01','2026-10-02','2026-10-06','2026-10-07'];
  await saveRef.set(studied(original));await ref.set({version:1,currency:'atlas-tokens',balance:1000});
  await commerce.run(user,'shopPurchase',{requestId:crypto.randomUUID(),productId:'streak-repair',coinPrice:catalogue.item('streak-repair').coinPrice,timeZone});
  const request={requestId:crypto.randomUUID(),productId:'streak-repair',timeZone};
  await Promise.all([commerce.run(user,'shopUse',request),commerce.run(user,'shopUse',request)]);
  const state=()=>commerce.run(user,'shop',{version:2,timeZone});let result=await state();
  assert.equal(result.inventory['streak-repair'],0);assert.deepEqual(result.protection,['2026-10-03','2026-10-04','2026-10-05']);
  const record=(await ref.get()).data();assert.equal(new Set(Object.values(record.covered).map(entry=>entry.unit.id)).size,1);
  assert.deepEqual((await saveRef.get()).data(),studied(original));
  await saveRef.set(studied([...original,'2026-10-03']));result=await state();assert.equal(result.inventory['streak-repair'],0);assert.deepEqual(result.protection,['2026-10-04','2026-10-05']);
  await saveRef.set(studied([...original,'2026-10-03','2026-10-04','2026-10-05']));result=await state();assert.equal(result.inventory['streak-repair'],1);assert.deepEqual(result.protection,[]);
  result=await state();assert.equal(result.inventory['streak-repair'],1);const balance=result.balance;
  await commerce.run(user,'shopUse',request);result=await state();assert.equal(result.inventory['streak-repair'],1);assert.equal(result.balance,balance);
});

test('pets and coloured dresses enforce ownership, survive older saves and revoke cleanly',async()=>{
  const a=await learner('PetOwner'),chars=require('../functions/shared/mode-atlas-avatar-rules.js');
  let current=await a.call('avatarState',{characterVersion:3});
  const update=character=>a.call('avatarUpdate',{avatar:'character',character,revision:current.revision});
  for(const item of [{pet:'shiba'},{pet:'japanese-spitz'},{outfit:'meadow-dress'},{outfit:'seigaiha-kimono'},{pants:'starfall-skirt'}])await assert.rejects(update({...chars.defaults,...item}),{code:'PERMISSION_DENIED'});
  await db.doc('rewardEntitlements/'+a.uid).set({grants:{'shop-japanese-spitz':{},'shop-seigaiha-kimono':{},'shop-starfall-skirt':{}}});
  current=await update({...chars.defaults,pet:'japanese-spitz',petName:'雪',outfit:'seigaiha-kimono',outfitColor:'navy',pants:'starfall-skirt',pantsColor:'plum'});
  for(const version of [1,2]){
    const older=await a.call('avatarState',{characterVersion:version});assert.equal(older.character.pet,undefined);assert.equal(older.character.outfit,'everyday');
    await a.call('avatarUpdate',{avatar:'character',character:{...older.character,hair:'bob',outfitColor:'coral'},revision:older.revision});
    current=await a.call('avatarState',{characterVersion:3});assert.equal(current.character.petName,'雪');assert.equal(current.character.outfit,'seigaiha-kimono');assert.equal(current.character.pants,'starfall-skirt');assert.equal(current.character.pantsColor,'plum');
  }
  for(const petName of ['<script>','x'.repeat(25),'fuck'])await assert.rejects(update({...current.character,petName}),{code:'INVALID_ARGUMENT'});
  await assert.rejects(a.call('avatarUpdate',{revision:current.revision,petNames:{'moon-fox':'Silver'}}),{code:'PERMISSION_DENIED'});
  await assert.rejects(a.call('avatarUpdate',{revision:current.revision,petNames:{'japanese-spitz':'<script>'}}),{code:'INVALID_ARGUMENT'});
  current=await a.call('avatarUpdate',{revision:current.revision,character:current.character,petNames:{'japanese-spitz':'雪'}});assert.equal(current.petNames['japanese-spitz'],'雪');
  await assert.rejects(update({...current.character,outfitColor:'coral'}),{code:'INVALID_ARGUMENT'});
  await db.doc('shopCatalogue/current').set({offers:{'japanese-spitz':{enabled:false}}});
  try{current=await update({...current.character,petName:'Snow'});assert.equal(current.character.pet,'japanese-spitz');}finally{await db.doc('shopCatalogue/current').delete();}
  await db.doc('rewardEntitlements/'+a.uid).set({grants:{}});current=await a.call('avatarState',{characterVersion:3});assert.equal(current.character.pet,'none');assert.equal(current.character.petName,'');assert.deepEqual(current.petNames,{});
  current=await update(current.character);assert.equal(current.character.outfit,'everyday');
});
test('avatar identity edits are atomic, unique and private until Friends opt-in',async()=>{
  const a=await learner('UnifiedOwner'),b=await learner('UnifiedTaken'),chars=require('../functions/shared/mode-atlas-avatar-rules.js');
  const current=await a.call('avatarState',{characterVersion:3});
  await assert.rejects(a.call('avatarUpdate',{revision:current.revision,character:{...chars.defaults,hair:'bob'},displayName:'UnifiedTaken'}),{code:'ALREADY_EXISTS'});
  assert.equal((await a.call('avatarState',{characterVersion:3})).revision,current.revision);
  const next=await a.call('avatarUpdate',{revision:current.revision,character:{...chars.defaults,hair:'bob'},displayName:'UnifiedNew',greeting:'Hello, friends!'});
  const preview=(await b.call('lookup',{code:a.code})).profile;assert.equal(preview.displayName,'UnifiedNew');assert.equal(preview.greeting,undefined);assert.equal(preview.petNames,undefined);
  await b.call('sendRequest',{code:a.code});await a.call('accept',{uid:b.uid});assert.equal((await b.call('profile',{uid:a.uid})).profile.greeting,'Hello, friends!');
  await a.call('leave');const privateState=await a.call('avatarState',{characterVersion:3});
  await a.call('avatarUpdate',{revision:privateState.revision,character:next.character,displayName:'PrivateName',greeting:'Saved for later'});assert.equal((await a.call('state')).active,false);
  await a.call('updateProfile',{displayName:'PrivateName',timeZone:'UTC'});assert.equal((await a.call('state')).preferences.greeting,'Saved for later');
  await db.doc('socialRestrictions/'+a.uid).set({restricted:true});const locked=await a.call('avatarState',{characterVersion:3});
  await assert.rejects(a.call('avatarUpdate',{revision:locked.revision,displayName:'AnotherName'}),{code:'PERMISSION_DENIED'});
});
test('verified tester receives Shiro once, with no client email authority or forced re-equipping',async()=>{
  const a=await learner('SpitzTester'),chars=require('../functions/shared/mode-atlas-avatar-rules.js');
  await auth.updateUser(a.uid,{email:'evelyn.chelsea24@gmail.com',emailVerified:true});
  let current=await a.call('avatarState',{characterVersion:3});assert.equal(current.character.pet,'japanese-spitz');assert.equal(current.character.petName,'Shiro');
  assert.ok((await a.call('rewards')).grants.includes('shop-japanese-spitz'));
  const revision=current.revision;assert.equal((await a.call('avatarState',{characterVersion:3})).revision,revision);
  current=await a.call('avatarUpdate',{revision,character:{...chars.defaults,pet:'none'}});assert.equal((await a.call('avatarState',{characterVersion:3})).character.pet,'none');assert.equal(current.petNames['japanese-spitz'],'Shiro');
  await db.doc('rewardEntitlements/'+a.uid).set({grants:{'shop-japanese-spitz':{revoked:true}}});assert.ok(!(await a.call('rewards')).grants.includes('shop-japanese-spitz'));
  await auth.updateUser(a.uid,{email:a.email});
});

test('two currencies debit independently and reject mixed, stale and repeated payments',async()=>{
  const a=await learner('TwoWallets',0),ref=db.doc('commerceAccounts/'+a.uid),timeZone='UTC';
  await ref.set({version:3,currency:'atlas-coins',balance:1000,tokenBalance:10000});
  const initial=await a.call('shop',{version:3,timeZone});assert.equal(initial.tokenBalance,10000);
  const item=catalogue.item('quiff'),pay={requestId:crypto.randomUUID(),productId:item.id,currency:'study-tokens',price:item.tokenPrice,timeZone};
  const bought=await Promise.all([a.call('shopPurchase',pay),a.call('shopPurchase',pay)]);
  for(const wallet of bought){assert.equal(wallet.balance,1000);assert.equal(wallet.tokenBalance,9700);assert.ok(wallet.owned.includes(item.id));}
  await assert.rejects(a.call('shopPurchase',{...pay,currency:'atlas-coins',price:item.coinPrice}),{code:'INVALID_ARGUMENT'});
  await assert.rejects(a.call('shopPurchase',{...pay,requestId:crypto.randomUUID(),currency:'atlas-coins',price:item.coinPrice}),{code:'ALREADY_EXISTS'});
  for(const patch of [{productId:'sakura',price:1},{productId:'crewneck',price:1},{productId:'crewneck',currency:'forged'},{productId:'crewneck',coinPrice:90}])await assert.rejects(a.call('shopPurchase',{...pay,requestId:crypto.randomUUID(),...patch}));
  let state=await a.call('shop',{version:3,timeZone});assert.equal(state.balance,1000);assert.equal(state.tokenBalance,9700);
  state=await a.call('shopPurchase',{...pay,requestId:crypto.randomUUID(),productId:'sakura',currency:'atlas-coins',price:catalogue.item('sakura').coinPrice});
  assert.equal(state.balance,250);assert.equal(state.tokenBalance,9700);
  const mine=verifiedContext(a.uid).firestore();await assertFails(setDoc(doc(mine,'commerceAccounts/'+a.uid),{tokenBalance:999999}));
  await a.call('leave');assert.equal((await a.call('shop',{version:3,timeZone})).tokenBalance,9700);
});

test('Study Tokens use private verified evidence and preserve existing balances across retries and personal resets',async()=>{
  const a=await learner('StudyEarnings',0),user=await auth.getUser(a.uid),ref=db.doc('commerceAccounts/'+a.uid),saved=db.doc('users/'+a.uid+'/appData/kanaTrainer');
  const {createCommerce}=require('../functions/commerce.cjs'),commerce=createCommerce({db,now:()=>Date.parse('2026-10-15T12:00:00Z')}),state=()=>commerce.run(user,'shop',{version:3,timeZone:'UTC'});
  await ref.set({version:2,currency:'atlas-coins',balance:333,levelRewards:{version:1,throughLevel:12,total:320}});
  const data=save(80);data.sections.progress.data.state.version=5;data.sections.progress.data.state.credits={device:{answer:0}};
  data.sections.reading.data.dailyChallengeHistory=Object.fromEntries([...Array.from({length:8},(_,i)=>`2026-10-${String(i+1).padStart(2,'0')}`),'2099-01-01'].map(day=>[day,{}]));
  await saved.set(data);await seedEarned(a.uid,data);let first=await state();assert.equal(first.balance,333);assert.equal(first.tokenRewards.answers,10);assert.equal(first.tokenRewards.streaks,85);
  data.sections.progress.data.state.credits.device.answer=240;await saved.set(data);assert.equal((await state()).tokenBalance,first.tokenBalance,'forged save credits do not affect the wallet');await seedEarned(a.uid,data);const broad=await state();assert.equal(broad.tokenRewards.answers,40);assert.ok(broad.tokenBalance>=first.tokenBalance+30);assert.equal(broad.balance,333);
  assert.equal(broad.tokenRewards.levels,catalogue.studyTokens.levelTotal(require('../functions/projection.cjs').levelFromSave(data)));
  const before=broad.tokenBalance;await saved.set(save(0));assert.equal((await state()).tokenBalance,before);await saved.set(data);
  const retries=await Promise.all([state(),state(),state()]);for(const value of retries)assert.equal(value.tokenBalance,before);
  data.sections.progress.data.state.credits.device.completion=500;await saved.set(data);const completion=await state();assert.equal(completion.tokenRewards.answers,40);
});

test('wardrobe migration keeps eligible equipped items and gifts, respects revocations and runs only once',async()=>{
  const a=await learner('EquippedMigration',10000),chars=require('../functions/shared/mode-atlas-avatar-rules.js'),ref=db.doc('rewardEntitlements/'+a.uid);
  const look={...chars.defaults,hair:'curtains',outfit:'grove',pet:'shiba',petName:'Mochi',accessory:'trail-scarf'};
  await db.doc('avatarProfiles/'+a.uid).set({version:1,revision:1,avatar:'character',character:look});
  await ref.set({grants:{'shop-sakura':{source:'shop'},'shop-japanese-spitz':{source:'gift'},'shop-trail-scarf':{revoked:true}}});
  const access=await a.call('rewards');for(const grant of ['shop-curtains','shop-grove','shop-shiba','shop-sakura','shop-japanese-spitz'])assert.ok(access.grants.includes(grant),grant);
  assert.ok(!access.grants.includes('shop-trail-scarf'));assert.ok(!access.grants.includes('shop-calico'));
  assert.equal((await ref.get()).data().grants['shop-shiba'].source,'equipped-migration');
  await db.doc('avatarProfiles/'+a.uid).update({character:{...look,pet:'crane',hair:'quiff'}});await a.call('rewards');
  const after=(await ref.get()).data();assert.equal(after.wardrobeMigration,1);assert.equal(after.grants['shop-quiff'],undefined);assert.equal(after.grants['shop-crane'],undefined);
  const fresh=await learner('StarterWardrobe',0);assert.deepEqual((await fresh.call('rewards')).grants,[]);
});

test('owned profile themes are public while learning stats stay private and revocation removes the theme',async()=>{
  const a=await learner('ThemeOwner'),b=await learner('ThemeVisitor');for(const user of [a,b])await user.call('weeklyPreference',{enabled:true});
  await db.doc('rewardEntitlements/'+a.uid).set({grants:{'shop-evergreen':{source:'shop'}}});
  const data=save(20);data.sections.progress.data.state.appearance={theme:'evergreen',themeAt:100};await db.doc('users/'+a.uid+'/appData/kanaTrainer').set(data);await a.call('state');
  let result=await b.call('profile',{uid:a.uid});assert.equal(result.profile.theme,'evergreen');assert.equal(result.profile.stats,undefined);assert.equal(result.profile.tokenBalance,undefined);
  await friend(a,b);result=await b.call('profile',{uid:a.uid});assert.equal(result.profile.theme,'evergreen');assert.equal(result.profile.stats.xp,20);
  await db.doc('rewardEntitlements/'+a.uid).set({grants:{'shop-evergreen':{revoked:true}}});assert.equal((await b.call('profile',{uid:a.uid})).profile.theme,'');
});

test('Kanji weekly receipts enforce level gates, dictionary answers and idempotent rewards',async()=>{
  const {createWeekly}=require('../functions/weekly.cjs');let at=Date.parse('2097-10-15T12:00:00Z');const weekly=createWeekly({db,now:()=>at}),a=await learner('Kanji Receipts',0);
  await weekly.preference(a.uid,{enabled:true});
  const config={id:'kanji-meaning-run',branch:'kanji',pool:['水','火','木','土','日'],direction:'meaning',mode:'guided',hints:false};
  const band=require('../functions/shared/mode-atlas-kanji-curriculum.js');
  await assert.rejects(weekly.start(a.uid,{...config,id:'kanji-locked-run',pool:[[...band[1].chars][0]]}),{code:'failed-precondition'});
  await assert.rejects(weekly.start(a.uid,{...config,branch:'unknown'}),{code:'invalid-argument'});
  await assert.rejects(weekly.start(a.uid,{...config,pool:['あ']}),{code:'invalid-argument'});
  const run=await weekly.start(a.uid,config);at+=5000;
  const answers=[{index:1,kana:'水',answer:'water',elapsed:500},{index:2,kana:'火',answer:'water',elapsed:1000},{index:3,kana:'木',answer:'tree',elapsed:1500}];
  assert.equal((await weekly.submit(a.uid,{token:run.token,answers})).earned,4);
  assert.equal((await weekly.submit(a.uid,{token:run.token,answers})).earned,0);
  await assert.rejects(weekly.submit(a.uid,{token:run.token,answers:[{index:4,kana:'水',answer:'water',elapsed:2000,correct:true}]}),{code:'invalid-argument'});
  const pronunciation=await weekly.start(a.uid,{...config,id:'kanji-reading-run',direction:'pronunciation'});at+=1000;
  assert.equal((await weekly.submit(a.uid,{token:pronunciation.token,answers:[{index:1,kana:'水',answer:'mizu',elapsed:500}]})).earned,2);
  const match=await weekly.start(a.uid,{...config,id:'kanji-matching-run',direction:'match',hints:true});at+=1000;
  assert.equal((await weekly.submit(a.uid,{token:match.token,answers:[answers[0]]})).earned,1);
  const completions=Object.fromEntries([...band[0].chars].map(char=>[char,at]));await db.doc(`users/${a.uid}/appData/kanaTrainer`).set({sections:{kanji:{data:{state:{version:1,completions,sources:{},evidence:{encoding:'gzip-base64-v1',data:'unused-by-competition'}}}}}},{merge:true});
  assert.equal((await weekly.start(a.uid,{...config,id:'kanji-unlocked-run',pool:[[...band[1].chars][0]]})).enabled,true);
});

test('ordinary Friends reads use the public projection without loading private learning history',async()=>{
  // Keep the first-use identity migration fixture ahead of account creation.
  const a=await learner('Projection Reader');await a.call('state');
  const reads=[];
  const tracked=new Proxy(db,{get(target,key){
    if(key==='doc')return path=>{reads.push(path);return target.doc(path);};
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
  const isolated=createSocial({db:tracked,auth});
  const result=await isolated.call({auth:{uid:a.uid,token:{auth_time:Math.floor(Date.now()/1000)}},data:{expectedUid:a.uid,action:'state',data:{listKind:'friends'}}});
  assert.equal(result.active,true);assert.equal(result.list.rows.length,0);
  assert.equal(reads.some(path=>path===`users/${a.uid}/appData/kanaTrainer`),false);
});

test('a 100-friend list fetches one display page rather than every private or public profile',async()=>{
  const a=await learner('PageBudget'),template=(await db.doc('socialAccounts/'+a.uid).get()).data(),friends={};
  const batch=db.batch();
  for(let i=0;i<100;i++){const uid='page-budget-'+String(i).padStart(3,'0');friends[uid]=1;batch.set(db.doc('socialAccounts/'+uid),{...template,profile:{...template.profile,displayName:'Page Learner '+i},friends:{[a.uid]:1}});}
  batch.update(db.doc('socialAccounts/'+a.uid),{friends});await batch.commit();
  const reads=[];
  const tracked=new Proxy(db,{get(target,key){if(key==='getAll')return async(...refs)=>{reads.push(...refs.map(r=>r.path));return target.getAll(...refs);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
  const bounded=createSocial({db:tracked,auth});const result=await bounded.call({auth:{uid:a.uid,token:{auth_time:Math.floor(Date.now()/1000)}},data:{expectedUid:a.uid,action:'list',data:{kind:'friends'}}});
  assert.equal(result.rows.length,20);assert.ok(result.nextCursor);assert.ok(reads.filter(name=>name.startsWith('socialAccounts/page-budget-')).length<=20);
  assert.equal(reads.filter(name=>name.startsWith('users/')).length,0);
});

test('verified study receipts credit once and editable progress cannot forge the next wallet award',async()=>{
  const a=await learner('VerifiedReceipt',0),at=Date.now();
  const receipt={id:'verified-receipt-first',startedAt:at-10000,config:{pool:['あ','い'],direction:'reading',mode:'guided',hints:false},answers:[{index:1,kana:'あ',answer:'a',elapsed:1000},{index:2,kana:'い',answer:'i',elapsed:2000}],complete:true};
  assert.equal((await a.call('earnStudy',receipt)).index,2);
  const before=(await db.doc('studyEarnings/'+a.uid).get()).data();await a.call('earnStudy',receipt);assert.deepEqual((await db.doc('studyEarnings/'+a.uid).get()).data(),before);
  const first=await a.call('shop',{version:3,timeZone:'UTC'});await db.doc(`users/${a.uid}/appData/kanaTrainer`).set(save(999999));const next=await a.call('shop',{version:3,timeZone:'UTC'});
  assert.equal(next.balance,first.balance);assert.equal(next.tokenBalance,first.tokenBalance);
  await assert.rejects(a.call('earnStudy',{...receipt,id:'forged-receipt',xp:99999}),{code:'INVALID_ARGUMENT'});
});

test('administrator directory is paginated, includes non-social users and never exposes private records',async()=>{
  const uid='directory-private',email='directory-private@example.test';await auth.createUser({uid,email,emailVerified:true,displayName:'Directory Learner'});
  await db.doc(`users/${uid}/appData/kanaTrainer`).set({storageVersion:2,revision:4,generation:0,sections:{wordBank:{data:{items:[{written:'secret-private-word'}]}}}});
  const call=(actor,action,data={})=>service.call({auth:{uid:actor,token:{auth_time:Math.floor(Date.now()/1000),email:'admin@mode-atlas.com',email_verified:true}},data:{action,data,expectedUid:actor}});
  await assert.rejects(call(uid,'adminUsers'),{code:'permission-denied'});await assert.rejects(call(uid,'adminInspect',{uid}),{code:'permission-denied'});
  await db.doc('socialStaff/roles').set({moderators:{[uid]:{at:Date.now(),by:'legacy-admin'}}},{merge:true});
  await assert.rejects(call(uid,'adminUsers'),{code:'permission-denied'});
  await db.doc('socialLimits/legacy-admin').delete();
  const page=await call('legacy-admin','adminUsers');assert.equal(page.rows.length,25);assert.ok(page.nextCursor);
  const next=await call('legacy-admin','adminUsers',{cursor:page.nextCursor});assert.ok(next.rows.length<=25);assert.ok(next.rows.every(row=>!page.rows.some(old=>old.uid===row.uid)));
  const found=await call('legacy-admin','adminUsers',{query:email});assert.equal(found.rows.length,1);assert.equal(found.rows[0].uid,uid);assert.equal(found.rows[0].friends,false);
  assert.deepEqual(Object.keys(found.rows[0]).sort(),['uid','email','displayName','role','verified','disabled','createdAt','lastSignInAt','friends','restricted'].sort());
  const detail=await call('legacy-admin','adminInspect',{uid});assert.equal(detail.save.revision,4);assert.equal(detail.save.version,2);assert.equal(detail.save.sections[0].name,'wordBank');assert.equal(JSON.stringify(detail).includes('secret-private-word'),false);
  assert.equal(JSON.stringify(detail).includes('passwordHash'),false);
  await assert.rejects(call('legacy-admin','adminUsers',{query:email,cursor:page.nextCursor}),{code:'invalid-argument'});
});

test('rules reject unverified users, arbitrary save collections and revoked sessions immediately',async()=>{
  const uid='security-access-rules',at=Math.floor(Date.now()/1000),path='users/'+uid+'/appData/kanaTrainer';
  const old=rules.authenticatedContext(uid,{email_verified:true,auth_time:at}).firestore();
  const unverified=rules.authenticatedContext(uid,{email_verified:false,auth_time:at}).firestore();
  await assertSucceeds(setDoc(doc(old,path),save(1)));await assertFails(getDoc(doc(unverified,path)));
  await assertFails(setDoc(doc(old,'users/'+uid+'/appData/arbitrary'),{}));
  await assertFails(setDoc(doc(old,path+'/parts/section-reading-350'),{text:'{}'}));
  await db.doc('accountAccess/'+uid).set({revokedBefore:at,disabled:false});
  await assertFails(getDoc(doc(old,path)));await assertFails(setDoc(doc(old,path),save(2)));
  const fresh=rules.authenticatedContext(uid,{email_verified:true,auth_time:at+1}).firestore();await assertSucceeds(getDoc(doc(fresh,path)));
  await db.doc('accountAccess/'+uid).update({disabled:true});await assertFails(getDoc(doc(fresh,path)));
});

test('administrator access actions require real authority, recent login, reason and protect owner',async()=>{
  const uid='security-access-target';await auth.createUser({uid,email:uid+'@example.test',emailVerified:true});
  const call=(actor,action,data={},time=Math.floor(Date.now()/1000))=>service.call({auth:{uid:actor,token:{auth_time:time}},data:{action,data,expectedUid:actor}});
  for(const action of ['adminSecurity','adminUsage','adminAccess'])await assert.rejects(call(uid,action,{uid,operation:'suspend',reason:'Testing access'}),{code:'permission-denied'});
  await db.doc('socialLimits/legacy-admin').delete();
  await assert.rejects(call('legacy-admin','adminAccess',{uid,operation:'suspend',reason:'Testing access'},Math.floor(Date.now()/1000)-600));
  await assert.rejects(call('legacy-admin','adminAccess',{uid:'legacy-admin',operation:'suspend',reason:'Testing owner'}),{code:'permission-denied'});
  await assert.rejects(call('legacy-admin','adminAccess',{uid,operation:'suspend',reason:'x'}),{code:'invalid-argument'});
  assert.equal((await call('legacy-admin','adminAccess',{uid,operation:'suspend',reason:'Confirmed test account'})).complete,true);
  assert.equal((await auth.getUser(uid)).disabled,true);assert.equal((await db.doc('accountAccess/'+uid).get()).data().disabled,true);
  await assert.rejects(call(uid,'shop'),{code:'permission-denied'});
  await call('legacy-admin','adminAccess',{uid,operation:'restore',reason:'Restore test account'});assert.equal((await auth.getUser(uid)).disabled,false);
  const events=(await call('legacy-admin','adminSecurity')).audit.filter(row=>row.target===uid);assert.equal(events.length,2);assert.ok(events.every(row=>row.status==='complete'));
});

test('a large partition batch remains atomic under ownership and access rules',async()=>{
  const uid='large-rules-batch',client=verifiedContext(uid).firestore(),path='users/'+uid+'/appData/kanaTrainer';
  const parts=Array.from({length:40},(_,i)=>'section-reading-'+i),batch=require('firebase/firestore').writeBatch(client);
  batch.set(doc(client,path),{storageVersion:2,revision:1,generation:0,sections:{reading:{data:{},storage:{format:'json-parts-v1',parts}}}});
  for(const id of parts)batch.set(doc(client,path+'/parts/'+id),{text:'{}'});
  await assertSucceeds(batch.commit());
  await assertFails(setDoc(doc(client,path+'/parts/section-reading-0'),{text:'changed without a manifest revision'}));
  await assertFails(require('firebase/firestore').deleteDoc(doc(client,path+'/parts/section-reading-0')));
  await assertFails(setDoc(doc(client,path+'/parts/section-writing-0'),{text:'unreferenced'}));
});

test('malformed saves do not loop profile triggers or block inspection and weekly settlement',async()=>{
  const a=await learner('InvalidSave'),other=await learner('ValidWinner'),third=await learner('ValidThird'),at=Date.parse('2026-10-21T12:00:00Z');
  await db.doc('users/'+a.uid+'/appData/kanaTrainer').set({sections:{progress:{data:{},storage:{format:'bad',parts:['section-progress-0']}}}});
  assert.equal(await service.refreshSummary(a.uid),false);
  await db.doc('socialLimits/legacy-admin').delete();
  const inspected=await service.call({auth:{uid:'legacy-admin',token:{auth_time:Math.floor(Date.now()/1000)}},data:{action:'adminInspect',expectedUid:'legacy-admin',data:{uid:a.uid}}});
  assert.ok(inspected.save.problem);assert.equal(inspected.learning,null);
  const {createWeekly}=require('../functions/weekly.cjs'),{createCommerce}=require('../functions/commerce.cjs'),policy=require('../functions/shared/mode-atlas-weekly-rules.js');
  const period=policy.period(at-7*86400000),week=period.id;
  const commerce=createCommerce({db,auth,now:()=>at}),weekly=createWeekly({db,commerce,now:()=>at});
  await db.doc('weeklyCompetitions/'+week).set({startAt:period.startAt,endAt:period.endAt,settled:false,topScores:[500,400,300],resultCount:0,lastScore:null,lastRank:0});
  for(const [uid,score]of [[a.uid,500],[other.uid,400],[third.uid,300]]){
    await db.doc('socialAccounts/'+uid).update({weekly:{enabled:true}});
    await db.doc('weeklyCompetitions/'+week+'/entries/'+uid).set({active:true,score,uid,integrity:{}});
  }
  await weekly.maintain();
  assert.equal((await db.doc('weeklyRewardReviews/'+week+'-'+a.uid).get()).data()?.reason,'invalid-save');
  assert.equal((await db.doc('weeklyCompetitions/'+week).get()).data().settled,true);
});

test('the deployed guest callable refuses unattested traffic',async()=>{
  if(directService)return;
  const response=await fetch(`http://127.0.0.1:5001/${projectId}/${config.region}/modeAtlasUsage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{action:'report',id:'a'.repeat(64),snapshot:{}}})});
  const result=await response.json();assert.equal(result.error.status,'UNAUTHENTICATED');
});
