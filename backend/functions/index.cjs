'use strict';
const {initializeApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {getMessaging}=require('firebase-admin/messaging');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onDocumentWritten}=require('firebase-functions/v2/firestore');
const functionsV1=require('firebase-functions/v1');
const config=require('./shared/mode-atlas-social-config.js');
const {createService,accountActions}=require('./service.cjs');
initializeApp();
const service=createService({db:getFirestore(),auth:getAuth(),messaging:getMessaging()});
const options={region:config.region,maxInstances:2,memory:'256MiB',timeoutSeconds:60};
exports.modeAtlasSocial=onCall({...options,cors:true},request=>{
  if(!config.enabled && process.env.FUNCTIONS_EMULATOR!=='true' && request.data?.action!=='leave' && !accountActions.has(request.data?.action))throw new HttpsError('unavailable','Friends is not available yet.');
  return service.call(request);
});
exports.modeAtlasSocialProgress=onDocumentWritten({...options,document:'users/{uid}/appData/kanaTrainer',retry:true},event=>service.refreshSummary(event.params.uid));
exports.modeAtlasSocialCleanup=onDocumentWritten({...options,document:'socialAccounts/{uid}',retry:true},async event=>{
  await service.refreshCompetition(event.params.uid);
  const account=event.data?.after.data();
  if(account?.deleting)return service.cleanup(event.params.uid,account.deletionId);
});
exports.modeAtlasEngagement=onSchedule({...options,maxInstances:1,concurrency:1,timeoutSeconds:180,schedule:'every 15 minutes',timeZone:'UTC',retryCount:2},()=>service.maintainEngagement());
// Auth deletion is a first-generation trigger; it also covers old app builds.
exports.modeAtlasSocialAccountDeleted=functionsV1.region(config.region).runWith({maxInstances:2,failurePolicy:true}).auth.user().onDelete(async user=>{
  try{await getAuth().getUser(user.uid);return;}catch(error){if(error.code!=='auth/user-not-found')throw error;}
  return service.cleanupAccount(user.uid);
});
