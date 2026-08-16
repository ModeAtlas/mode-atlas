from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def write(rel, text):
    (ROOT / rel).write_text(text, encoding='utf-8')


def replace_exact(rel, old, new, expected=1):
    text = read(rel)
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'{rel}: expected {expected} occurrences of {old!r}, found {count}')
    write(rel, text.replace(old, new))


def replace_at_least(rel, old, new, minimum=1):
    text = read(rel)
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f'{rel}: expected at least {minimum} occurrences of {old!r}, found {count}')
    write(rel, text.replace(old, new))


# Release metadata.
replace_exact('assets/app/mode-atlas-version.js', "var VERSION = '2.43.1';", "var VERSION = '2.44.0';")
replace_exact('assets/app/mode-atlas-version.js', "var CACHE_REVISION = 'assets-2.43.1';", "var CACHE_REVISION = 'assets-2.44.0';")

# Shared product hierarchy and trainer vocabulary.
frontend = read('frontend_components.py')
repls = [
    (
        "'reading/index.html': NavConfig('reading', '読', 'Kana Trainer', 'Reading Practice', accent='reading', hideable=True),",
        "'reading/index.html': NavConfig('reading', '読', 'Kana Trainer', 'Reading Practice', brand_href='/kana/', accent='reading', hideable=True),",
    ),
    (
        "'writing/index.html': NavConfig('writing', '書', 'Kana Trainer', 'Writing Practice', accent='writing', hideable=True),",
        "'writing/index.html': NavConfig('writing', '書', 'Kana Trainer', 'Writing Practice', brand_href='/kana/', accent='writing', hideable=True),",
    ),
    (
        "'results/index.html': NavConfig('results', '測', 'Kana Trainer', 'Results', brand_href='/kana/', accent='results'),",
        "'results/index.html': NavConfig('results', '測', 'Kana Trainer', 'Test Results', brand_href='/kana/', accent='results'),",
    ),
    ("('results', 'Results', '/results/'),", "('results', 'Test Results', '/results/'),"),
    (
        '<a class=\"ma-nav__brand\" href=\"{_attr(config.brand_href)}\" aria-label=\"Mode Atlas home\">',
        '<a class=\"ma-nav__brand\" href=\"{_attr(config.brand_href)}\" aria-label=\"{_attr(\'Kana Trainer home\' if config.brand_href == \'/kana/\' else \'Mode Atlas home\')}\">',
    ),
    ('<label>Kana Combos</label>', '<label>Kana combos</label>'),
    ('>Same Row</button>', '>Same row</button>'),
    ('<div id=\"gameOver\" class=\"game-over\" hidden><div class=\"game-over-title\">Wrong</div>', '<div id=\"gameOver\" class=\"game-over\" hidden><div class=\"game-over-title\">Incorrect</div>'),
    ('>Try Again</button>', '>Try again</button>'),
    ('<span>View full Results</span>', '<span>View Test Results</span>'),
    ('<h3>Endless Best</h3>', '<h3>Endless best</h3>'),
    ('<h3>Combo Kana Best</h3>', '<h3>Combo Kana best</h3>'),
    ('<div class=\"score-subtitle\">Previous Days</div>', '<div class=\"score-subtitle\">Previous days</div>'),
    ('<h3>Speed Run Top 3</h3>', '<h3>Speed Run top 3</h3>'),
    ('<h3>Time Trial Top 3</h3>', '<h3>Time Trial top 3</h3>'),
    ('id=\"dailyWrongPill\" hidden>Wrong <strong', 'id=\"dailyWrongPill\" hidden>Incorrect <strong'),
    ('id=\"testWrongPill\" hidden>Wrong <strong', 'id=\"testWrongPill\" hidden>Incorrect <strong'),
    ('<div class=\"score-row\"><span>Wrong</span><span id=\"bestEndlessWrong\">', '<div class=\"score-row\"><span>Incorrect</span><span id=\"bestEndlessWrong\">'),
    ('placeholder=\"Type romaji...\"', 'placeholder=\"Type romaji…\"'),
]
for old, new in repls:
    count = frontend.count(old)
    if count != 1:
        raise SystemExit(f'frontend_components.py: expected one {old!r}, found {count}')
    frontend = frontend.replace(old, new)
write('frontend_components.py', frontend)

# Atlas product copy: Results is specifically the formal Test Mode report.
home = read('index.html')
home_repls = [
    ('then use Results to see where your next practice session will matter most.', 'then use Test Results to see where your next practice session will matter most.'),
    ('<strong>Results</strong><small>See what to work on next</small>', '<strong>Test Results</strong><small>Analyse formal assessments</small>'),
]
for old, new in home_repls:
    if home.count(old) != 1:
        raise SystemExit(f'index.html: expected one {old!r}, found {home.count(old)}')
    home = home.replace(old, new)
write('index.html', home)

# Kana hub: navigation actions open destinations; Start remains reserved for actually beginning a trainer session.
kana_html = read('kana/index.html')
kana_repls = [
    ('use Results to keep each practice session focused.', 'use Test Results to keep each practice session focused.'),
    ('Switch between recognition, recall, and detailed results without leaving Kana Trainer.', 'Switch between recognition, recall, and formal test analysis without leaving Kana Trainer.'),
    ('<span class="kana-pathway__action">Start reading ', '<span class="kana-pathway__action">Open Reading '),
    ('<span class="kana-pathway__action">Start writing ', '<span class="kana-pathway__action">Open Writing '),
    ('<strong>Results</strong><p>Review formal tests, performance trends, and the kana that need more work.</p><span class="kana-pathway__action">View results ', '<strong>Test Results</strong><p>Review formal tests, performance trends, and the kana that need more work.</p><span class="kana-pathway__action">View Test Results '),
]
for old, new in kana_repls:
    if kana_html.count(old) != 1:
        raise SystemExit(f'kana/index.html: expected one {old!r}, found {kana_html.count(old)}')
    kana_html = kana_html.replace(old, new)
write('kana/index.html', kana_html)

# Kana dynamic recommendations follow the same destination/action vocabulary.
kana_js = read('assets/pages/mode-atlas-kana-page.js')
kana_js_repls = [
    ("label: 'Start smart review'", "label: 'Review weak kana'"),
    ("label: 'Start Reading'", "label: 'Open Reading'"),
    ("label: 'Go to Writing'", "label: 'Open Writing'"),
    ("label: 'Open Results'", "label: 'Open Test Results'"),
    ("use Results to keep each practice session focused.", "use Test Results to keep each practice session focused."),
    ("kanaLink('kana-inline-btn ma-button','Focus these rows','../reading/?focusWeak=1')", "kanaLink('kana-inline-btn ma-button','Review weak kana','../reading/?focusWeak=1')"),
    ("kanaEl('h2','','Records & progress')", "kanaEl('h2','','Records and progress')"),
    ("kanaLink('kana-ghost-action ma-button','View test results','../results/')", "kanaLink('kana-ghost-action ma-button','View Test Results','../results/')"),
    ("Test mode will show weak rows and timing clearly.", "Test Mode will show weak rows and timing clearly."),
]
for old, new in kana_js_repls:
    count = kana_js.count(old)
    if count != 1:
        raise SystemExit(f'assets/pages/mode-atlas-kana-page.js: expected one {old!r}, found {count}')
    kana_js = kana_js.replace(old, new)
write('assets/pages/mode-atlas-kana-page.js', kana_js)

# Test Results static report language uses assessment terminology and Correct/Incorrect consistently.
results_html = read('results/index.html')
results_html_repls = [
    ('<div class="label ma-stat__label">Wrong</div>', '<div class="label ma-stat__label">Incorrect</div>'),
    ('<div class="overall-selected-title" id="overallSelectedName">No result selected</div>', '<div class="overall-selected-title" id="overallSelectedName">No assessment selected</div>'),
    ('<div class="detail-title" id="detailTitle">No result selected</div>', '<div class="detail-title" id="detailTitle">No assessment selected</div>'),
    ('<div class="detail-sub" id="detailSub">Select a result from the left to inspect it.</div>', '<div class="detail-sub" id="detailSub">Select an assessment from the left to inspect it.</div>'),
    ('<div class="legend-chip ma-pill"><span class="legend-box wrong"></span> Wrong</div>', '<div class="legend-chip ma-pill"><span class="legend-box wrong"></span> Incorrect</div>'),
    ('<a class="ma-button ma-button--ghost" href="/kana/">Open Kana hub</a>', '<a class="ma-button ma-button--ghost" href="/kana/">Back to Kana Trainer</a>'),
]
for old, new in results_html_repls:
    count = results_html.count(old)
    if count != 1:
        raise SystemExit(f'results/index.html: expected one {old!r}, found {count}')
    results_html = results_html.replace(old, new)
write('results/index.html', results_html)

# Results virtual averages and report UI use one formal-assessment vocabulary.
replace_exact('assets/results/mode-atlas-results-ui.js', 'title: `${mode === "reading" ? "Reading" : "Writing"} Overall Average`,', 'title: `${mode === "reading" ? "Reading" : "Writing"} Test Average`,')

test_js = read('assets/pages/mode-atlas-test-page.js')
test_js_repls = [
    ('return result.mode === "reading" ? "Read Avg" : "Write Avg";', 'return result.mode === "reading" ? "Reading average" : "Writing average";'),
    ('return result.mode === "reading" ? "Read" : "Write";', 'return result.mode === "reading" ? "Reading" : "Writing";'),
    ('`${item.correct} right / ${item.wrong} wrong`', '`${item.correct} correct / ${item.wrong} incorrect`'),
    ('["Wrong", `${result.wrong}`]', '["Incorrect", `${result.wrong}`]'),
    ('createModalStat("Correct", record.correct || 0), createModalStat("Wrong", record.wrong || 0),', 'createModalStat("Correct", record.correct || 0), createModalStat("Incorrect", record.wrong || 0),'),
    ('createModalStat("Result", wasCorrect ? "Correct" : "Wrong",', 'createModalStat("Result", wasCorrect ? "Correct" : "Incorrect",'),
    ('createModalStat("Avg Time", formatDuration(record.avgMs))', 'createModalStat("Avg response", formatDuration(record.avgMs))'),
    ('document.createTextNode(`Right: ${row.correct} · Wrong: ${row.wrong}`)', 'document.createTextNode(`Correct: ${row.correct} · Incorrect: ${row.wrong}`)'),
    ('"Open Reading trainer"', '"Open Reading"'),
    ('"Open Writing trainer"', '"Open Writing"'),
]
for old, new in test_js_repls:
    count = test_js.count(old)
    if count < 1:
        raise SystemExit(f'assets/pages/mode-atlas-test-page.js: expected at least one {old!r}, found {count}')
    test_js = test_js.replace(old, new)
write('assets/pages/mode-atlas-test-page.js', test_js)

# Word Bank uses sentence case and canonical feedback tones.
word_html = read('wordbank/index.html')
word_html_repls = [
    ('<label class="ma-field__label" for="kanaInput">Kana Word</label>', '<label class="ma-field__label" for="kanaInput">Kana word</label>'),
    ('id="addWordBtn" type="button" disabled aria-disabled="true">Add Word</button>', 'id="addWordBtn" type="button" disabled aria-disabled="true">Add word</button>'),
]
for old, new in word_html_repls:
    if word_html.count(old) != 1:
        raise SystemExit(f'wordbank/index.html: expected one {old!r}, found {word_html.count(old)}')
    word_html = word_html.replace(old, new)
write('wordbank/index.html', word_html)

word_js = read('assets/pages/mode-atlas-wordbank-page.js')
word_js_repls = [
    ("showStatus('Enter a kana word first.', 'warn');", "showStatus('Enter a kana word first.', 'warning');"),
    ("showStatus(`\"${kana}\" is already in your word bank.`, 'warn');", "showStatus(`\"${kana}\" is already in your Word Bank.`, 'warning');"),
    ("showStatus(`Added ${kana} to your word bank.`, 'ok');", "showStatus(`Added ${kana} to your Word Bank.`, 'success');"),
    ("showStatus(`Deleted ${entry.kana}.`, 'ok');", "showStatus(`Deleted ${entry.kana}.`, 'success');"),
    ("'Your word bank is already empty.'", "'Your Word Bank is already empty.'"),
    ('"Save Changes"', '"Save changes"'),
    ("'Clear search & filters'", "'Clear search and filters'"),
]
for old, new in word_js_repls:
    count = word_js.count(old)
    if count != 1:
        raise SystemExit(f'assets/pages/mode-atlas-wordbank-page.js: expected one {old!r}, found {count}')
    word_js = word_js.replace(old, new)
write('assets/pages/mode-atlas-wordbank-page.js', word_js)

# Settings terminology is device-class based rather than vendor specific.
replace_exact('assets/ui/mode-atlas-settings-menu.js', '<button class="ma-button ma-display-option" data-display="tablet" type="button">iPad</button>', '<button class="ma-button ma-display-option" data-display="tablet" type="button">Tablet</button>')
replace_exact('assets/ui/mode-atlas-settings-menu.js', '<span><span class="ma-menu-kicker">Secondary tools</span><strong>Data & app</strong></span>', '<span><span class="ma-menu-kicker">Secondary tools</span><strong>Data and app</strong></span>')

# Shared save-management feedback uses the same Unicode ellipsis used by loaders and sync states.
import_export = read('assets/app/mode-atlas-import-export.js')
for old, new in [
    ("'Importing backup...'", "'Importing backup…'"),
    ("'Save imported. Reloading...'", "'Save imported. Reloading…'"),
    ("'Review import before continuing...'", "'Review import before continuing…'"),
    ("'Resetting save data...'", "'Resetting save data…'"),
]:
    count = import_export.count(old)
    if count != 1:
        raise SystemExit(f'assets/app/mode-atlas-import-export.js: expected one {old!r}, found {count}')
    import_export = import_export.replace(old, new)
write('assets/app/mode-atlas-import-export.js', import_export)

# Migrate the historical navigation contract to the now-specific Test Results destination name.
replace_exact(
    'tests/frontend.test.js',
    "assert.match(frontend, /KANA_LINKS = \\([\\s\\S]*?'Overview'[\\s\\S]*?'Reading'[\\s\\S]*?'Writing'[\\s\\S]*?'Results'/);",
    "assert.match(frontend, /KANA_LINKS = \\([\\s\\S]*?'Overview'[\\s\\S]*?'Reading'[\\s\\S]*?'Writing'[\\s\\S]*?'Test Results'/);",
)

# Add a focused release regression without weakening older behavioural guards.
tests = read('tests/frontend.test.js').rstrip() + "\n\n" + r'''test('2.44 app-wide UX vocabulary keeps product destinations and actions semantically consistent', () => {
  const frontend = read('frontend_components.py');
  const home = read('index.html');
  const kana = read('kana/index.html');
  const kanaJs = read('assets/pages/mode-atlas-kana-page.js');
  const results = read('results/index.html');
  const resultsUi = read('assets/results/mode-atlas-results-ui.js');
  const resultsPage = read('assets/pages/mode-atlas-test-page.js');
  const wordbank = read('wordbank/index.html');
  const wordbankJs = read('assets/pages/mode-atlas-wordbank-page.js');
  const settings = read('assets/ui/mode-atlas-settings-menu.js');

  assert.match(frontend, /'results\/index\.html': NavConfig\('results', '測', 'Kana Trainer', 'Test Results'/);
  assert.match(frontend, /\('results', 'Test Results', '\/results\/'\)/);
  assert.match(frontend, /'reading\/index\.html': NavConfig\([^\n]*brand_href='\/kana\/'/);
  assert.match(frontend, /'writing\/index\.html': NavConfig\([^\n]*brand_href='\/kana\/'/);
  assert.match(frontend, /Kana Trainer home/);
  assert.match(frontend, />Start practice<\/span>/);
  assert.match(frontend, />End session<\/span>/);
  assert.match(frontend, />Try again<\/button>/);
  assert.match(frontend, />View Test Results<\/span>/);
  assert.doesNotMatch(frontend, /View full Results|Try Again|>Wrong</);

  for (const html of [home, kana]) assert.match(html, /Test Results/);
  assert.match(kana, />Open Reading /);
  assert.match(kana, />Open Writing /);
  assert.match(kanaJs, /label: 'Review weak kana'/);
  assert.match(kanaJs, /label: 'Open Test Results'/);
  assert.doesNotMatch(kanaJs, /label: 'Start Reading'|label: 'Go to Writing'|label: 'Open Results'/);

  assert.match(results, />Incorrect<\/div>/);
  assert.match(results, /No assessment selected/);
  assert.match(results, /Back to Kana Trainer/);
  assert.doesNotMatch(results, /No result selected|Open Kana hub/);
  assert.match(resultsUi, /Test Average/);
  assert.doesNotMatch(resultsUi, /Overall Average/);
  assert.match(resultsPage, /Reading average/);
  assert.match(resultsPage, /correct \/ \$\{item\.wrong\} incorrect/);
  assert.match(resultsPage, /Correct: \$\{row\.correct\} · Incorrect: \$\{row\.wrong\}/);

  assert.match(wordbank, />Kana word<\/label>/);
  assert.match(wordbank, />Add word<\/button>/);
  assert.match(wordbankJs, /"Save changes"/);
  assert.match(wordbankJs, /Clear search and filters/);
  assert.doesNotMatch(wordbankJs, /'warn'|'ok'|Save Changes|Clear search & filters/);

  assert.match(settings, /data-display="tablet" type="button">Tablet<\/button>/);
  assert.match(settings, />Data and app<\/strong>/);
  assert.doesNotMatch(settings, />iPad<\/button>|>Data & app<\/strong>/);
});
'''
write('tests/frontend.test.js', tests)

# Changelog.
changelog = read('CHANGELOG.md')
entry = '''## 2.44.0 - 2026-08-16
- Standardized app-wide action language so Start begins an actual practice session, destination links use Open/View/Back, and shared trainer controls use consistent sentence case.
- Renamed the Kana assessment destination to Test Results across navigation, Atlas, Kana, trainer links, and formal-assessment UI while preserving all Test Mode data and analysis behavior.
- Made Reading and Writing subpage branding return to Kana Trainer consistently and corrected shared brand accessibility labels to match their real destination.
- Standardized assessment correctness language to Correct/Incorrect across trainer HUDs, records, Test Results metrics, tooltips, heatmap legend, and kana detail dialogs.
- Normalized smaller UI vocabulary including Tablet display mode, Word Bank action casing and feedback tones, Data and app wording, and shared ellipsis treatment without changing stored preferences or schemas.

'''
if changelog.startswith('## 2.44.0'):
    raise SystemExit('CHANGELOG already contains 2.44.0')
write('CHANGELOG.md', entry + changelog)

print('Applied Mode Atlas 2.44.0 app-wide UX consistency changes')
