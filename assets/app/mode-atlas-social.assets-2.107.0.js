/* One social transport, using the existing Firebase app and account owner. */
(function(root,factory){
  if(typeof module==='object' && module.exports){module.exports=factory;return;}
  let clientPromise;
  function client(){
    if(!clientPromise)clientPromise=(async()=>{
      const [app,sdk]=await Promise.all([root.KanaCloudSync.getFirebaseApp(),root.ModeAtlasFirebase.load('functions')]);
      return sdk.httpsCallable(sdk.getFunctions(app,root.ModeAtlasSocialConfig.region),'modeAtlasSocial',{timeout:65000});
    })().catch(error=>{clientPromise=null;throw error;});
    return clientPromise;
  }
  root.ModeAtlasSocial=factory({
    enabled:()=>root.ModeAtlasSocialConfig?.enabled===true,
    user:()=>root.KanaCloudSync?.getUser?.(),
    online:()=>navigator.onLine!==false,
    readProfile:()=>root.ModeAtlasStorage.json('modeAtlasSocialProfile',null),
    writeProfile:value=>value?root.ModeAtlasStorage.setJSON('modeAtlasSocialProfile',value):root.ModeAtlasStorage.remove('modeAtlasSocialProfile'),
    profileChanged:()=>root.dispatchEvent(new CustomEvent('modeAtlasSelfProfileChanged')),
    transport:async(action,data,uid)=>{
      const send=await client();
      if(root.KanaCloudSync.getUser()?.uid!==uid)throw Object.assign(new Error('The account changed.'),{code:'account-changed'});
      return (await send({action,data,expectedUid:uid})).data;
    }
  });
  for(const event of ['modeAtlasAccountWillChange','modeAtlasAccountSignedOut'])root.addEventListener(event,root.ModeAtlasSocial.clearProfile);
})(typeof window!=='undefined'?window:globalThis,function createSocialClient(dependencies){
  'use strict';
  const {enabled,user,online,transport,readProfile=()=>null,writeProfile=()=>{},profileChanged=()=>{},now=Date.now}=dependencies;
  let profilePending=null,profileEpoch=0;
  const readPending=new Map(),sharedReads=new Set(['state','list','profile','weeklyState','weeklyList']);
  function selfProfile(){const cached=readProfile();return user()?.uid&&cached?.uid===user().uid&&cached.checkedAt<=now()&&now()-cached.checkedAt<86400000?cached.profile:null;}
  function clearProfile(){profileEpoch++;profilePending=null;readPending.clear();writeProfile(null);profileChanged();}
  async function refreshProfile(){
    const uid=user()?.uid,cached=readProfile();
    if(!uid||!enabled()||!online())return selfProfile();
    if(cached?.uid===uid&&cached.checkedAt<=now()&&now()-cached.checkedAt<60000)return selfProfile();
    if(profilePending?.uid===uid)return profilePending.promise;
    const ticket=profileEpoch,promise=call('state').then(()=>selfProfile()).catch(()=>selfProfile()).finally(()=>{if(ticket===profileEpoch&&profilePending?.uid===uid)profilePending=null;});
    profilePending={uid,promise};return promise;
  }
  const error=(code,message)=>Object.assign(new Error(message),{code});
  async function call(action,data={},expectedUid=user()?.uid){
    const accountAction=['deleteAccount','accountDeletionStatus'].includes(action);
    if(!enabled()&&!accountAction)throw error('unavailable','Friends is not available yet.');
    const uid=user()?.uid;
    if(!uid)throw error('unauthenticated','Sign in to use Friends.');
    if(uid!==expectedUid)throw error('account-changed','The signed-in account changed. Try again.');
    if(!online())throw error('offline','Connect to the internet to use Friends.');
    const ticket=profileEpoch,key=JSON.stringify([uid,ticket,action,data]);
    let request=sharedReads.has(action)?readPending.get(key):null;
    if(!request){
      request=Promise.resolve(transport(action,data,uid));
      if(sharedReads.has(action)){
        readPending.set(key,request);
        const release=()=>{if(readPending.get(key)===request)readPending.delete(key);};
        request.then(release,release);
      }
    }
    const result=await request;
    if((user()?.uid!==uid||ticket!==profileEpoch)&&!(accountAction&&!user()&&result.deleted))throw error('account-changed','The signed-in account changed. Try again.');
    if(action==='state'&&ticket===profileEpoch){
      const profile=result.active&&result.profile?.uid===uid?result.profile:null;
      writeProfile({uid,checkedAt:now(),profile});profileChanged();
    }else if(action==='updateProfile'||action==='removeProfile')clearProfile();
    return result;
  }
  function message(error){
    const code=String(error?.code||'').replace(/^functions\//,'');
    if(['aborted','offline','account-changed','unauthenticated','invalid-argument','already-exists','not-found','permission-denied','failed-precondition','resource-exhausted'].includes(code))return error.message;
    if(code==='unavailable'&&error.message?.startsWith('Friends is updating.'))return error.message;
    return 'Friends could not be reached. Check your connection and try again.';
  }
  return Object.freeze({call,message,isEnabled:enabled,selfProfile,refreshProfile,clearProfile,
    deleteAccount:uid=>call('deleteAccount',{},uid),accountDeletionStatus:uid=>call('accountDeletionStatus',{},uid)});
});
