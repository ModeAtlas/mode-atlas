from pathlib import Path
import json
import re

ROOT=Path(__file__).resolve().parents[1]
def read(rel): return (ROOT/rel).read_text(encoding='utf-8')
def write(rel,text): (ROOT/rel).write_text(text,encoding='utf-8')
def replace_once(src,old,new,label):
    count=src.count(old)
    if count!=1: raise RuntimeError(f'{label}: expected 1 occurrence, found {count}')
    return src.replace(old,new,1)

front=read('frontend_components.py')
front=replace_once(front,
"    'index.html': NavConfig('atlas', 'あア', 'Mode Atlas', 'Study ecosystem'),",
"    'index.html': NavConfig('atlas', 'あア', 'Mode Atlas', 'Learn Japanese'),",
'Atlas nav title')
front=replace_once(front,
"    'results/index.html': NavConfig('results', '測', 'Kana Trainer', 'Test Results', brand_href='/kana/', accent='results'),",
"    'results/index.html': NavConfig('results', '測', 'Kana Trainer', 'Results', brand_href='/kana/', accent='results'),",
'Results nav title')
old_links="""PRIMARY_LINKS = (
    ('atlas', 'Atlas', '/'),
    ('kana', 'Kana', '/kana/'),
    ('reading', 'Reading', '/reading/'),
    ('writing', 'Writing', '/writing/'),
    ('results', 'Results', '/results/'),
    ('wordbank', 'Word Bank', '/wordbank/'),
)
"""
new_links="""PRIMARY_LINKS = (
    ('atlas', 'Atlas', '/'),
    ('kana', 'Kana Trainer', '/kana/'),
    ('wordbank', 'Word Bank', '/wordbank/'),
)

KANA_LINKS = (
    ('kana', 'Overview', '/kana/'),
    ('reading', 'Reading', '/reading/'),
    ('writing', 'Writing', '/writing/'),
    ('results', 'Results', '/results/'),
)
KANA_KEYS = frozenset(key for key, _label, _href in KANA_LINKS)
"""
front=replace_once(front,old_links,new_links,'navigation link hierarchy')

new_render=r'''def render_navigation(config: NavConfig) -> str:
    legal_page = config.key in {'privacy', 'terms'}
    links = LEGAL_LINKS if legal_page else PRIMARY_LINKS
    kana_section = not legal_page and config.key in KANA_KEYS
    product_active = 'kana' if kana_section else config.key

    link_markup = []
    for key, label, href in links:
        active = key == product_active
        classes = 'ma-nav__link' + (' is-active' if active else '')
        current = ' aria-current="page"' if (not kana_section and key == config.key) else ''
        link_markup.append(
            f'<a class="{classes}" data-ma-nav-scope="product" data-ma-nav-item="{_attr(key)}" href="{_attr(href)}"{current}>{html.escape(label)}</a>'
        )

    subnav_markup = ''
    if kana_section:
        local_links = []
        for key, label, href in KANA_LINKS:
            active = key == config.key
            classes = 'ma-nav__subnav-link' + (' is-active' if active else '')
            current = ' aria-current="page"' if active else ''
            local_links.append(
                f'<a class="{classes}" data-ma-nav-scope="kana" data-ma-kana-nav-item="{_attr(key)}" href="{_attr(href)}"{current}>{html.escape(label)}</a>'
            )
        subnav_markup = f'<div class="ma-nav__subnav" data-ma-kana-nav aria-label="Kana Trainer sections">{" ".join(local_links)}</div>'

    action_markup = ''
    if config.account_actions:
        hide_action = ''
        if config.hideable:
            hide_action = '<button class="ma-nav__action ma-nav__action--quiet ma-nav__focus" id="studyNavHideBtn" type="button" aria-label="Enter focus mode" title="Focus mode"><svg class="ma-icon ma-icon--sm" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-focus"></use></svg><span class="ma-nav__action-label">Focus mode</span></button>'
        action_markup = f'''
      <div class="ma-nav__actions">
        <button class="ma-nav__action ma-nav__profile" id="profileOpenBtn" type="button" data-profile-open aria-haspopup="dialog" aria-controls="profileDrawer">
          <span class="ma-nav__avatar" id="topProfileDot" aria-hidden="true">M</span>
          <span class="ma-nav__action-label">Profile</span>
        </button>
        <button class="ma-nav__action ma-nav__settings" type="button" data-settings-open aria-haspopup="dialog" aria-controls="settingsDrawer" aria-label="Open settings" title="Settings">
          <svg class="ma-icon ma-nav__settings-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-settings"></use></svg>
          <span class="ma-nav__action-label">Settings</span>
        </button>
        {hide_action}
      </div>'''

    nav_id = ' id="studyNav"' if config.hideable else ''
    handle = ''
    if config.hideable:
        handle = '\n<button class="ma-nav-handle" id="studyNavShowBtn" type="button"><svg class="ma-icon ma-icon--sm" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-focus"></use></svg><span>Exit focus mode</span></button>'

    subnav_class = ' ma-nav--has-subnav' if kana_section else ''
    return f'''{NAV_START}
<nav class="ma-nav ma-nav--{_attr(config.accent)}{subnav_class}"{nav_id} data-ma-navigation="shared" data-ma-page="{_attr(config.key)}" aria-label="Mode Atlas navigation">
  <a class="ma-nav__brand" href="{_attr(config.brand_href)}" aria-label="Mode Atlas home">
    <span class="ma-nav__mark" aria-hidden="true">{html.escape(config.mark)}</span>
    <span class="ma-nav__brand-copy">
      <span class="ma-nav__kicker">{html.escape(config.kicker)}</span>
      <span class="ma-nav__title">{html.escape(config.title)}</span>
    </span>
  </a>
  <div class="ma-nav__content">
    <div class="ma-nav__primary">
      <div class="ma-nav__links">{' '.join(link_markup)}</div>{action_markup}
    </div>
    {subnav_markup}
  </div>
</nav>{handle}
{NAV_END}'''
'''
front,count=re.subn(r"def render_navigation\(config: NavConfig\) -> str:[\s\S]*?(?=\nHEAD_ASSETS_START =)",new_render,front,count=1)
if count!=1: raise RuntimeError('render_navigation replacement failed')
write('frontend_components.py',front)

css=read('assets/css/mode-atlas-navigation.css')
css=replace_once(css,'.ma-nav__brand{\n  display:flex;', '.ma-nav__brand{\n  align-self:center;\n  display:flex;', 'brand alignment')
new_content='''.ma-nav__content{
  min-width:0;
  flex:1 1 auto;
  display:grid;
  gap:8px;
}
.ma-nav__primary{
  min-width:0;
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:var(--ma-space-2);
}
.ma-nav__links,.ma-nav__actions{
  display:flex;
  align-items:center;
  gap:var(--ma-space-2);
}
.ma-nav__links{min-width:0;overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain;}
.ma-nav__links::-webkit-scrollbar{display:none;}
.ma-nav__subnav{
  min-width:0;
  padding-top:8px;
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:4px;
  overflow-x:auto;
  border-top:1px solid color-mix(in srgb,var(--ma-border) 78%,transparent);
  scrollbar-width:none;
  overscroll-behavior-x:contain;
}
.ma-nav__subnav::-webkit-scrollbar{display:none;}
'''
css,count=re.subn(r"\.ma-nav__content\{[\s\S]*?\.ma-nav__links::-webkit-scrollbar\{display:none;\}\n",new_content,css,count=1)
if count!=1: raise RuntimeError('navigation content CSS replacement failed')
css=replace_once(css,
'.ma-nav__link:focus-visible,.ma-nav__action:focus-visible,.ma-nav-handle:focus-visible{outline:3px solid var(--ma-focus-ring);outline-offset:2px;}',
'.ma-nav__link:focus-visible,.ma-nav__subnav-link:focus-visible,.ma-nav__action:focus-visible,.ma-nav-handle:focus-visible{outline:3px solid var(--ma-focus-ring);outline-offset:2px;}',
'nav focus selector')
css=replace_once(css,
'''.ma-nav__link.is-active{
  border-color:color-mix(in srgb,var(--ma-nav-accent) 48%,var(--ma-border));
  background:color-mix(in srgb,var(--ma-nav-accent) 15%,var(--ma-card-2));
  color:var(--ma-text-strong);
}
''',
'''.ma-nav__link.is-active{
  border-color:color-mix(in srgb,var(--ma-nav-accent) 48%,var(--ma-border));
  background:color-mix(in srgb,var(--ma-nav-accent) 15%,var(--ma-card-2));
  color:var(--ma-text-strong);
}
.ma-nav__subnav-link{
  flex:0 0 auto;
  min-height:34px;
  padding:0 10px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border:1px solid transparent;
  border-radius:var(--ma-radius-control);
  color:var(--ma-muted);
  font-size:.75rem;
  font-weight:800;
  line-height:1;
  text-decoration:none;
  transition:background var(--ma-motion-fast) ease,border-color var(--ma-motion-fast) ease,color var(--ma-motion-fast) ease;
}
.ma-nav__subnav-link:hover{
  background:var(--ma-control-hover);
  color:var(--ma-text);
}
.ma-nav__subnav-link.is-active{
  border-color:color-mix(in srgb,var(--ma-nav-accent) 34%,transparent);
  background:color-mix(in srgb,var(--ma-nav-accent) 11%,transparent);
  color:var(--ma-text-strong);
}
''',
'subnav styles')
old_mobile='''  .ma-nav__content{grid-column:1 / -1;width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;}
  .ma-nav__links{width:100%;gap:6px;}
'''
new_mobile='''  .ma-nav__content{grid-column:1 / -1;width:100%;gap:8px;}
  .ma-nav__primary{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;}
  .ma-nav__links{width:100%;gap:6px;}
  .ma-nav__subnav{justify-content:flex-start;gap:4px;padding-top:8px;}
'''
css=replace_once(css,old_mobile,new_mobile,'mobile navigation layout')
css=replace_once(css,'  .ma-nav__content{grid-template-columns:minmax(0,1fr) auto;}\n', '  .ma-nav__primary{grid-template-columns:minmax(0,1fr) auto;}\n', 'phone navigation layout')
css=replace_once(css,
'html[data-ma-theme="light"] .ma-nav__link.is-active{color:var(--ma-text-strong);-webkit-text-fill-color:var(--ma-text-strong);}\n',
'html[data-ma-theme="light"] .ma-nav__link.is-active{color:var(--ma-text-strong);-webkit-text-fill-color:var(--ma-text-strong);}\nhtml[data-ma-theme="light"] .ma-nav__subnav-link{color:var(--ma-muted);-webkit-text-fill-color:var(--ma-muted);}\nhtml[data-ma-theme="light"] .ma-nav__subnav-link.is-active{color:var(--ma-text-strong);-webkit-text-fill-color:var(--ma-text-strong);}\n',
'light subnav treatment')
css=replace_once(css,
'  .ma-nav__link,.ma-nav__action{transition:none;}\n',
'  .ma-nav__link,.ma-nav__subnav-link,.ma-nav__action{transition:none;}\n',
'reduced motion nav')
write('assets/css/mode-atlas-navigation.css',css)

version=read('assets/app/mode-atlas-version.js').replace("var VERSION = '2.33.2';","var VERSION = '2.34.0';").replace("var CACHE_REVISION = 'assets-2.33.2';","var CACHE_REVISION = 'assets-2.34.0';")
write('assets/app/mode-atlas-version.js',version)
for rel in ('package.json','package-lock.json'):
    data=json.loads(read(rel));data['version']='2.34.0'
    if rel=='package-lock.json': data.setdefault('packages',{}).setdefault('',{})['version']='2.34.0'
    write(rel,json.dumps(data,indent=2)+'\n')
write('README.md',read('README.md').replace('Version: 2.33.2','Version: 2.34.0'))
changelog=read('CHANGELOG.md')
entry="""## 2.34.0 - 2026-08-16
- Reworked shared navigation around product hierarchy: Atlas, Kana Trainer, and Word Bank are now the primary Mode Atlas destinations.
- Added one shared Kana-local navigation layer for Overview, Reading, Writing, and Results across the entire Kana branch.
- Keeps Kana Trainer visually active in the product navigation while the actual local page owns `aria-current=\"page\"`, preserving clear hierarchy without duplicate current-page semantics.
- Simplified Atlas navigation copy and kept all navigation generated by the existing build-time shared component owner.

"""
if not changelog.startswith('## 2.34.0'): changelog=entry+changelog
write('CHANGELOG.md',changelog)

tests=read('tests/frontend.test.js')
append=r'''

test('2.34 product navigation separates Mode Atlas destinations from Kana sections', () => {
  const frontend = read('frontend_components.py');
  const navCss = read('assets/css/mode-atlas-navigation.css');
  const productPages = ['index.html', 'wordbank/index.html'];
  const kanaPages = ['kana/index.html', 'reading/index.html', 'writing/index.html', 'results/index.html'];

  assert.match(frontend, /PRIMARY_LINKS = \([\s\S]*?'Atlas'[\s\S]*?'Kana Trainer'[\s\S]*?'Word Bank'[\s\S]*?\)/);
  assert.doesNotMatch(frontend.match(/PRIMARY_LINKS = \([\s\S]*?\)\n/)[0], /'Reading'|'Writing'|'Results'/);
  assert.match(frontend, /KANA_LINKS = \([\s\S]*?'Overview'[\s\S]*?'Reading'[\s\S]*?'Writing'[\s\S]*?'Results'/);
  assert.match(navCss, /\.ma-nav__subnav\{/);
  assert.match(navCss, /\.ma-nav__subnav-link\.is-active\{/);

  for (const rel of productPages) {
    const html = read(rel);
    assert.equal(count(html, /data-ma-nav-scope="product"/g), 3, `${rel} product navigation count`);
    assert.equal(count(html, /data-ma-kana-nav(?:\s|>)/g), 0, `${rel} should not show Kana-local nav`);
    assert.equal(count(html, /aria-current="page"/g), 1, `${rel} one current page`);
  }
  for (const rel of kanaPages) {
    const html = read(rel);
    assert.equal(count(html, /data-ma-nav-scope="product"/g), 3, `${rel} product navigation count`);
    assert.equal(count(html, /data-ma-nav-scope="kana"/g), 4, `${rel} Kana-local navigation count`);
    assert.equal(count(html, /data-ma-kana-nav(?:\s|>)/g), 1, `${rel} one Kana-local nav owner`);
    assert.equal(count(html, /aria-current="page"/g), 1, `${rel} local page alone owns aria-current`);
    assert.match(html, /data-ma-nav-item="kana"[^>]*class="[^"]*is-active|class="[^"]*is-active[^"]*"[^>]*data-ma-nav-item="kana"/, `${rel} Kana Trainer product active`);
  }
});
'''
if '2.34 product navigation separates Mode Atlas destinations' not in tests: tests=tests.rstrip()+append
write('tests/frontend.test.js',tests)
