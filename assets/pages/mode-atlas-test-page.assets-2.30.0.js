(function ModeAtlasTestPage(){
  function start(){
    // Results render local data immediately. cloud-sync.js owns background
    // auth/hydration and emits a data-change event if remote results are applied.
    init();
  }

  function init(){
const ResultsUI = window.ModeAtlasResultsUI || {};
const REGULAR_ROW_GROUPS = ResultsUI.REGULAR_ROW_GROUPS || [];
const SPECIAL_ROW_GROUPS = ResultsUI.SPECIAL_ROW_GROUPS || [];
const ROW_GROUPS = ResultsUI.ROW_GROUPS || REGULAR_ROW_GROUPS;
const SPECIAL_CHAR_SET = ResultsUI.SPECIAL_CHAR_SET || new Set();
const computeRowPerformance = ResultsUI.computeRowPerformance || (() => ({ rows: [], hiragana: [], katakana: [] }));
const getRowCellExtremes = ResultsUI.getRowCellExtremes || (() => new Map());
const rowNeedsErrorStyling = ResultsUI.rowNeedsErrorStyling || ((row) => !!row && Number(row.wrong || 0) > 0);
const renderRowPerformanceNode = ResultsUI.renderRowPerformanceNode || null;
const formatDuration = ResultsUI.formatDuration || (() => "—");
const normalizeTestResult = ResultsUI.normalizeTestResult || (() => null);
const buildAverageResult = ResultsUI.buildAverageResult || (() => null);

const READING_TEST_KEYS = window.ModeAtlasResultsStorage.keys("reading");
const WRITING_TEST_KEYS = window.ModeAtlasResultsStorage.keys("writing");
const READING_TEST_RESULTS_STORAGE_KEY = READING_TEST_KEYS.primary;
const READING_TEST_RESULTS_STORAGE_BACKUP_KEY = READING_TEST_KEYS.backup;
const READING_TEST_RESULTS_UPDATED_AT_KEY = READING_TEST_KEYS.updatedAt;
const READING_TEST_RESULTS_ALT_STORAGE_KEY = READING_TEST_KEYS.altPrimary;
const READING_TEST_RESULTS_ALT_STORAGE_BACKUP_KEY = READING_TEST_KEYS.altBackup;
const READING_TEST_RESULTS_ALT_UPDATED_AT_KEY = READING_TEST_KEYS.altUpdatedAt;
const WRITING_TEST_RESULTS_STORAGE_KEY = WRITING_TEST_KEYS.primary;
const WRITING_TEST_RESULTS_STORAGE_BACKUP_KEY = WRITING_TEST_KEYS.backup;
const WRITING_TEST_RESULTS_UPDATED_AT_KEY = WRITING_TEST_KEYS.updatedAt;

function loadModeResultsFromKeys(keys, expectedMode) {
    if (window.ModeAtlasResultsEngine?.loadModeResultsFromKeys) {
        return window.ModeAtlasResultsEngine.loadModeResultsFromKeys(keys, expectedMode, normalizeTestResult);
    }
    return [];
}

function parseStoredResultTimestamp(result) {
    return window.ModeAtlasResultsEngine?.parseStoredResultTimestamp?.(result) || 0;
}

function loadStoredResults() {
    if (window.ModeAtlasResultsEngine?.loadStoredResults) {
        return window.ModeAtlasResultsEngine.loadStoredResults({
            readingKeys: [
                READING_TEST_RESULTS_STORAGE_KEY,
                READING_TEST_RESULTS_STORAGE_BACKUP_KEY,
                READING_TEST_RESULTS_ALT_STORAGE_KEY,
                READING_TEST_RESULTS_ALT_STORAGE_BACKUP_KEY
            ],
            writingKeys: [
                WRITING_TEST_RESULTS_STORAGE_KEY,
                WRITING_TEST_RESULTS_STORAGE_BACKUP_KEY,
                READING_TEST_RESULTS_STORAGE_KEY,
                READING_TEST_RESULTS_STORAGE_BACKUP_KEY,
                READING_TEST_RESULTS_ALT_STORAGE_KEY,
                READING_TEST_RESULTS_ALT_STORAGE_BACKUP_KEY
            ],
            normalizeTestResult,
            buildAverageResult
        });
    }
    return [];
}

let STORED_RESULTS = loadStoredResults();

let selectedResultId = STORED_RESULTS[0]?.id || null;
let selectedKana = null;
let hideUnusedKana = false;
let activeRowGraphView = "regular";

const HERO_STORED_TESTS = document.getElementById("heroStoredTests");
const HERO_BEST_SCORE = document.getElementById("heroBestScore");
const TESTS_GRID = document.getElementById("testsGrid");
const OVERALL_SCORE_CARD = document.getElementById("overallScoreCard");
const OVERALL_KICKER = document.getElementById("overallKicker");
const OVERALL_SELECTED_NAME = document.getElementById("overallSelectedName");
const OVERALL_SCORE = document.getElementById("overallScore");
const OVERALL_SUB = document.getElementById("overallSub");
const OVERALL_MODE = document.getElementById("overallMode");
const OVERALL_CORRECT = document.getElementById("overallCorrect");
const OVERALL_WRONG = document.getElementById("overallWrong");
const OVERALL_TIME = document.getElementById("overallTime");
const SNAPSHOT_BREAKDOWN = document.getElementById("snapshotBreakdown");
const ROW_PERFORMANCE_MOUNT = document.getElementById("rowPerformanceMount");
const DETAIL_TITLE = document.getElementById("detailTitle");
const DETAIL_SUB = document.getElementById("detailSub");
const DETAIL_METRICS = document.getElementById("detailMetrics");
const TEST_HEATMAP = document.getElementById("testHeatmap");


let DEBUG_PANEL = null;

function closeDebugPanel() {
    if (DEBUG_PANEL && DEBUG_PANEL.parentNode) {
        DEBUG_PANEL.parentNode.removeChild(DEBUG_PANEL);
    }
    DEBUG_PANEL = null;
}

function getDebugStorageKeysForMode(mode) {
    if (mode === "writing") {
        return [WRITING_TEST_RESULTS_STORAGE_KEY, WRITING_TEST_RESULTS_STORAGE_BACKUP_KEY];
    }
    return [
        READING_TEST_RESULTS_STORAGE_KEY,
        READING_TEST_RESULTS_STORAGE_BACKUP_KEY,
        READING_TEST_RESULTS_ALT_STORAGE_KEY,
        READING_TEST_RESULTS_ALT_STORAGE_BACKUP_KEY
    ];
}

function deleteStoredTest(testId, mode) {
    if (!testId) return;

    const storageKeys = [...new Set(getDebugStorageKeysForMode(mode))];
    storageKeys.forEach(key => {
        const current = loadJSON(key, []);
        if (!Array.isArray(current)) return;
        const filtered = current.filter(item => String(item?.id || "") !== String(testId));
        window.ModeAtlasStorage.setJSON(key, filtered);
    });

    STORED_RESULTS = loadStoredResults();

    if (!STORED_RESULTS.find(item => item.id === selectedResultId)) {
        selectedResultId = STORED_RESULTS[0]?.id || null;
        selectedKana = null;
    }

    renderAll();
    renderDebugPanel();
}

function getStorageKeyDebugInfo() {
    const keys = [
        READING_TEST_RESULTS_STORAGE_KEY,
        READING_TEST_RESULTS_STORAGE_BACKUP_KEY,
        READING_TEST_RESULTS_ALT_STORAGE_KEY,
        READING_TEST_RESULTS_ALT_STORAGE_BACKUP_KEY,
        WRITING_TEST_RESULTS_STORAGE_KEY,
        WRITING_TEST_RESULTS_STORAGE_BACKUP_KEY
    ];

    return [...new Set(keys)].map(key => {
        const raw = window.ModeAtlasStorage.get(key, null);
        let count = 0;
        let parseError = "";
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                count = Array.isArray(parsed) ? parsed.length : 0;
            } catch (err) {
                parseError = err && err.message ? err.message : "Invalid JSON";
            }
        }
        return {
            key,
            present: raw !== null,
            count,
            rawLength: raw ? raw.length : 0,
            parseError
        };
    });
}

function renderDebugPanel() {
    if (!DEBUG_PANEL) {
        DEBUG_PANEL = document.createElement("div");
        DEBUG_PANEL.id = "debugPanel";
        DEBUG_PANEL.style.position = "fixed";
        DEBUG_PANEL.style.right = "16px";
        DEBUG_PANEL.style.bottom = "16px";
        DEBUG_PANEL.style.zIndex = "9999";
        DEBUG_PANEL.style.width = "min(380px, calc(100vw - 32px))";
        DEBUG_PANEL.style.maxHeight = "70vh";
        DEBUG_PANEL.style.overflow = "auto";
        DEBUG_PANEL.style.padding = "14px";
        DEBUG_PANEL.style.borderRadius = "16px";
        DEBUG_PANEL.style.background = "rgba(12,12,12,0.96)";
        DEBUG_PANEL.style.border = "1px solid rgba(255,255,255,0.12)";
        DEBUG_PANEL.style.boxShadow = "0 16px 40px rgba(0,0,0,0.45)";
        DEBUG_PANEL.style.fontFamily = "Arial, sans-serif";
        DEBUG_PANEL.style.fontSize = "12px";
        DEBUG_PANEL.style.lineHeight = "1.45";
        DEBUG_PANEL.style.color = "#f3f3f3";
        document.body.appendChild(DEBUG_PANEL);
    }

    const readingResults = loadModeResultsFromKeys([
        READING_TEST_RESULTS_STORAGE_KEY,
        READING_TEST_RESULTS_STORAGE_BACKUP_KEY,
        READING_TEST_RESULTS_ALT_STORAGE_KEY,
        READING_TEST_RESULTS_ALT_STORAGE_BACKUP_KEY
    ], "reading");

    const writingResults = loadModeResultsFromKeys([
        WRITING_TEST_RESULTS_STORAGE_KEY,
        WRITING_TEST_RESULTS_STORAGE_BACKUP_KEY,
        READING_TEST_RESULTS_STORAGE_KEY,
        READING_TEST_RESULTS_STORAGE_BACKUP_KEY,
        READING_TEST_RESULTS_ALT_STORAGE_KEY,
        READING_TEST_RESULTS_ALT_STORAGE_BACKUP_KEY
    ], "writing");

    const testsOnly = STORED_RESULTS.filter(item => item.type !== "average");
    const keyInfo = getStorageKeyDebugInfo();

    const head = createResultEl("div", "storage-debug-head");
    head.append(createResultEl("div", "storage-debug-title", "Storage Debug"));
    const close = createResultEl("button", "storage-debug-close", "×");
    close.type = "button";
    close.id = "debugCloseBtn";
    head.append(close);

    const summary = createResultEl("div", "storage-debug-grid storage-debug-section");
    summary.append(
        storageDebugLine("Reading results", readingResults.length),
        storageDebugLine("Writing results", writingResults.length),
        storageDebugLine("Visible tests", testsOnly.length),
        storageDebugLine("Selected", selectedResultId || "—")
    );

    const keySection = createResultEl("div", "storage-debug-section");
    keySection.append(createResultEl("div", "storage-debug-card-title", "Storage keys"));
    const keyGrid = createResultEl("div", "storage-debug-key-grid");
    keyInfo.forEach(item => keyGrid.append(storageDebugCard(item)));
    keySection.append(keyGrid);

    const deleteSection = document.createElement("div");
    deleteSection.append(
        createResultEl("div", "storage-debug-card-title", "Delete saved tests"),
        createResultEl("div", "storage-debug-subtitle", "Only individual saved tests can be deleted here. Overall averages stay protected.")
    );

    const testGrid = createResultEl("div", "storage-debug-test-grid");
    if (testsOnly.length) {
        testsOnly.forEach(item => {
            const card = createResultEl("div", "storage-debug-card-small");
            const row = createResultEl("div", "storage-debug-test-row");
            const main = createResultEl("div", "storage-debug-test-main");
            main.append(
                createResultEl("div", "storage-debug-test-title", item.title),
                createResultEl("div", "storage-debug-test-meta", `${item.mode === "reading" ? "Reading" : "Writing"} · ${item.date} · ${item.startedAt}`),
                createResultEl("div", "storage-debug-test-id", item.id)
            );

            const deleteBtn = createResultEl("button", "debug-delete-btn storage-debug-delete-btn", "Delete");
            deleteBtn.type = "button";
            deleteBtn.dataset.testId = item.id;
            deleteBtn.dataset.testMode = item.mode;

            row.append(main, deleteBtn);
            card.append(row);
            testGrid.append(card);
        });
    } else {
        testGrid.append(createResultEl("div", "storage-debug-empty", "No individual tests to delete."));
    }
    deleteSection.append(testGrid);

    DEBUG_PANEL.replaceChildren(head, summary, keySection, deleteSection);

    DEBUG_PANEL.querySelector("#debugCloseBtn")?.addEventListener("click", closeDebugPanel);
    DEBUG_PANEL.querySelectorAll(".debug-delete-btn").forEach(button => {
        button.addEventListener("click", () => {
            const testId = button.dataset.testId;
            const mode = button.dataset.testMode;
            deleteStoredTest(testId, mode);
        });
    });
}

window.renderDebugPanel = renderDebugPanel;
window.closeDebugPanel = closeDebugPanel;
window.deleteStoredTest = deleteStoredTest;



function createResultEl(tag, className = "", text = "") {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== "") el.textContent = String(text);
    return el;
}

function createMegaInlineCard(label, value) {
    const card = createResultEl("div", "mega-inline-card ma-stat ma-card ma-card--flat");
    card.append(createResultEl("div", "label ma-stat__label", label), createResultEl("div", "value ma-stat__value", value));
    return card;
}

function createMetricCard(label, value) {
    const card = createResultEl("div", "metric ma-stat ma-card ma-card--flat");
    card.append(createResultEl("div", "label ma-stat__label", label), createResultEl("div", "value ma-stat__value", value));
    return card;
}

function renderMegaInlineCards(target, items) {
    target.replaceChildren(...items.map(([label, value]) => createMegaInlineCard(label, value)));
}

function renderMetricCards(target, items) {
    target.replaceChildren(...items.map(([label, value]) => createMetricCard(label, value)));
}

function createModalStat(label, value, valueClass = "") {
    const stat = createResultEl("div", "result-kana-stat ma-stat ma-card ma-card--flat");
    stat.append(createResultEl("div", "label ma-stat__label", label), createResultEl("div", valueClass ? `value ma-stat__value ${valueClass}` : "value ma-stat__value", value));
    return stat;
}

function renderRowPerformanceInto(result, viewMode = "regular") {
    if (typeof renderRowPerformanceNode === "function") {
        ROW_PERFORMANCE_MOUNT.replaceChildren(renderRowPerformanceNode(result, viewMode));
    } else {
        ROW_PERFORMANCE_MOUNT.replaceChildren();
    }
}

function storageDebugLine(label, value) {
    const row = document.createElement("div");
    row.append(createResultEl("strong", "", `${label}:`), document.createTextNode(` ${value}`));
    return row;
}

function storageDebugCard(item) {
    const card = createResultEl("div", "storage-debug-card-small");
    card.append(
        createResultEl("div", "storage-debug-key-title", item.key),
        createResultEl("div", "storage-debug-muted", `Present: ${item.present ? "yes" : "no"} · Items: ${item.count} · Raw length: ${item.rawLength}`)
    );
    if (item.parseError) card.append(createResultEl("div", "storage-debug-danger", `Parse error: ${item.parseError}`));
    return card;
}

function toTitleCase(value) {
    return String(value || "")
        .replace(/[_-]+/g, " ")
        .replace(/\w/g, char => char.toUpperCase());
}

function getResultTypeLabel(result) {
    if (!result) return "—";
    if (result.type === "average") {
        return result.mode === "reading" ? "Read Avg" : "Write Avg";
    }

    if (result.inputMode === "buttons") {
        const layout = result.buttonLayout ?? result.inputVariant;
        return layout ? `Buttons - ${layout}` : "Buttons";
    }

    if (result.inputMode === "keyboard") {
        const layout = result.keyboardLayout || result.inputVariant;
        return layout ? `Keyboard - ${toTitleCase(layout)}` : "Keyboard";
    }

    return result.mode === "reading" ? "Read" : "Write";
}

function getSelectedResult() {
    return STORED_RESULTS.find(item => item.id === selectedResultId) || null;
}

function getHeatColor(result, record) {
    if (!record) return "rgba(255,255,255,0.05)";

    if (result?.type === "average") {
        const correct = Number(record.correct || 0);
        const wrong = Number(record.wrong || 0);
        const attempts = correct + wrong;
        const ratio = attempts ? (correct / attempts) : 0;

        if (ratio >= 0.75) return "rgba(103,215,139,0.32)";
        if (ratio >= 0.50) return "rgba(255,210,102,0.30)";
        return "rgba(255,123,123,0.28)";
    }

    return (record.wrong || 0) > 0 ? "rgba(255,123,123,0.28)" : "rgba(103,215,139,0.32)";
}

function renderHero() {
    const testsOnly = STORED_RESULTS.filter(item => item.type !== "average");
    const best = testsOnly.length ? testsOnly.reduce((max, item) => Math.max(max, Number(item.overallScore || 0)), 0) : 0;

    if (HERO_STORED_TESTS) HERO_STORED_TESTS.textContent = String(testsOnly.length);
    if (HERO_BEST_SCORE) HERO_BEST_SCORE.textContent = testsOnly.length ? `${best}%` : "—";
}

function getModifierTags(result) {
    return [
        result.dakuten ? "Dakuten on" : "Dakuten off",
        result.yoon ? "Yōon on" : "Yōon off",
        result.extendedKatakana ? "Extended Katakana on" : "Extended Katakana off"
    ];
}

function createResultTile(item) {
    const button = createResultEl("button", `test-tile ma-card ma-card--flat ma-card--interactive ${item.mode} ${item.type === "average" ? "average" : ""} ${item.id === selectedResultId ? "active" : ""}`);
    button.type = "button";
    button.dataset.resultId = item.id;

    const top = createResultEl("div", "test-tile-top");
    const titleWrap = document.createElement("div");
    titleWrap.append(
        createResultEl("div", "test-title", item.title),
        createResultEl("div", "test-sub", `${item.date} · ${item.startedAt} · ${item.kanaAsked} kana shown`)
    );
    top.append(titleWrap, createResultEl("div", "test-score", `${item.overallScore}%`));

    const tagRow = createResultEl("div", "tag-row");
    if (item.type === "average") tagRow.append(createResultEl("span", "tag gold ma-pill ma-pill--small", "Overall Average"));
    getModifierTags(item).forEach(tag => tagRow.append(createResultEl("span", "tag gold ma-pill ma-pill--small", tag)));
    tagRow.append(createResultEl("span", "tag ma-pill ma-pill--small", `${item.correct} right / ${item.wrong} wrong`));

    button.append(top, tagRow);
    button.addEventListener("click", () => {
        selectedResultId = button.dataset.resultId;
        selectedKana = null;
        renderAll();
    });
    return button;
}

function renderResultsList() {
    if (!STORED_RESULTS.length) {
        TESTS_GRID.replaceChildren(createResultEl("div", "empty ma-card ma-empty-state", "No test results yet. Complete a test in Reading Practice or Writing Practice and it will appear here."));
        return;
    }
    TESTS_GRID.replaceChildren(...STORED_RESULTS.map(createResultTile));
}

function renderSnapshot(result) {
    OVERALL_KICKER.textContent = result.type === "average" ? "Selected overall average" : "Selected test score";
    OVERALL_SELECTED_NAME.textContent = result.title;
    OVERALL_SCORE.textContent = `${result.overallScore}%`;
    OVERALL_SUB.textContent = result.notes;
    OVERALL_MODE.textContent = getResultTypeLabel(result);
    OVERALL_CORRECT.textContent = result.correct;
    OVERALL_WRONG.textContent = result.wrong;
    OVERALL_TIME.textContent = formatDuration(result.durationMs);

    OVERALL_SCORE_CARD.classList.remove("reading", "writing", "average");
    if (result.type === "average") {
        OVERALL_SCORE_CARD.classList.add("average");
    } else if (result.mode === "reading") {
        OVERALL_SCORE_CARD.classList.add("reading");
    } else {
        OVERALL_SCORE_CARD.classList.add("writing");
    }

    renderRowPerformanceInto(result, activeRowGraphView);

    renderMegaInlineCards(SNAPSHOT_BREAKDOWN, [
        ["Hiragana", `${result.breakdown.hiragana.correct} / ${result.breakdown.hiragana.correct + result.breakdown.hiragana.wrong}`],
        ["Katakana", `${result.breakdown.katakana.correct} / ${result.breakdown.katakana.correct + result.breakdown.katakana.wrong}`],
        ["Dakuten", result.type === "average" ? (result.dakuten ? "Mixed" : "Off") : (result.dakuten ? "On" : "Off")],
        ["Yōon", result.type === "average" ? (result.yoon ? "Mixed" : "Off") : (result.yoon ? "On" : "Off")],
        ["Ext. Katakana", result.type === "average" ? (result.extendedKatakana ? "Mixed" : "Off") : (result.extendedKatakana ? "On" : "Off")],
        ["Kana shown", result.kanaAsked]
    ]);
}

function renderDetailHeader(result) {
    DETAIL_TITLE.textContent = result.title;
    DETAIL_SUB.textContent = `${result.mode === "reading" ? "Reading Practice" : "Writing Practice"} · ${result.type === "average" ? "Pinned summary" : result.date} · ${result.type === "average" ? "Click a kana for its average timing" : formatDuration(result.durationMs) + " total time"}`;
    renderMetricCards(DETAIL_METRICS, [
        ["Overall", `${result.overallScore}%`],
        ["Correct", `${result.correct}`],
        ["Wrong", `${result.wrong}`],
        ["Avg Time", `${formatDuration(result.avgMs)}`]
    ]);
    const hideBtn = document.getElementById("hideUnusedBtn");
    if (hideBtn) {
        hideBtn.classList.toggle("active", hideUnusedKana);
        hideBtn.textContent = hideUnusedKana ? "Show unused kana" : "Hide unused kana";
    }
}

function openKanaModal(result, kana) {
    const record = result.kana[kana];
    if (!record || !window.ModeAtlasDialog?.feature) return;
    const attempts = (record.correct || 0) + (record.wrong || 0);
    const accuracy = attempts ? Math.round((record.correct / attempts) * 100) : 0;
    const wasCorrect = (record.wrong || 0) === 0;

    const content = createResultEl("div", "result-kana-dialog");
    const kanaCard = createResultEl("div", "result-kana-card ma-card ma-card--flat");
    kanaCard.append(createResultEl("div", "char", kana), createResultEl("div", "romaji", record.romaji || "—"));
    const stats = createResultEl("div", "result-kana-stats");
    if (result.type === "average") {
        stats.append(
            createModalStat("Correct", record.correct || 0), createModalStat("Wrong", record.wrong || 0),
            createModalStat("Accuracy", `${accuracy}%`), createModalStat("Avg Time", formatDuration(record.avgMs))
        );
    } else {
        stats.append(
            createModalStat("Result", wasCorrect ? "Correct" : "Wrong", wasCorrect ? "result-answer-correct" : "result-answer-wrong"),
            createModalStat("Time", formatDuration(record.avgMs))
        );
    }
    content.append(kanaCard, stats);
    window.ModeAtlasDialog.feature({
        kicker: result.type === "average" ? "Average kana detail" : "Test kana detail",
        title: `${result.title} · ${kana}`,
        message: result.type === "average"
            ? `Average stats for ${result.mode === "reading" ? "Reading" : "Writing"}`
            : `Single test result for ${result.mode === "reading" ? "Reading" : "Writing"}`,
        contentNode: content,
        size: 'wide'
    });
}


function applyHeatmapCellColours(root = TEST_HEATMAP) {
    if (!root) return;
    root.querySelectorAll("[data-heat-color]").forEach(cell => {
        const colour = cell.dataset.heatColor || "";
        if (colour) cell.style.background = colour;
    });
}

function renderHeatmap(result) {
    const rowExtremes = getRowCellExtremes(result);
    const visibleGroups = REGULAR_ROW_GROUPS
        .map(row => {
            const rowEntries = row.chars.map(char => [char, result.kana?.[char]]).filter(([, record]) => record);
            const activeChars = hideUnusedKana ? rowEntries.map(([char]) => char) : row.chars;
            return { ...row, rowEntries, activeChars };
        })
        .filter(row => !hideUnusedKana || row.activeChars.length);

    const buildCell = (char, record, markers) => {
        if (!record) {
            const empty = createResultEl("div", "cell empty-slot");
            empty.setAttribute("aria-hidden", "true");

            if (!SPECIAL_CHAR_SET.has(char)) return empty;
            if (hideUnusedKana) return empty;

            const reference = createResultEl("div", "cell reference");
            reference.setAttribute("aria-label", `${char} not used in this test`);
            reference.append(createResultEl("div", "cell-char", char), createResultEl("div", "cell-time", "Off"));
            return reference;
        }

        const marker = markers[char];
        const button = createResultEl("button", `cell ${selectedKana === char ? "active" : ""}`.trim());
        button.type = "button";
        button.dataset.kana = char;
        button.dataset.heatColor = getHeatColor(result, record);

        if (marker) button.append(createResultEl("span", `cell-badge ${marker}`, marker === "fastest" ? "Fastest" : "Slowest"));
        button.append(createResultEl("div", "cell-char", char), createResultEl("div", "cell-time", formatDuration(record.avgMs)));
        button.addEventListener("click", () => {
            selectedKana = button.dataset.kana;
            renderHeatmap(result);
            openKanaModal(result, selectedKana);
        });
        return button;
    };

    const groups = visibleGroups.map(row => {
        const markers = rowExtremes.get(`${row.script}:${row.key}`) || {};
        const group = createResultEl("div", "heatmap-row-group");
        group.append(createResultEl("div", "heatmap-row-label", `${row.key} Row`));

        for (let i = 0; i < row.activeChars.length; i += 5) {
            const slice = row.activeChars.slice(i, i + 5);
            while (slice.length < 5) slice.push(null);

            const rowCells = createResultEl("div", "heatmap-row-cells");
            slice.forEach(char => {
                if (char) rowCells.append(buildCell(char, result.kana?.[char], markers));
                else {
                    const empty = createResultEl("div", "cell empty-slot");
                    empty.setAttribute("aria-hidden", "true");
                    rowCells.append(empty);
                }
            });
            group.append(rowCells);
        }

        return group;
    });

    TEST_HEATMAP.replaceChildren(...groups);
    applyHeatmapCellColours(TEST_HEATMAP);
}

function renderAll() {
    STORED_RESULTS = loadStoredResults();
    if (!STORED_RESULTS.some(item => item.id === selectedResultId)) {
        selectedResultId = STORED_RESULTS[0]?.id || null;
        selectedKana = null;
    }
    const result = getSelectedResult();
    renderHero();
    renderResultsList();
    if (!result) {
        OVERALL_KICKER.textContent = "Selected result score";
        OVERALL_SELECTED_NAME.textContent = "No test results yet";
        OVERALL_SCORE.textContent = "—";
        OVERALL_SUB.textContent = "This page is ready for saved data from Test Mode in Reading Practice and Writing Practice.";
        OVERALL_MODE.textContent = "—";
        OVERALL_CORRECT.textContent = "0";
        OVERALL_WRONG.textContent = "0";
        OVERALL_TIME.textContent = "—";
        OVERALL_SCORE_CARD.classList.remove("reading", "writing");
        OVERALL_SCORE_CARD.classList.add("average");
        renderMegaInlineCards(SNAPSHOT_BREAKDOWN, [
            ["Reading tests", "0"],
            ["Writing tests", "0"],
            ["Overall averages", "Pending"],
            ["Status", "Ready for Test Mode"]
        ]);
        ROW_PERFORMANCE_MOUNT.replaceChildren();
        DETAIL_TITLE.textContent = "No result selected";
        DETAIL_SUB.textContent = "Complete a test to populate this page.";
        DETAIL_METRICS.replaceChildren();
        const hideBtn = document.getElementById("hideUnusedBtn");
        if (hideBtn) { hideBtn.classList.remove("active"); hideBtn.textContent = "Hide unused kana"; }
        TEST_HEATMAP.replaceChildren(createResultEl("div", "empty test-heatmap-empty ma-card ma-empty-state", "No kana data yet."));
        return;
    }
    renderSnapshot(result);
    renderDetailHeader(result);
    renderHeatmap(result);
    drawRowCharts(result, activeRowGraphView);
    bindRowInteractions(result);
    const hideBtn = document.getElementById("hideUnusedBtn");
    if (hideBtn) {
        hideBtn.onclick = () => {
            hideUnusedKana = !hideUnusedKana;
            renderDetailHeader(result);
            renderHeatmap(result);
        };
    }
    // row view toggle is handled by a single delegated listener below
}



function findRowPerformanceEntry(result, script, key) {
    const perf = computeRowPerformance(result, activeRowGraphView === "special" ? SPECIAL_ROW_GROUPS : REGULAR_ROW_GROUPS, activeRowGraphView === "special");
    return perf.rows.find(row => row.script === script && row.key === key) || null;
}

function updateRowTooltip(result, script, key) {
    const overlay = document.getElementById("rowTooltipOverlay");
    const card = document.getElementById("rowTooltipCard");
    if (!overlay || !card) return;
    const row = findRowPerformanceEntry(result, script, key);
    if (!row) {
        overlay.classList.remove("show");
        return;
    }
    const title = createResultEl("div", "title", row.key);
    const sub = createResultEl("div", "sub");
    if (row.isOff) {
        sub.textContent = "Modifier off for this result";
    } else {
        sub.append(
            document.createTextNode(`Right: ${row.correct} · Wrong: ${row.wrong}`),
            document.createElement("br"),
            document.createTextNode(`Avg time: ${formatDuration(row.avgMs)}`)
        );
    }
    card.replaceChildren(title, sub);
    overlay.classList.add("show");
}

function bindRowInteractions(result) {
    const cards = document.querySelectorAll(".row-doughnut-card");
    const overlay = document.getElementById("rowTooltipOverlay");
    let locked = false;
    let activeCard = null;

    const clearActive = () => {
        cards.forEach(c => c.classList.remove("active"));
        activeCard = null;
    };

    const closeOverlay = () => {
        locked = false;
        clearActive();
        if (overlay) overlay.classList.remove("show");
    };

    cards.forEach(card => {
        card.addEventListener("mouseenter", () => {
            if (locked) return;
            updateRowTooltip(result, card.dataset.rowScript, card.dataset.rowKey);
        });

        card.addEventListener("mouseleave", () => {
            if (locked) return;
            if (overlay) overlay.classList.remove("show");
        });

        card.addEventListener("click", (e) => {
            e.stopPropagation();
            if (activeCard === card && locked) {
                closeOverlay();
                return;
            }
            locked = true;
            clearActive();
            activeCard = card;
            card.classList.add("active");
            updateRowTooltip(result, card.dataset.rowScript, card.dataset.rowKey);
        });
    });

    document.onclick = () => {
        closeOverlay();
    };
}
function drawRowCharts(result, viewMode = activeRowGraphView) {
    const perf = computeRowPerformance(result, viewMode === "special" ? SPECIAL_ROW_GROUPS : REGULAR_ROW_GROUPS, viewMode === "special");

    const drawSet = (rows, prefix, bestRow, worstRow) => {
        rows.forEach((row, index) => {
            const canvas = document.getElementById(`chart-${prefix}-${index}`);
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            const size = canvas.width || 70;
            const cx = size / 2;
            const cy = size / 2;
            const radius = 24;
            const lineWidth = 8;
            const correct = Math.max(0, Math.min(100, row.accuracy));
            const offState = !!row.isOff;

            ctx.clearRect(0, 0, size, size);

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255,255,255,0.08)";
            ctx.lineWidth = lineWidth;
            ctx.stroke();

            if (!offState) {
                ctx.beginPath();
                ctx.arc(cx, cy, radius, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2) * (correct / 100));
                let stroke = correct >= 80 ? "#67d78b" : correct >= 60 ? "#cba34a" : "#ff7b7b";
                if (bestRow && bestRow.key === row.key) stroke = "#67d78b";
                if (worstRow && worstRow.key === row.key) {
                    stroke = rowNeedsErrorStyling(row) ? "#ff7b7b" : "#cba34a";
                }
                ctx.strokeStyle = stroke;
                ctx.lineWidth = lineWidth;
                ctx.lineCap = "round";
                ctx.stroke();
            }

            ctx.fillStyle = offState ? "rgba(255,255,255,0.5)" : "#f3f3f3";
            ctx.font = `700 ${offState ? 11 : 12}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(offState ? "Off" : `${correct}%`, cx, cy);
        });
    };

    drawSet(perf.hiragana, viewMode === "special" ? "sh" : "h", perf.hiraganaBest, perf.hiraganaWorst);
    drawSet(perf.katakana, viewMode === "special" ? "sk" : "k", perf.katakanaBest, perf.katakanaWorst);
}


ROW_PERFORMANCE_MOUNT.addEventListener("click", (event) => {
    const toggleBtn = event.target.closest(".row-view-btn");
    if (!toggleBtn) return;
    event.stopPropagation();
    const selected = getSelectedResult();
    if (!selected) return;
    activeRowGraphView = toggleBtn.dataset.rowView === "special" ? "special" : "regular";
    renderRowPerformanceInto(selected, activeRowGraphView);
    drawRowCharts(selected, activeRowGraphView);
    bindRowInteractions(selected);
});


function requestResultsRender(source = "unknown") {
    try { window.ModeAtlasLifecycle?.emit?.("results-render", { source }); } catch {}
    renderAll();
}

document.addEventListener("ma:results-render", () => {
    const selected = getSelectedResult();
    if (selected) drawRowCharts(selected, activeRowGraphView);
});

renderAll();
requestAnimationFrame(() => {
    const selected = getSelectedResult();
    if (selected) drawRowCharts(selected, activeRowGraphView);
});

document.addEventListener("ma:ui-refresh", () => requestResultsRender("ui-refresh"));
window.addEventListener("modeAtlasCloudDataChanged", (event) => {
    const sections = Array.isArray(event.detail?.sections) ? event.detail.sections : [];
    if (!sections.length || sections.includes("readingTests") || sections.includes("writingTests")) {
        requestResultsRender("cloud-data");
    }
});
window.addEventListener("pageshow", (event) => {
    if (event.persisted === true) requestResultsRender("bfcache-restore");
});
window.addEventListener("storage", (event) => {
    const watchedKeys = new Set([
        READING_TEST_RESULTS_STORAGE_KEY,
        READING_TEST_RESULTS_STORAGE_BACKUP_KEY,
        READING_TEST_RESULTS_UPDATED_AT_KEY,
        READING_TEST_RESULTS_ALT_STORAGE_KEY,
        READING_TEST_RESULTS_ALT_STORAGE_BACKUP_KEY,
        READING_TEST_RESULTS_ALT_UPDATED_AT_KEY,
        WRITING_TEST_RESULTS_STORAGE_KEY,
        WRITING_TEST_RESULTS_STORAGE_BACKUP_KEY,
        WRITING_TEST_RESULTS_UPDATED_AT_KEY,
        "testModeResults",
        "kanaTrainerTestModeResults",
        "testModeResultsUpdatedAt",
        "readingTestModeResults",
        "kanaTrainerReadingTestModeResults",
        "readingTestModeResultsUpdatedAt",
        "writingTestModeResults",
        "kanaTrainerWritingTestModeResults",
        "writingTestModeResultsUpdatedAt"
    ]);
    if (!event.key || watchedKeys.has(event.key)) {
        requestResultsRender("storage");
    }
});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
