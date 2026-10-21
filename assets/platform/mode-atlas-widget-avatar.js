/* Native widget artwork is a projection of the existing avatar renderer.
   Never persist PNGs in saves or wait for rendering before publishing progress. */
(function ModeAtlasWidgetAvatar(root){
  'use strict';
  if(!root.ModeAtlasEnv?.isNativeApp||root.ModeAtlasWidgetAvatar)return;
  let epoch=0,key='',rendering=false,artwork=null,acknowledged=null;
  function clear(){epoch++;key='';rendering=false;artwork=null;acknowledged=null;}
  function selection(){
    const profile=root.ModeAtlasAvatar?.presentation?.();
    if(!profile?.character||!root.ModeAtlasAvatarArt||!root.ModeAtlasAvatarRules)return null;
    const character=root.ModeAtlasAvatarRules.normalize(profile.character);
    const owner=root.KanaCloudSync?.getUser?.()?.uid||root.ModeAtlasStorage?.get?.('modeAtlasLastUserId','');
    return {character,key:owner+':'+JSON.stringify(character)};
  }
  async function prepare(){
    const selected=selection();
    if(!selected||selected.key===key&&(rendering||artwork))return;
    const ticket=++epoch;key=selected.key;rendering=true;artwork=null;
    let url;
    try{
      const source=root.ModeAtlasAvatarArt.svg(selected.character);
      const svg=new DOMParser().parseFromString(source,'image/svg+xml').documentElement;
      const [, ,width,height]=svg.getAttribute('viewBox').split(/\s+/).map(Number);
      // Two device pixels per point is sufficient at the largest widget size.
      svg.setAttribute('width',String(width*2));svg.setAttribute('height',String(height*2));
      url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
      const image=new Image();image.src=url;await image.decode();
      if(ticket!==epoch||selection()?.key!==selected.key)return;
      const canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      const png=canvas.toDataURL('image/png').split(',')[1];
      if(png.length>700000)return;
      artwork={key:selected.key,png};
      root.dispatchEvent(new CustomEvent('modeAtlasWidgetAvatarReady'));
    }catch{/* A portrait failure must not hold up study progress. */}
    finally{if(url)URL.revokeObjectURL(url);if(ticket===epoch)rendering=false;}
  }
  function pending(){void prepare();return artwork&&artwork!==acknowledged?artwork:null;}
  root.ModeAtlasWidgetAvatar=Object.freeze({pending,clear,acknowledge(value){if(value&&value===artwork)acknowledged=value;}});
  for(const event of ['modeAtlasAvatarChanged','pageshow'])root.addEventListener(event,()=>void prepare());
  for(const event of ['modeAtlasAccountWillChange','modeAtlasAccountSignedOut','modeAtlasDataCleared'])root.addEventListener(event,clear);
  // The initial native projection can publish immediately with its last asset.
  // Artwork is prepared once, then only when the actual character changes.
  void prepare();
})(window);
