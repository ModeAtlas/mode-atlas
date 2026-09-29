(function ModeAtlasHomePage(){
  'use strict';
  if(window.__modeAtlasHomePageLoaded)return; window.__modeAtlasHomePageLoaded=true;
  const Store=window.ModeAtlasStorage,$=selector=>document.querySelector(selector);
  function read(key,fallback=''){try{return Store?.get?.(key,fallback)??fallback}catch{return fallback}}
  function readJSON(key,fallback){try{return Store?.json?.(key,fallback)??fallback}catch{return fallback}}
  const onboarded=()=>read('modeAtlasOnboardingComplete','')==='true'||read('modeAtlasStarterSeen','')==='true';
  function relativeTime(value){const ts=Number(value||0);if(!ts)return'Ready when you are';const m=Math.floor(Math.max(0,Date.now()-ts)/60000);if(m<1)return'Last studied just now';if(m<60)return`Last studied ${m}m ago`;const h=Math.floor(m/60);if(h<24)return`Last studied ${h}h ago`;return`Last studied ${Math.floor(h/24)}d ago`}
  function normalizeHref(raw){const href=String(raw||'').toLowerCase();if(href.includes('reverse')||href.includes('/writing'))return'/writing/';if(href.includes('wordbank'))return'/wordbank/';if(href.includes('results')||href.includes('test.html'))return'/results/';if(href.includes('kana'))return'/kana/';return'/reading/'}
  function normalizeTitle(last){const page=String(last?.page||'').trim();if(/writing/i.test(page))return'Kana Writing';if(/word bank/i.test(page))return'Word Bank';if(/results/i.test(page))return'Test Results';if(/kana/i.test(page)&&!/reading/i.test(page))return'Kana Trainer';return'Kana Reading'}
  function render(){const isUser=onboarded();document.body.dataset.maHomeState=isUser?'returning':'visitor';document.querySelectorAll('[data-ma-home-visitor]').forEach(el=>{el.hidden=isUser});document.querySelectorAll('[data-ma-home-user]').forEach(el=>{el.hidden=!isUser});const last=readJSON('modeAtlasLastMode',null),action=$('#homeContinueAction'),title=$('#homeContinueTitle'),meta=$('#homeContinueMeta');if(isUser){if(action)action.href=normalizeHref(last?.href);if(title)title.textContent=normalizeTitle(last);if(meta)meta.textContent=relativeTime(read('modeAtlasLastStudiedAt','0'))}if(window.ModeAtlasEnv?.isNativeApp)renderNative(isUser,last)}
  function renderNative(isUser,last){
    const set=(selector,value)=>{const el=$(selector);if(el)el.textContent=String(value)};
    const summary=window.ModeAtlasProgress?.getSummary?.()||{};
    const kana=window.ModeAtlasKanaMetrics?.kanaStats?.()||{};
    const link=$('#iosHomeContinue');
    if(link)link.href=isUser?normalizeHref(last?.href):'/reading/';
    set('#iosHomeGreeting',isUser?'Pick up your rhythm. A little practice goes a long way.':'Build confidence, one kana at a time.');
    const writing = link?.getAttribute('href') === '/writing/';
    if(link)link.dataset.mode = writing ? 'writing' : 'reading';
    set('#iosHomeContinueSymbol',writing?'書':'あ');
    set('#iosHomeContinueKicker',isUser?'Continue studying':'Your first step');
    set('#iosHomeContinueTitle',isUser?normalizeTitle(last):'Start Reading');
    set('#iosHomeContinueMeta',isUser?relativeTime(read('modeAtlasLastStudiedAt','0')):'Begin with kana');
    set('#iosHomeStreak',Math.max(0,Number(kana.streak)||0));
    set('#iosHomeLevel',Math.max(1,Number(summary.level)||1));
    set('#iosHomeCorrect',Math.max(0,Number(summary.lifetimeCorrect)||0).toLocaleString());
    set('#iosHomeDailyStatus',kana.dailyDone?'✓ Daily challenge complete':'Try today’s daily challenge');
    const daily = $('.atlas-ios-home__today');
    if(daily)daily.href = kana.dailyDone ? '/kana/' : '/reading/?mode=daily';
    set('#iosHomeLevelMeta',`${Math.max(0,Number(summary.levelXp)||0)} / ${Math.max(1,Number(summary.levelRequirement)||1)} XP to level ${Math.max(1,Number(summary.level)||1)+1}`);
    const progress = $('#iosHomeLevelProgress');
    if(progress)progress.value = Math.min(100,Math.max(0,Number(summary.progress)||0)*100);
  }
  render();document.addEventListener('ma:ui-refresh',render);document.addEventListener('ma:onboarding-complete',render);window.addEventListener('modeAtlasCloudDataChanged',render);window.addEventListener('modeAtlasProgressChanged',render);window.addEventListener('pageshow',event=>{if(event.persisted)render()});
})();
