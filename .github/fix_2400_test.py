from pathlib import Path
p = Path('tests/frontend.test.js')
s = p.read_text()
old = """    const sharedIndex = html.indexOf('mode-atlas-trainer-controller.assets-2.39.0.js');
    const pageIndex = Math.max(html.indexOf('mode-atlas-default-page.assets-2.39.0.js'), html.indexOf('mode-atlas-reverse-page.assets-2.39.0.js'));"""
new = """    const sharedIndex = html.indexOf(`mode-atlas-trainer-controller.${REVISION}.js`);
    const pageIndex = Math.max(html.indexOf(`mode-atlas-default-page.${REVISION}.js`), html.indexOf(`mode-atlas-reverse-page.${REVISION}.js`));"""
if s.count(old) != 1:
    raise RuntimeError(f'expected one stale 2.39 controller-order assertion, found {s.count(old)}')
p.write_text(s.replace(old, new, 1))
