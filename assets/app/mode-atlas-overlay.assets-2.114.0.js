/* Shared scroll/viewport ownership for account panels and dialogs. Mobile
   keyboards pan the visual viewport as well as resize it. Follow both without
   changing the page's scroll position or asking WebKit to scroll another parent. */
(function ModeAtlasOverlay(root){
  'use strict';
  const layers=new Set();let saved=null;
  function measure(){
    const view=root.visualViewport,style=document.documentElement.style;
    style.setProperty('--ma-overlay-height',(view?.height||root.innerHeight)+'px');
    style.setProperty('--ma-overlay-top',(view?.offsetTop||0)+'px');
    style.setProperty('--ma-overlay-left',(view?.offsetLeft||0)+'px');
    style.setProperty('--ma-overlay-width',(view?.width||root.innerWidth)+'px');
  }
  function lock(layer){
    if(layers.has(layer))return;
    if(!layers.size){
      const body=document.body;saved={x:root.scrollX,y:root.scrollY,position:body.style.position,top:body.style.top,left:body.style.left,width:body.style.width,overflow:body.style.overflow};
      Object.assign(body.style,{position:'fixed',top:-saved.y+'px',left:-saved.x+'px',width:'100%',overflow:'hidden'});
      root.visualViewport?.addEventListener('resize',measure);root.visualViewport?.addEventListener('scroll',measure);root.addEventListener('resize',measure);
    }
    layers.add(layer);layer.classList.add('ma-viewport-layer');measure();
  }
  function unlock(layer){
    if(!layers.delete(layer))return;
    layer.classList.remove('ma-viewport-layer');
    if(!layers.size&&saved){
      const {x,y,...style}=saved;saved=null;Object.assign(document.body.style,style);root.scrollTo({left:x,top:y,behavior:'instant'});
      root.visualViewport?.removeEventListener('resize',measure);root.visualViewport?.removeEventListener('scroll',measure);root.removeEventListener('resize',measure);
    }
  }
  root.ModeAtlasOverlay=Object.freeze({lock,unlock});
})(window);
