'use strict';
const {test,after}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const req=require('node:module').createRequire(require.resolve('../functions/package.json'));
const {initializeApp,deleteApp}=req('firebase-admin/app'),{getFirestore}=req('firebase-admin/firestore');
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Use the Firebase emulator');
const app=initializeApp({projectId:'demo-mode-atlas'},'release302-economy'),db=getFirestore(app);
after(()=>deleteApp(app));
test('a new learner earns and purchases a real cosmetic without wallet credits or payment',async()=>{
 const uid='release302-economy',user={uid,emailVerified:true,customClaims:{}},timeZone='Australia/Melbourne';
 let at=Date.UTC(2026,9,1,8),sets=0,answers=0;
 const earnings=require('../functions/study-earnings.cjs').createEarnings({db,now:()=>at});
 const commerce=require('../functions/commerce.cjs').createCommerce({db,now:()=>at});
 const prompts=require('../functions/shared/mode-atlas-study-prompts.js');
 const map=Object.assign({},...Object.values(require('../functions/shared/mode-atlas-kana-data.js').maps));
 const config={direction:'reading',pool:['あ','い','う','え','お'],mode:'guided',hints:false};
 let wallet=await commerce.run(user,'shop',{version:3,timeZone});
 assert.equal(wallet.balance,0);assert.equal(wallet.tokenBalance,0);assert.equal(wallet.developer,false);
 const offer=wallet.offers.find(item=>item.id==='rose');assert.equal(offer.tokenPrice,120);
 while(wallet.tokenBalance<offer.tokenPrice&&sets<30){
  const id='economy-set-'+crypto.randomUUID(),issued=await earnings.start(uid,{id,config});
  // One ten-answer set each study day, eight correct, two incorrect, two seconds per answer.
  const client=structuredClone(issued),batch=Array.from({length:10},(_,i)=>{
   const index=i+1,kana=prompts.question(client,index),correct=index%5!==0;
   prompts.advance(client,index,kana,correct);
   return {index,kana,answer:correct?map[kana]:'not-an-answer',elapsed:index*2000};
  });
  at+=21000;await earnings.submit(uid,{id,config,token:issued.token,startedAt:issued.startedAt,answers:batch,complete:true,completed:true});
  sets++;answers+=batch.length;wallet=await commerce.run(user,'shop',{version:3,timeZone});
  if(wallet.tokenBalance<offer.tokenPrice)at+=86400000;
 }
 assert.ok(wallet.tokenBalance>=offer.tokenPrice,'the item must be reachable through ordinary study');
 const before=wallet.tokenBalance,purchase={requestId:crypto.randomUUID(),productId:'rose',currency:'study-tokens',price:offer.tokenPrice,timeZone};
 const bought=await commerce.run(user,'shopPurchase',purchase);assert.ok(bought.owned.includes('rose'));assert.equal(bought.tokenBalance,before-offer.tokenPrice);
 assert.equal((await commerce.run(user,'shopPurchase',purchase)).tokenBalance,bought.tokenBalance);
 const access=(await db.doc('rewardEntitlements/'+uid).get()).data();assert.equal(access.grants['shop-rose'].source,'shop');
 console.log('ECONOMY_JOURNEY '+JSON.stringify({sets,studyDays:sets,answers,correct:sets*8,price:offer.tokenPrice,balanceBefore:before,balanceAfter:bought.tokenBalance,granted:'shop-rose',coinPurchase:false}));
 await commerce.erase(uid);await db.doc('rewardEntitlements/'+uid).delete();
});
