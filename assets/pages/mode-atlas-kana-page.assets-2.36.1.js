// Kana is local-first. cloud-sync.js owns Firebase/auth/hydration globally;
// this page only rerenders when cloud-sync reports that save data actually changed.

(function ModeAtlasKanaHub(){
    const M = () => window.ModeAtlasKanaMetrics;
    const Store = window.ModeAtlasStorage;
    const $ = (sel, root = document) => root.querySelector(sel);

    function storeGet(key, fallback = '') {
        return Store?.get?.(key, fallback) ?? localStorage.getItem(key) ?? fallback;
    }

    function storeSet(key, value) {
        return Store?.set?.(key, value) ?? localStorage.setItem(key, String(value));
    }

    function loadJSON(key, fallback) {
        try {
            if (window.ModeAtlasStorage?.json) return window.ModeAtlasStorage.json(key, fallback);
            const raw = storeGet(key, null);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    function loadNumber(key, fallback = 0) {
        try {
            if (window.ModeAtlasStorage?.number) return window.ModeAtlasStorage.number(key, fallback);
            const value = Number(storeGet(key, fallback));
            return Number.isFinite(value) ? value : fallback;
        } catch {
            return fallback;
        }
    }


    function kanaEl(tag, className = '', text = '') {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== '') el.textContent = String(text);
        return el;
    }

    function kanaButton(className = '', text = '') {
        const button = kanaEl('button', className, text);
        button.type = 'button';
        return button;
    }

    function kanaLink(className = '', text = '', href = '') {
        const link = kanaEl('a', className, text);
        link.href = href;
        return link;
    }

    function progressBar(percent) {
        const bar = document.createElement('i');
        const fill = document.createElement('b');
        fill.dataset.maProgress = String(percent);
        bar.append(fill);
        return bar;
    }

    function appendLabelValue(parent, label, value) {
        const item = document.createElement('div');
        item.append(kanaEl('span','',label), kanaEl('strong','',value));
        parent.append(item);
        return item;
    }

    function todayKey(value) {
        if (window.ModeAtlasDates?.localDateKey) return window.ModeAtlasDates.localDateKey(value);
        const now = value instanceof Date ? new Date(value.getTime()) : new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }

    function normaliseScoreHistory(data) {
        return {
            endlessBest: { total: 0, correct: 0, wrong: 0, ...((data || {}).endlessBest || {}) },
            speedRunTop3: Array.isArray((data || {}).speedRunTop3) ? data.speedRunTop3 : [],
            comboKanaBest: { same_row: 0, random: 0, ...((data || {}).comboKanaBest || {}) },
            timeTrialTop3: Array.isArray((data || {}).timeTrialTop3) ? data.timeTrialTop3 : []
        };
    }

    function formatMs(ms) {
        const n = Number(ms || 0);
        if (!Number.isFinite(n) || n <= 0) return '—';
        return n < 1000 ? `${Math.round(n)}ms` : `${(n / 1000).toFixed(1)}s`;
    }

    function modeTotals(stats) {
        let correct = 0, wrong = 0, seen = 0;
        Object.values(stats || {}).forEach(item => {
            if (!item || typeof item !== 'object') return;
            const c = Number(item.correct || item.right || 0);
            const w = Number(item.wrong || item.incorrect || 0);
            if (c + w > 0) seen += 1;
            correct += c;
            wrong += w;
        });
        const attempts = correct + wrong;
        return { correct, wrong, attempts, seen, accuracy: attempts ? Math.round((correct / attempts) * 100) : 0 };
    }

    function dailyEntries(history) {
        return Object.entries(history || {})
            .map(([date, entry]) => ({ date, entry: entry || {} }))
            .sort((a, b) => b.date.localeCompare(a.date));
    }

    function dailyStatus(history) {
        const today = history?.[todayKey()] || null;
        const entries = dailyEntries(history);
        const best = entries.reduce((pick, item) => {
            const score = Number(item.entry.officialScore || 0);
            if (!pick || score > pick.score) return { ...item, score };
            return pick;
        }, null);
        return { today, entries, best };
    }

    function collectKanaSnapshot() {
        return {
            readingStats: Store.readModeJSON('reading', 'charStats', {}),
            writingStats: Store.readModeJSON('writing', 'charStats', {}),
            readingTimes: Store.readModeJSON('reading', 'charTimes', {}),
            writingTimes: Store.readModeJSON('writing', 'charTimes', {})
        };
    }

    function collectSummaries(snapshot) {
        snapshot = snapshot || collectKanaSnapshot();
        const readingStats = snapshot.readingStats || {};
        const writingStats = snapshot.writingStats || {};
        const readingDaily = Store.readModeJSON('reading', 'dailyHistory', {});
        const writingDaily = Store.readModeJSON('writing', 'dailyHistory', {});
        return {
            reading: {
                mode: 'reading',
                label: 'Reading',
                href: '../reading/',
                totals: modeTotals(readingStats),
                highScore: Store.readModeNumber('reading', 'highScore', 0),
                scoreHistory: normaliseScoreHistory(Store.readModeJSON('reading', 'scoreHistory', {})),
                daily: dailyStatus(readingDaily)
            },
            writing: {
                mode: 'writing',
                label: 'Writing',
                href: '../writing/',
                totals: modeTotals(writingStats),
                highScore: Store.readModeNumber('writing', 'highScore', 0),
                scoreHistory: normaliseScoreHistory(Store.readModeJSON('writing', 'scoreHistory', {})),
                daily: dailyStatus(writingDaily)
            }
        };
    }

    function allKana() {
        return Array.isArray(M()?.ALL) ? M().ALL : [];
    }

    function timingAverage(value) {
        let n = 0;
        if (typeof value === 'number') n = Number(value);
        else if (value && typeof value === 'object') n = Number(value.avg || value.average || value.time || 0);
        return n ? (n < 30 ? n * 1000 : n) : 0;
    }

    function combinedKanaStats(ch, snapshot) {
        const reading = snapshot?.readingStats?.[ch] || {};
        const writing = snapshot?.writingStats?.[ch] || {};
        const correct = Number(reading.correct || reading.right || 0) + Number(writing.correct || writing.right || 0);
        const wrong = Number(reading.wrong || reading.incorrect || 0) + Number(writing.wrong || writing.incorrect || 0);
        const times = [timingAverage(snapshot?.readingTimes?.[ch]), timingAverage(snapshot?.writingTimes?.[ch])].filter(Boolean);
        const avg = times.length ? times.reduce((sum, value) => sum + value, 0) / times.length : 0;
        return { correct, wrong, avg };
    }

    function masteryFor(ch, snapshot) {
        const stats = combinedKanaStats(ch, snapshot);
        const correct = stats.correct;
        const wrong = stats.wrong;
        const attempts = correct + wrong;
        const accuracy = attempts ? (correct / attempts) * 100 : 0;
        const displayAccuracy = Math.round(accuracy);
        const avg = stats.avg;
        let stage = 'New';
        if (attempts > 0) {
            if (correct >= 50 && accuracy >= 95 && avg > 0 && avg <= 1000) stage = 'Mastered';
            else if (correct >= 10 && accuracy >= 85 && (!avg || avg <= 2500)) stage = 'Reviewing';
            else stage = 'Learning';
        }
        const priority = attempts
            ? (stage === 'Learning' ? 4 : stage === 'Reviewing' ? 3 : stage === 'Mastered' ? 1 : 5)
                + (wrong * 0.18)
                + (avg ? Math.min(avg / 2500, 2) : 1)
                - (accuracy / 100)
            : 0;
        return { ch, correct, wrong, attempts, accuracy: displayAccuracy, accuracyRaw: accuracy, avg, stage, priority };
    }

    function masterySummary(snapshot) {
        const items = allKana().map(ch => masteryFor(ch, snapshot));
        const counts = { New: 0, Learning: 0, Reviewing: 0, Mastered: 0 };
        items.forEach(item => { counts[item.stage] += 1; });
        const seen = items.filter(item => item.attempts > 0).length;
        const timed = items.filter(item => item.avg > 0);
        const average = timed.length ? timed.reduce((sum, item) => sum + item.avg, 0) / timed.length : 0;
        const weak = items
            .filter(item => item.attempts > 0 && item.stage !== 'Mastered')
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 6);
        const slowest = timed
            .slice()
            .sort((a, b) => b.avg - a.avg)
            .slice(0, 4);
        return { items, counts, seen, total: items.length, average, weak, slowest };
    }

    function trainerStreak() {
        const dateSet = new Set();
        const addHistory = (history) => Object.keys(history || {}).forEach(key => {
            const date = String(key || '').slice(0, 10);
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) dateSet.add(date);
        });
        addHistory(Store.readModeJSON('reading', 'dailyHistory', {}));
        addHistory(Store.readModeJSON('writing', 'dailyHistory', {}));

        const resultKeys = [
            'testModeResults','readingTestModeResults','kanaTrainerReadingTestModeResults',
            'writingTestModeResults','kanaTrainerWritingTestModeResults','reverseTestModeResults'
        ];
        resultKeys.forEach(key => {
            const arr = loadJSON(key, []);
            if (!Array.isArray(arr)) return;
            arr.forEach(item => {
                const raw = item?.date || item?.completedAt || item?.createdAt || item?.startedAt || '';
                const parsed = String(raw).slice(0, 10);
                if (/^\d{4}-\d{2}-\d{2}$/.test(parsed)) dateSet.add(parsed);
            });
        });

        const lastVisit = storeGet('modeAtlasLastVisitStudyDate', '');
        if (/^\d{4}-\d{2}-\d{2}$/.test(lastVisit || '')) dateSet.add(lastVisit);

        let count = 0;
        const d = new Date();
        for (;;) {
            const key = todayKey(d);
            if (!dateSet.has(key)) break;
            count += 1;
            d.setDate(d.getDate() - 1);
        }
        return count;
    }

    function formalTestCount() {
        return M()?.formalTestCount?.() || 0;
    }

    function pct(value, total) {
        return Math.max(0, Math.min(100, total ? Math.round((Number(value || 0) / total) * 100) : 0));
    }

    function applyHubVisuals(root = document) {
        window.ModeAtlasUi?.applyProgressWidths?.(root);
        const scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('[data-ma-progress]').forEach(el => {
            const value = Math.max(0, Math.min(100, Number(el.dataset.maProgress || 0)));
            el.style.setProperty('--ma-progress', `${value}%`);
            el.style.width = `${value}%`;
        });
        scope.querySelectorAll('[data-ring-pct]').forEach(el => {
            const value = Math.max(0, Math.min(100, Number(el.dataset.ringPct || 0)));
            el.style.setProperty('--pct', String(value));
            if (el.dataset.ringColor) el.style.setProperty('--ring-color', el.dataset.ringColor);
        });
    }


    function compactKanaList(items, limit = 4, formatter = item => item.ch || item) {
        const list = Array.isArray(items) ? items : [];
        const visible = list.slice(0, limit).map(formatter).join(' · ');
        return list.length > limit ? `${visible} +${list.length - limit}` : (visible || 'Build more history');
    }

    function stageCopy(stage) {
        return {
            New: 'Not started yet',
            Learning: 'Building confidence',
            Reviewing: 'Reliable, building speed',
            Mastered: 'Fast, accurate, proven'
        }[stage] || '';
    }

    function bestRunCards(reading, writing) {
        const readingSpeed = reading.scoreHistory.speedRunTop3[0]?.score || 0;
        const writingSpeed = writing.scoreHistory.speedRunTop3[0]?.score || 0;
        const readingTrial = reading.scoreHistory.timeTrialTop3[0]?.score || 0;
        const writingTrial = writing.scoreHistory.timeTrialTop3[0]?.score || 0;
        return [
            ['Endless', Math.max(reading.scoreHistory.endlessBest.correct || 0, writing.scoreHistory.endlessBest.correct || 0), 'best correct streak'],
            ['Speed Run', Math.max(readingSpeed, writingSpeed), 'top speed score'],
            ['Time Trial', Math.max(readingTrial, writingTrial), 'best listed score'],
            ['Combo', Math.max(reading.scoreHistory.comboKanaBest.same_row || 0, writing.scoreHistory.comboKanaBest.same_row || 0, reading.scoreHistory.comboKanaBest.random || 0, writing.scoreHistory.comboKanaBest.random || 0), 'best combo streak']
        ];
    }

    function recommendedAction(summaries, mastery) {
        const weak = mastery.weak.slice(0, 4);
        if (weak.length) {
            return {
                title: `Review ${weak.map(item => item.ch).join(' · ')}`,
                text: 'These kana are currently holding back accuracy, speed, or reliable reps.',
                href: '../reading/?focusWeak=1',
                label: 'Start smart review',
                kind: 'review'
            };
        }
        if (mastery.counts.New > 0) {
            return {
                title: 'Start with fresh kana',
                text: 'You still have new kana waiting. Build a little history, then the hub will suggest smarter reviews.',
                href: '../reading/',
                label: 'Start Reading',
                kind: 'new'
            };
        }
        const readingAcc = summaries.reading.totals.accuracy || 0;
        const writingAcc = summaries.writing.totals.accuracy || 0;
        if (readingAcc - writingAcc > 12) {
            return { title: 'Balance recall practice', text: 'Writing is behind Reading. A short Writing session will strengthen active recall.', href: '../writing/', label: 'Go to Writing', kind: 'writing' };
        }
        return { title: 'Take a formal test', text: 'You have enough history for a useful check-in. Test mode will show weak rows and timing clearly.', href: '../results/', label: 'Open Results', kind: 'test' };
    }

    function hasKanaHistory(summaries) {
        const attempts = Number(summaries?.reading?.totals?.attempts || 0) + Number(summaries?.writing?.totals?.attempts || 0);
        const dailyHistory = Number(summaries?.reading?.daily?.entries?.length || 0) + Number(summaries?.writing?.daily?.entries?.length || 0);
        return attempts > 0 || dailyHistory > 0 || formalTestCount() > 0;
    }

    function returningHeroLead(summaries, mastery, action) {
        const overview = [
            `${mastery.seen}/${mastery.total} kana seen`,
            `${mastery.counts.Mastered} mastered`
        ];
        const streak = trainerStreak();
        if (streak > 0) overview.push(`${streak}-day streak`);

        let context = 'Your next session is ready when you are.';
        if (mastery.weak.length) context = `Current focus: ${compactKanaList(mastery.weak, 4)}.`;
        else if (action.kind === 'writing') context = 'Writing is currently behind Reading.';
        else if (action.kind === 'test') context = 'Your practice history is ready for a formal check-in.';
        else if (action.kind === 'new') context = 'Fresh kana are still waiting in your set.';
        return `${overview.join(' · ')}. ${context}`;
    }

    function applyKanaExperienceState(summaries, mastery, action) {
        const returning = hasKanaHistory(summaries);
        document.body.classList.toggle('ma-kana-returning', returning);
        document.body.dataset.maKanaExperience = returning ? 'returning' : 'new';

        const heroTitle = $('#kanaHeroTitle');
        const heroLead = $('.kana-hero-lead');
        const progressTitle = $('.kana-progress-intro h2');
        const progressLead = $('.kana-progress-intro p');
        if (heroTitle) heroTitle.textContent = returning ? 'Your kana' : 'Make kana feel automatic.';
        if (heroLead) heroLead.textContent = returning
            ? returningHeroLead(summaries, mastery, action)
            : 'Build fast recognition in Reading, active recall in Writing, and use Results to keep each practice session focused.';
        if (progressTitle) progressTitle.textContent = returning ? 'Progress overview' : 'Know where you stand. Know what to practise next.';
        if (progressLead) progressLead.textContent = returning
            ? 'Coverage, mastery, recommendations, accuracy and records from your saved practice.'
            : 'Track recognition, recall, mastery, and the kana most worth your attention.';
        return returning;
    }

    function renderHero(summaries, mastery, action) {
        applyKanaExperienceState(summaries, mastery, action);
        const continueLink = $('#kanaContinueAction');
        const continueHint = $('#kanaContinueHint');
        if (continueLink) continueLink.href = action.href;
        if (continueHint) continueHint.textContent = action.label;

        const card = $('#kanaTodayCard');
        if (!card) return;
        const masteredPct = pct(mastery.counts.Mastered, mastery.total);
        const reviewingPct = pct(mastery.counts.Mastered + mastery.counts.Reviewing, mastery.total);
        const seenPct = pct(mastery.seen, mastery.total);

        const map = kanaEl('div', 'kana-hero-map');
        map.setAttribute('aria-label', 'Kana progress map');
        [
            ['Seen', seenPct],
            ['Review+', reviewingPct],
            ['Mastered', masteredPct]
        ].forEach(([label, value]) => {
            const row = kanaEl('div', 'kana-map-row');
            row.append(kanaEl('span','',label), progressBar(value), kanaEl('em','',`${value}%`));
            map.append(row);
        });

        const mini = kanaEl('div','kana-hero-mini');
        [
            [trainerStreak(), 'day trainer streak'],
            [mastery.counts.Learning, 'learning'],
            [mastery.counts.Reviewing, 'reviewing']
        ].forEach(([value, label]) => {
            const item = document.createElement('div');
            item.append(kanaEl('strong','',value), kanaEl('span','',label));
            mini.append(item);
        });

        const summary = kanaEl('div','kana-progress-summary');
        summary.append(
            kanaEl('span','kana-card-kicker ma-kicker','Coverage'),
            kanaEl('h3','',`${mastery.seen}/${mastery.total} kana seen`),
            kanaEl('p','','See how much of the kana set you have reached and how much is becoming reliable.')
        );
        card.replaceChildren(summary, map, mini);
    }

    function renderNextPanel(summaries, mastery, action) {
        const target = $('#kanaNextPanel');
        if (!target) return;
        const weak = mastery.weak.slice(0, 5);
        const weakText = compactKanaList(weak, 4);
        const readingDone = !!summaries.reading.daily.today;
        const writingDone = !!summaries.writing.daily.today;
        const todayCount = Number(readingDone) + Number(writingDone);

        const head = kanaEl('div','kana-section-head compact ma-section-head');
        const copy = document.createElement('div');
        copy.append(
            kanaEl('span','kana-section-kicker ma-kicker','Start here'),
            kanaEl('h2','','Your next best step'),
            kanaEl('p','','Your recommendation, daily challenges, and weakest kana together for a quick decision.')
        );
        const guide = kanaButton('kana-ghost-action ma-button','What should I practise?');
        guide.dataset.maKanaGuide = '';
        head.append(copy, guide);

        const grid = kanaEl('div','kana-next-grid');

        const recommended = kanaLink(`kana-next-card kana-next-card--recommended primary ${action.kind}`, '', action.href);
        recommended.append(
            kanaEl('span','ma-kicker','Recommended'),
            kanaEl('strong','',action.title),
            kanaEl('p','',action.text),
            kanaEl('em','',`${action.label} →`)
        );

        const daily = kanaEl('div','kana-next-card kana-next-card--secondary compact');
        daily.append(kanaEl('span','ma-kicker','Daily check-in'));
        const dailyTitle = kanaEl('strong','');
        dailyTitle.append(
            document.createTextNode(readingDone ? 'Reading ✓' : 'Reading ready'),
            document.createElement('br'),
            document.createTextNode(writingDone ? 'Writing ✓' : 'Writing ready')
        );
        const dailyBtn = kanaButton('kana-inline-btn ma-button','View history');
        dailyBtn.dataset.maDailyHistory = '';
        daily.append(dailyTitle, kanaEl('p','',`${todayCount}/2 daily challenges complete today.`), dailyBtn);

        const focus = kanaEl('div','kana-next-card kana-next-card--secondary compact');
        const review = kanaLink('kana-inline-btn ma-button','Focus these rows','../reading/?focusWeak=1');
        review.dataset.maWeakReview = '';
        focus.append(
            kanaEl('span','ma-kicker','Focus set'),
            kanaEl('strong','kana-focus-kana',weakText),
            kanaEl('p','',weak.length ? 'Weakest kana by accuracy, speed, and reps.' : 'Finish a few sessions to unlock useful weak-kana focus.'),
            review
        );

        grid.append(recommended, daily, focus);
        target.replaceChildren(head, grid);
    }

    function renderMastery(mastery) {
        const grid = $('#kanaMasteryGrid');
        if (!grid) return;
        const stages = ['New', 'Learning', 'Reviewing', 'Mastered'];
        grid.replaceChildren(...stages.map(stage => {
            const button = kanaButton(`kana-stage-card ${stage.toLowerCase()}`);
            button.dataset.maMasteryOpen = '';
            button.append(
                kanaEl('span','ma-kicker',stage),
                kanaEl('strong','',mastery.counts[stage]),
                kanaEl('p','',stage === 'New' ? 'Waiting for first practice' : stageCopy(stage)),
                progressBar(pct(mastery.counts[stage], mastery.total))
            );
            return button;
        }));

        const weak = compactKanaList(mastery.weak, 6);
        const slow = compactKanaList(mastery.slowest, 4, item => `${item.ch} ${formatMs(item.avg)}`);
        const focus = $('#kanaMasteryFocus');
        if (focus) {
            const focusNow = kanaEl('div','kana-focus-card');
            focusNow.append(
                kanaEl('span','ma-kicker','Focus now'),
                kanaEl('strong','',mastery.weak.length ? `Review ${weak}` : 'Build first attempts'),
                kanaEl('p','',mastery.weak.length ? 'Prioritised by low reps, lower accuracy, or slower recognition.' : 'Complete a few sessions so the hub can find useful focus kana.')
            );
            const avg = kanaEl('div','kana-focus-card');
            avg.append(kanaEl('span','ma-kicker','Average recognition'), kanaEl('strong','',mastery.average ? formatMs(mastery.average) : '—'), kanaEl('p','','Across kana with saved timing history.'));
            const slowest = kanaEl('div','kana-focus-card');
            slowest.append(kanaEl('span','ma-kicker','Slowest kana'), kanaEl('strong','',slow), kanaEl('p','','Slowest saved recognition times. Practise these carefully before pushing speed.'));
            focus.replaceChildren(focusNow, avg, slowest);
        }
        window.ModeAtlasUi?.applyProgressWidths?.(grid);
    }

    function presetProgress(snapshot) {
        const metrics = M();
        return (metrics?.PRESET_TRACKERS || []).map(item => {
            const value = Math.min(100, item.chars.reduce((sum, ch) => sum + combinedKanaStats(ch, snapshot).correct, 0));
            return { ...item, value, done: value >= 100, remaining: Math.max(0, 100 - value) };
        });
    }

    function renderPresets(snapshot) {
        const target = $('#kanaPresetPanel');
        if (!target) return;
        const items = presetProgress(snapshot);

        const head = kanaEl('div','kana-section-head compact ma-section-head');
        const copy = document.createElement('div');
        copy.append(
            kanaEl('h2','','Preset achievements')
        );
        head.append(copy);

        const grid = kanaEl('div','kana-preset-grid');
        items.forEach(item => {
            const card = kanaEl('article', `kana-preset-card ${item.done ? 'done' : ''}`.trim());
            const top = document.createElement('div');
            top.append(kanaEl('strong','',item.name), kanaEl('span','',`${item.value}/100`));
            card.append(top, kanaEl('p','',item.desc), progressBar(item.value), kanaEl('em','',item.done ? 'Complete' : 'In progress'));
            grid.append(card);
        });

        target.replaceChildren(head, grid);
        window.ModeAtlasUi?.applyProgressWidths?.(target);
    }

    function renderRecords(summaries, mastery) {
        const target = $('#kanaRecordsPanel');
        if (!target) return;
        const records = bestRunCards(summaries.reading, summaries.writing);
        const totalAnswers = summaries.reading.totals.attempts + summaries.writing.totals.attempts;

        const head = kanaEl('div','kana-section-head ma-section-head');
        const copy = document.createElement('div');
        copy.append(
            kanaEl('span','kana-section-kicker ma-kicker','Performance highlights'),
            kanaEl('h2','','Records & progress'),
            kanaEl('p','','Your best scores, accuracy, and practice volume in one place.')
        );
        head.append(copy, kanaLink('kana-ghost-action ma-button','View test results','../results/'));

        const layout = kanaEl('div','kana-record-layout');

        const accuracyPair = kanaEl('div','kana-accuracy-pair');
        accuracyPair.append(
            accuracyCardNode('Reading', summaries.reading.totals.accuracy, summaries.reading.highScore, summaries.reading.totals.attempts, 'reading'),
            accuracyCardNode('Writing', summaries.writing.totals.accuracy, summaries.writing.highScore, summaries.writing.totals.attempts, 'writing')
        );

        const recordGrid = kanaEl('div','kana-record-grid');
        records.forEach(([label, value, sub]) => {
            const card = kanaEl('article','kana-record-card');
            card.append(kanaEl('span','ma-kicker',label), kanaEl('strong','',value), kanaEl('em','',sub));
            recordGrid.append(card);
        });

        const totalCard = kanaEl('article','kana-record-card total');
        totalCard.append(
            kanaEl('span','ma-kicker','Total answers'),
            kanaEl('strong','',totalAnswers),
            kanaEl('em','',`${mastery.seen}/${mastery.total} kana seen`)
        );

        const right = kanaEl('div','kana-record-side');
        right.append(recordGrid, totalCard);

        layout.append(accuracyPair, right);
        target.replaceChildren(head, layout);
        window.ModeAtlasUi?.applyProgressWidths?.(target);
    }

    function accuracyCardNode(label, accuracy, highScore, attempts, mode) {
        const card = kanaEl('article', `kana-accuracy-card ${mode}`);
        const ring = kanaEl('div','kana-ring');
        ring.dataset.ringPct = String(accuracy || 0);
        if (mode === 'writing') ring.dataset.ringColor = '#66a8ff';
        ring.append(kanaEl('strong','',`${accuracy || 0}%`), kanaEl('span','','accuracy'));

        const details = document.createElement('div');
        details.append(kanaEl('h3','',label));
        const grid = kanaEl('div','kana-mini-grid');
        appendLabelValue(grid, 'High score', highScore || 0);
        appendLabelValue(grid, 'Attempts', attempts || 0);
        details.append(grid);

        card.append(ring, details);
        return card;
    }



    function openInfoModal(type, context = {}) {
        const body = kanaEl('div','kana-modal-body');
        const heading = { kicker: '', title: '' };
        if (type === 'daily') renderDailyModal(heading, body, context);
        else if (type === 'guide') renderGuideModal(heading, body);
        else renderMasteryHelpModal(heading, body);

        if (!window.ModeAtlasDialog?.feature) return;
        window.ModeAtlasDialog.feature({
            kicker: heading.kicker,
            title: heading.title,
            contentNode: body,
            size: 'large',
            tone: 'info'
        });
    }

    function kanaModalGrid(items) {
        const grid = kanaEl('div','kana-modal-grid');
        items.forEach(([heading, copy]) => {
            const item = document.createElement('div');
            item.append(kanaEl('strong','',heading), kanaEl('p','',copy));
            grid.append(item);
        });
        return grid;
    }

    function renderGuideModal(heading, body) {
        heading.kicker = 'Quick guide';
        heading.title = 'Choosing your next practice';
        body.replaceChildren(kanaModalGrid([
            ['Follow the recommendation', 'Start with the practice that best matches your saved accuracy, speed, and repetition history.'],
            ['Keep daily challenges moving', 'Reading and Writing daily challenges give you a simple way to keep both recognition and recall active.'],
            ['Use mastery to target weak spots', 'Mastery stages and the Mastery Map show which kana need more repetitions, accuracy, or speed.']
        ]));
    }

    function renderMasteryHelpModal(heading, body) {
        heading.kicker = 'Mastery rules';
        heading.title = 'How mastery works';
        body.replaceChildren(kanaModalGrid([
            ['New', 'You have not practised this kana yet.'],
            ['Learning', 'Requires at least 1 attempt, but has not yet reached 10+ correct answers, 85%+ accuracy, and 2.5s or faster average recognition.'],
            ['Reviewing', 'Requires 10+ correct answers, 85%+ accuracy, and 2.5s or faster average recognition.'],
            ['Mastered', 'Requires 50+ correct answers, 95%+ accuracy, and 1.0s or faster average recognition.']
        ]));
    }



    function renderDailyModal(heading, body, { summaries }) {
        heading.kicker = 'Daily challenge';
        heading.title = 'Daily challenge history';
        const grid = kanaEl('div','kana-daily-modal-grid');
        grid.append(dailyModePanelNode('Reading', summaries.reading, 'reading'), dailyModePanelNode('Writing', summaries.writing, 'writing'));
        body.replaceChildren(grid);
    }

    function dailyModePanelNode(label, summary, mode) {
        const today = summary.daily.today;
        const best = summary.daily.best;
        const history = summary.daily.entries.slice(0, 12);

        const section = kanaEl('section', `kana-daily-modal-card ${mode}`);
        section.append(kanaEl('h3','',label));

        const summaryGrid = kanaEl('div','kana-daily-summary');
        appendLabelValue(summaryGrid, 'Today', today ? `${today.officialScore || 0}/${today.total || 20}` : 'Ready');
        appendLabelValue(summaryGrid, 'Best', best ? `${best.score}/${best.entry.total || 20}` : '—');
        appendLabelValue(summaryGrid, 'High score', summary.highScore || 0);

        const historyWrap = kanaEl('div','kana-daily-history');
        if (history.length) {
            history.forEach(item => {
                const row = document.createElement('div');
                row.append(
                    kanaEl('span','',item.date),
                    kanaEl('strong','',`${item.entry.officialScore || 0}/${item.entry.total || 20}`),
                    kanaEl('em','',`${formatMs(item.entry.timeMs)} · ${item.entry.attempts || 1} attempt${Number(item.entry.attempts || 1) === 1 ? '' : 's'}`)
                );
                historyWrap.append(row);
            });
        } else {
            historyWrap.append(kanaEl('p','','No daily challenge history yet.'));
        }

        section.append(summaryGrid, historyWrap);
        return section;
    }



    function bindActions() {
        if (window.__maKanaHubActionsBound) return;
        window.__maKanaHubActionsBound = true;
        document.addEventListener('click', event => {
            if (event.target.closest('[data-ma-daily-history]')) {
                event.preventDefault();
                openInfoModal('daily', { summaries: collectSummaries() });
            }
            if (event.target.closest('[data-ma-kana-guide]')) {
                event.preventDefault();
                openInfoModal('guide');
            }
            if (event.target.closest('[data-ma-mastery-help]')) {
                event.preventDefault();
                openInfoModal('mastery-help');
            }
            if (event.target.closest('[data-ma-weak-review]')) {
                const current = Store.readModeJSON('reading', 'settings', {});
                Object.assign(current, { focusWeak: true, srs: true, endless: false, timeTrial: false, speedRun: false, dailyChallenge: false, testMode: false });
                try { window.ModeAtlasStorage?.setJSON?.('settings', current); } catch {}
                storeSet('modeAtlasLastKanaPage', '../reading/');
            }
        }, true);
    }

    function renderAll() {
        if (!M()) return;
        // Read the large per-kana storage objects once for this render. All
        // mastery/preset calculations below use the same in-memory snapshot.
        const snapshot = collectKanaSnapshot();
        const summaries = collectSummaries(snapshot);
        const mastery = masterySummary(snapshot);
        const action = recommendedAction(summaries, mastery);
        renderHero(summaries, mastery, action);
        renderNextPanel(summaries, mastery, action);
        renderMastery(mastery);
        renderPresets(snapshot);
        renderRecords(summaries, mastery);
        applyHubVisuals(document);
    }

    let renderQueued = false;
    let queuedRenderSource = 'unknown';

    function requestKanaHubRender(source = 'unknown') {
        queuedRenderSource = source;
        if (renderQueued) return;
        renderQueued = true;

        const run = () => {
            renderQueued = false;
            const activeSource = queuedRenderSource;
            queuedRenderSource = 'unknown';
            renderAll();
        };

        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
        else setTimeout(run, 0);
    }

    bindActions();
    renderAll();

    // Genuine data/UI changes can request a fresh snapshot. Multiple events in
    // the same cloud/profile update burst collapse into one dashboard render.
    document.addEventListener('ma:ui-refresh', () => requestKanaHubRender('ui-refresh'));
    document.addEventListener('ma:kana-hub-render', () => requestKanaHubRender('explicit-render'));
    document.addEventListener('ma:preset-progress-updated', () => requestKanaHubRender('preset-progress'));
    document.addEventListener('ma:profile-updated', () => requestKanaHubRender('profile-updated'));
    window.addEventListener('modeAtlasCloudDataChanged', (event) => {
        const sections = Array.isArray(event.detail?.sections) ? event.detail.sections : [];
        const relevant = ['reading', 'writing', 'readingTests', 'writingTests'];
        if (!sections.length || sections.some(section => relevant.includes(section))) {
            requestKanaHubRender('cloud-data');
        }
    });
    window.addEventListener('pageshow', event => {
        if (event.persisted === true) requestKanaHubRender('bfcache-restore');
    });
    document.addEventListener('ma:trainer-ready', () => requestKanaHubRender('trainer-ready'));
})();
