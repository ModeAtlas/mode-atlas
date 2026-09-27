(function ModeAtlasPwa(){
  'use strict';
  if (window.__modeAtlasPwaLoaded) return;
  window.__modeAtlasPwaLoaded = true;

  const PROMPT_SEEN_KEY = 'modeAtlasInstallPromptSeen';
  const PROMPT_DISMISSED_AT_KEY = 'modeAtlasInstallPromptDismissedAt';
  const AUTO_INSTALL_CORRECT_THRESHOLD = 100;
  let deferredPrompt = null;

  function $(sel, root = document){ return root.querySelector(sel); }
  function isStandalone(){
    try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
    catch { return false; }
  }
  function hasSeenPrompt(){
    try { return window.ModeAtlasStorage?.get?.(PROMPT_SEEN_KEY) === '1'; } catch { return true; }
  }
  function markPromptSeen(options = {}){
    try {
      window.ModeAtlasStorage?.set?.(PROMPT_SEEN_KEY, '1');
      if (options.dismissed === true) window.ModeAtlasStorage?.set?.(PROMPT_DISMISSED_AT_KEY, String(Date.now()));
      else window.ModeAtlasStorage?.remove?.(PROMPT_DISMISSED_AT_KEY);
    } catch {}
  }
  function lifetimeCorrect(){
    try { return Math.max(0, Number(window.ModeAtlasProgress?.getLifetimeCorrect?.() || 0)); }
    catch { return 0; }
  }
  function isEligible(){ return lifetimeCorrect() >= AUTO_INSTALL_CORRECT_THRESHOLD; }
  function visitFlowOpen(){ return !!$('#maVisitModal.open'); }
  function calmDestination(){
    const path = String(location.pathname || '/').replace(/\/+$/, '') || '/';
    return path === '/' || path === '/kana';
  }

  async function showInstall(){
    if (isStandalone()) return true;
    if (deferredPrompt) {
      try { deferredPrompt.prompt(); await deferredPrompt.userChoice; } catch {}
      deferredPrompt = null;
      window.ModeAtlasInstall.deferredPrompt = null;
      markPromptSeen();
      $('#maInstallPrompt')?.remove();
      return true;
    }
    window.ModeAtlasFeedback?.toast?.(
      'To install Mode Atlas, use your browser install option or, on iPad/iPhone, Share → Add to Home Screen.',
      'info',
      5200
    );
    markPromptSeen();
    $('#maInstallPrompt')?.remove();
    return false;
  }

  function showInstallPrompt(){
    if ($('#maInstallPrompt') || hasSeenPrompt() || isStandalone() || visitFlowOpen() || !isEligible()) return false;
    const prompt = document.createElement('div');
    prompt.id = 'maInstallPrompt';
    prompt.className = 'ma-install-prompt';

    const copy = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = 'Keep Mode Atlas close';
    const text = document.createElement('span');
    text.textContent = `You’ve completed ${Math.max(AUTO_INSTALL_CORRECT_THRESHOLD, Math.floor(lifetimeCorrect())).toLocaleString()} correct kana answers. Install Mode Atlas for faster access and a full-screen study experience.`;
    copy.append(title, text);

    const installBtn = document.createElement('button');
    installBtn.type = 'button';
    installBtn.className = 'ma-button ma-button--primary';
    installBtn.dataset.maInstall = '';
    installBtn.textContent = deferredPrompt ? 'Install' : 'How to install';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ma-button ma-button--ghost';
    closeBtn.dataset.maInstallClose = '';
    closeBtn.textContent = 'Not now';

    prompt.replaceChildren(copy, installBtn, closeBtn);
    document.body.appendChild(prompt);
    return true;
  }

  function naturalBreak(){
    if (!isEligible() || hasSeenPrompt() || isStandalone() || visitFlowOpen()) return false;
    return showInstallPrompt();
  }

  // This module owns install UX only. Progression owns eligibility data and
  // trainers only signal natural breaks; neither renders an install prompt.
  window.ModeAtlasInstall = Object.assign(window.ModeAtlasInstall || {}, {
    show: showInstall,
    naturalBreak,
    isEligible,
    lifetimeCorrect,
    isStandalone,
    hasSeenPrompt,
    markPromptSeen,
    threshold: AUTO_INSTALL_CORRECT_THRESHOLD,
    get deferredPrompt(){ return deferredPrompt; },
    set deferredPrompt(value){ deferredPrompt = value; }
  });

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    window.ModeAtlasInstall.deferredPrompt = event;
    if (calmDestination()) naturalBreak();
  });

  document.addEventListener('click', event => {
    const close = event.target.closest('[data-ma-install-close]');
    if (close) {
      event.preventDefault();
      markPromptSeen({ dismissed: true });
      close.closest('#maInstallPrompt')?.remove();
      return;
    }
    const install = event.target.closest('[data-ma-install]');
    if (!install) return;
    event.preventDefault();
    void showInstall();
  });

  document.addEventListener('ma:visit-flow-opened', () => { $('#maInstallPrompt')?.remove(); });
  document.addEventListener('ma:visit-flow-closed', event => {
    if (event.detail?.resumeInstall === false) return;
    if (calmDestination()) naturalBreak();
  });

  window.addEventListener('appinstalled', () => {
    markPromptSeen();
    deferredPrompt = null;
    window.ModeAtlasInstall.deferredPrompt = null;
    $('#maInstallPrompt')?.remove();
  });

  const scheduleCalmPageOffer = () => {
    if (!calmDestination()) return;
    setTimeout(() => naturalBreak(), 500);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleCalmPageOffer, { once: true });
  else scheduleCalmPageOffer();
})();
