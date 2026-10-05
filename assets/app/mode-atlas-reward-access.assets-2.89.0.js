/* Account-bound presentation cache. Firebase remains the authority for grants. */
(function(root,factory){
  if(typeof module==='object'&&module.exports){module.exports=factory;return;}
  const key='modeAtlasRewardAccess';
  const owner=factory({user:()=>root.KanaCloudSync?.getUser?.()?.uid||'',online:()=>navigator.onLine!==false,
    read:()=>root.ModeAtlasStorage.json(key,null),write:value=>value?root.ModeAtlasStorage.setJSON(key,value):root.ModeAtlasStorage.remove(key),
    fetch:uid=>root.ModeAtlasSocial.call('rewards',{},uid),
    changed:()=>root.dispatchEvent(new CustomEvent('modeAtlasRewardAccessChanged'))});
  root.ModeAtlasRewardAccess=owner;
  root.addEventListener('modeAtlasAccountWillChange',owner.clear);
  root.addEventListener('modeAtlasAccountSignedOut',owner.clear);
  root.addEventListener('kanaCloudSyncStatusChanged',()=>{void owner.refresh();});
  root.addEventListener('modeAtlasAppStateChanged',event=>{if(event.detail.isActive)void owner.refresh();});
  root.addEventListener('online',()=>{void owner.refresh(true);});
  root.addEventListener('pageshow',()=>{void owner.refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void owner.refresh();});
  void root.KanaCloudSync?.ready?.then(()=>owner.refresh());
})(typeof window!=='undefined'?window:globalThis,function createRewardAccess(dependencies){
  'use strict';
  const {user,online,read,write,fetch,changed=()=>{},now=Date.now}=dependencies;
  const empty=Object.freeze({allCustom:false,grants:Object.freeze([])});
  let epoch=0,pending=null,lastAttempt=0,lastUid='',status='idle';
  function current(){
    const uid=user(),cached=read();
    if(!uid||cached?.uid!==uid||!Number.isFinite(cached.checkedAt)||cached.checkedAt>now()||!Number.isFinite(cached.access?.validUntil)||cached.access.validUntil<=now()||now()-cached.checkedAt>86400000)return empty;
    return {allCustom:cached.access.allCustom===true,grants:Array.isArray(cached.access.grants)?cached.access.grants.filter(value=>typeof value==='string'):[]};
  }
  function clear(){epoch++;pending=null;lastAttempt=0;lastUid='';status='idle';write(null);changed();}
  async function refresh(force=false){
    const uid=user();
    if(uid!==lastUid){epoch++;pending=null;lastAttempt=0;lastUid=uid;status='idle';changed();}
    if(!uid)return current();
    if(pending)return pending;
    if(!force&&lastAttempt&&now()-lastAttempt<60000)return current();
    if(!online()){status='offline';changed();return current();}
    const ticket=epoch;lastAttempt=now();status='loading';changed();
    pending=(async()=>{
      try{
        const result=await fetch(uid);
        if(ticket!==epoch||uid!==user())return current();
        if(!Array.isArray(result?.grants)||!Number.isFinite(result.validUntil)||result.validUntil<=now())throw new Error('Invalid reward access');
        write({uid,checkedAt:now(),access:{allCustom:result.allCustom===true,grants:result.grants.filter(value=>typeof value==='string'),validUntil:Math.min(result.validUntil,now()+86400000)}});status='ready';
      }catch{if(ticket===epoch&&uid===user())status='error';}
      finally{if(ticket===epoch){pending=null;changed();}}
      return current();
    })();return pending;
  }
  return Object.freeze({current,refresh,clear,status:()=>status});
});
