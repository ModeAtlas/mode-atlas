'use strict';
// Coins, inventory, receipts and access are committed in one server transaction.
const {createHash,randomUUID}=require('node:crypto');
const {HttpsError}=require('firebase-functions/v2/https');
const {isAdmin}=require('./identity.cjs');
const {entitlement}=require('./rewards.cjs');
const {levelFromSave,studyDaysFromSave,studyStreak,protectStreak}=require('./projection.cjs');
const dates=require('./shared/mode-atlas-date.js');
const catalogue=require('./shared/mode-atlas-shop-catalogue.js');
const fail=(code,message)=>{throw new HttpsError(code,message);};
const hash=value=>createHash('sha256').update(value).digest('hex');
const consumables=catalogue.products.filter(p=>p.kind==='consumable');
const empty=()=>({version:2,currency:catalogue.currency.id,balance:0,inventory:Object.fromEntries(consumables.map(p=>[p.id,[]])),purchases:{},covered:{},levelRewards:{version:1,throughLevel:1,total:0}});
function wallet(data){
  if(!data)return empty();
  if(![1,2].includes(data.version)||data.currency!==(data.version===1?'atlas-tokens':catalogue.currency.id)||!Number.isSafeInteger(data.balance)||data.balance<0||data.balance>1_000_000_000)
    fail('failed-precondition','Your coin balance could not be loaded. Please try again.');
  return {...empty(),...data,version:2,currency:catalogue.currency.id};
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
  const learned=new Set(days),units=[...(w.inventory['streak-freeze']||[])],covered={};
  for(const [day,entry]of Object.entries(w.covered||{})){
    if(entry.kind==='freeze')units.push(entry.unit);
    else if(learned.has(day))w.inventory['streak-repair'].push(entry.unit);
    else covered[day]=entry;
  }
  const result=protectStreak(days,today,Object.keys(covered),units.map(unit=>({...unit,day:dates.dateKeyInTimeZone(unit.at,zone)})));
  const original=unit=>({id:unit.id,at:unit.at});
  for(const [day,unit]of Object.entries(result.used))covered[day]={kind:'freeze',unit:original(unit)};
  w.inventory['streak-freeze']=result.remaining.map(original);w.covered=covered;
}
function repairDay(w,days,today){
  const yesterday=dates.shiftDateKey(today,-1),prior=dates.shiftDateKey(today,-2);
  return !days.includes(yesterday)&&!Object.hasOwn(w.covered,yesterday)&&studyStreak(days,prior,Object.keys(w.covered))>0
    &&(days.includes(prior)||Object.hasOwn(w.covered,prior))?yesterday:null;
}
// Read-only projection for reminders; consuming inventory remains transactional.
function streakStatus(record,save,zone,at){
  const w=wallet(record?structuredClone(record):null),today=dates.dateKeyInTimeZone(at,zone),days=studyDaysFromSave(save,zone);
  reconcile(w,days,today,zone);
  return {streak:studyStreak(days,today,Object.keys(w.covered)),studiedToday:days.includes(today),freezeReady:w.inventory['streak-freeze'].length>0};
}
function createCommerce({db,auth,now=Date.now}){
  const reference=uid=>db.doc('commerceAccounts/'+uid);
  function creditLevels(tx,ref,w,save,at){
    const previous=w.levelRewards;
    if(previous?.version!==1||!Number.isInteger(previous.throughLevel)||previous.throughLevel<1||previous.throughLevel>999||previous.total!==catalogue.levelCoins.total(previous.throughLevel))
      fail('failed-precondition','Your level rewards could not be loaded. Please try again.');
    const level=levelFromSave(save),amount=catalogue.levelCoins.total(level)-previous.total;
    if(level<=previous.throughLevel)return;
    if(w.balance+amount>1_000_000_000)fail('failed-precondition','Your coin balance has reached its limit. Contact support.');
    w.balance+=amount;w.levelRewards={version:1,throughLevel:level,total:previous.total+amount,lastAmount:amount,awardedAt:at};
    tx.set(ref.collection('operations').doc('level-v1-'+level),{action:'levelReward',fromLevel:previous.throughLevel+1,toLevel:level,amount,at,balanceAfter:w.balance});
  }
  async function awardLevels(uid,knownUser){
    let user=knownUser;
    if(!user){try{user=await auth.getUser(uid);}catch(error){if(error.code==='auth/user-not-found')return;throw error;}}
    if(user.disabled||!user.emailVerified)return;
    const ref=reference(uid);
    return db.runTransaction(async tx=>{
      const [record,save,deleting,deleted]=await tx.getAll(ref,db.doc('users/'+uid+'/appData/kanaTrainer'),db.doc('accountDeletions/'+uid),db.doc('socialDeleted/'+hash(uid)));
      if(!save.exists||deleting.exists||deleted.exists&&(Date.parse(user.metadata?.creationTime)||0)<=deleted.data().at)return;
      const w=wallet(record.data()),before=JSON.stringify(w);creditLevels(tx,ref,w,save.data(),now());
      if(before!==JSON.stringify(w))tx.set(ref,w);
    });
  }
  async function backfillLevels(){
    // A bounded, resumable sweep also reaches dormant accounts without Friends.
    const ref=db.doc('commerceMigrations/level-coins-v1'),token=randomUUID();
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
    fields(data,action==='shop'?['version','timeZone']:['requestId','productId','coinPrice','amount','operation','timeZone']);
    if(!legacy&&action==='shop'&&data.version!==2)fail('invalid-argument','Refresh the shop and try again.');
    if(action!=='shop'&&(typeof data.requestId!=='string'||!/^[-a-zA-Z0-9_]{16,80}$/.test(data.requestId)))fail('invalid-argument','Refresh the shop and try again.');
    if(action==='shopDeveloper'&&!isAdmin(user))fail('permission-denied','Shop testing is only available to the developer account.');
    const zone=legacy?'UTC':timeZone(data.timeZone),at=now(),today=dates.dateKeyInTimeZone(at,zone),uid=user.uid;
    const fingerprint=JSON.stringify([action,data.productId||null,data.coinPrice??null,data.amount??null,data.operation||null]);
    const ref=reference(uid),accessRef=db.doc('rewardEntitlements/'+uid),receipt=action==='shop'?null:ref.collection('operations').doc(hash(data.requestId));
    return db.runTransaction(async tx=>{
      const refs=[ref,accessRef,db.doc('users/'+uid+'/appData/kanaTrainer'),db.doc('shopCatalogue/current'),db.doc('accountDeletions/'+uid),db.doc('socialDeleted/'+hash(uid))];
      if(receipt)refs.push(receipt);
      const [record,awards,save,rotation,deleting,deleted,prior]=await tx.getAll(...refs);
      if(deleting.exists||deleted.exists&&(Date.parse(user.metadata?.creationTime)||0)<=deleted.data().at)fail('unauthenticated','This account is being deleted.');
      const w=wallet(record.data()),access={...(awards.data()||{}),grants:{...(awards.data()?.grants||{})}};
      const original=JSON.stringify(w),days=studyDaysFromSave(save.data(),zone),offers=catalogue.products.map(p=>catalogue.offer(p,rotation.data()?.offers,at)).filter(Boolean);
      creditLevels(tx,ref,w,save.data(),at);
      if(legacy){if(JSON.stringify(w)!==original||record.data()?.version===1)tx.set(ref,w);return {version:1,currency:'atlas-tokens',balance:w.balance,purchasesEnabled:false};}
      reconcile(w,days,today,zone);
      if(prior?.exists&&prior.data().fingerprint!==fingerprint)fail('invalid-argument','That purchase request has already been used.');
      let accessChanged=false;
      if(action!=='shop'&&!prior.exists){
        if(action==='shopPurchase'){
          fields(data,['requestId','productId','coinPrice','timeZone']);
          const product=catalogue.item(data.productId),offer=offers.find(p=>p.id===data.productId);
          if(!product||!offer)fail('failed-precondition','This item is out of the shop rotation.');
          if(data.coinPrice!==offer.coinPrice)fail('failed-precondition','The price changed. Refresh the shop before buying.');
          if(product.grant&&(w.purchases[product.id]||entitlement(user,access,at).grants.includes(product.grant)))fail('already-exists','You already own this item.');
          if(product.kind==='consumable'&&w.inventory[product.id].length>=product.limit)fail('failed-precondition','You already have the maximum number ready.');
          if(w.balance<offer.coinPrice)fail('failed-precondition','You need more Atlas Coins for this item.');
          w.balance-=offer.coinPrice;
          if(product.grant){
            w.purchases[product.id]={at,price:offer.coinPrice};access.grants[product.grant]={awardedAt:at,source:'shop'};accessChanged=true;
          }else w.inventory[product.id].push({id:hash(data.requestId),at});
        }else if(action==='shopUse'){
          fields(data,['requestId','productId','timeZone']);
          if(data.productId!=='streak-repair')fail('invalid-argument','Choose a Streak Repair.');
          const day=repairDay(w,days,today);
          if(!day)fail('failed-precondition','There is no missed day to repair. A repair can reconnect a streak broken yesterday.');
          const unit=w.inventory['streak-repair'].shift();if(!unit)fail('failed-precondition','You do not have a Streak Repair.');
          w.covered[day]={kind:'repair',unit};
        }else if(action==='shopDeveloper'){
          fields(data,['requestId','operation','amount','timeZone']);
          if(data.operation==='credit'){
            if(!Number.isSafeInteger(data.amount)||data.amount<1||data.amount>100000||w.balance+data.amount>1_000_000_000)fail('invalid-argument','Enter between 1 and 100,000 coins.');
            w.balance+=data.amount;
          }else if(data.operation==='resetPurchases'){
            if(data.amount!==undefined)fail('invalid-argument','Reset purchases does not take an amount.');
            for(const product of catalogue.products)if(product.grant)delete access.grants[product.grant];
            w.purchases={};w.inventory=empty().inventory;w.covered={};accessChanged=true;
          }else fail('invalid-argument','Choose a shop testing action.');
        }else fail('invalid-argument','Unknown shop action.');
        tx.set(receipt,{fingerprint,action,at,productId:data.productId||null,amount:data.amount||0,balanceAfter:w.balance});
      }
      if(JSON.stringify(w)!==original||record.data()?.version===1)tx.set(ref,w);
      if(accessChanged)tx.set(accessRef,access);
      const owned=entitlement(user,access,at).grants;
      return {version:2,currency:catalogue.currency.id,balance:w.balance,coinPurchasesEnabled:false,offers,
        levelRewards:w.levelRewards,
        owned:catalogue.products.filter(p=>p.grant&&owned.includes(p.grant)).map(p=>p.id),
        inventory:Object.fromEntries(consumables.map(p=>[p.id,w.inventory[p.id].length])),
        protection:Object.keys(w.covered).sort(),repairDay:repairDay(w,days,today),timeZone:zone,checkedAt:at,developer:isAdmin(user)};
    });
  }
  return {run,awardLevels,backfillLevels,erase:uid=>db.recursiveDelete(reference(uid))};
}
module.exports={createCommerce,reconcile,repairDay,streakStatus};
