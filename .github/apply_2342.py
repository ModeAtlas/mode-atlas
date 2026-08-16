from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]

def read(rel): return (ROOT/rel).read_text(encoding='utf-8')
def write(rel,text): (ROOT/rel).write_text(text,encoding='utf-8')
def replace_once(src,old,new,label):
    count=src.count(old)
    if count!=1: raise RuntimeError(f'{label}: expected 1 occurrence, found {count}')
    return src.replace(old,new,1)

front=read('frontend_components.py')
front=replace_once(front,
'''                f'<button class="{classes}" type="button" data-ma-nav-scope="product" '
                'data-ma-nav-item="kana" data-ma-kana-menu-trigger aria-haspopup="true" '
                'aria-expanded="false" aria-controls="maKanaMenu">'
                f'<span>{html.escape(label)}</span><span class="ma-nav__menu-chevron" aria-hidden="true"></span>'
                '</button>'
''',
'''                f'<a class="{classes}" href="/kana/" data-ma-nav-scope="product" '
                'data-ma-nav-item="kana" data-ma-kana-menu-trigger aria-haspopup="true" '
                'aria-expanded="false" aria-controls="maKanaMenu">'
                f'<span>{html.escape(label)}</span><span class="ma-nav__menu-chevron" aria-hidden="true"></span>'
                '</a>'
''',
'Kana trigger becomes destination link')
write('frontend_components.py',front)

css=read('assets/css/mode-atlas-navigation.css')
css=replace_once(css,
'''  display:flex;
  align-items:center;
  justify-content:flex-start;
  border:1px solid transparent;
''',
'''  display:flex;
  align-items:center;
  justify-content:center;
  text-align:center;
  border:1px solid transparent;
''',
'center flyout labels')
write('assets/css/mode-atlas-navigation.css',css)

menu=read('assets/ui/mode-atlas-navigation-menu.js')
menu=replace_once(menu,
'''  trigger.addEventListener('click', function(event){
    event.preventDefault();
    setOpen(!isOpen());
  });
''',
'''  trigger.addEventListener('click', function(event){
    var finePointer = !!(hoverQuery && hoverQuery.matches);
    if (finePointer) return;
    if (!isOpen()) {
      event.preventDefault();
      setOpen(true);
    }
  });
''',
'Kana trigger touch interaction')
write('assets/ui/mode-atlas-navigation-menu.js',menu)

version=read('assets/app/mode-atlas-version.js').replace("var VERSION = '2.34.1';","var VERSION = '2.34.2';").replace("var CACHE_REVISION = 'assets-2.34.1';","var CACHE_REVISION = 'assets-2.34.2';")
write('assets/app/mode-atlas-version.js',version)
for rel in ('package.json','package-lock.json'):
    data=json.loads(read(rel)); data['version']='2.34.2'
    if rel=='package-lock.json': data.setdefault('packages',{}).setdefault('',{})['version']='2.34.2'
    write(rel,json.dumps(data,indent=2)+'\n')
write('README.md',read('README.md').replace('Version: 2.34.1','Version: 2.34.2'))

changelog=read('CHANGELOG.md')
entry="""## 2.34.2 - 2026-08-16
- Restored Kana Trainer as a direct navigation destination while retaining the compact Kana section flyout.
- Desktop/fine-pointer users can hover to inspect Kana sections and click Kana Trainer to go straight to the Kana overview.
- Touch users open the flyout on the first tap and navigate to Kana on a second tap of the Kana Trainer control, avoiding a fragile timed double-tap gesture.
- Centered Overview, Reading, Writing, and Results labels within the flyout controls.

"""
if not changelog.startswith('## 2.34.2'): changelog=entry+changelog
write('CHANGELOG.md',changelog)

tests=read('tests/frontend.test.js')
append=r'''

test('2.34.2 Kana flyout keeps fast desktop navigation and deliberate touch access', () => {
  const frontend = read('frontend_components.py');
  const navJs = read('assets/ui/mode-atlas-navigation-menu.js');
  const navCss = read('assets/css/mode-atlas-navigation.css');
  assert.match(frontend, /<a class=\\"\{classes\}\\" href=\\"\/kana\/\\" data-ma-nav-scope=\\"product\\"/);
  assert.doesNotMatch(frontend, /<button class=\\"\{classes\}\\" type=\\"button\\" data-ma-nav-scope=\\"product\\"/);
  assert.match(navJs, /var finePointer = !!\(hoverQuery && hoverQuery\.matches\)/);
  assert.match(navJs, /if \(finePointer\) return/);
  assert.match(navJs, /if \(!isOpen\(\)\) \{\s*event\.preventDefault\(\);\s*setOpen\(true\);/);
  assert.doesNotMatch(navJs, /setOpen\(!isOpen\(\)\)/);
  assert.match(navCss, /\.ma-nav__section-link\{[\s\S]*?justify-content:center;[\s\S]*?text-align:center;/);
});
'''
if '2.34.2 Kana flyout keeps fast desktop navigation' not in tests: tests=tests.rstrip()+append
write('tests/frontend.test.js',tests)
