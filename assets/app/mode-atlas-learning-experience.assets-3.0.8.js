/* Presentation state is derived from learning evidence, never consent or tours.
   This read-only owner is shared by Home, Learn and individual branches. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.ModeAtlasLearningExperience=factory(root);
})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const count=value=>Math.max(0,Number(value)||0);
  function snapshot(){
    const store=root.ModeAtlasStorage;
    const stats=['reading','writing'].map(skill=>store.readModeJSON(skill,'charStats',{}));
    const attempts=stats.reduce((n,items)=>n+Object.values(items).reduce((a,row)=>a+count(row.correct)+count(row.wrong),0),0);
    const kana=root.ModeAtlasKanaLearning?.read?.()||{};
    const handwritten=Object.values(kana.handwriting||{}).reduce((n,items)=>n+items.length,0);
    const familiar=new Set(Object.values(kana.earned||{}).flatMap(items=>Object.entries(items).filter(([,stage])=>stage>=3).map(([char])=>char))).size;
    const words=root.ModeAtlasWordBank?.read?.()||[];
    const reviewed=words.filter(word=>word.review?.last||word.readingReview?.last||word.listeningReview?.last).length;
    // Kanji's public summary is added by the branch owner, avoiding dependence
    // on its compact storage representation here.
    const kanjiSummary=root.ModeAtlasKanjiState?.overview?.()||{};
    const kanjiAttempts=count(kanjiSummary.attempts);
    const kanjiStarted=!!kanjiSummary.started;
    // Older/restored saves can retain scheduled reviews or aggregate correct
    // counts without the newer per-character evidence. Those are still real
    // learning records; account, consent and tour flags are not.
    const scheduled=['reading','writing'].some(skill=>Object.values(store.readModeJSON(skill,'srs',{})).some(row=>count(row.lastSeen)>0));
    const lifetimeCorrect=count(root.ModeAtlasProgress?.getSummary?.().lifetimeCorrect);
    const lessons=Object.values(root.ModeAtlasWordLessonState?.read?.()||{});
    const completedLessons=lessons.filter(row=>row.completedAt).length;
    const units=attempts+handwritten+reviewed+kanjiAttempts;
    const active=units+lifetimeCorrect+familiar>0||scheduled||words.length>0||completedLessons>0;
    const started=active||!!kana.startedAt||kanjiStarted||lessons.some(row=>row.startedAt);
    const studyDays=root.ModeAtlasProgress?.studyDays?.().length||0;
    const kanaExperienced=['existing','placement'].includes(kana.startKind)||familiar>=5||attempts>=60;
    // One attempt (including a mistake), an import, or one saved word is not
    // evidence that a beginner needs every dashboard. Preserve mature restores.
    const legacy=scheduled&&!kana.startedAt&&units===0;
    const established=kanaExperienced||units>=60||lifetimeCorrect>=60||completedLessons>=3||
      (studyDays>=2&&units>=10)||legacy;
    const building=units>=5||completedLessons>0||familiar>0;
    return {stage:established?'returning':building?'building':started?'starting':'new',hasLearning:active,
      established,started,showPersonal:building||established,
      kana:{started:!!kana.startedAt,attempts,handwritten,familiar,guided:!kanaExperienced},
      kanji:{started:kanjiStarted,attempts:kanjiAttempts,studied:kanjiSummary.studied||0},
      words:{saved:words.length,reviewed,completedLessons,due:root.ModeAtlasWordBank?.due?.().length||0}};
  }
  return Object.freeze({snapshot});
});
