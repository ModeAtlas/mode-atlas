from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]

def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')

def write(rel, value):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding='utf-8')

def replace_once(source, old, new, label):
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 occurrence, found {count}')
    return source.replace(old, new, 1)

front = read('frontend_components.py')
new_render = r'''def render_navigation(config: NavConfig) -> str:
    legal_page = config.key in {'privacy', 'terms'}
    links = LEGAL_LINKS if legal_page else PRIMARY_LINKS
    kana_section = not legal_page and config.key in KANA_KEYS
    product_active = 'kana' if kana_section else config.key

    kana_flyout = ''
    if not legal_page:
        local_links = []
        for key, label, href in KANA_LINKS:
            active = key == config.key
            classes = 'ma-nav__section-link' + (' is-active' if active else '')
            current = ' aria-current="page"' if active else ''
            local_links.append(
                f'<a class="{classes}" data-ma-nav-scope="kana" data-ma-kana-nav-item="{_attr(key)}" href="{_attr(href)}"{current}>{html.escape(label)}</a>'
            )
        kana_flyout = (
            '<div class="ma-nav__flyout" id="maKanaMenu" data-ma-kana-nav '
            'aria-label="Kana Trainer sections">'
            + ' '.join(local_links)
            + '</div>'
        )

    link_markup = []
    for key, label, href in links:
        active = key == product_active
        if key == 'kana' and not legal_page:
            classes = 'ma-nav__link ma-nav__menu-trigger' + (' is-active' if active else '')
            link_markup.append(
                '<div class="ma-nav__menu" data-ma-kana-menu>'
                f'<button class="{classes}" type="button" data-ma-nav-scope="product" '
                'data-ma-nav-item="kana" data-ma-kana-menu-trigger aria-haspopup="true" '
                'aria-expanded="false" aria-controls="maKanaMenu">'
                f'<span>{html.escape(label)}</span><span class="ma-nav__menu-chevron" aria-hidden="true"></span>'
                '</button>'
                f'{kana_flyout}'
                '</div>'
            )
            continue
        classes = 'ma-nav__link' + (' is-active' if active else '')
        current = ' aria-current="page"' if key == config.key else ''
        link_markup.append(
            f'<a class="{classes}" data-ma-nav-scope="product" data-ma-nav-item="{_attr(key)}" href="{_attr(href)}"{current}>{html.escape(label)}</a>'
        )

    action_markup = ''
    if config.account_actions:
        hide_action = ''
        if config.hideable:
            hide_action = '<button class="ma-nav__action ma-nav__action--quiet ma-nav__focus" id="studyNavHideBtn" type="button" aria-label="Enter focus mode" title="Focus mode"><svg class="ma-icon ma-icon--sm" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-focus"></use></svg><span class="ma-nav__action-label">Focus mode</span></button>'
        action_markup = f"""
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
      </div>"""

    nav_id = ' id="studyNav"' if config.hideable else ''
    handle = ''
    if config.hideable:
        handle = '\n<button class="ma-nav-handle" id="studyNavShowBtn" type="button"><svg class="ma-icon ma-icon--sm" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-focus"></use></svg><span>Exit focus mode</span></button>'

    return f"""{NAV_START}
<nav class="ma-nav ma-nav--{_attr(config.accent)}"{nav_id} data-ma-navigation="shared" data-ma-page="{_attr(config.key)}" aria-label="Mode Atlas navigation">
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
  </div>
</nav>{handle}
{NAV_END}"""
'''
front, count = re.subn(
    r"def render_navigation\(config: NavConfig\) -> str:[\s\S]*?(?=\nHEAD_ASSETS_START =)",
    lambda _match: new_render,
    front,
    count=1,
)
if count != 1:
    raise RuntimeError('render_navigation replacement failed')
front = replace_once(
    front,
    "INTERACTIVE_SCRIPTS_BEFORE_STORAGE = (\n    'assets/app/mode-atlas-toast.js',",
    "INTERACTIVE_SCRIPTS_BEFORE_STORAGE = (\n    'assets/ui/mode-atlas-navigation-menu.js',\n    'assets/app/mode-atlas-toast.js',",
    'shared navigation runtime manifest',
)
write('frontend_components.py', front)

css = read('assets/css/mode-atlas-navigation.css')
css = css.replace('.ma-nav__links{min-width:0;overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain;}\n.ma-nav__links::-webkit-scrollbar{display:none;}\n', '.ma-nav__links{min-width:0;overflow:visible;}\n')
css, count = re.subn(
    r"\.ma-nav__subnav\{[\s\S]*?\.ma-nav__subnav::-webkit-scrollbar\{display:none;\}\n\n",
    '',
    css,
    count=1,
)
if count != 1:
    raise RuntimeError('old in-flow Kana subnav CSS not found')
css = replace_once(
    css,
    '.ma-nav__link:focus-visible,.ma-nav__section-link:focus-visible,.ma-nav__action:focus-visible,.ma-nav-handle:focus-visible{outline:3px solid var(--ma-focus-ring);outline-offset:2px;}',
    '.ma-nav__link:focus-visible,.ma-nav__section-link:focus-visible,.ma-nav__action:focus-visible,.ma-nav-handle:focus-visible{outline:3px solid var(--ma-focus-ring);outline-offset:2px;}',
    'focus selector guard',
)
section_start = css.index('.ma-nav__section-link{')
section_end = css.index('.ma-nav__actions{', section_start)
flyout_css = r'''.ma-nav__menu{
  position:relative;
  flex:0 0 auto;
}
.ma-nav__menu::after{
  content:"";
  position:absolute;
  top:100%;
  left:-6px;
  right:-6px;
  height:10px;
}
.ma-nav__menu-trigger{gap:9px;}
.ma-nav__menu-chevron{
  width:7px;
  height:7px;
  display:block;
  border-right:2px solid currentColor;
  border-bottom:2px solid currentColor;
  transform:translateY(-2px) rotate(45deg);
  transition:transform var(--ma-motion-fast) ease;
}
.ma-nav__menu.is-open .ma-nav__menu-chevron,
.ma-nav__menu:focus-within .ma-nav__menu-chevron{
  transform:translateY(2px) rotate(225deg);
}
.ma-nav__flyout{
  position:absolute;
  top:calc(100% + 9px);
  left:50%;
  z-index:120;
  width:272px;
  padding:8px;
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:6px;
  box-sizing:border-box;
  border:1px solid var(--ma-border-strong);
  border-radius:18px;
  background:var(--ma-surface-strong);
  box-shadow:var(--ma-shadow-soft);
  opacity:0;
  visibility:hidden;
  pointer-events:none;
  transform:translate(-50%,-5px);
  transition:opacity var(--ma-motion-fast) ease,transform var(--ma-motion-fast) ease,visibility var(--ma-motion-fast) step-end;
}
.ma-nav__menu:hover .ma-nav__flyout,
.ma-nav__menu:focus-within .ma-nav__flyout,
.ma-nav__menu.is-open .ma-nav__flyout{
  opacity:1;
  visibility:visible;
  pointer-events:auto;
  transform:translate(-50%,0);
  transition:opacity var(--ma-motion-fast) ease,transform var(--ma-motion-fast) ease,visibility 0s;
}
.ma-nav__section-link{
  min-height:40px;
  padding:0 11px;
  display:flex;
  align-items:center;
  justify-content:flex-start;
  border:1px solid transparent;
  border-radius:12px;
  color:var(--ma-muted);
  font-size:.78rem;
  font-weight:800;
  line-height:1;
  text-decoration:none;
  transition:background var(--ma-motion-fast) ease,border-color var(--ma-motion-fast) ease,color var(--ma-motion-fast) ease;
}
.ma-nav__section-link:hover{
  background:var(--ma-control-hover);
  color:var(--ma-text);
}
.ma-nav__section-link.is-active{
  border-color:color-mix(in srgb,var(--ma-nav-accent) 34%,var(--ma-border));
  background:color-mix(in srgb,var(--ma-nav-accent) 13%,var(--ma-card-2));
  color:var(--ma-text-strong);
}
'''
css = css[:section_start] + flyout_css + css[section_end:]
css = css.replace('  .ma-nav__subnav{justify-content:flex-start;gap:4px;padding-top:8px;}\n', '')
css = css.replace(
    '  .ma-nav__link{min-height:40px;padding:0 11px;font-size:.78rem;}\n',
    '  .ma-nav__link{min-height:40px;padding:0 11px;font-size:.78rem;}\n  .ma-nav__flyout{width:264px;}\n',
    1,
)
css = css.replace(
    '  .ma-nav__link{padding:0 10px;}\n',
    '  .ma-nav__link{padding:0 8px;font-size:.75rem;}\n  .ma-nav__flyout{left:0;width:min(268px,calc(100vw - 28px));transform:translateY(-5px);}\n  .ma-nav__menu:hover .ma-nav__flyout,.ma-nav__menu:focus-within .ma-nav__flyout,.ma-nav__menu.is-open .ma-nav__flyout{transform:translateY(0);}\n',
    1,
)
css = css.replace(
    '  .ma-nav__link,.ma-nav__section-link,.ma-nav__action{transition:none;}\n',
    '  .ma-nav__link,.ma-nav__section-link,.ma-nav__action,.ma-nav__menu-chevron,.ma-nav__flyout{transition:none;}\n',
    1,
)
write('assets/css/mode-atlas-navigation.css', css)

nav_js = r'''(function initModeAtlasNavigationMenu(){
  'use strict';
  var menu = document.querySelector('[data-ma-kana-menu]');
  if (!menu || menu.dataset.maMenuBound === '1') return;

  var trigger = menu.querySelector('[data-ma-kana-menu-trigger]');
  var panel = menu.querySelector('[data-ma-kana-nav]');
  if (!trigger || !panel) return;

  menu.dataset.maMenuBound = '1';
  var closeTimer = 0;
  var hoverQuery = window.matchMedia ? window.matchMedia('(hover:hover) and (pointer:fine)') : null;

  function isOpen(){
    return menu.classList.contains('is-open');
  }

  function setOpen(open){
    window.clearTimeout(closeTimer);
    menu.classList.toggle('is-open', !!open);
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeAfterPointerLeave(){
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(function(){
      if (!menu.contains(document.activeElement)) setOpen(false);
    }, 120);
  }

  if (!hoverQuery || hoverQuery.matches) {
    menu.addEventListener('mouseenter', function(){ setOpen(true); });
    menu.addEventListener('mouseleave', closeAfterPointerLeave);
  }

  trigger.addEventListener('click', function(event){
    event.preventDefault();
    setOpen(!isOpen());
  });

  menu.addEventListener('focusin', function(){ setOpen(true); });
  menu.addEventListener('focusout', function(){
    window.setTimeout(function(){
      if (!menu.contains(document.activeElement)) setOpen(false);
    }, 0);
  });

  document.addEventListener('pointerdown', function(event){
    if (!menu.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', function(event){
    if (event.key !== 'Escape' || !isOpen()) return;
    setOpen(false);
    trigger.focus();
  });
})();
'''
write('assets/ui/mode-atlas-navigation-menu.js', nav_js)

version = read('assets/app/mode-atlas-version.js')
version = replace_once(version, "var VERSION = '2.34.0';", "var VERSION = '2.34.1';", 'VERSION')
version = replace_once(version, "var CACHE_REVISION = 'assets-2.34.0';", "var CACHE_REVISION = 'assets-2.34.1';", 'CACHE_REVISION')
write('assets/app/mode-atlas-version.js', version)

for rel in ('package.json', 'package-lock.json'):
    data = json.loads(read(rel))
    data['version'] = '2.34.1'
    if rel == 'package-lock.json':
        data.setdefault('packages', {}).setdefault('', {})['version'] = '2.34.1'
    write(rel, json.dumps(data, indent=2) + '\n')

write('README.md', replace_once(read('README.md'), 'Version: 2.34.0', 'Version: 2.34.1', 'README version'))

changelog = read('CHANGELOG.md')
entry = '''## 2.34.1 - 2026-08-16
- Replaced the in-flow Kana Trainer secondary navigation row with a compact floating flyout so the shared header stays single-height on desktop.
- Kana Trainer now opens its Overview, Reading, Writing, and Results destinations on hover/focus with pointer devices and on tap/click for touch devices.
- Added one shared navigation interaction owner with outside-click and Escape dismissal plus synchronized `aria-expanded` state.
- Preserved the 2.34.0 product hierarchy and current-page semantics without changing trainer, results, storage, sync, or scoring behaviour.

'''
if not changelog.startswith('## 2.34.1'):
    changelog = entry + changelog
write('CHANGELOG.md', changelog)

tests = read('tests/frontend.test.js')
old_test = r'''test('2.34 product navigation separates Mode Atlas destinations from Kana sections', () => {
  const frontend = read('frontend_components.py');
  const navCss = read('assets/css/mode-atlas-navigation.css');
  const productPages = ['index.html', 'wordbank/index.html'];
  const kanaPages = ['kana/index.html', 'reading/index.html', 'writing/index.html', 'results/index.html'];

  assert.match(frontend, /PRIMARY_LINKS = \([\s\S]*?'Atlas'[\s\S]*?'Kana Trainer'[\s\S]*?'Word Bank'[\s\S]*?\)/);
  assert.doesNotMatch(frontend.match(/PRIMARY_LINKS = \([\s\S]*?\)\n/)[0], /'Reading'|'Writing'|'Results'/);
  assert.match(frontend, /KANA_LINKS = \([\s\S]*?'Overview'[\s\S]*?'Reading'[\s\S]*?'Writing'[\s\S]*?'Results'/);
  assert.match(navCss, /\.ma-nav__subnav\{/);
  assert.match(navCss, /\.ma-nav__section-link\.is-active\{/);

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
});'''
new_test = r'''test('2.34 product navigation separates Mode Atlas destinations from Kana sections', () => {
  const frontend = read('frontend_components.py');
  const navCss = read('assets/css/mode-atlas-navigation.css');
  const productPages = ['index.html', 'wordbank/index.html'];
  const kanaPages = ['kana/index.html', 'reading/index.html', 'writing/index.html', 'results/index.html'];

  assert.match(frontend, /PRIMARY_LINKS = \([\s\S]*?'Atlas'[\s\S]*?'Kana Trainer'[\s\S]*?'Word Bank'[\s\S]*?\)/);
  assert.doesNotMatch(frontend.match(/PRIMARY_LINKS = \([\s\S]*?\)\n/)[0], /'Reading'|'Writing'|'Results'/);
  assert.match(frontend, /KANA_LINKS = \([\s\S]*?'Overview'[\s\S]*?'Reading'[\s\S]*?'Writing'[\s\S]*?'Results'/);
  assert.match(navCss, /\.ma-nav__flyout\{/);
  assert.match(navCss, /\.ma-nav__section-link\.is-active\{/);
  assert.doesNotMatch(navCss, /\.ma-nav__subnav\{/);

  for (const rel of [...productPages, ...kanaPages]) {
    const html = read(rel);
    assert.equal(count(html, /data-ma-nav-scope="product"/g), 3, `${rel} product navigation count`);
    assert.equal(count(html, /data-ma-nav-scope="kana"/g), 4, `${rel} Kana destination count`);
    assert.equal(count(html, /data-ma-kana-nav(?:\s|>)/g), 1, `${rel} one Kana flyout owner`);
    assert.equal(count(html, /data-ma-kana-menu-trigger/g), 1, `${rel} one Kana flyout trigger`);
    assert.equal(count(html, /aria-current="page"/g), 1, `${rel} one current page`);
  }
  for (const rel of kanaPages) {
    const html = read(rel);
    assert.match(html, /class="[^"]*ma-nav__menu-trigger[^"]*is-active[^"]*"[^>]*data-ma-nav-item="kana"/, `${rel} Kana Trainer product active`);
  }
});

test('2.34.1 Kana navigation flyout stays out of header flow and supports pointer, touch, and keyboard dismissal', () => {
  const navCss = read('assets/css/mode-atlas-navigation.css');
  const navRuntime = read('assets/ui/mode-atlas-navigation-menu.js');
  assert.match(navCss, /\.ma-nav__flyout\{[\s\S]*?position:absolute;/);
  assert.match(navCss, /\.ma-nav__menu:hover \.ma-nav__flyout/);
  assert.doesNotMatch(navCss, /ma-nav--has-subnav/);
  assert.match(navRuntime, /data-ma-kana-menu-trigger/);
  assert.match(navRuntime, /aria-expanded/);
  assert.match(navRuntime, /\(hover:hover\) and \(pointer:fine\)/);
  assert.match(navRuntime, /pointerdown/);
  assert.match(navRuntime, /event\.key !== 'Escape'/);
  for (const rel of APP_PAGES) {
    const html = read(rel);
    assert.match(html, new RegExp(`mode-atlas-navigation-menu\\.${REVISION.replaceAll('.', '\\.')}\\.js`), `${rel} shared Kana menu runtime`);
  }
});'''
if old_test not in tests:
    raise RuntimeError('2.34 navigation regression test block not found')
tests = tests.replace(old_test, new_test, 1)
write('tests/frontend.test.js', tests)
