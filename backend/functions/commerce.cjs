'use strict';
// Coins, inventory, receipts and access are committed in one server transaction.
const {createHash,randomUUID}=require('node:crypto');
const {HttpsError}=require('firebase-functions/v2/https');
const {isAdmin}=require('./identity.cjs');
const {entitlement}=require('./rewards.cjs');
const {levelFromSave,earningEvidence,studyDaysFromSave,studyStreak,protectStreak}=require('./projection.cjs');
const dates=require('./shared/mode-atlas-date.js');
const catalogue=require('./shared/mode-atlas-shop-catalogue.js');
const fail=(code,message)=>{throw new HttpsError(code,message);};
const hash=value=>createHash('sha256').update(value).digest('hex');
const consumables=catalogue.products.filter(p=>p.kind==='consumable');
const empty=()=>({version:3,currency:catalogue.currency.id,balance:0,tokenBalance:0,tokenRewards:{version:1,answers:0,levels:0,streaks:0},inventory:Object.fromEntries(consumables.map(p=>[p.id,[]])),purchases:{},covered:{},levelRewards:{version:2,throughLevel:1,total:0}});
function wallet(data){
  if(!data)return empty();
  if(![1,2,3].includes(data.version)||data.currency!==(data.version===1?'atlas-tokens':catalogue.currency.id)||!Number.isSafeInteger(data.balance)||data.balance<0||data.balance>1_000_000_000)
    fail('failed-precondition','Your balance could not be loaded. Please try again.');
  const w={...empty(),...data,version:3,currency:catalogue.currency.id};
  if(w.levelRewards?.version===1){
    const old=w.levelRewards,n=old.throughLevel;
    if(!Number.isSafeInteger(n)||n<1||n>999||old.total!==catalogue.legacyLevelCoins.total(n))fail('failed-precondition','Your level rewards could not be loaded.');
    // Existing coins remain spendable. Already-reached milestones are not paid twice.
    w.levelRewards={version:2,throughLevel:n,total:catalogue.levelCoins.total(n)};
  }
  if(!Number.isSafeInteger(w.tokenBalance)||w.tokenBalance<0||w.tokenBalance>1_000_000_000||w.tokenRewards?.version!==1||['answers','levels','streaks'].some(key=>!Number.isSafeInteger(w.tokenRewards[key])||w.tokenRewards[key]<0))fail('failed-precondition','Your Study Tokens could not be loaded.');
  return w;
}
function fields(data,allowed){
  if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!allowed.includes(key)))fail('invalid-argument','The shop request contains unsupported fields.');
}
function timeZone(value){
  if(typeof value!=='string'||value.length>64)fail('invalid-argument','Choose a valid time zone.');
  try{new Intl.DateTimeFormat('en',{timeZone:value}).format();}catch{fail('invalid-argument','Choose a valid time zone.');}return value;
}
// Rebuild freeze use from server-owned units and synced study days. Late offline
// study refunds/reassigns a freeze instead of permanently spending it in error.
function reconcile(w,days,today,zone){
  const learned=new Set(days),units=[...(w.inventory['streak-freeze']||[])],covered={},repairs=new Map();
  for(const [day,entry]of Object.entries(w.covered||{})){
    if(entry.kind==='freeze')units.push(entry.unit);
    else{
      const group=repairs.get(entry.unit.id)||{unit:entry.unit,needed:false};
      if(!learned.has(day)){covered[day]=entry;group.needed=true;}
      repairs.set(entry.unit.id,group);
    }
  }
  // One repair can bridge several dates. A late offline save refunds that unit
  // once, and only after none of its covered dates still need protection.
  for(const {unit,needed}of repairs.values())if(!needed&&!w.inventory['streak-repair'].some(item=>item.id===unit.id))w.inventory['streak-repair'].push(unit);
  const result=protectStreak(days,today,Object.keys(covered),units.map(unit=>({...unit,day:dates.dateKeyInTimeZone(unit.at,zone)})));
  const original=unit=>({id:unit.id,at:unit.at});
  for(const [day,unit]of Object.entries(result.used))covered[day]={kind:'freeze',unit:original(unit)};
  w.inventory['streak-freeze']=result.remaining.map(original);w.covered=covered;
}
function repairGap(w,days,today){
  const learned=new Set(days),covered=new Set(Object.keys(w.covered||{})),present=day=>learned.has(day)||covered.has(day);
  let end=null;
  for(let offset=1;offset<=catalogue.streakRepair.windowDays;offset++){
    const day=dates.shiftDateKey(today,-offset);if(!present(day)){end=day;break;}
  }
  if(!end)return null;
  const missed=[];let day=end;
  while(!present(day)&&missed.length<=catalogue.streakRepair.maxMissedDays){missed.unshift(day);day=dates.shiftDateKey(day,-1);}
  if(missed.length>catalogue.streakRepair.maxMissedDays||!present(day)||studyStreak(days,day,[...covered])===0)return null;
  return {days:missed,expiresOn:dates.shiftDateKey(end,catalogue.streakRepair.windowDays)};
}
const repairDay=(w,days,today)=>repairGap(w,days,today)?.days.at(-1)||null;
// Read-only projection for reminders; consuming inventory remains transactional.
function streakStatus(record,save,zone,at){
  const w=wallet(record?structuredClone(record):null),today=dates.dateKeyInTimeZone(at,zone),days=studyDaysFromSave(save,zone);
  reconcile(w,days,today,zone);
  return {streak:studyStreak(days,today,Object.keys(w.covered)),studiedToday:days.includes(today),freezeReady:w.inventory['streak-freeze'].length>0};
}
function createCommerce({db,auth,now=Date.now}){
  const reference=uid=>db.doc('commerceAccounts/'+uid);
  // Weekly settlement owns eligibility. This owner alone migrates/writes wallets;
  // return a deferred write so the caller can finish all transaction reads first.
  async function prepareWeeklyPrize(tx,uid,week,amount){
    const ref=reference(uid),receipt=ref.collection('operations').doc('weekly-v1-'+week);
    const [record,previous]=await tx.getAll(ref,receipt);
    if(previous.exists)return {amount:previous.data().amount,commit:()=>{}};
    const w=wallet(record.data());
    if(!Number.isSafeInteger(amount)||amount<=0||w.balance+amount>1_000_000_000)fail('failed-precondition','Your weekly coins could not be awarded.');
    w.balance+=amount;
    return {amount,commit:()=>{tx.set(ref,w);tx.create(receipt,{action:'weeklyReward',week,amount,at:now(),balanceAfter:w.balance});}};
  }
  function creditLevels(tx,ref,w,save,at){
    const previous=w.levelRewards;
    if(previous?.version!==2||!Number.isInteger(previous.throughLevel)||previous.throughLevel<1||previous.throughLevel>999||previous.total!==catalogue.levelCoins.total(previous.throughLevel))
      fail('failed-precondition','Your level rewards could not be loaded. Please try again.');
    const level=levelFromSave(save),amount=catalogue.levelCoins.total(level)-previous.total;
    if(level<=previous.throughLevel)return;
    if(w.balance+amount>1_000_000_000)fail('failed-precondition','Your coin balance has reached its limit. Contact support.');
    w.balance+=amount;w.levelRewards={version:2,throughLevel:level,total:previous.total+amount,lastAmount:amount,awardedAt:at};
    tx.set(ref.collection('operations').doc('level-v2-'+level),{action:'levelReward',fromLevel:previous.throughLevel+1,toLevel:level,amount,at,balanceAfter:w.balance});
  }
  function creditTokens(tx,ref,w,save,at,zone){
    const evidence=earningEvidence(save,zone),today=dates.dateKeyInTimeZone(at,zone);
    const days=[...new Set(evidence.days)].filter(day=>day<=today).sort(),covered=new Set(Object.keys(w.covered));
    let streak=0,previous=null,streaks=0;
    for(const day of days){
      let contiguous=!!previous,next=previous&&dates.shiftDateKey(previous,1);
      while(contiguous&&next<day){if(!covered.has(next)){contiguous=false;break;}next=dates.shiftDateKey(next,1);}
      streak=contiguous?streak+1:1;streaks+=catalogue.studyTokens.streakDay(streak);previous=day;
    }
    const totals={answers:Math.floor(evidence.answerUnits/catalogue.studyTokens.answerDivisor),levels:catalogue.studyTokens.levelTotal(evidence.level),streaks};
    let amount=0;const rewards={...w.tokenRewards};
    for(const key of Object.keys(totals)){const target=Math.max(rewards[key],totals[key]);amount+=target-rewards[key];rewards[key]=target;}
    if(!Number.isSafeInteger(amount)||w.tokenBalance+amount>1_000_000_000)fail('failed-precondition','Your Study Tokens balance has reached its limit. Contact support.');
    if(!amount)return;
    w.tokenBalance+=amount;w.tokenRewards=rewards;
    tx.set(ref.collection('operations').doc('study-'+hash(JSON.stringify(rewards))),{action:'studyReward',currency:catalogue.earnedCurrency.id,amount,at,balanceAfter:w.tokenBalance,totals:rewards});
  }
  async function awardLevels(uid,knownUser){
    let user=knownUser;
    if(!user){try{user=await auth.getUser(uid);}catch(error){if(error.code==='auth/user-not-found')return;throw error;}}
    if(user.disabled||!user.emailVerified)return;
    const ref=reference(uid);
    return db.runTransaction(async tx=>{
      const [record,save,deleting,deleted,social]=await tx.getAll(ref,db.doc('users/'+uid+'/appData/kanaTrainer'),db.doc('accountDeletions/'+uid),db.doc('socialDeleted/'+hash(uid)),db.doc('socialAccounts/'+uid));
      if(!save.exists||deleting.exists||deleted.exists&&(Date.parse(user.metadata?.creationTime)||0)<=deleted.data().at)return;
      const w=wallet(record.data()),before=JSON.stringify(w),zone=social.data()?.profile?.timeZone||'UTC',at=now();
      reconcile(w,studyDaysFromSave(save.data(),zone),dates.dateKeyInTimeZone(at,zone),zone);
      creditLevels(tx,ref,w,save.data(),at);creditTokens(tx,ref,w,save.data(),at,zone);
      if(before!==JSON.stringify(w)||record.data()?.version!==3)tx.set(ref,w);
    });
  }
  async function backfillLevels(){
    // A bounded, resumable sweep also reaches dormant accounts without Friends.
    const ref=db.doc('commerceMigrations/study-currency-v2'),token=randomUUID();
    const start=await db.runTransaction(async tx=>{
      const state=(await tx.get(ref)).data()||{};if(state.complete||state.leaseUntil>now())return null;
      tx.set(ref,{...state,token,leaseUntil:now()+120000});return state;
    });
    if(!start)return;
    try{
      const page=await auth.listUsers(50,start.pageToken||undefined);
      for(let offset=0;offset<page.users.length;offset+=5)await Promise.all(page.users.slice(offset,offset+5).map(user=>awardLevels(user.uid,user)));
      await db.runTransaction(async tx=>{
        const state=(await tx.get(ref)).data();if(state?.token!==token)return;
        tx.set(ref,{token,pageToken:page.pageToken||null,complete:!page.pageToken,leaseUntil:0,updatedAt:now()});
      });
    }finally{
      await db.runTransaction(async tx=>{const state=(await tx.get(ref)).data();if(state?.token===token&&state.leaseUntil)tx.update(ref,{leaseUntil:0});});
    }
  }
  async function run(user,action,data={}){
    const legacy=action==='shop'&&data.version===undefined;
    fields(data,action==='shop'?['version','timeZone']:['requestId','productId','coinPrice','amount','operation','timeZone','currency','price']);
    if(!legacy&&action==='shop'&&![2,3].includes(data.version))fail('invalid-argument','Refresh the shop and try again.');
    if(action!=='shop'&&(typeof data.requestId!=='string'||!/^[-a-zA-Z0-9_]{16,80}$/.test(data.requestId)))fail('invalid-argument','Refresh the shop and try again.');
    if(action==='shopDeveloper'&&!isAdmin(user))fail('permission-denied','Shop testing is only available to the developer account.');
    const zone=legacy?'UTC':timeZone(data.timeZone),at=now(),today=dates.dateKeyInTimeZone(at,zone),uid=user.uid;
    const payment=data.currency||catalogue.currency.id;
    const fingerprint=JSON.stringify([action,data.productId||null,data.coinPrice??data.price??null,data.amount??null,data.operation||null,...(data.currency?[payment]:[])]);
    const ref=reference(uid),accessRef=db.doc('rewardEntitlements/'+uid),receipt=action==='shop'?null:ref.collection('operations').doc(hash(data.requestId));
    return db.runTransaction(async tx=>{
      const refs=[ref,accessRef,db.doc('users/'+uid+'/appData/kanaTrainer'),db.doc('shopCatalogue/current'),db.doc('accountDeletions/'+uid),db.doc('socialDeleted/'+hash(uid))];
      if(receipt)refs.push(receipt);
      const [record,awards,save,rotation,deleting,deleted,prior]=await tx.getAll(...refs);
      if(deleting.exists||deleted.exists&&(Date.parse(user.metadata?.creationTime)||0)<=deleted.data().at)fail('unauthenticated','This account is being deleted.');
      const w=wallet(record.data()),access={...(awards.data()||{}),grants:{...(awards.data()?.grants||{})}};
      const original=JSON.stringify(w),days=studyDaysFromSave(save.data(),zone),eligibility=entitlement(user,access,at);
      const offers=catalogue.products.map(p=>catalogue.offer(p,rotation.data()?.offers,at,eligibility)).filter(Boolean);
      creditLevels(tx,ref,w,save.data(),at);
      if(legacy){if(JSON.stringify(w)!==original||record.data()?.version!==3)tx.set(ref,w);return {version:1,currency:'atlas-tokens',balance:w.balance,purchasesEnabled:false};}
      reconcile(w,days,today,zone);creditTokens(tx,ref,w,save.data(),at,zone);
      if(prior?.exists&&prior.data().fingerprint!==fingerprint)fail('invalid-argument','That purchase request has already been used.');
      let accessChanged=false;
      if(action!=='shop'&&!prior.exists){
        if(action==='shopPurchase'){
          fields(data,['requestId','productId','coinPrice','timeZone','currency','price']);
          const product=catalogue.item(data.productId),offer=offers.find(p=>p.id===data.productId);
          if(!product||!offer)fail('failed-precondition','This item is out of the shop rotation.');
          if(![catalogue.currency.id,catalogue.earnedCurrency.id].includes(payment))fail('invalid-argument','Choose a valid currency.');
          const tokenPayment=payment===catalogue.earnedCurrency.id,price=tokenPayment?offer.tokenPrice:offer.coinPrice,quoted=data.currency?data.price:data.coinPrice;
          if(!Number.isSafeInteger(price)||price<=0||quoted!==price||data.currency&&data.coinPrice!==undefined)fail('failed-precondition','The price changed. Refresh the shop before buying.');
          const balanceKey=tokenPayment?'tokenBalance':'balance';
          if(product.grant&&(w.purchases[product.id]||entitlement(user,access,at).grants.includes(product.grant)))fail('already-exists','You already own this item.');
          if(product.kind==='consumable'&&w.inventory[product.id].length>=product.limit)fail('failed-precondition','You already have the maximum number ready.');
          if(w[balanceKey]<price)fail('failed-precondition',`You need more ${tokenPayment?'Study Tokens':'Atlas Coins'} for this item.`);
          w[balanceKey]-=price;
          if(product.grant){
            w.purchases[product.id]={at,price,currency:payment};access.grants[product.grant]={awardedAt:at,source:'shop'};accessChanged=true;
          }else w.inventory[product.id].push({id:hash(data.requestId),at});
        }else if(action==='shopUse'){
          fields(data,['requestId','productId','timeZone']);
          if(data.productId!=='streak-repair')fail('invalid-argument','Choose a Streak Repair.');
          const gap=repairGap(w,days,today);
          if(!gap)fail('failed-precondition','There is no eligible break to repair. Restore up to three consecutive missed days within seven days of the last missed day.');
          const unit=w.inventory['streak-repair'].shift();if(!unit)fail('failed-precondition','You do not have a Streak Repair.');
          for(const day of gap.days)w.covered[day]={kind:'repair',unit};
        }else if(action==='shopDeveloper'){
          fields(data,['requestId','operation','amount','timeZone','currency']);
          if(data.operation==='credit'){
            if(![catalogue.currency.id,catalogue.earnedCurrency.id].includes(payment))fail('invalid-argument','Choose a valid currency.');
            const balanceKey=payment===catalogue.earnedCurrency.id?'tokenBalance':'balance';
            if(!Number.isSafeInteger(data.amount)||data.amount<1||data.amount>100000||w[balanceKey]+data.amount>1_000_000_000)fail('invalid-argument','Enter between 1 and 100,000.');
            w[balanceKey]+=data.amount;
          }else if(data.operation==='resetPurchases'){
            if(data.amount!==undefined)fail('invalid-argument','Reset purchases does not take an amount.');
            for(const product of catalogue.products)if(product.grant&&access.grants[product.grant]?.source==='shop')delete access.grants[product.grant];
            w.purchases={};w.inventory=empty().inventory;w.covered={};accessChanged=true;
          }else fail('invalid-argument','Choose a shop testing action.');
        }else fail('invalid-argument','Unknown shop action.');
        tx.set(receipt,{fingerprint,action,at,productId:data.productId||null,amount:data.amount||0,currency:payment,balanceAfter:payment===catalogue.earnedCurrency.id?w.tokenBalance:w.balance});
      }
      if(JSON.stringify(w)!==original||record.data()?.version!==3)tx.set(ref,w);
      if(accessChanged)tx.set(accessRef,access);
      const owned=entitlement(user,access,at).grants,repair=repairGap(w,days,today);
      return {version:data.version===3||data.currency?3:2,currency:catalogue.currency.id,balance:w.balance,tokenBalance:w.tokenBalance,earnedCurrency:catalogue.earnedCurrency.id,tokenRewards:w.tokenRewards,coinPurchasesEnabled:false,offers,
        levelRewards:w.levelRewards,
        owned:catalogue.products.filter(p=>p.grant&&owned.includes(p.grant)).map(p=>p.id),
        inventory:Object.fromEntries(consumables.map(p=>[p.id,w.inventory[p.id].length])),
        protection:Object.keys(w.covered).sort(),repairDay:repair?.days.at(-1)||null,repair,timeZone:zone,checkedAt:at,developer:isAdmin(user)};
    });
  }
  return {run,awardLevels,backfillLevels,prepareWeeklyPrize,erase:uid=>db.recursiveDelete(reference(uid))};
}
module.exports={createCommerce,reconcile,repairDay,repairGap,streakStatus};
