/* SDK transport only. Firebase app/session ownership stays in cloud-sync.js. */
(function(root){
  'use strict';
  const pending=new Map(),modules=new Set(['app','auth','firestore','functions']);
  root.ModeAtlasFirebase=Object.freeze({load(name){
    if(!modules.has(name))return Promise.reject(new Error('Unknown Firebase module.'));
    if(!pending.has(name)){
      const path=root.ModeAtlasEnv?.isNativeApp
        ? root.ModeAtlasVersionFile.appUrl('/assets/vendor/firebase-'+name+'.assets-'+root.ModeAtlasVersion+'.js')
        : 'https://www.gstatic.com/firebasejs/12.12.1/firebase-'+name+'.js';
      pending.set(name,import(path).catch(error=>{pending.delete(name);throw error;}));
    }
    return pending.get(name);
  }});
})(window);
