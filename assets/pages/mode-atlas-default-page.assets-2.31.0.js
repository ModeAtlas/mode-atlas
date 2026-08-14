const DEFAULT_SETTINGS = createBaseTrainerDefaultSettings();

(function ModeAtlasBeginnerReadingPreset(){
try{
  const params = new URLSearchParams(location.search);
  const requested = params.get("starter") || window.ModeAtlasStorage.get("modeAtlasStartReadingPreset", "") || "";
  const preset = window.ModeAtlasPresets?.normaliseId?.(requested) || (requested === "a-row" ? "starter" : requested);
  if (!preset) return;
  const applied = window.ModeAtlasPresets?.apply?.(preset, { target: "both" });
  if (!applied) return;
  const current = window.ModeAtlasStorage.json("settings", {}) || {};
  try{ if (typeof settings === "object" && settings) Object.assign(settings, current); }catch{}
  window.ModeAtlasStorage.set("modeAtlasStarterSeen", "true");
  window.ModeAtlasStorage.remove("modeAtlasStartReadingPreset");
  if (history.replaceState && location.search) history.replaceState(null, "", location.pathname);
}catch(err){console.warn("Mode Atlas starter preset failed",err)}
})();;
let settings = loadTrainerSettings("settings", DEFAULT_SETTINGS);

normalizeLegacyRowSelection();
let stats = window.ModeAtlasStorage.readModeJSON("reading", "charStats", {});
let times = window.ModeAtlasStorage.readModeJSON("reading", "charTimes", {});
let srs = window.ModeAtlasStorage.readModeJSON("reading", "srs", {});

let scoreHistory = normalizeScoreHistory(window.ModeAtlasStorage.readModeJSON("reading", "scoreHistory", createDefaultScoreHistory()));
let dailyChallengeHistory = window.ModeAtlasStorage.readModeJSON("reading", "dailyHistory", {});
let highScore = window.ModeAtlasStorage.readModeNumber("reading", "highScore", 0);

let charMap = {};
let activeChars = [];
let currentChar = "";
let streak = 0;
let hintTimeout = null;
let charStartTime = 0;
let locked = false;
let sessionStarted = false;
let sessionStats = createEmptySessionStats();
let debugActiveChar = null;
let DEBUG_PANEL = null;

let endlessRunTotal = 0;
let endlessRunWrong = 0;

let trialTimerId = null;
let trialEndTime = null;
let trialTarget = 0;
let comboTierNoticeTimeout = null;
let lastComboLength = 2;
let dailySequence = [];
let dailyIndex = 0;
let dailyCorrect = 0;
let dailyWrong = 0;
let dailyStartTime = 0;
let testSequence = [];
let testIndex = 0;
let testCorrect = 0;
let testWrong = 0;
let testStartTime = 0;

const titleEl = document.querySelector("h1");
const sublineEl = document.querySelector(".subline");
const dailyBadgeEl = document.getElementById("dailyBadge");
const testBadgeEl = document.getElementById("testBadge");
const hiraganaEl = document.getElementById("hiragana");
const hintEl = document.getElementById("hint");
const comboTierNoticeEl = document.getElementById("comboTierNotice");
const inputEl = document.getElementById("input");
const trialConfigEl = document.getElementById("trialConfig");
const comboConfigEl = document.getElementById("comboConfig");
const comboSameRowBtn = document.getElementById("comboSameRowBtn");
const comboRandomBtn = document.getElementById("comboRandomBtn");
const trialTimeEl = document.getElementById("trialTime");
const trialTargetEl = document.getElementById("trialTarget");
const trialTimerPill = document.getElementById("trialTimerPill");
const trialTimerEl = document.getElementById("trialTimer");
const dailyProgressPill = document.getElementById("dailyProgressPill");
const dailyCorrectPill = document.getElementById("dailyCorrectPill");
const dailyWrongPill = document.getElementById("dailyWrongPill");
const dailyOfficialPill = document.getElementById("dailyOfficialPill");
const dailyProgressEl = document.getElementById("dailyProgress");
const dailyCorrectEl = document.getElementById("dailyCorrect");
const dailyWrongEl = document.getElementById("dailyWrong");
const dailyOfficialEl = document.getElementById("dailyOfficial");
const testQuestionPill = document.getElementById("testQuestionPill");
const testCorrectPill = document.getElementById("testCorrectPill");
const testWrongPill = document.getElementById("testWrongPill");
const testQuestionEl = document.getElementById("testQuestion");
const testTotalEl = document.getElementById("testTotal");
const testCorrectEl = document.getElementById("testCorrect");
const testWrongEl = document.getElementById("testWrong");
const gameOverEl = document.getElementById("gameOver");
const gameOverTitleEl = gameOverEl.querySelector(".game-over-title");
const gameOverAnswerEl = document.getElementById("gameOverAnswer");
const streakEl = document.getElementById("streak");
const highScoreEl = document.getElementById("highScore");
const endlessTotalEl = document.getElementById("endlessTotal");
const endlessWrongEl = document.getElementById("endlessWrong");
const endlessTotalPill = document.getElementById("endlessTotalPill");
const endlessWrongPill = document.getElementById("endlessWrongPill");
const heatmapEl = document.getElementById("heatmap");
const popupEl = document.getElementById("popup");
let popupLocked = false;
let hoveredCell = null;
const modifiersTabEl = document.getElementById("modifiersTab");
const optionsTabEl = document.getElementById("optionsTab");
const modifiersContentEl = document.getElementById("modifiersContent");
const optionsContentEl = document.getElementById("optionsContent");
const statsHeaderEl = document.getElementById("statsHeader");
const statsContentEl = document.getElementById("statsContent");
const statsChevronEl = document.getElementById("statsChevron");
const scoresHeaderEl = document.getElementById("scoresHeader");
const scoresContentEl = document.getElementById("scoresContent");
const scoresChevronEl = document.getElementById("scoresChevron");
const retryBtn = document.getElementById("retryBtn");

const startBtn = document.getElementById("startBtn");
const startWrap = document.getElementById("startWrap");
const sessionActionsEl = document.getElementById("sessionActions");
const endSessionBtn = document.getElementById("endSessionBtn");

const trainerUiVisibility = createTrainerUiVisibilityControls({
    sessionActionsEl,
    gameOverEl,
    retryBtn
});

const {
    setSessionActionsVisible,
    setGameOverVisible,
    setRetryButtonVisible
} = trainerUiVisibility;


const bestEndlessTotalEl = document.getElementById("bestEndlessTotal");
const bestEndlessCorrectEl = document.getElementById("bestEndlessCorrect");
const bestEndlessWrongEl = document.getElementById("bestEndlessWrong");
const comboSameRowBestEl = document.getElementById("comboSameRowBest");
const comboRandomBestEl = document.getElementById("comboRandomBest");
const dailyTodayScoreEl = document.getElementById("dailyTodayScore");
const dailyTodayAttemptsEl = document.getElementById("dailyTodayAttempts");
const dailyHistoryListEl = document.getElementById("dailyHistoryList");
const timeTrialTop3El = document.getElementById("timeTrialTop3");
const speedRunTop3El = document.getElementById("speedRunTop3");

function saveAll() {
    window.ModeAtlasTrainerCore.saveTrainerState({
        mode: "reading",
        section: "reading",
        settings,
        stats,
        times,
        srs,
        scoreHistory,
        dailyChallengeHistory,
        highScore
    });
}


function getDailyChallengePoolMap() {
    return DAILY_CHALLENGE_CHAR_MAP;
}

function buildDailySequence(dateKey = getTodayKey()) {
    return window.ModeAtlasTrainerCore.buildDailySequence({
        poolMap: getDailyChallengePoolMap(),
        count: 20,
        seed: `daily:${dateKey}`,
        rngFactory: createSeededRng
    });
}



function applyDailyChallengeTheme() {
    const dailyActive = isDailyChallengeSession();
    const testActive = isTestModeSession();

    document.body.classList.toggle("daily-challenge-active", dailyActive);
    document.body.classList.toggle("test-mode-active", testActive);

    if (dailyBadgeEl) setElementVisible(dailyBadgeEl, dailyActive);
    if (testBadgeEl) setElementVisible(testBadgeEl, testActive);

    if (dailyActive) {
        titleEl.textContent = "Reading Daily Challenge";
        sublineEl.textContent = "20 questions · All hiragana, katakana, and dakuten";
    } else if (testActive) {
        titleEl.textContent = "Reading Test Mode";
        sublineEl.textContent = "One full shuffled pass through all enabled test kana";
    } else {
        titleEl.textContent = "Reading Practice";
        sublineEl.textContent = "Enter the matching romaji";
    }
}

function updateDailyChallengePills() {
    const dailyActive = isDailyChallengeSession() && sessionStarted;
    setElementVisible(dailyProgressPill, dailyActive);
    setElementVisible(dailyCorrectPill, dailyActive);
    setElementVisible(dailyWrongPill, dailyActive);

    if (dailyActive) {
        dailyProgressEl.textContent = Math.min(dailyIndex + 1, 20);
        dailyCorrectEl.textContent = dailyCorrect;
        dailyWrongEl.textContent = dailyWrong;
    }

    const todayRecord = getTodayDailyRecord();
    setElementVisible(dailyOfficialPill, dailyActive);
    dailyOfficialEl.textContent = todayRecord ? `${todayRecord.officialScore}/${todayRecord.total}` : "—";

    const testActive = isTestModeSession() && sessionStarted;
    setElementVisible(testQuestionPill, testActive);
    setElementVisible(testCorrectPill, testActive);
    setElementVisible(testWrongPill, testActive);

    if (testActive) {
        testQuestionEl.textContent = Math.min(testIndex + 1, testSequence.length || 0);
        testTotalEl.textContent = testSequence.length || 0;
        testCorrectEl.textContent = testCorrect;
        testWrongEl.textContent = testWrong;
    }

    if (testActive) updateSessionProgressBar(Math.min(testIndex + 1, testSequence.length || 0), testSequence.length || 0, 'Test progress', true);
    else if (dailyActive) updateSessionProgressBar(Math.min(dailyIndex + 1, 20), 20, 'Daily challenge', true);
    else updateSessionProgressBar(0, 0, 'Session progress', false);
}

function updateComboKanaBestScore() {
    if (!settings.comboKana) return;
    scoreHistory = normalizeScoreHistory(scoreHistory);
    const comboKey = settings.comboMode === "same_row" ? "same_row" : "random";
    scoreHistory.comboKanaBest[comboKey] = Math.max(scoreHistory.comboKanaBest[comboKey] || 0, streak);
}

function endDailyChallenge() {
    window.KanaCloudSync?.setSessionCloudPause?.(false);
    window.KanaCloudSync?.flushDeferredSessionSync?.(650);
    const dateKey = getTodayKey();
    const total = dailySequence.length || 20;
    const timeMs = Math.max(0, Date.now() - dailyStartTime);
    const existing = dailyChallengeHistory[dateKey];

    sessionStarted = false;
    sessionStats.active = false;
    inputEl.disabled = true;
    setSessionActionsVisible(false);
    setElementVisible(startWrap, true);
    clearHint();
    hideComboTierNotice();
    currentChar = "";
    hiraganaEl.textContent = "—";

    if (!existing) {
        dailyChallengeHistory[dateKey] = {
            sequence: [...dailySequence],
            officialScore: dailyCorrect,
            total,
            timeMs,
            attempts: 1
        };
        gameOverTitleEl.textContent = "Reading Daily Challenge Complete";
        gameOverAnswerEl.textContent = `Official score recorded: ${dailyCorrect}/${total}`;
    } else {
        existing.attempts = (existing.attempts || 1) + 1;
        if (!existing.sequence) existing.sequence = [...dailySequence];
        gameOverTitleEl.textContent = "Practice Replay Complete";
        gameOverAnswerEl.textContent = `Practice replay complete. ${dailyCorrect}/${total} vs Official score ${existing.officialScore}/${existing.total}`;
    }

    setGameOverVisible(true);
    buildModifierButtons();
    buildRows("rowOptions", hiraganaRows, "hiraganaRows", "h_");
    buildRows("katakanaRowOptions", katakanaRows, "katakanaRows", "k_");
    updateTrialConfigVisibility();
    updateTopStats();
    if (DEBUG_PANEL) renderDebugPanel();
    renderScoreHistory();
    applyDailyChallengeTheme();
    saveAll();
}

function validRomajiSet() {
    const sourceMap = getAnswerMapForCurrentMode();
    return new Set(Object.values(sourceMap));
}

function applyPanelStates() {
    if (settings.activeBottomTab === "options") settings.activeBottomTab = null;
    modifiersContentEl.classList.toggle("open", settings.activeBottomTab === "modifiers");
    if (optionsContentEl) optionsContentEl.classList.toggle("open", false);

    modifiersTabEl.classList.toggle("active", settings.activeBottomTab === "modifiers");
    if (optionsTabEl) optionsTabEl.classList.toggle("active", false);

    modifiersTabEl.textContent = settings.activeBottomTab === "modifiers" ? "Practice setup ▲" : "Practice setup ▼";
    if (optionsTabEl) optionsTabEl.textContent = "Options ▼";

    statsContentEl.classList.toggle("hidden", !settings.statsVisible);
    statsChevronEl.textContent = settings.statsVisible ? "▼" : "▲";

    scoresContentEl.classList.toggle("hidden", !settings.scoresVisible);
    scoresChevronEl.textContent = settings.scoresVisible ? "▼" : "▲";

    document.body.classList.toggle("mobile-mode", !!settings.mobileMode);
}


document.addEventListener("click", (e) => {
    if (e.target.closest(".cell")) return;
    popupLocked = false;
    hoveredCell = null;
    closePopup();
});

function onSettingsChanged() {

    rebuildCharMap();
    ensureDataObjects();
    buildModifierButtons();
    buildOptionButtons();
    buildRows("rowOptions", hiraganaRows, "hiraganaRows", "h_");
    buildRows("katakanaRowOptions", katakanaRows, "katakanaRows", "k_");
    applyPanelStates();
    updateTrialConfigVisibility();
    renderHeatmap();
    updateTopStats();
    if (DEBUG_PANEL) renderDebugPanel();
    renderScoreHistory();
    saveAll();

    if (sessionStarted && !locked) nextCharacter();
}

function getSrsWeightBreakdown(char) {
    const st = getStats(char);
    const sr = getSrs(char);
    const now = Date.now();
    const avgTime = getAverageTime(char);
    const unseenMs = sr.lastSeen ? Math.max(0, now - sr.lastSeen) : 60000;
    const slowMs = Math.max(0, avgTime - 1200);
    const parts = {
        base: 1,
        focusWeak: settings.focusWeak ? Math.max(0, st.wrong * 2 - st.correct) : 0,
        overdue: 0,
        lowLevel: 0,
        unseen: 0,
        firstSeenBonus: 0,
        recentWrong: 0,
        slow: 0
    };

    if (settings.srs) {
        const overdueMs = Math.max(0, now - sr.due);
        parts.overdue = Math.min(12, Math.floor(overdueMs / 5000));
        parts.lowLevel = Math.max(0, 4 - sr.level);
        parts.unseen = Math.min(6, Math.floor(unseenMs / 15000));
        parts.firstSeenBonus = sr.lastSeen ? 0 : 2;
        parts.recentWrong = (sr.lastWrong && now - sr.lastWrong < 30000) ? 5 : 0;
        parts.slow = Math.min(4, Math.floor(slowMs / 600));
    }

    const total = Math.max(1, Object.values(parts).reduce((sum, value) => sum + value, 0));
    return {
        char,
        romaji: charMap[char] || '—',
        stats: st,
        srs: sr,
        avgTime,
        parts,
        total,
        dueInMs: sr.due ? (sr.due - now) : 0,
        lastSeenAgoMs: sr.lastSeen ? (now - sr.lastSeen) : null,
        lastWrongAgoMs: sr.lastWrong ? (now - sr.lastWrong) : null
    };
}

function getDebugActiveChar() {
    return debugActiveChar || currentChar || activeChars[0] || null;
}

function debugEl(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== "") node.textContent = String(text);
    return node;
}

function debugLine(label, value) {
    const row = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = `${label}:`;
    row.append(strong, document.createTextNode(" "));
    if (value instanceof Node) row.append(value);
    else row.append(debugEl("span", "srs-debug-muted", value));
    return row;
}

function debugValueLine(label, value) {
    const row = document.createElement("div");
    row.append(document.createTextNode(`${label}: `), debugEl("strong", "", value));
    return row;
}

function debugRow(label, value, className = "") {
    const row = debugEl("div", className ? `srs-debug-row ${className}` : "srs-debug-row");
    row.append(debugEl("span", "", label), debugEl("strong", "", value));
    return row;
}

function debugCard(title, children = []) {
    const card = debugEl("div", "srs-debug-card");
    card.append(debugEl("div", "srs-debug-card-title", title), ...children);
    return card;
}

function renderDebugPanel() {
    const activeChar = getDebugActiveChar();
    if (!activeChar) return null;
    const info = getSrsWeightBreakdown(activeChar);

    if (!DEBUG_PANEL || !document.body.contains(DEBUG_PANEL)) {
        DEBUG_PANEL = document.createElement('div');
        DEBUG_PANEL.id = 'srsDebugPanel';
        Object.assign(DEBUG_PANEL.style, {
            position: 'fixed', right: '16px', bottom: '16px', zIndex: '9999',
            width: 'min(380px, calc(100vw - 32px))', maxHeight: '70vh', overflow: 'auto',
            padding: '14px', borderRadius: '16px', background: 'rgba(12,12,12,0.97)',
            border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
            fontFamily: 'Arial, sans-serif', fontSize: '12px', lineHeight: '1.45', color: '#f3f3f3'
        });
        document.body.appendChild(DEBUG_PANEL);
    }

    const head = debugEl("div", "srs-debug-head");
    head.append(debugEl("div", "srs-debug-title", "SRS Debug"));
    const close = debugEl("button", "srs-debug-close", "✕");
    close.type = "button";
    close.id = "closeSrsDebugBtn";
    head.append(close);

    const grid = debugEl("div", "srs-debug-grid");
    const romaji = debugEl("span", "srs-debug-muted", `(${info.romaji})`);
    const activeLine = document.createElement("div");
    const activeLabel = document.createElement("strong");
    activeLabel.textContent = "Active kana:";
    activeLine.append(activeLabel, document.createTextNode(` ${info.char} `), romaji);

    grid.append(
        activeLine,
        debugLine("Current shown", currentChar || '—'),
        debugLine("Session state", `started=${sessionStarted} · locked=${locked} · activeChars=${activeChars.length}`),
        debugLine("Settings", `focusWeak=${settings.focusWeak} · srs=${settings.srs} · dakuten=${settings.dakuten} · yoon=${settings.yoon} · extendedKatakana=${settings.extendedKatakana}`),
        debugCard("Weight breakdown", [
            ...Object.entries(info.parts).map(([k, v]) => debugRow(k, v)),
            debugRow("finalWeight", info.total, "srs-debug-total")
        ]),
        debugCard("Kana save data", [
            debugValueLine("correct", info.stats.correct),
            debugValueLine("wrong", info.stats.wrong),
            debugValueLine("avgTime", formatDuration(info.avgTime)),
            debugValueLine("srs.level", info.srs.level),
            debugValueLine("due in", info.dueInMs > 0 ? formatDuration(info.dueInMs) : "due now"),
            debugValueLine("lastSeen ago", info.lastSeenAgoMs === null ? "never" : formatDuration(info.lastSeenAgoMs)),
            debugValueLine("lastWrong ago", info.lastWrongAgoMs === null ? "never" : formatDuration(info.lastWrongAgoMs))
        ]),
        debugCard("Save snapshot", [
            debugValueLine("stats keys", Object.keys(stats).length),
            debugValueLine("times keys", Object.keys(times).length),
            debugValueLine("srs keys", Object.keys(srs).length),
            debugValueLine("highScore", highScore)
        ])
    );

    DEBUG_PANEL.replaceChildren(head, grid);
    const closeBtn = document.getElementById('closeSrsDebugBtn');
    if (closeBtn) closeBtn.onclick = closeDebugPanel;
    return DEBUG_PANEL;
}

window.renderDebugPanel = renderDebugPanel;
window.closeDebugPanel = closeDebugPanel;

function weightedPick(pool) {
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0];

    const now = Date.now();
    const weighted = [];

    for (const ch of pool) {
        const st = getStats(ch);
        const sr = getSrs(ch);
        const avgTime = getAverageTime(ch);
        let weight = 1;

        if (settings.focusWeak) {
            weight += Math.max(0, st.wrong * 2 - st.correct);
        }

        if (settings.srs) {
            const overdueMs = Math.max(0, now - sr.due);
            const unseenMs = sr.lastSeen ? Math.max(0, now - sr.lastSeen) : 60000;
            const slowMs = Math.max(0, avgTime - 1200);

            weight += Math.min(12, Math.floor(overdueMs / 5000));
            weight += Math.max(0, 4 - sr.level);
            weight += Math.min(6, Math.floor(unseenMs / 15000));
            if (!sr.lastSeen) weight += 2;
            if (sr.lastWrong && now - sr.lastWrong < 30000) weight += 5;
            weight += Math.min(4, Math.floor(slowMs / 600));
        }

        weight = Math.max(1, weight);
        for (let i = 0; i < weight; i++) weighted.push(ch);
    }

    return weighted[Math.floor(Math.random() * weighted.length)];
}

function getRowKeyForChar(char) {
    for (const [rowKey, mapping] of Object.entries(hiraganaRows)) {
        if (char in mapping) return rowKey.replace(/^h_/, "");
    }
    for (const [rowKey, mapping] of Object.entries(katakanaRows)) {
        if (char in mapping) return rowKey.replace(/^k_/, "");
    }
    return null;
}

function buildComboCharacters(pool, firstPick) {
    const comboLength = getComboLength();
    const chars = [firstPick];

    if (settings.comboMode === "same_row") {
        const firstRow = getRowKeyForChar(firstPick);
        let sameRowPool = pool.filter(ch => getRowKeyForChar(ch) === firstRow);
        if (sameRowPool.length === 0) sameRowPool = [firstPick];

        while (chars.length < comboLength) {
            const nextPick = sameRowPool[Math.floor(Math.random() * sameRowPool.length)] || firstPick;
            chars.push(nextPick);
        }
        return chars;
    }

    while (chars.length < comboLength) {
        chars.push(weightedPick(pool) || firstPick);
    }

    return chars;
}

function scheduleHint() {
    clearHint();
    if (!settings.hint || !currentChar || !sessionStarted) return;

    const avg = currentChar.split("").reduce((sum, ch) => sum + getAverageTime(ch), 0) / Math.max(1, currentChar.length);
    const delay = Math.max(600, Math.round(avg * 1.2));

    hintTimeout = setTimeout(() => {
        const answer = getAnswerForCurrentChar();
        if (!answer || locked || !sessionStarted) return;
        hintEl.textContent = answer[0] + "_".repeat(Math.max(0, answer.length - 1));
    }, delay);
}

function showIdleState() {
    clearHint();
    hideComboTierNotice();
    stopTrialTimer();
    currentChar = "";
    hiraganaEl.textContent = "—";
    hiraganaEl.classList.remove("flash-correct", "flash-wrong");
    inputEl.value = "";
    inputEl.disabled = true;
    setElementVisible(startWrap, true);
    setSessionActionsVisible(false);
    setGameOverVisible(false);
    gameOverTitleEl.textContent = "Wrong";
    gameOverAnswerEl.textContent = "";
    setElementHidden(trialTimerPill, true);
    updateDailyChallengePills();
    applyDailyChallengeTheme();
}

function nextCharacter() {
    if (!sessionStarted) return;

    clearHint();
    closePopup();
    inputEl.value = "";

    if (isDailyChallengeSession()) {
        if (dailyIndex >= dailySequence.length) {
            endDailyChallenge();
            return;
        }

        currentChar = dailySequence[dailyIndex] || "あ";
        hiraganaEl.textContent = currentChar;
        hiraganaEl.classList.remove("flash-correct", "flash-wrong");
        charStartTime = Date.now();
        gameOverTitleEl.textContent = "Wrong";
        gameOverAnswerEl.textContent = "";
        hideComboTierNotice();
        inputEl.disabled = false;
        inputEl.focus();
        updateTopStats();
    if (DEBUG_PANEL) renderDebugPanel();
        return;
    }

    if (isTestModeSession()) {
        if (testIndex >= testSequence.length) {
            endTestMode();
            return;
        }

        currentChar = testSequence[testIndex] || "あ";
        hiraganaEl.textContent = currentChar;
        hiraganaEl.classList.remove("flash-correct", "flash-wrong");
        charStartTime = Date.now();
        gameOverTitleEl.textContent = "Wrong";
        gameOverAnswerEl.textContent = "";
        hideComboTierNotice();
        inputEl.disabled = false;
        inputEl.focus();
        updateTopStats();
    if (DEBUG_PANEL) renderDebugPanel();
        return;
    }

    rebuildCharMap();
    ensureDataObjects();

    const pool = getEligiblePool();
    const firstPick = weightedPick(pool) || activeChars[0] || "あ";
    let displayValue = firstPick;

    if (settings.comboKana && activeChars.length > 0) {
        displayValue = buildComboCharacters(pool, firstPick).join("");
    }

    currentChar = displayValue;
    hiraganaEl.textContent = currentChar;
    hiraganaEl.classList.remove("flash-correct", "flash-wrong");
    charStartTime = Date.now();
    gameOverTitleEl.textContent = "Wrong";
    gameOverAnswerEl.textContent = "";

    scheduleHint();
    inputEl.disabled = false;
    inputEl.focus();
}

function startSession() {
    sessionStarted = true;

    const prepared = prepareTrainerSessionStart({
        isDailyChallengeSession,
        isTestModeSession,
        buildDailySequence,
        buildTestSequence,
        getComboLength
    });

    sessionStats = prepared.sessionStats;
    streak = prepared.streak;
    endlessRunTotal = prepared.endlessRunTotal;
    endlessRunWrong = prepared.endlessRunWrong;
    lastComboLength = prepared.lastComboLength;
    hideComboTierNotice();

    if (prepared.daily) {
        dailySequence = prepared.daily.sequence;
        dailyIndex = prepared.daily.index;
        dailyCorrect = prepared.daily.correct;
        dailyWrong = prepared.daily.wrong;
        dailyStartTime = prepared.daily.startTime;
    }

    if (prepared.test) {
        testSequence = prepared.test.sequence;
        testIndex = prepared.test.index;
        testCorrect = prepared.test.correct;
        testWrong = prepared.test.wrong;
        testStartTime = prepared.test.startTime;
    }

    locked = false;
    applyTrainerSessionStartUi({
        debugPanel: DEBUG_PANEL,
        gameOverTitleEl,
        startWrap,
        inputEl,
        trialTimerPill,
        settings,
        isDailyChallengeSession,
        setGameOverVisible,
        setRetryButtonVisible,
        setSessionActionsVisible,
        updateTopStats,
        renderDebugPanel
    });

    trialTarget = startTrainerTimedSession({
        settings,
        trialTimeEl,
        trialTargetEl,
        isDailyChallengeSession,
        startTimedModeTimer
    });

    onSettingsChanged();
}

function updateSrsCorrect(char) {
    const entry = srs[char] || { level: 0, due: 0, lastSeen: 0, lastWrong: 0 };
    entry.level = Math.min(entry.level + 1, 8);
    const intervals = [3000, 8000, 15000, 30000, 60000, 120000, 300000, 600000, 1200000];
    const delay = intervals[entry.level] ?? 1200000;
    entry.due = Date.now() + delay;
    entry.lastSeen = Date.now();
    srs[char] = entry;
}

function flashResult(correct, onDone) {
    locked = true;
    hiraganaEl.classList.remove("flash-correct", "flash-wrong");
    hiraganaEl.classList.add(correct ? "flash-correct" : "flash-wrong");

    setTimeout(() => {
        hiraganaEl.classList.remove("flash-correct", "flash-wrong");
        locked = false;
        if (onDone) onDone();
    }, correct ? 260 : 420);
}

function getAnswerForCurrentChar() {
    const sourceMap = getAnswerMapForCurrentMode();
    return currentChar.split("").map(ch => sourceMap[ch] || "").join("");
}

function getDisplayAnswerForCurrentChar() {
    const sourceMap = getAnswerMapForCurrentMode();
    const parts = currentChar.split("").map(ch => sourceMap[ch] || "");
    return settings.comboKana ? parts.join(" + ") : parts.join("");
}

function handleCorrect() {
    const timeTaken = Date.now() - charStartTime;

    for (const ch of currentChar.split("")) {
        if (!stats[ch]) stats[ch] = { correct: 0, wrong: 0 };
        stats[ch].correct += 1;
        updateAverageTime(ch, timeTaken / Math.max(1, currentChar.length));
        updateSrsCorrect(ch);
    }

    streak += 1;
    highScore = Math.max(highScore, streak);
    updateComboKanaBestScore();

    const nextComboLength = getComboLength();
    if (settings.comboKana && nextComboLength > lastComboLength) showComboTierNotice(nextComboLength);
    lastComboLength = nextComboLength;

    sessionStats.answered += 1;
    sessionStats.correct += 1;
    window.ModeAtlasTrainerControls?.recordPresetCorrect?.(1);
    sessionStats.timings.push(timeTaken);
    sessionStats.bestStreak = Math.max(sessionStats.bestStreak, streak);
    updateSessionChar(currentChar, true, timeTaken);

    if (isDailyChallengeSession()) {
        dailyCorrect += 1;
        dailyIndex += 1;
    } else if (isTestModeSession()) {
        testCorrect += 1;
        testIndex += 1;
    } else if (currentFlowModeIsContinuous()) endlessRunTotal += 1;

    updateTopStats();
    if (DEBUG_PANEL) renderDebugPanel();
    renderHeatmap();
    renderScoreHistory();
    saveAll();

    if (isTestModeSession()) {
        flashResult(true, () => advanceTestModeAfterAnswer());
        return;
    }

    flashResult(true, () => nextCharacter());
}

function handleWrong() {
    const timeTaken = Date.now() - charStartTime;
    const correctAnswer = getDisplayAnswerForCurrentChar();

    for (const ch of currentChar.split("")) {
        if (!stats[ch]) stats[ch] = { correct: 0, wrong: 0 };
        stats[ch].wrong += 1;
        updateAverageTime(ch, timeTaken / Math.max(1, currentChar.length));
        updateSrsWrong(ch);
    }

    sessionStats.answered += 1;
    sessionStats.wrong += 1;
    sessionStats.timings.push(timeTaken);
    sessionStats.bestStreak = Math.max(sessionStats.bestStreak, streak);
    updateSessionChar(currentChar, false, timeTaken);

    if (isDailyChallengeSession()) {
        dailyWrong += 1;
        dailyIndex += 1;
    } else if (isTestModeSession()) {
        testWrong += 1;
        testIndex += 1;
    } else if (currentFlowModeIsContinuous()) {
        endlessRunTotal += 1;
        endlessRunWrong += 1;
    }

    streak = 0;
    lastComboLength = getComboLength();
    hideComboTierNotice();
    updateTopStats();
    if (DEBUG_PANEL) renderDebugPanel();
    renderHeatmap();
    saveAll();

    if (isDailyChallengeSession()) {
        hintEl.textContent = `Answer: ${correctAnswer}`;
        flashResult(false, () => nextCharacter());
    } else if (isTestModeSession()) {
        hintEl.textContent = `Answer: ${correctAnswer}`;
        flashResult(false, () => advanceTestModeAfterAnswer());
    } else if (currentFlowModeIsContinuous()) {
        hintEl.textContent = `Answer: ${correctAnswer}`;
        flashResult(false, () => nextCharacter());
    } else {
        gameOverAnswerEl.textContent = `Correct answer: ${correctAnswer}`;
        flashResult(false, () => {
            setGameOverVisible(true);
            setRetryButtonVisible(true);
            inputEl.disabled = true;
        });
    }
}

inputEl.addEventListener("input", () => {
    if (!sessionStarted || locked || isElementVisible(gameOverEl)) return;

    const value = inputEl.value.trim().toLowerCase();
    if (!value) return;

    const expected = getAnswerForCurrentChar();
    const compactValue = value.replace(/\s+/g, "");
    const valid = validRomajiSet();

    if (compactValue === expected) {
        handleCorrect();
        return;
    }

    if (expected.startsWith(compactValue) && compactValue.length < expected.length) return;

    if (settings.comboKana || isDailyChallengeSession() || valid.has(value) || compactValue.length >= expected.length) {
        handleWrong();
    }
});

retryBtn.addEventListener("click", () => {
    setGameOverVisible(false);
    gameOverAnswerEl.textContent = "";

    if (sessionStarted) {
        inputEl.disabled = false;
        nextCharacter();
        return;
    }

    startSession();
});

startBtn.addEventListener("click", startSession);

comboSameRowBtn.addEventListener("click", () => {
    if (sessionStarted) return;
    settings.comboMode = "same_row";
    comboSameRowBtn.classList.add("active");
    comboRandomBtn.classList.remove("active");
    updateTrialConfigVisibility();
    saveAll();
});

comboRandomBtn.addEventListener("click", () => {
    if (sessionStarted) return;
    settings.comboMode = "random";
    comboRandomBtn.classList.add("active");
    comboSameRowBtn.classList.remove("active");
    updateTrialConfigVisibility();
    saveAll();
});


const TEST_RESULTS_KEYS = window.ModeAtlasResultsStorage.keys("reading");
const TEST_RESULTS_STORAGE_KEY = TEST_RESULTS_KEYS.primary;
const TEST_RESULTS_STORAGE_BACKUP_KEY = TEST_RESULTS_KEYS.backup;
const TEST_RESULTS_UPDATED_AT_KEY = TEST_RESULTS_KEYS.updatedAt;

function normalizeStoredTestModeResults(list) {
    return window.ModeAtlasTrainerCore.normalizeTestResults("reading", list);
}


function persistStoredTestModeResults(list) {
    return window.ModeAtlasTrainerCore.persistTestResults("reading", list);
}


function saveTestModeResult() {
    window.ModeAtlasTrainerCore.saveTestModeResult({
        mode: "reading",
        testStartTime,
        correct: testCorrect,
        wrong: testWrong,
        sessionStats,
        testSequence,
        settings,
        notes: "Full shuffled reading test run.",
        buildBreakdown: buildTestModeBreakdown,
        buildKanaResults: buildTestModeKanaResults,
        loadResults: loadStoredTestModeResults,
        persistResults: persistStoredTestModeResults
    });
}


function endTestMode() {
    window.KanaCloudSync?.setSessionCloudPause?.(false);
    window.KanaCloudSync?.flushDeferredSessionSync?.(650);
    const durationMs = Math.max(0, Date.now() - testStartTime);
    const totalAnswered = testCorrect + testWrong;
    const scorePct = totalAnswered ? Math.round((testCorrect / totalAnswered) * 100) : 0;

    saveTestModeResult();

    sessionStarted = false;
    sessionStats.active = false;
    locked = false;
    stopTrialTimer();
    inputEl.disabled = true;
    setGameOverVisible(false);
    setRetryButtonVisible(true);
    setSessionActionsVisible(false);
    setElementVisible(startWrap, true);
    clearHint();
    hiraganaEl.textContent = "—";
    currentChar = "";

    const testDialogContent = document.createElement("div");
    testDialogContent.className = "ma-session-dialog-content";
    const testDialogGrid = document.createElement("div");
    testDialogGrid.className = "modal-grid ma-session-dialog-grid";
    window.ModeAtlasTrainerCore.renderStatCardsInto(testDialogGrid, [
        ["Score", `${scorePct}%`],
        ["Correct", testCorrect],
        ["Wrong", testWrong],
        ["Questions", testSequence.length || totalAnswered || 0],
        ["Avg Time", formatDuration(sessionStats.timings.length ? average(sessionStats.timings) : 0)],
        ["Test Time", formatDuration(durationMs)]
    ]);
    testDialogContent.append(testDialogGrid);
    window.ModeAtlasDialog?.feature?.({
        kicker: "Formal test",
        title: "Reading Test Complete",
        contentNode: testDialogContent,
        size: "wide"
    });

    updateTopStats();
    if (DEBUG_PANEL) renderDebugPanel();
    renderScoreHistory();
    saveAll();
    onSettingsChanged();
}
function updateBestScores() {
    scoreHistory = normalizeScoreHistory(scoreHistory);

    if (settings.comboKana) {
        updateComboKanaBestScore();
    }

    if (settings.endless) {
        const correct = Math.max(0, endlessRunTotal - endlessRunWrong);
        if (correct > (scoreHistory.endlessBest.correct || 0)) {
            scoreHistory.endlessBest = {
                total: endlessRunTotal,
                correct,
                wrong: endlessRunWrong
            };
        }
    }

    if (settings.speedRun) {
        const correct = Math.max(0, endlessRunTotal - endlessRunWrong);
        const answered = Math.max(0, endlessRunTotal);
        const wrong = Math.max(0, endlessRunWrong);
        const durationMs = Math.max(1, (sessionStats.endTime || Date.now()) - (sessionStats.startTime || Date.now()));
        const avgMs = sessionStats.timings.length ? Math.round(average(sessionStats.timings)) : 0;
        const accuracy = answered ? correct / answered : 0;
        const score = Math.max(0, Math.round((correct * 100) + (accuracy * 250) - (wrong * 50) - (avgMs / 20)));
        const entry = {
            durationSeconds: Math.round(durationMs / 1000),
            answered,
            correct,
            wrong,
            accuracy: Math.round(accuracy * 100),
            avgMs,
            score
        };
        scoreHistory.speedRunTop3.push(entry);
        scoreHistory.speedRunTop3.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.correct !== a.correct) return b.correct - a.correct;
            if (a.avgMs !== b.avgMs) return a.avgMs - b.avgMs;
            return a.wrong - b.wrong;
        });
        scoreHistory.speedRunTop3 = scoreHistory.speedRunTop3.slice(0, 3);
    }

    if (settings.timeTrial) {
        const timeVal = Number(trialTimeEl.value) || 0.5;
        const entry = {
            time: timeVal,
            target: trialTarget || Math.max(1, Number(trialTargetEl.value) || 20),
            score: sessionStats.correct,
            ratio: sessionStats.correct / Math.max(0.1, timeVal),
            overTarget: sessionStats.correct - (trialTarget || Math.max(1, Number(trialTargetEl.value) || 20))
        };

        scoreHistory.timeTrialTop3.push(entry);
        scoreHistory.timeTrialTop3.sort((a, b) => {
            if (b.overTarget !== a.overTarget) return b.overTarget - a.overTarget;
            if (b.ratio !== a.ratio) return b.ratio - a.ratio;
            return b.score - a.score;
        });
        scoreHistory.timeTrialTop3 = scoreHistory.timeTrialTop3.slice(0, 3);
    }

    renderScoreHistory();
    saveAll();
}

function showSessionModal(autoEnded = false) {
    showTrainerSessionModal({
        autoEnded,
        sessionStats,
        settings,
        endlessRunTotal,
        endlessRunWrong,
        trialTarget
    });
}

function endSession(autoEnded = false) {
    if (!sessionStarted) return;
    beginTrainerSessionEnd();

    if (isDailyChallengeSession()) {
        sessionStarted = false;
        sessionStats.active = false;
        applyTrainerDailyStopUi({
            inputEl,
            startWrap,
            promptEl: hiraganaEl,
            stopTrialTimer,
            setGameOverVisible,
            setSessionActionsVisible,
            updateTopStats,
            renderDebugPanel,
            debugPanel: DEBUG_PANEL,
            afterPromptReset: () => { currentChar = ""; }
        });
        onSettingsChanged();
        return;
    }

    sessionStarted = false;
    applyTrainerStandardSessionEnd({
        sessionStats,
        inputEl,
        startWrap,
        promptEl: hiraganaEl,
        showSessionModal,
        stopTrialTimer,
        updateBestScores,
        setGameOverVisible,
        setSessionActionsVisible,
        updateTopStats,
        renderDebugPanel,
        debugPanel: DEBUG_PANEL,
        autoEnded,
        afterPromptReset: () => { currentChar = ""; }
    });
    onSettingsChanged();
}

endSessionBtn.addEventListener("click", () => endSession(false));



if (modifiersContentEl && !modifiersContentEl.dataset.maClickGuard) {
    modifiersContentEl.dataset.maClickGuard = "true";
    modifiersContentEl.addEventListener("click", (event) => event.stopPropagation());
}
modifiersTabEl.addEventListener("click", () => setBottomTab("modifiers"));
if (optionsTabEl) optionsTabEl.addEventListener("click", () => setBottomTab("options"));

statsHeaderEl.addEventListener("click", () => {
    settings.statsVisible = !settings.statsVisible;
    applyPanelStates();
    saveAll();
});

scoresHeaderEl.addEventListener("click", () => {
    settings.scoresVisible = !settings.scoresVisible;
    applyPanelStates();
    saveAll();
});

function refreshSaveBackedStateFromCloud() {
    const preservedBottomTab = (settings && settings.activeBottomTab === "modifiers") || document.getElementById("modifiersContent")?.classList.contains("open") ? "modifiers" : null;
    settings = { ...DEFAULT_SETTINGS, ...window.ModeAtlasStorage.readModeJSON("reading", "settings", DEFAULT_SETTINGS) };
    settings.activeBottomTab = preservedBottomTab;
    stats = window.ModeAtlasStorage.readModeJSON("reading", "charStats", {});
    times = window.ModeAtlasStorage.readModeJSON("reading", "charTimes", {});
    srs = window.ModeAtlasStorage.readModeJSON("reading", "srs", {});
    scoreHistory = normalizeScoreHistory(window.ModeAtlasStorage.readModeJSON("reading", "scoreHistory", createDefaultScoreHistory()));
    dailyChallengeHistory = window.ModeAtlasStorage.readModeJSON("reading", "dailyHistory", {});
    highScore = window.ModeAtlasStorage.readModeNumber("reading", "highScore", 0);
    if (!Array.isArray(settings.hiraganaRows)) settings.hiraganaRows = Object.keys(hiraganaRows);
    if (!Array.isArray(settings.katakanaRows)) settings.katakanaRows = [];
    if (!["same_row", "random"].includes(settings.comboMode)) settings.comboMode = "random";
    rebuildCharMap();
    ensureDataObjects();
    buildModifierButtons();
    buildOptionButtons();
    buildRows("rowOptions", hiraganaRows, "hiraganaRows", "h_");
    buildRows("katakanaRowOptions", katakanaRows, "katakanaRows", "k_");
    applyPanelStates();
    updateTrialConfigVisibility();
    updateTopStats();
    renderHeatmap();
    renderScoreHistory();
    if (!sessionStarted) showIdleState();
    if (DEBUG_PANEL) renderDebugPanel();
    window.ModeAtlasLifecycle?.emit?.('trainer-ready', { page: window.ModeAtlasPageName?.() || '' });
}

window.refreshSaveBackedStateFromCloud = refreshSaveBackedStateFromCloud;

function init() {
    rebuildCharMap();

    if (!Array.isArray(settings.hiraganaRows)) settings.hiraganaRows = Object.keys(hiraganaRows);
    if (!Array.isArray(settings.katakanaRows)) settings.katakanaRows = [];
    if (!["same_row", "random"].includes(settings.comboMode)) settings.comboMode = "random";
    scoreHistory = normalizeScoreHistory(scoreHistory);

    ensureDataObjects();
    buildModifierButtons();
    buildOptionButtons();
    buildRows("rowOptions", hiraganaRows, "hiraganaRows", "h_");
    buildRows("katakanaRowOptions", katakanaRows, "katakanaRows", "k_");
    applyPanelStates();
    updateTrialConfigVisibility();
    updateTopStats();
    if (DEBUG_PANEL) renderDebugPanel();
    renderHeatmap();
    renderScoreHistory();
    showIdleState();
    // Do not save during initial boot; wait for actual user changes.
}

let trainerRefreshQueued = false;

function requestTrainerRefresh(source = "unknown") {
    if (trainerRefreshQueued) return;
    trainerRefreshQueued = true;
    const run = () => {
        trainerRefreshQueued = false;
        try { refreshSaveBackedStateFromCloud(); }
        catch (err) { console.warn("Trainer refresh failed", source, err); }
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
    else setTimeout(run, 0);
}

// Trainers render local save data immediately. Cloud-sync owns Firebase/auth/
// hydration and emits this event only when it actually writes newer cloud data
// into local storage. Status/focus changes never trigger another cloud read.
window.addEventListener("modeAtlasCloudDataChanged", (event) => {
    const sections = Array.isArray(event.detail?.sections) ? event.detail.sections : [];
    if (!sections.length || sections.includes("reading")) requestTrainerRefresh("cloud-data");
});
window.addEventListener("pageshow", (event) => {
    if (event.persisted === true) requestTrainerRefresh("bfcache-restore");
});
document.addEventListener("ma:ui-refresh", () => requestTrainerRefresh("ui-refresh"));

init();
