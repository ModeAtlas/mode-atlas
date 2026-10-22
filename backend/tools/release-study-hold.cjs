'use strict';
// Privileged operator remediation after reviewing a false positive. This does
// not manufacture backdated rewards or alter personal learning evidence.
const functionsRequire=require('node:module').createRequire(require.resolve('../functions/package.json'));
const {initializeApp}=functionsRequire('firebase-admin/app');
const {getFirestore}=functionsRequire('firebase-admin/firestore');
const [uid,operator,reason]=process.argv.slice(2);
if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid||'')||!operator||!reason||reason.length<10||reason.length>500)throw Error('Usage: node backend/tools/release-study-hold.cjs <UID> <operator identity> "<review reason, 10–500 characters>"');
initializeApp();
(async()=>{
  const db=getFirestore(),ref=db.doc('studyEarnings/'+uid),review=db.doc('studyRewardReviews/'+uid),audit=db.collection('securityAudit').doc();
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);if(!snap.exists||!snap.data().integrity?.reviewRequired)throw Error('No active study reward hold.');
    tx.update(ref,{integrity:{answers:0,nearMinimum:0,reviewRequired:false}});tx.delete(review);
    tx.create(audit,{actor:operator,target:uid,operation:'release-study-hold',reason,at:Date.now(),status:'complete',expiresAt:new Date(Date.now()+90*86400000)});
  });console.log('Future study rewards resumed for UID '+uid+'. Prior held answers remain uncredited.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
