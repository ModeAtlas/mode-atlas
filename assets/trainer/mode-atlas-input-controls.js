/* Writing input controls own their labels, selected state and input presentation. */
(function ModeAtlasInputControls(){
  if(window.ModeAtlasWritingInputControls)return;
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
      setElementVisible(keyboardWrapEl, keyboard);
      setElementHidden(choiceGridEl, keyboard);
      inputEl.placeholder = keyboard && settings.keyboardInputType === 'romaji' ? 'Type romaji, then press Enter' : 'Type kana…';
      if(keyboardNoteEl) keyboardNoteEl.textContent = !keyboard
        ? 'Choose the matching kana, or switch to Keyboard in Practice setup.'
        : settings.keyboardInputType === 'romaji'
          ? 'Use your Japanese keyboard to convert romaji to kana, then press Enter.'
          : 'Type the matching kana. Your answer is checked as you type.';
      setActive(buttons, !keyboard);
      setActive(kb, keyboard);
      if (buttons) buttons.disabled = !!sessionStarted;
      if (kb) kb.disabled = !!sessionStarted;
      if (keyboard) {
        if (c4) { c4.textContent = 'Romaji keyboard'; setElementVisible(c4, true); c4.disabled = !!sessionStarted; }
        if (c6) { c6.textContent = 'Kana keyboard'; setElementVisible(c6, true); c6.disabled = !!sessionStarted; }
        if (c8) { setElementHidden(c8, true); c8.disabled = true; }
        setActive(c4, settings.keyboardInputType === 'romaji');
        setActive(c6, settings.keyboardInputType !== 'romaji');
        setActive(c8, false);
      } else {
        if (c4) { c4.textContent = '4 choices'; setElementVisible(c4, true); c4.disabled = !!sessionStarted || forced; }
        if (c6) { c6.textContent = '6 choices'; setElementVisible(c6, true); c6.disabled = !!sessionStarted || forced; }
        if (c8) { c8.textContent = '8 choices'; setElementVisible(c8, true); c8.disabled = !!sessionStarted || forced; }
        setActive(c4, settings.choiceCount === 4 && !forced);
        setActive(c6, settings.choiceCount === 6 || forced);
        setActive(c8, settings.choiceCount === 8 && !forced);
      }
    } catch (err) { console.warn('ModeAtlas input control sync failed', err); }
  }
  function handleClick(event){
    const btn = event.target && event.target.closest && event.target.closest('#' + IDS.join(',#'));
    if (!btn) return;
    event.preventDefault();
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
    IDS.forEach(id=>{
      const button=byId(id);
      if(!button || button.dataset.maInputBound)return;
      button.dataset.maInputBound='true';
      button.addEventListener('click',handleClick);
    });
    sync();
  }
  window.ModeAtlasWritingInputControls=Object.freeze({sync});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  document.addEventListener('ma:ui-refresh', sync);
  document.addEventListener('ma:trainer-ready', sync);
})();
