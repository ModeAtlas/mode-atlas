/* Shared Reading/Writing page-controller lifecycle and persistence ownership. */
(function ModeAtlasTrainerControllerModule(root){
  if (root.ModeAtlasTrainerController) return;

  function byId(id){ return document.getElementById(id); }
  function call(fn, ...args){ return typeof fn === 'function' ? fn(...args) : undefined; }

  function debugEl(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = String(text);
    return node;
  }

  function debugLine(label, value) {
    const row = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = `${label}:`;
    row.append(strong, document.createTextNode(' '));
    if (typeof Node !== 'undefined' && value instanceof Node) row.append(value);
    else row.append(debugEl('span', 'srs-debug-muted', value));
    return row;
  }

  function debugValueLine(label, value) {
    const row = document.createElement('div');
    row.append(document.createTextNode(`${label}: `), debugEl('strong', '', value));
    return row;
  }

  function debugRow(label, value, className = '') {
    const row = debugEl('div', className ? `srs-debug-row ${className}` : 'srs-debug-row');
    row.append(debugEl('span', '', label), debugEl('strong', '', value));
    return row;
  }

  function debugCard(title, children = []) {
    const card = debugEl('div', 'srs-debug-card');
    card.append(debugEl('div', 'srs-debug-card-title', title), ...children);
    return card;
  }

  function create(config = {}) {
    const mode = String(config.mode || '').toLowerCase();
    if (!['reading', 'writing'].includes(mode)) throw new Error('ModeAtlasTrainerController requires reading or writing mode');
    if (typeof config.getSnapshot !== 'function') throw new Error('ModeAtlasTrainerController requires getSnapshot');
    if (typeof config.applySaveBackedState !== 'function') throw new Error('ModeAtlasTrainerController requires applySaveBackedState');
    if (typeof config.setScoreHistory !== 'function') throw new Error('ModeAtlasTrainerController requires setScoreHistory');

    const labels = Object.assign({
      dailyTitle: `${mode === 'writing' ? 'Writing' : 'Reading'} Daily Challenge`,
      dailySubline: '',
      testTitle: `${mode === 'writing' ? 'Writing' : 'Reading'} Test Mode`,
      testSubline: 'One full shuffled pass through all enabled test kana',
      practiceTitle: `${mode === 'writing' ? 'Writing' : 'Reading'} Practice`,
      practiceSubline: ''
    }, config.labels || {});
    const hooks = config.hooks || {};
    const defaults = config.defaults || {};
    const dailySeedPrefix = config.dailySeedPrefix || (mode === 'writing' ? 'reverse-daily' : 'daily');
    let refreshQueued = false;
    let refreshEventsBound = false;

    const snapshot = () => config.getSnapshot() || {};
    const debugPanel = () => typeof config.getDebugPanel === 'function' ? config.getDebugPanel() : null;
    const rowMaps = () => typeof config.getRows === 'function' ? (config.getRows() || {}) : {};
    const study = root.ModeAtlasStudySession.create({
      mode, getSnapshot: snapshot,
      finish: () => hooks.endSession(true), start: () => hooks.startSession(),
      naturalBreak: () => root.settleTrainerProgressionBreak('trainer-session-summary')
    });

    function normalizeSettingsShape(settings){
      const rows = rowMaps();
      if (!Array.isArray(settings.hiraganaRows)) settings.hiraganaRows = Object.keys(rows.hiraganaRows || {});
      if (!Array.isArray(settings.katakanaRows)) settings.katakanaRows = [];
      if (!['same_row', 'random'].includes(settings.comboMode)) settings.comboMode = 'random';
      return root.ModeAtlasPracticeModes.normalize(settings);
    }

    function saveAll(){
      const state = snapshot();
      const result = root.ModeAtlasTrainerCore.saveTrainerState({
        mode,
        section: mode,
        settings: state.settings,
        stats: state.stats,
        times: state.times,
        srs: state.srs,
        scoreHistory: state.scoreHistory,
        dailyChallengeHistory: state.dailyChallengeHistory,
        highScore: state.highScore
      });
      root.ModeAtlasSessionRecovery.capture(state,mode);
      return result;
    }

    function buildDailySequence(dateKey = root.getTodayKey?.()){
      return root.ModeAtlasTrainerCore.buildDailySequence({
        poolMap: config.getDailyPoolMap?.() || {},
        count: 20,
        seed: `${dailySeedPrefix}:${dateKey}`,
        rngFactory: root.createSeededRng
      });
    }

    function applyDailyChallengeTheme(){
      const dailyActive = !!root.isDailyChallengeSession?.();
      const testActive = !!root.isTestModeSession?.();
      const titleEl = document.querySelector('.ma-trainer-card h1');
      const sublineEl = document.querySelector('.ma-trainer-card .subline');
      const dailyBadgeEl = byId('dailyBadge');
      const testBadgeEl = byId('testBadge');

      document.body.classList.toggle('daily-challenge-active', dailyActive);
      document.body.classList.toggle('test-mode-active', testActive);
      if (dailyBadgeEl) root.setElementVisible?.(dailyBadgeEl, dailyActive);
      if (testBadgeEl) root.setElementVisible?.(testBadgeEl, testActive);

      if (!titleEl || !sublineEl) return;
      const state = snapshot(), descriptor = root.ModeAtlasPracticeModes.describe(state.settings);
      titleEl.textContent = `${mode === 'writing' ? 'Writing' : 'Reading'} · ${descriptor.label}`;
      sublineEl.textContent = dailyActive ? labels.dailySubline : testActive ? labels.testSubline : descriptor.detail;
      const start = byId('startBtn')?.querySelector('span');
      if (start) start.textContent = descriptor.action;
    }

    function updateDailyChallengePills(){
      const state = snapshot();
      const dailyActive = !!root.isDailyChallengeSession?.() && !!state.sessionStarted;
      const dailyProgressPill = byId('dailyProgressPill');
      const dailyCorrectPill = byId('dailyCorrectPill');
      const dailyWrongPill = byId('dailyWrongPill');
      const dailyOfficialPill = byId('dailyOfficialPill');
      const dailyProgressEl = byId('dailyProgress');
      const dailyCorrectEl = byId('dailyCorrect');
      const dailyWrongEl = byId('dailyWrong');
      const dailyOfficialEl = byId('dailyOfficial');

      root.setElementVisible?.(dailyProgressPill, dailyActive);
      root.setElementVisible?.(dailyCorrectPill, dailyActive);
      root.setElementVisible?.(dailyWrongPill, dailyActive);
      if (dailyActive) {
        if (dailyProgressEl) dailyProgressEl.textContent = Math.min(Number(state.dailyIndex || 0) + 1, 20);
        if (dailyCorrectEl) dailyCorrectEl.textContent = state.dailyCorrect || 0;
        if (dailyWrongEl) dailyWrongEl.textContent = state.dailyWrong || 0;
      }

      const todayRecord = root.getTodayDailyRecord?.() || null;
      const officialVisible = dailyActive || (!!config.showOfficialWhenRecorded && !!todayRecord);
      root.setElementVisible?.(dailyOfficialPill, officialVisible);
      if (dailyOfficialEl) dailyOfficialEl.textContent = todayRecord ? `${todayRecord.officialScore}/${todayRecord.total}` : '—';

      const testActive = !!root.isTestModeSession?.() && !!state.sessionStarted;
      const testQuestionPill = byId('testQuestionPill');
      const testCorrectPill = byId('testCorrectPill');
      const testWrongPill = byId('testWrongPill');
      const testQuestionEl = byId('testQuestion');
      const testTotalEl = byId('testTotal');
      const testCorrectEl = byId('testCorrect');
      const testWrongEl = byId('testWrong');
      const testTotal = Array.isArray(state.testSequence) ? state.testSequence.length : 0;

      root.setElementVisible?.(testQuestionPill, testActive);
      root.setElementVisible?.(testCorrectPill, testActive);
      root.setElementVisible?.(testWrongPill, testActive);
      if (testActive) {
        if (testQuestionEl) testQuestionEl.textContent = Math.min(Number(state.testIndex || 0) + 1, testTotal || 0);
        if (testTotalEl) testTotalEl.textContent = testTotal || 0;
        if (testCorrectEl) testCorrectEl.textContent = state.testCorrect || 0;
        if (testWrongEl) testWrongEl.textContent = state.testWrong || 0;
      }

      study.sync();
    }

    function applyBasePanelStates(){
      const settings = snapshot().settings || {};
      if (settings.activeBottomTab === 'options') settings.activeBottomTab = null;
      const statsContentEl = byId('statsContent');
      const statsChevronEl = byId('statsChevron');
      const scoresContentEl = byId('scoresContent');
      const scoresChevronEl = byId('scoresChevron');

      const modifiersOpen = settings.activeBottomTab === 'modifiers';
      root.ModeAtlasPracticeSetup.setOpen(modifiersOpen);
      statsContentEl?.classList.toggle('hidden', !settings.statsVisible);
      byId('statsHeader')?.setAttribute('aria-expanded', String(!!settings.statsVisible));
      if (statsChevronEl) statsChevronEl.textContent = settings.statsVisible ? '▼' : '▲';
      scoresContentEl?.classList.toggle('hidden', !settings.scoresVisible);
      byId('scoresHeader')?.setAttribute('aria-expanded', String(!!settings.scoresVisible));
      if (scoresChevronEl) scoresChevronEl.textContent = settings.scoresVisible ? '▼' : '▲';
      document.body.classList.toggle('mobile-mode', !!settings.mobileMode);
    }

    function runControlBuild(){
      call(hooks.rebuildCharMap);
      call(hooks.ensureDataObjects);
      call(hooks.buildModifierButtons);
      call(hooks.buildOptionButtons);
      const rows = rowMaps();
      call(hooks.buildRows, 'rowOptions', rows.hiraganaRows || {}, 'hiraganaRows', 'h_');
      call(hooks.buildRows, 'katakanaRowOptions', rows.katakanaRows || {}, 'katakanaRows', 'k_');
      call(hooks.applyPanelStates);
      call(hooks.updateTrialConfigVisibility);
    }

    function refreshCommonUi(options = {}){
      runControlBuild();
      call(options.beforeRender);
      call(hooks.renderHeatmap);
      call(hooks.updateTopStats);
      if (debugPanel()) call(hooks.renderDebugPanel);
      call(hooks.renderScoreHistory);
      if (options.save) saveAll();
    }

    function refreshSaveBackedStateFromCloud(){
      const current = snapshot();
      if (current.sessionStarted) return; // Never replace a running session’s settings or counters.
      const preservedBottomTab = ((current.settings && current.settings.activeBottomTab === 'modifiers') || byId('modifiersContent')?.classList.contains('open')) ? 'modifiers' : null;
      const settings = { ...defaults, ...root.ModeAtlasStorage.readModeJSON(mode, 'settings', defaults) };
      settings.activeBottomTab = preservedBottomTab;
      normalizeSettingsShape(settings);
      const next = {
        settings,
        stats: root.ModeAtlasStorage.readModeJSON(mode, 'charStats', {}),
        times: root.ModeAtlasStorage.readModeJSON(mode, 'charTimes', {}),
        srs: root.ModeAtlasStorage.readModeJSON(mode, 'srs', {}),
        scoreHistory: root.normalizeScoreHistory(root.ModeAtlasStorage.readModeJSON(mode, 'scoreHistory', root.createDefaultScoreHistory())),
        dailyChallengeHistory: root.ModeAtlasStorage.readModeJSON(mode, 'dailyHistory', {}),
        highScore: root.ModeAtlasStorage.readModeNumber(mode, 'highScore', 0)
      };
      config.applySaveBackedState(next);

      runControlBuild();
      call(hooks.updateTopStats);
      call(hooks.renderHeatmap);
      call(hooks.renderScoreHistory);
      if (!snapshot().sessionStarted) call(hooks.showIdleState);
      if (debugPanel()) call(hooks.renderDebugPanel);
      root.ModeAtlasSessionRecovery.render(mode,hooks.startSession);
      root.ModeAtlasLifecycle?.emit?.('trainer-ready', { page: root.ModeAtlasPageName?.() || '' });
    }

    function init(){
      call(hooks.rebuildCharMap);
      const state = snapshot();
      normalizeSettingsShape(state.settings || {});
      config.setScoreHistory(root.normalizeScoreHistory(state.scoreHistory));
      call(hooks.ensureDataObjects);
      call(hooks.buildModifierButtons);
      call(hooks.buildOptionButtons);
      const rows = rowMaps();
      call(hooks.buildRows, 'rowOptions', rows.hiraganaRows || {}, 'hiraganaRows', 'h_');
      call(hooks.buildRows, 'katakanaRowOptions', rows.katakanaRows || {}, 'katakanaRows', 'k_');
      call(hooks.applyPanelStates);
      call(hooks.updateTrialConfigVisibility);
      call(hooks.updateTopStats);
      if (debugPanel()) call(hooks.renderDebugPanel);
      call(hooks.renderHeatmap);
      call(hooks.renderScoreHistory);
      call(hooks.showIdleState);
      root.ModeAtlasSessionRecovery.render(mode,hooks.startSession);
    }

    function normalizeStoredTestModeResults(list){
      return root.ModeAtlasTrainerCore.normalizeTestResults(mode, list);
    }

    function persistStoredTestModeResults(list){
      return root.ModeAtlasTrainerCore.persistTestResults(mode, list);
    }

    function recordComboBest(){
      const state = snapshot();
      let history = root.normalizeScoreHistory(state.scoreHistory);
      if (state.settings?.comboKana) {
        const comboKey = state.settings.comboMode === 'same_row' ? 'same_row' : 'random';
        history.comboKanaBest[comboKey] = Math.max(history.comboKanaBest[comboKey] || 0, Number(state.streak || 0));
      }
      config.setScoreHistory(history);
      return history;
    }

    function updateBestScores(completed = false){
      const state = snapshot();
      const settings = state.settings || {};
      const sessionStats = state.sessionStats || {};
      let history = root.normalizeScoreHistory(state.scoreHistory);

      if (settings.comboKana) {
        const comboKey = settings.comboMode === 'same_row' ? 'same_row' : 'random';
        history.comboKanaBest[comboKey] = Math.max(history.comboKanaBest[comboKey] || 0, Number(state.streak || 0));
      }

      if (settings.endless) {
        const correct = Math.max(0, Number(state.endlessRunTotal || 0) - Number(state.endlessRunWrong || 0));
        if (correct > (history.endlessBest.correct || 0)) {
          history.endlessBest = { total: Number(state.endlessRunTotal || 0), correct, wrong: Number(state.endlessRunWrong || 0) };
        }
      }

      if (settings.speedRun && completed && sessionStats.answered) {
        const correct = Math.max(0, Number(state.endlessRunTotal || 0) - Number(state.endlessRunWrong || 0));
        const answered = Math.max(0, Number(state.endlessRunTotal || 0));
        const wrong = Math.max(0, Number(state.endlessRunWrong || 0));
        const durationMs = Math.max(1, (sessionStats.endTime || Date.now()) - (sessionStats.startTime || Date.now()));
        const timings = Array.isArray(sessionStats.timings) ? sessionStats.timings : [];
        const avgMs = timings.length ? Math.round(root.average(timings)) : 0;
        const accuracy = answered ? correct / answered : 0;
        const score = root.ModeAtlasTrainerCore.speedScore(sessionStats);
        history.speedRunTop3.push({
          durationSeconds: Math.round(durationMs / 1000), answered, correct, wrong,
          accuracy: Math.round(accuracy * 100), avgMs, score
        });
        history.speedRunTop3.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.correct !== a.correct) return b.correct - a.correct;
          if (a.avgMs !== b.avgMs) return a.avgMs - b.avgMs;
          return a.wrong - b.wrong;
        });
        history.speedRunTop3 = history.speedRunTop3.slice(0, 3);
      }

      if (settings.timeTrial && completed && sessionStats.answered) {
        const timeVal = Number(byId('trialTime')?.value) || 0.5;
        const target = Number(state.trialTarget || 0) || Math.max(1, Number(byId('trialTarget')?.value) || 20);
        const entry = {
          time: timeVal,
          target,
          score: Number(sessionStats.correct || 0),
          ratio: Number(sessionStats.correct || 0) / Math.max(0.1, timeVal),
          overTarget: Number(sessionStats.correct || 0) - target
        };
        history.timeTrialTop3.push(entry);
        history.timeTrialTop3.sort((a, b) => {
          if (b.overTarget !== a.overTarget) return b.overTarget - a.overTarget;
          if (b.ratio !== a.ratio) return b.ratio - a.ratio;
          return b.score - a.score;
        });
        history.timeTrialTop3 = history.timeTrialTop3.slice(0, 3);
      }

      config.setScoreHistory(history);
      call(hooks.renderScoreHistory);
      saveAll();
      return history;
    }

    function showSessionModal(autoEnded = false){
      const state = snapshot();
      return study.showSummary(state.sessionStats, root.getTrainerSessionXpGain(state.sessionStats), {completed:autoEnded});
    }

    function requestRefresh(source = 'unknown'){
      if (refreshQueued) return;
      refreshQueued = true;
      const run = () => {
        refreshQueued = false;
        try { refreshSaveBackedStateFromCloud(); }
        catch (err) { console.warn('Trainer refresh failed', source, err); }
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
      else setTimeout(run, 0);
    }

    function bindRefreshEvents(){
      if (refreshEventsBound) return;
      refreshEventsBound = true;
      root.addEventListener('modeAtlasCloudDataChanged', (event) => {
        const sections = Array.isArray(event.detail?.sections) ? event.detail.sections : [];
        if (!sections.length || sections.includes(mode)) requestRefresh('cloud-data');
      });
      root.addEventListener('pageshow', (event) => {
        if (event.persisted === true) requestRefresh('bfcache-restore');
      });
      document.addEventListener('ma:ui-refresh', () => requestRefresh('ui-refresh'));
    }

    return Object.freeze({
      mode,
      study,
      saveAll,
      captureSession: () => root.ModeAtlasSessionRecovery.capture(snapshot(),mode),
      buildDailySequence,
      applyDailyChallengeTheme,
      updateDailyChallengePills,
      applyBasePanelStates,
      refreshCommonUi,
      refreshSaveBackedStateFromCloud,
      init,
      normalizeStoredTestModeResults,
      persistStoredTestModeResults,
      recordComboBest,
      updateBestScores,
      showSessionModal,
      requestRefresh,
      bindRefreshEvents
    });
  }

  root.ModeAtlasTrainerController = Object.freeze({
    create,
    debug: Object.freeze({ debugEl, debugLine, debugValueLine, debugRow, debugCard })
  });
})(typeof window !== 'undefined' ? window : globalThis);
