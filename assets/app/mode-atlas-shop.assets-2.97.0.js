/* Account-bound commerce projection. Only authenticated callables spend coins. */
(function(root,factory){
  if(typeof module==='object'&&module.exports){module.exports=factory;return;}
  const key='modeAtlasShopState';
  const owner=factory({user:()=>root.KanaCloudSync?.getUser?.()?.uid||'',online:()=>navigator.onLine!==false,
    read:()=>root.ModeAtlasStorage.json(key,null),write:value=>value?root.ModeAtlasStorage.setJSON(key,value):root.ModeAtlasStorage.remove(key),
    call:(action,data,uid)=>root.ModeAtlasSocial.call(action,data,uid),
    sync:()=>root.KanaCloudSync.syncNow(),
    afterMutation:()=>root.ModeAtlasRewardAccess.refresh(true),
    project:state=>{
      const today=root.ModeAtlasDates.localDateKey(),from=root.ModeAtlasDates.localDateKey(state.checkedAt);
      const freezes=Array.from({length:state.inventory?.['streak-freeze']||0},(_,index)=>({id:String(index),day:from}));
      const result=root.ModeAtlasProgress.protectStreak(root.ModeAtlasProgress.studyDays(),today,state.protection,freezes);
      return {...state,protection:result.protection,inventory:{...state.inventory,'streak-freeze':result.remaining.length}};
    },
    changed:()=>root.dispatchEvent(new CustomEvent('modeAtlasShopChanged'))});
  root.ModeAtlasShop=owner;
  root.addEventListener('modeAtlasAccountWillChange',owner.clear);
  root.addEventListener('modeAtlasAccountSignedOut',owner.clear);
  for(const event of ['kanaCloudSyncStatusChanged','modeAtlasCloudDataChanged','online','pageshow'])root.addEventListener(event,()=>{void owner.refresh();});
  root.addEventListener('modeAtlasAppStateChanged',event=>{if(event.detail.isActive)void owner.refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void owner.refresh();});
  void root.KanaCloudSync?.ready?.then(()=>owner.refresh());
})(typeof window!=='undefined'?window:globalThis,function(dependencies){
  'use strict';
  const {user,online,call,sync=async()=>true,afterMutation=async()=>{},read=()=>null,write=()=>{},changed=()=>{},
    now=Date.now,project=value=>value,requestId=()=>crypto.randomUUID(),timeZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone}=dependencies;
  let epoch=0,uid=user(),status='idle',pending=null,mutating=false,checkedAt=0;
  let cached=read();if(cached?.uid!==uid)cached=null;
  const blank=()=>({offers:null,owned:[],inventory:{'streak-freeze':0,'streak-repair':0},protection:[],repairDay:null,developer:false});
  function valid(value){
    return value?.version===2&&value.currency==='atlas-coins'&&Number.isSafeInteger(value.balance)&&value.balance>=0&&value.balance<=1_000_000_000
      &&Array.isArray(value.offers)&&value.offers.every(o=>typeof o.id==='string'&&Number.isSafeInteger(o.coinPrice)&&o.coinPrice>0&&(o.endsAt===null||Number.isFinite(o.endsAt)))
      &&Array.isArray(value.owned)&&value.owned.every(id=>typeof id==='string')&&value.inventory&&['streak-freeze','streak-repair'].every(id=>Number.isSafeInteger(value.inventory[id])&&value.inventory[id]>=0)
      &&Array.isArray(value.protection)&&value.protection.every(day=>/^\d{4}-\d{2}-\d{2}$/.test(day))&&Number.isFinite(value.checkedAt);
  }
  if(cached&&!valid(cached.state))cached=null;
  function current(){
    const active=!!user()&&uid===user(),state=active&&cached?.uid===uid?project(cached.state):blank();
    return {...state,status:!user()?'guest':!active?'idle':status,balance:active&&status==='ready'?state.balance??null:null,busy:mutating};
  }
  function protection(){return current().protection||[];}
  function clear(){epoch++;uid='';cached=null;status='idle';pending=null;mutating=false;checkedAt=0;write(null);changed();}
  function account(){if(user()!==uid){clear();uid=user();}return uid;}
  function accept(result){if(!valid(result))throw new Error('Invalid shop response');cached={uid,state:result,requests:cached?.requests||{}};checkedAt=now();status='ready';write(cached);}
  async function refresh(force=false){
    const active=account();if(!active)return current();
    if(pending||mutating)return pending||current();
    if(!online()){status='offline';changed();return current();}
    if(!force&&checkedAt&&now()-checkedAt<60000)return current();
    const ticket=epoch;status='loading';changed();checkedAt=now();
    pending=(async()=>{
      try{const result=await call('shop',{version:2,timeZone:timeZone()},active);if(ticket===epoch&&active===user())accept(result);}
      catch{if(ticket===epoch&&active===user())status='unavailable';}
      finally{if(ticket===epoch){pending=null;changed();}}
      return current();
    })();return pending;
  }
  function error(message,code='failed-precondition'){return Object.assign(new Error(message),{code});}
  async function mutate(action,data){
    const active=account();if(!active)throw error('Sign in to use the shop.','unauthenticated');
    if(!online())throw error('Connect to the internet to use the shop.','offline');
    if(mutating)throw error('Your previous purchase is still finishing.');
    if(pending)await pending;
    if(active!==user())throw error('The signed-in account changed.','account-changed');
    const ticket=epoch;mutating=true;changed();
    const key=JSON.stringify([action,data.productId||'',data.operation||'',data.amount||0,data.coinPrice||0]);
    cached||={uid:active,state:blank(),requests:{}};cached.requests||={};
    const id=cached.requests[key]||requestId();cached.requests[key]=id;write(cached);
    try{
      if(action==='shopUse'&&await sync()===false)throw error('Your latest progress could not sync. Try again before using the shop.','unavailable');
      if(ticket!==epoch||active!==user())throw error('The signed-in account changed.','account-changed');
      const result=await call(action,{...data,requestId:id,timeZone:timeZone()},active);
      if(ticket!==epoch||active!==user())throw error('The signed-in account changed.','account-changed');
      accept(result);if(action==='shopDeveloper'&&data.operation==='resetPurchases')cached.requests={};delete cached.requests[key];write(cached);
      await afterMutation();return current();
    }catch(failure){
      const code=String(failure.code||'').replace(/^functions\//,'');
      if(ticket===epoch&&['invalid-argument','permission-denied','failed-precondition','already-exists','not-found'].includes(code)){delete cached.requests[key];write(cached);}
      throw failure;
    }finally{if(ticket===epoch){mutating=false;changed();}}
  }
  function purchase(productId){
    const offer=current().offers?.find(item=>item.id===productId);if(!offer)throw error('Refresh the shop to view this item.');
    return mutate('shopPurchase',{productId,coinPrice:offer.coinPrice});
  }
  function message(failure){
    const code=String(failure?.code||'').replace(/^functions\//,'');
    return ['offline','account-changed','unauthenticated','invalid-argument','already-exists','not-found','permission-denied','failed-precondition','resource-exhausted'].includes(code)?failure.message:'The shop could not be reached. Check your connection and try again.';
  }
  return Object.freeze({current,protection,refresh,clear,purchase,useRepair:()=>mutate('shopUse',{productId:'streak-repair'}),
    developer:(operation,amount)=>mutate('shopDeveloper',{operation,...(amount===undefined?{}:{amount})}),message});
});
