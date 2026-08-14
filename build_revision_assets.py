from pathlib import Path
import re
import shutil
import json
from datetime import date
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qsl, urlencode
from frontend_components import apply_navigation, apply_trainer_shell, apply_frontend_assets, apply_loading_screen, apply_legacy_redirects

ROOT = Path(__file__).resolve().parent
VERSION_FILE = ROOT / 'assets/app/mode-atlas-version.js'
version_text = VERSION_FILE.read_text(encoding='utf-8')
VERSION = (re.search(r'var\s+VERSION\s*=\s*[\'"]([^\'"]+)[\'"]', version_text) or [None, ''])[1]
REVISION = (re.search(r'var\s+CACHE_REVISION\s*=\s*[\'"]([^\'"]+)[\'"]', version_text) or [None, ''])[1]
if not VERSION or not REVISION:
    raise SystemExit('Could not read VERSION/CACHE_REVISION from assets/app/mode-atlas-version.js')
if REVISION != f'assets-{VERSION}':
    raise SystemExit(f'CACHE_REVISION {REVISION!r} does not match VERSION {VERSION!r}')

# A version change is the release boundary. Stamp its build date once, then keep
# repeated builds of the same release idempotent.
package_path = ROOT / 'package.json'
previous_package_version = ''
if package_path.exists():
    try:
        previous_package_version = str(json.loads(package_path.read_text(encoding='utf-8')).get('version', ''))
    except Exception:
        previous_package_version = ''
if previous_package_version and previous_package_version != VERSION:
    stamped = re.sub(
        r'var\s+BUILD_DATE\s*=\s*[\'"][^\'"]*[\'"]',
        f"var BUILD_DATE = '{date.today().isoformat()}'",
        version_text,
        count=1,
    )
    if stamped != version_text:
        VERSION_FILE.write_text(stamped, encoding='utf-8')
        version_text = stamped

# mode-atlas-version.js is the single release-version source. Keep npm metadata
# and the README version label synchronized automatically.
for metadata_name in ('package.json', 'package-lock.json'):
    metadata_path = ROOT / metadata_name
    if not metadata_path.exists():
        continue
    metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
    metadata['version'] = VERSION
    if metadata_name == 'package-lock.json':
        root_package = (metadata.get('packages') or {}).get('')
        if isinstance(root_package, dict):
            root_package['version'] = VERSION
    metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

readme_path = ROOT / 'README.md'
if readme_path.exists():
    readme = readme_path.read_text(encoding='utf-8')
    updated_readme = re.sub(r'(?m)^Version:\s*.*$', f'Version: {VERSION}', readme, count=1)
    if updated_readme != readme:
        readme_path.write_text(updated_readme, encoding='utf-8')

# Render static shared frontend components before asset fingerprinting.
apply_navigation(ROOT)
apply_trainer_shell(ROOT)
apply_frontend_assets(ROOT)
apply_loading_screen(ROOT)
apply_legacy_redirects(ROOT)

CRITICAL = {
    'mode-atlas-version.js',
    'mode-atlas-legacy-sw-retirement.js',
    'mode-atlas-version-check.js',
    'mode-atlas-head-bootstrap.js',
    'mode-atlas-early-loader.js',
}

FINGERPRINT_RE = re.compile(r'\.(?:assets-\d+\.\d+\.\d+)\.(js|css)$', re.I)
ASSET_ATTR_RE = re.compile(
    r'(?P<prefix>(?:src|href)=["\'])(?P<url>[^"\']+\.(?:js|css)(?:\?[^"\']*)?)(?P<suffix>["\'])(?P<defer>\s+defer)?',
    re.I,
)

def canonical_url(url):
    base = url.split('?', 1)[0]
    return FINGERPRINT_RE.sub(lambda m: '.' + m.group(1), base)

def fingerprint_url(url):
    base = canonical_url(url)
    ext = '.js' if base.lower().endswith('.js') else '.css'
    return base[:-len(ext)] + '.' + REVISION + ext

referenced = set()
for html_path in ROOT.rglob('*.html'):
    text = html_path.read_text(encoding='utf-8')

    def replace(match):
        url = match.group('url')
        if url.startswith(('http://', 'https://', '//', 'data:', '#')):
            return match.group(0)

        canonical = canonical_url(url)
        fingerprinted = fingerprint_url(canonical)
        referenced.add((html_path, canonical, fingerprinted))
        attr = match.group('prefix') + fingerprinted + match.group('suffix')

        if match.group('prefix').lower().startswith('src=') and canonical.lower().endswith('.js'):
            if Path(canonical).name not in CRITICAL:
                attr += ' defer'
        return attr

    html_path.write_text(ASSET_ATTR_RE.sub(replace, text), encoding='utf-8')


# Normal document navigation uses canonical public URLs. Build/reload query
# parameters are reserved for explicit update reloads only. Strip any transport
# parameters left by an older generated build while preserving legitimate page
# query parameters such as ?starter=advanced or ?focusWeak=1.
APP_PAGE_PATHS = {
    '/', '/kana/', '/reading/', '/writing/', '/results/', '/wordbank/',
    '/privacy/', '/terms/', '/index.html', '/kana.html', '/default.html',
    '/reverse.html', '/test.html', '/wordbank.html'
}
HREF_RE = re.compile(r'(?P<open><a\b[^>]*?\bhref=["\'])(?P<url>[^"\']+)(?P<suffix>["\'])', re.I)
TRANSPORT_PARAMS = {'build', 'v', 'reload', 'swretired'}

def page_public_url(html_path):
    rel = html_path.relative_to(ROOT).as_posix()
    if rel == 'index.html':
        return 'https://mode-atlas.app/'
    if rel.endswith('/index.html'):
        return 'https://mode-atlas.app/' + rel[:-len('index.html')]
    return 'https://mode-atlas.app/' + rel

def clean_page_href(html_path, url):
    if not url or url.startswith(('#', 'mailto:', 'tel:', 'javascript:', 'data:')):
        return url
    absolute = urljoin(page_public_url(html_path), url)
    parts = urlsplit(absolute)
    if parts.scheme not in {'http', 'https'} or parts.netloc not in {'mode-atlas.app', 'www.mode-atlas.app'}:
        return url
    path = parts.path or '/'
    if path not in APP_PAGE_PATHS:
        return url
    query = [(key, value) for key, value in parse_qsl(parts.query, keep_blank_values=True) if key not in TRANSPORT_PARAMS]
    return urlunsplit(('', '', path, urlencode(query), parts.fragment))

for html_path in ROOT.rglob('*.html'):
    text = html_path.read_text(encoding='utf-8')
    def replace_href(match):
        cleaned = clean_page_href(html_path, match.group('url'))
        return match.group('open') + cleaned + match.group('suffix')
    text = HREF_RE.sub(replace_href, text)

    html_path.write_text(text, encoding='utf-8')

# Remove obsolete generated fingerprints; canonical source files are never deleted.
for path in list(ROOT.rglob('*')):
    if path.is_file() and FINGERPRINT_RE.search(path.name) and ('.' + REVISION + '.') not in path.name:
        path.unlink()

for html_path, canonical, fingerprinted in referenced:
    src = (html_path.parent / canonical).resolve()
    dst = (html_path.parent / fingerprinted).resolve()
    try:
        src.relative_to(ROOT)
        dst.relative_to(ROOT)
    except ValueError:
        raise SystemExit(f'Asset path escapes project root: {html_path} -> {canonical}')
    if not src.exists():
        raise SystemExit(f'Missing canonical asset: {html_path.relative_to(ROOT)} -> {canonical}')
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

print(f'Built revisioned JS/CSS assets for {REVISION}.')
