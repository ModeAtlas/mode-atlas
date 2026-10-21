'use strict';
const {HttpsError}=require('firebase-functions/v2/https');
const {createSocial}=require('./social.cjs');
const {createAccounts}=require('./accounts.cjs');
const accountActions=new Set(['deleteAccount','accountDeletionStatus']);
function createService(dependencies){
  const social=createSocial(dependencies),accounts=createAccounts({...dependencies,social});
  return {...social,cleanupAccount:accounts.cleanup,
    call:async request=>{
      try{return await(accountActions.has(request.data?.action)?accounts.call(request):social.call(request));}
      catch(error){if(error.code==='invalid-account-save')throw new HttpsError('failed-precondition','Your cloud save needs repair. Keep your device copy and contact support@mode-atlas.com.');throw error;}
    }};
}
module.exports={createService,accountActions};
