/* Shared study recommendations and bounded-practice policy. No storage writes,
   timers, scoring or platform-specific behaviour belong in this owner. */
(function ModeAtlasStudyPlan(root){
  'use strict';
  const lengths = Object.freeze([10, 20, 30]);
  const number = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
  function practiceCount(settings = {}){
    if (settings.dailyChallenge || settings.testMode || settings.timeTrial || settings.speedRun || settings.endless || settings.comboKana) return 0;
    return lengths.includes(Number(settings.practiceCount)) ? Number(settings.practiceCount) : 0;
  }
  function availableChars(settings = {}){
    return Object.keys(root.ModeAtlasKanaData.selectedKanaMap(settings));
  }

  function evidence(stats = {}, chars = []){
    const rows = chars.map(kana => {
      const correct = number(stats?.[kana]?.correct), wrong = number(stats?.[kana]?.wrong);
      return {kana, correct, wrong, attempts: correct + wrong};
    });
    return {answered: rows.reduce((n, row) => n + row.attempts, 0), weak: rows.filter(row => row.attempts >= 4 && row.wrong >= 2 && row.correct / row.attempts < .8)};
  }
  function targetChars(chars=[]){
    const known=new Set(root.ModeAtlasKanaData.collections.all);
    return Array.isArray(chars)?[...new Set(chars)].filter(char=>known.has(char)).slice(0,512):[];
  }
  function target(mode,chars,count=10){
    const pool=targetChars(chars);if(!pool.length)return null;
    return `/${mode==='writing'?'writing':'reading'}/?${new URLSearchParams({practice:String(lengths.includes(count)?count:10),kana:pool.join(','),hints:'off'})}`;
  }
  function goalAction(goal,goals=[]){
    if(!goal||goal.value>=goal.target)return null;
    if(goal.metric==='study.goals'){
      const next=goals.find(item=>item.period==='daily'&&item.value<item.target);
      return next?goalAction(next):null;
    }
    let mode=goal.metric==='kana.writing'?'writing':'reading';
    if(goal.metric==='kana.balance'){
      const routine=root.ModeAtlasProgress.weeklyRecap();
      mode=routine.todayReading>=10?'writing':'reading';
    }
    const params=new URLSearchParams({practice:'20'});
    if(goal.assisted){params.set('starter','starter');params.set('hints','on');}
    else if(['kana.independent','kana.streak','kana.precise','kana.tests','kana.broad'].includes(goal.metric))params.set('hints','off');
    if(goal.metric==='kana.daily'){params.delete('practice');params.set('mode','daily');}
    if(goal.metric==='kana.tests'){params.delete('practice');params.set('mode','test');}
    let chars;
    if(goal.metric==='kana.broad'||(goal.metric==='kana.hiragana'&&!goal.assisted))chars=root.ModeAtlasKanaData.collections.hiragana;
    if(goal.metric==='kana.katakana')chars=root.ModeAtlasKanaData.collections.katakana;
    if(goal.metric==='kana.variety')chars=goal.target>46?[...root.ModeAtlasKanaData.collections.hiragana,...root.ModeAtlasKanaData.collections.katakana]:root.ModeAtlasKanaData.collections.hiragana;
    if(goal.planVersion===1){
      const seen=[...new Set(Object.values(root.ModeAtlasProgress.readState().activity).flatMap(row=>row.kana))];
      if(chars){
        const relevant=seen.filter(kana=>chars.includes(kana));
        const minimum=goal.metric==='kana.variety'?goal.target:goal.metric==='kana.broad'?45:1;
        chars=relevant.length>=minimum?relevant:chars.slice(0,goal.assisted?5:chars.length);
        params.delete('starter');
      }
    }
    if(chars)params.set('kana',chars.join(','));
    return {href:`/${mode}/?${params}`,label:goal.metric==='kana.daily'?'Open Daily Challenge':goal.metric==='kana.tests'?'Open formal test':`Practise ${mode==='writing'?'Writing':'Reading'}`};
  }
  function recommend(input = {}){
    const reading = evidence(input.readingStats, availableChars(input.readingSettings));
    const writing = evidence(input.writingStats, availableChars(input.writingSettings));
    let mode = input.lastMode === 'writing' ? 'writing' : 'reading';
    let focus = false, title = mode === 'writing' ? 'Build your recall' : 'Build your reading';
    let reason = mode === 'writing' ? 'Match each sound to its kana.' : 'A short set with your current kana selection.';
    if (!reading.answered && !writing.answered) {
      mode = 'reading'; title = 'Start small'; reason = 'Start small. There is time to learn each answer.';
    } else if (reading.weak.length || writing.weak.length) {
      mode = writing.weak.length > reading.weak.length ? 'writing' : 'reading';
      const count = (mode === 'writing' ? writing : reading).weak.length;
      focus = true; title = mode === 'writing' ? 'Recall tricky kana' : 'Read tricky kana';
      reason = `${count} ${count === 1 ? 'kana has' : 'kana have'} been tricky in your selected set. Give them another look.`;
    } else if (reading.answered >= 20 && writing.answered < reading.answered / 4) {
      mode = 'writing'; title = 'Try writing'; reason = 'You have been reading kana. Try matching sounds back to characters.';
    }
    const readingDue=root.ModeAtlasReview?.due(input.readingReview||{})||[];
    const writingDue=root.ModeAtlasReview?.due(input.writingReview||{})||[];
    if(readingDue.length||writingDue.length){
      mode=writingDue.length>readingDue.length?'writing':'reading';const count=(mode==='writing'?writingDue:readingDue).length;
      return Object.freeze({mode,title:'Time to revisit',reason:`${count} kana ${count===1?'is':'are'} ready for a spaced review.`,focus:true,count:10,meta:'10 questions · Spaced recall',href:`/${mode}/?practice=10&due=1`});
    }
    const params = new URLSearchParams({practice: '10'});
    const newLearner = !input.readingSettings && !input.writingSettings
      && !Object.keys(input.readingStats || {}).length && !Object.keys(input.writingStats || {}).length;
    if (newLearner && mode === 'reading') params.set('starter', 'starter');
    if (focus) params.set('focusWeak', '1');
    return Object.freeze({mode, title, reason, focus, count: 10, meta: '10 questions · At your pace', href: `/${mode}/?${params}`});
  }
  function summarise(answers = []){
    const rows = new Map();
    for (const answer of answers) {
      const row = rows.get(answer.kana) || {kana: answer.kana, correct: 0, wrong: 0};
      row[answer.correct ? 'correct' : 'wrong'] += 1;
      rows.set(answer.kana, row);
    }
    return {unique: rows.size, mistakes: [...rows.values()].filter(row => row.wrong > 0).sort((a,b) => b.wrong - a.wrong)};
  }
  root.ModeAtlasStudyPlan = Object.freeze({lengths, practiceCount, availableChars, evidence, targetChars, target, goalAction, recommend, summarise});
})(window);
