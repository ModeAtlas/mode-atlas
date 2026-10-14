/* One account-bound avatar preference. Public profiles are projections of it. */
(function(root,factory){
  if(typeof module==='object'&&module.exports){module.exports=factory;return;}
  const key='modeAtlasAvatarProfile';
  const owner=factory({user:()=>root.KanaCloudSync?.getUser?.()?.uid||'',online:()=>navigator.onLine!==false,
    read:()=>root.ModeAtlasStorage.json(key,null),write:value=>value?root.ModeAtlasStorage.setJSON(key,value):root.ModeAtlasStorage.remove(key),
    restoring:()=>!root.KanaCloudSync||root.KanaCloudSync.isAuthResolved?.()===false,
    restoredUser:()=>root.ModeAtlasStorage.get('modeAtlasLastUserId',''),
    call:(action,data,uid)=>root.ModeAtlasSocial.call(action,data,uid),
    valid:value=>root.ModeAtlasSocialIdentity.avatar(value?.avatar)&&root.ModeAtlasAvatarRules.valid(value?.character),
    changed:()=>root.dispatchEvent(new CustomEvent('modeAtlasAvatarChanged'))});
  root.ModeAtlasAvatar=owner;
  for(const event of ['modeAtlasAccountWillChange','modeAtlasAccountSignedOut'])root.addEventListener(event,owner.clear);
  for(const event of ['kanaCloudSyncStatusChanged','online','pageshow'])root.addEventListener(event,()=>{void owner.refresh().catch(()=>{});});
  root.addEventListener('modeAtlasRewardAccessChanged',()=>{void owner.refresh().catch(()=>{});});
  void root.KanaCloudSync?.ready?.then(()=>owner.refresh()).catch(()=>{});
})(typeof window!=='undefined'?window:globalThis,function(dependencies){
  'use strict';
  const {user,online,call,valid,read=()=>null,write=()=>{},changed=()=>{},now=Date.now,restoring=()=>false,restoredUser=()=>''}=dependencies;
  let uid=user(),epoch=0,readEpoch=0,pending=null,busy=false,cached=read();
  const acceptable=value=>value?.version===1&&Number.isSafeInteger(value.revision)&&value.revision>=0&&valid(value);
  if(!acceptable(cached?.value)||uid&&cached?.uid!==uid)cached=null;
  function forAccount(active){return active&&cached?.uid===active&&Number.isFinite(cached.checkedAt)&&cached.checkedAt<=now()&&now()-cached.checkedAt<86400000?cached.value:null;}
  function current(){return forAccount(user());}
  // Only appearance may use the last bound account during auth restoration.
  // Editing and saving still require the authenticated user; account events erase it.
  function presentation(){return user()?current():restoring()?forAccount(restoredUser()):null;}
  function clear(){epoch++;uid='';cached=null;pending=null;busy=false;write(null);changed();}
  function account(){if(uid!==user()){if(cached?.uid!==user())clear();else{epoch++;pending=null;busy=false;}uid=user();}return uid;}
  const error=(code,message)=>Object.assign(new Error(message),{code});
  function accept(value){if(!acceptable(value))throw error('unavailable','Your avatar could not be loaded.');cached={uid,value,checkedAt:now()};write(cached);changed();return value;}
  async function refresh(force=false){
    const active=account();if(!active||!online())return current();
    if(pending)return pending;if(busy)return current();
    if(!force&&current()&&now()-cached.checkedAt<60000)return current();
    const ticket=epoch,reading=++readEpoch;
    pending=call('avatarState',{characterVersion:2},active).then(value=>ticket===epoch&&reading===readEpoch&&active===user()?accept(value):null).finally(()=>{if(ticket===epoch&&reading===readEpoch)pending=null;});
    return pending;
  }
  async function save(selection,revision){
    const active=account();if(!active)throw error('unauthenticated','Sign in to save your avatar.');
    if(!online())throw error('offline','Connect to save your avatar.');
    if(busy)throw error('failed-precondition','Your avatar is still saving.');
    const ticket=epoch;if(active!==user())throw error('account-changed','The signed-in account changed.');
    // Saving the small private profile must not wait for a learning-save upload
    // or a background avatar read. The server checks its own level/entitlements.
    // Invalidate older reads so a late response cannot replace the saved look.
    busy=true;readEpoch++;pending=null;
    try{
      const value=await call('avatarUpdate',{...selection,revision},active);
      if(ticket!==epoch||active!==user())throw error('account-changed','The signed-in account changed.');
      return accept(value);
    }finally{if(ticket===epoch)busy=false;}
  }
  function message(failure){const code=String(failure?.code||'').replace(/^functions\//,'');return ['aborted','offline','account-changed','unauthenticated','invalid-argument','permission-denied','failed-precondition','resource-exhausted'].includes(code)?failure.message:'Your avatar could not be saved. Check your connection and try again.';}
  return Object.freeze({current,presentation,refresh,save,clear,message});
});
