from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

class AuditParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.main = 0
        self.h1 = 0
        self.lang = ''
        self.viewport = False
        self.buttons_without_type = []
        self.images_without_alt = []
        self.ids = set()
        self.aria_controls = []
        self._line = 0
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        line, _ = self.getpos()
        if tag == 'html': self.lang = attrs.get('lang','')
        if tag == 'meta' and attrs.get('name','').lower() == 'viewport': self.viewport = True
        if tag == 'main': self.main += 1
        if tag == 'h1': self.h1 += 1
        if tag == 'button' and 'type' not in attrs: self.buttons_without_type.append(line)
        if tag == 'img' and 'alt' not in attrs: self.images_without_alt.append(line)
        if 'id' in attrs: self.ids.add(attrs['id'])
        if 'aria-controls' in attrs: self.aria_controls.append((line, attrs['aria-controls']))

print('=== HTML accessibility inventory ===')
for path in sorted(ROOT.rglob('*.html')):
    if any(part in {'.git','node_modules'} for part in path.parts):
        continue
    rel = path.relative_to(ROOT)
    parser = AuditParser()
    parser.feed(path.read_text(encoding='utf-8'))
    missing_controls = [(line,target) for line,target in parser.aria_controls if target not in parser.ids and target not in {'profileDrawer','settingsDrawer','maKanaMenu'}]
    issues=[]
    if not parser.lang: issues.append('missing lang')
    if not parser.viewport: issues.append('missing viewport')
    if parser.main != 1: issues.append(f'main={parser.main}')
    if parser.h1 != 1: issues.append(f'h1={parser.h1}')
    if parser.buttons_without_type: issues.append('buttons-no-type=' + ','.join(map(str, parser.buttons_without_type[:8])))
    if parser.images_without_alt: issues.append('img-no-alt=' + ','.join(map(str, parser.images_without_alt[:8])))
    if missing_controls: issues.append('missing-aria-controls=' + ','.join(f'{line}:{target}' for line,target in missing_controls[:8]))
    print(f'{rel}: ' + ('OK' if not issues else ' | '.join(issues)))

print('\n=== CSS responsive-risk inventory ===')
css_paths = sorted((ROOT/'assets'/'css').glob('*.css'))
patterns = {
    'fixed-width': re.compile(r'(?<!max-)width\s*:\s*(\d{3,})px'),
    'min-width': re.compile(r'min-width\s*:\s*(\d{2,})px'),
    'fixed-height': re.compile(r'(?<!max-)height\s*:\s*(\d{3,})px'),
    'nowrap': re.compile(r'white-space\s*:\s*nowrap'),
    'overflow-hidden': re.compile(r'overflow(?:-[xy])?\s*:\s*hidden'),
}
for path in css_paths:
    text=path.read_text(encoding='utf-8')
    hits=[]
    for name,pat in patterns.items():
        count=len(pat.findall(text))
        if count: hits.append(f'{name}={count}')
    if hits:
        print(path.relative_to(ROOT), ' '.join(hits))

print('\n=== Focus / motion ownership ===')
page_shared=(ROOT/'assets/css/mode-atlas-page-shared.css').read_text(encoding='utf-8')
components=(ROOT/'assets/css/mode-atlas-components.css').read_text(encoding='utf-8')
nav=(ROOT/'assets/css/mode-atlas-navigation.css').read_text(encoding='utf-8')
checks={
    'global-focus-visible': 'button:focus-visible,a:focus-visible' in page_shared,
    'global-reduced-motion': '@media (prefers-reduced-motion:reduce)' in page_shared,
    'dialog-reduced-motion': '@media (prefers-reduced-motion:reduce)' in components,
    'nav-reduced-motion': '@media(prefers-reduced-motion:reduce)' in nav,
    'coarse-pointer-touch-rules': '(pointer:coarse)' in nav or '(pointer: coarse)' in nav,
}
for key,value in checks.items(): print(f'{key}: {value}')

print('\n=== Interactive CSS fixed-size details ===')
for name in ['mode-atlas-navigation.css','mode-atlas-profile-settings.css','mode-atlas-components.css','mode-atlas-study-shared.css','mode-atlas-test-page.css','mode-atlas-kana-page.css','mode-atlas-wordbank-page.css','mode-atlas-achievements.css','mode-atlas-home-page.css']:
    path=ROOT/'assets/css'/name
    if not path.exists(): continue
    text=path.read_text(encoding='utf-8')
    for lineno,line in enumerate(text.splitlines(),1):
        if re.search(r'(?:min-)?(?:width|height)\s*:\s*(?:[2-4]\d|\d{3,})px', line) and not line.lstrip().startswith('/*'):
            print(f'{name}:{lineno}: {line.strip()}')
