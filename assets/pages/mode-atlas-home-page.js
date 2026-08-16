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
  function render(){const isUser=onboarded();document.body.dataset.maHomeState=isUser?'returning':'visitor';document.querySelectorAll('[data-ma-home-visitor]').forEach(el=>{el.hidden=isUser});document.querySelectorAll('[data-ma-home-user]').forEach(el=>{el.hidden=!isUser});if(!isUser)return;const last=readJSON('modeAtlasLastMode',null),action=$('#homeContinueAction'),title=$('#homeContinueTitle'),meta=$('#homeContinueMeta');if(action)action.href=normalizeHref(last?.href);if(title)title.textContent=normalizeTitle(last);if(meta)meta.textContent=relativeTime(read('modeAtlasLastStudiedAt','0'))}
  render();document.addEventListener('ma:ui-refresh',render);document.addEventListener('ma:onboarding-complete',render);window.addEventListener('modeAtlasCloudDataChanged',render);window.addEventListener('pageshow',event=>{if(event.persisted)render()});
})();
