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
    document.querySelectorAll('[data-ma-home-visitor]').forEach(node => { node.hidden = isUser; });
    document.querySelectorAll('[data-ma-home-user]').forEach(node => { node.hidden = !isUser; });
    if (isUser) {
      const action = find('#homeContinueAction');
      if (action) action.href = next.href;
      set('#homeContinueTitle', next.title);
      set('#homeContinueMeta', next.reason);
      set('#homeContinueLength', next.meta);
    }
    const progress = window.ModeAtlasProgress.getSummary(), routine = window.ModeAtlasProgress.routine();
    renderPersonal(progress, routine);
    if (window.ModeAtlasEnv?.isNativeApp) renderNative(next, progress, routine);
  }
  function renderPersonal(progress, routine){
    const {name,character} = window.ModeAtlasPortrait.self();
    set('#iosHomeTitle', name ? `Hi, ${name}` : 'Mode Atlas');
    set('#atlasReturningTitle', name ? `Good to see you, ${name}.` : 'Good to see you.');
    const signature = JSON.stringify(character);
    document.querySelectorAll('[data-ma-home-avatar]').forEach(node => {
      if (node.dataset.character === signature) return;
      node.dataset.character = signature;
      window.ModeAtlasAvatarArt.render(node, character);
    });
    setAll('[data-ma-home-level]', `Level ${progress.level}`);
    set('#homeStreak', count(routine.streak));
    set('#homeTotalXp', count(progress.xp).toLocaleString());
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
    const reviews = [...['reading','writing'].map(mode => ({label:mode==='reading'?'Reading':'Writing',href:`/${mode}/?practice=10&due=1`,due:window.ModeAtlasReview.due(store.readModeJSON(mode,'srs',{})).length})),...window.ModeAtlasStudyPlan.kanjiReviews()];
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
  function renderNative(next, progress, routine){
    window.ModeAtlasRewardsUI.renderGoals(find('#iosHomeGoals'), {compact:true});
    const kana = window.ModeAtlasKanaMetrics.kanaStats();
    const link = find('#iosHomeContinue');
    if (link) { link.href = next.href; link.dataset.mode = next.mode; }
    set('#iosHomeGreeting', next.reason);
    set('#iosHomeContinueKicker', 'Suggested for you');
    set('#iosHomeContinueTitle', next.title);
    set('#iosHomeContinueMeta', next.meta);
    set('#iosHomeStreak', count(routine.streak));
    set('#iosHomeLevel', Math.max(1, Number(progress.level) || 1));
    set('#iosHomeCorrect', Math.max(0, Number(progress.lifetimeCorrect) || 0).toLocaleString());
    set('#iosHomeDailyStatus', kana.dailyDone ? '✓ Daily challenge complete' : 'Try today’s daily challenge');
    const daily = find('.atlas-ios-home__today');
    if (daily) daily.href = kana.dailyDone ? window.AtlasPlatform.destinationPath('progress') : '/reading/?mode=daily';
    set('#iosHomeLevelMeta', `${Math.max(0, Number(progress.levelXp) || 0)} / ${Math.max(1, Number(progress.levelRequirement) || 1)} XP to level ${Math.max(1, Number(progress.level) || 1) + 1}`);
    const bar = find('#iosHomeLevelProgress');
    if (bar) bar.value = Math.min(100, Math.max(0, Number(progress.progress) || 0) * 100);
  }
  document.querySelectorAll('[data-ma-home-review-help]').forEach(button => button.addEventListener('click', () => {
    window.ModeAtlasDialog.alert({title:'What does “due” mean?',message:window.ModeAtlasReview.dueHelp(),confirmLabel:'Got it'});
  }));
  render();
  document.addEventListener('ma:ui-refresh', render);
  document.addEventListener('ma:onboarding-complete', render);
  window.addEventListener('modeAtlasCloudDataChanged', render);
  window.addEventListener('modeAtlasProgressChanged', render);
  for(const event of ['modeAtlasAvatarChanged','modeAtlasSelfProfileChanged','kanaCloudSyncStatusChanged','modeAtlasRewardAccessChanged','modeAtlasShopChanged','modeAtlasAccountSignedOut']) window.addEventListener(event, render);
  window.addEventListener('pageshow', event => { if (event.persisted) render(); });
})();
