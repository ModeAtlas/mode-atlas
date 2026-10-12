'use strict';
const {HttpsError}=require('firebase-functions/v2/https');
const catalogue=require('./shared/mode-atlas-shop-catalogue.js');

// A separate private ledger is reserved for verified StoreKit transactions.
// This release only reads a server-created wallet; it cannot credit or spend.
function createCommerce({db}){
  const reference=uid=>db.doc('commerceAccounts/'+uid);
  async function state(uid){
    const record=await reference(uid).get(),wallet=record.data();
    const balance=record.exists?wallet?.balance:0;
    if(record.exists&&(wallet?.version!==1||wallet.currency!==catalogue.currency.id)||!Number.isSafeInteger(balance)||balance<0||balance>1_000_000_000)
      throw new HttpsError('failed-precondition','Your token balance is unavailable. Please try again later.');
    return {version:1,currency:catalogue.currency.id,balance,purchasesEnabled:catalogue.purchasesEnabled};
  }
  return {state,erase:uid=>db.recursiveDelete(reference(uid))};
}
module.exports={createCommerce};
