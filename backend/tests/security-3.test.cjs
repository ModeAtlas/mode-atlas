'use strict';
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const req=require('node:module').createRequire(require.resolve('../functions/package.json'));
const {initializeApp,deleteApp}=req('firebase-admin/app'),{getFirestore}=req('firebase-admin/firestore'),{getAuth}=req('firebase-admin/auth');
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Use the Firebase emulator');
const app=initializeApp({projectId:'demo-mode-atlas'},'release3-security'),db=getFirestore(app),auth=getAuth(app);
after(async()=>{
 for(const uid of ['release3-owner','release3-moderator'])await db.doc('socialAccounts/'+uid).delete();
 await auth.deleteUsers(['release3-owner','release3-moderator']);
 await deleteApp(app);
});
const prompts=require('../functions/shared/mode-atlas-study-prompts.js');
const map=Object.assign({},...Object.values(require('../functions/shared/mode-atlas-kana-data.js').maps));
test('verified earnings require an issued, account-bound question, unchanged configuration and live expiry',async()=>{
 let at=Date.now();const earnings=require('../functions/study-earnings.cjs').createEarnings({db,now:()=>at});
 const uid='release3-issued',config={direction:'reading',pool:['あ','い','う','え','お'],mode:'guided',hints:false},id='release3-issued-run';
 const issued=await earnings.start(uid,{id,config});const kana=prompts.question(issued,1),receipt={id,config,token:issued.token,startedAt:issued.startedAt,answers:[{index:1,kana,answer:map[kana],elapsed:1000}],complete:false};at+=2000;
 await assert.rejects(earnings.submit('release3-stranger',receipt),{code:'failed-precondition'});
 await assert.rejects(earnings.submit(uid,{...receipt,id:'release3-unissued'}),{code:'failed-precondition'});
 await assert.rejects(earnings.submit(uid,{...receipt,startedAt:issued.startedAt-1}),{code:'invalid-argument'});
 await assert.rejects(earnings.submit(uid,{...receipt,config:{...config,mode:'endless'}}),{code:'invalid-argument'});
 await assert.rejects(earnings.submit(uid,{...receipt,answers:[{...receipt.answers[0],kana:config.pool.find(char=>char!==kana)}]}),{code:'failed-precondition'});
 await assert.rejects(earnings.submit(uid,{...receipt,token:'invented-token'}),{code:'failed-precondition'});
 assert.equal((await earnings.submit(uid,receipt)).index,1);const saved=(await db.doc('studyEarnings/'+uid).get()).data();
 assert.equal((await earnings.submit(uid,receipt)).index,1);assert.deepEqual((await db.doc('studyEarnings/'+uid).get()).data(),saved);
 at=issued.expiresAt+1;await assert.rejects(earnings.submit(uid,receipt),{code:'failed-precondition'});
});
test('anomalous answer timing holds new economic evidence and creates an operational review',async()=>{
 let at=Date.now();const {createEarnings,opening}=require('../functions/study-earnings.cjs'),earnings=createEarnings({db,now:()=>at});
 const uid='release3-timing',id='release3-timing-run',config={direction:'reading',pool:['あ','い','う','え','お'],mode:'guided',hints:false};
 await db.doc('studyEarnings/'+uid).set({...opening(),integrity:{answers:499,nearMinimum:499,reviewRequired:false}});
 const issued=await earnings.start(uid,{id,config}),kana=prompts.question(issued,1);at+=1000;
 const result=await earnings.submit(uid,{id,config,token:issued.token,startedAt:issued.startedAt,answers:[{index:1,kana,answer:map[kana],elapsed:200}],complete:false});
 assert.equal(result.held,true);const ledger=(await db.doc('studyEarnings/'+uid).get()).data();
 assert.equal(ledger.integrity.reviewRequired,true);assert.deepEqual(ledger.state,opening().state);
 assert.equal((await db.doc('studyRewardReviews/'+uid).get()).data().reason,'Near-minimum answer timing');
});
test('ending a daily run early cannot claim its full daily completion reward',async()=>{
 let at=Date.now();const earnings=require('../functions/study-earnings.cjs').createEarnings({db,now:()=>at});
 const uid='release3-short-daily',id='release3-short-daily-run',config={direction:'reading',pool:['あ','い','う','え','お'],mode:'dailyChallenge',hints:false};
 const issued=await earnings.start(uid,{id,config});
 const answers=Array.from({length:10},(_,i)=>{const index=i+1,kana=prompts.question(issued,index);return {index,kana,answer:map[kana],elapsed:index*1000};});at+=11000;
 await earnings.submit(uid,{id,config,token:issued.token,startedAt:issued.startedAt,answers,complete:true,completed:true});
 const ledger=(await db.doc('studyEarnings/'+uid).get()).data();
 assert.equal(Object.values(ledger.state.activity).flatMap(row=>Object.values(row.metrics)).some(metrics=>metrics['kana.daily']>0),false);
 assert.equal(Object.keys(ledger.state.claims).some(key=>key.endsWith(':daily:reading')),false);
});
test('administrator status is a server Auth claim and role changes require fresh sign-in with an audit receipt',async()=>{
 const {isAdmin}=require('../functions/identity.cjs');assert.equal(isAdmin({uid:'pretender',emailVerified:true,email:'admin@mode-atlas.com'}),false);
 await auth.createUser({uid:'release3-owner',email:'owner-renamed@example.test',emailVerified:true});await auth.setCustomUserClaims('release3-owner',{modeAtlasAdmin:true});
 await auth.createUser({uid:'release3-moderator',email:'moderator-release3@example.test',emailVerified:true});await db.doc('socialAccounts/release3-moderator').set({active:true,profile:{displayName:'Release Three'}});
 const actor=await auth.getUser('release3-owner'),staff=require('../functions/staff.cjs').createStaff({db,auth});assert.equal(isAdmin(actor),true);
 await assert.rejects(staff.assign(actor,{uid:'release3-moderator',moderator:true},{auth_time:Date.now()/1000-600}),{code:'failed-precondition'});
 await staff.assign(actor,{uid:'release3-moderator',moderator:true},{auth_time:Date.now()/1000});
 const events=await db.collection('securityAudit').where('actor','==',actor.uid).get();assert.equal(events.size,1);assert.equal(events.docs[0].data().operation,'moderator-granted');
 await auth.setCustomUserClaims(actor.uid,{});assert.equal(isAdmin(await auth.getUser(actor.uid)),false);
});
test('usage funnel rejects arbitrary event names and signed-in reports',async()=>{
 const usage=require('../functions/usage.cjs').createUsage({db}),id='b'.repeat(64),snapshot={platform:'web',version:'3.0.0',level:1,xp:0,kana:[],introduced:[],correct:0,attempts:0,branch:'learn',funnel:{lessonStarted:1,lessonCompleted:1,practiceCompleted:0,reviewCompleted:0,lessonExited:0,saveFailed:0,saveRecovered:0,day2Return:0,day7Return:0}};
 await assert.rejects(usage.call({data:{action:'report',id,snapshot}}),{code:'unauthenticated'});
 await assert.rejects(usage.call({app:{appId:'fixture'},auth:{uid:'private'},data:{action:'report',id,snapshot}}),{code:'failed-precondition'});
 await assert.rejects(usage.call({app:{appId:'fixture'},data:{action:'report',id,snapshot:{...snapshot,funnel:{...snapshot.funnel,typedAnswer:'private'}}}}),{code:'invalid-argument'});
 assert.equal((await usage.call({app:{appId:'fixture'},data:{action:'report',id,snapshot}})).accepted,true);
 await usage.call({app:{appId:'fixture'},data:{action:'delete',id}});
});
