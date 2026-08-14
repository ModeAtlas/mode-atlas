(function ModeAtlasSessionControls(){
  if (window.__modeAtlasSessionControlsInstalled) return;
  window.__modeAtlasSessionControlsInstalled = true;

  let paused = false, pauseRemaining = 0;

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
      if (!settings.timeTrial || pauseRemaining <= 0) return;
      trialEndTime = Date.now() + pauseRemaining;
      const tick = () => {
        const remaining = Math.max(0, trialEndTime - Date.now());
        trialTimerEl.textContent = formatCountdown(remaining);
        if (remaining <= 0) { stopTrialTimer(); endSession(true); }
      };
      tick(); trialTimerId = setInterval(tick, 100); pauseRemaining = 0;
    } catch {}
  }
  function setInputDisabled(disabled){
    try { inputEl.disabled = disabled; } catch {}
    try { choiceButtons().forEach(button => { button.disabled = disabled; }); } catch {}
  }
  function focusInputIfNeeded(){
    try {
      const hasKeyboardMode = typeof settings !== 'undefined' && Object.prototype.hasOwnProperty.call(settings, 'keyboardMode');
      if (!hasKeyboardMode || settings.keyboardMode) inputEl.focus();
    } catch {}
  }
  function togglePause(){
    try {
      if (!sessionStarted) return;
      paused = !paused;
      document.body.classList.toggle('ma-session-paused', paused);
      const btn = document.getElementById('pauseSessionBtn');
      if (btn) btn.textContent = paused ? 'Resume' : 'Pause';
      if (paused) { pauseTimers(); locked = true; setInputDisabled(true); }
      else { locked = false; setInputDisabled(false); resumeTimers(); focusInputIfNeeded(); }
    } catch (e) { console.warn('Pause toggle failed', e); }
  }

  function markSkipped(){
    const timeTaken = Math.max(0, Date.now() - charStartTime);
    for (const ch of currentChar.split('')) {
      if (!stats[ch]) stats[ch] = { correct: 0, wrong: 0 };
      stats[ch].wrong += 1;
      updateAverageTime(ch, timeTaken / Math.max(1, currentChar.length));
      updateSrsWrong(ch);
    }
    sessionStats.answered += 1; sessionStats.wrong += 1; sessionStats.timings.push(timeTaken);
    sessionStats.bestStreak = Math.max(sessionStats.bestStreak, streak);
    updateSessionChar(currentChar, false, timeTaken);
    if (isDailyChallengeSession()) { dailyWrong += 1; dailyIndex += 1; }
    else if (isTestModeSession()) { testWrong += 1; testIndex += 1; }
    else if (currentFlowModeIsContinuous()) { endlessRunTotal += 1; endlessRunWrong += 1; }
    try { if (typeof pendingImmediateRepeatChar !== 'undefined') pendingImmediateRepeatChar = null; } catch {}
    streak = 0; lastComboLength = getComboLength(); hideComboTierNotice();
    hintEl.textContent = `Answer: ${answerDisplay()}`;
    updateTopStats(); if (DEBUG_PANEL) renderDebugPanel(); renderHeatmap(); saveAll();
    if (isTestModeSession()) flashResult(false, () => advanceTestModeAfterAnswer());
    else flashResult(false, () => nextCharacter());
  }
  function skipCurrentKana(){
    try { if (!sessionStarted || paused || locked || isElementVisible(gameOverEl)) return; markSkipped(); }
    catch (e) { console.warn('Skip failed', e); }
  }
  function resetPauseUi(){
    paused = false;
    pauseRemaining = 0;
    document.body.classList.remove('ma-session-paused');
    const btn = document.getElementById('pauseSessionBtn');
    if (btn) btn.textContent = 'Pause';
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('#startBtn') || event.target.closest('#retryBtn') || event.target.closest('#endSessionBtn')) {
      resetPauseUi();
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureButtons); else ensureButtons();
  document.addEventListener('ma:ui-refresh', ensureButtons);
  document.addEventListener('ma:trainer-ready', ensureButtons);
})();
