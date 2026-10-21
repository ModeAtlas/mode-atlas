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

  function normalize(list, mode){ return window.ModeAtlasSaveMerge.testRecords(list, mode); }

  function persistToKeys(mode, list, markCloud){
    const cfg = keys(mode);
    const safeList = normalize(list, mode);
    const payload = JSON.stringify(safeList);
    store().transaction(()=>{
    if(markCloud){
      const deleted=store().json('modeAtlasResultsDeleted:'+mode,{}),ids=new Set(safeList.map(row=>row.id));
      for(const row of read(mode))if(row.id&&!ids.has(row.id))deleted[row.id]=Date.now();
      store().setJSON('modeAtlasResultsDeleted:'+mode,deleted);
    }
    if(!write(cfg.primary,payload))throw Error('This result could not be saved.');
    [cfg.backup,cfg.altPrimary,cfg.altBackup].filter(Boolean).forEach(key=>store().remove(key));
    });
    const ts = String(Date.now());
    [cfg.updatedAt, cfg.altUpdatedAt].filter(Boolean).forEach(key => write(key, ts));
    if (markCloud) {
      window.KanaCloudSync?.markSectionUpdated(cfg.cloudSection);
      window.KanaCloudSync?.scheduleSync();
    }
    return safeList;
  }

  const cache=new Map();
  function read(mode){
    const cfg=keys(mode),all=[cfg.primary,cfg.backup,cfg.altPrimary,cfg.altBackup,'modeAtlasResultsDeleted:'+mode].filter(Boolean),raw=all.map(key=>store().get(key,null)),cached=cache.get(mode);
    if(cached&&raw.every((value,i)=>value===cached.raw[i]))return cached.rows.map(row=>({...row}));
    const deleted=store().json('modeAtlasResultsDeleted:'+mode,{});
    const lists=[cfg.primary,cfg.backup,cfg.altPrimary,cfg.altBackup].filter(Boolean).flatMap(key=>normalize(store().json(key,[]),mode));
    const rows=window.ModeAtlasSaveMerge.records(lists,[],deleted);
    const encoded=JSON.stringify(rows);
    if(lists.length && store().get(cfg.primary,'')!==encoded && !store().set(cfg.primary,encoded))throw Error('Test history could not be migrated. Your original results are still here.');
    if(lists.length)[cfg.backup,cfg.altPrimary,cfg.altBackup].filter(Boolean).forEach(key=>{if(store().get(key,null)!==null)store().remove(key);});
    cache.set(mode,{raw:all.map(key=>store().get(key,null)),rows});
    return rows.map(row=>({...row}));
  }
  function persist(mode, list){ return persistToKeys(mode, list, true); }
  function persistImported(mode, list){ return persistToKeys(mode, list, false); }

  window.addEventListener('modeAtlasAccountWillChange',()=>cache.clear());
  window.addEventListener('modeAtlasDataCleared',()=>cache.clear());
  window.ModeAtlasResultsStorage = { keys, normalize, read, persist, persistImported, RESULT_KEYS };
})();
