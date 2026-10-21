'use strict';
const {HttpsError}=require('firebase-functions/v2/https');
function requireSession(user,token={},access={}){
  const signedAt=Number(token.auth_time),revokedAt=Math.floor(Date.parse(user.tokensValidAfterTime||'')/1000)||0;
  if(user.disabled||access.disabled)throw new HttpsError('permission-denied','This account is suspended. Contact support@mode-atlas.com.');
  if((revokedAt&&(!Number.isFinite(signedAt)||signedAt<revokedAt))||(access.revokedBefore&&(!Number.isFinite(signedAt)||signedAt<=access.revokedBefore)))
    throw new HttpsError('unauthenticated','This session has ended. Sign in again.');
}
module.exports={requireSession};
