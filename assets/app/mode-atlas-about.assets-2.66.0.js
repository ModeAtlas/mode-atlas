(function ModeAtlasAbout(){
  'use strict';
  if (window.__modeAtlasAboutLoaded) return;
  window.__modeAtlasAboutLoaded = true;

  const APP_VERSION = (window.ModeAtlasEnv && window.ModeAtlasEnv.appVersion) || window.ModeAtlasVersion || 'dev-local';
  const SAVE_SCHEMA_VERSION = String(window.ModeAtlasSaveSchemaVersion || window.ModeAtlasEnv?.saveSchemaVersion || 'unknown');
  const BUILD_LABEL = 'Revisioned Asset Loading';
  const BUILD_DATE = String(window.ModeAtlasBuildDate || window.ModeAtlasEnv?.buildDate || '');
  const DEVELOPER = 'Jack Wright';
  const SUPPORT_EMAIL = 'support@mode-atlas.com';
  const OFFICIAL_SITE = 'mode-atlas.app';
  const PAGE = (window.ModeAtlasPageName ? window.ModeAtlasPageName() : (location.pathname.split('/').pop() || 'index.html')).toLowerCase();
  const WHATS_NEW_TITLE = 'What’s new';
  const WHATS_NEW_COPY = 'Mode Atlas has a new polish update focused on cleaner menus, safer save handling, and clearer account information.';
  const WHATS_NEW_SEEN_CONTENT_KEY = 'maWhatsNewSeenContentSignature';
  const WHATS_NEW_SEEN_AT_KEY = 'maWhatsNewSeenAt';
  const whatsNewItems = [
    'Cleaner menus and shared Profile / Settings controls.',
    'Improved save import summaries and safer backup handling.',
    'More reliable update handling after new releases.',
    'Light Mode contrast and layout polish.'
  ];

  function storeGet(key, fallback = '') {
    const store = window.ModeAtlasStorage;
    return store?.get?.(key, fallback) ?? localStorage.getItem(key) ?? fallback;
  }
  function storeSet(key, value) {
    const store = window.ModeAtlasStorage;
    return store?.set?.(key, value) ?? localStorage.setItem(key, String(value));
  }
  function $(sel, root = document){ return root.querySelector(sel); }
  function $all(sel, root = document){ return Array.from(root.querySelectorAll(sel)); }
  function aboutEl(tag, className = '', text = ''){
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== '') el.textContent = String(text);
    return el;
  }
  function aboutButton(text, attrs = {}){
    const button = aboutEl('button', attrs.className || '', text);
    button.type = 'button';
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'className') return;
      if (key.startsWith('data')) button.dataset[key.slice(4,5).toLowerCase() + key.slice(5)] = value;
      else button.setAttribute(key, value);
    });
    return button;
  }
  function aboutLink(text, href, attrs = {}){
    const link = aboutEl('a', attrs.className || '', text);
    link.href = href;
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'className') return;
      link.setAttribute(key, value);
    });
    return link;
  }
  function fmtDate(ts){
    const n = Number(ts || 0);
    if (!Number.isFinite(n) || !n) return 'Never';
    const d = new Date(n);
    if (Number.isNaN(d.getTime())) return 'Never';
    return d.toLocaleString([], { hour:'numeric', minute:'2-digit', day:'numeric', month:'short', year:'numeric' });
  }
  function aboutBasePath(){
    try { return new URL((window.ModeAtlasEnv && window.ModeAtlasEnv.baseUrl) || '/', location.origin).pathname; } catch {}
    return '/';
  }
  function aboutAppUrl(path){
    const clean = String(path || '').replace(/^\/+/, '');
    try { return new URL(clean, location.origin + aboutBasePath()).pathname; } catch { return '/' + clean; }
  }
  function latestTimestamp(keys){
    let best = 0;
    keys.forEach(key => {
      const n = Number(storeGet(key, '0') || 0);
      if (Number.isFinite(n) && n > best) best = n;
    });
    return best;
  }
  function getCloudStatus(){
    const user = window.KanaCloudSync?.getUser?.() || window.currentUser || null;
    const signedIn = !!user;
    const online = navigator.onLine !== false;
    const lastSync = signedIn ? latestTimestamp([
      'modeAtlasLastCloudSyncAt','cloudReadingUpdatedAt','cloudWritingUpdatedAt','testModeResultsUpdatedAt','readingTestModeResultsUpdatedAt','writingTestModeResultsUpdatedAt','kanaWordBankUpdatedAt'
    ]) : 0;
    let mode = 'Local only';
    let status = 'Local saving active';
    if (signedIn && online){ mode = 'Cloud + local'; status = 'Cloud available'; }
    else if (signedIn && !online){ mode = 'Cloud account offline'; status = 'No cloud access'; }
    return { signedIn, online, mode, status, lastSync };
  }
  function getAppInfo(){
    const cloud = getCloudStatus();
    return {
      version: APP_VERSION,
      saveSchema: SAVE_SCHEMA_VERSION,
      cacheRevision: window.ModeAtlasCacheRevision || 'unknown',
      build: BUILD_LABEL,
      buildDate: BUILD_DATE,
      page: (location.pathname.split('/').pop() || 'index.html'),
      theme: storeGet('modeAtlasThemePreference', 'system') || 'system',
      saveMode: cloud.mode,
      cloudStatus: cloud.status,
      signedIn: cloud.signedIn ? 'Yes' : 'No',
      online: cloud.online ? 'Yes' : 'No',
      lastCloudSync: cloud.signedIn ? fmtDate(cloud.lastSync) : 'Not signed in',
      localSaveUpdated: fmtDate(latestTimestamp(['settingsUpdatedAt','resultsUpdatedAt','srsUpdatedAt','dailyUpdatedAt','profileUpdatedAt','kanaWordBankUpdatedAt'])),
      installSupport: window.ModeAtlasInstall ? 'Available' : 'Not available here',
      supportEmail: SUPPORT_EMAIL,
      storage: (() => { try { storeSet('__ma_probe','1'); window.ModeAtlasStorage?.remove?.('__ma_probe') ?? localStorage.removeItem('__ma_probe'); return 'Available'; } catch { return 'Blocked'; } })()
    };
  }
  function buildWhatsNewContent(){
    const content = aboutEl('div', 'ma-whats-new-content');
    const list = aboutEl('ul', 'ma-about-list ma-whats-new-list');
    whatsNewItems.forEach(item => list.append(aboutEl('li', '', item)));
    content.append(list);
    return content;
  }
  function whatsNewContentSignature(){
    return [WHATS_NEW_TITLE, WHATS_NEW_COPY, ...whatsNewItems].join('|');
  }
  function legacyWhatsNewSignature(){
    return APP_VERSION + '::' + whatsNewItems.join('|');
  }
  function legacySeenMatchesContent(){
    const itemSignature = whatsNewItems.join('|');
    const legacySignature = storeGet('maWhatsNewSeenSignature', '');
    if (legacySignature && legacySignature.endsWith('::' + itemSignature)) return true;
    return !!(storeGet('maWhatsNewSeenVersion', '') || storeGet('maWhatsNewSeen', ''));
  }
  function markWhatsNewSeen(){
    try {
      const signature = whatsNewContentSignature();
      storeSet(WHATS_NEW_SEEN_CONTENT_KEY, signature);
      storeSet(WHATS_NEW_SEEN_AT_KEY, String(Date.now()));
      // Keep legacy keys updated for older builds/exports, but do not use app version as the main display rule.
      storeSet('maWhatsNewSeenVersion', APP_VERSION);
      storeSet('maWhatsNewSeenSignature', legacyWhatsNewSignature());
      storeSet('maWhatsNewSeen', APP_VERSION);
    } catch {}
  }
  function shouldAutoShowWhatsNew(){
    try {
      const signature = whatsNewContentSignature();
      if (storeGet(WHATS_NEW_SEEN_CONTENT_KEY, '') === signature) return false;
      if (legacySeenMatchesContent()) {
        storeSet(WHATS_NEW_SEEN_CONTENT_KEY, signature);
        storeSet(WHATS_NEW_SEEN_AT_KEY, String(Date.now()));
        return false;
      }
      return true;
    } catch { return true; }
  }
  let whatsNewOpen = false;
  function showWhatsNew(options = {}){
    if (options.auto && !shouldAutoShowWhatsNew()) return false;
    if (whatsNewOpen || !window.ModeAtlasDialog?.feature) return false;
    whatsNewOpen = true;
    window.ModeAtlasDialog.feature({
      kicker: 'Release notes',
      title: WHATS_NEW_TITLE,
      message: WHATS_NEW_COPY,
      contentNode: buildWhatsNewContent(),
      size: 'wide'
    }).finally(() => { whatsNewOpen = false; markWhatsNewSeen(); });
    return true;
  }
  function onboardingComplete(){
    try { return storeGet('modeAtlasOnboardingComplete') === 'true' || storeGet('modeAtlasStarterSeen') === 'true'; } catch { return false; }
  }
  function onboardingOpen(){ return !!document.querySelector('#maVisitModal.open'); }
  function runWhatsNewCheck(){
    let pending = false;
    try { pending = sessionStorage.getItem('modeAtlasShowWhatsNewAfterOnboarding') === '1'; } catch {}

    if (pending && !onboardingOpen()) {
      try { sessionStorage.removeItem('modeAtlasShowWhatsNewAfterOnboarding'); } catch {}
      showWhatsNew({ auto: true });
      return;
    }

    if (pending && onboardingOpen()) return;

    if (shouldAutoShowWhatsNew() && onboardingComplete() && !onboardingOpen() && ['index.html','kana.html'].includes(PAGE)) {
      showWhatsNew();
    }
  }

  function scheduleWhatsNew(){
    runWhatsNewCheck();
  }

  function aboutCard(label, infoKey, note, extraInfoKey = ''){
    const card = aboutEl('article', 'ma-about-card');
    card.append(aboutEl('span', '', label));
    const strong = document.createElement('strong');
    strong.dataset.maInfo = infoKey;
    card.append(strong);
    const small = aboutEl('small', '', note || '');
    if (extraInfoKey) small.dataset.maInfo = extraInfoKey;
    card.append(small);
    return card;
  }

  function infoRow(label, key){
    const row = document.createElement('div');
    row.append(aboutEl('span', '', label));
    const strong = document.createElement('strong');
    strong.dataset.maInfo = key;
    row.append(strong);
    return row;
  }

  function buildAboutContent(initialTab = 'overview'){
    const modal = aboutEl('div', 'ma-about-content');
    const intro = aboutEl('div', 'ma-about-hero');
    const introCopy = document.createElement('div');
    introCopy.append(
      aboutEl('div', 'ma-about-kicker', 'Mode Atlas'),
      aboutEl('p', '', 'Japanese study tools for kana recognition, recall, review, and connected learning branches.')
    );
    intro.append(aboutEl('div', 'ma-about-mark', 'かな'), introCopy);

    const tabs = aboutEl('div', 'ma-about-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'About sections');
    [['overview','Overview'],['whatsnew','What’s new'],['legal','Legal']].forEach(([key,label])=>{
      const tab=aboutButton(label,{className:'ma-button ma-button--ghost ma-button--small'});
      tab.dataset.maAboutTab=key; tab.setAttribute('role','tab'); tabs.append(tab);
    });

    const overview = aboutEl('div', 'ma-about-panel'); overview.dataset.maAboutPanel='overview';
    const grid = aboutEl('div', 'ma-about-grid');
    grid.append(
      aboutCard('App version','version','Current app release installed in this build.'),
      aboutCard('Save version','saveSchema','Helps keep backups compatible across app updates.'),
      aboutCard('Build','build','','buildDate'),
      aboutCard('Install support','installSupport','Add Mode Atlas to your device for quicker access.')
    );
    const saveSection=aboutEl('div','ma-about-section'); saveSection.append(aboutEl('h3','','Account & save status'));
    const table=aboutEl('div','ma-about-table');
    [['Save mode','saveMode'],['Sync status','cloudStatus'],['Signed in','signedIn'],['Connection','online'],['Last cloud sync','lastCloudSync'],['Local save updated','localSaveUpdated'],['Storage access','storage'],['Theme preference','theme']].forEach(([label,key])=>table.append(infoRow(label,key)));
    saveSection.append(table);
    const credit=aboutEl('div','ma-about-section ma-about-credit');
    const created=document.createElement('p'); created.append(aboutEl('strong','',`Created by ${DEVELOPER}`));
    const support=document.createElement('p'); support.append(document.createTextNode('Support: '),aboutLink(SUPPORT_EMAIL,`mailto:${SUPPORT_EMAIL}`),document.createTextNode(' · '),aboutLink(OFFICIAL_SITE,`https://${OFFICIAL_SITE}/`,{target:'_blank',rel:'noopener'}));
    credit.append(aboutEl('h3','','Developer'),created,aboutEl('p','','Designed and built as a focused Japanese study ecosystem.'),support,aboutEl('p','ma-about-muted',`© 2026 ${DEVELOPER}. All rights reserved.`));
    overview.append(grid,saveSection,credit);

    const whatsNew=aboutEl('div','ma-about-panel'); whatsNew.dataset.maAboutPanel='whatsnew';
    const whatsSection=aboutEl('div','ma-about-section'); const whatsList=aboutEl('ul','ma-about-list');
    whatsNewItems.forEach(item=>whatsList.append(aboutEl('li','',item)));
    whatsSection.append(aboutEl('h3','','What’s new in this build'),aboutEl('p','ma-about-muted','Recent improvements that affect everyday use.'),whatsList); whatsNew.append(whatsSection);

    const legal=aboutEl('div','ma-about-panel'); legal.dataset.maAboutPanel='legal';
    const privacy=aboutEl('div','ma-about-section'); const legalLinks=document.createElement('p');
    legalLinks.append(aboutLink('Open Privacy Policy',aboutAppUrl('privacy/'),{target:'_blank',rel:'noopener'}),document.createTextNode(' · '),aboutLink('Open Terms of Use',aboutAppUrl('terms/'),{target:'_blank',rel:'noopener'}));
    privacy.append(aboutEl('h3','','Privacy & data'),aboutEl('p','','Mode Atlas saves learning progress on this device. Signing in lets supported progress follow you across devices.'),aboutEl('p','','Local backups are user-controlled exports. Manual imports prioritise the selected backup for sections it contains, while empty backup sections do not wipe useful current data.'),legalLinks);
    const disclaimer=aboutEl('div','ma-about-section'); disclaimer.append(aboutEl('h3','','Disclaimer'),aboutEl('p','','Mode Atlas is a study aid. It is not an official language certification tool and does not guarantee language proficiency outcomes.'));
    const ownership=aboutEl('div','ma-about-section'); ownership.append(aboutEl('h3','','Credits & ownership'),aboutEl('p','',`Mode Atlas, its app structure, and learning interface are developed by ${DEVELOPER}. Japanese kana characters are part of the Japanese writing system and are not proprietary.`));
    legal.append(privacy,disclaimer,ownership);

    modal.append(intro,tabs,overview,whatsNew,legal);
    const info=getAppInfo(); Object.entries(info).forEach(([key,value])=>$all(`[data-ma-info="${key}"]`,modal).forEach(node=>{node.textContent=String(value);}));
    const switchTab=(name)=>{
      $all('[data-ma-about-tab]',modal).forEach(button=>{const active=button.dataset.maAboutTab===name;button.classList.toggle('active',active);button.setAttribute('aria-selected',active?'true':'false');});
      $all('[data-ma-about-panel]',modal).forEach(panel=>panel.classList.toggle('active',panel.dataset.maAboutPanel===name));
    };
    modal.addEventListener('click',event=>{const tab=event.target.closest('[data-ma-about-tab]');if(tab)switchTab(tab.dataset.maAboutTab);});
    switchTab(initialTab); return modal;
  }

  let aboutOpen=false;
  function openAbout(tab='overview'){
    if(aboutOpen||!window.ModeAtlasDialog?.feature)return false;
    aboutOpen=true;
    window.ModeAtlasDialog.feature({kicker:'Mode Atlas',title:'About Mode Atlas',contentNode:buildAboutContent(tab),size:'large'}).finally(()=>{aboutOpen=false;});
    return true;
  }


  document.addEventListener('click', event => {
    if (event.target.closest('[data-ma-about-open]')) {
      event.preventDefault();
      openAbout();
    }
  }, true);

  window.ModeAtlas = window.ModeAtlas || {};
  window.ModeAtlas.openAbout = openAbout;
  window.ModeAtlas.appInfo = getAppInfo;
  window.ModeAtlas.showWhatsNew = showWhatsNew;

  document.addEventListener('ma:visit-flow-closed', runWhatsNewCheck);
  document.addEventListener('ma:ui-refresh', runWhatsNewCheck);
  window.addEventListener('pageshow', runWhatsNewCheck);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleWhatsNew, { once: true });
  else scheduleWhatsNew();
})();
