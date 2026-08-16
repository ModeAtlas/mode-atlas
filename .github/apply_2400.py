from pathlib import Path
import json, re

ROOT = Path(__file__).resolve().parents[1]

def read(rel): return (ROOT / rel).read_text(encoding='utf-8')
def write(rel, text): (ROOT / rel).write_text(text, encoding='utf-8')
def one(text, old, new, label):
    n = text.count(old)
    if n != 1: raise RuntimeError(f'{label}: expected 1 occurrence, found {n}')
    return text.replace(old, new, 1)

def replace_function(source, name, replacement):
    marker = f'function {name}('
    start = source.find(marker)
    if start < 0: raise RuntimeError(f'function {name} not found')
    brace = source.find('{', start)
    if brace < 0: raise RuntimeError(f'function {name} brace not found')
    i = brace + 1
    depth = 1
    quote = None
    template = False
    escape = False
    line_comment = False
    block_comment = False
    while i < len(source) and depth:
        c = source[i]
        nxt = source[i+1] if i + 1 < len(source) else ''
        if line_comment:
            if c == '\n': line_comment = False
        elif block_comment:
            if c == '*' and nxt == '/': block_comment = False; i += 1
        elif quote:
            if escape: escape = False
            elif c == '\\': escape = True
            elif c == quote: quote = None
        elif template:
            if escape: escape = False
            elif c == '\\': escape = True
            elif c == '`': template = False
            elif c == '{' and i > 0 and source[i-1] == '$': depth += 1
            elif c == '}': depth -= 1
        else:
            if c == '/' and nxt == '/': line_comment = True; i += 1
            elif c == '/' and nxt == '*': block_comment = True; i += 1
            elif c in ('\"', "'"): quote = c
            elif c == '`': template = True
            elif c == '{': depth += 1
            elif c == '}': depth -= 1
        i += 1
    if depth != 0: raise RuntimeError(f'function {name} did not balance')
    return source[:start] + replacement.rstrip() + source[i:]

# Results page hierarchy/copy.
html = read('results/index.html')
html = one(html, '<meta name="description" content="Review saved kana test results and progress." />', '<meta name="description" content="Review comprehensive Reading and Writing Test Mode assessments, trends, row performance, speed, and focus areas." />', 'meta description')
html = one(html, '<meta property="og:description" content="Review saved kana test results and progress." />', '<meta property="og:description" content="Review comprehensive Reading and Writing Test Mode assessments, trends, row performance, speed, and focus areas." />', 'og description')
hero_start = html.index('    <section class="hero glass ma-card ma-page-hero ma-page-intro">')
hero_end = html.index('    <section class="results-guidance', hero_start)
new_hero = '''    <section class="hero glass ma-card ma-page-hero ma-page-intro results-assessment-hero">
        <div class="hero-title-block ma-page-intro__copy">
            <div class="ma-kicker results-kicker">Formal assessment</div>
            <h1 class="hero-title ma-page-intro__title">Test Results</h1>
            <p class="hero-short-copy ma-page-intro__description">Your assessment record for Kana Trainer Test Mode. Compare full Reading and Writing tests, inspect accuracy and speed by row and kana, and decide what to practise before the next assessment.</p>
        </div>
        <div class="hero-side compact ma-page-intro__aside">
            <div class="mini-panel quick-preview ma-card ma-card--flat">
                <div class="mini-label ma-kicker">Test Mode record</div>
                <div class="duo-grid ma-stat-grid">
                    <div class="duo-chip ma-stat ma-card ma-card--flat">
                        <div class="name ma-stat__label">Formal tests</div>
                        <div class="value ma-stat__value ma-skeleton-text" id="heroStoredTests">—</div>
                    </div>
                    <div class="duo-chip ma-stat ma-card ma-card--flat">
                        <div class="name ma-stat__label">Best test</div>
                        <div class="value ma-stat__value ma-skeleton-text" id="heroBestScore">—</div>
                    </div>
                </div>
                <div class="results-assessment-scope">Test Mode only · practice sessions are not included</div>
            </div>
        </div>
    </section>

'''
# Preserve guidance separately and move it below detailed assessment/history.
old_guidance = html[hero_end:html.index('    <div class="stage">', hero_end)]
html = html[:hero_start] + new_hero + html[html.index('    <div class="stage">', hero_end):]
html = html.replace('<h2 class="card-title">Overall snapshot</h2>', '<h2 class="card-title">Selected assessment</h2>', 1)
html = html.replace('A large headline score plus a quick breakdown of the currently selected result.', 'Accuracy, timing, coverage, and row performance for the selected formal Test Mode assessment.', 1)
html = html.replace('<div class="mega-kicker ma-kicker" id="overallKicker">Selected result score</div>', '<div class="mega-kicker ma-kicker" id="overallKicker">Formal test score</div>', 1)
html = html.replace('Pick a result to see the full breakdown.', 'Select a formal test to see its complete assessment.', 1)
html = html.replace('<h2 class="card-title">Stored tests</h2>', '<h2 class="card-title">Assessment history</h2>', 1)
html = html.replace('Includes pinned overall averages for Reading and Writing at the top, then individual saved test runs below.', 'Reading and Writing Test Mode averages stay pinned above the individual formal assessments.', 1)
html = html.replace('Pinned averages appear first, followed by your saved Reading and Writing test runs below.', 'Test averages appear first, followed by each completed Reading and Writing Test Mode assessment.', 1)
html = html.replace('<h2 class="card-title">Selected result details</h2>', '<h2 class="card-title">Kana-level analysis</h2>', 1)
html = html.replace('Click a result on the left, then inspect the kana grouped by row with fastest and slowest markers.', 'Inspect every kana assessed in the selected test, grouped by row with fastest and slowest response markers.', 1)
html = html.replace('<div class="heatmap-title">Full kana result heatmap</div>', '<div class="heatmap-title">Full assessment heatmap</div>', 1)
html = html.replace('<div class="legend-chip ma-pill"><span class="legend-box unanswered"></span> Modifier kana off</div>', '<div class="legend-chip ma-pill"><span class="legend-box unanswered"></span> Modifier off in test</div>', 1)

new_guidance = '''
        <section class="results-guidance ma-page-section" aria-label="Formal test trend and recommended review">
            <article class="results-trend-card ma-card">
                <div class="results-trend-head">
                    <div>
                        <div class="ma-kicker">Assessment trend</div>
                        <h2 id="resultsTrendTitle">Formal test progress</h2>
                    </div>
                    <strong id="resultsTrendSummary">—</strong>
                </div>
                <div class="ma-trend" id="resultsTrend" aria-label="Recent formal Test Mode scores">
                    <div class="ma-skeleton-block" aria-hidden="true"></div>
                </div>
                <p class="results-trend-note" id="resultsTrendNote">Reading tests compare with Reading tests; Writing tests compare with Writing tests.</p>
            </article>

            <article class="results-guidance-card ma-card" id="resultsGuidanceCard">
                <div class="results-guidance-icon" aria-hidden="true"><svg class="ma-icon ma-icon--large"><use href="/assets/mode-atlas-icons.svg#icon-focus"></use></svg></div>
                <div class="results-guidance-copy">
                    <div class="ma-kicker">Before your next test</div>
                    <h2 id="resultsGuidanceTitle">Finding your assessment focus…</h2>
                    <p id="resultsGuidanceText" class="ma-skeleton-block">Recommendations are derived only from formal Test Mode performance.</p>
                    <div class="results-focus-kana" id="resultsGuidanceKana" aria-live="polite"></div>
                </div>
                <div class="results-guidance-actions ma-action-row">
                    <a class="ma-button ma-button--primary" id="resultsPracticeAction" href="/reading/?focusWeak=1">
                        <svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-play"></use></svg>
                        <span>Practice recommended kana</span>
                    </a>
                    <a class="ma-button ma-button--ghost" href="/kana/">Open Kana hub</a>
                </div>
            </article>
        </section>
'''
closing = '        </section>\n    </div>\n</div>\n<!-- MODE_ATLAS_BODY_ASSETS_START -->'
if closing not in html: raise RuntimeError('results layout closing boundary not found')
html = html.replace(closing, '        </section>' + new_guidance + '    </div>\n</div>\n<!-- MODE_ATLAS_BODY_ASSETS_START -->', 1)
write('results/index.html', html)

# Formal assessment consumption boundary.
engine = read('assets/results/mode-atlas-results-engine.js')
engine = one(engine, '''  function loadModeResultsFromKeys(keys, expectedMode, normalizeTestResult){
    const mergedMap = new Map();''', '''  function isFormalTestResultRecord(item){
    if (!item || typeof item !== 'object') return false;
    if (item.type && item.type !== 'test') return false;
    const id = String(item.id || '');
    const title = String(item.title || '');
    const notes = String(item.notes || '');
    const hasAssessmentShape = !!item.kana && typeof item.kana === 'object' && !!item.breakdown && typeof item.breakdown === 'object';
    const hasTestIdentity = item.type === 'test' || /(?:^|-)test(?:-|$)/i.test(id) || /test/i.test(title) || /test run/i.test(notes);
    return hasAssessmentShape && hasTestIdentity;
  }

  function loadModeResultsFromKeys(keys, expectedMode, normalizeTestResult){
    const mergedMap = new Map();''', 'formal test predicate')
engine = one(engine, '''      arr.forEach((item) => {
        let itemWithModeHint = item;''', '''      arr.forEach((item) => {
        if (!isFormalTestResultRecord(item)) return;
        let itemWithModeHint = item;''', 'formal filter')
engine = one(engine, '''    parseStoredResultTimestamp,
    loadStoredResults
''', '''    parseStoredResultTimestamp,
    isFormalTestResultRecord,
    loadStoredResults
''', 'engine export')
write('assets/results/mode-atlas-results-engine.js', engine)

# Results page behavior and language.
js = read('assets/pages/mode-atlas-test-page.js')
js = one(js, 'const RESULTS_TREND_SUMMARY = document.getElementById("resultsTrendSummary");', 'const RESULTS_TREND_TITLE = document.getElementById("resultsTrendTitle");\nconst RESULTS_TREND_SUMMARY = document.getElementById("resultsTrendSummary");', 'trend title binding')

js = replace_function(js, 'renderGuidance', r'''function renderGuidance(result) {
    if (!RESULTS_GUIDANCE_TITLE || !RESULTS_GUIDANCE_TEXT || !RESULTS_GUIDANCE_KANA || !RESULTS_PRACTICE_ACTION) return;
    RESULTS_GUIDANCE_TEXT.classList.remove("ma-skeleton-block");
    RESULTS_GUIDANCE_KANA.replaceChildren();

    if (!result) {
        RESULTS_GUIDANCE_CARD?.classList.remove("reading", "writing");
        RESULTS_GUIDANCE_TITLE.textContent = "Complete your first formal assessment";
        RESULTS_GUIDANCE_TEXT.textContent = "Finish Reading or Writing Test Mode to unlock row, kana, speed, and accuracy recommendations here.";
        RESULTS_PRACTICE_ACTION.href = "/reading/";
        RESULTS_PRACTICE_ACTION.querySelector("span").textContent = "Open Reading trainer";
        return;
    }

    const mode = result.mode === "writing" ? "writing" : "reading";
    const weakKana = getWeakKana(result, 5);
    const weakRow = getWeakestRow(result);
    const scope = result.type === "average" ? `${mode} Test Mode history` : `this ${mode} Test Mode assessment`;
    RESULTS_GUIDANCE_CARD?.classList.toggle("reading", mode === "reading");
    RESULTS_GUIDANCE_CARD?.classList.toggle("writing", mode === "writing");

    if (weakKana.length) {
        RESULTS_GUIDANCE_TITLE.textContent = weakRow ? `Focus on the ${weakRow.key} row` : `Review your weakest ${mode} test kana`;
        RESULTS_GUIDANCE_TEXT.textContent = weakRow
            ? `${weakRow.key} is the clearest focus area from ${scope}: ${weakRow.accuracy}% accuracy${weakRow.avgMs ? ` with ${formatDuration(weakRow.avgMs)} average response time` : ""}. Practise it before the next formal test.`
            : `These kana have the weakest combination of accuracy and response speed across ${scope}.`;
        weakKana.forEach(item => {
            const chip = createResultEl("span", "results-focus-kana__item ma-pill", item.kana);
            chip.title = `${item.accuracy}% accuracy${item.avgMs ? ` · ${formatDuration(item.avgMs)}` : ""}`;
            RESULTS_GUIDANCE_KANA.append(chip);
        });
    } else {
        RESULTS_GUIDANCE_TITLE.textContent = `Build more ${mode} test history`;
        RESULTS_GUIDANCE_TEXT.textContent = "There is not enough kana-level formal assessment data to rank a focused review yet.";
    }

    RESULTS_PRACTICE_ACTION.href = `/${mode}/?focusWeak=1`;
    RESULTS_PRACTICE_ACTION.querySelector("span").textContent = `Practice recommended ${mode === "reading" ? "Reading" : "Writing"} kana`;
}''')

js = replace_function(js, 'renderTrend', r'''function renderTrend(result) {
    if (!RESULTS_TREND || !RESULTS_TREND_SUMMARY || !RESULTS_TREND_NOTE) return;
    const individualTests = STORED_RESULTS.filter(item => item.type !== "average");
    const latest = [...individualTests].sort((a, b) => parseStoredResultTimestamp(b) - parseStoredResultTimestamp(a))[0] || null;
    const mode = result?.mode || latest?.mode || null;
    const modeLabel = mode === "writing" ? "Writing" : "Reading";
    const tests = mode
        ? individualTests
            .filter(item => item.mode === mode)
            .sort((a, b) => parseStoredResultTimestamp(a) - parseStoredResultTimestamp(b))
            .slice(-8)
        : [];

    if (RESULTS_TREND_TITLE) RESULTS_TREND_TITLE.textContent = mode ? `${modeLabel} test trend` : "Formal test progress";

    if (!tests.length) {
        RESULTS_TREND.replaceChildren(createResultEl("div", "results-trend-empty", "Complete a formal test to start your trend."));
        RESULTS_TREND.style.setProperty("--ma-trend-count", "1");
        RESULTS_TREND_SUMMARY.textContent = "No history yet";
        RESULTS_TREND_NOTE.textContent = "Only formal Reading and Writing Test Mode results appear here.";
        return;
    }

    RESULTS_TREND.style.setProperty("--ma-trend-count", String(tests.length));
    const bars = tests.map(item => {
        const score = Math.max(0, Math.min(100, Number(item.overallScore || 0)));
        const bar = createResultEl("div", "ma-trend__bar");
        bar.style.setProperty("--ma-trend-height", `${Math.max(8, score)}%`);
        bar.style.setProperty("--ma-trend-color", mode === "writing" ? "var(--ma-writing)" : "var(--ma-reading)");
        bar.title = `${modeLabel} Test Mode · ${score}% · ${item.date || "Saved test"}`;
        bar.setAttribute("aria-label", bar.title);
        return bar;
    });
    RESULTS_TREND.replaceChildren(...bars);

    const first = Number(tests[0].overallScore || 0);
    const last = Number(tests[tests.length - 1].overallScore || 0);
    const delta = Math.round(last - first);
    RESULTS_TREND_SUMMARY.textContent = tests.length === 1
        ? `${last}% latest`
        : Math.abs(delta) <= 2 ? "Steady" : `${delta > 0 ? "+" : ""}${delta} pts`;
    RESULTS_TREND_NOTE.textContent = tests.length === 1
        ? `One ${modeLabel} Test Mode assessment saved. More formal tests will make the trend clearer.`
        : `${tests.length} most recent ${modeLabel} Test Mode assessments · latest score ${last}%.`;
}''')

js = replace_function(js, 'createResultTile', r'''function createResultTile(item) {
    const button = createResultEl("button", `test-tile ma-card ma-card--flat ma-card--interactive ${item.mode} ${item.type === "average" ? "average" : ""} ${item.id === selectedResultId ? "active" : ""}`);
    button.type = "button";
    button.dataset.resultId = item.id;

    const top = createResultEl("div", "test-tile-top");
    const titleWrap = document.createElement("div");
    titleWrap.append(
        createResultEl("div", "test-title", item.title),
        createResultEl("div", "test-sub", item.type === "average"
            ? `${item.date} · ${item.kanaAsked} kana represented`
            : `${item.date} · ${item.startedAt} · ${item.kanaAsked} kana assessed`)
    );
    top.append(titleWrap, createResultEl("div", "test-score", `${item.overallScore}%`));

    const tagRow = createResultEl("div", "tag-row");
    tagRow.append(createResultEl("span", `tag ${item.type === "average" ? "gold" : item.mode} ma-pill ma-pill--small`, item.type === "average" ? "Test Average" : "Formal Test"));
    getModifierTags(item).forEach(tag => tagRow.append(createResultEl("span", "tag gold ma-pill ma-pill--small", tag)));
    tagRow.append(createResultEl("span", "tag ma-pill ma-pill--small", `${item.correct} right / ${item.wrong} wrong`));

    button.append(top, tagRow);
    button.addEventListener("click", () => {
        selectedResultId = button.dataset.resultId;
        selectedKana = null;
        renderAll();
    });
    return button;
}''')

js = replace_function(js, 'renderResultsList', r'''function renderResultsList() {
    if (!STORED_RESULTS.length) {
        const empty = createResultEl("div", "empty ma-card ma-empty-state results-empty-assessment");
        empty.append(
            createResultEl("strong", "results-empty-assessment__title", "No formal test results yet"),
            createResultEl("p", "results-empty-assessment__copy", "Complete Test Mode in Reading or Writing to receive a comprehensive assessment of kana accuracy, speed, rows, modifiers, and focus areas.")
        );
        const actions = createResultEl("div", "results-empty-assessment__actions ma-action-row");
        const reading = createResultEl("a", "ma-button ma-button--primary", "Open Reading trainer");
        reading.href = "/reading/";
        const writing = createResultEl("a", "ma-button ma-button--ghost", "Open Writing trainer");
        writing.href = "/writing/";
        actions.append(reading, writing);
        empty.append(actions);
        TESTS_GRID.replaceChildren(empty);
        return;
    }
    TESTS_GRID.replaceChildren(...STORED_RESULTS.map(createResultTile));
}''')

js = replace_function(js, 'renderSnapshot', r'''function renderSnapshot(result) {
    const modeLabel = result.mode === "writing" ? "Writing" : "Reading";
    OVERALL_KICKER.textContent = result.type === "average" ? `${modeLabel} test average` : `${modeLabel} formal test`;
    OVERALL_SELECTED_NAME.textContent = result.title;
    OVERALL_SCORE.textContent = `${result.overallScore}%`;
    OVERALL_SUB.textContent = result.type === "average"
        ? `Average performance across all saved ${modeLabel} Test Mode assessments.`
        : `${result.kanaAsked} kana assessed in Test Mode${result.avgMs ? ` · ${formatDuration(result.avgMs)} average response` : ""}.`;
    OVERALL_MODE.textContent = getResultTypeLabel(result);
    OVERALL_CORRECT.textContent = result.correct;
    OVERALL_WRONG.textContent = result.wrong;
    OVERALL_TIME.textContent = formatDuration(result.durationMs);

    OVERALL_SCORE_CARD.classList.remove("reading", "writing", "average");
    if (result.type === "average") OVERALL_SCORE_CARD.classList.add("average");
    else OVERALL_SCORE_CARD.classList.add(result.mode === "reading" ? "reading" : "writing");

    renderRowPerformanceInto(result, activeRowGraphView);

    renderMegaInlineCards(SNAPSHOT_BREAKDOWN, [
        ["Hiragana", `${result.breakdown.hiragana.correct} / ${result.breakdown.hiragana.correct + result.breakdown.hiragana.wrong}`],
        ["Katakana", `${result.breakdown.katakana.correct} / ${result.breakdown.katakana.correct + result.breakdown.katakana.wrong}`],
        ["Dakuten", result.type === "average" ? (result.dakuten ? "Mixed" : "Off") : (result.dakuten ? "On" : "Off")],
        ["Yōon", result.type === "average" ? (result.yoon ? "Mixed" : "Off") : (result.yoon ? "On" : "Off")],
        ["Ext. Katakana", result.type === "average" ? (result.extendedKatakana ? "Mixed" : "Off") : (result.extendedKatakana ? "On" : "Off")],
        ["Kana assessed", result.kanaAsked]
    ]);
}''')

js = replace_function(js, 'renderDetailHeader', r'''function renderDetailHeader(result) {
    const modeLabel = result.mode === "writing" ? "Writing" : "Reading";
    DETAIL_TITLE.textContent = result.title;
    DETAIL_SUB.textContent = result.type === "average"
        ? `${modeLabel} Test Mode · pinned formal-test average · click a kana for its average timing`
        : `${modeLabel} Test Mode · ${result.date} · ${formatDuration(result.durationMs)} total assessment time`;
    renderMetricCards(DETAIL_METRICS, [
        ["Accuracy", `${result.overallScore}%`],
        ["Correct", `${result.correct}`],
        ["Wrong", `${result.wrong}`],
        ["Avg response", `${formatDuration(result.avgMs)}`]
    ]);
    const hideBtn = document.getElementById("hideUnusedBtn");
    if (hideBtn) {
        hideBtn.classList.toggle("active", hideUnusedKana);
        hideBtn.textContent = hideUnusedKana ? "Show unused kana" : "Hide unused kana";
    }
}''')

js = replace_function(js, 'renderAll', r'''function renderAll() {
    STORED_RESULTS = loadStoredResults();
    if (!STORED_RESULTS.some(item => item.id === selectedResultId)) {
        selectedResultId = STORED_RESULTS[0]?.id || null;
        selectedKana = null;
    }
    const result = getSelectedResult();
    renderHero();
    renderResultsList();
    renderGuidance(result);
    renderTrend(result);
    if (!result) {
        OVERALL_KICKER.textContent = "Formal assessment";
        OVERALL_SELECTED_NAME.textContent = "No Test Mode results yet";
        OVERALL_SCORE.textContent = "—";
        OVERALL_SUB.textContent = "Complete Reading or Writing Test Mode to populate this formal assessment report.";
        OVERALL_MODE.textContent = "—";
        OVERALL_CORRECT.textContent = "0";
        OVERALL_WRONG.textContent = "0";
        OVERALL_TIME.textContent = "—";
        OVERALL_SCORE_CARD.classList.remove("reading", "writing");
        OVERALL_SCORE_CARD.classList.add("average");
        renderMegaInlineCards(SNAPSHOT_BREAKDOWN, [
            ["Reading tests", "0"],
            ["Writing tests", "0"],
            ["Test averages", "Pending"],
            ["Assessment", "Ready for Test Mode"]
        ]);
        ROW_PERFORMANCE_MOUNT.replaceChildren();
        DETAIL_TITLE.textContent = "No assessment selected";
        DETAIL_SUB.textContent = "Complete Test Mode to unlock the full kana heatmap and row analysis.";
        DETAIL_METRICS.replaceChildren();
        const hideBtn = document.getElementById("hideUnusedBtn");
        if (hideBtn) { hideBtn.classList.remove("active"); hideBtn.textContent = "Hide unused kana"; }
        TEST_HEATMAP.replaceChildren(createResultEl("div", "empty test-heatmap-empty ma-card ma-empty-state", "No formal assessment data yet."));
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
}''')
write('assets/pages/mode-atlas-test-page.js', js)

# Refine existing Results CSS at source; new classes are additive because they are new semantic elements.
css = read('assets/css/mode-atlas-test-page.css')
css = one(css, '        padding:28px;\n        margin-bottom: 20px;', '        padding:22px 24px;\n        margin-bottom: 18px;', 'hero spacing')
css = one(css, '        font-size: 44px;', '        font-size: 38px;', 'hero heading size')
css = one(css, '        grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);', '        grid-template-columns:minmax(280px,.72fr) minmax(0,1.28fr);', 'guidance column order')
css += '''\n/* Formal assessment-specific presentation. */\n.results-assessment-scope{margin-top:10px;color:var(--ma-muted);font-size:.76rem;line-height:1.4;}\n.results-empty-assessment{display:grid;gap:12px;text-align:left;}\n.results-empty-assessment__title{color:var(--ma-text-strong);font-size:1rem;}\n.results-empty-assessment__copy{margin:0;color:var(--ma-muted);font-size:.86rem;line-height:1.55;max-width:52ch;}\n.results-empty-assessment__actions{justify-content:flex-start;}\n@media (max-width:760px){.results-assessment-hero{padding:18px;}.results-assessment-scope{font-size:.72rem;}}\n'''
write('assets/css/mode-atlas-test-page.css', css)

# Version/release metadata.
version = read('assets/app/mode-atlas-version.js').replace("var VERSION = '2.39.0';", "var VERSION = '2.40.0';").replace("var CACHE_REVISION = 'assets-2.39.0';", "var CACHE_REVISION = 'assets-2.40.0';")
write('assets/app/mode-atlas-version.js', version)
for rel in ('package.json','package-lock.json'):
    data = json.loads(read(rel)); data['version'] = '2.40.0'
    if rel == 'package-lock.json': data.setdefault('packages',{}).setdefault('',{})['version'] = '2.40.0'
    write(rel, json.dumps(data, indent=2) + '\n')
write('README.md', read('README.md').replace('Version: 2.39.0', 'Version: 2.40.0'))
changelog = read('CHANGELOG.md')
entry = '''## 2.40.0 - 2026-08-16\n- Reframed Results as the formal assessment report for Reading and Writing Test Mode only.\n- Preserved the full kana heatmap, row doughnut graphs, modifier-row analysis, fastest/slowest markers, pinned test averages, master/detail history, trends, and Recommended Review.\n- Split improvement trends by assessment skill: Reading compares only with Reading tests and Writing only with Writing tests.\n- Added a formal-test consumption guard so non-Test-Mode records cannot be interpreted as assessment results even if they appear in a results storage key.\n- Improved empty states and assessment terminology without changing Test Mode scoring, stored result schemas, or trainer behavior.\n\n'''
if not changelog.startswith('## 2.40.0'): write('CHANGELOG.md', entry + changelog)

# Regression contract.
tests = read('tests/frontend.test.js')
contract = r'''

test('2.40 Results is a formal Test Mode report and preserves comprehensive assessment visuals', () => {
  const html = read('results/index.html');
  const page = read('assets/pages/mode-atlas-test-page.js');
  const engine = read('assets/results/mode-atlas-results-engine.js');
  const ui = read('assets/results/mode-atlas-results-ui.js');
  const storage = read('assets/results/mode-atlas-results-storage.js');

  assert.match(html, /Formal assessment/);
  assert.match(html, /Test Mode only · practice sessions are not included/);
  assert.match(html, /Assessment history/);
  assert.match(html, /Kana-level analysis/);
  assert.match(html, /Before your next test/);
  assert.match(html, /id="testHeatmap"/);
  assert.match(html, /id="rowPerformanceMount"/);
  assert.match(ui, /row-doughnut-card/);
  assert.match(ui, /document\.createElement\("canvas"\)/);
  assert.match(page, /drawRowCharts\(result, activeRowGraphView\)/);
  assert.match(page, /item\.mode === mode/);
  assert.match(page, /Reading tests compare with Reading tests|most recent.*Test Mode assessments/);
  assert.match(engine, /function isFormalTestResultRecord/);
  assert.match(engine, /if \(!isFormalTestResultRecord\(item\)\) return/);
  assert.match(storage, /testModeResults/);
  assert.doesNotMatch(page, /readModeJSON\([^\n]*(?:scoreHistory|dailyHistory|charStats)/);
  assert.doesNotMatch(page, /speedRunTop3|endlessBest|dailyChallengeHistory/);
});
'''
if '2.40 Results is a formal Test Mode report' not in tests: tests = tests.rstrip() + contract
write('tests/frontend.test.js', tests)
