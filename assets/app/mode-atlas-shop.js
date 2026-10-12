/* Read-only, account-bound wallet projection. The server alone owns money.
   There is deliberately no local credit, spend or purchase operation. */
(function(root,factory){
  if(typeof module==='object'&&module.exports){module.exports=factory;return;}
  const owner=factory({user:()=>root.KanaCloudSync?.getUser?.()?.uid||'',online:()=>navigator.onLine!==false,
    fetch:uid=>root.ModeAtlasSocial.call('shop',{},uid),
    changed:()=>root.dispatchEvent(new CustomEvent('modeAtlasShopChanged'))});
  root.ModeAtlasShop=owner;
  root.addEventListener('modeAtlasAccountWillChange',owner.clear);
  root.addEventListener('modeAtlasAccountSignedOut',owner.clear);
  root.addEventListener('kanaCloudSyncStatusChanged',()=>{if(document.querySelector('[data-ma-shop]:not([hidden])'))void owner.refresh();});
  root.addEventListener('online',()=>{if(document.querySelector('[data-ma-shop]:not([hidden])'))void owner.refresh(true);});
})(typeof window!=='undefined'?window:globalThis,function(dependencies){
  'use strict';
  const {user,online,fetch,changed=()=>{},now=Date.now}=dependencies;
  let epoch=0,uid='',balance=null,status='idle',pending=null,checkedAt=0;
  function current(){return {status:!user()?'guest':uid!==user()?'idle':status,balance:user()&&uid===user()&&status==='ready'?balance:null};}
  function clear(){epoch++;uid='';balance=null;status='idle';pending=null;checkedAt=0;changed();}
  async function refresh(force=false){
    const account=user();
    if(account!==uid){clear();uid=account;}
    if(!account){changed();return current();}
    if(pending)return pending;
    if(!online()){balance=null;status='offline';changed();return current();}
    if(!force&&status==='ready'&&now()-checkedAt<60000)return current();
    const ticket=epoch;status='loading';balance=null;changed();
    pending=(async()=>{
      try{
        const result=await fetch(account);
        if(ticket!==epoch||account!==user())return current();
        if(result?.version!==1||result.currency!=='atlas-tokens'||!Number.isSafeInteger(result.balance)||result.balance<0||result.balance>1_000_000_000||result.purchasesEnabled!==false)throw new Error('Invalid wallet');
        balance=result.balance;checkedAt=now();status='ready';
      }catch{if(ticket===epoch&&account===user()){balance=null;status='unavailable';}}
      finally{if(ticket===epoch){pending=null;changed();}}
      return current();
    })();return pending;
  }
  return Object.freeze({current,refresh,clear});
});
