/* Attestation belongs to the existing Firebase app, never a second Auth app. */
(function(root){
  'use strict';
  let pending;
  const ready=()=>root.ModeAtlasEnv?.isNativeApp?root.MODE_ATLAS_APP_CHECK?.iosEnabled===true:!!root.MODE_ATLAS_APP_CHECK?.webSiteKey;
  async function initialize(app){
    if(!ready())return false;
    if(!pending)pending=(async()=>{
      const sdk=await root.ModeAtlasFirebase.load('app-check');let provider;
      if(root.ModeAtlasEnv?.isNativeApp){
        const native=root.Capacitor?.Plugins?.FirebaseAppCheck;if(!native)throw Error('App verification is unavailable.');
        await native.initialize({isTokenAutoRefreshEnabled:true});
        provider=new sdk.CustomProvider({getToken:async()=>{
          const result=await native.getToken({forceRefresh:false});
          if(!result.token||!Number.isFinite(result.expireTimeMillis))throw Error('App verification failed.');
          return result;
        }});
      }else provider=new sdk.ReCaptchaEnterpriseProvider(root.MODE_ATLAS_APP_CHECK.webSiteKey);
      sdk.initializeAppCheck(app,{provider,isTokenAutoRefreshEnabled:true});return true;
    })().catch(error=>{pending=null;throw error;});
    return pending;
  }
  root.ModeAtlasAppCheck=Object.freeze({ready,initialize});
})(window);
