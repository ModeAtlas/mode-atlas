from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:80]!r}')
    write(path, text.replace(old, new, 1))


# Release metadata.
replace_once('assets/app/mode-atlas-version.js', "var VERSION = '2.36.0';", "var VERSION = '2.36.1';")
replace_once('assets/app/mode-atlas-version.js', "var CACHE_REVISION = 'assets-2.36.0';", "var CACHE_REVISION = 'assets-2.36.1';")
for path in ['README.md', 'package.json', 'package-lock.json']:
    text = read(path)
    if '2.36.0' not in text:
        raise RuntimeError(f'{path}: missing 2.36.0 release marker')
    write(path, text.replace('2.36.0', '2.36.1'))

changelog = read('CHANGELOG.md')
entry = """## 2.36.1 - 2026-08-16
- Kept the full Kana orientation hero for zero-history learners, while regular learners now receive a compact state-aware header instead of repeated introductory marketing copy.
- Returning Kana headers now summarise saved coverage, mastered kana, streak state, and current weak-kana focus so the buffer is personal and useful without competing with the statistics below.
- Collapsed Reading / Writing / Results into a slim shortcut band for returning learners and tightened the progress intro so saved statistics arrive much sooner on repeat visits.
- Preserved the complete first-use Kana experience and all existing recommendation, mastery, Daily Challenge, preset, Results, storage, sync, and trainer behaviour.

"""
if not changelog.startswith('## 2.36.0'):
    raise RuntimeError('CHANGELOG.md does not begin with 2.36.0')
write('CHANGELOG.md', entry + changelog)

# Kana controller: derive presentation state from real saved Kana history. No new
# preference or duplicated persistence flag is introduced.
js_path = 'assets/pages/mode-atlas-kana-page.js'
js = read(js_path)
marker = """    function renderHero(summaries, mastery, action) {
        const continueLink = $('#kanaContinueAction');
        const continueHint = $('#kanaContinueHint');
        if (continueLink) continueLink.href = action.href;
        if (continueHint) continueHint.textContent = action.label;

        const card = $('#kanaTodayCard');
"""
replacement = """    function hasKanaHistory(summaries) {
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
"""
if js.count(marker) != 1:
    raise RuntimeError(f'Kana renderHero marker count was {js.count(marker)}')
write(js_path, js.replace(marker, replacement, 1))

# Returning-user presentation. New users retain the exact 2.36.0 composition.
css_path = 'assets/css/mode-atlas-kana-page.css'
css = read(css_path)
css_marker = "/* Practice destinations are navigation, not dashboard cards. */"
returning_css = """/* Returning learners already know the product. Keep a small contextual buffer,
   then get Reading / Writing / Results and saved progress into view quickly. */
.ma-kana-page.ma-kana-returning .kana-hub-hero{
  grid-template-columns:minmax(0,1fr);
  gap:0;
  padding:30px 0 26px;
}
.ma-kana-page.ma-kana-returning .kana-hero-main{max-width:980px;}
.ma-kana-page.ma-kana-returning .hero-tagline{margin-bottom:10px;}
.ma-kana-page.ma-kana-returning .hero-tagline>span:first-child{width:34px;height:34px;border-radius:12px;font-size:.78rem;}
.ma-kana-page.ma-kana-returning .kana-hero-main h1{
  max-width:none;
  font-size:clamp(2.15rem,4vw,3rem);
  line-height:1;
  letter-spacing:-.05em;
}
.ma-kana-page.ma-kana-returning .kana-hero-lead{
  max-width:900px;
  margin-top:10px;
  font-size:clamp(.9rem,1.25vw,1rem);
  line-height:1.5;
}
.ma-kana-page.ma-kana-returning .kana-hero-actions{margin-top:18px;}
.ma-kana-page.ma-kana-returning .kana-primary-action{
  --ma-button-min-height:48px;
  --ma-button-padding:8px 14px;
  --ma-button-radius:15px;
  min-width:0;
  max-width:280px;
}
.ma-kana-page.ma-kana-returning .kana-hero-visual{display:none;}
.ma-kana-page.ma-kana-returning .kana-pathways{padding:14px 0 24px;}
.ma-kana-page.ma-kana-returning .kana-pathways-head{display:none;}
.ma-kana-page.ma-kana-returning .kana-pathway{
  min-height:82px;
  flex-direction:row;
  align-items:center;
  gap:14px;
  padding:16px 20px;
}
.ma-kana-page.ma-kana-returning .kana-pathway>.ma-kicker,
.ma-kana-page.ma-kana-returning .kana-pathway>p{display:none;}
.ma-kana-page.ma-kana-returning .kana-pathway::before{left:20px;width:32px;}
.ma-kana-page.ma-kana-returning .kana-pathway strong{margin:0;font-size:clamp(1.05rem,1.8vw,1.3rem);}
.ma-kana-page.ma-kana-returning .kana-pathway__action{margin:0 0 0 auto;justify-content:flex-end;font-size:.78rem;}
.ma-kana-page.ma-kana-returning .kana-progress-intro{padding:34px 0 20px;}
.ma-kana-page.ma-kana-returning .kana-progress-intro h2{font-size:clamp(1.8rem,3vw,2.55rem);}
.ma-kana-page.ma-kana-returning .kana-progress-intro p{margin-top:10px;font-size:.9rem;line-height:1.5;}

"""
if css.count(css_marker) != 1:
    raise RuntimeError(f'Kana CSS insertion marker count was {css.count(css_marker)}')
write(css_path, css.replace(css_marker, returning_css + css_marker, 1))

# Static regression contract for the two-state hierarchy.
test_path = 'tests/frontend.test.js'
tests = read(test_path)
test_block = r'''

test('2.36.1 Kana keeps first-use orientation but compacts established learner hierarchy', () => {
  const kanaHtml = read('kana/index.html');
  const kanaJs = read('assets/pages/mode-atlas-kana-page.js');
  const kanaCss = read('assets/css/mode-atlas-kana-page.css');

  assert.match(kanaHtml, /id="kanaHeroTitle">Make kana feel automatic\.<\/h1>/,
    'zero-history learners should retain the full Kana introduction');
  assert.match(kanaJs, /function hasKanaHistory\(summaries\)/);
  assert.match(kanaJs, /attempts > 0 \|\| dailyHistory > 0 \|\| formalTestCount\(\) > 0/,
    'returning state should derive from real saved Kana history rather than a second preference flag');
  assert.match(kanaJs, /classList\.toggle\('ma-kana-returning', returning\)/);
  assert.match(kanaJs, /heroTitle\.textContent = returning \? 'Your kana' : 'Make kana feel automatic\.'/);
  assert.match(kanaJs, /Current focus: \$\{compactKanaList\(mastery\.weak, 4\)\}/,
    'returning header should surface a learner-specific focus when weak kana exist');
  assert.match(kanaJs, /progressTitle\.textContent = returning \? 'Progress overview'/);

  assert.match(kanaCss, /\.ma-kana-page\.ma-kana-returning \.kana-hub-hero\{[\s\S]*?padding:30px 0 26px;/,
    'returning Kana hero should be materially shorter than the first-use hero');
  assert.match(kanaCss, /\.ma-kana-page\.ma-kana-returning \.kana-hero-visual\{display:none;\}/);
  assert.match(kanaCss, /\.ma-kana-page\.ma-kana-returning \.kana-pathways-head\{display:none;\}/,
    'repeat visitors should not repeatedly receive the practice-area explainer');
  assert.match(kanaCss, /\.ma-kana-page\.ma-kana-returning \.kana-pathway>p\{display:none;\}/,
    'returning practice shortcuts should be compact rather than explanatory cards');
});
'''
if "2.36.1 Kana keeps first-use orientation" in tests:
    raise RuntimeError('2.36.1 regression test already exists')
write(test_path, tests.rstrip() + test_block + '\n')
