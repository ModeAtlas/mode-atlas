/* Atlas presentation consumes the shared study policy and existing save owners. */
(function ModeAtlasHomePage(){
  'use strict';
  if (window.__modeAtlasHomePageLoaded) return;
  window.__modeAtlasHomePageLoaded = true;
  const store = window.ModeAtlasStorage;
  const find = selector => document.querySelector(selector);
  const set = (selector, value) => { const node = find(selector); if (node) node.textContent = String(value); };
  const onboarded = () => store.get('modeAtlasOnboardingComplete','') === 'true' || store.get('modeAtlasStarterSeen','') === 'true';

  function recommendation(){
    const last = store.json('modeAtlasLastMode', null);
    return window.ModeAtlasStudyPlan.recommend({
      lastMode: /writing|reverse/i.test(last?.href || '') ? 'writing' : 'reading',
      readingSettings: store.json('settings', undefined),
      writingSettings: store.json('reverseSettings', undefined),
      readingStats: store.readModeJSON('reading','charStats',{}),
      writingStats: store.readModeJSON('writing','charStats',{})
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
    if (window.ModeAtlasEnv?.isNativeApp) renderNative(next);
  }
  function renderNative(next){
    const progress = window.ModeAtlasProgress.getSummary();
    const kana = window.ModeAtlasKanaMetrics.kanaStats();
    const link = find('#iosHomeContinue');
    if (link) { link.href = next.href; link.dataset.mode = next.mode; }
    set('#iosHomeGreeting', next.reason);
    set('#iosHomeContinueSymbol', next.mode === 'writing' ? '書' : 'あ');
    set('#iosHomeContinueKicker', 'Suggested for you');
    set('#iosHomeContinueTitle', next.title);
    set('#iosHomeContinueMeta', next.meta);
    set('#iosHomeStreak', Math.max(0, Number(kana.streak) || 0));
    set('#iosHomeLevel', Math.max(1, Number(progress.level) || 1));
    set('#iosHomeCorrect', Math.max(0, Number(progress.lifetimeCorrect) || 0).toLocaleString());
    set('#iosHomeDailyStatus', kana.dailyDone ? '✓ Daily challenge complete' : 'Try today’s daily challenge');
    const daily = find('.atlas-ios-home__today');
    if (daily) daily.href = kana.dailyDone ? '/kana/' : '/reading/?mode=daily';
    set('#iosHomeLevelMeta', `${Math.max(0, Number(progress.levelXp) || 0)} / ${Math.max(1, Number(progress.levelRequirement) || 1)} XP to level ${Math.max(1, Number(progress.level) || 1) + 1}`);
    const bar = find('#iosHomeLevelProgress');
    if (bar) bar.value = Math.min(100, Math.max(0, Number(progress.progress) || 0) * 100);
  }
  render();
  document.addEventListener('ma:ui-refresh', render);
  document.addEventListener('ma:onboarding-complete', render);
  window.addEventListener('modeAtlasCloudDataChanged', render);
  window.addEventListener('modeAtlasProgressChanged', render);
  window.addEventListener('pageshow', event => { if (event.persisted) render(); });
})();
