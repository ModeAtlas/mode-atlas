/* Account merge policy. No transport, authentication or local mutation. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.ModeAtlasSaveMerge = factory(root);
})(typeof window === 'undefined' ? globalThis : window, function(root) {
  'use strict';
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const stable = value => JSON.stringify(value, (_,v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k,v[k]])) : v);
  const clock = value => Number(value) || Date.parse(value) || 0;
  const newest = (a, b) => clock(a?.updatedAt) !== clock(b?.updatedAt) ? (clock(a?.updatedAt) > clock(b?.updatedAt) ? a : b) : stable(a) >= stable(b) ? a : b;
  // Legacy copies must receive the same identity on every device, independent
  // of import time and array order. Existing IDs remain authoritative.
  function testRecords(list, mode) {
    return (Array.isArray(list) ? list : []).filter(row => row && typeof row === 'object' && !Array.isArray(row)).map(row => {
      const value = {...row, mode:row.mode || row.source || mode};
      if (!value.id) {
        let a = 2166136261, b = 5381;
        for (const c of stable(value)) { a = Math.imul(a ^ c.charCodeAt(0), 16777619); b = Math.imul(b, 33) ^ c.charCodeAt(0); }
        value.id = 'legacy-' + mode + '-' + (a >>> 0).toString(36) + '-' + (b >>> 0).toString(36);
      }
      const at = clock(value.createdAt || value.completedAt || value.date || value.timestamp || value.completedAtMs);
      if (!value.createdAt && at) value.createdAt = new Date(at).toISOString();
      if (!value.updatedAt) value.updatedAt = value.createdAt || 0;
      return value;
    }).filter(row => row.mode === mode);
  }
  function records(left, right, deleted = {}) {
    const map = new Map();
    for (const row of [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])]) {
      if (!row || typeof row !== 'object' || !row.id || Object.hasOwn(deleted, row.id)) continue;
      map.set(row.id, map.has(row.id) ? newest(map.get(row.id), row) : row);
    }
    return [...map.values()].sort((a,b) => clock(b.createdAt || b.at || b.date)-clock(a.createdAt || a.at || a.date) || String(a.id).localeCompare(String(b.id)));
  }
  function tombstones(left, right) {
    const out = {};
    for (const source of [object(left),object(right)]) for (const [id, at] of Object.entries(source)) if (!['__proto__','constructor','prototype'].includes(id)) out[id] = Math.max(out[id] || 0, clock(at));
    return out;
  }
  function scores(left = {}, right = {}) {
    const n = value => Number(value) || 0;
    const top = (a, b, compare) => [...new Map([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].filter(v => v && typeof v === 'object').map(v => [stable(v), v])).values()].sort((a,b) => compare(a,b) || stable(a).localeCompare(stable(b))).slice(0,3);
    const a = object(left), b = object(right), x = object(a.endlessBest), y = object(b.endlessBest);
    return {
      endlessBest:n(x.correct) !== n(y.correct) ? (n(x.correct) > n(y.correct) ? x : y) : newest(x,y),
      comboKanaBest:Object.fromEntries(['same_row','random'].map(k => [k,Math.max(n(a.comboKanaBest?.[k]),n(b.comboKanaBest?.[k]))])),
      speedRunTop3:top(a.speedRunTop3,b.speedRunTop3,(a,b) => n(b.score)-n(a.score) || n(b.correct)-n(a.correct) || n(a.avgMs)-n(b.avgMs) || n(a.wrong)-n(b.wrong)),
      timeTrialTop3:top(a.timeTrialTop3,b.timeTrialTop3,(a,b) => n(b.overTarget)-n(a.overTarget) || n(b.ratio)-n(a.ratio) || n(b.score)-n(a.score))
    };
  }
  function section(name, left = {}, right = {}) {
    const a = object(left.data), b = object(right.data), preferred = newest(left,right)?.data || {};
    let data;
    if (name === 'reading' || name === 'writing') {
      const owner = root.ModeAtlasKanaEvidence;
      const evidence = owner.merge(a.evidence?.version ? a.evidence : owner.legacy(a.stats,a.times), b.evidence?.version ? b.evidence : owner.legacy(b.stats,b.times));
      const mergeMap = (x,y) => Object.fromEntries([...new Set([...Object.keys(object(x)),...Object.keys(object(y))])].filter(k => !['__proto__','constructor','prototype'].includes(k)).sort().map(k => [k, !x?.[k] ? y[k] : !y?.[k] ? x[k] : newest(x[k],y[k])]));
      data = {...preferred, ...owner.totals(evidence), evidence, srs:root.ModeAtlasReview.mergeMaps(a.srs,b.srs),
        highScore:String(Math.max(Number(a.highScore)||0,Number(b.highScore)||0)), scoreHistory:scores(a.scoreHistory,b.scoreHistory), dailyChallengeHistory:mergeMap(a.dailyChallengeHistory,b.dailyChallengeHistory)};
    } else if (name === 'wordBank' || name === 'readingTests' || name === 'writingTests' || name === 'kanjiTests') {
      const deleted = tombstones(a.deleted,b.deleted), field = name.endsWith('Tests') && name !== 'kanjiTests' ? 'primary' : 'items';
      const entries = value => field === 'primary' ? ['primary','backup','altPrimary','altBackup'].flatMap(k => Array.isArray(value[k]) ? value[k] : []) : value.items;
      const normalize = value => field === 'primary' ? testRecords(value, name === 'writingTests' ? 'writing' : 'reading') : name==='wordBank'?root.ModeAtlasWordBank.normalize(value):value;
      const items=records(normalize(entries(a)),normalize(entries(b)),deleted);
      data = {[field]:name==='wordBank'?root.ModeAtlasWordBank.normalize(items):items, deleted};
      if(name==='wordBank')data.lessons=root.ModeAtlasWordLessonState.merge(a.lessons,b.lessons);
    } else {
      const owners = {progress:root.ModeAtlasProgress, kanaLearning:root.ModeAtlasKanaLearning, kanji:root.ModeAtlasKanjiState};
      const owner = owners[name];
      data = owner ? {state:(owner.mergeStates || owner.merge)(a.state,b.state)} : preferred;
    }
    return {updatedAt:Math.max(clock(left.updatedAt),clock(right.updatedAt)),data};
  }
  function snapshot(left = {}, right = {}) {
    const a = Number(left.generation) || 0, b = Number(right.generation) || 0;
    if (a !== b) return a > b ? left : right;
    const sections = {};
    for (const name of new Set([...Object.keys(left.sections || {}),...Object.keys(right.sections || {})])) sections[name] = section(name,left.sections?.[name],right.sections?.[name]);
    return {...newest(left,right),generation:a,sections};
  }
  return Object.freeze({stable, testRecords, records, tombstones, section, snapshot});
});
