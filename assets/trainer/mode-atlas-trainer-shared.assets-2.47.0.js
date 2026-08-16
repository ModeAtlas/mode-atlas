/* Shared trainer helpers used by Reading and Writing practice. */

function createEmptySessionStats() {
    return {
        active: false,
        startTime: null,
        endTime: null,
        startXp: 0,
        answered: 0,
        correct: 0,
        wrong: 0,
        bestStreak: 0,
        timings: [],
        perChar: {}
    };
}

function loadJSON(key, fallback) {
    try {
        if (window.ModeAtlasStorage?.json) return window.ModeAtlasStorage.json(key, fallback);
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function loadNumber(key, fallback = 0) {
    try {
        if (window.ModeAtlasStorage?.number) return window.ModeAtlasStorage.number(key, fallback);
        const value = Number(localStorage.getItem(key));
        return Number.isFinite(value) ? value : fallback;
    } catch {
        return fallback;
    }
}



function createBaseTrainerDefaultSettings(overrides = {}) {
    return {
        focusWeak: false,
        dakuten: false,
        yoon: false,
        extendedKatakana: false,
        hint: false,
        srs: true,
        mobileMode: false,
        endless: false,
        timeTrial: false,
        speedRun: false,
        dailyChallenge: false,
        testMode: false,
        comboKana: false,
        comboMode: "random",
        hiraganaRows: Object.keys(hiraganaRows),
        katakanaRows: [],
        statsVisible: true,
        scoresVisible: true,
        activeBottomTab: null,
        ...overrides
    };
}

function loadTrainerSettings(storageKey, defaults) {
    const loaded = loadJSON(storageKey, defaults);
    return { ...defaults, ...loaded, activeBottomTab: null };
}

function setElementHidden(el, hidden = true) {
    if (!el) return;
    if (hidden) {
        el.hidden = true;
        el.setAttribute("hidden", "");
    } else {
        el.hidden = false;
        el.removeAttribute("hidden");
    }
}

function setElementVisible(el, visible = true) {
    setElementHidden(el, !visible);
}

function isElementVisible(el) {
    return !!el && !el.hidden && !el.hasAttribute("hidden");
}


function createTrainerUiVisibilityControls(elements = {}) {
    const sessionActionsEl = elements.sessionActionsEl || null;
    const gameOverEl = elements.gameOverEl || null;
    const retryBtn = elements.retryBtn || null;

    function setSessionActionsVisible(visible = true) {
        if (!sessionActionsEl) return;
        setElementVisible(sessionActionsEl, !!visible);
        sessionActionsEl.classList.toggle("is-active", !!visible);
        document.body.classList.toggle("trainer-session-active", !!visible);
    }

    function setGameOverVisible(visible = true) {
        if (!gameOverEl) return;
        setElementVisible(gameOverEl, !!visible);
        gameOverEl.classList.toggle("is-active", !!visible);
    }

    function setRetryButtonVisible(visible = true) {
        if (!retryBtn) return;
        setElementVisible(retryBtn, !!visible);
        retryBtn.classList.toggle("is-active", !!visible);
    }

    return {
        setSessionActionsVisible,
        setGameOverVisible,
        setRetryButtonVisible
    };
}


function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "0 ms";
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)} seconds`;
    const minutes = seconds / 60;
    if (minutes < 60) return `${minutes.toFixed(1)} minutes`;
    const hours = minutes / 60;
    return `${hours.toFixed(1)} hours`;
}

function formatCountdown(ms) {
    if (ms <= 0) return "0.0s";
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = seconds / 60;
    return `${minutes.toFixed(1)}m`;
}

function normalizeLegacyRowSelection() {
    // Older saves used settings.rows like ["a", "ka"]. Keep those saves readable without
    // forcing hidden rows into the heatmap. Only migrate when the newer row arrays are absent.
    const legacyRows = Array.isArray(settings.rows) ? settings.rows : [];
    if (!legacyRows.length) return;

    if ((!Array.isArray(settings.hiraganaRows) || settings.hiraganaRows.length === 0) &&
        (!Array.isArray(settings.katakanaRows) || settings.katakanaRows.length === 0)) {
        const hira = legacyRows.map(row => `h_${row}`).filter(row => hiraganaRows[row]);
        if (hira.length) settings.hiraganaRows = hira;
    }
}

function createDefaultScoreHistory() {
    return {
        endlessBest: { total: 0, correct: 0, wrong: 0 },
        speedRunTop3: [],
        comboKanaBest: { same_row: 0, random: 0 },
        timeTrialTop3: []
    };
}

function normalizeScoreHistory(data) {
    const defaults = createDefaultScoreHistory();
    return {
        ...defaults,
        ...(data || {}),
        endlessBest: { ...defaults.endlessBest, ...((data || {}).endlessBest || {}) },
        speedRunTop3: Array.isArray((data || {}).speedRunTop3) ? data.speedRunTop3 : [],
        comboKanaBest: { ...defaults.comboKanaBest, ...((data || {}).comboKanaBest || {}) },
        timeTrialTop3: Array.isArray((data || {}).timeTrialTop3) ? data.timeTrialTop3 : []
    };
}


function rebuildCharMap() {
    charMap = {};

    for (const row of settings.hiraganaRows.filter(r => hiraganaRows[r])) {
        Object.assign(charMap, hiraganaRows[row]);
        if (settings.dakuten && dakutenRows[row]) Object.assign(charMap, dakutenRows[row]);
        if (settings.yoon && yoonRows[row]) Object.assign(charMap, yoonRows[row]);
        if (settings.yoon && settings.dakuten && yoonRows[`${row}_dakuten`]) Object.assign(charMap, yoonRows[`${row}_dakuten`]);
        if (settings.extendedKatakana && extendedKatakanaRows[row]) Object.assign(charMap, extendedKatakanaRows[row]);
    }

    for (const row of settings.katakanaRows.filter(r => katakanaRows[r])) {
        Object.assign(charMap, katakanaRows[row]);
        if (settings.dakuten && dakutenRows[row]) Object.assign(charMap, dakutenRows[row]);
        if (settings.yoon && yoonRows[row]) Object.assign(charMap, yoonRows[row]);
        if (settings.yoon && settings.dakuten && yoonRows[`${row}_dakuten`]) Object.assign(charMap, yoonRows[`${row}_dakuten`]);
        if (settings.extendedKatakana && extendedKatakanaRows[row]) Object.assign(charMap, extendedKatakanaRows[row]);
    }

    activeChars = Object.keys(charMap);
}

function ensureDataObjects() {
    rebuildCharMap();

    for (const ch of activeChars) {
        if (!stats[ch]) stats[ch] = { correct: 0, wrong: 0 };
        if (!times[ch]) times[ch] = { avg: 1200, count: 0 };
        if (!srs[ch]) srs[ch] = { level: 0, due: 0, lastSeen: 0, lastWrong: 0 };
    }
}

function getAverageTime(char) { return times[char]?.avg ?? 1200; }

function getStats(char) { return stats[char] ?? { correct: 0, wrong: 0 }; }

function getSrs(char) { return srs[char] ?? { level: 0, due: 0, lastSeen: 0, lastWrong: 0 }; }

function getTodayKey(value) {
    if (window.ModeAtlasDates?.localDateKey) return window.ModeAtlasDates.localDateKey(value);
    const now = value instanceof Date ? new Date(value.getTime()) : new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function hashStringSeed(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function createSeededRng(seedString) {
    let seed = hashStringSeed(seedString) || 1;
    return () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}

function getTodayDailyRecord() {
    return dailyChallengeHistory[getTodayKey()] || null;
}

function isDailyChallengeSession() {
    return !!settings.dailyChallenge;
}

function isTestModeSession() {
    return !!settings.testMode;
}

function getTestModePoolMap() {
    const pool = { ...TEST_MODE_BASE_CHAR_MAP };

    if (settings.dakuten) {
        Object.assign(pool, ...Object.values(dakutenRows));
    }

    if (settings.yoon) {
        Object.entries(yoonRows).forEach(([key, value]) => {
            if (!key.endsWith("_dakuten")) Object.assign(pool, value);
        });
        if (settings.dakuten) {
            Object.entries(yoonRows).forEach(([key, value]) => {
                if (key.endsWith("_dakuten")) Object.assign(pool, value);
            });
        }
    }

    if (settings.extendedKatakana) {
        Object.assign(pool, ...Object.values(extendedKatakanaRows));
    }

    return pool;
}

function buildTestSequence() {
    const pool = Object.keys(getTestModePoolMap());
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
}

function getAnswerMapForCurrentMode() {
    if (isDailyChallengeSession()) return DAILY_CHALLENGE_CHAR_MAP;
    if (isTestModeSession()) return getTestModePoolMap();
    return charMap;
}

function formatDailyHistoryTime(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "—";
    return `${(ms / 1000).toFixed(1)}s`;
}

function createTrainerEl(tag, className = "", text = "") {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== "") el.textContent = String(text);
    return el;
}

function createScoreRow(left, right) {
    const row = createTrainerEl("div", "score-row");
    row.append(createTrainerEl("span", "", left), createTrainerEl("span", "", right));
    return row;
}

function createStatCard(label, value) {
    const card = createTrainerEl("div", "stat-card");
    card.append(createTrainerEl("div", "label", label), createTrainerEl("div", "value", value));
    return card;
}

function renderDailyChallengeHistory() {
    const entries = Object.entries(dailyChallengeHistory || {})
        .filter(([dateKey, record]) => dateKey !== getTodayKey() && record && Number.isFinite(record.officialScore))
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 5);

    if (!entries.length) {
        dailyHistoryListEl.replaceChildren(createScoreRow("No history yet", "—"));
        return;
    }

    dailyHistoryListEl.replaceChildren(...entries.map(([dateKey, record]) =>
        createScoreRow(dateKey, `${record.officialScore}/${record.total} · ${formatDailyHistoryTime(record.timeMs)}`)
    ));
}

function renderDailyChallengeSummary() {
    const todayRecord = getTodayDailyRecord();
    dailyTodayScoreEl.textContent = todayRecord ? `${todayRecord.officialScore}/${todayRecord.total}` : "—";
    dailyTodayAttemptsEl.textContent = todayRecord ? (todayRecord.attempts || 1) : "0";
    renderDailyChallengeHistory();
}

function updateSessionProgressBar(current, total, label, visible = true) {
    const root = document.getElementById("sessionProgressBar");
    const fill = document.getElementById("sessionProgressFill");
    const labelEl = document.getElementById("sessionProgressLabel");
    const valueEl = document.getElementById("sessionProgressValue");
    if (!root || !fill || !labelEl || !valueEl) return;
    const safeTotal = Math.max(0, Number(total || 0));
    const safeCurrent = Math.max(0, Math.min(safeTotal || Number(current || 0), Number(current || 0)));
    const show = !!visible && safeTotal > 0;
    setElementVisible(root, show);
    if (!show) { fill.style.setProperty('--ma-progress', '0%'); return; }
    const percent = Math.max(0, Math.min(100, (safeCurrent / safeTotal) * 100));
    labelEl.textContent = label || 'Session progress';
    valueEl.textContent = `${safeCurrent} / ${safeTotal}`;
    fill.style.setProperty('--ma-progress', `${percent}%`);
}

function updateTopStats() {
    streakEl.textContent = streak;
    highScoreEl.textContent = highScore;
    endlessTotalEl.textContent = endlessRunTotal;
    endlessWrongEl.textContent = endlessRunWrong;

    const showContinuous = (settings.endless || settings.timeTrial || settings.speedRun) && sessionStarted && !isDailyChallengeSession();
    setElementVisible(endlessTotalPill, showContinuous);
    setElementVisible(endlessWrongPill, showContinuous);

    const showTimed = (settings.timeTrial || settings.speedRun) && sessionStarted && !isDailyChallengeSession();
    setElementVisible(trialTimerPill, showTimed);

    updateDailyChallengePills();
    applyDailyChallengeTheme();
}

function renderScoreHistory() {
    scoreHistory = normalizeScoreHistory(scoreHistory);
    bestEndlessTotalEl.textContent = scoreHistory.endlessBest.total || 0;
    bestEndlessCorrectEl.textContent = scoreHistory.endlessBest.correct || 0;
    bestEndlessWrongEl.textContent = scoreHistory.endlessBest.wrong || 0;
    comboSameRowBestEl.textContent = scoreHistory.comboKanaBest.same_row || 0;
    comboRandomBestEl.textContent = scoreHistory.comboKanaBest.random || 0;
    renderDailyChallengeSummary();

    if (typeof speedRunTop3El !== "undefined" && speedRunTop3El) {
        const speedList = scoreHistory.speedRunTop3 || [];
        const rows = speedList.length
            ? speedList.map((entry, index) => createScoreRow(`#${index + 1}`, `${entry.score} pts · ${entry.correct}/${entry.answered} · ${entry.avgMs ? formatDuration(entry.avgMs) : "—"}`))
            : [createScoreRow("No scores yet", "—")];
        speedRunTop3El.replaceChildren(...rows);
    }

    const list = scoreHistory.timeTrialTop3 || [];
    if (!list.length) {
        timeTrialTop3El.replaceChildren(createScoreRow("No scores yet", "—"));
        return;
    }

    timeTrialTop3El.replaceChildren(...list.map((entry, index) =>
        createScoreRow(`#${index + 1}`, `${entry.time}m / T${entry.target} / S${entry.score}`)
    ));
}

function updateTrialConfigVisibility() {
    setElementVisible(trialConfigEl, settings.timeTrial && !settings.speedRun && !settings.dailyChallenge && !settings.testMode);
    setElementVisible(comboConfigEl, settings.comboKana && !settings.dailyChallenge && !settings.testMode);
    comboSameRowBtn.classList.toggle("active", settings.comboMode === "same_row");
    comboRandomBtn.classList.toggle("active", settings.comboMode === "random");
    comboSameRowBtn.classList.remove("btn-secondary");
    comboRandomBtn.classList.remove("btn-secondary");
    comboSameRowBtn.disabled = sessionStarted;
    comboRandomBtn.disabled = sessionStarted;
}

function setBottomTab(tabName) {
    settings.activeBottomTab = settings.activeBottomTab === tabName ? null : tabName;
    applyPanelStates();
    // Drawer open/close is UI-only; do not mark cloud data updated or save over hydrated stats.
    window.ModeAtlasStorage.writeModeJSON("reading", "settings", settings);
}

function isModeLocked() { return sessionStarted; }

function makeToggleButton(label, active, onClick, disabled = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toggle-btn ma-button ma-trainer-button" + (active ? " active" : "");
    button.textContent = label;
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.disabled = disabled;
    button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        onClick();
        requestAnimationFrame(() => {
          document.querySelectorAll(".bottom-shell.ma-modifiers-only .toggle-btn[aria-pressed=\"true\"], .bottom-shell.ma-modifiers-only .btn.active").forEach(el => el.classList.add("active"));
        });
    };
    return button;
}

function buildModifierButtons() {
    const modes = [
        ["hint", "Hint Mode"],
        ["srs", "SRS Mode"],
        ["endless", "Endless Mode"],
        ["timeTrial", "Time Trial Mode"],
        ["speedRun", "Speed Run"],
        ["dailyChallenge", "Daily Challenge"],
        ["testMode", "Test Mode"],
        ["comboKana", "Combo Kana Mode"],
        ["focusWeak", "Focus Weak"],
        ["dakuten", "Dakuten"],
        ["yoon", "Yōon"],
        ["extendedKatakana", "Extended Katakana"],
        ["confusableKana", "Confusable Kana"]
    ];

    const container = document.getElementById("modifierOptions");
    container.replaceChildren();
    const lockedModes = isModeLocked();

    for (const [key, label] of modes) {
        const btn = makeToggleButton(label, settings[key], () => {
            if (key === "timeTrial") {
                settings.timeTrial = !settings.timeTrial;
                if (settings.timeTrial) {
                    settings.endless = false;
                    settings.speedRun = false;
                    settings.dailyChallenge = false;
                    settings.testMode = false;
                }
            } else if (key === "speedRun") {
                settings.speedRun = !settings.speedRun;
                if (settings.speedRun) {
                    settings.endless = false;
                    settings.timeTrial = false;
                    settings.dailyChallenge = false;
                    settings.testMode = false;
                    settings.comboKana = false;
                }
            } else if (key === "endless") {
                settings.endless = !settings.endless;
                if (settings.endless) {
                    settings.timeTrial = false;
                    settings.speedRun = false;
                    settings.dailyChallenge = false;
                    settings.testMode = false;
                }
            } else if (key === "dailyChallenge") {
                settings.dailyChallenge = !settings.dailyChallenge;
                if (settings.dailyChallenge) {
                    settings.timeTrial = false;
                    settings.endless = false;
                    settings.speedRun = false;
                    settings.testMode = false;
                    settings.comboKana = false;
                    settings.hint = false;
                }
            } else if (key === "testMode") {
                settings.testMode = !settings.testMode;
                if (settings.testMode) {
                    settings.timeTrial = false;
                    settings.endless = false;
                    settings.speedRun = false;
                    settings.dailyChallenge = false;
                    settings.comboKana = false;
                    settings.hint = false;
                }
            } else if (key === "comboKana") {
                settings.comboKana = !settings.comboKana;
                if (settings.comboKana) {
                    settings.dailyChallenge = false;
                    settings.testMode = false;
                    settings.speedRun = false;
                }
            } else {
                settings[key] = !settings[key];
            }
            updateTrialConfigVisibility();
            updateTopStats();
    if (DEBUG_PANEL) renderDebugPanel();
            onSettingsChanged();
        }, lockedModes);
        container.appendChild(btn);
    }
}

function buildOptionButtons() { /* Options menu removed; SRS now lives in Modifiers. */ }

function buildRows(containerId, sourceRows, selectedRowsKey, displayPrefix) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.replaceChildren();
    const lockedModes = isModeLocked();

    for (const row of Object.keys(sourceRows)) {
        const label = row.replace(displayPrefix, "");
        const isSelected = Array.isArray(settings[selectedRowsKey]) && settings[selectedRowsKey].includes(row);
        const btn = makeToggleButton(label, isSelected, () => {
            const arr = Array.isArray(settings[selectedRowsKey]) ? settings[selectedRowsKey] : [];
            if (arr.includes(row)) {
                settings[selectedRowsKey] = arr.filter(r => r !== row);
            } else {
                settings[selectedRowsKey] = [...arr, row];
            }
            onSettingsChanged();
        }, lockedModes);
        btn.dataset.rowKey = row;
        btn.dataset.rowGroup = selectedRowsKey;
        btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        btn.classList.toggle('active', isSelected);
        container.appendChild(btn);
    }
}

function heatmapColor(char) {
    const { correct, wrong } = getStats(char);
    const total = correct + wrong;
    if (total === 0) return "var(--ma-trainer-heatmap-neutral)";
    if (wrong > correct) return "var(--ma-trainer-heatmap-wrong)";
    if (correct > wrong) return "var(--ma-trainer-heatmap-correct)";
    return "var(--ma-trainer-heatmap-even)";
}

function showPopupForChar(ch, e) {
    debugActiveChar = ch;
    if (DEBUG_PANEL) renderDebugPanel();
    const st = getStats(ch);
    const tm = getAverageTime(ch);
    const sr = getSrs(ch);

    popupEl.replaceChildren(
        createTrainerEl("div", "popup-title", ch),
        createTrainerEl("div", "", `Romaji: ${getAnswerMapForCurrentMode()[ch] || "—"}`),
        createTrainerEl("div", "", `Right: ${st.correct}`),
        createTrainerEl("div", "", `Wrong: ${st.wrong}`),
        createTrainerEl("div", "", `Avg time: ${formatDuration(tm)}`),
        createTrainerEl("div", "", `SRS level: ${sr.level}`)
    );

    setElementVisible(popupEl, true);

    if (settings.mobileMode) {
        popupEl.style.left = "50%";
        popupEl.style.top = "50%";
        popupEl.style.transform = "translate(-50%, -50%)";
    } else {
        popupEl.style.transform = "none";
        const x = Math.min(window.innerWidth - 180, e.clientX + 10);
        const y = Math.min(window.innerHeight - 120, e.clientY + 10);
        popupEl.style.left = x + "px";
        popupEl.style.top = y + "px";
    }
}

function getHeatmapCharsForDisplay() {
    // Old behaviour restored: the Stats heatmap only shows currently selected rows.
    // Saved stats/times are used for those visible kana, but they do not make hidden rows appear.
    const out = [];
    const addMap = (map) => {
        if (!map) return;
        for (const ch of Object.keys(map)) {
            if (!out.includes(ch)) out.push(ch);
        }
    };
    const selectedHira = Array.isArray(settings.hiraganaRows) ? settings.hiraganaRows.filter(r => hiraganaRows[r]) : [];
    const selectedKata = Array.isArray(settings.katakanaRows) ? settings.katakanaRows.filter(r => katakanaRows[r]) : [];

    for (const row of selectedHira) {
        addMap(hiraganaRows[row]);
        if (settings.dakuten) addMap(dakutenRows[row]);
        if (settings.yoon) addMap(yoonRows[row]);
        if (settings.yoon && settings.dakuten) addMap(yoonRows[`${row}_dakuten`]);
        if (settings.extendedKatakana) addMap(extendedKatakanaRows[row]);
    }

    for (const row of selectedKata) {
        addMap(katakanaRows[row]);
        if (settings.dakuten) addMap(dakutenRows[row]);
        if (settings.yoon) addMap(yoonRows[row]);
        if (settings.yoon && settings.dakuten) addMap(yoonRows[`${row}_dakuten`]);
        if (settings.extendedKatakana) addMap(extendedKatakanaRows[row]);
    }

    return out;
}

function renderHeatmap() {
    heatmapEl.replaceChildren();

    const heatmapChars = typeof getHeatmapCharsForDisplay === "function"
        ? getHeatmapCharsForDisplay()
        : activeChars;

    for (const ch of heatmapChars) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        if (String(ch).length > 1) cell.classList.add("combo");
        cell.textContent = ch;
        const cellStats = getStats(ch);
        cell.setAttribute("aria-label", `${ch}: ${cellStats.correct || 0} correct, ${cellStats.wrong || 0} incorrect. View mastery details`);
        cell.style.background = heatmapColor(ch);

        cell.addEventListener("mouseenter", (e) => {
            hoveredCell = cell;
            if (!popupLocked) showPopupForChar(ch, e);
        });

        cell.addEventListener("mousemove", (e) => {
            if (!popupLocked && hoveredCell === cell) showPopupForChar(ch, e);
        });

        cell.addEventListener("mouseleave", () => {
            if (hoveredCell === cell) hoveredCell = null;
            if (!popupLocked) closePopup();
        });

        cell.addEventListener("click", (e) => {
            e.stopPropagation();
            popupLocked = true;
            hoveredCell = cell;
            if (e.detail === 0) {
                const rect = cell.getBoundingClientRect();
                showPopupForChar(ch, { clientX: rect.left + (rect.width / 2), clientY: rect.top + (rect.height / 2) });
            } else {
                showPopupForChar(ch, e);
            }
        });
        cell.addEventListener("keydown", (e) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            popupLocked = false;
            hoveredCell = null;
            closePopup();
        });

        heatmapEl.appendChild(cell);
    }
}

function closePopup() {
    setElementHidden(popupEl, true);
}

function getEligiblePool() {
    let pool = [...activeChars];
    if (settings.confusableKana) {
        const confusableSet = new Set(["シ","ツ","ソ","ン","ぬ","め","れ","わ","ね","ク","ケ","タ","ナ","メ"]);
        const focused = pool.filter(ch => confusableSet.has(ch));
        if (focused.length > 0) pool = focused;
    }
    if (pool.length === 0) return [];

    if (settings.srs) {
        const now = Date.now();
        const duePool = pool.filter(ch => getSrs(ch).due <= now);
        if (duePool.length > 0) pool = duePool;
    }

    return pool;
}

function closeDebugPanel() {
    const panel = document.getElementById('srsDebugPanel');
    if (panel) panel.remove();
    DEBUG_PANEL = null;
}

function clearHint() {
    clearTimeout(hintTimeout);
    hintEl.textContent = "";
}

function getComboLength() {
    if (!settings.comboKana) return 1;
    if (streak >= 25) return 4;
    if (streak >= 10) return 3;
    return 2;
}

function getComboTierLabel(length) {
    return `${length} Kana Combo`;
}

function hideComboTierNotice() {
    clearTimeout(comboTierNoticeTimeout);
    comboTierNoticeEl.textContent = "";
    comboTierNoticeEl.classList.remove("show");
}

function showComboTierNotice(length) {
    if (!settings.comboKana || !sessionStarted || length <= 1) return;
    clearTimeout(comboTierNoticeTimeout);
    comboTierNoticeEl.textContent = `Tier up! ${getComboTierLabel(length)}`;
    comboTierNoticeEl.classList.add("show");
    comboTierNoticeTimeout = setTimeout(() => {
        comboTierNoticeEl.classList.remove("show");
    }, 1600);
}

function startTimedModeTimer(durationMinutes) {
    stopTrialTimer();
    trialEndTime = Date.now() + durationMinutes * 60 * 1000;
    setElementVisible(trialTimerPill, true);

    const tick = () => {
        const remaining = Math.max(0, trialEndTime - Date.now());
        trialTimerEl.textContent = formatCountdown(remaining);
        if (remaining <= 0) {
            stopTrialTimer();
            endSession(true);
        }
    };

    tick();
    trialTimerId = setInterval(tick, 100);
}

const startTrialTimer = startTimedModeTimer;

function stopTrialTimer() {
    if (trialTimerId) {
        clearInterval(trialTimerId);
        trialTimerId = null;
    }
    setElementHidden(trialTimerPill, true);
}

function updateAverageTime(char, timeTaken) {
    const entry = times[char] || { avg: 1200, count: 0 };
    entry.avg = Math.round((entry.avg * entry.count + timeTaken) / (entry.count + 1));
    entry.count += 1;
    times[char] = entry;
}

function updateSrsWrong(char) {
    const entry = srs[char] || { level: 0, due: 0, lastSeen: 0, lastWrong: 0 };
    entry.level = 0;
    entry.due = Date.now() + 2000;
    entry.lastSeen = Date.now();
    entry.lastWrong = Date.now();
    srs[char] = entry;
}

function updateSessionChar(char, correct, timeTaken) {
    if (!sessionStats.perChar[char]) {
        sessionStats.perChar[char] = { correct: 0, wrong: 0, times: [] };
    }
    const entry = sessionStats.perChar[char];
    if (correct) entry.correct += 1;
    else entry.wrong += 1;
    entry.times.push(timeTaken);
}

function advanceTestModeAfterAnswer() {
    if (testIndex >= testSequence.length) {
        endTestMode();
        return;
    }
    nextCharacter();
}

function currentFlowModeIsContinuous() {
    return settings.endless || settings.timeTrial || settings.speedRun || settings.testMode;
}

function average(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function loadStoredTestModeResults() {
    const primary = loadJSON(TEST_RESULTS_STORAGE_KEY, null);
    const backup = loadJSON(TEST_RESULTS_STORAGE_BACKUP_KEY, null);
    if (Array.isArray(primary)) return normalizeStoredTestModeResults(primary);
    if (Array.isArray(backup)) return normalizeStoredTestModeResults(backup);
    return [];
}

function buildTestModeBreakdown() {
    const result = {
        hiragana: { correct: 0, wrong: 0 },
        katakana: { correct: 0, wrong: 0 }
    };

    Object.entries(sessionStats.perChar || {}).forEach(([char, data]) => {
        const isHiragana = /[ぁ-ゖゝゞ]/.test(char);
        const isKatakana = /[ァ-ヺヽヾ]/.test(char);
        if (isHiragana) {
            result.hiragana.correct += data.correct || 0;
            result.hiragana.wrong += data.wrong || 0;
        } else if (isKatakana) {
            result.katakana.correct += data.correct || 0;
            result.katakana.wrong += data.wrong || 0;
        }
    });

    return result;
}

function buildTestModeKanaResults() {
    const sourceMap = getTestModePoolMap();
    const out = {};
    Object.keys(sourceMap).forEach(char => {
        const data = sessionStats.perChar[char] || { correct: 0, wrong: 0, times: [] };
        out[char] = {
            romaji: sourceMap[char] || "",
            correct: Number(data.correct || 0),
            wrong: Number(data.wrong || 0),
            avgMs: data.times && data.times.length ? Math.round(average(data.times)) : 0
        };
    });
    return out;
}

function getSessionDifficultyLists() {
    const entries = Object.entries(sessionStats.perChar).map(([char, data]) => {
        const attempts = data.correct + data.wrong;
        const accuracy = attempts ? (data.correct / attempts) : 0;
        return {
            char,
            correct: data.correct,
            wrong: data.wrong,
            attempts,
            accuracy,
            avgTime: average(data.times)
        };
    });

    const hardest = [...entries]
        .sort((a, b) => {
            if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
            return b.wrong - a.wrong;
        })
        .slice(0, 5);

    const easiest = [...entries]
        .sort((a, b) => {
            if (a.accuracy !== b.accuracy) return b.accuracy - a.accuracy;
            return a.avgTime - b.avgTime;
        })
        .slice(0, 5);

    return { hardest, easiest };
}

function renderSessionList(container, title, items) {
    if (!items.length) {
        setElementHidden(container, true);
        container.replaceChildren();
        return;
    }

    setElementVisible(container, true);
    const heading = createTrainerEl("h3", "", title);
    const rows = items.map(item => {
        const row = createTrainerEl("div", "session-list-item");
        row.append(
            createTrainerEl("span", "", item.char),
            createTrainerEl("span", "", `${item.correct}✓ / ${item.wrong}✗`)
        );
        return row;
    });
    container.replaceChildren(heading, ...rows);
}




function beginTrainerSessionEnd() {
    hideComboTierNotice();
    window.KanaCloudSync?.setSessionCloudPause?.(false);
    window.KanaCloudSync?.flushDeferredSessionSync?.(650);
}

function applyTrainerStandardSessionEnd(options = {}) {
    const {
        sessionStats,
        inputEl = null,
        startWrap = null,
        promptEl = null,
        showSessionModal,
        stopTrialTimer,
        updateBestScores,
        setGameOverVisible,
        setSessionActionsVisible,
        updateTopStats,
        renderDebugPanel,
        debugPanel = null,
        autoEnded = false,
        afterPromptReset
    } = options;

    if (sessionStats) {
        sessionStats.active = false;
        sessionStats.endTime = Date.now();
    }

    if (typeof stopTrialTimer === "function") stopTrialTimer();
    if (typeof updateBestScores === "function") updateBestScores();

    if (inputEl) inputEl.disabled = true;
    if (typeof setGameOverVisible === "function") setGameOverVisible(false);
    if (typeof setSessionActionsVisible === "function") setSessionActionsVisible(false);
    setElementVisible(startWrap, true);
    clearHint();

    if (promptEl) promptEl.textContent = "—";
    if (typeof afterPromptReset === "function") afterPromptReset();

    if (typeof showSessionModal === "function") showSessionModal(autoEnded);
    if (typeof updateTopStats === "function") updateTopStats();
    if (debugPanel && typeof renderDebugPanel === "function") renderDebugPanel();
}

function applyTrainerDailyStopUi(options = {}) {
    const {
        inputEl = null,
        startWrap = null,
        promptEl = null,
        stopTrialTimer,
        setGameOverVisible,
        setSessionActionsVisible,
        updateTopStats,
        renderDebugPanel,
        debugPanel = null,
        afterPromptReset
    } = options;

    if (typeof stopTrialTimer === "function") stopTrialTimer();
    if (inputEl) inputEl.disabled = true;
    if (typeof setGameOverVisible === "function") setGameOverVisible(false);
    if (typeof setSessionActionsVisible === "function") setSessionActionsVisible(false);
    setElementVisible(startWrap, true);
    clearHint();

    if (promptEl) promptEl.textContent = "—";
    if (typeof afterPromptReset === "function") afterPromptReset();

    if (typeof updateTopStats === "function") updateTopStats();
    if (debugPanel && typeof renderDebugPanel === "function") renderDebugPanel();
}


function prepareTrainerSessionStart(options = {}) {
    window.KanaCloudSync?.setSessionCloudPause?.(true);
    const now = Date.now();
    const sessionStats = createEmptySessionStats();
    sessionStats.active = true;
    sessionStats.startTime = now;
    sessionStats.startXp = Math.max(0, Number(window.ModeAtlasProgress?.getXP?.() || 0));

    const dailyActive = typeof options.isDailyChallengeSession === "function" && options.isDailyChallengeSession();
    const testActive = typeof options.isTestModeSession === "function" && options.isTestModeSession();

    return {
        sessionStats,
        streak: 0,
        endlessRunTotal: 0,
        endlessRunWrong: 0,
        lastComboLength: typeof options.getComboLength === "function" ? options.getComboLength() : 2,
        daily: dailyActive ? {
            sequence: typeof options.buildDailySequence === "function" ? options.buildDailySequence() : [],
            index: 0,
            correct: 0,
            wrong: 0,
            startTime: now
        } : null,
        test: testActive ? {
            sequence: typeof options.buildTestSequence === "function" ? options.buildTestSequence() : [],
            index: 0,
            correct: 0,
            wrong: 0,
            startTime: now
        } : null
    };
}

function applyTrainerSessionStartUi(options = {}) {
    const {
        debugPanel = null,
        gameOverTitleEl = null,
        startWrap = null,
        inputEl = null,
        trialTimerPill = null,
        settings = {},
        isDailyChallengeSession,
        setGameOverVisible,
        setRetryButtonVisible,
        setSessionActionsVisible,
        updateTopStats,
        renderDebugPanel
    } = options;

    if (typeof updateTopStats === "function") updateTopStats();
    if (debugPanel && typeof renderDebugPanel === "function") renderDebugPanel();

    if (typeof setGameOverVisible === "function") setGameOverVisible(false);
    if (gameOverTitleEl) gameOverTitleEl.textContent = "Wrong";
    if (typeof setRetryButtonVisible === "function") setRetryButtonVisible(false);
    setElementHidden(startWrap, true);
    if (typeof setSessionActionsVisible === "function") setSessionActionsVisible(true);
    if (inputEl) inputEl.disabled = false;

    const dailyActive = typeof isDailyChallengeSession === "function" && isDailyChallengeSession();
    if (!settings.timeTrial && !settings.speedRun || dailyActive) {
        setElementHidden(trialTimerPill, true);
    }
}

function startTrainerTimedSession(options = {}) {
    const {
        settings = {},
        trialTimeEl = null,
        trialTargetEl = null,
        isDailyChallengeSession,
        startTimedModeTimer
    } = options;

    const dailyActive = typeof isDailyChallengeSession === "function" && isDailyChallengeSession();
    if (settings.timeTrial && !dailyActive) {
        const timeMinutes = Math.max(0.1, Number(trialTimeEl?.value) || 0.5);
        const trialTarget = Math.max(1, Number(trialTargetEl?.value) || 20);
        if (typeof startTimedModeTimer === "function") startTimedModeTimer(timeMinutes);
        return trialTarget;
    }

    if (settings.speedRun && !dailyActive) {
        if (typeof startTimedModeTimer === "function") startTimedModeTimer(1);
        return 0;
    }

    return 0;
}


function getTrainerSessionXpGain(stats = sessionStats) {
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
