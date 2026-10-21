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
  const onboarded = () => store.get('modeAtlasOnboardingComplete','') === 'true' || store.get('modeAtlasStarterSeen','') === 'true';

  function recommendation(){
    const last = store.json('modeAtlasLastMode', null);
    return window.ModeAtlasStudyPlan.recommend({
      lastMode: /writing|reverse/i.test(last?.href || '') ? 'writing' : 'reading',
      readingSettings: store.json('settings', undefined),
      writingSettings: store.json('reverseSettings', undefined),
      readingStats: store.readModeJSON('reading','charStats',{}),
      writingStats: store.readModeJSON('writing','charStats',{}),
      readingReview: store.readModeJSON('reading','srs',{}),
      writingReview: store.readModeJSON('writing','srs',{})
    });
  }
  function render(){
    const isUser = onboarded(), next = recommendation();
    document.body.dataset.maHomeState = isUser ? 'returning' : 'visitor';
    const action = find('#homeContinueAction');
    if (action) { action.href = isUser ? next.href : '/kana/'; action.textContent = isUser ? 'Continue learning →' : 'Get started →'; }
    set('#homeContinueTitle', isUser ? next.title : 'Make your first connection.');
    set('#homeContinueKicker', isUser ? 'CONTINUE LEARNING' : 'START WITH KANA');
    set('#homeContinueMeta', isUser ? next.reason : 'Connect Japanese shapes and sounds, one row at a time.');
    set('#homeContinueLength', next.meta);
    const progress = window.ModeAtlasProgress.getSummary(), routine = window.ModeAtlasProgress.routine();
    renderPersonal(progress, routine);
  }
  function renderPersonal(progress, routine){
    const {name,character} = window.ModeAtlasPortrait.self();
    set('#atlasReturningTitle', onboarded() ? (name ? `Good to see you, ${name}.` : 'Good to see you.') : 'Let’s learn Japanese.');
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
    window.ModeAtlasRewardsUI.renderGoals(find('#homeGoals'), {compact:true});
    const daily = window.ModeAtlasKanaMetrics.kanaStats().dailyDone;
    set('#homeDaily', daily ? '✓ Daily challenge complete' : 'Try today’s daily challenge →');
    find('#homeDaily').href = daily ? window.AtlasPlatform.destinationPath('progress') : '/reading/?mode=daily';
    const week = window.ModeAtlasProgress.weeklyRecap();
    setAll('[data-ma-home-week-days]', `${week.studyDays} / 7`);
    setAll('[data-ma-home-week-goals]', week.dailyGoals + week.weeklyGoals);
    setAll('[data-ma-home-week-sessions]', week.sessions);
    const reviews = [...['reading','writing'].map(mode => ({label:mode==='reading'?'Read':'Recall',href:`/${mode}/?practice=10&due=1`,due:window.ModeAtlasReview.due(store.readModeJSON(mode,'srs',{})).length})),...window.ModeAtlasStudyPlan.kanjiReviews()];
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
  document.querySelectorAll('[data-ma-home-review-help]').forEach(button => button.addEventListener('click', () => {
    window.ModeAtlasDialog.alert({title:'What does “due” mean?',message:window.ModeAtlasReview.dueHelp(),confirmLabel:'Got it'});
  }));
  window.ModeAtlasBranchLibrary.render(find('[data-ma-branch-library]'), {compact:true});
  render();
  document.addEventListener('ma:ui-refresh', render);
  document.addEventListener('ma:onboarding-complete', render);
  window.addEventListener('modeAtlasCloudDataChanged', render);
  window.addEventListener('modeAtlasDayChanged', render);
  window.addEventListener('modeAtlasProgressChanged', render);
  for(const event of ['modeAtlasAvatarChanged','modeAtlasSelfProfileChanged','kanaCloudSyncStatusChanged','modeAtlasRewardAccessChanged','modeAtlasShopChanged','modeAtlasAccountSignedOut']) window.addEventListener(event, render);
  window.addEventListener('pageshow', event => { if (event.persisted) render(); });
})();
