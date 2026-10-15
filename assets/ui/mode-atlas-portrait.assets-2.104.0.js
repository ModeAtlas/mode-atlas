/* The same portrait renderer serves self, Friends and weekly rankings. */
(function(root){
  'use strict';
  // Read-only self presentation; consumers never own auth or fetch a profile.
  function self(){
    const user=root.KanaCloudSync?.getUser?.(),profile=user?root.ModeAtlasSocial?.selfProfile?.():null;
    const saved=root.ModeAtlasAvatar?.presentation?.()||(user?root.ModeAtlasAvatar?.current?.():null);
    const name=String(user?(saved?.displayName||profile?.displayName||user.displayName||''):'').trim().split(/\s+/)[0].slice(0,32);
    const access=user?root.ModeAtlasRewardAccess?.current():root.ModeAtlasRewardAccess?.presentation?.();
    const character=root.ModeAtlasAvatarRules.visible(saved?.character||profile?.character,saved?.level||root.ModeAtlasProgress.getSummary().level,access);
    return {name,character};
  }
  function render(node,profile,user){
    if(!node)return;
    if(profile===undefined){profile=root.ModeAtlasAvatar?.presentation?.()||root.ModeAtlasAvatar?.current()||root.ModeAtlasSocial?.selfProfile?.();user=root.KanaCloudSync?.getUser?.();}
    const view=root.ModeAtlasSocialIdentity.presentation(profile,user),signature=JSON.stringify(view);
    if(node.dataset.portrait===signature)return;node.dataset.portrait=signature;
    node.classList.add('ma-portrait');node.classList.toggle('ma-portrait--character',!!view.character);
    if(view.character){root.ModeAtlasAvatarArt.render(node,view.character,{portrait:true});return;}
    node.textContent=view.symbol;
    if(view.url){const image=document.createElement('img');image.src=view.url;image.alt='';image.referrerPolicy='no-referrer';image.addEventListener('error',()=>{if(node.dataset.portrait===signature)node.textContent=view.symbol;},{once:true});node.replaceChildren(image);}
  }
  root.ModeAtlasPortrait=Object.freeze({render,self});
})(window);
