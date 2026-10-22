/* Optional interface modules load on first use. Learning/state owners stay
   synchronous; a failed download offers retry without replacing saved data. */
(function(root){
  'use strict';
  const suffix=document.currentScript?.src.match(/(\.assets-\d+\.\d+\.\d+)\.js/)?.[1]||'';
  const pending=new Map();
  let accountPending;
  function load(path){
    if(pending.has(path))return pending.get(path);
    const promise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/'+path.replace(/\.js$/,suffix+'.js');script.onload=resolve;script.onerror=()=>{script.remove();pending.delete(path);reject(Error('This screen could not load. Connect and try again.'));};document.head.append(script);});pending.set(path,promise);return promise;
  }
  for(const [name,path,methods]of [
    ['ModeAtlasAvatarUI','assets/ui/mode-atlas-avatar-ui.js',['open']],
    ['ModeAtlasSocialUI','assets/ui/mode-atlas-social-ui.js',['open','mount']],
    ['ModeAtlasShopUI','assets/ui/mode-atlas-shop-ui.js',['mount','refresh','renderInventory']],
    ['ModeAtlasKanaMastery','assets/ui/mode-atlas-kana-mastery.js',['render','detail']],
    ['ModeAtlasKanjiMastery','assets/ui/mode-atlas-kanji-mastery.js',['render']]
  ]){
    const proxy={};
    for(const method of methods)proxy[method]=(...args)=>{
      if(['render','detail','mount','renderInventory'].includes(method)){
        const inPlace=method==='mount'||method==='renderInventory',node=inPlace?args[0]:document.createElement('section');
        const retry=()=>{node.textContent='Loading…';void load(path).then(()=>{if(root[name]===proxy)throw Error('This screen did not initialise.');if(inPlace)root[name][method](...args);else node.replaceWith(root[name][method](...args));}).catch(error=>{node.textContent=error.message;const button=document.createElement('button');button.className='ma-button ma-button--ghost';button.textContent='Try again';button.addEventListener('click',retry);node.append(button);});};retry();return node;
      }
      return load(path).then(()=>root[name][method](...args)).catch(error=>root.ModeAtlasToast?.show?.(error.message));
    };
    root[name]=Object.freeze(proxy);
  }
  document.addEventListener('click',event=>{if(event.target.closest('[data-ma-avatar-open]')&&pending.get('assets/ui/mode-atlas-avatar-ui.js')===undefined){event.preventDefault();void root.ModeAtlasAvatarUI.open();}});
  root.ModeAtlasFeatureLoader=Object.freeze({load,account(){
    if(!accountPending)accountPending=Promise.all([
      load('assets/ui/mode-atlas-profile-menu.js'),load('assets/ui/mode-atlas-settings-menu.js'),load('assets/ui/mode-atlas-native-settings.js')
    ]).then(()=>load('assets/ui/mode-atlas-account-bindings.js')).catch(error=>{accountPending=null;throw error;});
    return accountPending;
  }});
})(window);
