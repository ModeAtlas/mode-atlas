(function ModeAtlasProgressOwner(root){
  'use strict';
  if (root.ModeAtlasProgress) return;

  const STORAGE_KEY = 'modeAtlasProgress';
  const UPDATED_AT_KEY = 'modeAtlasProgressUpdatedAt';
  const DEVICE_KEY = 'modeAtlasProgressDeviceId';
  const STATE_VERSION = 1;
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
    return {
      version: STATE_VERSION,
      legacySeeded: value.legacySeeded === true,
      sources,
      events,
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

  function emit(summary, source = 'local'){
    try { root.dispatchEvent(new CustomEvent('modeAtlasProgressChanged', { detail: { ...summary, source } })); } catch {}
  }

  function persistState(input, options = {}){
    const storage = store();
    if (!storage?.setJSON) return normalizeState(input);
    const state = normalizeState(input);
    state.updatedAt = Math.max(Date.now(), finiteCount(state.updatedAt));
    storage.setJSON(STORAGE_KEY, state);
    storage.set(UPDATED_AT_KEY, String(state.updatedAt));
    if (options.sync !== false) {
      try { root.KanaCloudSync?.markSectionUpdated?.('progress'); } catch {}
      try { root.KanaCloudSync?.scheduleSync?.(); } catch {}
    }
    const summary = getSummary(state);
    if (options.emit !== false) emit(summary, options.source || 'local');
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

  root.ModeAtlasProgress = Object.freeze({
    STORAGE_KEY, UPDATED_AT_KEY, DEVICE_KEY, STATE_VERSION,
    COUNTER_XP, EVENT_XP,
    normalizeState, mergeStates, readState, persistState, ensureSeeded,
    award, awardOnce, getXP, getLifetimeCorrect, getLevelFromXP, getSummary
  });

  // Seed locally before cloud hydration. The cloud owner will merge/push this
  // baseline rather than progression initiating a competing startup sync.
  ensureSeeded({ sync: false, emit: false });
})(typeof window !== 'undefined' ? window : globalThis);
