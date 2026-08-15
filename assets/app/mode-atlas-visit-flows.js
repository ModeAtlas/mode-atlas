/* Mode Atlas visit flows: onboarding, daily return, and last-study tracking. */
(function(){
  if(window.__modeAtlasVisitFlowsLoaded)return; window.__modeAtlasVisitFlowsLoaded=true;
  const K={first:'modeAtlasStarterSeen',complete:'modeAtlasOnboardingComplete',kanaSetup:'modeAtlasKanaSetupComplete',pending:'modeAtlasPendingDestination',return:'modeAtlasDailyReturnSeenDate',lastVisit:'modeAtlasLastVisitStudyDate',streak:'modeAtlasVisitStreak',lastStudied:'modeAtlasLastStudiedAt',lastMode:'modeAtlasLastMode',forceFirst:'modeAtlasForceFirstVisit',forceReturn:'modeAtlasForceDailyReturn'};
  function storeGet(key, fallback='') {
    const store = window.ModeAtlasStorage;
    return store?.get?.(key, fallback) ?? localStorage.getItem(key) ?? fallback;
  }
  function storeSet(key, value) {
    const store = window.ModeAtlasStorage;
    return store?.set?.(key, value) ?? localStorage.setItem(key, String(value));
  }
  function storeRemove(key) {
    const store = window.ModeAtlasStorage;
    return store?.remove?.(key) ?? localStorage.removeItem(key);
  }
  function storeJSON(key, fallback) {
    const store = window.ModeAtlasStorage;
    if (store?.json) return store.json(key, fallback);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }
  function storeSetJSON(key, value) {
    const store = window.ModeAtlasStorage;
    return store?.setJSON?.(key, value) ?? localStorage.setItem(key, JSON.stringify(value));
  }
  const page=()=>((window.ModeAtlasPageName ? window.ModeAtlasPageName() : (location.pathname.split('/').pop() || 'index.html')).toLowerCase()||'index.html');
  const j=(k,f)=>{try{return storeJSON(k,f)}catch{return f}};
  const hasObj=k=>{const v=j(k,null);return v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length>0};
  const hasArr=k=>{const v=j(k,null);return Array.isArray(v)&&v.length>0};
  const studyDate=(d=new Date())=>{const x=new Date(d);if(x.getHours()<4)x.setDate(x.getDate()-1);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
  const BRANCH_PATHS=new Set(['/kana/','/reading/','/writing/','/results/','/wordbank/']);
  const KANA_SETUP_PATHS=new Set(['/kana/','/reading/','/writing/']);
  const onboardingComplete=()=>storeGet(K.complete)==='true'||storeGet(K.first)==='true';
  const kanaSetupComplete=()=>storeGet(K.kanaSetup)==='true'||storeGet(K.first)==='true';
  function branchDestination(raw){try{const u=new URL(raw||location.href,location.origin);return u.origin===location.origin&&BRANCH_PATHS.has(u.pathname)?u.pathname+u.search+u.hash:''}catch{return''}}
  function destinationPath(raw){try{return new URL(branchDestination(raw)||raw||location.href,location.origin).pathname}catch{return''}}
  function requiresKanaSetup(raw){return KANA_SETUP_PATHS.has(destinationPath(raw))}
  function destinationLabel(raw){const p=branchDestination(raw);if(p.startsWith('/wordbank/'))return'Word Bank';if(p.startsWith('/writing/'))return'Kana Writing';if(p.startsWith('/results/'))return'Kana Results';if(p.startsWith('/reading/'))return'Kana Reading';return'Kana Trainer'}
  function needsSetup(raw){return !onboardingComplete()||(requiresKanaSetup(raw)&&!kanaSetupComplete())}
  function vEl(tag, className='', text=''){const el=document.createElement(tag);if(className)el.className=className;if(text!=='')el.textContent=String(text);return el}
  function vBtn(className='', text=''){const btn=vEl('button',className,text);btn.type='button';return btn}
  function vLink(className='', text='', href=''){const a=vEl('a',className,text);a.href=href;return a}
  function hasData(){return hasObj('charStats')||hasObj('reverseCharStats')||hasObj('scoreHistory')||hasObj('reverseScoreHistory')||hasArr('kanaWordBank')||hasArr('testModeResults')||hasArr('writingTestModeResults')||Number(storeGet('highScore','0')||0)>0||Number(storeGet('reverseHighScore','0')||0)>0}
  function diff(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000)}
  function streak(){const t=studyDate(),l=storeGet(K.lastVisit);let s=Number(storeGet(K.streak,'0')||0);if(l!==t){s=(l&&diff(l,t)===1)?s+1:1;storeSet(K.lastVisit,t);storeSet(K.streak,String(s))}return s||1}
  function ago(ts){ts=Number(ts||0);if(!ts)return'No study recorded yet';const m=Math.floor(Math.max(0,Date.now()-ts)/60000);if(m<1)return'Just now';if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`}
  function mode(kind){const s=j(kind==='writing'?'reverseSettings':'settings',{});if(s.testMode)return'Test Mode';if(s.dailyChallenge)return'Daily Challenge';if(s.comboKana)return'Combo Kana Mode';if(s.timeTrial)return'Time Trial Mode';if(s.endless)return'Endless Mode';if(s.focusWeak)return'Focus Weak';return'Standard Mode'}
  function record(kind){const obj=kind==='writing'?{branch:'Kana Trainer',page:'Writing Practice',href:'reverse.html',mode:mode('writing')}:{branch:'Kana Trainer',page:'Reading Practice',href:'default.html',mode:mode('reading')};storeSet(K.lastStudied,String(Date.now()));storeSetJSON(K.lastMode,obj)}
  function track(){const p=page();if(p==='default.html'||p==='reverse.html'){const kind=p==='reverse.html'?'writing':'reading';document.addEventListener('click',e=>{if(e.target.closest('#startBtn,#endSessionBtn,#retryBtn,.choice-btn,#choiceGrid,.btn'))record(kind)},{passive:true});document.addEventListener('keydown',e=>{if(e.key==='Enter')record(kind)},{passive:true})}else if(p==='wordbank.html'){document.addEventListener('click',e=>{if(e.target.closest('#addWordBtn,[data-action="save"],[data-action="favorite"]')){storeSet(K.lastStudied,String(Date.now()));storeSetJSON(K.lastMode,{branch:'Word Bank',page:'Word Bank',href:'wordbank.html',mode:'Vocabulary Review'})}},{passive:true})}}
  const ROWS=[['あ row','あいうえお'],['か row','かきくけこ'],['さ row','さしすせそ'],['た row','たちつてと'],['な row','なにぬねの'],['は row','はひふへほ'],['ま row','まみむめも'],['や row','やゆよ'],['ら row','らりるれろ'],['わ row','わをん'],['ア row','アイウエオ'],['カ row','カキクケコ'],['サ row','サシスセソ'],['タ row','タチツテト'],['ナ row','ナニヌネノ']];
  function suggestions(){const st=j('charStats',{}),tm=j('charTimes',{});const a=ROWS.map(([name,chars])=>{let c=0,w=0,ms=0,n=0;[...chars].forEach(ch=>{c+=Number(st[ch]?.correct||0);w+=Number(st[ch]?.wrong||0);if(tm[ch]?.avg&&tm[ch]?.count){ms+=tm[ch].avg*tm[ch].count;n+=tm[ch].count}});const total=c+w,acc=total?c/total:1;return{name,total,score:w*4+(1-acc)*50+Math.min((n?ms/n:0)/500,12)+(total?0:-100)}}).filter(r=>r.total>0).sort((a,b)=>b.score-a.score).slice(0,3);return a.length?a:[{name:'あ row'},{name:'か row'},{name:'さ row'}]}
  function name(){const u=window.KanaCloudSync?.getUser?.();const n=(u?.displayName||u?.email||'').trim();if(n)return n.split(/\s+/)[0].split('@')[0];for(const id of ['profileName','drawerName','studyProfileName','identityName']){const e=document.getElementById(id),t=(e?.textContent||'').trim();if(t&&!/guest/i.test(t))return t.split(/\s+/)[0]}return'there'}
  function appBasePath(){
    try { return new URL((window.ModeAtlasEnv && window.ModeAtlasEnv.baseUrl) || '/', location.origin).pathname; } catch {}
    return '/';
  }
  function appUrl(path){
    const clean = String(path || '').replace(/^\/+/, '');
    try {
      const baseUrl = new URL(clean, location.origin + appBasePath());
      return window.ModeAtlasVersionFile?.appUrl?.(baseUrl.pathname + baseUrl.search + baseUrl.hash) || (baseUrl.pathname + baseUrl.search + baseUrl.hash);
    } catch { return window.ModeAtlasVersionFile?.appUrl?.('/' + clean) || '/' + clean; }
  }
  function navigateApp(path){
    if (window.ModeAtlasVersionFile?.navigate) {
      window.ModeAtlasVersionFile.navigate(path);
      return;
    }
    location.href = appUrl(path);
  }
  function legalUrl(kind){ return appUrl(kind === 'terms' ? 'terms/' : 'privacy/'); }
  function ensure(){
    if(document.getElementById('maVisitModal'))return;
    const m=document.createElement('div');
    m.id='maVisitModal';
    m.className='ma-visit-backdrop';
    const card=vEl('div','ma-card ma-visit-card');
    card.setAttribute('role','dialog');
    card.setAttribute('aria-modal','true');
    const content=document.createElement('div');
    content.id='maVisitContent';
    card.append(content);
    m.append(card);
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m)closeModal()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()})
  }
  function openModal(locked=false){const modal=document.getElementById('maVisitModal');if(!modal)return;modal.dataset.locked=locked?'true':'false';modal.classList.add('open');try{document.dispatchEvent(new CustomEvent('ma:visit-flow-opened'))}catch{}}
  function closeModal(force,resumeInstall=true){const modal=document.getElementById('maVisitModal'); if(!modal)return; if(modal.dataset.locked==='true' && force!==true)return; modal.classList.remove('open'); modal.dataset.locked='false'; try{document.dispatchEvent(new CustomEvent('ma:visit-flow-closed',{detail:{resumeInstall}}))}catch{}}
  function markLegalComplete(){
    storeSet(K.complete,'true');
    storeSet('modeAtlasLegalAccepted','true');
    storeSet('modeAtlasLegalAcceptedAt',String(Date.now()));
    storeSet('modeAtlasLegalVersion','2026-05');
  }
  function markKanaSetupComplete(){
    storeSet(K.kanaSetup,'true');
    storeSet(K.first,'true');
  }
  function first(destination,options={}){
    ensure();
    const target=branchDestination(destination)||branchDestination(storeGet(K.pending))||'/kana/';
    storeSet(K.pending,target);
    const force=options.force===true;
    const requireLegal=force||!onboardingComplete();
    const requireKana=requiresKanaSetup(target)&&(force||!kanaSetupComplete());
    if(!requireLegal&&!requireKana){storeRemove(K.pending);navigateApp(target);return;}

    const c=document.getElementById('maVisitContent');
    const presets=[
      ['starter','Starter','あ row + hint mode. Best if kana is brand new.'],
      ['intermediate','Intermediate','All hiragana rows with hints off.'],
      ['advanced','Advanced','Hiragana, katakana, and dakuten.'],
      ['pro','Pro','Everything enabled, including yōon and extended katakana.']
    ];
    c.replaceChildren();

    let copy='Review the Privacy Policy and Terms of Use, then continue to '+destinationLabel(target)+'.';
    if(requireKana&&requireLegal) copy='Choose your Kana Trainer starting level, agree to the terms, then continue to '+destinationLabel(target)+'.';
    else if(requireKana) copy='Choose the Kana Trainer starting level that feels right for you. You can change it whenever you want.';
    c.append(
      vEl('div','ma-visit-kicker',requireKana?'Kana Trainer setup':'Mode Atlas setup'),
      vEl('h2','ma-visit-title',requireKana&&!requireLegal?'Set up Kana Trainer':'Welcome to Mode Atlas'),
      vEl('p','ma-visit-copy',copy)
    );

    let selected='';
    if(requireKana){
      const panel=vEl('div','ma-card ma-card--soft ma-visit-panel');
      panel.append(vEl('div','ma-visit-label','Starting level'));
      const presetGrid=vEl('div','ma-visit-presets');
      presets.forEach(preset=>{
        const btn=vBtn('ma-visit-preset');
        btn.dataset.maOnboardingPreset=preset[0];
        btn.setAttribute('aria-pressed','false');
        btn.append(vEl('span','',preset[1]),vEl('small','',preset[2]));
        presetGrid.append(btn);
      });
      panel.append(presetGrid);
      c.append(panel);
    }

    let agree=null;
    if(requireLegal){
      const legal=vEl('div','ma-visit-legal');
      const links=vEl('div','ma-visit-legal-links');
      const privacy=vLink('', 'Privacy Policy', legalUrl('privacy'));
      privacy.target='_blank';privacy.rel='noopener';
      const terms=vLink('', 'Terms of Use', legalUrl('terms'));
      terms.target='_blank';terms.rel='noopener';
      links.append(privacy,terms);
      const label=vEl('label','ma-check ma-visit-check');
      agree=document.createElement('input');
      agree.type='checkbox';
      agree.dataset.legalAgree='';
      label.append(agree,vEl('span','','I agree to the Privacy Policy and Terms of Use.'));
      legal.append(links,label);
      c.append(legal);
    }

    const err=vEl('div','ma-status ma-status--error ma-visit-error','Could not save your starting level. Please try again.');
    err.dataset.setupError='';
    const actions=vEl('div','ma-visit-actions');
    const begin=vBtn('ma-button ma-button--primary ma-visit-btn',`Continue to ${destinationLabel(target)}`);
    begin.dataset.begin='';
    actions.append(begin);
    c.append(err,actions);

    function refresh(){
      const ready=(!requireKana||Boolean(selected))&&(!requireLegal||Boolean(agree?.checked));
      begin.disabled=!ready;
      begin.setAttribute('aria-disabled',ready?'false':'true');
      begin.classList.toggle('ready',ready);
      c.classList.toggle('ma-visit-ready',ready);
      if(ready)err.classList.remove('show');
    }
    if(requireKana){
      c.addEventListener('click',event=>{
        const preset=event.target.closest('[data-ma-onboarding-preset]');
        if(!preset||!c.contains(preset))return;
        event.preventDefault();
        selected=preset.getAttribute('data-ma-onboarding-preset')||'';
        c.querySelectorAll('[data-ma-onboarding-preset]').forEach(btn=>{
          const on=btn===preset;
          btn.classList.toggle('selected',on);
          btn.setAttribute('aria-pressed',on?'true':'false');
        });
        refresh();
      });
    }
    if(agree){agree.addEventListener('change',refresh);agree.addEventListener('input',refresh);}
    begin.addEventListener('click',()=>{
      if(begin.disabled)return;
      if(requireKana){
        const applied=window.ModeAtlasPresets?.apply?.(selected,{target:'both',source:'onboarding'});
        if(!applied){err.classList.add('show');return;}
        markKanaSetupComplete();
      }
      if(requireLegal)markLegalComplete();
      storeSet(K.return,studyDate());
      if(requireLegal)sessionStorage.setItem('modeAtlasShowWhatsNewAfterOnboarding','1');
      const next=branchDestination(storeGet(K.pending))||target;
      storeRemove(K.pending);
      closeModal(true,false);
      if(requireLegal){try{document.dispatchEvent(new CustomEvent('ma:onboarding-complete'))}catch{}}
      if(requireKana){try{document.dispatchEvent(new CustomEvent('ma:kana-setup-complete'))}catch{}}
      navigateApp(next);
    });
    openModal(true);
    refresh();
  }
  function ret(){
    ensure();
    storeSet(K.return,studyDate());
    const lm=j(K.lastMode,{page:'Reading Practice',mode:'Endless Mode',href:'default.html'}),s=suggestions(),st=streak();
    const c=document.getElementById('maVisitContent');
    c.replaceChildren(
      vEl('div','ma-visit-kicker','Daily return'),
      vEl('h2','ma-visit-title',`Welcome back, ${name()}`)
    );

    const copy=vEl('p','ma-visit-copy');
    copy.append(
      document.createTextNode('Last studied: '),
      vEl('strong','',ago(storeGet(K.lastStudied))),
      document.createElement('br'),
      document.createTextNode('Current streak: '),
      vEl('strong','',`${st} day${st===1?'':'s'}`)
    );

    const reviewPanel=vEl('div','ma-card ma-card--soft ma-visit-panel');
    reviewPanel.append(vEl('div','ma-visit-label','Suggested review'));
    const reviewList=vEl('div','ma-visit-list');
    s.forEach(r=>reviewList.append(vEl('span','ma-visit-chip',r.name)));
    reviewPanel.append(reviewList);

    const resumePanel=vEl('div','ma-card ma-card--soft ma-visit-panel');
    resumePanel.append(vEl('div','ma-visit-label','Resume'));
    const resumeList=vEl('div','ma-visit-list');
    resumeList.append(vEl('span','ma-visit-chip',`${lm.page||'Reading Practice'} · ${lm.mode||'Endless Mode'}`));
    resumePanel.append(resumeList);

    const actions=vEl('div','ma-visit-actions');
    actions.append(vLink('ma-button ma-button--primary ma-visit-btn','Resume',lm.href||'default.html'));
    const close=vBtn('ma-button ma-button--ghost ma-visit-btn','Not now');
    close.dataset.close='';
    actions.append(close);

    c.append(copy,reviewPanel,resumePanel,actions);
    close.addEventListener('click',()=>closeModal());
    openModal(false);
  }
  let visitDecisionMade=false;
  async function waitForInitialCloudState(){
    let initialCloudReady=true;
    try{
      if(window.KanaCloudSync?.waitForInitialHydration)initialCloudReady=await window.KanaCloudSync.waitForInitialHydration();
      else if(window.KanaCloudSync?.beforePageLoad)await window.KanaCloudSync.beforePageLoad();
      else if(window.KanaCloudSync?.ready)await window.KanaCloudSync.ready;
    }catch{initialCloudReady=false}
    return initialCloudReady;
  }
  async function maybe(){
    if(visitDecisionMade)return;
    const q=new URLSearchParams(location.search),ff=sessionStorage.getItem(K.forceFirst)==='1'||q.has('devFirstVisit')||q.has('setup'),fr=sessionStorage.getItem(K.forceReturn)==='1'||q.has('devReturn');
    sessionStorage.removeItem(K.forceFirst);sessionStorage.removeItem(K.forceReturn);storeRemove(K.forceFirst);storeRemove(K.forceReturn);
    const initialCloudReady=await waitForInitialCloudState();
    if(visitDecisionMade)return;
    if(ff){visitDecisionMade=true;return first(branchDestination(location.href)||'/kana/',{force:true});}
    if(fr){visitDecisionMade=true;return ret();}
    if(!initialCloudReady&&window.KanaCloudSync?.getUser?.())return;
    const current=branchDestination(location.href);
    if(!current){if(onboardingComplete()&&hasData())streak();return;}
    if(needsSetup(current)){visitDecisionMade=true;return first(current);}
    if(hasData())streak();
  }
  function triggerFirst(){storeRemove(K.forceFirst);sessionStorage.removeItem(K.forceFirst);first(branchDestination(location.href)||'/kana/',{force:true})}
  function triggerReturn(){storeRemove(K.forceReturn);sessionStorage.removeItem(K.forceReturn);if(page()==='index.html')ret();else{sessionStorage.setItem(K.forceReturn,'1');navigateApp('/?devReturn=1')}}
  function reset(){[K.first,K.complete,K.kanaSetup,K.pending,K.return,K.forceFirst,K.forceReturn,K.lastVisit,K.streak].forEach(k=>storeRemove(k));console.info('Mode Atlas visit flags reset')}
  window.modeAtlasTriggerFirstVisit=triggerFirst;window.modeAtlasTriggerDailyReturn=triggerReturn;window.modeAtlasResetVisitFlags=reset;
  async function gateLink(event){
    if(event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest?.('a[href]');if(!link)return;
    const target=branchDestination(link.href);if(!target||!needsSetup(target))return;
    event.preventDefault();
    const cloudReady=await waitForInitialCloudState();
    if(!cloudReady&&window.KanaCloudSync?.getUser?.()){navigateApp(target);return;}
    if(!needsSetup(target)){navigateApp(target);return;}
    visitDecisionMade=true;
    first(target);
  }
  function init(){track();document.addEventListener('click',gateLink);maybe();window.addEventListener('kanaCloudSyncStatusChanged',maybe);document.addEventListener('ma:ui-refresh',maybe)} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();