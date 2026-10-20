/* A confirmed guest SDK boundary for navigation/account UI tests. Network
   failure is a separate state, exercised with the real loader in stability. */
module.exports=async function firebaseGuest(page){
  await page.route(/\/firebase-(app|auth)(?:\.assets-[\d.]+)?\.js(?:\?.*)?$/,route=>{
    const app=/\/firebase-app[.]/.test(route.request().url());
    return route.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'text/javascript',body:app
      ? 'const app={};export const initializeApp=()=>app,getApps=()=>[],getApp=()=>app;'
      : 'export const getAuth=()=>({currentUser:null}),initializeAuth=getAuth,browserLocalPersistence={},getRedirectResult=async()=>null,onAuthStateChanged=(_auth,callback)=>{queueMicrotask(()=>callback(null));return ()=>{};};export class GoogleAuthProvider{setCustomParameters(){}}'
    });
  });
};
