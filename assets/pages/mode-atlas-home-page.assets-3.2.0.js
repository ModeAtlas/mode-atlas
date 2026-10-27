/* Atlas presentation consumes the shared study policy and existing save owners. */
(function ModeAtlasHomePage(){
  'use strict';
  if (window.__modeAtlasHomePageLoaded) return;
  window.__modeAtlasHomePageLoaded = true;
  const store = window.ModeAtlasStorage;
  const find = selector => document.querySelector(selector);
  const set = (selector, value) => { const node = find(selector); if (node) node.textContent = String(value); };
  const setAll = (selector, value) => document.querySelectorAll(selector).forEach(node => { node.textContent = String(value); });
  const count = value => Math.max(0, Number(value) || 0);

  function recommendation(){
    return window.ModeAtlasBranches.nextAction();
  }
  function render(){
    const experience=window.ModeAtlasLearningExperience.snapshot(),isUser=experience.started,next=recommendation();
    document.body.dataset.maHomeState = experience.stage;
    document.querySelectorAll('[data-ma-home-established]').forEach(node=>{node.hidden=!experience.established;});
    find('.atlas-home-personal').hidden=!experience.showPersonal;
    find('.atlas-home-routine').hidden=!isUser;
    find('#homeGoalsMore').hidden=!experience.established;
    set('#homeGoalsTitle',experience.established?'Today’s goals':'A little practice today');
    set('#homeOverviewKicker',isUser?'YOUR ATLAS':'WELCOME');
    const action = find('#homeContinueAction');
    if (action) { action.href = isUser ? next.href : '/kana/'; action.textContent = isUser ? next.label : 'Choose where to start'; }
    set('#homeContinueTitle', isUser ? next.title : 'Start your Japanese journey');
    set('#homeContinueKicker', isUser ? next.meta.toUpperCase() : 'START WITH KANA');
    const detail=isUser?next.detail:'Begin with your first characters or check what you already know.';
    set('#homeContinueMeta',detail);find('#homeContinueMeta').hidden=!detail;
    find('.atlas-home-learning__art img').src='/assets/illustrations/'+(isUser?next.branchId:'kana')+'-scene.svg';
    const progress = window.ModeAtlasProgress.getSummary(), routine = window.ModeAtlasProgress.routine();
    renderPersonal(progress, routine, experience);
  }
  function renderPersonal(progress, routine, experience){
    const {name,character} = window.ModeAtlasPortrait.self();
    set('#atlasReturningTitle', experience.hasLearning ? (name ? `Good to see you, ${name}.` : 'Good to see you.') : 'Let’s learn Japanese.');
    if(!experience.started)return;
    const signature = JSON.stringify(character);
    document.querySelectorAll('[data-ma-home-avatar]').forEach(node => {
      if (node.dataset.character === signature) return;
      node.dataset.character = signature;
      window.ModeAtlasAvatarArt.render(node, character);
    });
    setAll('[data-ma-home-level]', `Level ${progress.level}`);
    set('#homeStreak', count(routine.streak));
    set('#homeTotalXp', count(progress.xp).toLocaleString());
    set('#homeCorrect', count(progress.lifetimeCorrect).toLocaleString());
    set('#homeLevelMeta', `${count(progress.levelXp)} / ${progress.levelRequirement} XP to level ${progress.level + 1}`);
    const bar = find('#homeLevelProgress');
    if(bar) bar.value = count(progress.progress) * 100;
    if(experience.established){find('#homeGoals').classList.remove('atlas-home-starter-goal');window.ModeAtlasRewardsUI.renderGoals(find('#homeGoals'), {compact:true,interactive:false});}
    else{
      const host=find('#homeGoals'),label=document.createElement('p'),bar=document.createElement('progress');
      const units=Math.min(5,routine.todayUnits||0);
      label.textContent=units===5?'Today’s practice complete':`${units} of 5 items practised`;
      bar.max=5;bar.value=units;bar.setAttribute('aria-label','Today’s five practice items');
      host.className='atlas-home-starter-goal';host.replaceChildren(label,bar);
    }
    const week = window.ModeAtlasProgress.weeklyRecap();
    setAll('[data-ma-home-week-days]', `${week.studyDays} / 7`);
    setAll('[data-ma-home-week-goals]', week.dailyGoals + week.weeklyGoals);
    setAll('[data-ma-home-week-sessions]', week.sessions);
    const situations=window.ModeAtlasWordLessonState.due();
    const reviews = [...['reading','writing'].map(mode => ({due:window.ModeAtlasReview.due(store.readModeJSON(mode,'srs',{})).length})),...window.ModeAtlasStudyPlan.kanjiReviews(),{due:experience.words.vocabularyDue},{due:experience.words.due},{due:situations.length}];
    find('.atlas-home-reviews').hidden=!experience.established&&!reviews.some(item=>item.due);
    const due=reviews.reduce((total,item)=>total+count(item.due),0);
    set('#homeReviewCount',due?`${due} ${due===1?'item':'items'} ready`:'Up to date');
    set('#homeReviewMeta',due?'Across your learning branches.':'Your next reviews will appear here.');
  }
  render();
  document.addEventListener('ma:ui-refresh', render);
  document.addEventListener('ma:onboarding-complete', render);
  window.addEventListener('modeAtlasCloudDataChanged', render);
  window.addEventListener('modeAtlasDayChanged', render);
  window.addEventListener('modeAtlasProgressChanged', render);
  for(const event of ['modeAtlasKanaLearningChanged','modeAtlasWordsChanged','modeAtlasWordLessonsChanged','modeAtlasActivityChanged'])window.addEventListener(event,render);
  for(const event of ['modeAtlasAvatarChanged','modeAtlasSelfProfileChanged','kanaCloudSyncStatusChanged','modeAtlasRewardAccessChanged','modeAtlasShopChanged','modeAtlasAccountSignedOut']) window.addEventListener(event, render);
  window.addEventListener('pageshow', event => { if (event.persisted) render(); });
})();
