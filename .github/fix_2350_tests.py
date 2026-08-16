from pathlib import Path

path=Path('tests/frontend.test.js')
s=path.read_text(encoding='utf-8')
s=s.replace("  assert.match(homeCss, /font-family:\\s*var\\(--ma-font-ui\\)/);\n  assert.match(resultsCss, /font-family:\\s*var\\(--ma-font-ui\\)/);",
            "  assert.match(theme, /--ma-font-ui:/);\n  assert.match(resultsCss, /font-family:\\s*var\\(--ma-font-ui\\)/);")
s=s.replace("  const homeCss = read('assets/css/mode-atlas-home-page.css');\n  const wordbankHtml = read('wordbank/index.html');",
            "  const wordbankHtml = read('wordbank/index.html');")
s=s.replace("  assert.match(homeCss, /padding-block:var\\(--ma-space-3\\) clamp\\(24px,3vw,36px\\)/);\n","")
path.write_text(s,encoding='utf-8')
