from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Migrate the historical hero contract to the intentional open Kana header.
test_path = ROOT / 'tests/frontend.test.js'
tests = test_path.read_text(encoding='utf-8')
old = "  assert.match(kanaHtml, /kana-hub-hero glass ma-card/);"
new = "  assert.match(kanaHtml, /kana-hub-hero ma-page-hero/);\n  assert.doesNotMatch(kanaHtml, /kana-hub-hero[^\\n]*ma-card/,\n    'Kana hero should remain an open orientation section rather than a shared card surface');"
if tests.count(old) != 1:
    raise RuntimeError(f'expected one legacy Kana hero assertion, found {tests.count(old)}')
test_path.write_text(tests.replace(old, new, 1), encoding='utf-8')

# Keep the canonical section-header rule structurally readable by the existing
# ownership regression. The base rule does not own display/flex mechanics;
# responsive column layout remains scoped to the page breakpoint below.
css_path = ROOT / 'assets/css/mode-atlas-kana-page.css'
css = css_path.read_text(encoding='utf-8')
old_css = '.kana-section-head{--ma-section-head-gap:20px;margin-bottom:clamp(24px,4vw,36px);}'
new_css = '''.kana-section-head{
  --ma-section-head-gap:20px;
  margin-bottom:clamp(24px,4vw,36px);
}'''
if css.count(old_css) != 1:
    raise RuntimeError(f'expected one compact Kana section-head rule, found {css.count(old_css)}')
css_path.write_text(css.replace(old_css, new_css, 1), encoding='utf-8')
