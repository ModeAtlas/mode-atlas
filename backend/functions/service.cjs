'use strict';
const {createSocial}=require('./social.cjs');
const {createAccounts}=require('./accounts.cjs');
const accountActions=new Set(['deleteAccount','accountDeletionStatus']);
function createService(dependencies){
  const social=createSocial(dependencies),accounts=createAccounts({...dependencies,social});
  return {...social,cleanupAccount:accounts.cleanup,
    call:request=>accountActions.has(request.data?.action)?accounts.call(request):social.call(request)};
}
module.exports={createService,accountActions};
