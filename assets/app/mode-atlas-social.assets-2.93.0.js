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
    transport:async(action,data,uid)=>{
      const send=await client();
      if(root.KanaCloudSync.getUser()?.uid!==uid)throw Object.assign(new Error('The account changed.'),{code:'account-changed'});
      return (await send({action,data,expectedUid:uid})).data;
    }
  });
})(typeof window!=='undefined'?window:globalThis,function createSocialClient(dependencies){
  'use strict';
  const {enabled,user,online,transport}=dependencies;
  const error=(code,message)=>Object.assign(new Error(message),{code});
  async function call(action,data={},expectedUid=user()?.uid){
    const accountAction=['deleteAccount','accountDeletionStatus'].includes(action);
    if(!enabled()&&!accountAction)throw error('unavailable','Friends is not available yet.');
    const uid=user()?.uid;
    if(!uid)throw error('unauthenticated','Sign in to use Friends.');
    if(uid!==expectedUid)throw error('account-changed','The signed-in account changed. Try again.');
    if(!online())throw error('offline','Connect to the internet to use Friends.');
    const result=await transport(action,data,uid);
    if(user()?.uid!==uid&&!(accountAction&&!user()&&result.deleted))throw error('account-changed','The signed-in account changed. Try again.');
    return result;
  }
  function message(error){
    const code=String(error?.code||'').replace(/^functions\//,'');
    if(['offline','account-changed','unauthenticated','invalid-argument','already-exists','not-found','permission-denied','failed-precondition','resource-exhausted'].includes(code))return error.message;
    if(code==='unavailable'&&error.message?.startsWith('Friends is updating.'))return error.message;
    return 'Friends could not be reached. Check your connection and try again.';
  }
  return Object.freeze({call,message,isEnabled:enabled,
    deleteAccount:uid=>call('deleteAccount',{},uid),accountDeletionStatus:uid=>call('accountDeletionStatus',{},uid)});
});
