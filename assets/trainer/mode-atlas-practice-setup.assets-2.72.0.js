/* One presentation owner for the shared setup dialog. iOS geometry is CSS-only. */
(function ModeAtlasPracticeSetup(root){
  'use strict';
  const dialog = document.getElementById('practiceSetupDialog');
  if (!dialog) return;
  const trigger = document.getElementById('modifiersTab');
  const content = document.getElementById('modifiersContent');
  function setOpen(open){
    open = !!open && !document.body.classList.contains('trainer-session-active');
    content.classList.toggle('open',open);
    trigger.classList.toggle('active',open);
    trigger.setAttribute('aria-expanded',String(open));
    trigger.textContent = 'Practice setup';
    document.body.classList.toggle('ma-practice-setup-open',open);
    if (open && !dialog.open) {
      root.ModeAtlasProfile?.close?.();
      root.ModeAtlasSettings?.close?.();
      dialog.showModal();
    } else if (!open && dialog.open) dialog.close();
  }
  function close(){
    if (typeof settings === 'object') settings.activeBottomTab = null;
    setOpen(false);
  }
  document.getElementById('practiceSetupDone').addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{if(!dialog.open)close();});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();}});
  // A downward swipe on the handle dismisses without competing with content scrolling.
  const handle = document.getElementById('practiceSetupHandle');
  let start = null;
  handle.addEventListener('pointerdown',event=>{start={x:event.clientX,y:event.clientY};handle.setPointerCapture(event.pointerId);});
  handle.addEventListener('pointerup',event=>{if(start&&event.clientY-start.y>55&&Math.abs(event.clientX-start.x)<70)close();start=null;});
  handle.addEventListener('pointercancel',()=>{start=null;});
  root.ModeAtlasPracticeSetup = Object.freeze({setOpen,close});
})(window);
