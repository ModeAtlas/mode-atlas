/* Shared trainer helpers used by Reading and Writing practice. */
const MODE_ATLAS_CONFUSABLE_KANA = new Set(["シ","ツ","ソ","ン","ぬ","め","れ","わ","ね","ク","ケ","タ","ナ","メ"]);

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
        practiceCount: 0,
        trialMinutes: 0.5,
        trialTarget: 20,
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
    return window.ModeAtlasPracticeModes.normalize({ ...defaults, ...loaded, activeBottomTab: null });
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

    function syncRetryState() {
        document.body.classList.toggle("trainer-session-retry", isElementVisible(gameOverEl) && isElementVisible(retryBtn));
    }

    function setSessionActionsVisible(visible = true) {
        if (!sessionActionsEl) return;
        setElementVisible(sessionActionsEl, !!visible);
        sessionActionsEl.classList.toggle("is-active", !!visible);
        document.body.classList.toggle("trainer-session-active", !!visible);
    }

    function setGameOverVisible(visible = true) {
        if (!gameOverEl) return;
        const next = !!visible;
        setElementVisible(gameOverEl, next);
        gameOverEl.classList.toggle("is-active", next);
        document.body.classList.toggle("trainer-session-result", next);
        if (!next) setRetryButtonVisible(false);
        syncRetryState();
    }

    function setRetryButtonVisible(visible = true) {
        if (!retryBtn) return;
        setElementVisible(retryBtn, !!visible);
        retryBtn.classList.toggle("is-active", !!visible);
        syncRetryState();
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
    charMap = window.ModeAtlasKanaData.selectedKanaMap(settings);
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

function getRowKeyForChar(kana) {
    return window.ModeAtlasKanaData.kanaRow(kana);
}

function getCurrentKanaUnits(value = currentChar) {
    return window.ModeAtlasKanaData.splitKana(value, getAnswerMapForCurrentMode());
}

function getAnswerMapForCurrentMode() {
    if (isDailyChallengeSession()) return DAILY_CHALLENGE_CHAR_MAP;
    if (isTestModeSession()) return getTestModePoolMap();
    const focused = sessionStarted ? sessionStats.study?.focusChars || [] : [];
    return focused.length ? {...charMap, ...Object.fromEntries(focused.map(kana => [kana, window.ModeAtlasKanaCoaching.reading(kana)]))} : charMap;
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
    setElementVisible(trialConfigEl, !sessionStarted && settings.timeTrial && !settings.speedRun && !settings.dailyChallenge && !settings.testMode);
    setElementVisible(comboConfigEl, !sessionStarted && settings.comboKana && !settings.dailyChallenge && !settings.testMode);
    comboSameRowBtn.classList.toggle("active", settings.comboMode === "same_row");
    comboRandomBtn.classList.toggle("active", settings.comboMode === "random");
    comboSameRowBtn.classList.remove("btn-secondary");
    comboRandomBtn.classList.remove("btn-secondary");
    if (!sessionStarted) {
        const trial = window.ModeAtlasPracticeModes.trial(settings.trialMinutes, settings.trialTarget);
        if (document.activeElement !== trialTimeEl) trialTimeEl.value = String(trial.minutes);
        if (document.activeElement !== trialTargetEl) trialTargetEl.value = String(trial.target);
    }
    trialTimeEl.disabled = sessionStarted;
    trialTargetEl.disabled = sessionStarted;
    comboSameRowBtn.disabled = sessionStarted;
    comboRandomBtn.disabled = sessionStarted;
}

function setBottomTab(tabName) {
    settings.activeBottomTab = settings.activeBottomTab === tabName ? null : tabName;
    applyPanelStates();
    // Drawer open/close is UI-only; do not mark cloud data updated or save over hydrated stats.
    window.ModeAtlasStorage.writeModeJSON(trainerController.mode, "settings", settings);
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

    };
    return button;
}

function buildModifierButtons() {
    window.ModeAtlasModifierMenu?.render();
}

function buildOptionButtons() { /* Options menu removed; SRS now lives in Modifiers. */ }

function buildRows(containerId, sourceRows, selectedRowsKey, displayPrefix) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const lockedModes = isModeLocked();
    const rows = Object.keys(sourceRows);
    const existing = Array.from(container.children);
    // Updating state must preserve the focused button and keyboard navigation.
    if (existing.length === rows.length && existing.every((button, index) => button.dataset.rowKey === rows[index])) {
        existing.forEach(button => {
            const active = Array.isArray(settings[selectedRowsKey]) && settings[selectedRowsKey].includes(button.dataset.rowKey);
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
            button.disabled = lockedModes;
        });
        return;
    }
    container.replaceChildren();
    for (const row of rows) {
        const label = row.replace(displayPrefix, "");
        const isSelected = Array.isArray(settings[selectedRowsKey]) && settings[selectedRowsKey].includes(row);
        const btn = makeToggleButton(label, isSelected, () => {
            window.ModeAtlasTrainerControls.toggleRow(row, selectedRowsKey);
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
    // The Stats heatmap shows only currently selected rows.
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

    return settings.confusableKana ? out.filter(ch => MODE_ATLAS_CONFUSABLE_KANA.has(ch)) : out;
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
    let pool = trainerController.study.pool([...activeChars]);
    if (settings.confusableKana) {
        const focused = pool.filter(ch => MODE_ATLAS_CONFUSABLE_KANA.has(ch));
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
    resumeTimedModeTimer(durationMinutes * 60 * 1000);
}

function resumeTimedModeTimer(remainingMs) {
    stopTrialTimer();
    trialEndTime = Date.now() + remainingMs;
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
    if (sessionStarted) trialTimerId = setInterval(tick, 100);
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
    return !isDailyChallengeSession() && !isTestModeSession();
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

function beginTrainerSessionEnd() {
    window.ModeAtlasSessionControls.reset();
    hideComboTierNotice();
    window.KanaCloudSync?.setSessionCloudPause?.(false);
    window.KanaCloudSync?.flushDeferredSessionSync?.(650);
}

function finishTrainerSession(autoEnded, resetPrompt) {
    if (!sessionStarted) return;
    beginTrainerSessionEnd();
    sessionStarted = false;
    sessionStats.active = false;
    sessionStats.endTime = Date.now();
    let completed = autoEnded;
    if (isDailyChallengeSession()) {
        completed = dailySequence.length > 0 && dailyIndex >= dailySequence.length;
        if (completed) {
            const dateKey = sessionStats.study.dateKey;
            const existing = dailyChallengeHistory[dateKey];
            if (existing) existing.attempts = (existing.attempts || 1) + 1;
            else {
                dailyChallengeHistory[dateKey] = {sequence:[...dailySequence],officialScore:dailyCorrect,total:dailySequence.length,timeMs:Math.max(0,Date.now()-dailyStartTime),attempts:1};
                window.ModeAtlasProgress?.awardOnce?.(`kana.${trainerController.mode}.dailyComplete`,dateKey);
            }
        }
    } else if (isTestModeSession()) {
        completed = testSequence.length > 0 && testIndex >= testSequence.length;
        if (completed) saveTestModeResult();
    } else {
        const timed = window.ModeAtlasPracticeModes.timed(settings);
        if (timed) completed = autoEnded && Date.now() >= trialEndTime;
        updateBestScores(completed);
    }
    stopTrialTimer();
    inputEl.disabled = true;
    inputEl.value = '';
    setGameOverVisible(false);
    setSessionActionsVisible(false);
    setElementVisible(startWrap,true);
    clearHint();
    resetPrompt();
    locked = false;
    onSettingsChanged();
    saveAll();
    window.ModeAtlasSounds?.play('finish',{cooldown:130});
    trainerController.showSessionModal(completed);
}

function prepareTrainerSessionStart(options = {}) {
    window.ModeAtlasSessionControls?.reset();
    window.ModeAtlasPracticeSetup.close();
    recordTrainerActivity();
    window.KanaCloudSync?.setSessionCloudPause?.(true);
    const now = Date.now();
    const sessionStats = createEmptySessionStats();
    sessionStats.active = true;
    sessionStats.startTime = now;
    sessionStats.startXp = Math.max(0, Number(window.ModeAtlasProgress?.getXP?.() || 0));
    options.study?.begin(sessionStats);

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

function recordTrainerActivity() {
    window.ModeAtlasVisitFlows?.recordActivity(document.body.classList.contains('ma-writing-page') ? 'writing' : 'reading');
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
        const trial = window.ModeAtlasPracticeModes.trial(trialTimeEl?.value,trialTargetEl?.value);
        const timeMinutes = trial.minutes, trialTarget = trial.target;
        trialTimeEl.value = String(timeMinutes); trialTargetEl.value = String(trialTarget);
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
