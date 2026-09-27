(function(){
  if (window.ModeAtlasResultsStorage) return;

  const RESULT_KEYS = {
    reading: {
      primary: "testModeResults",
      backup: "kanaTrainerTestModeResults",
      updatedAt: "testModeResultsUpdatedAt",
      altPrimary: "readingTestModeResults",
      altBackup: "kanaTrainerReadingTestModeResults",
      altUpdatedAt: "readingTestModeResultsUpdatedAt",
      cloudSection: "readingTests"
    },
    writing: {
      primary: "writingTestModeResults",
      backup: "kanaTrainerWritingTestModeResults",
      updatedAt: "writingTestModeResultsUpdatedAt",
      cloudSection: "writingTests"
    }
  };

  function store(){ return window.ModeAtlasStorage; }
  function write(key, value){ const s = store(); return s?.set ? s.set(key, value) : false; }

  function keys(mode){
    return RESULT_KEYS[mode] || RESULT_KEYS.reading;
  }

  function normalize(list, mode){
    if (!Array.isArray(list)) return [];
    if (mode === "writing") {
      return list.filter(item => item && typeof item === "object" && item.mode === "writing");
    }
    return list.filter(item => item && typeof item === "object" && (item.mode || "reading") === "reading");
  }

  function persistToKeys(mode, list, markCloud){
    const cfg = keys(mode);
    const safeList = normalize(list, mode);
    const payload = JSON.stringify(safeList);
    [cfg.primary, cfg.backup, cfg.altPrimary, cfg.altBackup].filter(Boolean).forEach(key => write(key, payload));
    const ts = String(Date.now());
    [cfg.updatedAt, cfg.altUpdatedAt].filter(Boolean).forEach(key => write(key, ts));
    if (markCloud) {
      window.KanaCloudSync?.markSectionUpdated(cfg.cloudSection);
      window.KanaCloudSync?.scheduleSync();
    }
    return safeList;
  }

  function persist(mode, list){ return persistToKeys(mode, list, true); }
  function persistImported(mode, list){ return persistToKeys(mode, list, false); }

  window.ModeAtlasResultsStorage = { keys, normalize, persist, persistImported, RESULT_KEYS };
})();
