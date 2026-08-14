const DEFAULT_SETTINGS = createBaseTrainerDefaultSettings({
    keyboardMode: false,
    keyboardInputType: "kana",
    choiceCount: 4
});

let settings = loadTrainerSettings("reverseSettings", DEFAULT_SETTINGS);

normalizeLegacyRowSelection();
let stats = window.ModeAtlasStorage.readModeJSON("writing", "charStats", {});
let times = window.ModeAtlasStorage.readModeJSON("writing", "charTimes", {});
let srs = window.ModeAtlasStorage.readModeJSON("writing", "srs", {});

let scoreHistory = normalizeScoreHistory(window.ModeAtlasStorage.readModeJSON("writing", "scoreHistory", createDefaultScoreHistory()));
let dailyChallengeHistory = window.ModeAtlasStorage.readModeJSON("writing", "dailyHistory", {});
let highScore = window.ModeAtlasStorage.readModeNumber("writing", "highScore", 0);

let charMap = {};
let activeChars = [];
let currentChar = "";
let currentPrompt = "";
let currentChoices = [];
let streak = 0;
let hintTimeout = null;
let charStartTime = 0;
let locked = false;
let sessionStarted = false;
let sessionStats = createEmptySessionStats();

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
let currentBaseChar = "";
let recentBaseCharHistory = [];
let pendingImmediateRepeatChar = null;
let keyboardIsComposing = false;

const titleEl = document.querySelector("h1");
const sublineEl = document.querySelector(".subline");
const dailyBadgeEl = document.getElementById("dailyBadge");
const testBadgeEl = document.getElementById("testBadge");
const promptEl = document.getElementById("prompt");
const hintEl = document.getElementById("hint");
const comboTierNoticeEl = document.getElementById("comboTierNotice");
const choiceGridEl = document.getElementById("choiceGrid");
const keyboardWrapEl = document.getElementById("keyboardWrap");
const inputEl = document.getElementById("input");
const keyboardNoteEl = document.querySelector(".keyboard-note");
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
let debugActiveChar = null;
let DEBUG_PANEL = null;
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
const buttonsModeBtn = document.getElementById("buttonsModeBtn");
const keyboardModeBtn = document.getElementById("keyboardModeBtn");
const choice4Btn = document.getElementById("choice4Btn");
const choice6Btn = document.getElementById("choice6Btn");
const choice8Btn = document.getElementById("choice8Btn");

function saveAll() {
    window.ModeAtlasTrainerCore.saveTrainerState({
        mode: "writing",
        section: "writing",
        settings,
        stats,
        times,
        srs,
        scoreHistory,
        dailyChallengeHistory,
        highScore
    });
}


function buildDailySequence(dateKey = getTodayKey()) {
    return window.ModeAtlasTrainerCore.buildDailySequence({
        poolMap: DAILY_CHALLENGE_CHAR_MAP,
        count: 20,
        seed: `reverse-daily:${dateKey}`,
        rngFactory: createSeededRng
    });
}


function isRomajiKeyboardMode() {
    return !!settings.keyboardMode && settings.keyboardInputType === "romaji";
}

function isKanaKeyboardMode() {
    return !!settings.keyboardMode && settings.keyboardInputType !== "romaji";
}

function getPromptForCurrentChar(chars) {
    if (!chars) return "";
    return isRomajiKeyboardMode() ? chars : getRomajiForChars(chars);
}

function getRomajiForChars(chars) {
    const sourceMap = getAnswerMapForCurrentMode();
    return chars.split("").map(ch => sourceMap[ch] || "").join("");
}

function isHiraganaChar(char) {
    return /^[぀-ゟ]$/.test(char);
}

function isKatakanaChar(char) {
    return /^[゠-ヿ]$/.test(char);
}

function getChoicePoolForCurrentChar(correctAnswer) {
    const sourceMap = getAnswerMapForCurrentMode();
    let pool = Object.keys(sourceMap);

    if (isTestModeSession() && correctAnswer && correctAnswer.length === 1) {
        if (isHiraganaChar(correctAnswer)) {
            pool = pool.filter(ch => isHiraganaChar(ch));
        } else if (isKatakanaChar(correctAnswer)) {
            pool = pool.filter(ch => isKatakanaChar(ch));
        }
    }

    return pool;
}

function getAcceptedAnswersForCurrentChar() {
    if (!currentChar) return [];
    if (isTestModeSession()) return [currentChar];

    const sourceMap = getAnswerMapForCurrentMode();
    const candidatesByRomaji = new Map();

    for (const [candidate, romaji] of Object.entries(sourceMap)) {
        if (!candidatesByRomaji.has(romaji)) candidatesByRomaji.set(romaji, []);
        candidatesByRomaji.get(romaji).push(candidate);
    }

    const answerGroups = currentChar.split("").map(ch => {
        const romaji = sourceMap[ch] || "";
        const matches = candidatesByRomaji.get(romaji) || [];
        return matches.length ? matches : [ch];
    });

    const allAnswers = answerGroups.reduce((acc, group) => {
        const next = [];
        for (const prefix of acc) {
            for (const candidate of group) {
                next.push(prefix + candidate);
            }
        }
        return next;
    }, [""]);

    return [...new Set(allAnswers)];
}

function isAcceptedAnswer(answer) {
    return getAcceptedAnswersForCurrentChar().includes(answer);
}

function getAcceptedAnswerDisplay() {
    const answers = [...new Set(getAcceptedAnswersForCurrentChar())];
    if (!answers.length) return getDisplayAnswerForCurrentChar();
    if (answers.length === 1) return answers[0];
    return answers.join(" or ");
}

function applyDailyChallengeTheme() {
    const dailyActive = isDailyChallengeSession();
    const testActive = isTestModeSession();

    document.body.classList.toggle("daily-challenge-active", dailyActive);
    document.body.classList.toggle("test-mode-active", testActive);

    if (dailyBadgeEl) setElementVisible(dailyBadgeEl, dailyActive);
    if (testBadgeEl) setElementVisible(testBadgeEl, testActive);

    if (dailyActive) {
        titleEl.textContent = "Writing Daily Challenge";
        sublineEl.textContent = "20 questions · Match the romaji prompt to kana";
    } else if (testActive) {
        titleEl.textContent = "Writing Test Mode";
        sublineEl.textContent = "One full shuffled pass through all enabled test kana";
    } else {
        titleEl.textContent = "Writing Practice";
        sublineEl.textContent = "Match the romaji prompt to the correct kana";
    }
}

function updateDailyChallengePills() {
    const active = isDailyChallengeSession() && sessionStarted;
    setElementVisible(dailyProgressPill, active);
    setElementVisible(dailyCorrectPill, active);
    setElementVisible(dailyWrongPill, active);

    if (active) {
        dailyProgressEl.textContent = Math.min(dailyIndex + 1, 20);
        dailyCorrectEl.textContent = dailyCorrect;
        dailyWrongEl.textContent = dailyWrong;
    }

    const todayRecord = getTodayDailyRecord();
    setElementVisible(dailyOfficialPill, (active || todayRecord));
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
}

function applyPanelStates() {
    if (settings.activeBottomTab === "options") settings.activeBottomTab = null;
    modifiersContentEl.classList.toggle("open", settings.activeBottomTab === "modifiers");
    if (optionsContentEl) optionsContentEl.classList.toggle("open", false);

    modifiersTabEl.classList.toggle("active", settings.activeBottomTab === "modifiers");
    if (optionsTabEl) optionsTabEl.classList.toggle("active", false);

    modifiersTabEl.textContent = settings.activeBottomTab === "modifiers" ? "Modifiers ▲" : "Modifiers ▼";
    if (optionsTabEl) optionsTabEl.textContent = "Options ▼";

    statsContentEl.classList.toggle("hidden", !settings.statsVisible);
    statsChevronEl.textContent = settings.statsVisible ? "▼" : "▲";

    scoresContentEl.classList.toggle("hidden", !settings.scoresVisible);
    scoresChevronEl.textContent = settings.scoresVisible ? "▼" : "▲";

    document.body.classList.toggle("mobile-mode", !!settings.mobileMode);

    const testModeForcesSixChoices = isTestModeSession();
    const effectiveKeyboardMode = settings.keyboardMode;

    setElementVisible(keyboardWrapEl, effectiveKeyboardMode);
    setElementHidden(choiceGridEl, effectiveKeyboardMode);

    buttonsModeBtn.classList.toggle("btn-secondary", !effectiveKeyboardMode);
    keyboardModeBtn.classList.toggle("btn-secondary", effectiveKeyboardMode);
    buttonsModeBtn.disabled = sessionStarted;
    keyboardModeBtn.disabled = sessionStarted;

    if (effectiveKeyboardMode) {
        choice4Btn.textContent = "Romaji Keyboard";
        choice6Btn.textContent = "Kana Keyboard";
        setElementHidden(choice8Btn, true);

        choice4Btn.classList.toggle("btn-secondary", settings.keyboardInputType === "romaji");
        choice6Btn.classList.toggle("btn-secondary", settings.keyboardInputType !== "romaji");
        choice8Btn.classList.remove("btn-secondary");

        choice4Btn.disabled = sessionStarted;
        choice6Btn.disabled = sessionStarted;
        choice8Btn.disabled = true;

        inputEl.placeholder = settings.keyboardInputType === "romaji"
            ? "Type with romaji keyboard, then press Enter"
            : "Type kana...";

        if (keyboardNoteEl) {
            keyboardNoteEl.textContent = settings.keyboardInputType === "romaji"
                ? "Romaji Keyboard: the question shows kana. Type with a romaji keyboard, let it convert to kana, then press Enter to check."
                : "Kana Keyboard: the question shows romaji. Type the kana directly and it will check as you type.";
        }
    } else {
        choice4Btn.textContent = "4 Choices";
        choice6Btn.textContent = testModeForcesSixChoices ? "6 Choices" : "6 Choices";
        choice8Btn.textContent = "8 Choices";
        setElementVisible(choice8Btn, true);

        choice4Btn.classList.toggle("btn-secondary", settings.choiceCount === 4 && !testModeForcesSixChoices);
        choice6Btn.classList.toggle("btn-secondary", settings.choiceCount === 6 || testModeForcesSixChoices);
        choice8Btn.classList.toggle("btn-secondary", settings.choiceCount === 8 && !testModeForcesSixChoices);

        choice4Btn.disabled = sessionStarted || testModeForcesSixChoices;
        choice6Btn.disabled = sessionStarted || testModeForcesSixChoices;
        choice8Btn.disabled = sessionStarted || testModeForcesSixChoices;

        inputEl.placeholder = "Type kana...";
        if (keyboardNoteEl) {
            keyboardNoteEl.textContent = "Keyboard mode is optional. Buttons are the default writing practice input method.";
        }
    }
}


document.addEventListener("click", (e) => {
    if (e.target.closest(".cell")) return;
    popupLocked = false;
    hoveredCell = null;
    closePopup();
});

function getRecentRepeatCount(char, history = recentBaseCharHistory) {
    let count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i] !== char) break;
        count += 1;
    }
    return count;
}

function getRepeatSafePool(pool, options = {}) {
    const { allowImmediateRepeatChar = null, history = recentBaseCharHistory } = options;
    if (pool.length <= 1) return [...pool];

    const lastChar = history[history.length - 1] || null;
    const repeatFiltered = pool.filter(ch => getRecentRepeatCount(ch, history) < 2);
    let filtered = repeatFiltered.length ? repeatFiltered : [...pool];

    if (lastChar && filtered.length > 1 && allowImmediateRepeatChar !== lastChar) {
        const nonImmediate = filtered.filter(ch => ch !== lastChar);
        if (nonImmediate.length) filtered = nonImmediate;
    }

    return filtered;
}

function pickRandomChar(pool) {
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

function recordShownBaseChar(char) {
    if (!char) return;
    recentBaseCharHistory.push(char);
    if (recentBaseCharHistory.length > 6) recentBaseCharHistory.shift();
}

function getSrsWeightBreakdown(char, options = {}) {
    const { allowImmediateRepeatChar = null } = options;
    const st = getStats(char);
    const sr = getSrs(char);
    const now = Date.now();
    const avgTime = getAverageTime(char);
    const parts = {
        base: 1,
        focusWeak: settings.focusWeak ? Math.max(0, st.wrong * 2 - st.correct) : 0,
        overdue: 0,
        unseen: 0,
        lowLevel: 0,
        slow: 0,
        recentWrong: 0,
        forcedRepeat: 0
    };

    if (settings.srs) {
        const overdueMs = Math.max(0, now - sr.due);
        const unseenMs = sr.lastSeen ? Math.max(0, now - sr.lastSeen) : 120000;
        parts.overdue = Math.min(12, Math.floor(overdueMs / 5000));
        parts.unseen = Math.min(8, Math.floor(unseenMs / 15000));
        parts.lowLevel = Math.max(0, 4 - sr.level);
        parts.slow = Math.min(4, Math.max(0, Math.floor((avgTime - 1200) / 600)));
        parts.recentWrong = (sr.lastWrong && now - sr.lastWrong < 30000) ? 5 : 0;
    }

    if (allowImmediateRepeatChar && char === allowImmediateRepeatChar) {
        parts.forcedRepeat = 6;
    }

    const total = Math.max(1, Object.values(parts).reduce((sum, value) => sum + value, 0));
    return {
        char,
        romaji: getAnswerMapForCurrentMode()[char] || charMap[char] || '—',
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
    return debugActiveChar || currentBaseChar || currentChar || activeChars[0] || null;
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

    const info = getSrsWeightBreakdown(activeChar, { allowImmediateRepeatChar: pendingImmediateRepeatChar });

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
        debugLine("Current prompt", currentPrompt || '—'),
        debugLine("Session state", `started=${sessionStarted} · locked=${locked} · activeChars=${activeChars.length}`),
        debugLine("Settings", `focusWeak=${settings.focusWeak} · srs=${settings.srs} · dakuten=${settings.dakuten} · yoon=${settings.yoon} · extendedKatakana=${settings.extendedKatakana} · mode=${settings.keyboardMode ? 'keyboard' : 'buttons'}`),
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
            debugValueLine("highScore", highScore),
            debugValueLine("scoreHistory entries", (scoreHistory.timeTrialTop3 || []).length)
        ])
    );

    DEBUG_PANEL.replaceChildren(head, grid);
    const closeBtn = document.getElementById('closeSrsDebugBtn');
    if (closeBtn) closeBtn.onclick = closeDebugPanel;
    return DEBUG_PANEL;
}

function weightedPick(pool, options = {}) {
    const { allowImmediateRepeatChar = null, history = recentBaseCharHistory } = options;
    if (pool.length === 0) return null;

    const candidates = getRepeatSafePool(pool, { allowImmediateRepeatChar, history });
    if (candidates.length === 1) return candidates[0];

    const now = Date.now();
    const weighted = [];

    for (const ch of candidates) {
        const st = getStats(ch);
        const sr = getSrs(ch);
        let weight = 1;

        if (settings.focusWeak) {
            weight += Math.max(0, st.wrong * 2 - st.correct);
        }

        if (settings.srs) {
            const overdueMs = Math.max(0, now - sr.due);
            const unseenMs = sr.lastSeen ? Math.max(0, now - sr.lastSeen) : 120000;
            const avgTime = getAverageTime(ch);
            weight += Math.min(12, Math.floor(overdueMs / 5000));
            weight += Math.min(8, Math.floor(unseenMs / 15000));
            weight += Math.max(0, 4 - sr.level);
            weight += Math.min(4, Math.max(0, Math.floor((avgTime - 1200) / 600)));
            if (sr.lastWrong && now - sr.lastWrong < 30000) weight += 5;
        }

        if (allowImmediateRepeatChar && ch === allowImmediateRepeatChar) {
            weight += 6;
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
    for (const [rowKey, mapping] of Object.entries(dakutenRows)) {
        if (char in mapping) return rowKey.replace(/^[hk]_/, "");
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
            let comboPool = sameRowPool.filter(ch => !chars.includes(ch));
            if (!comboPool.length) comboPool = [...sameRowPool];
            const nextPick = pickRandomChar(comboPool) || firstPick;
            chars.push(nextPick);
        }
        return chars;
    }

    while (chars.length < comboLength) {
        let comboPool = pool.filter(ch => !chars.includes(ch));
        if (!comboPool.length) comboPool = [...pool];
        chars.push(weightedPick(comboPool) || firstPick);
    }

    return chars;
}

function updateSrsCorrect(char) {
    const entry = srs[char] || { level: 0, due: 0, lastSeen: 0, lastWrong: 0 };
    entry.level = Math.min(entry.level + 1, 8);
    const intervals = [3000, 8000, 15000, 30000, 60000, 120000, 300000, 600000, 1200000];
    const delay = intervals[entry.level] ?? 1200000;
    entry.due = Date.now() + delay;
    entry.lastSeen = Date.now();
    entry.lastWrong = 0;
    srs[char] = entry;
}

function scheduleHint() {
    clearHint();
    if (!settings.hint || !currentPrompt || !sessionStarted) return;

    const avg = currentChar.split("").reduce((sum, ch) => sum + getAverageTime(ch), 0) / Math.max(1, currentChar.length);
    const delay = Math.max(600, Math.round(avg * 1.2));

    hintTimeout = setTimeout(() => {
        if (locked || !sessionStarted) return;
        hintEl.textContent = currentChar[0] + "_".repeat(Math.max(0, currentChar.length - 1));
    }, delay);
}

function showIdleState() {
    clearHint();
    hideComboTierNotice();
    stopTrialTimer();
    currentChar = "";
    currentPrompt = "";
    currentChoices = [];
    currentBaseChar = "";
    pendingImmediateRepeatChar = null;
    promptEl.textContent = "—";
    promptEl.classList.remove("flash-correct", "flash-wrong", "prompt-small");
    choiceGridEl.replaceChildren();
    inputEl.value = "";
    inputEl.disabled = true;
    setElementVisible(startWrap, true);
    setSessionActionsVisible(false);
    setGameOverVisible(false);
    gameOverTitleEl.textContent = "Wrong";
    gameOverAnswerEl.textContent = "";
    setRetryButtonVisible(true);
    updateDailyChallengePills();
    applyDailyChallengeTheme();
}

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function buildChoiceOptionStrings(correctAnswer) {
    const forcedChoiceCount = isTestModeSession() ? 6 : (settings.choiceCount || 4);
    const count = Math.max(2, Math.min(8, forcedChoiceCount));
    if (!correctAnswer) return [];

    const acceptedAnswers = [...new Set(getAcceptedAnswersForCurrentChar())];
    const equivalentAnswers = acceptedAnswers.filter(answer => answer !== correctAnswer);
    const equivalentAnswerSet = new Set(equivalentAnswers);
    const answerLength = correctAnswer.length;
    const pool = getChoicePoolForCurrentChar(correctAnswer);
    if (!pool.length) return [correctAnswer];

    if (answerLength === 1) {
        const correctRomaji = getAnswerMapForCurrentMode()[correctAnswer] || "";
        const scored = pool
            .filter(ch => ch !== correctAnswer && !equivalentAnswerSet.has(ch))
            .map(ch => {
                let score = 0;
                if (getRowKeyForChar(ch) === getRowKeyForChar(correctAnswer)) score += 3;
                const romaji = getAnswerMapForCurrentMode()[ch] || "";
                if (romaji[0] === correctRomaji[0]) score += 2;
                if (romaji.slice(-1) === correctRomaji.slice(-1)) score += 2;
                return { ch, score: score + Math.random() * 3 };
            })
            .sort((a, b) => b.score - a.score)
            .map(item => item.ch);

        const distractors = scored.slice(0, Math.max(0, count - 1));

        while (1 + distractors.length < count && distractors.length < Math.max(0, pool.length - acceptedAnswers.length)) {
            const fallback = pool[Math.floor(Math.random() * pool.length)];
            if (fallback !== correctAnswer && !equivalentAnswerSet.has(fallback) && !distractors.includes(fallback)) {
                distractors.push(fallback);
            }
            if (distractors.length >= pool.length - acceptedAnswers.length) break;
        }

        const shouldIncludeEquivalent = equivalentAnswers.length > 0 && distractors.length > 0 && Math.random() < 0.35;
        if (shouldIncludeEquivalent) {
            const replaceIndex = Math.floor(Math.random() * distractors.length);
            const equivalent = equivalentAnswers[Math.floor(Math.random() * equivalentAnswers.length)];
            distractors[replaceIndex] = equivalent;
        }

        return shuffle([correctAnswer, ...distractors.slice(0, Math.max(0, count - 1))]);
    }

    const options = [correctAnswer];
    const acceptedAnswerSet = new Set(acceptedAnswers);
    while (options.length < count) {
        let candidate;
        if (settings.comboMode === "same_row" && settings.comboKana) {
            const firstRow = getRowKeyForChar(correctAnswer[0]);
            const sameRowPool = pool.filter(ch => getRowKeyForChar(ch) === firstRow);
            candidate = "";
            for (let i = 0; i < answerLength; i++) {
                const source = sameRowPool.length ? sameRowPool : pool;
                candidate += source[Math.floor(Math.random() * source.length)];
            }
        } else {
            candidate = "";
            for (let i = 0; i < answerLength; i++) {
                candidate += pool[Math.floor(Math.random() * pool.length)];
            }
        }
        if (!acceptedAnswerSet.has(candidate) && !options.includes(candidate)) options.push(candidate);
    }

    if (equivalentAnswers.length > 0 && options.length > 1 && Math.random() < 0.35) {
        const replaceIndex = 1 + Math.floor(Math.random() * (options.length - 1));
        const equivalent = equivalentAnswers[Math.floor(Math.random() * equivalentAnswers.length)];
        options[replaceIndex] = equivalent;
    }

    return shuffle(options);
}

function renderChoiceGrid() {
    if (settings.keyboardMode) {
        choiceGridEl.replaceChildren();
        return;
    }

    const columns = currentChoices.length <= 4 ? 2 : (currentChoices.length <= 6 ? 3 : 4);
    choiceGridEl.className = `choice-grid cols-${columns}`;
    choiceGridEl.replaceChildren();

    for (const answer of currentChoices) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice-btn" + (answer.length > 1 ? " choice-combo" : "");
        btn.textContent = answer;
        btn.disabled = locked || !sessionStarted;
        btn.onclick = () => handleChoiceAnswer(answer, btn);
        choiceGridEl.appendChild(btn);
    }
}

function showCurrentPrompt() {
    promptEl.textContent = currentPrompt || "—";
    promptEl.classList.toggle("prompt-small", currentPrompt.length > 3);
}

function nextCharacter() {
    if (!sessionStarted) return;

    clearHint();
    closePopup();
    inputEl.value = "";
    promptEl.classList.remove("flash-correct", "flash-wrong");

    if (isDailyChallengeSession()) {
        if (dailyIndex >= dailySequence.length) {
            endDailyChallenge();
            return;
        }

        currentChar = dailySequence[dailyIndex] || "あ";
        currentBaseChar = currentChar[0] || "";
        recordShownBaseChar(currentBaseChar);
        pendingImmediateRepeatChar = null;
        currentPrompt = getPromptForCurrentChar(currentChar);
        currentChoices = settings.keyboardMode ? [] : buildChoiceOptionStrings(currentChar);
        showCurrentPrompt();
        renderChoiceGrid();
        charStartTime = Date.now();
        gameOverTitleEl.textContent = "Wrong";
        gameOverAnswerEl.textContent = "";
        hideComboTierNotice();
        inputEl.disabled = false;
        if (settings.keyboardMode) inputEl.focus();
        updateTopStats();
    if (DEBUG_PANEL) renderDebugPanel();
        scheduleHint();
        return;
    }

    if (isTestModeSession()) {
        if (testIndex >= testSequence.length) {
            endTestMode();
            return;
        }

        currentChar = testSequence[testIndex] || "あ";
        currentBaseChar = currentChar[0] || "";
        recordShownBaseChar(currentBaseChar);
        pendingImmediateRepeatChar = null;
        currentPrompt = getPromptForCurrentChar(currentChar);
        currentChoices = settings.keyboardMode ? [] : buildChoiceOptionStrings(currentChar);
        showCurrentPrompt();
        renderChoiceGrid();
        charStartTime = Date.now();
        gameOverTitleEl.textContent = "Wrong";
        gameOverAnswerEl.textContent = "";
        hideComboTierNotice();
        inputEl.disabled = false;
        if (settings.keyboardMode) inputEl.focus();
        updateTopStats();
    if (DEBUG_PANEL) renderDebugPanel();
        scheduleHint();
        return;
    }

    rebuildCharMap();
    ensureDataObjects();

    const pool = getEligiblePool();
    const firstPick = weightedPick(pool, { allowImmediateRepeatChar: pendingImmediateRepeatChar }) || activeChars[0] || "あ";
    let displayValue = firstPick;

    if (settings.comboKana && activeChars.length > 0) {
        displayValue = buildComboCharacters(pool, firstPick).join("");
    }

    currentChar = displayValue;
    currentBaseChar = firstPick;
    recordShownBaseChar(currentBaseChar);
    pendingImmediateRepeatChar = null;
    currentPrompt = getPromptForCurrentChar(currentChar);
    currentChoices = settings.keyboardMode ? [] : buildChoiceOptionStrings(currentChar);
    showCurrentPrompt();
    renderChoiceGrid();
    charStartTime = Date.now();
    gameOverTitleEl.textContent = "Wrong";
    gameOverAnswerEl.textContent = "";

    scheduleHint();
    inputEl.disabled = false;
    if (settings.keyboardMode) inputEl.focus();
}

function flashResult(correct, onDone) {
    locked = true;
    promptEl.classList.remove("flash-correct", "flash-wrong");
    promptEl.classList.add(correct ? "flash-correct" : "flash-wrong");

    setTimeout(() => {
        promptEl.classList.remove("flash-correct", "flash-wrong");
        locked = false;
        if (onDone) onDone();
    }, correct ? 260 : 420);
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

    if (settings.comboKana) {
        const comboKey = settings.comboMode === "same_row" ? "same_row" : "random";
        scoreHistory.comboKanaBest[comboKey] = Math.max(scoreHistory.comboKanaBest[comboKey] || 0, streak);
    }

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
    } else if (currentFlowModeIsContinuous()) {
        endlessRunTotal += 1;
    }

    pendingImmediateRepeatChar = null;
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

function getDisplayAnswerForCurrentChar() {
    return settings.comboKana ? currentChar.split("").join(" + ") : currentChar;
}

function handleWrong() {
    const timeTaken = Date.now() - charStartTime;
    const correctAnswer = getAcceptedAnswerDisplay();

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

    pendingImmediateRepeatChar = currentFlowModeIsContinuous() && currentChar.length === 1 ? currentBaseChar : null;
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
            for (const btn of choiceGridEl.querySelectorAll("button")) btn.disabled = true;
        });
    }
}

function handleChoiceAnswer(answer, clickedBtn) {
    if (!sessionStarted || locked || settings.keyboardMode || isElementVisible(gameOverEl)) return;
    for (const btn of choiceGridEl.querySelectorAll("button")) btn.disabled = true;

    const acceptedAnswers = new Set(getAcceptedAnswersForCurrentChar());

    if (isAcceptedAnswer(answer)) {
        for (const btn of choiceGridEl.querySelectorAll("button")) {
            if (acceptedAnswers.has(btn.textContent)) btn.classList.add("correct");
        }
        handleCorrect();
    } else {
        clickedBtn.classList.add("wrong");
        for (const btn of choiceGridEl.querySelectorAll("button")) {
            if (acceptedAnswers.has(btn.textContent)) btn.classList.add("correct");
        }
        handleWrong();
    }
}

inputEl.addEventListener("compositionstart", () => {
    keyboardIsComposing = true;
});

inputEl.addEventListener("compositionend", () => {
    keyboardIsComposing = false;
});

inputEl.addEventListener("keydown", (event) => {
    if (!sessionStarted || locked || !settings.keyboardMode || !isRomajiKeyboardMode() || isElementVisible(gameOverEl)) return;
    if (event.key !== "Enter" || keyboardIsComposing) return;

    event.preventDefault();
    const value = inputEl.value.trim();
    if (!value) return;

    if (isAcceptedAnswer(value)) {
        handleCorrect();
    } else {
        handleWrong();
    }
});

inputEl.addEventListener("input", () => {
    if (!sessionStarted || locked || !settings.keyboardMode || !isKanaKeyboardMode() || isElementVisible(gameOverEl)) return;

    const value = inputEl.value.trim();
    if (!value) return;

    const acceptedAnswers = getAcceptedAnswersForCurrentChar();
    if (acceptedAnswers.includes(value)) {
        handleCorrect();
        return;
    }

    const hasPartialMatch = acceptedAnswers.some(answer => answer.startsWith(value) && value.length < answer.length);
    if (hasPartialMatch) return;

    const hasMismatch = acceptedAnswers.every(answer => value.length >= answer.length || !answer.startsWith(value));
    if (hasMismatch) {
        handleWrong();
    }
});

function startSession() {
    if (!isDailyChallengeSession() && !isTestModeSession() && activeChars.length === 0) {
        showIdleState();
        hintEl.textContent = "Select at least one row to begin.";
        return;
    }

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
    recentBaseCharHistory = [];
    pendingImmediateRepeatChar = null;
    currentBaseChar = "";
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


const TEST_RESULTS_KEYS = window.ModeAtlasResultsStorage.keys("writing");
const TEST_RESULTS_STORAGE_KEY = TEST_RESULTS_KEYS.primary;
const TEST_RESULTS_STORAGE_BACKUP_KEY = TEST_RESULTS_KEYS.backup;
const TEST_RESULTS_UPDATED_AT_KEY = TEST_RESULTS_KEYS.updatedAt;

function normalizeStoredTestModeResults(list) {
    return window.ModeAtlasTrainerCore.normalizeTestResults("writing", list);
}


function persistStoredTestModeResults(list) {
    return window.ModeAtlasTrainerCore.persistTestResults("writing", list);
}


function saveTestModeResult() {
    const keyboardMode = !!settings.keyboardMode;
    window.ModeAtlasTrainerCore.saveTestModeResult({
        mode: "writing",
        testStartTime,
        correct: testCorrect,
        wrong: testWrong,
        sessionStats,
        testSequence,
        settings,
        notes: "Full shuffled writing test run.",
        buildBreakdown: buildTestModeBreakdown,
        buildKanaResults: buildTestModeKanaResults,
        inputMode: keyboardMode ? "keyboard" : "buttons",
        inputVariant: keyboardMode ? (settings.keyboardInputType === "romaji" ? "romaji" : "kana") : String(settings.choiceCount || 4),
        buttonLayout: keyboardMode ? null : Number(settings.choiceCount || 4),
        keyboardLayout: keyboardMode ? (settings.keyboardInputType === "romaji" ? "romaji" : "kana") : "",
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
    promptEl.textContent = "—";
    currentChar = "";
    currentPrompt = "";
    currentChoices = [];
    currentBaseChar = "";
    pendingImmediateRepeatChar = null;

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
        title: "Writing Test Complete",
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
    setGameOverVisible(true);
    setRetryButtonVisible(false);
    setSessionActionsVisible(false);
    setElementVisible(startWrap, true);
    clearHint();
    hideComboTierNotice();
    currentChar = "";
    currentPrompt = "";
    currentChoices = [];
    currentBaseChar = "";
    pendingImmediateRepeatChar = null;
    promptEl.textContent = "—";

    if (!existing) {
        dailyChallengeHistory[dateKey] = {
            sequence: [...dailySequence],
            officialScore: dailyCorrect,
            total,
            timeMs,
            attempts: 1
        };
        gameOverTitleEl.textContent = "Daily Challenge Complete";
        gameOverAnswerEl.textContent = `Official score recorded: ${dailyCorrect}/${total}`;
    } else {
        existing.attempts = (existing.attempts || 1) + 1;
        if (!existing.sequence) existing.sequence = [...dailySequence];
        gameOverTitleEl.textContent = "Practice Replay Complete";
        gameOverAnswerEl.textContent = `Practice replay complete. ${dailyCorrect}/${total} vs Official score ${existing.officialScore}/${existing.total}`;
    }

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

function endSession(autoEnded = false) {
    if (!sessionStarted) return;
    beginTrainerSessionEnd();

    if (isDailyChallengeSession()) {
        endDailyChallenge();
        onSettingsChanged();
        return;
    }

    if (isTestModeSession()) {
        endTestMode();
        return;
    }

    sessionStarted = false;
    applyTrainerStandardSessionEnd({
        sessionStats,
        inputEl,
        startWrap,
        promptEl,
        showSessionModal,
        stopTrialTimer,
        updateBestScores,
        setGameOverVisible,
        setSessionActionsVisible,
        updateTopStats,
        renderDebugPanel,
        debugPanel: DEBUG_PANEL,
        autoEnded,
        afterPromptReset: () => {
            currentChar = "";
            currentPrompt = "";
            currentChoices = [];
            currentBaseChar = "";
            pendingImmediateRepeatChar = null;
        }
    });
    onSettingsChanged();
}


let lastChoiceAvailabilityNoticeKey = '';

function getAvailableChoiceCountForNotice() {
    try {
        if (settings.keyboardMode) return 0;
        rebuildCharMap();
        return Array.isArray(activeChars) ? activeChars.length : 0;
    } catch {
        return 0;
    }
}

function showChoiceAvailabilityNotice(availableCount) {
    const count = Number(availableCount || 0);
    if (count <= 0) return;
    window.ModeAtlasFeedback?.toast?.(`Only ${count} choices available with the current rows.`, 'warning', 2400);
}

function maybeShowChoiceAvailabilityNotice() {
    if (settings.keyboardMode) return;
    const requested = Number(settings.choiceCount || 4);
    if (requested < 6) return;
    const available = getAvailableChoiceCountForNotice();
    if (available > 0 && available < requested) {
        const key = `${requested}:${available}:${(settings.hiraganaRows || []).join(',')}:${(settings.katakanaRows || []).join(',')}`;
        if (key !== lastChoiceAvailabilityNoticeKey) {
            lastChoiceAvailabilityNoticeKey = key;
            showChoiceAvailabilityNotice(available);
        }
    }
}

function onSettingsChanged() {
    rebuildCharMap();
    ensureDataObjects();
    buildModifierButtons();
    buildOptionButtons();
    buildRows("rowOptions", hiraganaRows, "hiraganaRows", "h_");
    buildRows("katakanaRowOptions", katakanaRows, "katakanaRows", "k_");
    applyPanelStates();
    updateTrialConfigVisibility();
    maybeShowChoiceAvailabilityNotice();
    renderHeatmap();
    updateTopStats();
    if (DEBUG_PANEL) renderDebugPanel();
    renderScoreHistory();
    saveAll();

    if (!sessionStarted) {
        if (!isDailyChallengeSession() && !isTestModeSession() && !activeChars.length) {
            showIdleState();
            hintEl.textContent = "Select at least one row to begin.";
        }
        return;
    }

    if (!locked) {
        if (!currentChar) {
            nextCharacter();
            return;
        }
        currentPrompt = getPromptForCurrentChar(currentChar);
        showCurrentPrompt();
        currentChoices = settings.keyboardMode ? [] : buildChoiceOptionStrings(currentChar);
        renderChoiceGrid();
    }
}


retryBtn.addEventListener("click", () => {
    setGameOverVisible(false);
    gameOverAnswerEl.textContent = "";

    if (sessionStarted) {
        inputEl.disabled = false;
        for (const btn of choiceGridEl.querySelectorAll("button")) btn.disabled = false;
        nextCharacter();
        return;
    }

    startSession();
});

startBtn.addEventListener("click", startSession);
endSessionBtn.addEventListener("click", () => endSession(false));

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

buttonsModeBtn.addEventListener("click", () => {
    if (sessionStarted) return;
    settings.keyboardMode = false;
    onSettingsChanged();
});

keyboardModeBtn.addEventListener("click", () => {
    if (sessionStarted) return;
    settings.keyboardMode = true;
    if (!["romaji", "kana"].includes(settings.keyboardInputType)) {
        settings.keyboardInputType = "kana";
    }
    onSettingsChanged();
});

choice4Btn.addEventListener("click", () => {
    if (sessionStarted) return;
    if (settings.keyboardMode) {
        settings.keyboardInputType = "romaji";
    } else {
        settings.choiceCount = 4;
    }
    onSettingsChanged();
});

choice6Btn.addEventListener("click", () => {
    if (sessionStarted) return;
    if (settings.keyboardMode) {
        settings.keyboardInputType = "kana";
    } else {
        settings.choiceCount = 6;
    }
    onSettingsChanged();
});

choice8Btn.addEventListener("click", () => {
    if (sessionStarted || settings.keyboardMode) return;
    settings.choiceCount = 8;
    onSettingsChanged();
});


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
    const preservedBottomTab = ((settings && settings.activeBottomTab === "modifiers") || document.getElementById("modifiersContent")?.classList.contains("open")) ? "modifiers" : null;
    settings = { ...DEFAULT_SETTINGS, ...window.ModeAtlasStorage.readModeJSON("writing", "settings", DEFAULT_SETTINGS) };
    settings.activeBottomTab = preservedBottomTab;
    stats = window.ModeAtlasStorage.readModeJSON("writing", "charStats", {});
    times = window.ModeAtlasStorage.readModeJSON("writing", "charTimes", {});
    srs = window.ModeAtlasStorage.readModeJSON("writing", "srs", {});
    scoreHistory = normalizeScoreHistory(window.ModeAtlasStorage.readModeJSON("writing", "scoreHistory", createDefaultScoreHistory()));
    dailyChallengeHistory = window.ModeAtlasStorage.readModeJSON("writing", "dailyHistory", {});
    highScore = window.ModeAtlasStorage.readModeNumber("writing", "highScore", 0);
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

    if (!activeChars.length) {
        hintEl.textContent = "Select at least one row to begin.";
    } else {
        hintEl.textContent = "Press Start to begin Writing Practice.";
    }
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
    if (!sections.length || sections.includes("writing")) requestTrainerRefresh("cloud-data");
});
window.addEventListener("pageshow", (event) => {
    if (event.persisted === true) requestTrainerRefresh("bfcache-restore");
});
document.addEventListener("ma:ui-refresh", () => requestTrainerRefresh("ui-refresh"));

init();
