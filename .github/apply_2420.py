from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT / path).read_text()

def write(path, text):
    (ROOT / path).write_text(text)

def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f'missing anchor in {path}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))

def replace_all(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f'missing anchor in {path}: {old[:120]!r}')
    write(path, text.replace(old, new))

def edit_function(path, name, editor):
    text = read(path)
    marker = f'function {name}('
    start = text.find(marker)
    if start < 0:
        raise SystemExit(f'missing function {name} in {path}')
    next_fn = text.find('\nfunction ', start + len(marker))
    end = len(text) if next_fn < 0 else next_fn
    block = text[start:end]
    updated = editor(block)
    if updated == block:
        raise SystemExit(f'function {name} in {path} was not changed')
    write(path, text[:start] + updated + text[end:])

# Release metadata.
replace_once('assets/app/mode-atlas-version.js', "var VERSION = '2.41.0';", "var VERSION = '2.42.0';")
replace_once('assets/app/mode-atlas-version.js', "var CACHE_REVISION = 'assets-2.41.0';", "var CACHE_REVISION = 'assets-2.42.0';")
replace_all('package.json', '"version": "2.41.0"', '"version": "2.42.0"')
replace_all('package-lock.json', '"version": "2.41.0"', '"version": "2.42.0"')
replace_once('README.md', 'Version: 2.41.0', 'Version: 2.42.0')

# Progression remains the sole XP owner. 2.42 extends it with merge-safe signed
# developer adjustments plus before/after summaries for presentation consumers.
progress_js = r'''(function ModeAtlasProgressOwner(root){
  'use strict';
  if (root.ModeAtlasProgress) return;

  const STORAGE_KEY = 'modeAtlasProgress';
  const UPDATED_AT_KEY = 'modeAtlasProgressUpdatedAt';
  const DEVICE_KEY = 'modeAtlasProgressDeviceId';
  const STATE_VERSION = 2;
  const LEGACY_SOURCE = 'legacy-baseline';

  const COUNTER_XP = Object.freeze({
    'kana.reading.correct': 1,
    'kana.writing.correct': 1
  });
  const EVENT_XP = Object.freeze({
    'kana.reading.dailyComplete': 5,
    'kana.writing.dailyComplete': 5,
    'kana.reading.testComplete': 10,
    'kana.writing.testComplete': 10
  });

  function store(){ return root.ModeAtlasStorage; }
  function finiteCount(value){
    const number = Number(value || 0);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
  }
  function finiteInteger(value){
    const number = Number(value || 0);
    return Number.isFinite(number) ? Math.trunc(number) : 0;
  }
  function object(value){ return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }

  function normalizeSource(source){
    const out = {};
    Object.entries(object(source)).forEach(([type, value]) => {
      if (!(type in COUNTER_XP)) return;
      const count = finiteCount(value);
      if (count) out[type] = count;
    });
    return out;
  }

  function normalizeEvent(event, fallbackKey = ''){
    if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
    const type = String(event.type || '');
    if (!(type in EVENT_XP)) return null;
    const id = String(event.id || fallbackKey.split('|').slice(1).join('|') || '');
    if (!id) return null;
    return { type, id, at: finiteCount(event.at) || Date.now() };
  }

  function normalizeAdjustment(adjustment, fallbackKey = ''){
    if (!adjustment || typeof adjustment !== 'object' || Array.isArray(adjustment)) return null;
    const id = String(adjustment.id || fallbackKey || '').trim();
    const amount = finiteInteger(adjustment.amount);
    if (!id || !amount) return null;
    return { id, amount, at: finiteCount(adjustment.at) || Date.now() };
  }

  function normalizeState(input){
    const value = object(input);
    const sources = {};
    Object.entries(object(value.sources)).forEach(([sourceId, counters]) => {
      const normalized = normalizeSource(counters);
      if (Object.keys(normalized).length) sources[String(sourceId)] = normalized;
    });
    const events = {};
    Object.entries(object(value.events)).forEach(([key, event]) => {
      const normalized = normalizeEvent(event, key);
      if (normalized) events[`${normalized.type}|${normalized.id}`] = normalized;
    });
    const adjustments = {};
    Object.entries(object(value.adjustments)).forEach(([key, adjustment]) => {
      const normalized = normalizeAdjustment(adjustment, key);
      if (normalized) adjustments[normalized.id] = normalized;
    });
    return {
      version: STATE_VERSION,
      legacySeeded: value.legacySeeded === true,
      sources,
      events,
      adjustments,
      updatedAt: finiteCount(value.updatedAt)
    };
  }

  function mergeStates(left, right){
    const a = normalizeState(left);
    const b = normalizeState(right);
    const merged = {
      version: STATE_VERSION,
      legacySeeded: a.legacySeeded || b.legacySeeded,
      sources: {},
      events: {},
      adjustments: {},
      updatedAt: Math.max(a.updatedAt, b.updatedAt)
    };
    const sourceIds = new Set([...Object.keys(a.sources), ...Object.keys(b.sources)]);
    sourceIds.forEach((sourceId) => {
      const source = {};
      const types = new Set([...Object.keys(a.sources[sourceId] || {}), ...Object.keys(b.sources[sourceId] || {})]);
      types.forEach((type) => {
        const value = Math.max(finiteCount(a.sources[sourceId]?.[type]), finiteCount(b.sources[sourceId]?.[type]));
        if (value) source[type] = value;
      });
      if (Object.keys(source).length) merged.sources[sourceId] = source;
    });
    Object.assign(merged.events, a.events);
    Object.entries(b.events).forEach(([key, event]) => {
      if (!merged.events[key] || finiteCount(event.at) < finiteCount(merged.events[key].at)) merged.events[key] = event;
    });
    Object.assign(merged.adjustments, a.adjustments);
    Object.entries(b.adjustments).forEach(([key, adjustment]) => {
      if (!merged.adjustments[key] || finiteCount(adjustment.at) < finiteCount(merged.adjustments[key].at)) merged.adjustments[key] = adjustment;
    });
    return merged;
  }

  function makeDeviceId(){
    try { if (root.crypto?.randomUUID) return `device-${root.crypto.randomUUID()}`; } catch {}
    return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function getDeviceId(){
    const storage = store();
    let id = String(storage?.get?.(DEVICE_KEY, '') || '').trim();
    if (!id) {
      id = makeDeviceId();
      storage?.set?.(DEVICE_KEY, id);
    }
    return id;
  }

  function readState(){
    return normalizeState(store()?.json?.(STORAGE_KEY, {}) || {});
  }

  function emit(summary, source = 'local', previousSummary = summary){
    try {
      root.dispatchEvent(new CustomEvent('modeAtlasProgressChanged', {
        detail: {
          ...summary,
          source,
          previousLevel: Number(previousSummary?.level || summary.level || 1),
          previousXp: Number(previousSummary?.xp || 0)
        }
      }));
    } catch {}
  }

  function persistState(input, options = {}){
    const storage = store();
    if (!storage?.setJSON) return normalizeState(input);
    const previousSummary = getSummary(readState());
    const state = normalizeState(input);
    state.updatedAt = Math.max(Date.now(), finiteCount(state.updatedAt));
    storage.setJSON(STORAGE_KEY, state);
    storage.set(UPDATED_AT_KEY, String(state.updatedAt));
    if (options.sync !== false) {
      try { root.KanaCloudSync?.markSectionUpdated?.('progress'); } catch {}
      try { root.KanaCloudSync?.scheduleSync?.(); } catch {}
    }
    const summary = getSummary(state);
    if (options.emit !== false) emit(summary, options.source || 'local', previousSummary);
    return state;
  }

  function correctFromStats(mode){
    const stats = store()?.readModeJSON?.(mode, 'charStats', {}) || {};
    return Object.values(object(stats)).reduce((sum, row) => {
      if (!row || typeof row !== 'object') return sum;
      return sum + finiteCount(row.correct ?? row.right);
    }, 0);
  }

  function ensureSeeded(options = {}){
    let state = readState();
    if (state.legacySeeded) return state;
    const readingCorrect = correctFromStats('reading');
    const writingCorrect = correctFromStats('writing');
    const legacy = {};
    if (readingCorrect) legacy['kana.reading.correct'] = readingCorrect;
    if (writingCorrect) legacy['kana.writing.correct'] = writingCorrect;
    if (Object.keys(legacy).length) state.sources[LEGACY_SOURCE] = legacy;
    state.legacySeeded = true;
    return persistState(state, { sync: options.sync === true, emit: options.emit !== false, source: 'legacy-seed' });
  }

  function award(type, amount = 1){
    if (!(type in COUNTER_XP)) return false;
    const increment = finiteCount(amount);
    if (!increment) return false;
    const state = ensureSeeded({ sync: false, emit: false });
    const sourceId = getDeviceId();
    const source = state.sources[sourceId] || {};
    source[type] = finiteCount(source[type]) + increment;
    state.sources[sourceId] = source;
    persistState(state, { source: type });
    return true;
  }

  function awardOnce(type, eventId){
    if (!(type in EVENT_XP)) return false;
    const id = String(eventId || '').trim();
    if (!id) return false;
    const state = ensureSeeded({ sync: false, emit: false });
    const key = `${type}|${id}`;
    if (state.events[key]) return false;
    state.events[key] = { type, id, at: Date.now() };
    persistState(state, { source: type });
    return true;
  }

  function counterTotal(state, type){
    return Object.values(normalizeState(state).sources).reduce((sum, source) => sum + finiteCount(source[type]), 0);
  }

  function getLifetimeCorrect(input){
    const state = input ? normalizeState(input) : ensureSeeded({ sync: false, emit: false });
    return counterTotal(state, 'kana.reading.correct') + counterTotal(state, 'kana.writing.correct');
  }

  function getXP(input){
    const state = input ? normalizeState(input) : ensureSeeded({ sync: false, emit: false });
    let xp = 0;
    Object.values(state.sources).forEach((source) => {
      Object.entries(source).forEach(([type, count]) => { xp += finiteCount(count) * (COUNTER_XP[type] || 0); });
    });
    Object.values(state.events).forEach((event) => { xp += EVENT_XP[event.type] || 0; });
    Object.values(state.adjustments).forEach((adjustment) => { xp += finiteInteger(adjustment.amount); });
    return Math.max(0, Math.floor(xp));
  }

  function levelRequirement(level){
    const current = Math.max(1, Math.floor(Number(level || 1)));
    return 100 + ((current - 1) * 50);
  }

  function getLevelFromXP(value){
    const xp = Math.max(0, Math.floor(Number(value || 0)));
    let level = 1;
    let floor = 0;
    let required = levelRequirement(level);
    while (xp >= floor + required && level < 999) {
      floor += required;
      level += 1;
      required = levelRequirement(level);
    }
    return { level, floor, required, intoLevel: xp - floor, nextAt: floor + required };
  }

  function getSummary(input){
    const state = input ? normalizeState(input) : ensureSeeded({ sync: false, emit: false });
    const xp = getXP(state);
    const levelInfo = getLevelFromXP(xp);
    const readingCorrect = counterTotal(state, 'kana.reading.correct');
    const writingCorrect = counterTotal(state, 'kana.writing.correct');
    return {
      level: levelInfo.level,
      xp,
      levelXp: levelInfo.intoLevel,
      levelRequirement: levelInfo.required,
      nextLevelAt: levelInfo.nextAt,
      progress: levelInfo.required ? Math.min(1, levelInfo.intoLevel / levelInfo.required) : 0,
      readingCorrect,
      writingCorrect,
      lifetimeCorrect: readingCorrect + writingCorrect
    };
  }

  function debugAdjustXP(amount){
    const requested = finiteInteger(amount);
    if (!requested) return false;
    const state = ensureSeeded({ sync: false, emit: false });
    const before = getSummary(state);
    const applied = requested < 0 ? Math.max(requested, -before.xp) : requested;
    if (!applied) return { requested, applied: 0, before, after: before };
    const sourceId = getDeviceId();
    const id = `dev-xp-${sourceId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    state.adjustments[id] = { id, amount: applied, at: Date.now() };
    const persisted = persistState(state, { source: 'dev.xpAdjust' });
    return { requested, applied, before, after: getSummary(persisted) };
  }

  root.ModeAtlasProgress = Object.freeze({
    STORAGE_KEY, UPDATED_AT_KEY, DEVICE_KEY, STATE_VERSION,
    COUNTER_XP, EVENT_XP,
    normalizeState, mergeStates, readState, persistState, ensureSeeded,
    award, awardOnce, debugAdjustXP,
    getXP, getLifetimeCorrect, getLevelFromXP, getSummary
  });

  // Seed locally before cloud hydration. The cloud owner will merge/push this
  // baseline rather than progression initiating a competing startup sync.
  ensureSeeded({ sync: false, emit: false });
})(typeof window !== 'undefined' ? window : globalThis);
'''
write('assets/app/mode-atlas-progress.js', progress_js)

progress_ui_js = r'''(function ModeAtlasProgressUi(root){
  'use strict';
  if (root.ModeAtlasProgressUI) return;

  let pendingLevelUp = null;
  let activePresentation = null;

  function queueLevelUp(detail = {}){
    const level = Math.max(1, Math.floor(Number(detail.level || 1)));
    const previousLevel = Math.max(1, Math.floor(Number(detail.previousLevel || level)));
    if (level <= previousLevel) return false;
    if (!pendingLevelUp || level >= pendingLevelUp.level) {
      pendingLevelUp = {
        level,
        previousLevel,
        xp: Math.max(0, Math.floor(Number(detail.xp || 0))),
        levelXp: Math.max(0, Math.floor(Number(detail.levelXp || 0))),
        levelRequirement: Math.max(1, Math.floor(Number(detail.levelRequirement || 1)))
      };
    }
    return true;
  }

  function levelUpContent(summary){
    const wrap = document.createElement('div');
    wrap.className = 'ma-level-up-card';
    const badge = document.createElement('div');
    badge.className = 'ma-level-up-badge';
    badge.textContent = String(summary.level);
    const label = document.createElement('div');
    label.className = 'ma-level-up-label';
    label.textContent = 'Atlas Level';
    const copy = document.createElement('p');
    const remaining = Math.max(0, summary.levelRequirement - summary.levelXp);
    copy.textContent = remaining > 0
      ? `You reached Atlas Level ${summary.level}. ${remaining.toLocaleString()} XP to Level ${summary.level + 1}.`
      : `You reached Atlas Level ${summary.level}.`;
    wrap.append(badge, label, copy);
    return wrap;
  }

  function naturalBreak(reason = 'natural-break'){
    if (activePresentation) return activePresentation;
    if (!pendingLevelUp || !root.ModeAtlasDialog?.feature) return Promise.resolve(false);
    const summary = pendingLevelUp;
    pendingLevelUp = null;
    activePresentation = root.ModeAtlasDialog.feature({
      kicker: 'Atlas Level',
      title: 'Level up',
      tone: 'success',
      contentNode: levelUpContent(summary)
    }).finally(() => {
      activePresentation = null;
      if (pendingLevelUp) queueMicrotask(() => naturalBreak(reason));
    });
    return activePresentation;
  }

  root.addEventListener('modeAtlasProgressChanged', (event) => {
    queueLevelUp(event.detail || {});
  });

  root.ModeAtlasProgressUI = Object.freeze({
    queueLevelUp,
    naturalBreak,
    hasPendingLevelUp(){ return !!pendingLevelUp; }
  });
})(window);
'''
write('assets/app/mode-atlas-progress-ui.js', progress_ui_js)

# Shared loading order: data owner first, presentation consumer second.
replace_once(
    'frontend_components.py',
    "    'assets/app/mode-atlas-progress.js',\n    'assets/app/mode-atlas-save-repair.js',",
    "    'assets/app/mode-atlas-progress.js',\n    'assets/app/mode-atlas-progress-ui.js',\n    'assets/app/mode-atlas-save-repair.js',"
)

# Install prompt acknowledgement is device UX state, not account/export state.
storage = read('assets/app/mode-atlas-storage.js')
storage = storage.replace("    'modeAtlasInstallPromptDismissedAt',\n", '', 1)
storage = storage.replace("    'modeAtlasInstallPromptSeen',\n", '', 1)
local_anchor = "    'modeAtlasCloudAccessState',\n"
if local_anchor not in storage:
    raise SystemExit('storage local-state anchor missing')
storage = storage.replace(
    local_anchor,
    local_anchor + "    'modeAtlasInstallPromptDismissedAt',\n    'modeAtlasInstallPromptSeen',\n",
    1
)
write('assets/app/mode-atlas-storage.js', storage)

# Cloud progress recognises signed dev adjustments while preserving merge ownership.
replace_once(
    'cloud-sync.js',
    "progress: { state: { version: 1, legacySeeded: true, sources: {}, events: {}, updatedAt: now } }",
    "progress: { state: { version: 2, legacySeeded: true, sources: {}, events: {}, adjustments: {}, updatedAt: now } }"
)
replace_once(
    'cloud-sync.js',
    "if (sectionName === 'progress') return deepHasProgress(data.state?.sources) || deepHasProgress(data.state?.events);",
    "if (sectionName === 'progress') return deepHasProgress(data.state?.sources) || deepHasProgress(data.state?.events) || deepHasProgress(data.state?.adjustments);"
)

# Contextual install owner: 100 lifetime correct answers, natural breaks only,
# one automatic ask per browser/device, with manual Settings install always available.
pwa_js = r'''(function ModeAtlasPwa(){
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
'''
write('assets/app/mode-atlas-pwa.js', pwa_js)

# Session summaries snapshot XP at start and calculate one canonical gain at the end.
replace_once(
    'assets/trainer/mode-atlas-trainer-shared.js',
    "        startTime: null,\n        endTime: null,",
    "        startTime: null,\n        endTime: null,\n        startXp: 0,"
)
replace_once(
    'assets/trainer/mode-atlas-trainer-shared.js',
    "    sessionStats.active = true;\n    sessionStats.startTime = now;",
    "    sessionStats.active = true;\n    sessionStats.startTime = now;\n    sessionStats.startXp = Math.max(0, Number(window.ModeAtlasProgress?.getXP?.() || 0));"
)

shared = read('assets/trainer/mode-atlas-trainer-shared.js')
start = shared.find('function showTrainerSessionModal(options = {}) {')
if start < 0:
    raise SystemExit('showTrainerSessionModal missing')
new_tail = r'''function getTrainerSessionXpGain(stats = sessionStats) {
    const startXp = Math.max(0, Number(stats?.startXp || 0));
    const currentXp = Math.max(0, Number(window.ModeAtlasProgress?.getXP?.() || startXp));
    return Math.max(0, Math.floor(currentXp - startXp));
}

function settleTrainerProgressionBreak(reason = 'trainer-session-end') {
    const levelPromise = window.ModeAtlasProgressUI?.naturalBreak?.(reason) || Promise.resolve(false);
    return Promise.resolve(levelPromise)
        .catch(() => false)
        .then(() => {
            try { return window.ModeAtlasInstall?.naturalBreak?.(reason) || false; }
            catch { return false; }
        });
}

function showTrainerSessionModal(options = {}) {
    const {
        autoEnded = false,
        sessionStats,
        settings,
        endlessRunTotal = 0,
        endlessRunWrong = 0,
        trialTarget = 0
    } = options;

    if (!sessionStats || !window.ModeAtlasDialog?.feature) return false;

    sessionStats.endTime = Date.now();
    const total = sessionStats.answered;
    const accuracy = total ? ((sessionStats.correct / total) * 100) : 0;
    const timings = Array.isArray(sessionStats.timings) ? sessionStats.timings : [];
    const avgTime = timings.length ? average(timings) : 0;
    const fastest = timings.length ? Math.min(...timings) : 0;
    const slowest = timings.length ? Math.max(...timings) : 0;
    const durationMs = sessionStats.startTime ? (sessionStats.endTime - sessionStats.startTime) : 0;
    const xpGain = getTrainerSessionXpGain(sessionStats);

    const cards = [
        ["Answered", total], ["Right", sessionStats.correct], ["Wrong", sessionStats.wrong],
        ["Accuracy", `${accuracy.toFixed(1)}%`], ["Best Streak", sessionStats.bestStreak],
        ["XP gained", `+${xpGain} XP`],
        ["Avg Time", formatDuration(avgTime)], ["Fastest", formatDuration(fastest)],
        ["Slowest", formatDuration(slowest)], ["Session Time", formatDuration(durationMs)]
    ];

    if (settings?.speedRun) {
        const correct = Math.max(0, endlessRunTotal - endlessRunWrong);
        const answered = Math.max(0, endlessRunTotal);
        const wrong = Math.max(0, endlessRunWrong);
        const avgMs = timings.length ? Math.round(average(timings)) : 0;
        const speedAccuracy = answered ? Math.round((correct / answered) * 100) : 0;
        const speedScore = Math.max(0, Math.round((correct * 100) + ((speedAccuracy / 100) * 250) - (wrong * 50) - (avgMs / 20)));
        cards.push(["Speed Score", speedScore], ["Speed Accuracy", `${speedAccuracy}%`], ["Avg Speed", avgMs ? formatDuration(avgMs) : "—"]);
    } else if (settings?.timeTrial) {
        cards.push(["Target", trialTarget], ["Final Score", sessionStats.correct]);
    }

    const content = document.createElement('div');
    content.className = 'ma-session-dialog-content';
    const sessionStatsGrid = document.createElement('div');
    sessionStatsGrid.className = 'modal-grid ma-session-dialog-grid';
    sessionStatsGrid.replaceChildren(...cards.map(([label, value]) => createStatCard(label, value)));

    const sessionHardList = document.createElement('div');
    sessionHardList.className = 'session-list';
    sessionHardList.hidden = true;
    const sessionEasyList = document.createElement('div');
    sessionEasyList.className = 'session-list';
    sessionEasyList.hidden = true;
    const { hardest, easiest } = getSessionDifficultyLists();
    renderSessionList(sessionHardList, "Hardest This Session", hardest);
    renderSessionList(sessionEasyList, "Strongest This Session", easiest);
    content.append(sessionStatsGrid, sessionHardList, sessionEasyList);

    const title = autoEnded ? (settings?.speedRun ? "Speed Run Complete" : "Time Trial Complete") : "Session Stats";
    const dialogPromise = window.ModeAtlasDialog.feature({ kicker:'Session complete', title, contentNode:content, size:'wide' });
    Promise.resolve(dialogPromise).then(() => settleTrainerProgressionBreak('trainer-session-summary'));
    return true;
}
'''
write('assets/trainer/mode-atlas-trainer-shared.js', shared[:start] + new_tail)

# Daily completion reports total XP earned (answers plus one-time official bonus)
# and releases queued level/install UX only after the session has reached a break.
for page in ['assets/pages/mode-atlas-default-page.js', 'assets/pages/mode-atlas-reverse-page.js']:
    def daily_editor(block):
        anchor = '    setGameOverVisible(true);'
        if anchor not in block:
            raise SystemExit(f'daily game-over anchor missing in {page}')
        block = block.replace(
            anchor,
            "    const sessionXp = getTrainerSessionXpGain(sessionStats);\n    gameOverAnswerEl.textContent += ` · +${sessionXp} XP`;\n\n" + anchor,
            1
        )
        anchor2 = '    saveAll();'
        if anchor2 not in block:
            raise SystemExit(f'daily save anchor missing in {page}')
        block = block.replace(anchor2, anchor2 + "\n    void settleTrainerProgressionBreak('daily-challenge-complete');", 1)
        return block
    edit_function(page, 'endDailyChallenge', daily_editor)

# Formal Test completion also reports the XP from all correct kana plus its one-time test bonus,
# then sequences level-up and install UX after the assessment summary closes.
for page in ['assets/pages/mode-atlas-default-page.js', 'assets/pages/mode-atlas-reverse-page.js']:
    def test_editor(block):
        card_anchor = '["Test Time", formatDuration(durationMs)]'
        if card_anchor not in block:
            raise SystemExit(f'test card anchor missing in {page}')
        block = block.replace(card_anchor, card_anchor + ',\n        ["XP gained", `+${getTrainerSessionXpGain(sessionStats)} XP`]', 1)
        call_anchor = '    window.ModeAtlasDialog?.feature?.({'
        if call_anchor not in block:
            raise SystemExit(f'test dialog anchor missing in {page}')
        block = block.replace(call_anchor, '    const testDialogPromise = window.ModeAtlasDialog?.feature?.({', 1)
        close_anchor = '        size: "wide"\n    });'
        if close_anchor not in block:
            raise SystemExit(f'test dialog close anchor missing in {page}')
        block = block.replace(close_anchor, close_anchor + "\n    Promise.resolve(testDialogPromise).then(() => settleTrainerProgressionBreak('formal-test-summary'));", 1)
        return block
    edit_function(page, 'endTestMode', test_editor)

# Manually ending an incomplete Daily Challenge has no completion modal in the existing flow,
# but it is still a natural break for any queued level-up/install eligibility.
for page in ['assets/pages/mode-atlas-default-page.js', 'assets/pages/mode-atlas-reverse-page.js']:
    def end_editor(block):
        anchor = '        onSettingsChanged();\n        return;'
        if anchor not in block:
            raise SystemExit(f'daily manual-end anchor missing in {page}')
        return block.replace(anchor, "        onSettingsChanged();\n        void settleTrainerProgressionBreak('daily-session-ended');\n        return;", 1)
    edit_function(page, 'endSession', end_editor)

# Dev diagnostics consume the progression API. They never manufacture raw XP storage writes.
dev = read('assets/app/mode-atlas-dev-console.js')
dev = dev.replace(
    "      devButton('Service worker', 'maDevServiceWorker', 'diagnostic'),",
    "      devButton('Service worker', 'maDevServiceWorker', 'diagnostic'),\n      devButton('Progress / XP', 'maDevProgress', 'diagnostic'),",
    1
)
helper_anchor = '  function openDevMenu(){'
if helper_anchor not in dev:
    raise SystemExit('dev helper insertion anchor missing')
dev_helpers = r'''  function progressData(){
    const summary = window.ModeAtlasProgress?.getSummary?.() || {};
    const remaining = Math.max(0, Number(summary.levelRequirement || 0) - Number(summary.levelXp || 0));
    return {
      atlasLevel: summary.level || 1,
      xp: summary.xp || 0,
      xpToNextLevel: remaining,
      lifetimeCorrect: summary.lifetimeCorrect || 0,
      readingCorrect: summary.readingCorrect || 0,
      writingCorrect: summary.writingCorrect || 0
    };
  }

  function renderProgressPanel(){
    const panel = devEl('div', 'ma-dev-progress-panel');
    panel.append(renderKeyValueTable(progressData()));
    const controls = devEl('div', 'ma-dev-progress-controls');
    const label = devEl('label', 'ma-dev-progress-field');
    label.append(devEl('span', '', 'XP adjustment'));
    const input = devEl('input', 'ma-dev-progress-input');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.value = '100';
    input.dataset.maDevXpAmount = '';
    label.append(input);
    controls.append(
      label,
      devButton('Add XP', 'maDevXpAdd', 'action'),
      devButton('Remove XP', 'maDevXpRemove', 'action')
    );
    panel.append(controls);
    return panel;
  }

  function adjustDevXp(backdrop, direction){
    const input = backdrop.querySelector('[data-ma-dev-xp-amount]');
    const amount = Math.max(1, Math.floor(Number(input?.value || 0)));
    if (!Number.isFinite(amount)) {
      toast('Enter a valid XP amount.', 'warning');
      return;
    }
    const result = window.ModeAtlasProgress?.debugAdjustXP?.(direction * amount);
    if (!result) {
      toast('Progression debug controls are unavailable.', 'warning');
      return;
    }
    replaceDevBody(backdrop, [renderProgressPanel()]);
    const applied = Number(result.applied || 0);
    toast(`${applied >= 0 ? '+' : ''}${applied} XP applied · Level ${result.after?.level || 1}.`);
    if (Number(result.after?.level || 1) > Number(result.before?.level || 1)) {
      backdrop.classList.remove('open');
      void window.ModeAtlasProgressUI?.naturalBreak?.('dev-xp-adjustment');
    }
  }

'''
dev = dev.replace(helper_anchor, dev_helpers + helper_anchor, 1)
dev = dev.replace(
    "      if (event.target.closest('[data-ma-dev-service-worker]')) {\n        replaceDevBody(backdrop, [renderKeyValueTable({ loading: 'Checking Service Worker…' })]);\n        getServiceWorkerInfo().then(info => replaceDevBody(backdrop, [renderJsonPanel('Service worker', info)])).catch(error => replaceDevBody(backdrop, [renderJsonPanel('Service worker error', { error: error?.message || String(error) })]));\n      }",
    "      if (event.target.closest('[data-ma-dev-service-worker]')) {\n        replaceDevBody(backdrop, [renderKeyValueTable({ loading: 'Checking Service Worker…' })]);\n        getServiceWorkerInfo().then(info => replaceDevBody(backdrop, [renderJsonPanel('Service worker', info)])).catch(error => replaceDevBody(backdrop, [renderJsonPanel('Service worker error', { error: error?.message || String(error) })]));\n      }\n      if (event.target.closest('[data-ma-dev-progress]')) replaceDevBody(backdrop, [renderProgressPanel()]);\n      if (event.target.closest('[data-ma-dev-xp-add]')) adjustDevXp(backdrop, 1);\n      if (event.target.closest('[data-ma-dev-xp-remove]')) adjustDevXp(backdrop, -1);",
    1
)
# Surface the current progression summary in Overview diagnostics too.
dev = dev.replace(
    "      writingTests: countArray('writingTestModeResults') + countArray('kanaTrainerWritingTestModeResults'),\n      dataFlow: JSON.stringify(collectDataFlow())",
    "      writingTests: countArray('writingTestModeResults') + countArray('kanaTrainerWritingTestModeResults'),\n      atlasLevel: window.ModeAtlasProgress?.getSummary?.().level || 1,\n      atlasXp: window.ModeAtlasProgress?.getSummary?.().xp || 0,\n      dataFlow: JSON.stringify(collectDataFlow())",
    1
)
write('assets/app/mode-atlas-dev-console.js', dev)

# Presentation styling for level-up and developer XP controls.
app_modal_css = read('assets/css/mode-atlas-app-modals.css')
install_anchor = '.ma-install-prompt span{color:var(--ma-muted)}\n'
if install_anchor not in app_modal_css:
    raise SystemExit('app modal install css anchor missing')
app_modal_css = app_modal_css.replace(
    install_anchor,
    install_anchor + r'''
.ma-level-up-card{display:grid;justify-items:center;text-align:center;gap:8px;padding:10px 8px 4px}
.ma-level-up-badge{width:88px;height:88px;display:grid;place-items:center;border-radius:28px;background:var(--ma-control-active);border:1px solid var(--ma-control-active-border);box-shadow:var(--ma-shadow-control);font-family:var(--ma-font-display);font-size:2.5rem;font-weight:950;letter-spacing:-.06em;color:var(--ma-text-strong)}
.ma-level-up-label{font-size:.72rem;font-weight:950;letter-spacing:.16em;text-transform:uppercase;color:var(--ma-muted)}
.ma-level-up-card p{max-width:420px;margin:2px 0 0;color:var(--ma-muted);line-height:1.55}
@media(max-width:640px){.ma-install-prompt{align-items:stretch;flex-wrap:wrap}.ma-install-prompt>div{flex:1 0 100%}.ma-install-prompt .ma-button{flex:1}.ma-level-up-badge{width:76px;height:76px;border-radius:24px;font-size:2.2rem}}
''',
    1
)
write('assets/css/mode-atlas-app-modals.css', app_modal_css)

dev_css = read('assets/css/mode-atlas-dev-console.css') + r'''

.ma-dev-progress-panel{display:grid;gap:14px}
.ma-dev-progress-controls{display:grid;grid-template-columns:minmax(180px,1fr) auto auto;gap:10px;align-items:end;padding-top:4px}
.ma-dev-progress-field{display:grid;gap:6px;font-size:12px;font-weight:900;color:var(--ma-muted,#9aa6bd)}
.ma-dev-progress-input{width:100%;box-sizing:border-box;border:1px solid rgba(148,163,184,.28);border-radius:12px;background:rgba(255,255,255,.06);color:inherit;padding:10px 12px;font:700 13px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}
@media(max-width:640px){.ma-dev-progress-controls{grid-template-columns:1fr}.ma-dev-progress-controls .ma-button{width:100%}}
'''
write('assets/css/mode-atlas-dev-console.css', dev_css)

# Release notes. 2.41 was validated without a top changelog section, so restore
# that missing documentation while adding the new 2.42 entry.
changelog = read('CHANGELOG.md')
entry_242 = '''## 2.42.0 - 2026-08-16
- Made the automatic install suggestion progression-aware: it becomes eligible after 100 lifetime correct Kana Reading/Writing answers and only appears at a natural break rather than interrupting the milestone answer.
- Kept install prompting under the single shared PWA owner, including manual browser/iPad instructions when `beforeinstallprompt` is unavailable, and made automatic prompt acknowledgement device-local rather than exported account state.
- Added XP gained to standard session summaries, formal Test Mode completion summaries, and Daily Challenge completion feedback.
- Added a queued Atlas Level-up dialog that waits for session/Test summaries to finish before appearing, then lets the install suggestion run afterwards when eligible.
- Added developer Progress / XP diagnostics with controlled Add XP and Remove XP actions through `ModeAtlasProgress`, including merge-safe signed debug adjustments and level-up testing without raw storage writes.

'''
entry_241 = '''## 2.41.0 - 2026-08-16
- Added account-wide Atlas Level progression to Profile with XP, level progress, Reading correct, Writing correct, and lifetime correct totals.
- Added one shared `ModeAtlasProgress` owner with semantic Kana correct/Daily/Test events, one-time legacy seeding from existing trainer statistics, and centrally derived XP/levels.
- Added merge-safe per-device monotonic answer counters plus unique one-time completion events so cross-device sync cannot lose or double-award progression.
- Kept Atlas Level separate from Kana mastery and Test performance, and exposed lifetime correct as a stable engagement signal for future install eligibility.

'''
if not changelog.startswith('## 2.42.0'):
    prefix = entry_242
    if '## 2.41.0 - 2026-08-16' not in changelog:
        prefix += entry_241
    changelog = prefix + changelog
write('CHANGELOG.md', changelog)

# 2.42 regression ownership guard.
tests = read('tests/frontend.test.js')
if "test('2.42 contextual install and progression feedback" not in tests:
    tests += r'''


test('2.42 contextual install and progression feedback stay under shared owners', () => {
  const frontend = read('frontend_components.py');
  const storage = read('assets/app/mode-atlas-storage.js');
  const progress = read('assets/app/mode-atlas-progress.js');
  const progressUi = read('assets/app/mode-atlas-progress-ui.js');
  const pwa = read('assets/app/mode-atlas-pwa.js');
  const dev = read('assets/app/mode-atlas-dev-console.js');
  const shared = read('assets/trainer/mode-atlas-trainer-shared.js');
  const reading = read('assets/pages/mode-atlas-default-page.js');
  const writing = read('assets/pages/mode-atlas-reverse-page.js');
  const cloud = read('cloud-sync.js');

  assert.match(frontend, /assets\/app\/mode-atlas-progress-ui\.js/);
  assert.ok(frontend.indexOf("'assets/app/mode-atlas-progress.js'") < frontend.indexOf("'assets/app/mode-atlas-progress-ui.js'"));
  assert.ok(frontend.indexOf("'assets/app/mode-atlas-progress-ui.js'") < frontend.indexOf("'assets/app/mode-atlas-pwa.js'"));

  assert.match(progress, /const STATE_VERSION = 2/);
  assert.match(progress, /adjustments/);
  assert.match(progress, /function debugAdjustXP/);
  assert.match(progress, /source: 'dev\.xpAdjust'/);
  assert.match(progress, /previousLevel/);
  assert.match(cloud, /data\.state\?\.adjustments/);

  assert.match(progressUi, /modeAtlasProgressChanged/);
  assert.match(progressUi, /pendingLevelUp/);
  assert.match(progressUi, /naturalBreak/);
  assert.match(progressUi, /title: 'Level up'/);

  assert.match(shared, /startXp/);
  assert.match(shared, /function getTrainerSessionXpGain/);
  assert.match(shared, /\["XP gained", `\+\$\{xpGain\} XP`\]/);
  assert.match(shared, /settleTrainerProgressionBreak/);
  for (const page of [reading, writing]) {
    assert.match(page, /\["XP gained", `\+\$\{getTrainerSessionXpGain\(sessionStats\)\} XP`\]/);
    assert.match(page, /gameOverAnswerEl\.textContent \+= ` · \+\$\{sessionXp\} XP`/);
    assert.match(page, /formal-test-summary/);
  }

  assert.match(pwa, /AUTO_INSTALL_CORRECT_THRESHOLD = 100/);
  assert.match(pwa, /ModeAtlasProgress\?\.getLifetimeCorrect/);
  assert.match(pwa, /function naturalBreak/);
  assert.match(pwa, /beforeinstallprompt/);
  assert.match(pwa, /Share → Add to Home Screen/);
  assert.doesNotMatch(pwa, /modeAtlasProgressChanged[\s\S]{0,180}showInstallPrompt/,
    'crossing the milestone must not immediately interrupt an answer');

  const backupBlock = storage.split('const APP_BACKUP_EXACT', 2)[1]?.split('const APP_LOCAL_EXACT', 1)[0] || '';
  const localBlock = storage.split('const APP_LOCAL_EXACT', 2)[1]?.split('const APP_LOCAL_SET', 1)[0] || '';
  assert.doesNotMatch(backupBlock, /modeAtlasInstallPromptSeen|modeAtlasInstallPromptDismissedAt/,
    'automatic install prompt acknowledgement must stay device-local');
  assert.match(localBlock, /modeAtlasInstallPromptSeen/);
  assert.match(localBlock, /modeAtlasInstallPromptDismissedAt/);

  assert.match(dev, /Progress \/ XP/);
  assert.match(dev, /data-ma-dev-xp-amount/);
  assert.match(dev, /debugAdjustXP/);
  assert.doesNotMatch(dev, /setJSON\(['"]modeAtlasProgress|localStorage\.setItem\(['"]modeAtlasProgress/,
    'developer XP controls must use the progression API rather than raw progression storage');
});
'''
write('tests/frontend.test.js', tests)

print('Applied Mode Atlas 2.42.0 source changes')
