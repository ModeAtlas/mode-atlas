/* Small public learning-event contract. Subscribers may observe a branch and
   transition only: no answers, lesson text, identifiers or account details. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.ModeAtlasLearningEvents=factory(root);
})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const types=Object.freeze(['lessonStarted','lessonCompleted','practiceCompleted','reviewCompleted','lessonExited']);
  const branches=Object.freeze(['kana','kanji','words']);
  function emit(type,branch){
    if(!types.includes(type)||!branches.includes(branch))return false;
    root.dispatchEvent(new CustomEvent('modeAtlasLearningEvent',{detail:Object.freeze({type,branch})}));
    return true;
  }
  function subscribe(listener){
    const handler=event=>{
      const value=event.detail;
      if(types.includes(value?.type)&&branches.includes(value?.branch))listener(Object.freeze({type:value.type,branch:value.branch}));
    };
    root.addEventListener('modeAtlasLearningEvent',handler);
    return ()=>root.removeEventListener('modeAtlasLearningEvent',handler);
  }
  return Object.freeze({types,branches,emit,subscribe});
});
