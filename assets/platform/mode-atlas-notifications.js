/* Account-bound push preferences. iOS owns permissions/tokens; Firebase owns delivery. */
(function(root){
  'use strict';
  if(!root.ModeAtlasEnv?.isNativeApp)return;
  const keys=['dailyGoals','weeklyGoals','streak','overtaken'];
  const blank=()=>Object.fromEntries(keys.map(key=>[key,false]));
  const uid=()=>root.KanaCloudSync?.getUser?.()?.uid;
  let owner=null,token=null,preferences=blank(),revision=0,refreshing=null,tokenWork=Promise.resolve();
  const current=(account,ticket)=>account===uid()&&ticket===revision;
  function nativeToken(method,account,ticket){
    const work=tokenWork.then(()=>{
      if(method==='getPushToken'&&!current(account,ticket))throw new Error('The account changed.');
      return root.AtlasPlatform[method]();
    });
    tokenWork=work.catch(()=>{});return work;
  }
  const supported=()=>!!root.AtlasPlatform.getCapabilities().remoteNotifications;
  async function read(){
    const account=uid(),ticket=revision;
    if(!account)return {supported:supported(),signedIn:false,preferences:blank()};
    const result=await root.ModeAtlasSocial.call('notificationState',{},account);
    if(account!==uid()||ticket!==revision)throw new Error('The account changed.');
    if(owner!==account){owner=account;token=null;}
    preferences=result.preferences;
    return {supported:supported(),signedIn:true,preferences:{...preferences}};
  }
  async function configure(next){
    const account=uid(),ticket=++revision;
    if(!account)throw new Error('Sign in to choose account notifications.');
    if(!supported())throw new Error('Push notifications are unavailable in this build.');
    const enabled=keys.some(key=>next[key]);
    let currentToken=owner===account?token:null;
    if(enabled&&keys.some(key=>next[key]&&!preferences[key])){
      const permission=await root.AtlasPlatform.requestNotifications();
      if(!current(account,ticket))throw new Error('The account changed.');
      if(!permission.granted)throw new Error('Enable notifications in iPhone Settings, then try again.');
      try{currentToken=(await nativeToken('getPushToken',account,ticket)).token;}
      catch{throw new Error('This iPhone could not register for push notifications. Check the app’s push setup and try again.');}
    }
    if(!current(account,ticket))throw new Error('The account changed.');
    const result=await root.ModeAtlasSocial.call('configureNotifications',{preferences:next,token:currentToken||'',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'},account);
    if(account!==uid()||ticket!==revision)return;
    owner=account;token=currentToken;preferences=result.preferences;
    if(!enabled){token=null;await nativeToken('deletePushToken');}
    root.dispatchEvent(new CustomEvent('modeAtlasEngagementChanged'));
    return result;
  }
  async function signOut(){
    ++revision;
    const previousOwner=owner,previousToken=token;owner=null;token=null;preferences=blank();
    await Promise.allSettled([
      previousOwner&&previousToken&&previousOwner===uid()?root.ModeAtlasSocial.call('unregisterNotifications',{token:previousToken},previousOwner):Promise.resolve(),
      nativeToken('deletePushToken')
    ]);
  }
  async function reconnect(){
    if(refreshing||!uid()||!supported()||root.navigator.onLine===false)return;
    const account=uid(),ticket=revision;
    refreshing=(async()=>{
      const result=await read();
      if(!current(account,ticket)||!keys.some(key=>result.preferences[key]))return;
      const permission=await root.AtlasPlatform.getNotificationStatus();if(!permission.granted)return;
      if(!current(account,ticket))return;
      const newToken=(await nativeToken('getPushToken',account,ticket)).token;
      if(account!==uid()||ticket!==revision)return;
      await root.ModeAtlasSocial.call('configureNotifications',{preferences:result.preferences,token:newToken,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'},account);
      if(account===uid()&&ticket===revision){owner=account;token=newToken;}
    })().catch(()=>{}).finally(()=>{refreshing=null;if(uid()&&uid()!==account)void reconnect();});
    return refreshing;
  }
  root.addEventListener('modeAtlasAccountSignedOut',()=>{void signOut();});
  root.addEventListener('modeAtlasDataCleared',()=>{void signOut();});
  root.addEventListener('modeAtlasPushTokenChanged',()=>{void reconnect();});
  let lastAccount;
  root.addEventListener('kanaCloudSyncStatusChanged',()=>{const account=uid();if(account!==lastAccount){lastAccount=account;void reconnect();}});
  root.addEventListener('online',()=>{void reconnect();});
  root.ModeAtlasNotifications=Object.freeze({read,configure,signOut,reconnect});
})(window);
