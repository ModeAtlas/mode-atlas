(function(){
  "use strict";

  function saveTrainerState(config){
    const cfg = config || {};
    const section = cfg.section || "reading";
    const mode = cfg.mode || (section === "writing" ? "writing" : "reading");
    const Store = window.ModeAtlasStorage;
    try { window.KanaCloudSync?.markSectionUpdated?.(section); } catch {}

    const writeJson = (name, value) => {
      if (!Store.writeModeJSON(mode, name, value)) console.warn("Mode Atlas save failed", mode, name);
    };

    writeJson("settings", cfg.settings || {});
    writeJson("charStats", cfg.stats || {});
    writeJson("charTimes", cfg.times || {});
    writeJson("srs", cfg.srs || {});
    writeJson("scoreHistory", cfg.scoreHistory || {});
    writeJson("dailyHistory", cfg.dailyChallengeHistory || {});
    Store.writeModeNumber(mode, "highScore", Number(cfg.highScore || 0));

    try { window.KanaCloudSync?.scheduleSync?.(); } catch {}
  }

  function buildDailySequence(options){
    const cfg = options || {};
    const map = cfg.poolMap || window.DAILY_CHALLENGE_CHAR_MAP || {};
    const pool = Object.keys(map);
    const count = Number(cfg.count || 20);
    const seed = String(cfg.seed || `daily:${cfg.dateKey || ""}`);
    const rng = typeof cfg.rngFactory === "function"
      ? cfg.rngFactory(seed)
      : (typeof window.createSeededRng === "function" ? window.createSeededRng(seed) : Math.random);
    const sequence = [];
    if (!pool.length) return sequence;
    for (let i = 0; i < count; i++) sequence.push(pool[Math.floor(rng() * pool.length)]);
    return sequence;
  }

  function normalizeTestResults(mode, list){
    return window.ModeAtlasResultsStorage?.normalize
      ? window.ModeAtlasResultsStorage.normalize(list, mode)
      : (Array.isArray(list) ? list : []);
  }

  function persistTestResults(mode, list){
    return window.ModeAtlasResultsStorage?.persist
      ? window.ModeAtlasResultsStorage.persist(mode, list)
      : list;
  }

  function buildTestResult(config){
    const cfg = config || {};
    const mode = cfg.mode || "reading";
    const now = Date.now();
    const total = Number(cfg.total || 0);
    const correct = Number(cfg.correct || 0);
    const titleMode = mode === "writing" ? "Writing" : "Reading";
    const result = {
      id: `${mode}-test-${now}`,
      type: "test",
      title: `${titleMode} Test #${new Date().toLocaleDateString()}`,
      mode,
      date: window.ModeAtlasDates?.localDateKey?.(new Date()) || new Date().toLocaleDateString('en-CA'),
      startedAt: cfg.startedAt || new Date(Number(cfg.startTime || now)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      overallScore: total ? Math.round((correct / total) * 100) : 0,
      correct,
      wrong: Number(cfg.wrong || 0),
      total,
      durationMs: Number(cfg.durationMs || 0),
      avgMs: Number(cfg.avgMs || 0),
      dakuten: !!cfg.dakuten,
      yoon: !!cfg.yoon,
      extendedKatakana: !!cfg.extendedKatakana,
      kanaAsked: Number(cfg.kanaAsked || 0),
      notes: cfg.notes || `Full shuffled ${mode} test run.`,
      breakdown: cfg.breakdown || {},
      kana: cfg.kana || {}
    };
    if (mode === "writing") {
      result.inputMode = cfg.inputMode || "buttons";
      result.inputVariant = cfg.inputVariant || "4";
      result.buttonLayout = cfg.buttonLayout ?? null;
      result.keyboardLayout = cfg.keyboardLayout || "";
    }
    return result;
  }

  function createStatCard(label, value){
    const card = document.createElement("div");
    card.className = "stat-card";
    const labelEl = document.createElement("div");
    labelEl.className = "label";
    labelEl.textContent = String(label);
    const valueEl = document.createElement("div");
    valueEl.className = "value";
    valueEl.textContent = String(value);
    card.append(labelEl, valueEl);
    return card;
  }


  function renderStatCardsInto(container, pairs){
    if (!container) return;
    container.replaceChildren(...(pairs || []).map(([label, value]) => createStatCard(label, value)));
  }



  function saveTestModeResult(config){
    const cfg = config || {};
    const mode = cfg.mode || "reading";
    const sessionStats = cfg.sessionStats || {};
    const testSequence = Array.isArray(cfg.testSequence) ? cfg.testSequence : [];
    const settings = cfg.settings || {};
    const durationMs = Math.max(0, Date.now() - Number(cfg.testStartTime || Date.now()));
    const correct = Number(cfg.correct || 0);
    const wrong = Number(cfg.wrong || 0);
    const total = Number(sessionStats.answered || (correct + wrong));
    const result = buildTestResult({
      mode,
      startTime: cfg.testStartTime,
      correct,
      wrong,
      total,
      durationMs,
      avgMs: Array.isArray(sessionStats.timings) && sessionStats.timings.length
        ? Math.round(sessionStats.timings.reduce((sum, value) => sum + Number(value || 0), 0) / sessionStats.timings.length)
        : 0,
      dakuten: settings.dakuten,
      yoon: settings.yoon,
      extendedKatakana: settings.extendedKatakana,
      kanaAsked: testSequence.length,
      notes: cfg.notes || `Full shuffled ${mode} test run.`,
      breakdown: typeof cfg.buildBreakdown === "function" ? cfg.buildBreakdown() : {},
      kana: typeof cfg.buildKanaResults === "function" ? cfg.buildKanaResults() : {},
      inputMode: cfg.inputMode,
      inputVariant: cfg.inputVariant,
      buttonLayout: cfg.buttonLayout,
      keyboardLayout: cfg.keyboardLayout
    });
    const list = typeof cfg.loadResults === "function" ? cfg.loadResults() : [];
    list.unshift(result);
    if (typeof cfg.persistResults === "function") cfg.persistResults(list);
    else persistTestResults(mode, list);
    window.ModeAtlasProgress?.awardOnce?.(`kana.${mode}.testComplete`, result.id);
    return result;
  }


  window.ModeAtlasTrainerCore = Object.assign(window.ModeAtlasTrainerCore || {}, {
    saveTrainerState,
    buildDailySequence,
    normalizeTestResults,
    persistTestResults,
    buildTestResult,
    renderStatCardsInto,
    saveTestModeResult
  });
})();
