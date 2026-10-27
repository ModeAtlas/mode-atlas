/* Shared presentation for a single learning task or full-page course view.
   Curriculum, answer grading, persistence and navigation remain branch-owned. */
(function(root){
  'use strict';
  let sequence=0;
  const tasks=new Set(),positioned=new WeakSet();let scheduled=false;
  function layout(){
    scheduled=false;
    for(const element of tasks){
      if(!element.isConnected){tasks.delete(element);continue;}
      // A new full-page task starts at its own header, including after a
      // scrolled overview. Subsequent resize must preserve the reading position.
      if(!positioned.has(element)){positioned.add(element);if(root.scrollY>0)root.scrollTo({top:0,left:0,behavior:'instant'});}
      const viewport=root.visualViewport,bottom=viewport?Math.min(root.innerHeight,viewport.offsetTop+viewport.height):root.innerHeight;
      const inset=parseFloat(getComputedStyle(document.body).paddingBottom)||16;
      const top=Math.max(0,element.getBoundingClientRect().top);
      const available=Math.max(160,Math.floor(bottom-top-inset));
      element.style.setProperty('--ma-course-height',available+'px');
      element.dataset.compact=String(available<400);
      const input=document.activeElement,body=element.querySelector('.ma-course-body');
      if(body&&body.contains(input)&&input.matches('input,textarea')){
        const field=input.getBoundingClientRect(),frame=body.getBoundingClientRect();
        if(field.bottom>frame.bottom)body.scrollTop+=field.bottom-frame.bottom+8;
        else if(field.top<frame.top)body.scrollTop-=frame.top-field.top+8;
      }
    }
  }
  function schedule(){if(!scheduled&&tasks.size){scheduled=true;root.requestAnimationFrame(layout);}}
  root.addEventListener('resize',schedule);
  root.addEventListener('modeAtlasViewportLayoutChanged',schedule);
  root.addEventListener('modeAtlasTextSizeChanged',schedule);
  root.visualViewport?.addEventListener('resize',schedule);
  document.fonts?.addEventListener?.('loadingdone',schedule);
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  // Focusing an answer hides the native dock without necessarily resizing the
  // window (for example with a hardware keyboard). Reclaim that space too.
  new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class','style']});
  function node(tag,className,text){const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=String(text);return element;}
  function button(label,onClick,{primary=false}={}){
    const control=node('button','ma-button '+(primary?'ma-button--primary':'ma-button--ghost'),label);
    control.type='button';if(onClick)control.addEventListener('click',onClick);return control;
  }
  function create({title,eyebrow='',progress,onExit,exitLabel='Save & exit',kind='task'}={}){
    const element=node('section','ma-course-view'),header=node('header','ma-course-header'),heading=node('div','ma-course-heading');
    element.dataset.kind=kind==='path'?'path':'task';
    if(eyebrow)heading.append(node('span','ma-kicker',eyebrow));
    const titleNode=node('h1','ma-course-title',title||'Learning');titleNode.id='maCourseTitle'+(++sequence);heading.append(titleNode);element.setAttribute('aria-labelledby',titleNode.id);
    header.append(heading);
    if(onExit){const exit=button(exitLabel,onExit);exit.classList.add('ma-course-exit');header.append(exit);}
    element.append(header);
    if(progress&&Number.isFinite(progress.total)&&progress.total>0){
      const total=Math.max(1,Math.floor(progress.total)),current=Math.max(0,Math.min(total,Math.floor(progress.current)||0)),position=node('div','ma-course-position'),bar=node('progress');
      bar.max=total;bar.value=current;bar.setAttribute('aria-label','Lesson progress');position.append(bar,node('span','',current+' / '+total));element.append(position);
    }
    const body=node('div','ma-course-body'),status=node('p','ma-course-status'),actions=node('footer','ma-course-actions');
    status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=true;
    element.append(body,status,actions);
    if(element.dataset.kind==='task'){tasks.add(element);schedule();}
    function setStatus(message,{tone='info'}={}){status.textContent=message||'';status.hidden=!message;status.dataset.tone=['info','success','warning','error'].includes(tone)?tone:'info';}
    return {element,body,actions,status,setStatus,button};
  }
  root.ModeAtlasCourseUI=Object.freeze({create,button});
})(window);
