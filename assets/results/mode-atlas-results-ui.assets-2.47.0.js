(function(){
  if (window.ModeAtlasResultsUI) return;

const {
    hiraganaRows: HIRAGANA_ROWS,
    katakanaRows: KATAKANA_ROWS,
    dakutenRows: DAKUTEN_ROWS,
    yoonRows: YOON_ROWS,
    extendedKatakanaRows: EXTENDED_KATAKANA_ROWS
} = window.ModeAtlasKanaData || {};

const REGULAR_ROW_GROUPS = [
    { script: "hiragana", key: "あ", chars: [...Object.keys(HIRAGANA_ROWS.h_a)] },
    { script: "hiragana", key: "か", chars: [...Object.keys(HIRAGANA_ROWS.h_ka), ...Object.keys(DAKUTEN_ROWS.h_ka), ...Object.keys(YOON_ROWS.h_ka), ...Object.keys(YOON_ROWS.h_ka_dakuten)] },
    { script: "hiragana", key: "さ", chars: [...Object.keys(HIRAGANA_ROWS.h_sa), ...Object.keys(DAKUTEN_ROWS.h_sa), ...Object.keys(YOON_ROWS.h_sa), ...Object.keys(YOON_ROWS.h_sa_dakuten)] },
    { script: "hiragana", key: "た", chars: [...Object.keys(HIRAGANA_ROWS.h_ta), ...Object.keys(DAKUTEN_ROWS.h_ta), ...Object.keys(YOON_ROWS.h_ta), ...Object.keys(YOON_ROWS.h_ta_dakuten)] },
    { script: "hiragana", key: "な", chars: [...Object.keys(HIRAGANA_ROWS.h_na), ...Object.keys(YOON_ROWS.h_na)] },
    { script: "hiragana", key: "は", chars: [...Object.keys(HIRAGANA_ROWS.h_ha), ...Object.keys(DAKUTEN_ROWS.h_ha), ...Object.keys(YOON_ROWS.h_ha)] },
    { script: "hiragana", key: "ま", chars: [...Object.keys(HIRAGANA_ROWS.h_ma), ...Object.keys(YOON_ROWS.h_ma)] },
    { script: "hiragana", key: "や", chars: [...Object.keys(HIRAGANA_ROWS.h_ya)] },
    { script: "hiragana", key: "ら", chars: [...Object.keys(HIRAGANA_ROWS.h_ra), ...Object.keys(YOON_ROWS.h_ra)] },
    { script: "hiragana", key: "わ", chars: [...Object.keys(HIRAGANA_ROWS.h_wa)] },

    { script: "katakana", key: "ア", chars: [...Object.keys(KATAKANA_ROWS.k_a), ...Object.keys(EXTENDED_KATAKANA_ROWS.k_a)] },
    { script: "katakana", key: "カ", chars: [...Object.keys(KATAKANA_ROWS.k_ka), ...Object.keys(DAKUTEN_ROWS.k_ka), ...Object.keys(YOON_ROWS.k_ka), ...Object.keys(YOON_ROWS.k_ka_dakuten)] },
    { script: "katakana", key: "サ", chars: [...Object.keys(KATAKANA_ROWS.k_sa), ...Object.keys(DAKUTEN_ROWS.k_sa), ...Object.keys(YOON_ROWS.k_sa), ...Object.keys(YOON_ROWS.k_sa_dakuten), ...Object.keys(EXTENDED_KATAKANA_ROWS.k_sa)] },
    { script: "katakana", key: "タ", chars: [...Object.keys(KATAKANA_ROWS.k_ta), ...Object.keys(DAKUTEN_ROWS.k_ta), ...Object.keys(YOON_ROWS.k_ta), ...Object.keys(YOON_ROWS.k_ta_dakuten), ...Object.keys(EXTENDED_KATAKANA_ROWS.k_ta)] },
    { script: "katakana", key: "ナ", chars: [...Object.keys(KATAKANA_ROWS.k_na), ...Object.keys(YOON_ROWS.k_na)] },
    { script: "katakana", key: "ハ", chars: [...Object.keys(KATAKANA_ROWS.k_ha), ...Object.keys(DAKUTEN_ROWS.k_ha), ...Object.keys(YOON_ROWS.k_ha), ...Object.keys(EXTENDED_KATAKANA_ROWS.k_ha)] },
    { script: "katakana", key: "マ", chars: [...Object.keys(KATAKANA_ROWS.k_ma), ...Object.keys(YOON_ROWS.k_ma)] },
    { script: "katakana", key: "ヤ", chars: [...Object.keys(KATAKANA_ROWS.k_ya)] },
    { script: "katakana", key: "ラ", chars: [...Object.keys(KATAKANA_ROWS.k_ra), ...Object.keys(YOON_ROWS.k_ra)] },
    { script: "katakana", key: "ワ", chars: [...Object.keys(KATAKANA_ROWS.k_wa), ...Object.keys(EXTENDED_KATAKANA_ROWS.k_wa)] }
];

const SPECIAL_ROW_GROUPS = [
    { script: "hiragana_special", key: "か Dakuten", chars: [...Object.keys(DAKUTEN_ROWS.h_ka)] },
    { script: "hiragana_special", key: "さ Dakuten", chars: [...Object.keys(DAKUTEN_ROWS.h_sa)] },
    { script: "hiragana_special", key: "た Dakuten", chars: [...Object.keys(DAKUTEN_ROWS.h_ta)] },
    { script: "hiragana_special", key: "は Dakuten", chars: [...Object.keys(DAKUTEN_ROWS.h_ha)] },
    { script: "hiragana_special", key: "か Yōon", chars: [...Object.keys(YOON_ROWS.h_ka), ...Object.keys(YOON_ROWS.h_ka_dakuten)] },
    { script: "hiragana_special", key: "さ Yōon", chars: [...Object.keys(YOON_ROWS.h_sa), ...Object.keys(YOON_ROWS.h_sa_dakuten)] },
    { script: "hiragana_special", key: "た Yōon", chars: [...Object.keys(YOON_ROWS.h_ta), ...Object.keys(YOON_ROWS.h_ta_dakuten)] },
    { script: "hiragana_special", key: "な Yōon", chars: [...Object.keys(YOON_ROWS.h_na)] },
    { script: "hiragana_special", key: "は Yōon", chars: [...Object.keys(YOON_ROWS.h_ha)] },
    { script: "hiragana_special", key: "ま Yōon", chars: [...Object.keys(YOON_ROWS.h_ma)] },
    { script: "hiragana_special", key: "ら Yōon", chars: [...Object.keys(YOON_ROWS.h_ra)] },

    { script: "katakana_special", key: "カ Dakuten", chars: [...Object.keys(DAKUTEN_ROWS.k_ka)] },
    { script: "katakana_special", key: "サ Dakuten", chars: [...Object.keys(DAKUTEN_ROWS.k_sa)] },
    { script: "katakana_special", key: "タ Dakuten", chars: [...Object.keys(DAKUTEN_ROWS.k_ta)] },
    { script: "katakana_special", key: "ハ Dakuten", chars: [...Object.keys(DAKUTEN_ROWS.k_ha)] },
    { script: "katakana_special", key: "カ Yōon", chars: [...Object.keys(YOON_ROWS.k_ka), ...Object.keys(YOON_ROWS.k_ka_dakuten)] },
    { script: "katakana_special", key: "サ Yōon", chars: [...Object.keys(YOON_ROWS.k_sa), ...Object.keys(YOON_ROWS.k_sa_dakuten)] },
    { script: "katakana_special", key: "タ Yōon", chars: [...Object.keys(YOON_ROWS.k_ta), ...Object.keys(YOON_ROWS.k_ta_dakuten)] },
    { script: "katakana_special", key: "ナ Yōon", chars: [...Object.keys(YOON_ROWS.k_na)] },
    { script: "katakana_special", key: "ハ Yōon", chars: [...Object.keys(YOON_ROWS.k_ha)] },
    { script: "katakana_special", key: "マ Yōon", chars: [...Object.keys(YOON_ROWS.k_ma)] },
    { script: "katakana_special", key: "ラ Yōon", chars: [...Object.keys(YOON_ROWS.k_ra)] },
    { script: "katakana_special", key: "ア Ext", chars: [...Object.keys(EXTENDED_KATAKANA_ROWS.k_a)] },
    { script: "katakana_special", key: "サ Ext", chars: [...Object.keys(EXTENDED_KATAKANA_ROWS.k_sa)] },
    { script: "katakana_special", key: "タ Ext", chars: [...Object.keys(EXTENDED_KATAKANA_ROWS.k_ta)] },
    { script: "katakana_special", key: "ハ Ext", chars: [...Object.keys(EXTENDED_KATAKANA_ROWS.k_ha)] },
    { script: "katakana_special", key: "ワ Ext", chars: [...Object.keys(EXTENDED_KATAKANA_ROWS.k_wa)] }
];

const ROW_GROUPS = REGULAR_ROW_GROUPS;

function getSpecialModifierType(rowKey = "") {
    if (rowKey.includes("Dakuten")) return "dakuten";
    if (rowKey.includes("Yōon")) return "yoon";
    if (rowKey.includes("Ext")) return "extendedKatakana";
    return "";
}

function isModifierEnabledForResult(result, modifierType) {
    if (modifierType === "dakuten") return !!result.dakuten;
    if (modifierType === "yoon") return !!result.yoon;
    if (modifierType === "extendedKatakana") return !!result.extendedKatakana;
    return true;
}

function computeRowPerformance(result, groups = REGULAR_ROW_GROUPS, includeEmpty = false) {
    const rows = groups.map(row => {
        const items = row.chars
            .filter(ch => result.kana[ch])
            .map(ch => ({ ch, ...result.kana[ch] }));

        const correct = items.reduce((sum, item) => sum + (item.correct || 0), 0);
        const wrong = items.reduce((sum, item) => sum + (item.wrong || 0), 0);
        const total = correct + wrong;
        const avgMs = items.length
            ? Math.round(items.reduce((sum, item) => sum + (item.avgMs || 0), 0) / items.length)
            : 0;
        const accuracy = total ? Math.round((correct / total) * 100) : 0;
        const modifierType = getSpecialModifierType(row.key);
        const modifierEnabled = isModifierEnabledForResult(result, modifierType);

        return {
            script: row.script,
            key: row.key,
            correct,
            wrong,
            total,
            accuracy,
            avgMs,
            modifierType,
            modifierEnabled,
            isOff: !!modifierType && !modifierEnabled,
            score: total ? (accuracy - (avgMs / 1000) * 4) : -Infinity
        };
    }).filter(row => includeEmpty || row.total > 0);

    const hiragana = rows.filter(row => row.script.startsWith("hiragana"));
    const katakana = rows.filter(row => row.script.startsWith("katakana"));

    const ranked = items => items.filter(item => item.total > 0);
    const pickWorst = (items) => ranked(items).length ? [...ranked(items)].sort((a, b) => (a.score - b.score) || (b.wrong - a.wrong) || (b.avgMs - a.avgMs))[0] : null;
    const pickBest = (items) => ranked(items).length ? [...ranked(items)].sort((a, b) => (b.score - a.score) || (a.wrong - b.wrong) || (a.avgMs - b.avgMs))[0] : null;

    return {
        rows,
        hiragana,
        katakana,
        hiraganaWorst: pickWorst(hiragana),
        hiraganaBest: pickBest(hiragana),
        katakanaWorst: pickWorst(katakana),
        katakanaBest: pickBest(katakana)
    };
}


function rowNeedsErrorStyling(row) {
    return !!row && Number(row.wrong || 0) > 0;
}

function getRowBadgeType(row, bestRow, worstRow) {
    if (bestRow && bestRow.key === row.key) return { className: "best", label: "Best" };
    if (worstRow && worstRow.key === row.key) {
        return rowNeedsErrorStyling(row)
            ? { className: "worst", label: "Worst" }
            : { className: "slowest", label: "Slowest" };
    }
    return null;
}

function getRowCellExtremes(result) {
    const map = new Map();
    ROW_GROUPS.forEach(row => {
        const items = row.chars
            .filter(ch => result.kana && result.kana[ch])
            .map(ch => ({ char: ch, record: result.kana[ch] }))
            .filter(item => Number.isFinite(Number(item.record?.avgMs)) && Number(item.record.avgMs) > 0);

        if (!items.length) return;

        let fastest = items[0];
        let slowest = items[0];
        items.forEach(item => {
            if (Number(item.record.avgMs) < Number(fastest.record.avgMs)) fastest = item;
            if (Number(item.record.avgMs) > Number(slowest.record.avgMs)) slowest = item;
        });

        const byChar = {};
        if (fastest) byChar[fastest.char] = 'fastest';
        if (slowest) byChar[slowest.char] = fastest && fastest.char === slowest.char ? 'fastest' : 'slowest';
        map.set(`${row.script}:${row.key}`, byChar);
    });
    return map;
}

function makeResultNode(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== "") node.textContent = String(text);
    return node;
}

function renderRowPerformanceNode(result, viewMode = "regular") {
    const groups = viewMode === "special" ? SPECIAL_ROW_GROUPS : REGULAR_ROW_GROUPS;
    const perf = computeRowPerformance(result, groups, viewMode === "special");

    const leftTitle = viewMode === "special" ? "Hiragana modifier rows" : "Hiragana rows";
    const rightTitle = viewMode === "special" ? "Katakana modifier rows" : "Katakana rows";

    const renderSection = (title, rows, prefix, bestRow, worstRow) => {
        const section = makeResultNode("div", "row-performance-section");
        const head = makeResultNode("div", "row-performance-head");
        head.append(makeResultNode("span", "", title), makeResultNode("span", "results-hover-hint", "Hover or click a row"));

        const strip = makeResultNode("div", "row-doughnut-strip");
        rows.forEach((row, index) => {
            const badge = getRowBadgeType(row, bestRow, worstRow);
            const button = makeResultNode("button", `row-doughnut-card ma-card ma-card--flat ma-card--interactive ${badge ? badge.className : ""}`.trim());
            button.type = "button";
            button.dataset.rowScript = row.script;
            button.dataset.rowKey = row.key;

            if (badge) button.append(makeResultNode("span", `row-flag ${badge.className}`, badge.label));

            const canvas = document.createElement("canvas");
            canvas.id = `chart-${prefix}-${index}`;
            canvas.width = 70;
            canvas.height = 70;

            button.append(
                canvas,
                makeResultNode("div", "row-doughnut-label", row.key),
                makeResultNode("div", "row-doughnut-value", row.isOff ? "Off" : `${row.accuracy}%`)
            );
            strip.append(button);
        });

        section.append(head, strip);
        return section;
    };

    const root = makeResultNode("div", "row-performance");
    const toolbar = makeResultNode("div", "row-performance-toolbar");
    const toggle = makeResultNode("div", "row-view-toggle");
    const regular = makeResultNode("button", `row-view-btn ma-button ma-button--small ${viewMode === "regular" ? "active" : ""}`.trim(), "Regular rows");
    regular.type = "button";
    regular.dataset.rowView = "regular";
    const special = makeResultNode("button", `row-view-btn ma-button ma-button--small ${viewMode === "special" ? "active" : ""}`.trim(), "Modifier rows");
    special.type = "button";
    special.dataset.rowView = "special";
    toggle.append(regular, special);
    toolbar.append(toggle);

    const overlay = makeResultNode("div", "row-tooltip-overlay");
    overlay.id = "rowTooltipOverlay";
    const card = makeResultNode("div", "row-tooltip-card");
    card.id = "rowTooltipCard";
    card.append(makeResultNode("div", "title", "Row details"), makeResultNode("div", "sub", "Hover or click a row to see right vs wrong and average time."));
    overlay.append(card);

    root.append(
        toolbar,
        overlay,
        renderSection(leftTitle, perf.hiragana, viewMode === "special" ? "sh" : "h", perf.hiraganaBest, perf.hiraganaWorst),
        renderSection(rightTitle, perf.katakana, viewMode === "special" ? "sk" : "k", perf.katakanaBest, perf.katakanaWorst)
    );

    return root;
}


const ALL_BASE_KANA = [
    ...Object.entries(HIRAGANA_ROWS).flatMap(([, row]) => Object.entries(row)),
    ...Object.entries(KATAKANA_ROWS).flatMap(([, row]) => Object.entries(row))
];

const ALL_DAKUTEN_KANA = Object.entries(DAKUTEN_ROWS).flatMap(([, row]) => Object.entries(row));
const ALL_YOON_KANA = Object.entries(YOON_ROWS).flatMap(([, row]) => Object.entries(row));
const ALL_EXTENDED_KATAKANA = Object.entries(EXTENDED_KATAKANA_ROWS).flatMap(([, row]) => Object.entries(row));
const DAKUTEN_CHAR_SET = new Set(ALL_DAKUTEN_KANA.map(([char]) => char));
const YOON_CHAR_SET = new Set(ALL_YOON_KANA.map(([char]) => char));
const EXTENDED_KATAKANA_CHAR_SET = new Set(ALL_EXTENDED_KATAKANA.map(([char]) => char));
const SPECIAL_CHAR_SET = new Set([...DAKUTEN_CHAR_SET, ...YOON_CHAR_SET, ...EXTENDED_KATAKANA_CHAR_SET]);


function normalizeTestResult(result) {
    if (!result || typeof result !== "object") return null;

    const kana = result.kana && typeof result.kana === "object" ? result.kana : {};
    const correct = Number(result.correct || 0);
    const wrong = Number(result.wrong || 0);
    const total = Number(result.total || (correct + wrong));
    const durationMs = Number(result.durationMs || 0);
    const avgMs = Number(result.avgMs || 0);
    const overallScore = Number.isFinite(result.overallScore) ? Number(result.overallScore) : (total ? Math.round((correct / total) * 100) : 0);

    return {
        id: String(result.id || `${result.mode || "test"}-${Date.now()}`),
        type: result.type === "average" ? "average" : "test",
        title: String(result.title || "Untitled Test"),
        mode: (result.mode === "writing" || result.source === "writing" || result.practiceMode === "writing" || result.section === "writing") ? "writing" : "reading",
        date: String(result.date || "—"),
        startedAt: String(result.startedAt || "—"),
        overallScore,
        correct,
        wrong,
        total,
        durationMs,
        avgMs,
        dakuten: !!result.dakuten,
        yoon: !!result.yoon,
        extendedKatakana: !!result.extendedKatakana,
        kanaAsked: Number(result.kanaAsked || total || Object.keys(kana).length || 0),
        notes: String(result.notes || ""),
        inputMode: String(result.inputMode || ""),
        inputVariant: String(result.inputVariant || ""),
        buttonLayout: result.buttonLayout ?? null,
        keyboardLayout: String(result.keyboardLayout || ""),
        breakdown: {
            hiragana: {
                correct: Number(result.breakdown?.hiragana?.correct || 0),
                wrong: Number(result.breakdown?.hiragana?.wrong || 0)
            },
            katakana: {
                correct: Number(result.breakdown?.katakana?.correct || 0),
                wrong: Number(result.breakdown?.katakana?.wrong || 0)
            }
        },
        kana
    };
}

function buildAverageResult(mode, tests) {
    const filtered = tests.filter(test => test.mode === mode && test.type !== "average");
    if (!filtered.length) return null;

    const aggregate = {};
    filtered.forEach(test => {
        Object.entries(test.kana || {}).forEach(([char, item]) => {
            if (!aggregate[char]) {
                aggregate[char] = { romaji: item.romaji, correct: 0, wrong: 0, totalMs: 0, count: 0 };
            }
            aggregate[char].correct += Number(item.correct || 0);
            aggregate[char].wrong += Number(item.wrong || 0);
            aggregate[char].totalMs += Number(item.avgMs || 0);
            aggregate[char].count += 1;
        });
    });

    const kana = {};
    Object.entries(aggregate).forEach(([char, item]) => {
        kana[char] = {
            romaji: item.romaji,
            correct: item.correct,
            wrong: item.wrong,
            avgMs: item.count ? Math.round(item.totalMs / item.count) : 0
        };
    });

    const correct = Object.values(kana).reduce((sum, item) => sum + item.correct, 0);
    const wrong = Object.values(kana).reduce((sum, item) => sum + item.wrong, 0);
    const total = correct + wrong;
    const avgMs = Object.values(kana).length
        ? Math.round(Object.values(kana).reduce((sum, item) => sum + item.avgMs, 0) / Object.values(kana).length)
        : 0;

    const hiraChars = Object.keys(kana).filter(ch =>
        Object.values(HIRAGANA_ROWS).some(row => ch in row) ||
        [DAKUTEN_ROWS.h_ka, DAKUTEN_ROWS.h_sa, DAKUTEN_ROWS.h_ta, DAKUTEN_ROWS.h_ha, YOON_ROWS.h_ka, YOON_ROWS.h_sa, YOON_ROWS.h_ta, YOON_ROWS.h_na, YOON_ROWS.h_ha, YOON_ROWS.h_ma, YOON_ROWS.h_ra, YOON_ROWS.h_ka_dakuten, YOON_ROWS.h_sa_dakuten, YOON_ROWS.h_ta_dakuten].some(row => row && ch in row)
    );
    const kataChars = Object.keys(kana).filter(ch =>
        Object.values(KATAKANA_ROWS).some(row => ch in row) ||
        [DAKUTEN_ROWS.k_ka, DAKUTEN_ROWS.k_sa, DAKUTEN_ROWS.k_ta, DAKUTEN_ROWS.k_ha, YOON_ROWS.k_ka, YOON_ROWS.k_sa, YOON_ROWS.k_ta, YOON_ROWS.k_na, YOON_ROWS.k_ha, YOON_ROWS.k_ma, YOON_ROWS.k_ra, YOON_ROWS.k_ka_dakuten, YOON_ROWS.k_sa_dakuten, YOON_ROWS.k_ta_dakuten, EXTENDED_KATAKANA_ROWS.k_a, EXTENDED_KATAKANA_ROWS.k_sa, EXTENDED_KATAKANA_ROWS.k_ta, EXTENDED_KATAKANA_ROWS.k_ha, EXTENDED_KATAKANA_ROWS.k_wa].some(row => row && ch in row)
    );

    const hira = hiraChars.reduce((acc, ch) => ({ correct: acc.correct + kana[ch].correct, wrong: acc.wrong + kana[ch].wrong }), { correct: 0, wrong: 0 });
    const kata = kataChars.reduce((acc, ch) => ({ correct: acc.correct + kana[ch].correct, wrong: acc.wrong + kana[ch].wrong }), { correct: 0, wrong: 0 });

    return {
        id: `overall-${mode}`,
        type: "average",
        title: `${mode === "reading" ? "Reading" : "Writing"} Test Average`,
        mode,
        date: "All saved tests",
        startedAt: "Pinned summary",
        overallScore: total ? Math.round((correct / total) * 100) : 0,
        correct,
        wrong,
        total,
        durationMs: avgMs * Object.keys(kana).length,
        avgMs,
        dakuten: filtered.some(test => test.dakuten),
        yoon: filtered.some(test => test.yoon),
        extendedKatakana: filtered.some(test => test.extendedKatakana),
        kanaAsked: Object.keys(kana).length,
        notes: `Average view across all saved ${mode} tests.`,
        breakdown: {
            hiragana: hira,
            katakana: kata
        },
        kana
    };
}




function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "—";

    if (ms < 1000) {
        return `${(ms / 1000).toFixed(2)}s`;
    }

    const seconds = ms / 1000;
    if (seconds < 60) {
        return `${seconds.toFixed(2)}s`;
    }

    const minutes = seconds / 60;
    if (minutes < 60) {
        return `${minutes.toFixed(2)}m`;
    }

    const hours = minutes / 60;
    return `${hours.toFixed(2)}h`;
}


  window.ModeAtlasResultsUI = {
    REGULAR_ROW_GROUPS,
    SPECIAL_ROW_GROUPS,
    ROW_GROUPS,
    SPECIAL_CHAR_SET,
    getSpecialModifierType,
    isModifierEnabledForResult,
    computeRowPerformance,
    rowNeedsErrorStyling,
    getRowBadgeType,
    getRowCellExtremes,
    renderRowPerformanceNode,
    formatDuration,
    normalizeTestResult,
    buildAverageResult
  };
})();
