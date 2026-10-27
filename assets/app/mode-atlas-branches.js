/* Shared branch identity and continuation. Each branch retains its own learner
   state, assessment, session and mastery owners. */
(function(root){
  'use strict';
  const items=Object.freeze([
    {id:'kana',name:'Kana',href:'/kana/',description:'Hiragana & katakana',action:'Open Kana'},
    {id:'kanji',name:'Kanji',href:'/kanji/',description:'Characters & meanings',action:'Open Kanji'},
    {id:'words',name:'Words',href:'/wordbank/',description:'Vocabulary & your word bank',action:'Open Words'}
  ]);
  function current(path=location.pathname){
    return /^\/(kana|reading|writing)\//.test(path)?'kana':path.startsWith('/kanji/')?'kanji':path.startsWith('/wordbank/')?'words':'hub';
  }
  function nextAction(){
    const last=root.ModeAtlasStorage.json('modeAtlasLastMode',{});
    const present=(branchId,action)=>{const destination=items.find(item=>item.id===(action.branchId||branchId))||items.find(item=>item.id===branchId);return {...action,branchId:destination.id,reason:action.detail||'',meta:destination.name};};
    if(last.branchId==='kanji'||/kanji/.test(last.href||'')){
      return present('kanji',root.ModeAtlasKanjiState?.nextAction?.()||{kind:'start',title:'Continue with Kanji',label:'Open Kanji',detail:'',href:'/kanji/'});
    }
    if(last.branchId==='words'||/wordbank/i.test(last.href||'')){
      if(/(?:[?&]view=bank|[?&]review=|[?&]session=bank)/.test(last.href||'')){
        return present('words',root.ModeAtlasWordBank?.nextAction?.()||{kind:'bank',title:'Your word bank',label:'Open your bank',detail:'Your saved words.',href:'/wordbank/?view=bank'});
      }
      if(/(?:[?&](?:lesson|application)=|[?&]view=phrases)/.test(last.href||'')){
        const unfinished=Object.entries(root.ModeAtlasWordLessonState.read()).filter(([id,row])=>!row.vocabulary&&!row.course&&!/^(vocab-|vocabulary-course$|wordbank-course$)/.test(id)&&row.startedAt&&row.phase!=='complete').sort((a,b)=>b[1].updatedAt-a[1].updatedAt)[0];
        if(unfinished)return present('words',{kind:'resume',title:'Continue your phrase lesson',label:'Resume lesson',detail:'',href:'/wordbank/?lesson='+encodeURIComponent(unfinished[0])});
        const situation=root.ModeAtlasWordLessonState.due()[0];
        if(situation)return present('words',{kind:'review',title:'Revisit a phrase',label:'Review phrase',detail:'',href:'/wordbank/?application='+encodeURIComponent(situation)});
        return present('words',{kind:'phrases',title:'Phrase lessons',label:'Open phrase lessons',detail:'',href:'/wordbank/?view=phrases'});
      }
      return present('words',root.ModeAtlasVocabulary?.nextAction?.()||{kind:'start',title:'Your first words',label:'Learn words',detail:'',href:'/wordbank/?view=course'});
    }
    return present('kana',root.ModeAtlasStudyPlan.recommend());
  }
  root.ModeAtlasBranches=Object.freeze({items,current,nextAction,recommend:nextAction});
})(window);
