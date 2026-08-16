from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def write(rel, text):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def replace_once(src, old, new, label):
    count = src.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 occurrence, found {count}')
    return src.replace(old, new, 1)


def function_span(src, name):
    m = re.search(rf'(?m)^function\s+{re.escape(name)}\s*\(', src)
    if not m:
        raise RuntimeError(f'function {name} not found')
    brace = src.find('{', m.end())
    if brace < 0:
        raise RuntimeError(f'function {name} opening brace not found')
    i = brace
    depth = 0
    state = 'code'
    quote = ''
    escape = False
    while i < len(src):
        c = src[i]
        n = src[i + 1] if i + 1 < len(src) else ''
        if state == 'code':
            if c in "'\"`":
                state = 'string'; quote = c; escape = False
            elif c == '/' and n == '/':
                state = 'line'; i += 1
            elif c == '/' and n == '*':
                state = 'block'; i += 1
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    return m.start(), i + 1
        elif state == 'string':
            if escape:
                escape = False
            elif c == '\\':
                escape = True
            elif c == quote:
                state = 'code'
        elif state == 'line':
            if c == '\n': state = 'code'
        elif state == 'block':
            if c == '*' and n == '/': state = 'code'; i += 1
        i += 1
    raise RuntimeError(f'function {name} closing brace not found')


def get_function(src, name):
    a, b = function_span(src, name)
    return src[a:b]


def replace_function(src, name, replacement):
    a, b = function_span(src, name)
    return src[:a] + replacement.rstrip() + src[b:]


def remove_function(src, name):
    a, b = function_span(src, name)
    while b < len(src) and src[b] in ' \t': b += 1
    if b < len(src) and src[b] == '\n': b += 1
    if b < len(src) and src[b] == '\n': b += 1
    return src[:a] + src[b:]


# Release metadata. build_revision_assets.py owns package/README synchronization.
version = read('assets/app/mode-atlas-version.js')
version = replace_once(version, "var VERSION = '2.38.0';", "var VERSION = '2.39.0';", 'VERSION')
version = replace_once(version, "var CACHE_REVISION = 'assets-2.38.0';", "var CACHE_REVISION = 'assets-2.39.0';", 'CACHE_REVISION')
write('assets/app/mode-atlas-version.js', version)

controller_js = r'''/* Shared Reading/Writing page-controller lifecycle and persistence ownership. */
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

    function normalizeSettingsShape(settings){
      const rows = rowMaps();
      if (!Array.isArray(settings.hiraganaRows)) settings.hiraganaRows = Object.keys(rows.hiraganaRows || {});
      if (!Array.isArray(settings.katakanaRows)) settings.katakanaRows = [];
      if (!['same_row', 'random'].includes(settings.comboMode)) settings.comboMode = 'random';
      return settings;
    }

    function saveAll(){
      const state = snapshot();
      return root.ModeAtlasTrainerCore.saveTrainerState({
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
      if (dailyActive) {
        titleEl.textContent = labels.dailyTitle;
        sublineEl.textContent = labels.dailySubline;
      } else if (testActive) {
        titleEl.textContent = labels.testTitle;
        sublineEl.textContent = labels.testSubline;
      } else {
        titleEl.textContent = labels.practiceTitle;
        sublineEl.textContent = labels.practiceSubline;
      }
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

      if (testActive) root.updateSessionProgressBar?.(Math.min(Number(state.testIndex || 0) + 1, testTotal || 0), testTotal || 0, 'Test progress', true);
      else if (dailyActive) root.updateSessionProgressBar?.(Math.min(Number(state.dailyIndex || 0) + 1, 20), 20, 'Daily challenge', true);
      else root.updateSessionProgressBar?.(0, 0, 'Session progress', false);
    }

    function applyBasePanelStates(){
      const settings = snapshot().settings || {};
      if (settings.activeBottomTab === 'options') settings.activeBottomTab = null;
      const modifiersContentEl = byId('modifiersContent');
      const optionsContentEl = byId('optionsContent');
      const modifiersTabEl = byId('modifiersTab');
      const optionsTabEl = byId('optionsTab');
      const statsContentEl = byId('statsContent');
      const statsChevronEl = byId('statsChevron');
      const scoresContentEl = byId('scoresContent');
      const scoresChevronEl = byId('scoresChevron');

      modifiersContentEl?.classList.toggle('open', settings.activeBottomTab === 'modifiers');
      optionsContentEl?.classList.toggle('open', false);
      modifiersTabEl?.classList.toggle('active', settings.activeBottomTab === 'modifiers');
      optionsTabEl?.classList.toggle('active', false);
      if (modifiersTabEl) modifiersTabEl.textContent = settings.activeBottomTab === 'modifiers' ? 'Practice setup ▲' : 'Practice setup ▼';
      if (optionsTabEl) optionsTabEl.textContent = 'Options ▼';
      statsContentEl?.classList.toggle('hidden', !settings.statsVisible);
      if (statsChevronEl) statsChevronEl.textContent = settings.statsVisible ? '▼' : '▲';
      scoresContentEl?.classList.toggle('hidden', !settings.scoresVisible);
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

    function updateBestScores(){
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

      if (settings.speedRun) {
        const correct = Math.max(0, Number(state.endlessRunTotal || 0) - Number(state.endlessRunWrong || 0));
        const answered = Math.max(0, Number(state.endlessRunTotal || 0));
        const wrong = Math.max(0, Number(state.endlessRunWrong || 0));
        const durationMs = Math.max(1, (sessionStats.endTime || Date.now()) - (sessionStats.startTime || Date.now()));
        const timings = Array.isArray(sessionStats.timings) ? sessionStats.timings : [];
        const avgMs = timings.length ? Math.round(root.average(timings)) : 0;
        const accuracy = answered ? correct / answered : 0;
        const score = Math.max(0, Math.round((correct * 100) + (accuracy * 250) - (wrong * 50) - (avgMs / 20)));
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

      if (settings.timeTrial) {
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

    function updateSrsCorrect(char){
      const state = snapshot();
      const store = state.srs || {};
      const entry = store[char] || { level: 0, due: 0, lastSeen: 0, lastWrong: 0 };
      entry.level = Math.min(entry.level + 1, 8);
      const intervals = [3000, 8000, 15000, 30000, 60000, 120000, 300000, 600000, 1200000];
      const delay = intervals[entry.level] ?? 1200000;
      entry.due = Date.now() + delay;
      entry.lastSeen = Date.now();
      if (config.clearLastWrongOnCorrect) entry.lastWrong = 0;
      store[char] = entry;
      return entry;
    }

    function showSessionModal(autoEnded = false){
      const state = snapshot();
      return root.showTrainerSessionModal({
        autoEnded,
        sessionStats: state.sessionStats,
        settings: state.settings,
        endlessRunTotal: state.endlessRunTotal,
        endlessRunWrong: state.endlessRunWrong,
        trialTarget: state.trialTarget
      });
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
      saveAll,
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
      updateSrsCorrect,
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
'''
write('assets/trainer/mode-atlas-trainer-controller.js', controller_js)

# Load the controller once for both trainer pages, after shared/core primitives and before mode adapters.
frontend = read('frontend_components.py')
needle = "                'assets/trainer/mode-atlas-trainer-shared.js',\n                'assets/results/mode-atlas-results-storage.js',"
replacement = "                'assets/trainer/mode-atlas-trainer-shared.js',\n                'assets/trainer/mode-atlas-trainer-controller.js',\n                'assets/results/mode-atlas-results-storage.js',"
count = frontend.count(needle)
if count != 2:
    raise RuntimeError(f'trainer manifest insertion expected twice, found {count}')
frontend = frontend.replace(needle, replacement)
write('frontend_components.py', frontend)


def adapter_block(mode):
    writing = mode == 'writing'
    daily_pool = '() => DAILY_CHALLENGE_CHAR_MAP' if writing else '() => getDailyChallengePoolMap()'
    seed = 'reverse-daily' if writing else 'daily'
    labels = (
        "dailyTitle: 'Writing Daily Challenge',\n        dailySubline: '20 questions · Match the romaji prompt to kana',\n        testTitle: 'Writing Test Mode',\n        testSubline: 'One full shuffled pass through all enabled test kana',\n        practiceTitle: 'Writing Practice',\n        practiceSubline: 'Match the romaji prompt to the correct kana'"
        if writing else
        "dailyTitle: 'Reading Daily Challenge',\n        dailySubline: '20 questions · All hiragana, katakana, and dakuten',\n        testTitle: 'Reading Test Mode',\n        testSubline: 'One full shuffled pass through all enabled test kana',\n        practiceTitle: 'Reading Practice',\n        practiceSubline: 'Enter the matching romaji'"
    )
    return f'''\nconst trainerController = window.ModeAtlasTrainerController.create({{
    mode: "{mode}",
    defaults: DEFAULT_SETTINGS,
    dailySeedPrefix: "{seed}",
    getDailyPoolMap: {daily_pool},
    showOfficialWhenRecorded: {'true' if writing else 'false'},
    clearLastWrongOnCorrect: {'true' if writing else 'false'},
    labels: {{
        {labels}
    }},
    getSnapshot: () => ({{
        settings, stats, times, srs, scoreHistory, dailyChallengeHistory, highScore,
        sessionStarted, sessionStats, streak, endlessRunTotal, endlessRunWrong,
        dailyIndex, dailyCorrect, dailyWrong, testIndex, testCorrect, testWrong,
        testSequence, trialTarget, activeChars, locked
    }}),
    applySaveBackedState: (next) => {{
        settings = next.settings;
        stats = next.stats;
        times = next.times;
        srs = next.srs;
        scoreHistory = next.scoreHistory;
        dailyChallengeHistory = next.dailyChallengeHistory;
        highScore = next.highScore;
    }},
    setScoreHistory: (next) => {{ scoreHistory = next; }},
    getDebugPanel: () => DEBUG_PANEL,
    getRows: () => ({{ hiraganaRows, katakanaRows }}),
    hooks: {{
        rebuildCharMap,
        ensureDataObjects,
        buildModifierButtons,
        buildOptionButtons,
        buildRows,
        applyPanelStates,
        updateTrialConfigVisibility,
        renderHeatmap,
        updateTopStats,
        renderDebugPanel,
        renderScoreHistory,
        showIdleState
    }}
}});
const {{ debugEl, debugLine, debugValueLine, debugRow, debugCard }} = window.ModeAtlasTrainerController.debug;
'''


def transform_page(rel, mode):
    src = read(rel)
    writing = mode == 'writing'
    insertion_marker = (
        'const choice8Btn = document.getElementById("choice8Btn");\n'
        if writing else
        'const speedRunTop3El = document.getElementById("speedRunTop3");\n'
    )
    src = replace_once(src, insertion_marker, insertion_marker + adapter_block(mode), f'{mode} controller adapter insertion')

    wrappers = {
        'saveAll': 'function saveAll() { return trainerController.saveAll(); }',
        'buildDailySequence': 'function buildDailySequence(dateKey = getTodayKey()) { return trainerController.buildDailySequence(dateKey); }',
        'applyDailyChallengeTheme': 'function applyDailyChallengeTheme() { return trainerController.applyDailyChallengeTheme(); }',
        'updateDailyChallengePills': 'function updateDailyChallengePills() { return trainerController.updateDailyChallengePills(); }',
        'updateSrsCorrect': 'function updateSrsCorrect(char) { return trainerController.updateSrsCorrect(char); }',
        'normalizeStoredTestModeResults': 'function normalizeStoredTestModeResults(list) { return trainerController.normalizeStoredTestModeResults(list); }',
        'persistStoredTestModeResults': 'function persistStoredTestModeResults(list) { return trainerController.persistStoredTestModeResults(list); }',
        'updateBestScores': 'function updateBestScores() { return trainerController.updateBestScores(); }',
        'showSessionModal': 'function showSessionModal(autoEnded = false) { return trainerController.showSessionModal(autoEnded); }',
        'refreshSaveBackedStateFromCloud': 'function refreshSaveBackedStateFromCloud() { return trainerController.refreshSaveBackedStateFromCloud(); }',
    }
    for name, replacement in wrappers.items():
        src = replace_function(src, name, replacement)

    # Base panel behavior is shared; Writing retains only its input-mode adapter.
    original_panel = get_function(src, 'applyPanelStates')
    if writing:
        marker = '    const testModeForcesSixChoices = isTestModeSession();'
        pos = original_panel.find(marker)
        if pos < 0: raise RuntimeError('Writing applyPanelStates adapter tail not found')
        tail = original_panel[pos:original_panel.rfind('}')].rstrip()
        panel = 'function applyPanelStates() {\n    trainerController.applyBasePanelStates();\n\n' + tail + '\n}'
    else:
        panel = 'function applyPanelStates() { return trainerController.applyBasePanelStates(); }'
    src = replace_function(src, 'applyPanelStates', panel)

    # Shared refresh pipeline; only mode-specific active-question behavior remains local.
    original_settings = get_function(src, 'onSettingsChanged')
    if writing:
        tail_marker = '    if (!sessionStarted) {'
        pos = original_settings.find(tail_marker)
        if pos < 0: raise RuntimeError('Writing onSettingsChanged adapter tail not found')
        tail = original_settings[pos:original_settings.rfind('}')].rstrip()
        settings_fn = 'function onSettingsChanged() {\n    trainerController.refreshCommonUi({ save: true, beforeRender: maybeShowChoiceAvailabilityNotice });\n\n' + tail + '\n}'
    else:
        settings_fn = '''function onSettingsChanged() {
    trainerController.refreshCommonUi({ save: true });
    if (sessionStarted && !locked) nextCharacter();
}'''
    src = replace_function(src, 'onSettingsChanged', settings_fn)

    # Exact debug primitive copies now live in the shared controller module.
    for name in ('debugEl', 'debugLine', 'debugValueLine', 'debugRow', 'debugCard'):
        src = remove_function(src, name)

    # Combo-best recording is the same score-history operation in both modes.
    if writing:
        combo_block = '''    if (settings.comboKana) {
        const comboKey = settings.comboMode === "same_row" ? "same_row" : "random";
        scoreHistory.comboKanaBest[comboKey] = Math.max(scoreHistory.comboKanaBest[comboKey] || 0, streak);
    }
'''
        src = replace_once(src, combo_block, '    trainerController.recordComboBest();\n', 'Writing handleCorrect combo score')
    else:
        src = remove_function(src, 'updateComboKanaBestScore')
        src = replace_once(src, '    updateComboKanaBestScore();\n', '    trainerController.recordComboBest();\n', 'Reading handleCorrect combo score')

    # Init is shared; Writing keeps its mode-specific idle instruction copy.
    if writing:
        init_fn = '''function init() {
    trainerController.init();
    if (!activeChars.length) {
        hintEl.textContent = "Select at least one row to begin.";
    } else {
        hintEl.textContent = "Press Start to begin Writing Practice.";
    }
}'''
    else:
        init_fn = 'function init() { return trainerController.init(); }'
    src = replace_function(src, 'init', init_fn)

    # Refresh queue/listener ownership belongs to the shared controller.
    src = remove_function(src, 'requestTrainerRefresh')
    event_start = src.find('// Trainers render local save data immediately. Cloud-sync owns Firebase/auth/')
    if event_start < 0: raise RuntimeError(f'{mode} refresh event block start not found')
    event_end_marker = 'document.addEventListener("ma:ui-refresh", () => requestTrainerRefresh("ui-refresh"));'
    event_end = src.find(event_end_marker, event_start)
    if event_end < 0: raise RuntimeError(f'{mode} refresh event block end not found')
    event_end += len(event_end_marker)
    event_replacement = '''// Trainers render local save data immediately. The shared controller owns
// refresh coalescing plus cloud/bfcache/UI refresh event bindings.
trainerController.bindRefreshEvents();'''
    src = src[:event_start] + event_replacement + src[event_end:]

    # Legacy queue variable is now internal to ModeAtlasTrainerController.
    src = src.replace('let trainerRefreshQueued = false;\n\n', '')

    write(rel, src)


transform_page('assets/pages/mode-atlas-default-page.js', 'reading')
transform_page('assets/pages/mode-atlas-reverse-page.js', 'writing')

# Release notes.
changelog = read('CHANGELOG.md')
entry = '''## 2.39.0 - 2026-08-16
- Added one shared Reading/Writing trainer controller for common page lifecycle and persistence behavior while retaining thin mode-specific answer adapters.
- Consolidated trainer save/load refresh, cloud/bfcache/UI refresh coalescing, Daily/Test header and HUD state, shared panel state, score-history formulas, test-result persistence adapters, SRS-correct scheduling, session-summary plumbing, and debug element primitives.
- Removed duplicate controller-owned score formulas and refresh listeners from the Reading/Writing page files; both modes now consume the same implementation with explicit mode configuration.
- Kept Writing-only choice generation, repeat limiting, keyboard modes, accepted-answer handling, and prompt rendering local; Reading romaji input and its answer progression remain local as well.
- Preserved all existing trainer IDs, scoring/SRS weights, Daily/Test sequences and seeds, result schemas, save keys, cloud behavior, Practice Setup, and the 2.38 active-session UI.

'''
if not changelog.startswith('## 2.38.0'):
    raise RuntimeError('unexpected CHANGELOG head')
write('CHANGELOG.md', entry + changelog)

# New ownership/parity regression.
tests = read('tests/frontend.test.js')
new_test = r'''

test('2.39 Reading and Writing share controller lifecycle while answer adapters stay mode-specific', () => {
  const frontend = read('frontend_components.py');
  const controller = read('assets/trainer/mode-atlas-trainer-controller.js');
  const reading = read('assets/pages/mode-atlas-default-page.js');
  const writing = read('assets/pages/mode-atlas-reverse-page.js');
  const readingHtml = read('reading/index.html');
  const writingHtml = read('writing/index.html');

  assert.equal(count(frontend, /'assets\/trainer\/mode-atlas-trainer-controller\.js'/g), 2,
    'shared trainer controller must be in both trainer manifests');
  for (const html of [readingHtml, writingHtml]) {
    const sharedIndex = html.indexOf('mode-atlas-trainer-controller.assets-2.39.0.js');
    const pageIndex = Math.max(html.indexOf('mode-atlas-default-page.assets-2.39.0.js'), html.indexOf('mode-atlas-reverse-page.assets-2.39.0.js'));
    assert.ok(sharedIndex >= 0 && pageIndex > sharedIndex, 'controller must load before the mode adapter');
  }

  for (const source of [reading, writing]) {
    assert.match(source, /ModeAtlasTrainerController\.create\(/);
    assert.doesNotMatch(source, /function debugEl\(|function debugLine\(|function debugValueLine\(|function debugRow\(|function debugCard\(/,
      'debug element primitives must not remain duplicated in page adapters');
    assert.doesNotMatch(source, /modeAtlasCloudDataChanged|trainerRefreshQueued/,
      'page adapters must not own refresh scheduling/listeners');
    assert.doesNotMatch(source, /accuracy \* 250|speedRunTop3\.sort|timeTrialTop3\.sort/,
      'score ranking formulas must be controller-owned');
  }

  for (const marker of [
    'modeAtlasCloudDataChanged', 'refreshCommonUi', 'updateBestScores', 'updateSrsCorrect',
    'normalizeStoredTestModeResults', 'persistStoredTestModeResults', 'debugEl'
  ]) assert.match(controller, new RegExp(marker), `shared controller missing ${marker}`);

  assert.match(reading, /dailySeedPrefix: "daily"/);
  assert.match(writing, /dailySeedPrefix: "reverse-daily"/);
  assert.match(reading, /showOfficialWhenRecorded: false/);
  assert.match(writing, /showOfficialWhenRecorded: true/);
  assert.match(reading, /clearLastWrongOnCorrect: false/);
  assert.match(writing, /clearLastWrongOnCorrect: true/);

  assert.match(reading, /validRomajiSet/);
  assert.match(reading, /expected\.startsWith\(compactValue\)/);
  for (const writingOnly of ['buildChoiceOptionStrings', 'getRepeatSafePool', 'isRomajiKeyboardMode', 'getAcceptedAnswersForCurrentChar']) {
    assert.match(writing, new RegExp(writingOnly), `Writing adapter must retain ${writingOnly}`);
    assert.doesNotMatch(reading, new RegExp(writingOnly), `Reading adapter must not absorb ${writingOnly}`);
  }
});
'''
if '2.39 Reading and Writing share controller lifecycle' in tests:
    raise RuntimeError('2.39 test already exists')
write('tests/frontend.test.js', tests.rstrip() + new_test + '\n')
