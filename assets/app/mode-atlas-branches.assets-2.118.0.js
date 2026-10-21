/* Shared branch identity and continuation. Each branch retains its own learner
   state, assessment, session and mastery owners. */
(function(root){
  'use strict';
  const items=Object.freeze([
    {id:'kana',name:'Kana',href:'/kana/',description:'Connect shapes and sounds.',detail:'Read · Recall · Handwrite',action:'Kana learning path'},
    {id:'kanji',name:'Kanji',href:'/kanji/',description:'Build a world of meaning.',detail:'Learn · Recognise · Remember',action:'Open Kanji'},
    {id:'words',name:'Word Bank',href:'/wordbank/',description:'Your Japanese, collected.',detail:'Words · Examples · Review',action:'Open Word Bank'}
  ]);
  function current(path=location.pathname){
    return /^\/(kana|reading|writing)\//.test(path)?'kana':path.startsWith('/kanji/')?'kanji':path.startsWith('/wordbank/')?'words':'hub';
  }
  function recommend(kana){
    const last=root.ModeAtlasStorage.json('modeAtlasLastMode',{});
    if(last.branchId==='kanji'||/kanji/.test(last.href||'')){
      const due=root.ModeAtlasStudyPlan.kanjiReviews()[0];
      return due?{title:'Revisit your Kanji',reason:`${due.due} ${due.label} reviews are ready.`,meta:'Spaced recall',href:due.href}:
        {title:'Continue with Kanji',reason:'Return to your lessons, pronunciation and meanings.',meta:'Kanji · Your learning path',href:'/kanji/'};
    }
    if(last.branchId==='words'||/wordbank/i.test(last.href||'')){
      const due=root.ModeAtlasWordBank.due().length;
      return {title:due?'Revisit your words':'Grow your Word Bank',reason:due?`${due} saved words are ready to recall.`:'Save a word you have met, with its reading and an example.',meta:'Word Bank · Your collection',href:'/wordbank/'};
    }
    return kana;
  }
  root.ModeAtlasBranches=Object.freeze({items,current,recommend});
})(window);
