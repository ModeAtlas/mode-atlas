'use strict';
// Explicit operator migration. Uses Application Default Credentials; never
// identifies the administrator by email at request time. No automatic grant.
const functionsRequire=require('node:module').createRequire(require.resolve('../functions/package.json'));
const {initializeApp}=functionsRequire('firebase-admin/app');
const {getAuth}=functionsRequire('firebase-admin/auth');
const [uid,operation]=process.argv.slice(2);
if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid||'')||!['grant','revoke'].includes(operation))throw Error('Usage: node backend/tools/set-admin.cjs <verified UID> grant|revoke');
initializeApp();
(async()=>{const auth=getAuth(),user=await auth.getUser(uid);if(operation==='grant'&&(!user.emailVerified||user.disabled))throw Error('Choose an enabled, verified account.');const claims={...user.customClaims};if(operation==='grant')claims.modeAtlasAdmin=true;else delete claims.modeAtlasAdmin;await auth.setCustomUserClaims(uid,claims);await auth.revokeRefreshTokens(uid);console.log('Administrator claim '+operation+' completed for UID '+uid+'. Sign in again.');})().catch(error=>{console.error(error.message);process.exitCode=1;});
