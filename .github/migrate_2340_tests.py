from pathlib import Path
p=Path('tests/frontend.test.js')
s=p.read_text(encoding='utf-8')
old="  assert.match(kana, /mode-atlas-presets\\.assets-2\\.33\\.2\\.js/);"
new="  assert.match(kana, new RegExp(`mode-atlas-presets\\\\.${REVISION.replaceAll('.', '\\\\.')}\\\\.js`));"
if s.count(old)!=1:
    raise RuntimeError(f'expected one stale 2.33.2 preset assertion, found {s.count(old)}')
p.write_text(s.replace(old,new,1),encoding='utf-8')
