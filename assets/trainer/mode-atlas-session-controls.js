(function ModeAtlasSessionControls(){
  if (window.__modeAtlasSessionControlsInstalled) return;
  window.__modeAtlasSessionControlsInstalled = true;

  let paused = false, pauseRemaining = null, pausedAt = 0;
  let feedback = null;
  let phoneFrameTimer = 0;

  const choiceButtons = () => {
    try { return (typeof choiceGridEl !== 'undefined' && choiceGridEl) ? choiceGridEl.querySelectorAll('button') : []; }
    catch { return []; }
  };
  const answerDisplay = () => {
    try { if (typeof getAcceptedAnswerDisplay === 'function') return getAcceptedAnswerDisplay(); } catch {}
    try { if (typeof getDisplayAnswerForCurrentChar === 'function') return getDisplayAnswerForCurrentChar(); } catch {}
    try { return String(currentChar || ''); } catch { return ''; }
  };

  function ensureButtons(){
    const actions = document.getElementById('sessionActions');
    if (!actions) return;

    const skip = actions.querySelector('#skipKanaBtn');
    const pause = actions.querySelector('#pauseSessionBtn');

    if (pause && !pause.dataset.maSessionControlBound) {
      pause.dataset.maSessionControlBound = '1';
      pause.addEventListener('click', togglePause);
    }

    if (skip && !skip.dataset.maSessionControlBound) {
      skip.dataset.maSessionControlBound = '1';
      skip.addEventListener('click', skipCurrentKana);
    }

    const card = document.querySelector('.ma-trainer-card');
    if (card && !card.querySelector('.ma-pause-overlay')) {
      card.classList.add('ma-pause-host');
      const overlay = Object.assign(document.createElement('div'), { className:'ma-pause-overlay', textContent:'Paused' });
      overlay.setAttribute('role', 'status');
      card.appendChild(overlay);
    }
  }

  function pauseTimers(){
    try {
      if (typeof trialTimerId !== 'undefined' && trialTimerId) {
        pauseRemaining = Math.max(0, trialEndTime - Date.now());
        clearInterval(trialTimerId); trialTimerId = null;
      }
    } catch {}
  }
  function resumeTimers(){
    try {
      if (pauseRemaining === null) return;
      const remaining = pauseRemaining;
      pauseRemaining = null;
      resumeTimedModeTimer(remaining);
    } catch {}
  }
  function setInputDisabled(disabled){
    try { inputEl.disabled = disabled; } catch {}
    try { choiceButtons().forEach(button => { button.disabled = disabled; }); } catch {}
    const continueButton = document.getElementById('studyFeedbackContinue');
    if (continueButton) continueButton.disabled = paused;
  }
  function isPhoneTrainerSession(){
    return document.body?.dataset?.effectiveDisplayMode === 'phone'
      && document.body.classList.contains('trainer-session-active');
  }
  function syncPhoneKeyboardState(){
    const viewport = window.visualViewport;
    const layoutHeight = Number(window.innerHeight || 0);
    const visibleHeight = Number(viewport?.height || layoutHeight);
    const keyboardOpen = isPhoneTrainerSession()
      && document.activeElement?.id === 'input'
      && layoutHeight > 0
      && visibleHeight > 0
      && (layoutHeight - visibleHeight) > 120;
    document.body.classList.toggle('ma-phone-keyboard-open', keyboardOpen);
  }

  function alignPhoneTrainerFrame(){
    if (!isPhoneTrainerSession()) {
      document.body.classList.remove('ma-phone-keyboard-open');
      return;
    }
    const activeInput = document.getElementById('input');
    const nativeIOS = window.ModeAtlasEnv?.isNativeApp && window.ModeAtlasEnv.nativePlatform === 'ios';
    const frameStart = (nativeIOS && document.querySelector('.ma-trainer-card'))
      || document.querySelector('.ma-session-hud') || document.querySelector('.ma-trainer-header');
    if (!activeInput || !frameStart || document.activeElement !== activeInput) return;

    syncPhoneKeyboardState();

    const frameRect = frameStart.getBoundingClientRect();
    const inputRect = activeInput.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = Number(viewport?.offsetTop || 0);
    const viewportHeight = Number(viewport?.height || window.innerHeight || 0);
    if (!viewportHeight) return;

    const inset = nativeIOS ? Math.max(12, parseFloat(getComputedStyle(document.body).paddingTop) || 0) : 12;
    let viewportBottom = viewportTop + viewportHeight - 12;
    if (nativeIOS) {
      for (const selector of ['.ma-ios-tabs', '.ma-ios-reading-keyboard']) {
        const element = document.querySelector(selector);
        if (element && element.getClientRects().length) viewportBottom = Math.min(viewportBottom, element.getBoundingClientRect().top - 12);
      }
    }
    const available = Math.max(0, viewportBottom - viewportTop - inset);
    const regionHeight = Math.max(0, inputRect.bottom - frameRect.top);
    let targetTop = viewportTop + inset;

    if (regionHeight < available) {
      targetTop += nativeIOS ? Math.max(0, (available - regionHeight) / 2) : Math.max(0, Math.min(36, (available - regionHeight) * 0.35));
    } else {
      targetTop = nativeIOS ? viewportTop + inset : Math.max(viewportTop + 6, viewportTop + viewportHeight - inset - regionHeight);
    }

    const delta = frameRect.top - targetTop;
    if (Math.abs(delta) > 2) window.scrollTo(0, Math.max(0, window.scrollY + delta));
  }
  function schedulePhoneTrainerFrame(){
    window.clearTimeout(phoneFrameTimer);
    if (!isPhoneTrainerSession()) return;
    window.requestAnimationFrame(() => window.requestAnimationFrame(alignPhoneTrainerFrame));
    phoneFrameTimer = window.setTimeout(alignPhoneTrainerFrame, 220);
  }
  function focusInputIfNeeded(){
    try {
      const hasKeyboardMode = typeof settings !== 'undefined' && Object.prototype.hasOwnProperty.call(settings, 'keyboardMode');
      if (!hasKeyboardMode || settings.keyboardMode) {
        try { inputEl.focus({ preventScroll: true }); } catch { inputEl.focus(); }
        schedulePhoneTrainerFrame();
      }
    } catch {}
  }
  function setPauseButtonState(isPaused){
    const btn = document.getElementById('pauseSessionBtn');
    if (!btn) return;
    const label = btn.querySelector('[data-ma-pause-label]');
    if (label) label.textContent = isPaused ? 'Resume' : 'Pause';
    const use = btn.querySelector('use');
    if (use) {
      const current = use.getAttribute('href') || '/assets/mode-atlas-icons.svg#icon-pause';
      const base = current.split('#')[0];
      use.setAttribute('href', `${base}#icon-${isPaused ? 'play' : 'pause'}`);
    }
  }
  function pause(){
    if (!sessionStarted || paused || isElementVisible(gameOverEl)) return;
    paused = true;
    pausedAt = Date.now();
    pauseTimers();
    if (feedback && !feedback.manual) {
      clearTimeout(feedback.timer);
      feedback.remaining = Math.max(0, feedback.deadline - pausedAt);
    }
    clearTimeout(hintTimeout);
    locked = true;
    setInputDisabled(true);
    document.body.classList.add('ma-session-paused');
    setPauseButtonState(true);
  }
  function accountForPause(){
    if (!pausedAt) return;
    const elapsed = Math.max(0, Date.now() - pausedAt);
    if (charStartTime) charStartTime += elapsed;
    if (dailyStartTime) dailyStartTime += elapsed;
    if (testStartTime) testStartTime += elapsed;
    if (sessionStats.startTime) sessionStats.startTime += elapsed;
    pausedAt = 0;
  }
  function resume(){
    if (!sessionStarted || !paused) return;
    accountForPause();
    paused = false;
    document.body.classList.remove('ma-session-paused');
    setPauseButtonState(false);
    locked = !!feedback;
    setInputDisabled(locked);
    resumeTimers();
    if (!sessionStarted) return;
    if (feedback) {
      scheduleFeedback();
      if (feedback.manual) document.getElementById('studyFeedbackContinue')?.focus({preventScroll:true});
    }
    else { scheduleHint(); focusInputIfNeeded(); }
  }
  function togglePause(){ paused ? resume() : pause(); }

  function scheduleFeedback(){
    if (!feedback || paused || feedback.manual) return;
    feedback.deadline = Date.now() + feedback.remaining;
    feedback.timer = setTimeout(completeFeedback, feedback.remaining);
  }
  function completeFeedback(){
    if (!feedback || paused) return;
    const complete = feedback;
    cancelFeedback();
    if (!sessionStarted) return;
    locked = false;
    setInputDisabled(false);
    complete.onDone?.();
  }
  function flashResult(prompt, correct, onDone){
    cancelFeedback();
    window.ModeAtlasSounds?.play(correct ? 'correct' : 'wrong', {cooldown:130});
    locked = true;
    prompt.classList.add(correct ? 'flash-correct' : 'flash-wrong');
    feedback = {prompt, onDone, remaining:correct ? 260 : 420, deadline:0, timer:0};
    feedback.manual = trainerController.study.showFeedback(completeFeedback);
    if (feedback.manual) { setInputDisabled(true); inputEl.blur(); }
    scheduleFeedback();
  }
  function cancelFeedback(){
    if (feedback) {
      clearTimeout(feedback.timer);
      feedback.prompt.classList.remove('flash-correct', 'flash-wrong');
    }
    feedback = null;
    trainerController.study.clearFeedback();
  }

  function markSkipped(){
    recordTrainerActivity();
    const timeTaken = Math.max(0, Date.now() - charStartTime);
    for (const ch of getCurrentKanaUnits()) {
      if (!stats[ch]) stats[ch] = { correct: 0, wrong: 0 };
      stats[ch].wrong += 1;
      updateAverageTime(ch, timeTaken / Math.max(1, getCurrentKanaUnits().length));
      updateSrsWrong(ch);
    }
    sessionStats.answered += 1; sessionStats.wrong += 1; sessionStats.timings.push(timeTaken);
    sessionStats.bestStreak = Math.max(sessionStats.bestStreak, streak);
    updateSessionChar(currentChar, false, timeTaken);
    trainerController.study.recordAnswer({kana:currentChar, answer:'', correct:false, skipped:true});
    if (isDailyChallengeSession()) { dailyWrong += 1; dailyIndex += 1; }
    else if (isTestModeSession()) { testWrong += 1; testIndex += 1; }
    else if (currentFlowModeIsContinuous()) { endlessRunTotal += 1; endlessRunWrong += 1; }
    try { if (typeof pendingImmediateRepeatChar !== 'undefined') pendingImmediateRepeatChar = null; } catch {}
    streak = 0; lastComboLength = getComboLength(); hideComboTierNotice();
    hintEl.textContent = `Answer: ${answerDisplay()}`;
    updateTopStats(); if (DEBUG_PANEL) renderDebugPanel(); renderHeatmap(); saveAll();
    const prompt = document.getElementById('hiragana') || document.getElementById('prompt');
    flashResult(prompt, false, () => isTestModeSession() ? advanceTestModeAfterAnswer() : nextCharacter());
  }
  function canAnswer(){
    if (!sessionStarted || paused || locked) return false;
    if (window.ModeAtlasPracticeModes.timed(settings) && trialEndTime && Date.now() >= trialEndTime) { endSession(true); return false; }
    return true;
  }
  function skipCurrentKana(){
    try { if (!canAnswer() || isElementVisible(gameOverEl)) return; markSkipped(); }
    catch (e) { console.warn('Skip failed', e); }
  }
  function resetPauseUi(){
    accountForPause();
    cancelFeedback();
    paused = false;
    pauseRemaining = null;
    document.body.classList.remove('ma-session-paused');
    setPauseButtonState(false);
  }

  document.addEventListener('focusin', (event) => {
    if (event.target?.id === 'input') schedulePhoneTrainerFrame();
  });
  window.visualViewport?.addEventListener('resize', () => {
    syncPhoneKeyboardState();
    if (document.activeElement?.id === 'input') schedulePhoneTrainerFrame();
  }, { passive: true });
  window.addEventListener('orientationchange', () => {
    syncPhoneKeyboardState();
    schedulePhoneTrainerFrame();
  }, { passive: true });
  document.addEventListener('focusout', (event) => {
    if (event.target?.id !== 'input') return;
    window.setTimeout(syncPhoneKeyboardState, 80);
  });

  window.ModeAtlasSessionControls = Object.freeze({pause, resume, canAnswer, reset:resetPauseUi, flashResult, get paused(){return paused;}});
  // Native lifecycle is forwarded once by the platform adapter. The visibility
  // event also catches WebView suspension before an asynchronous bridge callback.
  if (window.ModeAtlasEnv?.isNativeApp) {
    window.addEventListener('modeAtlasAppStateChanged', event => { if (!event.detail.isActive) pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('pagehide', pause);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureButtons); else ensureButtons();
  document.addEventListener('ma:ui-refresh', ensureButtons);
  document.addEventListener('ma:trainer-ready', ensureButtons);
})();
