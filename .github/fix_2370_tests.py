from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def read(rel): return (ROOT/rel).read_text(encoding='utf-8')
def write(rel,text): (ROOT/rel).write_text(text,encoding='utf-8')
def replace_once(src,old,new,label):
    n=src.count(old)
    if n!=1: raise RuntimeError(f'{label}: expected 1 occurrence, found {n}')
    return src.replace(old,new,1)

# Preserve the established shared-shell bottom rhythm and consume empty-state
# border ownership through its variable rather than a local border declaration.
css=read('assets/css/mode-atlas-wordbank-page.css')
css=replace_once(css,'  margin-bottom:64px;','  margin-bottom:56px;','Word Bank bottom rhythm')
css=replace_once(css,'  border:0;\n  text-align:center;','  --ma-empty-border:transparent;\n  text-align:center;','empty state border ownership')
write('assets/css/mode-atlas-wordbank-page.css',css)

# Keep the state-aware enhancement safe in lightweight DOM/test environments.
js=read('assets/pages/mode-atlas-wordbank-page.js')
js=replace_once(js,
"      document.body.classList.toggle('ma-wordbank-populated', populated);\n      document.body.dataset.maWordBankExperience = populated ? 'collection' : 'empty';",
"      document.body?.classList?.toggle?.('ma-wordbank-populated', populated);\n      if (document.body?.dataset) document.body.dataset.maWordBankExperience = populated ? 'collection' : 'empty';",
'Word Bank experience DOM guard')
write('assets/pages/mode-atlas-wordbank-page.js',js)

# Remove the retired grid wrapper's orphan closing tag after the two hidden
# dialog hosts. The new library section is already closed before those hosts.
html=read('wordbank/index.html')
settings_idx=html.index('id="wordBankActionsPanel"')
orphan_idx=html.index('    </section>',settings_idx)
body_assets_idx=html.index('<!-- MODE_ATLAS_BODY_ASSETS_START -->',settings_idx)
if orphan_idx > body_assets_idx:
    raise RuntimeError('orphan Word Bank section closer was not before body assets')
html=html[:orphan_idx]+html[orphan_idx+len('    </section>\n'):]
write('wordbank/index.html',html)

# Migrate historical UI assertions from the retired card composition to the
# current source-level contracts. Functional persistence tests remain intact.
tests=read('tests/frontend.test.js')
tests=replace_once(tests,
'''  assert.match(wordbankHtml, /class="ma-input" id="kanaInput"/);
  assert.match(wordbankHtml, /class="ma-select" id="sortSelect"/);
  assert.match(wordbankHtml, /class="stat ma-stat ma-card ma-card--flat"/);
  assert.match(wordbankHtml, /class="panel [^"]*ma-card"/);
  assert.match(wordbankJs, /field-small ma-field/);
  assert.match(wordbankJs, /input\.className = "ma-input"/);
  assert.match(wordbankJs, /notes\.className = "ma-textarea"/);
  assert.match(wordbankJs, /card ma-card ma-card--soft/);
  assert.doesNotMatch(wordbankCss, /input\[type="text"\]\s*,\s*textarea\s*,\s*select/);
  assert.doesNotMatch(wordbankCss, /\.field-small label\s*\{/);
''',
'''  assert.match(wordbankHtml, /class="ma-input" id="kanaInput"/);
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
  assert.doesNotMatch(wordbankCss, /\.field-small label\s*\{/);
''','shared primitives Word Bank assertions')

tests=replace_once(tests,
'''  assert.match(wordbankHtml, /stats ma-stat-grid/);
  assert.match(wordbankHtml, /hero ma-card ma-page-hero ma-page-intro/);
  assert.match(wordbankHtml, /ma-toolbar-shared ma-toolbar-shared--sticky/);
  assert.match(wordbankHtml, /id="wordBankActionsBtn"/);
  assert.doesNotMatch(wordbankHtml, /<details class="wordbank-tools">/);
  assert.match(wordbankJs, /empty ma-card ma-empty-state/);
  const wordbankStatBlock = wordbankCss.match(/\.stats?\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(wordbankStatBlock, /(^|\n)\s*border\s*:/,
    'Word Bank stats should not re-own shared stat card mechanics');
  const wordbankEmptyBlock = wordbankCss.match(/\.empty\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(wordbankEmptyBlock, /(^|\n)\s*border\s*:/,
    'Word Bank empty state should configure variables instead of re-owning its border');
''',
'''  assert.match(wordbankHtml, /class="wordbank-overview"/);
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
  assert.match(wordbankEmptyBlock, /--ma-empty-border:transparent/);
''','shared page primitives Word Bank assertions')

tests=replace_once(tests,
'''  const libraryIndex = wordbank.indexOf('class="panel library-panel ma-card"');
  const addIndex = wordbank.indexOf('id="wordBankAddPanel"');
  assert.ok(libraryIndex >= 0 && addIndex > libraryIndex, 'Word Bank collection must precede quick capture in document order');
''',
'''  const libraryIndex = wordbank.indexOf('class="wordbank-library ma-page-section"');
  const addIndex = wordbank.indexOf('id="wordBankAddPanel"');
  assert.ok(libraryIndex >= 0 && addIndex > libraryIndex, 'Word Bank collection must precede quick capture in document order');
''','2.31 Word Bank document-order assertion')
write('tests/frontend.test.js',tests)
