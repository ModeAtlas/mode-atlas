(function ModeAtlasInputControls(){
  const IDS = ['buttonsModeBtn','keyboardModeBtn','choice4Btn','choice6Btn','choice8Btn'];
  function byId(id){ return document.getElementById(id); }
  function setActive(el, active){
    if (!el) return;
    el.classList.toggle('active', !!active);
    el.classList.toggle('btn-secondary', !!active);
    el.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  function isTestForced(){
    try { return typeof isTestModeSession === 'function' && isTestModeSession(); }
    catch (_) { return false; }
  }
  function sync(){
    try {
      if (typeof settings !== 'object') return;
      const forced = isTestForced();
      const keyboard = !!settings.keyboardMode;
      const buttons = byId('buttonsModeBtn');
      const kb = byId('keyboardModeBtn');
      const c4 = byId('choice4Btn');
      const c6 = byId('choice6Btn');
      const c8 = byId('choice8Btn');
      setActive(buttons, !keyboard);
      setActive(kb, keyboard);
      if (buttons) buttons.disabled = !!sessionStarted;
      if (kb) kb.disabled = !!sessionStarted;
      if (keyboard) {
        if (c4) { c4.textContent = 'Romaji Keyboard'; setElementVisible(c4, true); c4.disabled = !!sessionStarted; }
        if (c6) { c6.textContent = 'Kana Keyboard'; setElementVisible(c6, true); c6.disabled = !!sessionStarted; }
        if (c8) { setElementHidden(c8, true); c8.disabled = true; }
        setActive(c4, settings.keyboardInputType === 'romaji');
        setActive(c6, settings.keyboardInputType !== 'romaji');
        setActive(c8, false);
      } else {
        if (c4) { c4.textContent = '4 Choices'; setElementVisible(c4, true); c4.disabled = !!sessionStarted || forced; }
        if (c6) { c6.textContent = '6 Choices'; setElementVisible(c6, true); c6.disabled = !!sessionStarted || forced; }
        if (c8) { c8.textContent = '8 Choices'; setElementVisible(c8, true); c8.disabled = !!sessionStarted || forced; }
        setActive(c4, settings.choiceCount === 4 && !forced);
        setActive(c6, settings.choiceCount === 6 || forced);
        setActive(c8, settings.choiceCount === 8 && !forced);
      }
    } catch (err) { console.warn('ModeAtlas input control sync failed', err); }
  }
  function handleClick(event){
    const btn = event.target && event.target.closest && event.target.closest('#' + IDS.join(',#'));
    if (!btn) return;
    // Keep these controls independent from the other trainer controls.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    try {
      if (btn.disabled || sessionStarted || typeof settings !== 'object') return;
      if (btn.id === 'buttonsModeBtn') {
        settings.keyboardMode = false;
      } else if (btn.id === 'keyboardModeBtn') {
        settings.keyboardMode = true;
        if (!['romaji','kana'].includes(settings.keyboardInputType)) settings.keyboardInputType = 'kana';
      } else if (btn.id === 'choice4Btn') {
        if (settings.keyboardMode) settings.keyboardInputType = 'romaji';
        else settings.choiceCount = 4;
      } else if (btn.id === 'choice6Btn') {
        if (settings.keyboardMode) settings.keyboardInputType = 'kana';
        else settings.choiceCount = 6;
      } else if (btn.id === 'choice8Btn') {
        if (settings.keyboardMode) return;
        settings.choiceCount = 8;
      }
      if (typeof onSettingsChanged === 'function') onSettingsChanged();
      else sync();
      window.ModeAtlasLifecycle?.requestUiRefresh?.('input-controls-changed');
    } catch (err) { console.warn('Mode Atlas input control click failed', err); }
  }
  function install(){
    if (document.documentElement.dataset.maReverseInputControlFix) return;
    document.documentElement.dataset.maReverseInputControlFix = 'true';
    document.addEventListener('click', handleClick, true);
    document.addEventListener('touchend', function(event){
      const btn = event.target && event.target.closest && event.target.closest('#' + IDS.join(',#'));
      if (!btn) return;
      // Let the following click event do the actual work; this only stops menu close handling.
      event.stopPropagation();
    }, true);
    const oldApply = typeof applyPanelStates === 'function' ? applyPanelStates : null;
    if (oldApply && !oldApply.__maInputControlWrapped) {
      const wrapped = function(){
        const result = oldApply.apply(this, arguments);
        sync();
        return result;
      };
      wrapped.__maInputControlWrapped = true;
      applyPanelStates = wrapped;
    }
    sync();
    window.ModeAtlasLifecycle?.requestUiRefresh?.('input-controls-install');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  document.addEventListener('ma:ui-refresh', sync);
  document.addEventListener('ma:trainer-ready', sync);
})();
