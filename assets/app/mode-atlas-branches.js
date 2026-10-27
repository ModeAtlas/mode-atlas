/* Shared branch identity and continuation. Each branch retains its own learner
   state, assessment, session and mastery owners. */
(function(root){
  'use strict';
  const items=Object.freeze([
    {id:'kana',name:'Kana',href:'/kana/',description:'Hiragana & katakana',action:'Kana learning path'},
    {id:'kanji',name:'Kanji',href:'/kanji/',description:'Characters & meanings',action:'Open Kanji'},
    {id:'words',name:'Words',href:'/wordbank/',description:'Vocabulary & your word bank',action:'Open Words'}
  ]);
  function current(path=location.pathname){
    return /^\/(kana|reading|writing)\//.test(path)?'kana':path.startsWith('/kanji/')?'kanji':path.startsWith('/wordbank/')?'words':'hub';
  }
  function recommend(kana){
    const last=root.ModeAtlasStorage.json('modeAtlasLastMode',{});
    if(last.branchId==='kanji'||/kanji/.test(last.href||'')){
      const due=root.ModeAtlasStudyPlan.kanjiReviews()[0];
      const state=root.ModeAtlasKanjiState;
      const path=state?.learningPath?.(state.read().settings.level);
      return due?{title:'Revisit your Kanji',reason:`${due.due} ${due.label} reviews are ready.`,meta:'Spaced recall',href:due.href}:
        {title:path?.title||'Continue with Kanji',reason:path?.copy||'Return to your lessons, pronunciation and meanings.',meta:'Kanji · Your learning path',href:'/kanji/'};
    }
    if(last.branchId==='words'||/wordbank/i.test(last.href||'')){
      const vocabulary=root.ModeAtlasWordLessonState.vocabularyOverview?.()||{};
      if(vocabulary.due)return {title:'Revisit your words',reason:`${vocabulary.due} words are ready to recall.`,meta:'Words · Spaced practice',href:'/wordbank/?vocabulary=review'};
      // A deliberate visit to the personal bank or a legacy phrase lesson keeps
      // its continuation. General Words visits lead into the vocabulary course.
      if(/(?:[?&]view=bank|[?&]review=)/.test(last.href||'')){
        const due=root.ModeAtlasWordBank.due().length;
        return {title:'Your word bank',reason:due?`${due} saved words are ready to recall.`:'Return to your saved words.',meta:'Words · Personal collection',href:due?'/wordbank/?review=1':'/wordbank/?view=bank'};
      }
      if(/(?:[?&](?:lesson|application)=|[?&]view=phrases)/.test(last.href||'')){
        const situation=root.ModeAtlasWordLessonState.due()[0];
        if(situation)return {title:'Revisit a phrase',reason:'Recall a phrase you have already learned.',meta:'Words · Phrase library',href:'/wordbank/?application='+encodeURIComponent(situation)};
        const unfinished=Object.entries(root.ModeAtlasWordLessonState.read()).filter(([,row])=>!row.vocabulary&&row.startedAt&&row.phase!=='complete').sort((a,b)=>b[1].updatedAt-a[1].updatedAt)[0];
        if(unfinished)return {title:'Continue your phrase lesson',reason:'Pick up where you left off.',meta:'Words · Phrase library',href:'/wordbank/?lesson='+encodeURIComponent(unfinished[0])};
      }
      return {title:vocabulary.introduced?'Build your vocabulary':'Your first words',reason:'Learn words using characters you have already met.',meta:'Words · Learn and practise',href:'/wordbank/?view=course'};
    }
    return kana;
  }
  root.ModeAtlasBranches=Object.freeze({items,current,recommend});
})(window);
