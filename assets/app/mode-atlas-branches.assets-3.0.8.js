/* Shared branch identity and continuation. Each branch retains its own learner
   state, assessment, session and mastery owners. */
(function(root){
  'use strict';
  const items=Object.freeze([
    {id:'kana',name:'Kana',href:'/kana/',description:'Hiragana & katakana',action:'Kana learning path'},
    {id:'kanji',name:'Kanji',href:'/kanji/',description:'Characters & meanings',action:'Open Kanji'},
    {id:'words',name:'Word Bank',href:'/wordbank/',description:'Vocabulary & everyday phrases',action:'Open Word Bank'}
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
      const situation=root.ModeAtlasWordLessonState.due()[0];
      if(situation)return {title:'Use your Japanese again',reason:'Try a familiar pattern in another situation.',meta:'Word Bank · Recall and use',href:'/wordbank/?application='+encodeURIComponent(situation)};
      const unfinished=Object.entries(root.ModeAtlasWordLessonState.read()).filter(([,row])=>row.startedAt&&row.phase!=='complete').sort((a,b)=>b[1].updatedAt-a[1].updatedAt)[0];
      if(unfinished)return {title:'Continue your word lesson',reason:'Pick up where you left off.',meta:'Word Bank · Short lessons',href:'/wordbank/?lesson='+encodeURIComponent(unfinished[0])};
      const due=root.ModeAtlasWordBank.due().length;
      return {title:due?'Revisit your words':'Your next word lesson',reason:due?`${due} saved words are ready to recall.`:'Practise a useful everyday situation.',meta:'Word Bank · Learn and review',href:due?'/wordbank/?review=1':'/wordbank/?lesson=next'};
    }
    return kana;
  }
  root.ModeAtlasBranches=Object.freeze({items,current,recommend});
})(window);
