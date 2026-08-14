(function(){
  if (window.ModeAtlasResultsEngine) return;

  function safeParse(raw, fallback){
    if (window.ModeAtlasStorage?.safeParse) return window.ModeAtlasStorage.safeParse(raw, fallback);
    if (raw === undefined || raw === null || raw === '') return fallback;
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return fallback; }
  }

  function loadJSON(key, fallback){
    if (window.ModeAtlasStorage?.json) return window.ModeAtlasStorage.json(key, fallback);
    return fallback;
  }


  function readArraysFromKeys(keys){
    const arrays = [];
    (keys || []).forEach((key) => {
      const value = loadJSON(key, null);
      if (Array.isArray(value)) arrays.push(value);
    });
    return arrays;
  }

  function loadModeResultsFromKeys(keys, expectedMode, normalizeTestResult){
    const mergedMap = new Map();
    const pushItems = (arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((item) => {
        let itemWithModeHint = item;
        if (item && typeof item === 'object' && !item.mode && expectedMode) {
          itemWithModeHint = { ...item, mode: expectedMode };
        }
        const normalized = normalizeTestResult(itemWithModeHint);
        if (!normalized || normalized.mode !== expectedMode) return;
        const key = normalized.id || `${normalized.mode}-${normalized.date}-${normalized.startedAt}`;
        mergedMap.set(key, normalized);
      });
    };
    readArraysFromKeys(keys).forEach(pushItems);
    return Array.from(mergedMap.values());
  }

  function parseStoredResultTimestamp(result){
    const dateStr = String(result?.date || '').trim();
    const timeStr = String(result?.startedAt || '').trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const direct = Date.parse(`${dateStr}T${timeStr || '00:00'}`);
      if (Number.isFinite(direct)) return direct;

      const match12h = timeStr.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
      if (match12h) {
        let hours = Number(match12h[1]) % 12;
        const minutes = Number(match12h[2]);
        const meridiem = match12h[3].toUpperCase();
        if (meridiem === 'PM') hours += 12;
        const rebuilt = Date.parse(`${dateStr}T${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:00`);
        if (Number.isFinite(rebuilt)) return rebuilt;
      }
    }

    const created = Date.parse(result?.createdAt || result?.updatedAt || '');
    if (Number.isFinite(created)) return created;

    const fallback = Date.parse(dateStr);
    if (Number.isFinite(fallback)) return fallback;

    const idMatch = String(result?.id || '').match(/(\d{13})/);
    if (idMatch) return Number(idMatch[1]);

    return 0;
  }

  function loadStoredResults(config){
    const readingTests = loadModeResultsFromKeys(config.readingKeys, 'reading', config.normalizeTestResult);
    const writingTests = loadModeResultsFromKeys(config.writingKeys, 'writing', config.normalizeTestResult);
    const tests = [...readingTests, ...writingTests].sort((a,b) => parseStoredResultTimestamp(b) - parseStoredResultTimestamp(a));
    const averages = [
      config.buildAverageResult('reading', readingTests),
      config.buildAverageResult('writing', writingTests)
    ].filter(Boolean);
    return [...averages, ...tests];
  }

  window.ModeAtlasResultsEngine = {
    safeParse,
    loadJSON,
    readArraysFromKeys,
    loadModeResultsFromKeys,
    parseStoredResultTimestamp,
    loadStoredResults
  };
})();
