from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def write(rel, text):
    (ROOT / rel).write_text(text, encoding='utf-8')


def replace_once(rel, old, new):
    text = read(rel)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{rel}: expected exactly one occurrence, found {count}: {old[:80]!r}')
    write(rel, text.replace(old, new, 1))


def append_once(rel, marker, block):
    text = read(rel)
    if block.strip() in text:
        return
    if marker not in text:
        raise RuntimeError(f'{rel}: marker missing: {marker!r}')
    write(rel, text.replace(marker, marker + block, 1))


# Release metadata.
replace_once('assets/app/mode-atlas-version.js', "var VERSION = '2.44.0';\n  var CACHE_REVISION = 'assets-2.44.0';", "var VERSION = '2.45.0';\n  var CACHE_REVISION = 'assets-2.45.0';")

# Shared navigation owns the keyboard bypass link.
replace_once(
    'frontend_components.py',
    "return f'''{NAV_START}\n<nav class=\"ma-nav",
    "return f'''{NAV_START}\n<a class=\"ma-skip-link\" href=\"#mainContent\">Skip to main content</a>\n<nav class=\"ma-nav"
)

# Shared trainer shell owns its main landmark and disclosure controls.
replace_once(
    'frontend_components.py',
    '<div class="app-shell ma-trainer-shell" data-ma-trainer-shell="shared" data-ma-trainer-mode="{_attr(config.mode)}">',
    '<main id="mainContent" class="app-shell ma-trainer-shell" data-ma-trainer-shell="shared" data-ma-trainer-mode="{_attr(config.mode)}">'
)
replace_once(
    'frontend_components.py',
    "{_trainer_score_panels(config)}\n</div>\n\n{_trainer_modifier_shell(config)}",
    "{_trainer_score_panels(config)}\n</main>\n\n{_trainer_modifier_shell(config)}"
)
replace_once(
    'frontend_components.py',
    '<div class="panel-header" id="scoresHeader"><span>Records</span><span id="scoresChevron">▼</span></div>',
    '<button class="panel-header" id="scoresHeader" type="button" aria-expanded="true" aria-controls="scoresContent"><span>Records</span><span id="scoresChevron" aria-hidden="true">▼</span></button>'
)
replace_once(
    'frontend_components.py',
    '<div class="panel-header" id="statsHeader"><span>Mastery</span><span id="statsChevron">▼</span></div>',
    '<button class="panel-header" id="statsHeader" type="button" aria-expanded="true" aria-controls="statsContent"><span>Mastery</span><span id="statsChevron" aria-hidden="true">▼</span></button>'
)
replace_once(
    'frontend_components.py',
    '<div class="tab-row"><div class="tab-button" id="modifiersTab">Practice setup ▼</div></div>',
    '<div class="tab-row"><button class="tab-button" id="modifiersTab" type="button" aria-expanded="false" aria-controls="modifiersContent">Practice setup ▼</button></div>'
)

# Real public pages receive one stable main target. Legacy redirect/verification files remain untouched.
for rel in ('index.html', 'kana/index.html', 'privacy/index.html', 'terms/index.html'):
    text = read(rel)
    if 'id="mainContent"' in text:
        continue
    if '<main ' not in text:
        raise RuntimeError(f'{rel}: expected an existing main landmark')
    write(rel, text.replace('<main ', '<main id="mainContent" ', 1))

replace_once('results/index.html', '<div class="shell ma-page-frame">', '<main id="mainContent" class="shell ma-page-frame">')
replace_once('results/index.html', '</div>\n<!-- MODE_ATLAS_BODY_ASSETS_START -->', '</main>\n<!-- MODE_ATLAS_BODY_ASSETS_START -->')

# Word Bank keeps global navigation outside the main landmark while preserving the page frame wrapper.
replace_once('wordbank/index.html', '<!-- MODE_ATLAS_NAV_END -->\n    <section class="wordbank-intro', '<!-- MODE_ATLAS_NAV_END -->\n    <main id="mainContent">\n    <section class="wordbank-intro')
replace_once('wordbank/index.html', '      </div>\n  </div>\n<!-- MODE_ATLAS_BODY_ASSETS_START -->', '      </div>\n    </main>\n  </div>\n<!-- MODE_ATLAS_BODY_ASSETS_START -->')

# Navigation: visible-on-focus skip link plus coarse-pointer target sizing.
nav_css = read('assets/css/mode-atlas-navigation.css')
skip_css = '''\n\n/* Keyboard bypass link stays out of the visual shell until focused. */\n.ma-skip-link{\n  position:fixed;\n  top:max(12px,env(safe-area-inset-top));\n  left:max(12px,env(safe-area-inset-left));\n  z-index:12050;\n  min-height:44px;\n  display:inline-flex;\n  align-items:center;\n  padding:0 16px;\n  border:1px solid var(--ma-border-strong);\n  border-radius:var(--ma-radius-control);\n  background:var(--ma-surface-strong);\n  color:var(--ma-text-strong);\n  box-shadow:var(--ma-shadow-soft);\n  font-weight:850;\n  text-decoration:none;\n  opacity:0;\n  transform:translateY(calc(-100% - 24px));\n  pointer-events:none;\n}\n.ma-skip-link:focus-visible{\n  opacity:1;\n  transform:none;\n  pointer-events:auto;\n  outline:3px solid var(--ma-focus-ring);\n  outline-offset:2px;\n}\n\n@media(pointer:coarse){\n  .ma-nav__link,.ma-nav__section-link,.ma-nav__action{min-height:44px;}\n  .ma-nav__profile,.ma-nav__settings{width:44px;min-width:44px;min-height:44px;}\n}\n'''
if '.ma-skip-link{' not in nav_css:
    nav_css += skip_css
write('assets/css/mode-atlas-navigation.css', nav_css)

# Shared control target policy: compact buttons stay dense with mouse/keyboard but are touch-safe on coarse pointers.
components = read('assets/css/mode-atlas-components.css')
coarse_components = '''\n\n@media(pointer:coarse){\n  .ma-button--small{--ma-button-min-height:44px;}\n  .ma-icon-button,.ma-dialog__close--icon{min-width:44px;min-height:44px;}\n}\n'''
if '@media(pointer:coarse){\n  .ma-button--small' not in components:
    components += coarse_components
write('assets/css/mode-atlas-components.css', components)

# Modal drawers must prevent background page scrolling while open.
profile_css = read('assets/css/mode-atlas-profile-settings.css')
if 'body.profile-open,body.settings-open{overflow:hidden;}' not in profile_css:
    profile_css = 'body.profile-open,body.settings-open{overflow:hidden;}\n' + profile_css
write('assets/css/mode-atlas-profile-settings.css', profile_css)

# Page-specific compact controls retain desktop density, but meet the shared touch target on coarse pointers.
wordbank_css = read('assets/css/mode-atlas-wordbank-page.css')
if '@media(pointer:coarse){.summary-toggle{width:44px;height:44px;}}' not in wordbank_css:
    wordbank_css += '\n@media(pointer:coarse){.summary-toggle{width:44px;height:44px;}}\n'
write('assets/css/mode-atlas-wordbank-page.css', wordbank_css)

kana_css = read('assets/css/mode-atlas-kana-page.css')
if '@media(pointer:coarse){.kana-ghost-action,.kana-map-action,.kana-inline-btn{--ma-button-min-height:44px;}}' not in kana_css:
    kana_css += '\n@media(pointer:coarse){.kana-ghost-action,.kana-map-action,.kana-inline-btn{--ma-button-min-height:44px;}}\n'
write('assets/css/mode-atlas-kana-page.css', kana_css)

# Native trainer disclosure buttons preserve the established visual treatment.
study_css = read('assets/css/mode-atlas-study-shared.css')
trainer_button_css = '''\n\n/* Trainer disclosure controls are native buttons for keyboard operation without changing their visual role. */\n.ma-trainer-side-panel button.panel-header,\n.bottom-shell button.tab-button{\n  appearance:none;\n  width:100%;\n  margin:0;\n  background:transparent;\n  color:inherit;\n  -webkit-text-fill-color:currentColor;\n  box-shadow:none;\n  font:inherit;\n}\n.ma-trainer-side-panel button.panel-header{border:0;text-align:inherit;}\n.bottom-shell button.tab-button{border-top:0;border-bottom:0;border-left:0;}\nbutton.cell{appearance:none;min-height:0;padding:0;color:inherit;-webkit-text-fill-color:currentColor;font:inherit;box-shadow:none;}\n'''
if '.ma-trainer-side-panel button.panel-header' not in study_css:
    study_css += trainer_button_css
write('assets/css/mode-atlas-study-shared.css', study_css)

# Shared trainer controller is the single state owner for aria-expanded disclosure state.
replace_once(
    'assets/trainer/mode-atlas-trainer-controller.js',
    "      modifiersContentEl?.classList.toggle('open', settings.activeBottomTab === 'modifiers');\n      optionsContentEl?.classList.toggle('open', false);\n      modifiersTabEl?.classList.toggle('active', settings.activeBottomTab === 'modifiers');",
    "      const modifiersOpen = settings.activeBottomTab === 'modifiers';\n      modifiersContentEl?.classList.toggle('open', modifiersOpen);\n      optionsContentEl?.classList.toggle('open', false);\n      modifiersTabEl?.classList.toggle('active', modifiersOpen);\n      modifiersTabEl?.setAttribute('aria-expanded', String(modifiersOpen));"
)
replace_once(
    'assets/trainer/mode-atlas-trainer-controller.js',
    "      statsContentEl?.classList.toggle('hidden', !settings.statsVisible);\n      if (statsChevronEl) statsChevronEl.textContent = settings.statsVisible ? '▼' : '▲';\n      scoresContentEl?.classList.toggle('hidden', !settings.scoresVisible);\n      if (scoresChevronEl) scoresChevronEl.textContent = settings.scoresVisible ? '▼' : '▲';",
    "      statsContentEl?.classList.toggle('hidden', !settings.statsVisible);\n      byId('statsHeader')?.setAttribute('aria-expanded', String(!!settings.statsVisible));\n      if (statsChevronEl) statsChevronEl.textContent = settings.statsVisible ? '▼' : '▲';\n      scoresContentEl?.classList.toggle('hidden', !settings.scoresVisible);\n      byId('scoresHeader')?.setAttribute('aria-expanded', String(!!settings.scoresVisible));\n      if (scoresChevronEl) scoresChevronEl.textContent = settings.scoresVisible ? '▼' : '▲';"
)

# Shared heatmap cells are genuine detail controls; make them native keyboard-operable buttons.
replace_once(
    'assets/trainer/mode-atlas-trainer-shared.js',
    '        const cell = document.createElement("div");\n        cell.className = "cell";\n        if (String(ch).length > 1) cell.classList.add("combo");\n        cell.textContent = ch;\n        cell.style.background = heatmapColor(ch);',
    '        const cell = document.createElement("button");\n        cell.type = "button";\n        cell.className = "cell";\n        if (String(ch).length > 1) cell.classList.add("combo");\n        cell.textContent = ch;\n        const cellStats = getStats(ch);\n        cell.setAttribute("aria-label", `${ch}: ${cellStats.correct || 0} correct, ${cellStats.wrong || 0} incorrect. View mastery details`);\n        cell.style.background = heatmapColor(ch);'
)
replace_once(
    'assets/trainer/mode-atlas-trainer-shared.js',
    '        cell.addEventListener("click", (e) => {\n            e.stopPropagation();\n            popupLocked = true;\n            hoveredCell = cell;\n            showPopupForChar(ch, e);\n        });',
    '        cell.addEventListener("click", (e) => {\n            e.stopPropagation();\n            popupLocked = true;\n            hoveredCell = cell;\n            if (e.detail === 0) {\n                const rect = cell.getBoundingClientRect();\n                showPopupForChar(ch, { clientX: rect.left + (rect.width / 2), clientY: rect.top + (rect.height / 2) });\n            } else {\n                showPopupForChar(ch, e);\n            }\n        });\n        cell.addEventListener("keydown", (e) => {\n            if (e.key !== "Escape") return;\n            e.preventDefault();\n            popupLocked = false;\n            hoveredCell = null;\n            closePopup();\n        });'
)

# Shared dialog: only rendered descendants participate in the trap, and the visible message describes the dialog.
replace_once(
    'assets/app/mode-atlas-dialog.js',
    "    const message = create('p', 'ma-dialog__message');\n    message.dataset.maDialogMessage = '';",
    "    const message = create('p', 'ma-dialog__message');\n    message.id = 'maDialogMessage';\n    message.dataset.maDialogMessage = '';"
)
replace_once(
    'assets/app/mode-atlas-dialog.js',
    "      .filter((el) => !el.hidden && el.getAttribute('aria-hidden') !== 'true');",
    "      .filter((el) => !el.hidden && el.getAttribute('aria-hidden') !== 'true' && el.getClientRects().length > 0);"
)
replace_once(
    'assets/app/mode-atlas-dialog.js',
    "    message.textContent = opts.message;\n    message.hidden = !opts.message;",
    "    message.textContent = opts.message;\n    message.hidden = !opts.message;\n    if (opts.message) panel.setAttribute('aria-describedby', message.id);\n    else panel.removeAttribute('aria-describedby');"
)

# Focused 2.45 regression contract.
tests = read('tests/frontend.test.js')
test_block = r'''

test('2.45 responsive and accessibility QA keeps landmarks, keyboard controls, focus traps, and touch targets shared', () => {
  const frontend = read('frontend_components.py');
  const navigation = read('assets/css/mode-atlas-navigation.css');
  const components = read('assets/css/mode-atlas-components.css');
  const profileSettings = read('assets/css/mode-atlas-profile-settings.css');
  const dialog = read('assets/app/mode-atlas-dialog.js');
  const controller = read('assets/trainer/mode-atlas-trainer-controller.js');
  const sharedTrainer = read('assets/trainer/mode-atlas-trainer-shared.js');
  const studyCss = read('assets/css/mode-atlas-study-shared.css');
  const wordbankCss = read('assets/css/mode-atlas-wordbank-page.css');
  const kanaCss = read('assets/css/mode-atlas-kana-page.css');

  assert.match(frontend, /ma-skip-link[^>]+href=\"#mainContent\"/);
  assert.match(frontend, /<main id=\"mainContent\" class=\"app-shell ma-trainer-shell\"/);
  assert.match(frontend, /<button class=\"panel-header\" id=\"scoresHeader\" type=\"button\" aria-expanded=\"true\" aria-controls=\"scoresContent\"/);
  assert.match(frontend, /<button class=\"panel-header\" id=\"statsHeader\" type=\"button\" aria-expanded=\"true\" aria-controls=\"statsContent\"/);
  assert.match(frontend, /<button class=\"tab-button\" id=\"modifiersTab\" type=\"button\" aria-expanded=\"false\" aria-controls=\"modifiersContent\"/);

  for (const page of ['index.html','kana/index.html','reading/index.html','writing/index.html','results/index.html','wordbank/index.html','privacy/index.html','terms/index.html']) {
    const html = read(page);
    assert.equal((html.match(/id=\"mainContent\"/g) || []).length, 1, `${page} should expose one main content target`);
    assert.match(html, /class=\"ma-skip-link\" href=\"#mainContent\"/);
  }

  assert.match(navigation, /\.ma-skip-link\{/);
  assert.match(navigation, /@media\(pointer:coarse\)[\s\S]*\.ma-nav__section-link[\s\S]*min-height:44px/);
  assert.match(components, /@media\(pointer:coarse\)[\s\S]*\.ma-button--small\{--ma-button-min-height:44px;\}/);
  assert.match(profileSettings, /body\.profile-open,body\.settings-open\{overflow:hidden;\}/);
  assert.match(wordbankCss, /@media\(pointer:coarse\)\{\.summary-toggle\{width:44px;height:44px;\}\}/);
  assert.match(kanaCss, /@media\(pointer:coarse\)\{\.kana-ghost-action,\.kana-map-action,\.kana-inline-btn\{--ma-button-min-height:44px;\}\}/);

  assert.match(dialog, /message\.id = 'maDialogMessage'/);
  assert.match(dialog, /el\.getClientRects\(\)\.length > 0/);
  assert.match(dialog, /panel\.setAttribute\('aria-describedby', message\.id\)/);
  assert.match(controller, /modifiersTabEl\?\.setAttribute\('aria-expanded', String\(modifiersOpen\)\)/);
  assert.match(controller, /byId\('statsHeader'\)\?\.setAttribute\('aria-expanded'/);
  assert.match(controller, /byId\('scoresHeader'\)\?\.setAttribute\('aria-expanded'/);
  assert.match(sharedTrainer, /document\.createElement\(\"button\"\)[\s\S]*View mastery details/);
  assert.match(sharedTrainer, /e\.detail === 0[\s\S]*getBoundingClientRect/);
  assert.match(sharedTrainer, /e\.key !== \"Escape\"/);
  assert.match(studyCss, /button\.cell\{appearance:none;min-height:0/);

  const sharedPage = read('assets/css/mode-atlas-page-shared.css');
  assert.match(sharedPage, /button:focus-visible,a:focus-visible/);
  assert.match(sharedPage, /prefers-reduced-motion:reduce/);
});
'''
if "test('2.45 responsive and accessibility QA" not in tests:
    tests += test_block
write('tests/frontend.test.js', tests)

print('Applied Mode Atlas 2.45.0 responsive and accessibility source fixes')
