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
    if(goal.metric==='kana.learned')return {href:'/kana/?view=path',label:'Learn a row'};
    if(goal.metric==='kana.improved')return {href:'/kana/?view=mastery',label:'Explore mastery'};
    if(goal.metric==='kana.testScore')return {href:'/kana/?view=tests',label:'Open Kana tests'};
    if(goal.metric==='kanji.testScore')return {href:'/kanji/',label:'Open Kanji tests'};
    if(goal.branch==='kanji')return {href:'/kanji/',label:'Practise Kanji'};
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
    if(goal.assisted){params.set('hints','on');}
    else if(['kana.independent','kana.streak','kana.precise','kana.tests','kana.broad'].includes(goal.metric))params.set('hints','off');
    if(goal.metric==='kana.daily'){params.delete('practice');params.set('mode','daily');}
    if(goal.metric==='kana.tests')return {href:'/kana/?view=tests',label:'Open Kana tests'};
    let chars;
    if(goal.metric==='kana.broad'||(goal.metric==='kana.hiragana'&&!goal.assisted))chars=root.ModeAtlasKanaData.collections.hiragana;
    if(goal.metric==='kana.katakana')chars=root.ModeAtlasKanaData.collections.katakana;
    if(goal.metric==='kana.variety')chars=goal.target>46?[...root.ModeAtlasKanaData.collections.hiragana,...root.ModeAtlasKanaData.collections.katakana]:root.ModeAtlasKanaData.collections.hiragana;
    if(goal.planVersion===1){
      const seen=[...new Set(Object.values(root.ModeAtlasProgress.readSnapshot().activity).flatMap(row=>row.kana))];
      if(chars){
        const relevant=seen.filter(kana=>chars.includes(kana));
        const minimum=goal.metric==='kana.variety'?goal.target:goal.metric==='kana.broad'?45:1;
        chars=relevant.length>=minimum?relevant:chars.slice(0,goal.assisted?5:chars.length);
        params.delete('starter');
      }
    }
    if(chars)params.set('kana',chars.join(','));
    return {href:`/${mode}/?${params}`,label:goal.metric==='kana.daily'?'Open Daily Challenge':goal.metric==='kana.tests'?'Open formal test':`Practise ${mode==='writing'?'Recall':'Read'}`};
  }
  function kanjiReviews(){
    return (root.ModeAtlasKanjiState?.reviewSets()||[]).map(({level,skill,count})=>({due:count,label:`Kanji N${level} · ${skill==='pronunciation'?'Pronunciation':'Meaning'}`,href:'/kanji/?'+new URLSearchParams({level:String(level),practice:skill,focus:'due'})}));
  }
  function recommend(){
    // The course owns lesson order, due work and interrupted-session priority.
    // Home must not run a second policy over the same learning evidence.
    const action=root.ModeAtlasKanaLearning?.nextAction?.();
    return action||Object.freeze({kind:'start',title:'Find your starting point',label:'Choose where to start',detail:'Begin with Kana or check what you already know.',href:'/kana/'});
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
  root.ModeAtlasStudyPlan = Object.freeze({lengths, practiceCount, availableChars, evidence, targetChars, target, goalAction, kanjiReviews, recommend, summarise});
})(window);
