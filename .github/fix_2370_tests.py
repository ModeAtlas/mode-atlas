from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')

def write(rel, text):
    (ROOT / rel).write_text(text, encoding='utf-8')

def replace_once(src, old, new, label):
    count = src.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 occurrence, found {count}')
    return src.replace(old, new, 1)

def replace_test_tail(src, test_name, marker, replacement):
    start_token = f"test('{test_name}'"
    start = src.find(start_token)
    if start < 0:
        raise RuntimeError(f'test not found: {test_name}')
    next_test = src.find("\n\ntest('", start + len(start_token))
    end = len(src) if next_test < 0 else next_test
    block = src[start:end]
    marker_pos = block.find(marker)
    if marker_pos < 0:
        raise RuntimeError(f'marker not found in {test_name}: {marker}')
    close_pos = block.rfind('\n});')
    if close_pos < marker_pos:
        raise RuntimeError(f'closing token not found in {test_name}')
    new_block = block[:marker_pos] + replacement.rstrip() + block[close_pos:]
    return src[:start] + new_block + src[end:]

# Preserve the established shared-shell bottom rhythm and let the shared empty
# state primitive own border mechanics.
css = read('assets/css/mode-atlas-wordbank-page.css')
css = replace_once(css, '  margin-bottom:64px;', '  margin-bottom:56px;', 'Word Bank bottom rhythm')
css = replace_once(
    css,
    '  border:0;\n  text-align:center;',
    '  --ma-empty-border:transparent;\n  text-align:center;',
    'empty state border ownership'
)
write('assets/css/mode-atlas-wordbank-page.css', css)

# Keep the state-aware enhancement safe in lightweight DOM/test environments.
js = read('assets/pages/mode-atlas-wordbank-page.js')
js = replace_once(
    js,
    "      document.body.classList.toggle('ma-wordbank-populated', populated);\n      document.body.dataset.maWordBankExperience = populated ? 'collection' : 'empty';",
    "      document.body?.classList?.toggle?.('ma-wordbank-populated', populated);\n      if (document.body?.dataset) document.body.dataset.maWordBankExperience = populated ? 'collection' : 'empty';",
    'Word Bank experience DOM guard'
)
write('assets/pages/mode-atlas-wordbank-page.js', js)

# The retired grid wrapper was replaced by two top-level sections. Remove its
# old closing tag after the hidden Add/Settings dialog hosts.
html = read('wordbank/index.html')
settings_idx = html.index('id="wordBankActionsPanel"')
body_assets_idx = html.index('<!-- MODE_ATLAS_BODY_ASSETS_START -->', settings_idx)
orphan_idx = html.find('    </section>', settings_idx, body_assets_idx)
if orphan_idx < 0:
    raise RuntimeError('retired Word Bank wrapper closer not found')
html = html[:orphan_idx] + html[orphan_idx + len('    </section>\n'):]
if html.count('<section') != html.count('</section>'):
    raise RuntimeError(f'unbalanced Word Bank sections after cleanup: {html.count("<section")} != {html.count("</section>")}')
write('wordbank/index.html', html)

# Migrate only the Word Bank tails of three historical visual-contract tests.
# Functional save/order/duplicate/cloud tests are deliberately untouched.
tests = read('tests/frontend.test.js')

tests = replace_test_tail(
    tests,
    'shared drawer, card, and form primitives replace page-local surface ownership',
    '  assert.match(wordbankHtml, /class="ma-input" id="kanaInput"/);',
    r'''  assert.match(wordbankHtml, /class="ma-input" id="kanaInput"/);
  assert.match(wordbankHtml, /class="ma-select" id="sortSelect"/);
  assert.match(wordbankHtml, /class="wordbank-overview"/);
  assert.match(wordbankHtml, /class="wordbank-library ma-page-section"/);
  assert.doesNotMatch(wordbankHtml, /library-panel ma-card|class="stat ma-stat ma-card/);
  assert.match(wordbankJs, /field-small ma-field/);
  assert.match(wordbankJs, /input\.className = "ma-input"/);
  assert.match(wordbankJs, /notes\.className = "ma-textarea"/);
  assert.match(wordbankJs, /createEl\("details", "wordbank-entry"\)/);
  assert.doesNotMatch(wordbankJs, /card ma-card ma-card--soft/);
  assert.doesNotMatch(wordbankCss, /input\[type="text"\]\s*,\s*textarea\s*,\s*select/);
  assert.doesNotMatch(wordbankCss, /\.field-small label\s*\{/);'''
)

tests = replace_test_tail(
    tests,
    'Kana, Results, and Word Bank consume shared page UI primitives without re-owning their mechanics',
    '  assert.match(wordbankHtml, /stats ma-stat-grid/);',
    r'''  assert.match(wordbankHtml, /class="wordbank-overview"/);
  assert.match(wordbankHtml, /class="wordbank-intro ma-page-hero"/);
  assert.doesNotMatch(wordbankHtml, /wordbank-intro[^\n]*ma-card|class="stat ma-stat ma-card/,
    'Word Bank overview should remain an open collection surface rather than nested cards');
  assert.match(wordbankHtml, /ma-toolbar-shared ma-toolbar-shared--sticky/);
  assert.match(wordbankHtml, /id="wordBankActionsBtn"/);
  assert.doesNotMatch(wordbankHtml, /<details class="wordbank-tools">/);
  assert.match(wordbankJs, /empty ma-empty-state/);
  assert.match(wordbankJs, /createEl\("details", "wordbank-entry"\)/);
  const wordbankEmptyBlock = wordbankCss.match(/\.empty\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(wordbankEmptyBlock, /(^|\n)\s*border\s*:/,
    'Word Bank empty state should configure variables instead of re-owning its border');
  assert.match(wordbankEmptyBlock, /--ma-empty-border:transparent/);'''
)

tests = replace_test_tail(
    tests,
    '2.31 visual standardisation keeps shared hierarchy, focus, guidance, and collection contracts',
    '  const libraryIndex = wordbank.indexOf(\'class="panel library-panel ma-card"\');',
    r'''  const libraryIndex = wordbank.indexOf('class="wordbank-library ma-page-section"');
  const addIndex = wordbank.indexOf('id="wordBankAddPanel"');
  assert.ok(libraryIndex >= 0 && addIndex > libraryIndex, 'Word Bank collection must precede quick capture in document order');
  assert.match(wordbank, /id="wordBankAddJumpBtn"/);
  assert.match(wordbank, /id="wordBankActionsBtn"/);
  assert.doesNotMatch(wordbank, /<details class="wordbank-tools">/);
  assert.match(wordbankJs, /createIcon\(entry\.favorite \? "star-filled" : "star"\)/);'''
)

write('tests/frontend.test.js', tests)
