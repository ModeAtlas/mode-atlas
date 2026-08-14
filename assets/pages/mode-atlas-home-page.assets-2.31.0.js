(function ModeAtlasHomePage(){
  'use strict';
  if (window.__modeAtlasHomePageLoaded) return;
  window.__modeAtlasHomePageLoaded = true;

  const Store = window.ModeAtlasStorage;
  const $ = (selector) => document.querySelector(selector);

  function read(key, fallback = ''){
    try { return Store?.get?.(key, fallback) ?? fallback; } catch { return fallback; }
  }
  function readJSON(key, fallback){
    try { return Store?.json?.(key, fallback) ?? fallback; } catch { return fallback; }
  }
  function studyDate(date = new Date()){
    const d = new Date(date);
    if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function relativeTime(value){
    const ts = Number(value || 0);
    if (!ts) return 'Recommended starting point';
    const minutes = Math.floor(Math.max(0, Date.now() - ts) / 60000);
    if (minutes < 1) return 'Studied just now';
    if (minutes < 60) return `Studied ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Studied ${hours}h ago`;
    return `Studied ${Math.floor(hours / 24)}d ago`;
  }
  function normalizeHref(raw){
    const href = String(raw || '').toLowerCase();
    if (href.includes('reverse') || href.includes('/writing')) return '/writing/';
    if (href.includes('wordbank')) return '/wordbank/';
    if (href.includes('results') || href.includes('test.html')) return '/results/';
    if (href.includes('kana')) return '/kana/';
    return '/reading/';
  }
  function normalizeTitle(last){
    const page = String(last?.page || '').trim();
    if (/writing/i.test(page)) return 'Kana Writing';
    if (/word bank/i.test(page)) return 'Word Bank';
    if (/results/i.test(page)) return 'Test Results';
    if (/kana/i.test(page) && !/reading/i.test(page)) return 'Kana Trainer';
    return 'Kana Reading';
  }
  function dailyDone(mode){
    const history = Store?.readModeJSON?.(mode, 'dailyHistory', {}) || readJSON(mode === 'writing' ? 'reverseDailyChallengeHistory' : 'dailyChallengeHistory', {});
    return !!history?.[studyDate()];
  }
  function render(){
    const last = readJSON('modeAtlasLastMode', null);
    const action = $('#homeContinueAction');
    const title = $('#homeContinueTitle');
    const meta = $('#homeContinueMeta');
    if (action) action.href = normalizeHref(last?.href);
    if (title) title.textContent = normalizeTitle(last);
    if (meta) {
      const mode = String(last?.mode || '').trim();
      const ago = relativeTime(read('modeAtlasLastStudiedAt', '0'));
      meta.textContent = mode ? `${mode} · ${ago}` : ago;
    }
    const streak = Number(read('modeAtlasVisitStreak', '0') || 0);
    if ($('#homeVisitStreak')) $('#homeVisitStreak').textContent = streak ? `${streak} day${streak === 1 ? '' : 's'}` : 'Start today';
    if ($('#homeReadingDaily')) $('#homeReadingDaily').textContent = dailyDone('reading') ? 'Complete ✓' : 'Ready';
    if ($('#homeWritingDaily')) $('#homeWritingDaily').textContent = dailyDone('writing') ? 'Complete ✓' : 'Ready';
  }

  render();
  document.addEventListener('ma:ui-refresh', render);
  window.addEventListener('modeAtlasCloudDataChanged', render);
  window.addEventListener('pageshow', (event) => { if (event.persisted) render(); });
})();
