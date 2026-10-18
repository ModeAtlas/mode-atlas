/* Trainer setup delegates to the Kana branch's single practice form. */
(function(root){
  'use strict';
  let signature='';
  function render(){
    const host=document.getElementById('modifierOptions');if(!host||!root.ModeAtlasTrainerControls)return;
    const controls=root.ModeAtlasTrainerControls,settings=controls.getSettings(),locked=typeof isModeLocked==='function'&&isModeLocked();
    const key=JSON.stringify([settings,locked,root.ModeAtlasKanaLearning.read().updatedAt]);if(signature===key)return;signature=key;
    const focus=host.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
    const rowsOpen=host.querySelector('details')?.open,scroll=host.closest('dialog')?.scrollTop||0;
    host.replaceChildren(root.ModeAtlasKanaPractice.render({skill:document.body.classList.contains('ma-writing-page')?'writing':'reading',getSettings:controls.getSettings,onChange:controls.update,locked}));
    if(rowsOpen&&host.querySelector('details'))host.querySelector('details').open=true;
    if(focus)[...host.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===focus)?.focus({preventScroll:true});
    if(host.closest('dialog'))host.closest('dialog').scrollTop=scroll;
  }
  root.ModeAtlasModifierMenu=Object.freeze({render});
  document.addEventListener('ma:trainer-ready',render);document.addEventListener('ma:ui-refresh',render);
  document.addEventListener('DOMContentLoaded',render,{once:true});
})(window);
