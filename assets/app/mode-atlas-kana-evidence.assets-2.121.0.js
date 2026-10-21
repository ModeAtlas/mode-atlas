/* Mergeable Kana counters. Each device owns only its monotonic contribution. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.ModeAtlasKanaEvidence = factory(root);
})(typeof window === 'undefined' ? globalThis : window, function(root) {
  'use strict';
  const known = new Set(root.ModeAtlasKanaData.collections.all);
  const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Number(value))) : 0;
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const safe = key => /^[a-zA-Z0-9-]{1,100}$/.test(key) && !['constructor','prototype','__proto__'].includes(key);
  const key = mode => 'modeAtlasKanaEvidence:' + mode;
  function rows(input) {
    return Object.fromEntries(Object.entries(object(input)).filter(([char]) => known.has(char)).map(([char, row]) => [char,
      {correct: count(row?.correct), wrong: count(row?.wrong), totalMs: count(row?.totalMs), timed: count(row?.timed)}]));
  }
  function normalize(input) {
    return {version: 1, baseline: rows(input?.baseline), sources: Object.fromEntries(Object.entries(object(input?.sources)).filter(([id]) => safe(id)).map(([id, source]) => [id, rows(source)])),
      runs: Object.fromEntries(Object.entries(object(input?.runs)).filter(([id]) => safe(id)).sort((a,b) => count(b[1].at)-count(a[1].at)).slice(0,64).map(([id, run]) => [id, {index: count(run.index), at: count(run.at)}]))};
  }
  function legacy(stats = {}, times = {}) {
    const baseline = {};
    for (const char of new Set([...Object.keys(stats), ...Object.keys(times)])) {
      if (!known.has(char)) continue;
      const timed = count(times[char]?.count), avg = count(times[char]?.avg);
      baseline[char] = {correct: count(stats[char]?.correct), wrong: count(stats[char]?.wrong), totalMs: avg * timed, timed};
    }
    return normalize({baseline});
  }
  function merge(a, b) {
    a = normalize(a); b = normalize(b);
    function join(left, right) {
      const out = {};
      for (const char of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
        out[char] = Object.fromEntries(['correct','wrong','totalMs','timed'].map(field => [field, Math.max(left[char]?.[field] || 0, right[char]?.[field] || 0)]));
      }
      return out;
    }
    const sources = {};
    for (const id of [...new Set([...Object.keys(a.sources), ...Object.keys(b.sources)])].sort()) sources[id] = join(a.sources[id] || {}, b.sources[id] || {});
    const runs = {...a.runs};
    for (const [id, run] of Object.entries(b.runs)) runs[id] = {index: Math.max(runs[id]?.index || 0, run.index), at: Math.max(runs[id]?.at || 0, run.at)};
    return normalize({baseline: join(a.baseline, b.baseline), sources, runs});
  }
  function totals(input) {
    const state = normalize(input), stats = {}, times = {};
    for (const source of [state.baseline, ...Object.values(state.sources)]) for (const [char, row] of Object.entries(source)) {
      const stat = stats[char] ||= {correct:0, wrong:0}, time = times[char] ||= {totalMs:0, count:0};
      stat.correct += row.correct; stat.wrong += row.wrong; time.totalMs += row.totalMs; time.count += row.timed;
    }
    for (const [char, time] of Object.entries(times)) times[char] = {avg: time.count ? Math.round(time.totalMs / time.count) : 0, count: time.count};
    return {stats, times};
  }
  function seed(mode, stats, times) {
    let state = root.ModeAtlasStorage.json(key(mode), null);
    if (!state?.version) {
      state = legacy(stats, times);
      if (!root.ModeAtlasStorage.setJSON(key(mode), state)) throw Error('Your practice could not be saved.');
    }
    return normalize(state);
  }
  function record(mode, {id, index, chars, correct, elapsed, at = Date.now()}) {
    const state = normalize(root.ModeAtlasStorage.json(key(mode), {}));
    if ((state.runs[id]?.index || 0) >= index) return;
    const device = root.ModeAtlasProgress.getDeviceId(), source = state.sources[device] ||= {};
    for (const char of chars) {
      if (!known.has(char)) continue;
      const row = source[char] ||= {correct:0, wrong:0, totalMs:0, timed:0};
      row[correct ? 'correct' : 'wrong']++; row.timed++; row.totalMs += Math.min(300000, count(elapsed)) / Math.max(1, chars.length);
    }
    state.runs[id] = {index, at};
    if (!root.ModeAtlasStorage.setJSON(key(mode), normalize(state))) throw Error('Your practice could not be saved.');
  }
  return Object.freeze({key, normalize, legacy, merge, totals, seed, record});
});
