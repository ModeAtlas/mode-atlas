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
    const last = store.json('modeAtlasLastMode', null);
    return window.ModeAtlasBranches.recommend(window.ModeAtlasStudyPlan.recommend({
      lastMode: /writing|reverse/i.test(last?.href || '') ? 'writing' : 'reading',
      readingSettings: store.json('settings', undefined),
      writingSettings: store.json('reverseSettings', undefined),
      readingStats: store.readModeJSON('reading','charStats',{}),
      writingStats: store.readModeJSON('writing','charStats',{}),
      readingReview: store.readModeJSON('reading','srs',{}),
      writingReview: store.readModeJSON('writing','srs',{})
    }));
  }
  function render(){
    const experience=window.ModeAtlasLearningExperience.snapshot(),isUser=experience.started,next=recommendation();
    document.body.dataset.maHomeState = experience.stage;
    document.querySelectorAll('[data-ma-home-established]').forEach(node=>{node.hidden=!experience.established;});
    find('.atlas-home-personal').hidden=!experience.showPersonal;
    find('.atlas-home-routine').hidden=!isUser;
    find('#homeGoalsMore').hidden=!experience.established;
    find('#homeDaily').hidden=!experience.established;
    set('#homeGoalsTitle',experience.established?'Today’s goals':'A little practice today');
    set('#homeOverviewKicker',isUser?'YOUR ATLAS':'WELCOME');
    const action = find('#homeContinueAction');
    if (action) { action.href = isUser ? next.href : '/kana/'; action.textContent = isUser || experience.stage==='starting' ? 'Continue learning →' : 'Start learning →'; }
    set('#homeContinueTitle', isUser ? next.title : 'Your first five kana');
    set('#homeContinueKicker', isUser ? 'CONTINUE LEARNING' : 'START WITH KANA');
    set('#homeContinueMeta', isUser ? next.reason : 'あ い う え お · Hiragana');
    set('#homeContinueLength', isUser?next.meta:'About 3 minutes');
    const progress = window.ModeAtlasProgress.getSummary(), routine = window.ModeAtlasProgress.routine();
    renderPersonal(progress, routine, experience);
    window.ModeAtlasBranchLibrary.render(find('[data-ma-branch-library]'), {compact:true,experience});
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
    if(experience.established)window.ModeAtlasRewardsUI.renderGoals(find('#homeGoals'), {compact:true});
    else{
      const host=find('#homeGoals'),label=document.createElement('p'),bar=document.createElement('progress');
      const units=Math.min(5,routine.todayUnits||0);
      label.textContent=units===5?'Today’s practice complete':`${units} of 5 items practised`;
      bar.max=5;bar.value=units;bar.setAttribute('aria-label','Today’s five practice items');
      host.replaceChildren(label,bar);
    }
    const daily = window.ModeAtlasKanaMetrics.kanaStats().dailyDone;
    set('#homeDaily', daily ? '✓ Daily challenge complete' : 'Try today’s daily challenge →');
    find('#homeDaily').href = daily ? window.AtlasPlatform.destinationPath('progress') : '/reading/?mode=daily';
    const week = window.ModeAtlasProgress.weeklyRecap();
    setAll('[data-ma-home-week-days]', `${week.studyDays} / 7`);
    setAll('[data-ma-home-week-goals]', week.dailyGoals + week.weeklyGoals);
    setAll('[data-ma-home-week-sessions]', week.sessions);
    const situations=window.ModeAtlasWordLessonState.due();
    const reviews = [...['reading','writing'].map(mode => ({label:mode==='reading'?'Kana · Read':'Kana · Recall',href:`/${mode}/?practice=10&due=1`,due:window.ModeAtlasReview.due(store.readModeJSON(mode,'srs',{})).length})),...window.ModeAtlasStudyPlan.kanjiReviews(),{label:'Words · Vocabulary',href:'/wordbank/?vocabulary=review',due:experience.words.vocabularyDue},{label:'Words · Your bank',href:'/wordbank/?review=1',due:experience.words.due},{label:'Words · Phrases',href:'/wordbank/?application='+encodeURIComponent(situations[0]||''),due:situations.length}];
    find('.atlas-home-reviews').hidden=!experience.established&&!reviews.some(item=>item.due);
    document.querySelectorAll('[data-ma-home-reviews]').forEach(host => {
      if(host.dataset.reviews === JSON.stringify(reviews)) return;
      host.dataset.reviews = JSON.stringify(reviews);host.replaceChildren();
      for(const {label,href,due} of reviews.filter(item => item.due)){
        const link = document.createElement('a'), detail = document.createElement('span');
        link.className = 'atlas-home-review-link';link.href = href;
        link.textContent = label;detail.textContent = `${due} due →`;
        link.append(detail);host.append(link);
      }
      if(!host.childElementCount){
        const note = document.createElement('p');note.textContent = 'You’re up to date. Your next reviews will appear here.';host.append(note);
        const link = document.createElement('a');link.className = 'atlas-text-link';link.href = '/learn/';link.textContent = 'Explore learning →';host.append(link);
      }
    });
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
