from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'tests/frontend.test.js'
text = path.read_text(encoding='utf-8')
old = "  assert.match(kanaHtml, /kana-hub-hero glass ma-card/);"
new = "  assert.match(kanaHtml, /kana-hub-hero ma-page-hero/);\n  assert.doesNotMatch(kanaHtml, /kana-hub-hero[^\\n]*ma-card/,\n    'Kana hero should remain an open orientation section rather than a shared card surface');"
if text.count(old) != 1:
    raise RuntimeError(f'expected one legacy Kana hero assertion, found {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
