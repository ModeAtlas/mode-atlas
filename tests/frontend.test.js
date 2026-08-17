const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const VERSION_SOURCE = fs.readFileSync(path.join(ROOT, 'assets/app/mode-atlas-version.js'), 'utf8');
const REVISION = (VERSION_SOURCE.match(/var\s+CACHE_REVISION\s*=\s*['"]([^'"]+)['"]/) || [])[1];

const APP_PAGES = [
  'index.html',
  'kana/index.html',
  'reading/index.html',
  'writing/index.html',
  'results/index.html',
  'wordbank/index.html',
];
const LEGAL_PAGES = ['privacy/index.html', 'terms/index.html'];
const ALL_NAV_PAGES = [...APP_PAGES, ...LEGAL_PAGES];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function count(source, pattern) {
  return (source.match(pattern) || []).length;
}

test('shared navigation is generated consistently across all public pages', () => {
  for (const rel of ALL_NAV_PAGES) {
    const html = read(rel);
    assert.equal(count(html, /<!-- MODE_ATLAS_NAV_START -->/g), 1, `${rel} nav start marker`);
    assert.equal(count(html, /<!-- MODE_ATLAS_NAV_END -->/g), 1, `${rel} nav end marker`);
    assert.equal(count(html, /data-ma-navigation="shared"/g), 1, `${rel} shared nav owner`);
    assert.equal(count(html, /aria-current="page"/g), 1, `${rel} should expose one current page`);
    assert.match(html, new RegExp(`mode-atlas-components\\.${REVISION.replaceAll('.', '\\.')}\\.css`), `${rel} component primitives`);
    assert.match(html, new RegExp(`mode-atlas-navigation\\.${REVISION.replaceAll('.', '\\.')}\\.css`), `${rel} shared nav css`);
    assert.doesNotMatch(html, /[?&](?:build|v|reload|swretired)=/i, `${rel} public links must stay canonical`);
    assert.doesNotMatch(html, /class="[^"]*\b(?:topbar|branch-nav|study-nav|profile-trigger|ma-settings-trigger)\b/i, `${rel} legacy nav class`);
  }

  for (const rel of APP_PAGES) {
    const html = read(rel);
    assert.equal(count(html, /data-profile-open/g), 1, `${rel} shared profile action`);
    assert.equal(count(html, /data-settings-open/g), 1, `${rel} shared settings action`);
  }
  for (const rel of LEGAL_PAGES) {
    const html = read(rel);
    assert.equal(count(html, /data-profile-open/g), 0, `${rel} should not expose account actions`);
    assert.equal(count(html, /data-settings-open/g), 0, `${rel} should not expose settings actions`);
  }
});

test('build-time frontend manifest owns page dependencies, loader markup, and legacy redirects', () => {
  const frontend = read('frontend_components.py');
  for (const marker of ['PAGE_ASSETS', 'HEAD_SCRIPTS', 'INTERACTIVE_STYLES', 'apply_frontend_assets', 'render_loading_screen', 'LEGACY_REDIRECTS', 'apply_legacy_redirects']) {
    assert.match(frontend, new RegExp(marker), `frontend build owner missing ${marker}`);
  }

  const regionPairs = [
    ['MODE_ATLAS_HEAD_ASSETS_START', 'MODE_ATLAS_HEAD_ASSETS_END'],
    ['MODE_ATLAS_STYLE_ASSETS_START', 'MODE_ATLAS_STYLE_ASSETS_END'],
    ['MODE_ATLAS_EARLY_ASSETS_START', 'MODE_ATLAS_EARLY_ASSETS_END'],
    ['MODE_ATLAS_BODY_ASSETS_START', 'MODE_ATLAS_BODY_ASSETS_END'],
    ['MODE_ATLAS_LOADER_START', 'MODE_ATLAS_LOADER_END'],
  ];
  for (const rel of ALL_NAV_PAGES) {
    const html = read(rel);
    for (const [start, end] of regionPairs) {
      assert.equal(count(html, new RegExp(`<!-- ${start} -->`, 'g')), 1, `${rel} ${start}`);
      assert.equal(count(html, new RegExp(`<!-- ${end} -->`, 'g')), 1, `${rel} ${end}`);
    }
    assert.equal(count(html, /id="maLoadingScreen"/g), 1, `${rel} one shared loader`);

    const critical = [
      'mode-atlas-version.', 'mode-atlas-legacy-sw-retirement.', 'mode-atlas-version-check.', 'mode-atlas-head-bootstrap.'
    ].map((needle) => html.indexOf(needle));
    assert.ok(critical.every((pos) => pos >= 0), `${rel} critical head scripts`);
    assert.ok(critical.every((pos, i) => i === 0 || critical[i - 1] < pos), `${rel} critical head script order`);
    assert.ok(html.indexOf('mode-atlas-early-loader.') < html.indexOf('id="maLoadingScreen"'), `${rel} early loader script precedes loader markup`);

    let unmanaged = html;
    for (const [start, end] of regionPairs.slice(0, 4)) {
      unmanaged = unmanaged.replace(new RegExp(`<!-- ${start} -->[\\s\\S]*?<!-- ${end} -->`, 'g'), '');
    }
    assert.doesNotMatch(unmanaged, /<script\b[^>]*\bsrc=["'][^"']+\.assets-[^"']+\.js["']/i, `${rel} unmanaged local script dependency`);
    assert.doesNotMatch(unmanaged, /<link\b[^>]*\brel=["']stylesheet["'][^>]*\.assets-[^"']+\.css["']/i, `${rel} unmanaged local stylesheet dependency`);
  }

  const wordbank = read('wordbank/index.html');
  const storagePos = wordbank.indexOf('mode-atlas-storage.assets-');
  const wordbankControllerPos = wordbank.indexOf('mode-atlas-wordbank-page.assets-', storagePos);
  const saveRepairPos = wordbank.indexOf('mode-atlas-save-repair.assets-', wordbankControllerPos);
  const cloudPos = wordbank.indexOf('cloud-sync.assets-', saveRepairPos);
  assert.ok(storagePos >= 0 && storagePos < wordbankControllerPos && wordbankControllerPos < saveRepairPos && saveRepairPos < cloudPos,
    'Word Bank early controller order must remain storage → page → save repair → cloud');

  for (const [rel, target] of Object.entries({
    'kana.html': '/kana/', 'default.html': '/reading/', 'reverse.html': '/writing/', 'test.html': '/results/', 'wordbank.html': '/wordbank/'
  })) {
    const html = read(rel);
    assert.match(html, new RegExp(`url=${target.replaceAll('/', '\\/')}`), `${rel} meta redirect`);
    assert.match(html, new RegExp(`new URL\\('${target.replaceAll('/', '\\/')}'`), `${rel} JS redirect`);
    assert.match(html, /key !== 'build' && key !== 'v' && key !== 'reload'/, `${rel} strips transport parameters`);
  }
});

test('Profile and Settings drawers consume shared component primitives without manufacturing nav controls', () => {
  const binding = read('assets/ui/mode-atlas-profile-drawer-bindings.js');
  const profile = read('assets/ui/mode-atlas-profile-menu.js');
  const settings = read('assets/ui/mode-atlas-settings-menu.js');

  assert.doesNotMatch(binding, /ensureSettingsButtons/);
  assert.match(binding, /\[data-profile-open\]/);
  assert.match(binding, /\[data-settings-open\]/);
  assert.doesNotMatch(profile + settings, /ma-menu-action/);
  assert.match(profile, /ma-button/);
  assert.match(settings, /ma-button/);
  assert.match(settings, /ma-status\s+ma-settings-status/);
  const home = read('assets/pages/mode-atlas-home-page.js');
  assert.equal(fs.existsSync(path.join(ROOT, 'assets/pages/mode-atlas-home-page.js')), true, 'Atlas returning-user UI should have one page controller');
  assert.match(read('index.html'), /mode-atlas-home-page\.assets-[^\"']+\.js/);
  assert.doesNotMatch(home, /ModeAtlasProfile|KanaCloudSync|profileDrawer|settingsDrawer/, 'Atlas page controller must not duplicate profile, settings, or cloud ownership');
});

class ElementMock {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.className = '';
    this.attributes = new Map();
    this.children = [];
    this.textContent = '';
    this.removed = false;
    this.classList = {
      add: (...names) => {
        const set = new Set(this.className.split(/\s+/).filter(Boolean));
        names.forEach((name) => set.add(name));
        this.className = [...set].join(' ');
      },
    };
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  appendChild(child) { this.children.push(child); return child; }
  remove() { this.removed = true; }
}

test('toast aliases normalize to one semantic notification vocabulary', () => {
  const source = read('assets/app/mode-atlas-toast.js');
  let wrap = null;
  const document = {
    body: {
      appendChild(node) {
        if (node.className === 'ma-toast-wrap') wrap = node;
        return node;
      },
    },
    querySelector(selector) {
      return selector === '.ma-toast-wrap' ? wrap : null;
    },
    createElement(tag) { return new ElementMock(tag); },
  };
  const window = { setTimeout() { return 1; } };
  const context = { window, self: window, document, String, Number, Object, console };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'mode-atlas-toast.js' });

  const cases = [
    ['ok', 'success', 'status'],
    ['success', 'success', 'status'],
    ['neutral', 'info', 'status'],
    ['info', 'info', 'status'],
    ['warn', 'warning', 'status'],
    ['warning', 'warning', 'status'],
    ['bad', 'error', 'alert'],
    ['err', 'error', 'alert'],
    ['error', 'error', 'alert'],
  ];
  for (const [input, expected, role] of cases) {
    const node = window.ModeAtlasToast('message', input, 1000);
    assert.match(node.className, new RegExp(`\\bma-toast--${expected}\\b`), input);
    assert.equal(node.getAttribute('role'), role, input);
  }
  assert.equal(wrap.getAttribute('aria-live'), 'polite');
  assert.equal(wrap.getAttribute('aria-relevant'), 'additions');
});

test('legacy navigation styling no longer has a second canonical CSS owner', () => {
  const cssDir = path.join(ROOT, 'assets/css');
  const legacySelector = /(?:^|[,{\s])\.(?:topbar|branch-nav|study-nav|profile-trigger|profile-dot|ma-settings-trigger|branch-link|study-link|nav-link)(?![-_\w])/m;
  const offenders = [];
  for (const name of fs.readdirSync(cssDir).filter((name) => name.endsWith('.css') && !name.includes('.assets-'))) {
    if (name === 'mode-atlas-navigation.css') continue;
    const source = fs.readFileSync(path.join(cssDir, name), 'utf8');
    if (legacySelector.test(source)) offenders.push(name);
  }
  assert.deepEqual(offenders, []);

  assert.equal(fs.existsSync(path.join(ROOT, 'assets/css/mode-atlas-app-polish.css')), false,
    'obsolete app-polish stylesheet should be merged into shared owners');
  const reverse = read('assets/css/mode-atlas-reverse-page.css');
  assert.doesNotMatch(reverse, /--writing-bg\s*:\s*var\(--writing-bg\)/);
  assert.doesNotMatch(reverse, /--writing-border\s*:\s*var\(--writing-border\)/);
});


test('shared shell regression guards keep nav spacing, sound controls, and trainer nav handle owned correctly', () => {
  const navCss = read('assets/css/mode-atlas-navigation.css');
  const sounds = read('assets/app/mode-atlas-sounds.js');
  const kanaCss = read('assets/css/mode-atlas-kana-page.css');
  const resultsCss = read('assets/css/mode-atlas-test-page.css');
  const studyCss = read('assets/css/mode-atlas-study-shared.css');
  const wordbankCss = read('assets/css/mode-atlas-wordbank-page.css');

  assert.match(kanaCss, /padding:\s*0 24px 24px;/, 'Kana top frame padding must not stack above shared nav');
  assert.match(resultsCss, /padding:\s*0 22px 22px;/, 'Results top frame padding must not stack above shared nav');
  assert.match(studyCss, /body\.ma-reading-page,[\s\S]*?body\.ma-writing-page\{[\s\S]*?padding:0 24px 24px;/,
    'Reading/Writing top frame padding must be owned by the shared trainer stylesheet');
  assert.match(read('wordbank/index.html'), /class="wrap ma-page-frame"/, 'Word Bank must use the shared page frame');
  assert.match(wordbankCss, /\.ma-wordbank-page \.wrap\s*\{[\s\S]*?margin-bottom:\s*56px;/, 'Word Bank wrapper may own bottom rhythm only');
  assert.doesNotMatch(wordbankCss, /\.ma-wordbank-page \.wrap\s*\{[^}]*margin-top\s*:/, 'Word Bank wrapper must not reintroduce top spacing');

  assert.match(navCss, /\.ma-nav-handle\s*\{[\s\S]*?top:auto;[\s\S]*?bottom:max\(18px,calc\(env\(safe-area-inset-bottom,0px\) \+ 8px\)\);[\s\S]*?z-index:10020;/,
    'Show navigation handle must stay bottom-accessible on phones and above the modifiers layer');

  assert.match(sounds, /function bindSoundControls\(scope\)/, 'sound module must own direct Settings control binding');
  assert.match(sounds, /ModeAtlasVersion \|\| window\.MODE_ATLAS_VERSION/, 'sound diagnostics must use the central app version');
  assert.match(sounds, /boundSoundControls = new WeakSet\(\)/, 'sound control binding must be idempotent');
  assert.match(sounds, /btn\.addEventListener\('click',[\s\S]*?setMode\(btn\.dataset\.maSoundChoice\)/,
    'Settings sound choices must directly call the global sound owner');
  assert.match(sounds, /modeAtlasSettingsMenuReady'[\s\S]*?bindSoundControls/,
    'late-mounted Settings drawers must receive sound bindings');
});


test('sound mode owner persists On/Loud/Off without relying on an out-of-scope storage variable', () => {
  const source = read('assets/app/mode-atlas-sounds.js');
  const values = new Map();
  const storage = {
    get(key) { return values.has(key) ? values.get(key) : null; },
    set(key, value) { values.set(key, String(value)); return true; },
  };
  const events = [];
  const document = {
    readyState: 'complete',
    body: null,
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  const window = {
    ModeAtlasVersion: 'test',
    ModeAtlasStorage: storage,
    ModeAtlas: {},
    addEventListener() {},
    dispatchEvent(event) { events.push(event); return true; },
    location: { href: 'https://mode-atlas.test/', origin: 'https://mode-atlas.test' },
  };
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  class CustomEventMock {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  }
  const context = {
    window, self: window, document, localStorage, CustomEvent: CustomEventMock,
    URL, setTimeout() { return 1; }, clearTimeout() {}, console,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'mode-atlas-sounds.js' });

  values.set('modeAtlasSoundMode', 'loud');
  assert.equal(window.ModeAtlasSounds.getMode(), 'loud');
  assert.equal(values.get('modeAtlasSound'), 'loud', 'legacy sound preference should migrate once to the canonical key');

  assert.equal(window.ModeAtlasSounds.setMode('off'), 'off');
  assert.equal(values.get('modeAtlasSound'), 'off');
  assert.equal(values.get('modeAtlasSoundMode'), 'loud', 'legacy aliases should be read-only after migration');
  assert.equal(window.ModeAtlasSounds.getMode(), 'off');
  assert.equal(events.at(-1).type, 'modeAtlasSoundChanged');
  assert.equal(events.at(-1).detail.mode, 'off');
  assert.doesNotMatch(source, /MutationObserver/, 'sound feedback should not scan the whole document for DOM changes');
  assert.doesNotMatch(source, /ModeAtlasUI/, 'unused legacy sound API alias should remain removed');
  assert.match(source, /safeWrapGlobal\('flashResult'/, 'answer feedback should use the explicit trainer result boundary');
  assert.match(source, /window\.ModeAtlas\.toast = function/, 'notification feedback should use the shared toast boundary');
  assert.match(source, /event\.isComposing \|\| event\.keyCode === 229/);
  assert.match(source, /const textEntry = event\.target\.closest/);
});


test('Reading and Writing use one build-time trainer shell and shared trainer primitives', () => {
  const frontend = read('frontend_components.py');
  const studyCss = read('assets/css/mode-atlas-study-shared.css');
  const components = read('assets/css/mode-atlas-components.css');
  const readingCss = read('assets/css/mode-atlas-default-page.css');
  const writingCss = read('assets/css/mode-atlas-reverse-page.css');

  const commonTrainerIds = [
    'startBtn','sessionActions','skipKanaBtn','pauseSessionBtn','endSessionBtn',
    'scoresHeader','scoresContent','statsHeader','statsContent','heatmap','popup',
    'modifiersTab','modifiersContent','modifierOptions','rowOptions','katakanaRowOptions',
    'trialConfig','trialTarget','trialTime','comboConfig','comboSameRowBtn','comboRandomBtn','gameOver'
  ];
  for (const rel of ['reading/index.html', 'writing/index.html']) {
    const html = read(rel);
    assert.equal(count(html, /MODE_ATLAS_TRAINER_START/g), 1, `${rel} trainer start marker`);
    for (const id of commonTrainerIds) assert.match(html, new RegExp(`id=["']${id}["']`), `${rel} keeps #${id}`);
    assert.equal(count(html, /MODE_ATLAS_TRAINER_END/g), 1, `${rel} trainer end marker`);
    assert.equal(count(html, /data-ma-trainer-shell="shared"/g), 1, `${rel} shared trainer shell`);
    assert.equal(count(html, /data-ma-trainer-scores="shared"/g), 1, `${rel} shared score strip`);
    assert.equal(count(html, /data-ma-trainer-modifiers="shared"/g), 1, `${rel} shared modifier shell`);
    assert.match(html, /class="main ma-card ma-trainer-card"/);
    assert.match(html, /class="[^"]*ma-button[^"]*ma-trainer-button/);
    assert.match(html, /class="ma-input ma-trainer-input/);
  }

  assert.match(read('reading/index.html'), /id="hiragana"/);
  assert.match(read('reading/index.html'), /id="input"/);
  for (const id of ['prompt','choiceGrid','buttonsModeBtn','keyboardModeBtn','choice4Btn','choice6Btn','choice8Btn']) {
    assert.match(read('writing/index.html'), new RegExp(`id=["']${id}["']`), `Writing keeps #${id}`);
  }

  assert.match(frontend, /TRAINER_CONFIGS/);
  assert.match(frontend, /render_trainer_shell/);
  assert.match(frontend, /apply_trainer_shell/);
  assert.match(components, /\.ma-button--accent\{/);
  assert.match(studyCss, /Shared trainer visual ownership/);

  assert.doesNotMatch(readingCss, /\.main\s*\{|\.btn\s*\{|\.side-panel\s*\{|\.score-block\s*\{|\.toggle-btn\s*\{/,
    'Reading page CSS must only own reading-specific tokens');
  assert.doesNotMatch(writingCss, /(?:^|\n)\.main\s*\{|(?:^|\n)\.side-panel\s*\{|(?:^|\n)\.score-block\s*\{/,
    'Writing page CSS must not duplicate shared trainer shell styling');
});

test('feedback system owns dialogs, inline status, and destructive confirmations', () => {
  const feedback = read('assets/app/mode-atlas-feedback.js');
  const dialog = read('assets/app/mode-atlas-dialog.js');
  const importExport = read('assets/app/mode-atlas-import-export.js');
  const wordbank = read('assets/pages/mode-atlas-wordbank-page.js');
  const settings = read('assets/ui/mode-atlas-settings-menu.js');

  for (const rel of APP_PAGES) {
    const html = read(rel);
    assert.match(html, new RegExp(`mode-atlas-dialog\\.${REVISION.replaceAll('.', '\\.')}\\.js`), `${rel} shared dialog owner`);
    assert.match(html, new RegExp(`mode-atlas-feedback\\.${REVISION.replaceAll('.', '\\.')}\\.js`), `${rel} shared feedback owner`);
  }

  assert.match(dialog, /root\.ModeAtlasDialog = Object\.freeze/);
  assert.match(dialog, /aria-modal/);
  assert.match(dialog, /event\.key === 'Escape'/);
  assert.match(dialog, /event\.key !== 'Tab'/);
  assert.match(feedback, /root\.ModeAtlasFeedback = Object\.freeze/);
  assert.match(feedback, /function status\(target, message/);
  assert.match(settings, /data-ma-save-status/);
  assert.match(importExport, /ModeAtlasFeedback\?\.confirm/);
  assert.match(importExport, /title: 'Reset all Mode Atlas data\?'/);
  assert.match(wordbank, /title: `Delete \$\{entry\.kana\}\?`/);
  assert.match(wordbank, /title: 'Clear the entire Word Bank\?'/);
});

test('runtime feedback no longer uses native alert/confirm or duplicate trainer save UI', () => {
  const runtimeRoots = [path.join(ROOT, 'assets'), path.join(ROOT, 'cloud-sync.js')];
  const offenders = [];
  const nativePattern = /(?:^|[^\w.])(?:window\.)?(?:alert|confirm)\s*\(/m;

  function scan(file) {
    if (!file.endsWith('.js') || file.includes('.assets-')) return;
    const rel = path.relative(ROOT, file).replaceAll('\\', '/');
    if (rel === 'assets/app/mode-atlas-dialog.js' || rel === 'assets/app/mode-atlas-feedback.js') return;
    const src = fs.readFileSync(file, 'utf8');
    if (nativePattern.test(src)) offenders.push(rel);
  }

  for (const root of runtimeRoots) {
    const stat = fs.statSync(root);
    if (stat.isFile()) { scan(root); continue; }
    const stack = [root];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else scan(full);
      }
    }
  }
  assert.deepEqual(offenders, []);

  for (const rel of ['reading/index.html', 'writing/index.html']) {
    const html = read(rel);
    assert.doesNotMatch(html, /importModalBackdrop|importTextarea|confirmImportBtn|closeImportModalBtn/);
  }
  const reading = read('assets/pages/mode-atlas-default-page.js');
  const writing = read('assets/pages/mode-atlas-reverse-page.js');
  const modifier = read('assets/trainer/mode-atlas-modifier-menu.js');
  assert.doesNotMatch(reading + writing + modifier, /importModalBackdrop|confirmImportBtn|openImportModal|installImportPreview/);
  assert.doesNotMatch(read('assets/achievements/mode-atlas-achievements-ui.js'), /createElement\('div'\).*ma-toast-wrap/s);
});

test('Word Bank uses shared buttons and inline-status primitive', () => {
  const html = read('wordbank/index.html');
  const js = read('assets/pages/mode-atlas-wordbank-page.js');
  const css = read('assets/css/mode-atlas-wordbank-page.css');
  assert.match(html, /<div[^>]*id="wordBankAddGroup"/);
  assert.match(html, /<button[^>]*id="addWordBtn"[^>]*type="button"[^>]*disabled/);
  assert.match(html, /<button[^>]*class="[^"]*ma-button[^"]*"[^>]*id="addWordBtn"/);
  assert.match(html, /<button[^>]*class="[^"]*ma-button--danger[^"]*"[^>]*id="clearAllBtn"/);
  assert.match(html, /<div[^>]*class="ma-status"[^>]*id="statusMsg"/);
  assert.match(js, /ModeAtlasFeedback\?\.status/);
  assert.match(js, /elements\.addWordBtn\.addEventListener\('click', addWord\)/);
  assert.match(js, /elements\.kanaInput\.addEventListener\('keydown'/);
  assert.match(js, /event\.isComposing/);
  assert.doesNotMatch(css, /\.btn-(?:primary|secondary|blue|danger|amber)\b/);
  assert.doesNotMatch(css, /\.status\.(?:ok|warn|err)\b/);
});

class WordBankElementMock {
  constructor(tagName = 'div', id = '') {
    this.tagName = String(tagName).toUpperCase();
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.className = '';
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.style = {};
    this.open = false;
    this.hidden = false;
    this.files = [];
    this.classList = { add() {}, remove() {} };
  }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  dispatch(type, init = {}) {
    const event = { target: this, currentTarget: this, preventDefault() {}, ...init };
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
  click() { this.dispatch('click'); }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); return node; }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return this; }
  focus() {}
  scrollIntoView() {}
  remove() {}
}

function runWordBankAddHarness({ saveSucceeds = true } = {}) {
  const source = read('assets/pages/mode-atlas-wordbank-page.js');
  const ids = [
    'wordBankAddForm', 'kanaInput', 'addWordBtn', 'clearInputBtn', 'statusMsg', 'entries',
    'searchInput', 'sortSelect', 'filterSelect', 'exportBtn', 'importFile',
    'clearAllBtn', 'statTotal', 'statEnglish', 'statFavorites', 'statMissing',
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new WordBankElementMock('div', id)]));
  elements.searchInput.value = '';
  elements.sortSelect.value = 'newest';
  elements.filterSelect.value = 'all';

  const values = new Map();
  const order = [];
  const storage = {
    json(key, fallback) {
      if (!values.has(key)) return fallback;
      try { return JSON.parse(values.get(key)); } catch { return fallback; }
    },
    setJSON(key, value) {
      order.push('setJSON');
      if (!saveSucceeds) return false;
      values.set(key, JSON.stringify(value));
      return true;
    },
    now(key) { values.set(key, String(Date.now())); return values.get(key); },
  };
  const window = {
    listeners: new Map(),
    addEventListener(type, listener) {
      const list = this.listeners.get(type) || [];
      list.push(listener);
      this.listeners.set(type, list);
    },
    dispatchEvent(event) {
      for (const listener of this.listeners.get(event.type) || []) listener.call(this, event);
      return true;
    },
  };
  window.ModeAtlasStorage = storage;
  window.ModeAtlasProfile = { refresh() {} };
  window.ModeAtlasFeedback = {
    status(el, message, tone) { el.textContent = String(message); el.dataset.tone = tone; return true; },
    clearStatus(el) { el.textContent = ''; return true; },
    confirm: async () => true,
  };
  window.KanaCloudSync = {
    markSectionUpdated(section) { order.push(`mark:${section}`); },
    scheduleSync() { order.push('scheduleSync'); return true; },
    ready: Promise.resolve(true),
  };
  const document = {
    getElementById(id) { return elements[id] || null; },
    createElement(tag) { return new WordBankElementMock(tag); },
    createElementNS(_namespace, tag) { return new WordBankElementMock(tag); },
    createDocumentFragment() { return new WordBankElementMock('fragment'); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    body: new WordBankElementMock('body'),
  };
  const localStorage = {
    getItem(key) { return values.get(String(key)) ?? null; },
    setItem(key, value) { values.set(String(key), String(value)); },
  };
  const context = {
    window, self: window, document, localStorage,
    Date, Math, JSON, Object, Array, Set, Number, String, Promise, console,
    Blob: class {},
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    FileReader: class {},
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'mode-atlas-wordbank-page.js' });
  return { window, elements, values, order };
}

test('Word Bank Add writes local data before cloud stamping and only reports success after persistence', () => {
  const success = runWordBankAddHarness();
  success.elements.kanaInput.value = 'ねこ';
  success.elements.addWordBtn.dispatch('click');
  const stored = JSON.parse(success.values.get('kanaWordBank'));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].kana, 'ねこ');
  assert.equal(stored[0].romaji, 'neko');
  assert.deepEqual(success.order.slice(0, 3), ['setJSON', 'mark:wordBank', 'scheduleSync']);
  assert.match(success.elements.statusMsg.textContent, /Added ねこ/);
  assert.equal(success.elements.kanaInput.value, '');

  const failure = runWordBankAddHarness({ saveSucceeds: false });
  failure.elements.kanaInput.value = 'ねこ';
  failure.elements.addWordBtn.dispatch('click');
  assert.equal(failure.values.has('kanaWordBank'), false);
  assert.deepEqual(failure.order, ['setJSON']);
  assert.match(failure.elements.statusMsg.textContent, /Could not save this word/);
  assert.equal(failure.elements.kanaInput.value, 'ねこ', 'failed persistence must leave the user input intact');
});


test('Word Bank Add has no native navigation path and binds before cloud/profile scripts', () => {
  const html = read('wordbank/index.html');
  const js = read('assets/pages/mode-atlas-wordbank-page.js');
  assert.match(html, /<div[^>]*id="wordBankAddGroup"/);
  assert.doesNotMatch(html, /<form[^>]*id="wordBankAdd/);
  assert.match(html, /id="addWordBtn" type="button" disabled/);
  assert.match(js, /elements\.addWordBtn\.addEventListener\('click', addWord\)/);
  assert.match(js, /event\.isComposing/);
  assert.match(js, /event\.keyCode === 229/);
  const storageIndex = html.indexOf('mode-atlas-storage.assets-');
  const wordBankIndex = html.indexOf('<script src="../assets/pages/mode-atlas-wordbank-page.assets-');
  const cloudIndex = html.indexOf('cloud-sync.assets-');
  assert.ok(storageIndex >= 0 && wordBankIndex > storageIndex, 'Word Bank controller should load after storage');
  assert.ok(cloudIndex < 0 || wordBankIndex < cloudIndex, 'Word Bank controller should bind before cloud startup');
});

test('shared drawer, card, and form primitives replace page-local surface ownership', () => {
  const components = read('assets/css/mode-atlas-components.css');
  const profile = read('assets/ui/mode-atlas-profile-menu.js');
  const settings = read('assets/ui/mode-atlas-settings-menu.js');
  const drawerCss = read('assets/css/mode-atlas-profile-settings.css');
  const wordbankHtml = read('wordbank/index.html');
  const wordbankJs = read('assets/pages/mode-atlas-wordbank-page.js');
  const wordbankCss = read('assets/css/mode-atlas-wordbank-page.css');

  for (const marker of ['.ma-card{', '.ma-field{', '.ma-input,.ma-select,.ma-textarea{', '.ma-check{']) {
    assert.ok(components.includes(marker), `missing 2.31 shared primitive ${marker}`);
  }
  assert.match(profile, /class="ma-drawer ma-shared-profile-drawer"/);
  assert.match(settings, /class="ma-drawer ma-shared-settings-drawer"/);
  assert.match(profile + settings, /ma-card ma-card--soft/);
  assert.match(drawerCss, /\.ma-drawer\{/);
  assert.doesNotMatch(drawerCss, /\.ma-shared-profile-drawer,\.ma-shared-settings-drawer\{/);

  assert.match(wordbankHtml, /class="ma-input" id="kanaInput"/);
  assert.match(wordbankHtml, /class="ma-select" id="sortSelect"/);
  assert.match(wordbankHtml, /class="wordbank-overview"/);
  assert.match(wordbankHtml, /class="wordbank-library ma-page-section"/);
  assert.doesNotMatch(wordbankHtml, /library-panel ma-card|class="stat ma-stat ma-card/);
  assert.match(wordbankJs, /field-small ma-field/);
  assert.match(wordbankJs, /input\.className = "ma-input"/);
  assert.match(wordbankJs, /notes\.className = "ma-textarea"/);
  assert.match(wordbankJs, /createEl\("details", "wordbank-entry"\)/);
  assert.doesNotMatch(wordbankJs, /card ma-card ma-card--soft/);
  assert.doesNotMatch(wordbankCss, /input\[type="text"\]\s*,\s*textarea\s*,\s*select/);
  assert.doesNotMatch(wordbankCss, /\.field-small label\s*\{/);
});

test('feature dialogs use the shared dialog mechanics and Kana no longer owns a modal shell', () => {
  const dialog = read('assets/app/mode-atlas-dialog.js');
  const components = read('assets/css/mode-atlas-components.css');
  const kana = read('assets/pages/mode-atlas-kana-page.js');
  const kanaCss = read('assets/css/mode-atlas-kana-page.css');

  assert.match(dialog, /feature\(input\)\{ return enqueue\(input, 'feature'\); \}/);
  assert.match(dialog, /opts\.kind === 'feature'/);
  assert.match(dialog, /opts\.hideActions/);
  assert.match(dialog, /opts\.size === 'large'/);
  assert.match(components, /\.ma-dialog--large\{width:min\(980px,100%\);\}/);
  assert.match(kana, /ModeAtlasDialog\.feature\(/);
  assert.match(kana, /size: 'large'/);
  assert.doesNotMatch(kana, /kanaHubModal|kana-modal-backdrop|kana-modal-panel|data-ma-kana-modal-close/);
  assert.doesNotMatch(kanaCss, /\.kana-hub-modal|\.kana-modal-backdrop|\.kana-modal-panel|\.kana-modal-close/);
  assert.match(kanaCss, /\.kana-modal-grid/);
});

test('visit flows keep behaviour in JS and presentation in shared CSS', () => {
  const visit = read('assets/app/mode-atlas-visit-flows.js');
  const modals = read('assets/css/mode-atlas-app-modals.css');

  assert.doesNotMatch(visit, /createElement\('style'\)|maVisitStyles|css\.textContent/);
  assert.match(visit, /ma-card ma-visit-card/);
  assert.match(visit, /ma-card ma-card--soft ma-visit-panel/);
  assert.match(visit, /ma-check ma-visit-check/);
  assert.match(visit, /ma-button ma-button--primary ma-visit-btn/);
  assert.match(visit, /ma-status ma-status--error ma-visit-error/);
  assert.match(modals, /Shared visit-flow presentation/);
  assert.match(modals, /\.ma-visit-backdrop/);
  assert.match(modals, /\.ma-visit-presets/);
});


test('major feature popups use one shared dialog shell', () => {
  const reading = read('reading/index.html');
  const writing = read('writing/index.html');
  const results = read('results/index.html');
  const readingPage = read('assets/pages/mode-atlas-default-page.js');
  const writingPage = read('assets/pages/mode-atlas-reverse-page.js');
  const trainerShared = read('assets/trainer/mode-atlas-trainer-shared.js');
  const resultsPage = read('assets/pages/mode-atlas-test-page.js');
  const about = read('assets/app/mode-atlas-about.js');
  const achievements = read('assets/achievements/mode-atlas-achievements-ui.js');
  const achievementCss = read('assets/css/mode-atlas-achievements.css');
  const appModalCss = read('assets/css/mode-atlas-app-modals.css');
  const resultsCss = read('assets/css/mode-atlas-test-page.css');

  assert.doesNotMatch(reading + writing, /sessionModalBackdrop|closeSessionModalBtn/);
  assert.doesNotMatch(readingPage + writingPage, /sessionModalBackdrop|closeSessionModalBtn/);
  assert.match(trainerShared, /ModeAtlasDialog\.feature\(/);
  assert.match(trainerShared, /ma-session-dialog-content/);

  assert.doesNotMatch(results, /kanaModalBackdrop|kanaModalClose/);
  assert.doesNotMatch(resultsPage, /KANA_MODAL_BACKDROP|KANA_MODAL_CLOSE|closeKanaModal/);
  assert.match(resultsPage, /ModeAtlasDialog\.feature\(/);
  assert.doesNotMatch(resultsCss, /\.modal-backdrop|\.modal-close|\.modal-title|\.modal-sub/);

  assert.match(about, /ModeAtlasDialog\.feature\(/);
  assert.doesNotMatch(about, /ma-whats-new-backdrop|ma-about-backdrop|ensureAboutModal|ensureWhatsNewModal/);
  assert.doesNotMatch(appModalCss, /\.ma-whats-new-backdrop|\.ma-about-backdrop|\.ma-about-modal/);

  assert.match(achievements, /ModeAtlasDialog\.feature\(/);
  assert.match(achievements, /data-ma-feature-back/);
  assert.doesNotMatch(achievements, /maFeatureModal|maAchievementInfo|ma-feature-backdrop|ma-ach-info-backdrop/);
  assert.doesNotMatch(achievementCss, /\.ma-feature-modal|\.ma-feature-backdrop|\.ma-feature-panel|\.ma-ach-info-backdrop|\.ma-ach-info-panel/);
});


test('theme preference is applied before paint and survives page-to-page loads before shared storage initializes', () => {
  const bootstrapSource = read('assets/app/mode-atlas-head-bootstrap.js');
  const themeSource = read('assets/app/mode-atlas-theme.js');

  assert.match(bootstrapSource, /function applyEarlyTheme\(\)/);
  assert.match(bootstrapSource, /safeStorageGet\(THEME_KEY\)/);
  assert.match(bootstrapSource, /document\.documentElement\.dataset\.maTheme = effective/);
  assert.match(bootstrapSource, /applyEarlyTheme\(\);[\s\S]*?applyEarlyDisplayMode\(\);/);
  assert.match(themeSource, /localStorage\.getItem\(THEME_KEY\)/,
    'theme controller must fall back to localStorage before ModeAtlasStorage is available');
  assert.match(themeSource, /localStorage\.setItem\(THEME_KEY, pref\)/,
    'theme setter must persist even if shared storage has not initialized yet');

  const values = new Map([['modeAtlasThemePreference', 'light']]);
  const documentElement = { dataset: {}, classList: { toggle() {} }, clientWidth: 1200 };
  const document = {
    documentElement,
    readyState: 'loading',
    head: { appendChild() {} },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return {}; },
    addEventListener() {},
  };
  const window = {
    ModeAtlasVersion: 'test',
    ModeAtlasCacheRevision: 'assets-test',
    innerWidth: 1200,
    matchMedia() { return { matches: false }; },
    addEventListener() {},
    location: { protocol: 'https:', hostname: 'mode-atlas.app', search: '', pathname: '/', origin: 'https://mode-atlas.app' },
  };
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  const navigator = {};
  const location = window.location;
  const context = { window, self: window, document, localStorage, navigator, location, console, Object, String, Number, RegExp };
  vm.createContext(context);
  vm.runInContext(bootstrapSource, context, { filename: 'mode-atlas-head-bootstrap.js' });

  assert.equal(documentElement.dataset.maTheme, 'light');
  assert.equal(documentElement.dataset.maThemePreference, 'light');
});

test('post-consolidation frontend ownership keeps pause, dynamic controls, and public pages clean', () => {
  const sessionControls = read('assets/trainer/mode-atlas-session-controls.js');
  const trainerShared = read('assets/trainer/mode-atlas-trainer-shared.js');
  const modifier = read('assets/trainer/mode-atlas-modifier-menu.js');
  const trainerCss = read('assets/css/mode-atlas-study-shared.css');
  const achievementsCss = read('assets/css/mode-atlas-achievements.css');
  const devConsole = read('assets/app/mode-atlas-dev-console.js');
  const displayMode = read('assets/app/mode-atlas-display-mode.js');
  const appModals = read('assets/css/mode-atlas-app-modals.css');

  assert.match(sessionControls, /document\.querySelector\('\.ma-trainer-card'\)/);
  assert.doesNotMatch(sessionControls, /\.main-card,\.practice-card/);
  assert.match(trainerCss, /\.ma-session-paused \.ma-trainer-card/);
  assert.match(trainerCss, /\.ma-pause-overlay/);
  assert.doesNotMatch(achievementsCss, /ma-pause-overlay|ma-session-paused|session-actions/);

  assert.match(trainerShared, /document\.createElement\("button"\)/);
  assert.match(trainerShared, /toggle-btn ma-button ma-trainer-button/);
  assert.match(modifier, /toggle-btn ma-button ma-trainer-button ma-structured-toggle/);
  assert.match(modifier, /ma-card ma-card--soft ma-no-data-card/);
  assert.match(modifier, /mmLink\('ma-button'/);
  assert.match(devConsole, /ma-button ma-button--small ma-dev-btn/);
  assert.doesNotMatch(devConsole, /ma-ui-btn/);
  assert.doesNotMatch(displayMode, /ma-display-btn/);
  assert.doesNotMatch(appModals, /ma-session-action-grid|ma-import-preview-backdrop|ma-structured-modifiers|ma-achievement-grid/);
  assert.equal(fs.existsSync(path.join(ROOT, 'feature-harness.html')), false);
});

test('trainer consolidation preserves score, heatmap, modifier, nav-clearance, and responsive mechanics', () => {
  const trainerCss = read('assets/css/mode-atlas-study-shared.css');
  const trainerJs = read('assets/trainer/mode-atlas-trainer-shared.js');
  const frontend = read('frontend_components.py');
  const reading = read('reading/index.html');
  const writing = read('writing/index.html');

  assert.match(trainerCss, /\.ma-trainer-shell \.score-row,[\s\S]*?display:flex;/,
    'score/history rows must retain two-column layout');
  assert.match(trainerCss, /\.ma-reading-page \.popup,[\s\S]*?position:fixed;[\s\S]*?display:block;[\s\S]*?z-index:90;/,
    'heatmap popup must retain fixed overlay mechanics');
  assert.match(trainerCss, /\.ma-reading-page \.popup\[hidden\],[\s\S]*?display:none;/,
    'heatmap popup visibility must follow the shared hidden-state contract');
  assert.match(trainerJs, /var\(--ma-trainer-heatmap-neutral\)/);
  assert.match(trainerJs, /var\(--ma-trainer-heatmap-wrong\)/);
  assert.match(trainerJs, /var\(--ma-trainer-heatmap-correct\)/);
  assert.match(trainerJs, /var\(--ma-trainer-heatmap-even\)/);
  for (const token of ['--ma-trainer-heatmap-neutral', '--ma-trainer-heatmap-wrong', '--ma-trainer-heatmap-correct', '--ma-trainer-heatmap-even']) {
    assert.match(trainerCss, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':'));
  }

  assert.match(trainerCss, /\.ma-reading-page \.bottom-shell,[\s\S]*?position:fixed;[\s\S]*?bottom:0;/,
    'modifiers shell must stay fixed to the viewport');
  assert.doesNotMatch(frontend, /bottom-shell ma-surface ma-modifiers-only/,
    'fixed modifiers shell must not consume the rounded card surface primitive');
  assert.doesNotMatch(reading + writing, /bottom-shell ma-surface ma-modifiers-only/);
  for (const html of [reading, writing]) {
    assert.match(html, /id="popup" class="popup" hidden/);
    assert.match(html, /class="trial-config" id="trialConfig" hidden/);
    assert.match(html, /class="trial-config" id="comboConfig" hidden/);
  }
  assert.match(trainerCss, /\.trial-config \{[\s\S]*?display: flex;/);
  assert.match(trainerCss, /\.trial-config\[hidden\] \{ display: none; \}/);

  assert.match(trainerCss, /--ma-trainer-side-top:96px/);
  assert.match(trainerCss, /\.ma-trainer-side-panel\{[\s\S]*?top:var\(--ma-trainer-side-top\)/,
    'desktop side panels must clear the shared navigation');
  assert.match(trainerCss, /body\[data-effective-display-mode="tablet"\] \.ma-trainer-side-panel,[\s\S]*?position:static;/,
    'tablet side panels must return to document flow');
  assert.match(trainerCss, /body\[data-effective-display-mode="phone"\] \.ma-trainer-side-panel,[\s\S]*?position:static;/,
    'phone side panels must return to document flow');
  assert.match(trainerCss, /body\[data-effective-display-mode="phone"\] \.ma-trainer-card\{[\s\S]*?padding:18px 10px 22px;/,
    'idle phone trainer card must retain compact responsive padding');
});

test('Kana, Results, and Word Bank consume shared page UI primitives without re-owning their mechanics', () => {
  const components = read('assets/css/mode-atlas-components.css');
  const kanaHtml = read('kana/index.html');
  const kanaJs = read('assets/pages/mode-atlas-kana-page.js');
  const kanaCss = read('assets/css/mode-atlas-kana-page.css');
  const resultsHtml = read('results/index.html');
  const resultsJs = read('assets/pages/mode-atlas-test-page.js');
  const resultsUi = read('assets/results/mode-atlas-results-ui.js');
  const resultsCss = read('assets/css/mode-atlas-test-page.css');
  const wordbankHtml = read('wordbank/index.html');
  const wordbankJs = read('assets/pages/mode-atlas-wordbank-page.js');
  const wordbankCss = read('assets/css/mode-atlas-wordbank-page.css');

  for (const marker of ['.ma-section-head{', '.ma-action-row{', '.ma-kicker{', '.ma-stat-grid{', '.ma-stat{', '.ma-empty-state{']) {
    assert.ok(components.includes(marker), `missing 2.31 shared primitive ${marker}`);
  }
  assert.match(components, /min-height:var\(--ma-button-min-height,var\(--ma-control-height\)\)/);
  assert.match(components, /border-radius:var\(--ma-button-radius,var\(--ma-radius-control\)\)/);

  assert.match(kanaHtml, /kana-hub-hero ma-page-hero/);
  assert.doesNotMatch(kanaHtml, /kana-hub-hero[^\n]*ma-card/,
    'Kana hero should remain an open orientation section rather than a shared card surface');
  assert.match(kanaHtml, /kana-hero-actions ma-action-row/);
  assert.match(kanaHtml, /kana-head-actions ma-action-row/);
  assert.match(kanaJs, /kana-next-card kana-next-card--recommended primary/);
  assert.match(kanaJs, /kana-stage-card/);
  assert.match(kanaJs, /kana-record-card/);
  assert.doesNotMatch(kanaJs, /kana-next-card[^'"]*ma-card|kana-stage-card[^'"]*ma-card|kana-record-card[^'"]*ma-card/,
    'Kana progress presentation should not recreate the retired nested card wall');
  const kanaActionBlock = kanaCss.match(/\.kana-primary-action,[\s\S]*?\.kana-inline-btn \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(kanaActionBlock, /appearance:\s*none/,
    'Kana action family should let ma-button own native button reset mechanics');
  const kanaHeadBlock = kanaCss.match(/\.kana-section-head\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(kanaHeadBlock, /display:\s*flex/,
    'Kana section headers should let ma-section-head own flex layout');

  assert.match(resultsHtml, /hero glass ma-card/);
  assert.match(resultsHtml, /detail-panel ma-card ma-card--flat/);
  assert.match(resultsHtml, /meta-grid ma-stat-grid/);
  assert.match(resultsJs, /ma-card ma-card--flat ma-card--interactive/);
  assert.match(resultsUi, /row-doughnut-card ma-card ma-card--flat ma-card--interactive/);
  assert.doesNotMatch(resultsJs, /function summaryRow\(|function detailMetric\(/);
  assert.doesNotMatch(resultsCss, /\.summary-row\s*\{/,
    'dead Results summary-row surface owner should remain removed');

  assert.match(wordbankHtml, /class="wordbank-overview"/);
  assert.match(wordbankHtml, /class="wordbank-intro ma-page-hero"/);
  assert.doesNotMatch(wordbankHtml, /wordbank-intro[^\n]*ma-card|class="stat ma-stat ma-card/,
    'Word Bank overview should remain an open collection surface rather than nested cards');
  assert.match(wordbankHtml, /ma-toolbar-shared ma-toolbar-shared--sticky/);
  assert.match(wordbankHtml, /id="wordBankActionsBtn"/);
  assert.doesNotMatch(wordbankHtml, /<details class="wordbank-tools">/);
  assert.match(wordbankJs, /empty ma-empty-state/);
  assert.match(wordbankJs, /createEl\("details", "wordbank-entry"\)/);
  const wordbankEmptyBlock = wordbankCss.match(/\.empty\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(wordbankEmptyBlock, /(^|\n)\s*border\s*:/,
    'Word Bank empty state should configure variables instead of re-owning its border');
  assert.match(wordbankEmptyBlock, /--ma-empty-border:transparent/);
});

test('2.31 visual standardisation keeps shared hierarchy, focus, guidance, and collection contracts', () => {
  const icons = read('assets/mode-atlas-icons.svg');
  const components = read('assets/css/mode-atlas-components.css');
  const profile = read('assets/ui/mode-atlas-profile-menu.js');
  const settings = read('assets/ui/mode-atlas-settings-menu.js');
  const atlas = read('index.html');
  const kana = read('kana/index.html');
  const reading = read('reading/index.html');
  const writing = read('writing/index.html');
  const results = read('results/index.html');
  const resultsJs = read('assets/pages/mode-atlas-test-page.js');
  const wordbank = read('wordbank/index.html');
  const wordbankJs = read('assets/pages/mode-atlas-wordbank-page.js');

  for (const id of ['icon-settings','icon-user','icon-focus','icon-search','icon-star','icon-edit','icon-delete','icon-chart']) {
    assert.match(icons, new RegExp(`id="${id}"`), `missing shared icon ${id}`);
  }
  for (const marker of ['.ma-page-intro{','.ma-setting-row{','.ma-status-chip{','.ma-progress{','.ma-skeleton-block,','.ma-trend{']) {
    assert.ok(components.includes(marker), `missing 2.31 shared primitive ${marker}`);
  }

  assert.doesNotMatch(profile, /Branches|data-ma-nav-item|\/reading\/|\/writing\//, 'Profile must not duplicate navigation');
  assert.match(settings, /Preferences/);
  assert.match(settings, /Data and app/);
  assert.match(settings, /ma-setting-row/);

  assert.match(atlas, /id="homeContinueCard"/);
  assert.match(atlas, /Reading Comprehension/);
  assert.match(kana, /id="kanaContinueAction"/);
  assert.match(kana, /ma-skeleton-block/);

  for (const trainer of [reading, writing]) {
    assert.match(trainer, /Practice setup ▼/);
    assert.match(trainer, /id="sessionProgressBar"/);
    assert.match(trainer, />Focus mode<|Focus mode<\/span>/);
    assert.match(trainer, /Exit focus mode/);
    assert.doesNotMatch(trainer, />Hide nav<|>Show navigation<|>Modifiers ▼</);
  }

  assert.match(results, /id="resultsGuidanceCard"/);
  assert.match(results, /id="resultsTrend"/);
  assert.match(resultsJs, /function renderGuidance\(/);
  assert.match(resultsJs, /function renderTrend\(/);

  const libraryIndex = wordbank.indexOf('class="wordbank-library ma-page-section"');
  const addIndex = wordbank.indexOf('id="wordBankAddPanel"');
  assert.ok(libraryIndex >= 0 && addIndex > libraryIndex, 'Word Bank collection must precede quick capture in document order');
  assert.match(wordbank, /id="wordBankAddJumpBtn"/);
  assert.match(wordbank, /id="wordBankActionsBtn"/);
  assert.doesNotMatch(wordbank, /<details class="wordbank-tools">/);
  assert.match(wordbankJs, /createIcon\(entry\.favorite \? "star-filled" : "star"\)/);
});

test('UI foundation keeps global geometry, responsive layout, themes, and page frames under shared ownership', () => {
  const theme = read('assets/css/mode-atlas-theme.css');
  const pageShared = read('assets/css/mode-atlas-page-shared.css');
  const responsive = read('assets/css/mode-atlas-responsive.css');
  const components = read('assets/css/mode-atlas-components.css');
  const navigation = read('assets/css/mode-atlas-navigation.css');
  const appModals = read('assets/css/mode-atlas-app-modals.css');
  const homeCss = read('assets/css/mode-atlas-home-page.css');
  const resultsCss = read('assets/css/mode-atlas-test-page.css');
  const wordbankCss = read('assets/css/mode-atlas-wordbank-page.css');

  for (const token of [
    '--ma-content-max:', '--ma-content-wide:', '--ma-page-gutter:', '--ma-page-gutter-tablet:',
    '--ma-page-gutter-phone:', '--ma-page-card-padding:', '--ma-radius-xl:', '--ma-kana:', '--ma-words:',
    '--ma-page-bg-atlas:', '--ma-page-bg-kana:', '--ma-page-bg-results:', '--ma-page-bg-words:'
  ]) {
    assert.match(theme, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing canonical UI token ${token}`);
  }

  assert.doesNotMatch(pageShared, /--ma-radius-lg\s*:/,
    'page foundation must not override the global radius scale');
  for (const legacy of ['.nav-shell', '.site-header', '.app-nav', '#profileDot', '#studyTopProfileDot', '#studyProfileBtn']) {
    assert.doesNotMatch(pageShared, new RegExp(legacy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `legacy shared selector returned: ${legacy}`);
  }
  for (const pageInternal of ['.results-layout', '.hero-grid', '.field-grid', '.meta-grid', '.kana-hub', '.word-list']) {
    assert.doesNotMatch(responsive, new RegExp(pageInternal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `responsive layer must not own ${pageInternal}`);
  }

  for (const primitive of ['.ma-page-frame{', '.ma-page-stack{', '.ma-page-section{', '.ma-page-hero{']) {
    assert.match(components, new RegExp(primitive.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing page primitive ${primitive}`);
  }

  const framedPages = [
    ['index.html', 'ma-atlas-page'],
    ['kana/index.html', 'ma-kana-page'],
    ['results/index.html', 'ma-results-page'],
    ['wordbank/index.html', 'ma-wordbank-page'],
  ];
  for (const [rel, bodyClass] of framedPages) {
    const html = read(rel);
    assert.match(html, new RegExp(`<body class="[^"]*\\b${bodyClass}\\b`), `${rel} semantic body class`);
    assert.match(html, /class="[^"]*\bma-page-frame\b/, `${rel} standard page frame`);
  }

  assert.match(theme, /--ma-font-ui:/);
  assert.match(resultsCss, /font-family:\s*var\(--ma-font-ui\)/);
  assert.doesNotMatch(homeCss + resultsCss, /font-family:\s*(?:Arial|Helvetica)/i,
    'page styles must not override the shared UI font stack');

  const structuralCss = pageShared + responsive + components + navigation + appModals + wordbankCss;
  assert.doesNotMatch(structuralCss, /#[0-9a-f]{3,8}\b|rgba?\(/i,
    'shared structural CSS and token-migrated Word Bank styling must consume theme colours');
});

test('full-project audit cleanup keeps one owner for dev visit tools, drawers, save status, and audited legacy paths', () => {
  const visit = read('assets/app/mode-atlas-visit-flows.js');
  const dev = read('assets/app/mode-atlas-dev-console.js');
  const importExport = read('assets/app/mode-atlas-import-export.js');
  const pageState = read('assets/app/mode-atlas-page-state.js');
  const earlyLoader = read('assets/app/mode-atlas-early-loader.js');
  const profile = read('assets/ui/mode-atlas-profile-drawer-bindings.js');
  const achievementsCss = read('assets/css/mode-atlas-achievements.css');
  const themeCss = read('assets/css/mode-atlas-theme.css');
  const pageCss = read('assets/css/mode-atlas-page-shared.css');
  const reading = read('reading/index.html');
  const writing = read('writing/index.html');
  const audit = read('audit_project.py');

  assert.doesNotMatch(visit, /MutationObserver|maDevPanel/);
  for (const marker of ['maDevFirstVisit', 'maDevDailyReturn', 'maDevResetVisit']) assert.match(dev, new RegExp(marker));
  assert.doesNotMatch(importExport, /ModeAtlasImportUi|rebuildSaveSections|addEventListener\('focus'|addEventListener\('pageshow'|visibilitychange/);
  assert.doesNotMatch(pageState, /ModeAtlasPageState\s*=|cleanDecorativeTextIcons|lifecycleListeners = new Map/);
  assert.doesNotMatch(earlyLoader, /ModeAtlasHideLoader|ModeAtlasLoaderState/);
  assert.match(profile, /function trapDrawerFocus/);
  assert.match(profile, /drawerReturnFocus/);
  assert.doesNotMatch(profile, /ModeAtlasKanaProfile|ModeAtlasTestProfile|ModeAtlasWordProfile/);
  assert.doesNotMatch(achievementsCss, /ma-preset-toggle/);
  assert.doesNotMatch(themeCss, /\.ma-drawer-backdrop\s*,\s*\/\*/);
  assert.doesNotMatch(pageCss, /\.ma-dev-panel|\.ma-dev-card|\.ma-dev-title|\.ma-dev-label/);
  assert.match(reading, /aria-label="Type the romaji answer"/);
  assert.match(writing, /aria-label="Type the kana answer"/);
  assert.match(audit, /assets\/pages\/mode-atlas-home-page\.js/);
  assert.doesNotMatch(audit, /sys\.exit\(main\(\)\)[\s\S]*?legacy_home_profile/);
});



test('2.31.2 refinement keeps Word Bank library-first and shared responsive controls owned correctly', () => {
  const components = read('assets/css/mode-atlas-components.css');
  const profileCss = read('assets/css/mode-atlas-profile-settings.css');
  const wordbankHtml = read('wordbank/index.html');
  const wordbankJs = read('assets/pages/mode-atlas-wordbank-page.js');
  const wordbankCss = read('assets/css/mode-atlas-wordbank-page.css');
  const sessionControls = read('assets/trainer/mode-atlas-session-controls.js');
  const studyCss = read('assets/css/mode-atlas-study-shared.css');
  assert.match(components, /\.ma-icon-button\{[\s\S]*appearance:none/);
  assert.match(components, /data-effective-display-mode="tablet"[^\n]*\.ma-setting-row/);
  assert.doesNotMatch(profileCss, /\.ma-setting-row\{grid-template-columns:1fr/);
  assert.match(wordbankHtml, /class="wordbank-add-host"/);
  assert.doesNotMatch(wordbankHtml, /class="panel add-panel/);
  assert.match(wordbankJs, /ModeAtlasDialog\?\.feature/);
  assert.match(wordbankJs, /ModeAtlasDialog\?\.close/);
  assert.doesNotMatch(wordbankHtml, /class="panel add-panel/);
  assert.match(sessionControls, /setPauseButtonState/);
  assert.match(sessionControls, /icon-\$\{isPaused \? 'play' : 'pause'\}/);
  assert.doesNotMatch(studyCss, /inset:auto 18px 18px/);
});


test('2.31.3 simplification keeps Settings concise and one backup owner for Word Bank', () => {
  const settings = read('assets/ui/mode-atlas-settings-menu.js');
  const wordbankHtml = read('wordbank/index.html');
  const wordbankJs = read('assets/pages/mode-atlas-wordbank-page.js');
  const wordbankCss = read('assets/css/mode-atlas-wordbank-page.css');
  assert.doesNotMatch(settings, /Let Mode Atlas adapt automatically|Choose feedback volume|Use the dark or light Atlas palette/);
  assert.match(wordbankHtml, /id="wordBankActionsBtn"/);
  assert.match(wordbankHtml, /id="wordBankActionsPanel"/);
  assert.doesNotMatch(wordbankHtml, /id="exportBtn"|id="importFile"|Collection tools/);
  assert.doesNotMatch(wordbankJs, /function exportBank|function importBank|elements\.exportBtn|elements\.importFile/);
  assert.match(wordbankJs, /openCollectionActionsDialog/);
  assert.doesNotMatch(wordbankCss, /wordbank-tools/);
});


test('2.31.4 profile and settings polish keeps auth and drawer layout state-owned', () => {
  const profile = read('assets/ui/mode-atlas-profile-menu.js');
  const bindings = read('assets/ui/mode-atlas-profile-drawer-bindings.js');
  const cloud = read('cloud-sync.js');
  const css = read('assets/css/mode-atlas-profile-settings.css');
  assert.match(profile, /id="profileAuthBtn"/);
  assert.doesNotMatch(profile, /profileSignInBtn|profileSignOutBtn/);
  assert.match(bindings, /authBtn: document\.getElementById\('profileAuthBtn'\)/);
  assert.match(cloud, /boundAuthButtons/);
  assert.match(cloud, /currentUser\) void signOutUser\(\)/);
  assert.match(css, /--ma-setting-row-columns:minmax\(96px,120px\) minmax\(0,1fr\)/);
  assert.match(css, /\.ma-settings-status:empty\{display:none;\}/);
});


test('2.32 CSS consolidation keeps Settings and Profile ownership canonical', () => {
  const components = read('assets/css/mode-atlas-components.css');
  const profile = read('assets/css/mode-atlas-profile-settings.css');
  const trainer = read('assets/css/mode-atlas-study-shared.css');
  const modifiers = read('assets/css/mode-atlas-modifier-menu.css');
  assert.match(components, /grid-template-columns:var\(--ma-setting-row-columns,/);
  assert.match(components, /justify-self:var\(--ma-setting-control-justify,end\)/);
  assert.match(profile, /--ma-setting-row-columns:minmax\(96px,120px\) minmax\(0,1fr\)/);
  assert.doesNotMatch(profile, /data-profile-sign-in|data-profile-sign-out/);
  assert.doesNotMatch(profile, /\.ma-shared-settings-drawer \.ma-settings-section \.ma-setting-row\{grid-template-columns:/);
  assert.match(modifiers, /bottom-shell\.ma-modifiers-only/);
  assert.ok(!trainer.includes('max-height:min(72vh,720px)'), 'modifier drawer max-height must remain owned by modifier-menu.css');
});



test('2.33 experience restructure keeps Atlas clean and onboarding destination-aware', () => {
  const home = read('index.html');
  const homeJs = read('assets/pages/mode-atlas-home-page.js');
  const visit = read('assets/app/mode-atlas-visit-flows.js');
  const kana = read('kana/index.html');
  assert.match(home, /data-ma-home-visitor/);
  assert.match(home, /data-ma-home-user/);
  assert.match(home, /Start with Kana Trainer/);
  assert.doesNotMatch(home, /homeVisitStreak|homeReadingDaily|homeWritingDaily|Study status/);
  assert.match(homeJs, /dataset\.maHomeState=isUser\?'returning':'visitor'/);
  assert.doesNotMatch(homeJs, /dailyDone\(|homeVisitStreak|homeReadingDaily|homeWritingDaily/);
  assert.match(visit, /BRANCH_PATHS=new Set/);
  assert.match(visit, /waitForInitialHydration/);
  assert.match(visit, /storeSet\(K\.pending,target\)/);
  assert.match(visit, /const next=branchDestination\(storeGet\(K\.pending\)\)\|\|target/);
  assert.match(visit, /storeRemove\(K\.pending\)/);
  assert.match(visit, /navigateApp\(next\)/);
  assert.doesNotMatch(visit, /if\(nd&&storeGet\(K\.first\)!=='true'\)/);
  assert.ok(kana.indexOf('kana-pathways') < kana.indexOf('kana-progress-intro'));
  assert.ok(kana.indexOf('kana-progress-intro') < kana.indexOf('id="kanaTodayCard"'));
});

test('2.33.1 onboarding separates Mode Atlas consent from Kana branch setup', () => {
  const visit = read('assets/app/mode-atlas-visit-flows.js');
  const pwa = read('assets/app/mode-atlas-pwa.js');
  const modalCss = read('assets/css/mode-atlas-app-modals.css');
  const wordbank = read('wordbank/index.html');
  assert.match(visit, /kanaSetup:'modeAtlasKanaSetupComplete'/);
  assert.match(visit, /KANA_SETUP_PATHS=new Set\(\['\/kana\/','\/reading\/','\/writing\/'\]\)/);
  assert.match(visit, /const requireLegal=force\|\|!onboardingComplete\(\)/);
  assert.match(visit, /const requireKana=requiresKanaSetup\(target\)&&\(force\|\|!kanaSetupComplete\(\)\)/);
  assert.match(visit, /if\(requireKana\)\{[\s\S]*ModeAtlasPresets\?\.apply/);
  assert.match(visit, /if\(requireLegal\)markLegalComplete\(\)/);
  assert.doesNotMatch(wordbank, /mode-atlas-presets\.assets-/);
  assert.match(pwa, /ma:visit-flow-opened/);
  assert.match(pwa, /ma:visit-flow-closed/);
  assert.match(modalCss, /\.ma-status\.ma-visit-error\{display:none/);
});

test('2.33.2 Kana setup is destination-owned and persisted as app state', () => {
  const visit = read('assets/app/mode-atlas-visit-flows.js');
  const storage = read('assets/app/mode-atlas-storage.js');
  const wordbank = read('wordbank/index.html');
  const kana = read('kana/index.html');
  assert.match(visit, /legacyKanaSetupAtLoad=storeGet\(K\.first\)==='true'&&/);
  assert.match(visit, /const kanaSetupComplete=\(\)=>storeGet\(K\.kanaSetup\)==='true'/);
  assert.match(visit, /if\(!target\|\|onboardingComplete\(\)\|\|requiresKanaSetup\(target\)\)return/);
  assert.match(visit, /if\(needsSetup\(current\)\)\{visitDecisionMade=true;return first\(current\);\}/);
  assert.match(storage, /'modeAtlasKanaSetupComplete'/);
  assert.match(storage, /'modeAtlasPendingDestination'/);
  assert.doesNotMatch(wordbank, /mode-atlas-presets\.assets-/);
  assert.match(kana, new RegExp(`mode-atlas-presets\\.${REVISION.replaceAll('.', '\\.')}\\.js`));
});

test('2.34 product navigation separates Mode Atlas destinations from Kana sections', () => {
  const frontend = read('frontend_components.py');
  const navCss = read('assets/css/mode-atlas-navigation.css');
  const productPages = ['index.html', 'wordbank/index.html'];
  const kanaPages = ['kana/index.html', 'reading/index.html', 'writing/index.html', 'results/index.html'];

  assert.match(frontend, /PRIMARY_LINKS = \([\s\S]*?'Atlas'[\s\S]*?'Kana Trainer'[\s\S]*?'Word Bank'[\s\S]*?\)/);
  assert.doesNotMatch(frontend.match(/PRIMARY_LINKS = \([\s\S]*?\)\n/)[0], /'Reading'|'Writing'|'Results'/);
  assert.match(frontend, /KANA_LINKS = \([\s\S]*?'Overview'[\s\S]*?'Reading'[\s\S]*?'Writing'[\s\S]*?'Test Results'/);
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
});

test('2.34.2 Kana flyout keeps fast desktop navigation and deliberate touch access', () => {
  const frontend = read('frontend_components.py');
  const navJs = read('assets/ui/mode-atlas-navigation-menu.js');
  const navCss = read('assets/css/mode-atlas-navigation.css');
  assert.match(frontend, /f'<a class="\{classes\}" href="\/kana\/" data-ma-nav-scope="product"/);
  assert.doesNotMatch(frontend, /f'<button class="\{classes\}" type="button" data-ma-nav-scope="product"/);
  assert.match(navJs, /var finePointer = !!\(hoverQuery && hoverQuery\.matches\)/);
  assert.match(navJs, /if \(finePointer\) return/);
  assert.match(navJs, /if \(!isOpen\(\)\) \{\s*event\.preventDefault\(\);\s*setOpen\(true\);/);
  assert.doesNotMatch(navJs, /setOpen\(!isOpen\(\)\)/);
  assert.match(navCss, /\.ma-nav__section-link\{[\s\S]*?justify-content:center;[\s\S]*?text-align:center;/);
});

test('2.35 Atlas homepage stays editorial, product-led, and free of learner stats', () => {
  const home = read('index.html');
  const css = read('assets/css/mode-atlas-home-page.css');
  assert.match(home, /Build Japanese skills that stick\./);
  assert.match(home, /class="atlas-showcase"/);
  assert.match(home, /class="atlas-product atlas-product--kana"/);
  assert.match(home, /class="atlas-product atlas-product--words"/);
  assert.match(home, /id="homeContinueCard"/);
  assert.match(home, /data-ma-home-visitor/);
  assert.match(home, /data-ma-home-user/);
  assert.doesNotMatch(home, /homeVisitStreak|homeReadingDaily|homeWritingDaily|Accuracy|Mastered|Daily Challenge|Study status/);
  assert.doesNotMatch(home, /class="constellation"|class="branch-grid"|class="branch kana"|class="branch words"/);
  assert.match(css, /\.atlas-hero__stage\{/);
  assert.match(css, /\.atlas-preview--reading\{/);
  assert.match(css, /\.atlas-product\{/);
  assert.doesNotMatch(css, /\.constellation\{|\.branch-grid\{|\.branch\.kana/);
});


test('2.36 Kana hub keeps orientation calm and moves detailed progress below practice navigation', () => {
  const kana = read('kana/index.html');
  const kanaJs = read('assets/pages/mode-atlas-kana-page.js');
  const kanaCss = read('assets/css/mode-atlas-kana-page.css');
  const heroEnd = kana.indexOf('</section>', kana.indexOf('class="kana-hub-hero'));
  const hero = kana.slice(kana.indexOf('class="kana-hub-hero'), heroEnd);

  assert.match(kana, /class="kana-hub-hero ma-page-hero"/);
  assert.doesNotMatch(kana, /kana-hub-hero[^\n]*ma-card/);
  assert.match(kana, /class="kana-pathway-list"/);
  assert.equal(count(kana, /class="kana-pathway kana-pathway--/g), 3);
  assert.ok(kana.indexOf('kana-pathways') < kana.indexOf('kana-progress-intro'));
  assert.match(kana, /class="kana-today-card kana-progress-overview"/);
  assert.doesNotMatch(kana, /kana-(?:next|mastery|preset|records)-panel[^\n]*ma-card/);
  assert.doesNotMatch(hero, /accuracy|mastered|streak|daily challenge|total answers/i);

  assert.match(kanaJs, /const summary = kanaEl\('div','kana-progress-summary'\)/);
  assert.match(kanaJs, /recommendedAction\(summaries, mastery\)/);
  assert.match(kanaJs, /kana-next-card kana-next-card--recommended primary/);
  assert.doesNotMatch(kanaJs, /kana-stage-card ma-card|kana-preset-card ma-card|kana-accuracy-card ma-card/);

  assert.match(kanaCss, /\.kana-hub-hero\{[\s\S]*?border-bottom:1px solid var\(--ma-border\)/);
  assert.match(kanaCss, /\.kana-pathway-list\{[\s\S]*?border-block:1px solid var\(--ma-border\)/);
  assert.match(kanaCss, /\.kana-progress-overview\{[\s\S]*?grid-template-columns:/);
  assert.match(kanaCss, /\.kana-mastery-grid\{[\s\S]*?border:1px solid var\(--ma-border\)/);
  assert.match(kanaCss, /\.kana-preset-grid\{[\s\S]*?border:1px solid var\(--ma-border\)/);
});

test('2.36.1 Kana keeps first-use orientation but compacts established learner hierarchy', () => {
  const kanaHtml = read('kana/index.html');
  const kanaJs = read('assets/pages/mode-atlas-kana-page.js');
  const kanaCss = read('assets/css/mode-atlas-kana-page.css');

  assert.match(kanaHtml, /id="kanaHeroTitle">Make kana feel automatic\.<\/h1>/,
    'zero-history learners should retain the full Kana introduction');
  assert.match(kanaJs, /function hasKanaHistory\(summaries\)/);
  assert.match(kanaJs, /attempts > 0 \|\| dailyHistory > 0 \|\| formalTestCount\(\) > 0/,
    'returning state should derive from real saved Kana history rather than a second preference flag');
  assert.match(kanaJs, /classList\.toggle\('ma-kana-returning', returning\)/);
  assert.match(kanaJs, /heroTitle\.textContent = returning \? 'Your kana' : 'Make kana feel automatic\.'/);
  assert.match(kanaJs, /Current focus: \$\{compactKanaList\(mastery\.weak, 4\)\}/,
    'returning header should surface a learner-specific focus when weak kana exist');
  assert.match(kanaJs, /progressTitle\.textContent = returning \? 'Progress overview'/);

  assert.match(kanaCss, /\.ma-kana-page\.ma-kana-returning \.kana-hub-hero\{[\s\S]*?padding:30px 0 26px;/,
    'returning Kana hero should be materially shorter than the first-use hero');
  assert.match(kanaCss, /\.ma-kana-page\.ma-kana-returning \.kana-hero-visual\{display:none;\}/);
  assert.match(kanaCss, /\.ma-kana-page\.ma-kana-returning \.kana-pathways-head\{display:none;\}/,
    'repeat visitors should not repeatedly receive the practice-area explainer');
  assert.match(kanaCss, /\.ma-kana-page\.ma-kana-returning \.kana-pathway>p\{display:none;\}/,
    'returning practice shortcuts should be compact rather than explanatory cards');
});

test('2.37 Word Bank is collection-first, state-aware, and keeps editing progressive', () => {
  const html = read('wordbank/index.html');
  const js = read('assets/pages/mode-atlas-wordbank-page.js');
  const css = read('assets/css/mode-atlas-wordbank-page.css');

  assert.match(html, /class="wordbank-intro ma-page-hero"/);
  assert.doesNotMatch(html, /class="hero ma-card ma-page-hero/);
  assert.match(html, /class="wordbank-overview"/);
  assert.match(html, /class="wordbank-library ma-page-section"/);
  assert.doesNotMatch(html, /library-panel ma-card/);
  assert.match(js, /function updateExperienceState/);
  assert.match(js, /ma-wordbank-populated/);
  assert.match(js, /No words match this view\./);
  assert.match(js, /Start your Word Bank\./);
  assert.match(js, /Clear search and filters/);
  assert.match(js, /createEl\("details", "wordbank-entry"\)/);
  assert.doesNotMatch(js, /createEl\("details", "card ma-card ma-card--soft"\)/);
  assert.match(css, /\.wordbank-entry\{/);
  assert.match(css, /\.ma-wordbank-page\.ma-wordbank-populated \.wordbank-intro/);
});

test('2.38 trainer sessions use one active-state owner and a focused shared stage', () => {
  const frontend = read('frontend_components.py');
  const shared = read('assets/trainer/mode-atlas-trainer-shared.js');
  const css = read('assets/css/mode-atlas-study-shared.css');
  const reading = read('reading/index.html');
  const writing = read('writing/index.html');

  for (const marker of ['ma-trainer-header', 'ma-trainer-stage', 'ma-trainer-session-controls']) {
    assert.match(frontend, new RegExp(marker), `shared trainer shell missing ${marker}`);
    assert.match(reading, new RegExp(marker), `Reading generated shell missing ${marker}`);
    assert.match(writing, new RegExp(marker), `Writing generated shell missing ${marker}`);
  }
  assert.match(shared, /document\.body\.classList\.toggle\("trainer-session-active", !!visible\)/,
    'shared UI visibility helper must own trainer active state');
  assert.doesNotMatch(css, /:has\(#startWrap\[hidden\]\)/,
    'trainer CSS must not infer session state from the Start wrapper');
  assert.match(css, /body\.trainer-session-active \.ma-trainer-card/);
  assert.match(css, /body\.trainer-session-active \.bottom-shell\.ma-modifiers-only/);
  assert.match(css, /body\.trainer-session-active \.ma-trainer-side-panel/);
  assert.match(css, /data-effective-display-mode="tablet"\]\.trainer-session-active \.ma-trainer-side-panel/);
  assert.match(css, /body\.trainer-session-active\.ma-reading-page \.hiragana/);
  assert.match(css, /body\.trainer-session-active\.ma-writing-page \.prompt/);
});

test('2.39 Reading and Writing share controller lifecycle while answer adapters stay mode-specific', () => {
  const frontend = read('frontend_components.py');
  const controller = read('assets/trainer/mode-atlas-trainer-controller.js');
  const reading = read('assets/pages/mode-atlas-default-page.js');
  const writing = read('assets/pages/mode-atlas-reverse-page.js');
  const readingHtml = read('reading/index.html');
  const writingHtml = read('writing/index.html');

  assert.equal(count(frontend, /'assets\/trainer\/mode-atlas-trainer-controller\.js'/g), 2,
    'shared trainer controller must be in both trainer manifests');
  for (const html of [readingHtml, writingHtml]) {
    const sharedIndex = html.indexOf(`mode-atlas-trainer-controller.${REVISION}.js`);
    const pageIndex = Math.max(html.indexOf(`mode-atlas-default-page.${REVISION}.js`), html.indexOf(`mode-atlas-reverse-page.${REVISION}.js`));
    assert.ok(sharedIndex >= 0 && pageIndex > sharedIndex, 'controller must load before the mode adapter');
  }

  for (const source of [reading, writing]) {
    assert.match(source, /ModeAtlasTrainerController\.create\(/);
    assert.doesNotMatch(source, /function debugEl\(|function debugLine\(|function debugValueLine\(|function debugRow\(|function debugCard\(/,
      'debug element primitives must not remain duplicated in page adapters');
    assert.doesNotMatch(source, /modeAtlasCloudDataChanged|trainerRefreshQueued/,
      'page adapters must not own refresh scheduling/listeners');
    assert.doesNotMatch(source, /accuracy \* 250|speedRunTop3\.sort|timeTrialTop3\.sort/,
      'score ranking formulas must be controller-owned');
  }

  for (const marker of [
    'modeAtlasCloudDataChanged', 'refreshCommonUi', 'updateBestScores', 'updateSrsCorrect',
    'normalizeStoredTestModeResults', 'persistStoredTestModeResults', 'debugEl'
  ]) assert.match(controller, new RegExp(marker), `shared controller missing ${marker}`);

  assert.match(reading, /dailySeedPrefix: "daily"/);
  assert.match(writing, /dailySeedPrefix: "reverse-daily"/);
  assert.match(reading, /showOfficialWhenRecorded: false/);
  assert.match(writing, /showOfficialWhenRecorded: true/);
  assert.match(reading, /clearLastWrongOnCorrect: false/);
  assert.match(writing, /clearLastWrongOnCorrect: true/);

  assert.match(reading, /validRomajiSet/);
  assert.match(reading, /expected\.startsWith\(compactValue\)/);
  for (const writingOnly of ['buildChoiceOptionStrings', 'getRepeatSafePool', 'isRomajiKeyboardMode', 'getAcceptedAnswersForCurrentChar']) {
    assert.match(writing, new RegExp(writingOnly), `Writing adapter must retain ${writingOnly}`);
    assert.doesNotMatch(reading, new RegExp(writingOnly), `Reading adapter must not absorb ${writingOnly}`);
  }
});

test('2.40 Results is a formal Test Mode report and preserves comprehensive assessment visuals', () => {
  const html = read('results/index.html');
  const page = read('assets/pages/mode-atlas-test-page.js');
  const engine = read('assets/results/mode-atlas-results-engine.js');
  const ui = read('assets/results/mode-atlas-results-ui.js');
  const storage = read('assets/results/mode-atlas-results-storage.js');

  assert.match(html, /Formal assessment/);
  assert.match(html, /Test Mode only · practice sessions are not included/);
  assert.match(html, /Assessment history/);
  assert.match(html, /Kana-level analysis/);
  assert.match(html, /Before your next test/);
  assert.match(html, /id="testHeatmap"/);
  assert.match(html, /id="rowPerformanceMount"/);
  assert.match(ui, /row-doughnut-card/);
  assert.match(ui, /document\.createElement\("canvas"\)/);
  assert.match(page, /drawRowCharts\(result, activeRowGraphView\)/);
  assert.match(page, /item\.mode === mode/);
  assert.match(page, /Reading tests compare with Reading tests|most recent.*Test Mode assessments/);
  assert.match(engine, /function isFormalTestResultRecord/);
  assert.match(engine, /if \(!isFormalTestResultRecord\(item\)\) return/);
  assert.match(storage, /testModeResults/);
  assert.doesNotMatch(page, /readModeJSON\([^\n]*(?:scoreHistory|dailyHistory|charStats)/);
  assert.doesNotMatch(page, /speedRunTop3|endlessBest|dailyChallengeHistory/);
});


test('2.41 Atlas Level uses one mergeable semantic progression owner and Profile is its consumer', () => {
  const frontend = read('frontend_components.py');
  const storage = read('assets/app/mode-atlas-storage.js');
  const progress = read('assets/app/mode-atlas-progress.js');
  const cloud = read('cloud-sync.js');
  const profile = read('assets/ui/mode-atlas-profile-menu.js');
  const bindings = read('assets/ui/mode-atlas-profile-drawer-bindings.js');
  const reading = read('assets/pages/mode-atlas-default-page.js');
  const writing = read('assets/pages/mode-atlas-reverse-page.js');
  const trainerCore = read('assets/trainer/mode-atlas-trainer-core.js');
  const home = read('index.html');

  assert.match(frontend, /assets\/app\/mode-atlas-progress\.js/);
  assert.ok(frontend.indexOf("'assets/app/mode-atlas-progress.js'") < frontend.indexOf("'cloud-sync.js'"),
    'progression must load before cloud/profile consumers');
  assert.match(storage, /progress: 'modeAtlasProgress'/);
  assert.match(storage, /progressUpdatedAt: 'modeAtlasProgressUpdatedAt'/);
  assert.match(storage, /'modeAtlasProgressDeviceId'/);
  const backupBlock = storage.split('const APP_BACKUP_EXACT', 2)[1]?.split('const APP_LOCAL_EXACT', 1)[0] || '';
  assert.doesNotMatch(backupBlock, /modeAtlasProgressDeviceId/,
    'device identity is local-only and must not be exported as account progress');

  assert.match(progress, /const COUNTER_XP/);
  assert.match(progress, /'kana\.reading\.correct': 1/);
  assert.match(progress, /'kana\.writing\.correct': 1/);
  assert.match(progress, /'kana\.reading\.dailyComplete': 5/);
  assert.match(progress, /'kana\.writing\.testComplete': 10/);
  assert.match(progress, /function mergeStates/);
  assert.match(progress, /Math\.max\(finiteCount\(a\.sources/,
    'per-device counters must merge monotonically rather than last-write-wins');
  assert.match(progress, /function awardOnce/);
  assert.match(progress, /legacy-baseline/);
  assert.match(progress, /function getLifetimeCorrect/);

  assert.match(cloud, /progress: \{\s*updatedAtKey:/);
  assert.match(cloud, /name === 'progress'/);
  assert.match(cloud, /ModeAtlasProgress\?\.mergeStates/);
  assert.match(cloud, /progress: 'Atlas Level'/);

  assert.match(reading, /ModeAtlasProgress\?\.award\?\.\('kana\.reading\.correct'/);
  assert.match(writing, /ModeAtlasProgress\?\.award\?\.\('kana\.writing\.correct'/);
  assert.match(reading, /awardOnce\?\.\('kana\.reading\.dailyComplete', dateKey\)/);
  assert.match(writing, /awardOnce\?\.\('kana\.writing\.dailyComplete', dateKey\)/);
  assert.match(trainerCore, /awardOnce\?\.\(`kana\.\$\{mode\}\.testComplete`, result\.id\)/);

  assert.match(profile, /Atlas Level <span id="profileAtlasLevel">1<\/span>/);
  assert.match(profile, /id="profileAtlasProgress"/);
  assert.match(profile, /id="profileReadingCorrect"/);
  assert.match(profile, /id="profileWritingCorrect"/);
  assert.match(bindings, /ModeAtlasProgress\?\.getSummary/);
  assert.match(bindings, /modeAtlasProgressChanged/);
  assert.doesNotMatch(home, /profileAtlasLevel|Atlas Level \d|XP to Level/,
    'Atlas homepage must remain free of account XP UI');
});



test('2.42 contextual install and progression feedback stay under shared owners', () => {
  const frontend = read('frontend_components.py');
  const storage = read('assets/app/mode-atlas-storage.js');
  const progress = read('assets/app/mode-atlas-progress.js');
  const progressUi = read('assets/app/mode-atlas-progress-ui.js');
  const pwa = read('assets/app/mode-atlas-pwa.js');
  const dev = read('assets/app/mode-atlas-dev-console.js');
  const shared = read('assets/trainer/mode-atlas-trainer-shared.js');
  const reading = read('assets/pages/mode-atlas-default-page.js');
  const writing = read('assets/pages/mode-atlas-reverse-page.js');
  const cloud = read('cloud-sync.js');

  assert.match(frontend, /assets\/app\/mode-atlas-progress-ui\.js/);
  assert.ok(frontend.indexOf("'assets/app/mode-atlas-progress.js'") < frontend.indexOf("'assets/app/mode-atlas-progress-ui.js'"));
  assert.ok(frontend.indexOf("'assets/app/mode-atlas-progress-ui.js'") < frontend.indexOf("'assets/app/mode-atlas-pwa.js'"));

  assert.match(progress, /const STATE_VERSION = 2/);
  assert.match(progress, /adjustments/);
  assert.match(progress, /function debugAdjustXP/);
  assert.match(progress, /source: 'dev\.xpAdjust'/);
  assert.match(progress, /previousLevel/);
  assert.match(cloud, /data\.state\?\.adjustments/);

  assert.match(progressUi, /modeAtlasProgressChanged/);
  assert.match(progressUi, /pendingLevelUp/);
  assert.match(progressUi, /naturalBreak/);
  assert.match(progressUi, /title: 'Level up'/);

  assert.match(shared, /startXp/);
  assert.match(shared, /function getTrainerSessionXpGain/);
  assert.match(shared, /\["XP gained", `\+\$\{xpGain\} XP`\]/);
  assert.match(shared, /settleTrainerProgressionBreak/);
  for (const page of [reading, writing]) {
    assert.match(page, /\["XP gained", `\+\$\{getTrainerSessionXpGain\(sessionStats\)\} XP`\]/);
    assert.match(page, /gameOverAnswerEl\.textContent \+= ` · \+\$\{sessionXp\} XP`/);
    assert.match(page, /formal-test-summary/);
  }

  assert.match(pwa, /AUTO_INSTALL_CORRECT_THRESHOLD = 100/);
  assert.match(pwa, /ModeAtlasProgress\?\.getLifetimeCorrect/);
  assert.match(pwa, /function naturalBreak/);
  assert.match(pwa, /beforeinstallprompt/);
  assert.match(pwa, /Share → Add to Home Screen/);
  assert.doesNotMatch(pwa, /modeAtlasProgressChanged[\s\S]{0,180}showInstallPrompt/,
    'crossing the milestone must not immediately interrupt an answer');

  const backupBlock = storage.split('const APP_BACKUP_EXACT', 2)[1]?.split('const APP_LOCAL_EXACT', 1)[0] || '';
  const localBlock = storage.split('const APP_LOCAL_EXACT', 2)[1]?.split('const APP_LOCAL_SET', 1)[0] || '';
  assert.doesNotMatch(backupBlock, /modeAtlasInstallPromptSeen|modeAtlasInstallPromptDismissedAt/,
    'automatic install prompt acknowledgement must stay device-local');
  assert.match(localBlock, /modeAtlasInstallPromptSeen/);
  assert.match(localBlock, /modeAtlasInstallPromptDismissedAt/);

  assert.match(dev, /Progress \/ XP/);
  assert.match(dev, /data-ma-dev-xp-amount/);
  assert.match(dev, /debugAdjustXP/);
  assert.doesNotMatch(dev, /setJSON\(['"]modeAtlasProgress|localStorage\.setItem\(['"]modeAtlasProgress/,
    'developer XP controls must use the progression API rather than raw progression storage');
});

test('2.43 Achievements are category-owned and sequential milestones rank up in place', () => {
  const achievements = read('assets/achievements/mode-atlas-achievements-ui.js');
  const css = read('assets/css/mode-atlas-achievements.css');

  for (const category of ['Mode Atlas', 'Kana Trainer', 'Word Bank']) assert.match(achievements, new RegExp(`title:'${category.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}'`));
  for (const future of ['Listening', 'Grammar', 'Reading Comprehension']) assert.match(achievements, new RegExp(`title:'${future}'`));

  assert.match(achievements, /const ACHIEVEMENT_TRACKS/);
  assert.match(achievements, /id:'speed-goal',name:'Speed Goal'/);
  assert.match(achievements, /id:'word-collection',name:'Word Collection'/);
  assert.match(achievements, /state\.complete\?'Max rank'/);
  assert.match(achievements, /Achievement ranked up/);
  assert.match(achievements, /dataset\.maAchRankNav/);
  assert.match(achievements, /← Previous rank/);
  assert.match(achievements, /Next rank →/);

  for (const level of [5,10,20,50,100]) assert.match(achievements, new RegExp(`target:${level},key:'atlasLevel'`));
  assert.match(achievements, /ModeAtlasProgress\?\.getSummary/);
  assert.match(achievements, /modeAtlasProgressChanged/);

  // Existing milestone IDs remain behind the ranked presentation, preventing false re-unlocks.
  for (const id of ['general-0','general-4','kana-8','kana-10','wordbank-0','wordbank-4']) assert.match(achievements, new RegExp(`unlockId:'${id}'`));
  assert.doesNotMatch(achievements, /const DEFINITIONS =/);

  assert.match(css, /--ma-ach-rank/);
  assert.match(css, /\.ma-ach-rank-history/);
  assert.match(css, /\.ma-achievement-section--future/);
});

test('2.43.1 achievement tiles breathe and detail navigation has distinct destinations', () => {
  const achievements = read('assets/achievements/mode-atlas-achievements-ui.js');
  const achievementCss = read('assets/css/mode-atlas-achievements.css');
  const dialog = read('assets/app/mode-atlas-dialog.js');
  const components = read('assets/css/mode-atlas-components.css');

  assert.match(achievements, /const RANK_ACCENTS = Object\.freeze\(\['184,92,62','148,163,184','248,196,70'/);
  assert.match(achievements, /const copy=achEl\('div','ma-ach-copy'\)/);
  assert.match(achievementCss, /\.ma-achievement-tile\{[^}]*display:flex;flex-direction:column[^}]*min-height:190px/);
  assert.match(achievementCss, /\.ma-ach-copy\{[^}]*margin-bottom:18px/);
  assert.match(achievementCss, /\.ma-ach-meter\{[^}]*position:relative[^}]*margin-top:auto/);

  assert.match(achievements, /backLabel:'← Back to achievements'/);
  assert.match(achievements, /backLabel:'← Back to Mastery Map'/);
  assert.doesNotMatch(achievements, /ma-ach-info-back','Back'/);
  assert.match(achievements, /closeLabel:'×'/);
  assert.match(achievements, /Close achievements/);
  assert.match(dialog, /close\.classList\.toggle\('ma-dialog__close--icon', opts\.closeIcon\)/);
  assert.match(components, /\.ma-dialog__close--icon/);
});

test('2.44 app-wide UX vocabulary keeps product destinations and actions semantically consistent', () => {
  const frontend = read('frontend_components.py');
  const home = read('index.html');
  const kana = read('kana/index.html');
  const kanaJs = read('assets/pages/mode-atlas-kana-page.js');
  const results = read('results/index.html');
  const resultsUi = read('assets/results/mode-atlas-results-ui.js');
  const resultsPage = read('assets/pages/mode-atlas-test-page.js');
  const wordbank = read('wordbank/index.html');
  const wordbankJs = read('assets/pages/mode-atlas-wordbank-page.js');
  const settings = read('assets/ui/mode-atlas-settings-menu.js');

  assert.match(frontend, /'results\/index\.html': NavConfig\('results', '測', 'Kana Trainer', 'Test Results'/);
  assert.match(frontend, /\('results', 'Test Results', '\/results\/'\)/);
  assert.match(frontend, /'reading\/index\.html': NavConfig\([^\n]*brand_href='\/kana\/'/);
  assert.match(frontend, /'writing\/index\.html': NavConfig\([^\n]*brand_href='\/kana\/'/);
  assert.match(frontend, /Kana Trainer home/);
  assert.match(frontend, />Start practice<\/span>/);
  assert.match(frontend, />End session<\/span>/);
  assert.match(frontend, />Try again<\/button>/);
  assert.match(frontend, />View Test Results<\/span>/);
  assert.doesNotMatch(frontend, /View full Results|Try Again|>Wrong</);

  for (const html of [home, kana]) assert.match(html, /Test Results/);
  assert.match(kana, />Open Reading /);
  assert.match(kana, />Open Writing /);
  assert.match(kanaJs, /label: 'Review weak kana'/);
  assert.match(kanaJs, /label: 'Open Test Results'/);
  assert.doesNotMatch(kanaJs, /label: 'Start Reading'|label: 'Go to Writing'|label: 'Open Results'/);

  assert.match(results, />Incorrect<\/div>/);
  assert.match(results, /No assessment selected/);
  assert.match(results, /Back to Kana Trainer/);
  assert.doesNotMatch(results, /No result selected|Open Kana hub/);
  assert.match(resultsUi, /Test Average/);
  assert.doesNotMatch(resultsUi, /Overall Average/);
  assert.match(resultsPage, /Reading average/);
  assert.match(resultsPage, /correct \/ \$\{item\.wrong\} incorrect/);
  assert.match(resultsPage, /Correct: \$\{row\.correct\} · Incorrect: \$\{row\.wrong\}/);

  assert.match(wordbank, />Kana word<\/label>/);
  assert.match(wordbank, />Add word<\/button>/);
  assert.match(wordbankJs, /"Save changes"/);
  assert.match(wordbankJs, /Clear search and filters/);
  assert.doesNotMatch(wordbankJs, /'warn'|'ok'|Save Changes|Clear search & filters/);

  assert.match(settings, /data-display="tablet" type="button">Tablet<\/button>/);
  assert.match(settings, />Data and app<\/strong>/);
  assert.doesNotMatch(settings, />iPad<\/button>|>Data & app<\/strong>/);
});


test('2.45 responsive and accessibility QA keeps landmarks, keyboard controls, focus traps, and touch targets shared', () => {
  const frontend = read('frontend_components.py');
  const navigation = read('assets/css/mode-atlas-navigation.css');
  const components = read('assets/css/mode-atlas-components.css');
  const profileSettings = read('assets/css/mode-atlas-profile-settings.css');
  const dialog = read('assets/app/mode-atlas-dialog.js');
  const controller = read('assets/trainer/mode-atlas-trainer-controller.js');
  const sharedTrainer = read('assets/trainer/mode-atlas-trainer-shared.js');
  const studyCss = read('assets/css/mode-atlas-study-shared.css');
  const wordbankCss = read('assets/css/mode-atlas-wordbank-page.css');
  const kanaCss = read('assets/css/mode-atlas-kana-page.css');

  assert.match(frontend, /ma-skip-link[^>]+href=\"#mainContent\"/);
  assert.match(frontend, /<main id=\"mainContent\" class=\"app-shell ma-trainer-shell\"/);
  assert.match(frontend, /<button class=\"panel-header\" id=\"scoresHeader\" type=\"button\" aria-expanded=\"true\" aria-controls=\"scoresContent\"/);
  assert.match(frontend, /<button class=\"panel-header\" id=\"statsHeader\" type=\"button\" aria-expanded=\"true\" aria-controls=\"statsContent\"/);
  assert.match(frontend, /<button class=\"tab-button\" id=\"modifiersTab\" type=\"button\" aria-expanded=\"false\" aria-controls=\"modifiersContent\"/);

  for (const page of ['index.html','kana/index.html','reading/index.html','writing/index.html','results/index.html','wordbank/index.html','privacy/index.html','terms/index.html']) {
    const html = read(page);
    assert.equal((html.match(/id=\"mainContent\"/g) || []).length, 1, `${page} should expose one main content target`);
    assert.match(html, /class=\"ma-skip-link\" href=\"#mainContent\"/);
  }

  assert.match(navigation, /\.ma-skip-link\{/);
  assert.match(navigation, /@media\(pointer:coarse\)[\s\S]*\.ma-nav__section-link[\s\S]*min-height:44px/);
  assert.match(components, /@media\(pointer:coarse\)[\s\S]*\.ma-button--small\{--ma-button-min-height:44px;\}/);
  assert.match(profileSettings, /body\.profile-open,body\.settings-open\{overflow:hidden;\}/);
  assert.match(wordbankCss, /@media\(pointer:coarse\)\{\.summary-toggle\{width:44px;height:44px;\}\}/);
  assert.match(kanaCss, /@media\(pointer:coarse\)\{\.kana-ghost-action,\.kana-map-action,\.kana-inline-btn\{--ma-button-min-height:44px;\}\}/);

  assert.match(dialog, /message\.id = 'maDialogMessage'/);
  assert.match(dialog, /el\.getClientRects\(\)\.length > 0/);
  assert.match(dialog, /panel\.setAttribute\('aria-describedby', message\.id\)/);
  assert.match(controller, /modifiersTabEl\?\.setAttribute\('aria-expanded', String\(modifiersOpen\)\)/);
  assert.match(controller, /byId\('statsHeader'\)\?\.setAttribute\('aria-expanded'/);
  assert.match(controller, /byId\('scoresHeader'\)\?\.setAttribute\('aria-expanded'/);
  assert.match(sharedTrainer, /document\.createElement\(\"button\"\)[\s\S]*View mastery details/);
  assert.match(sharedTrainer, /e\.detail === 0[\s\S]*getBoundingClientRect/);
  assert.match(sharedTrainer, /e\.key !== \"Escape\"/);
  assert.match(studyCss, /button\.cell\{appearance:none;min-height:0/);

  const sharedPage = read('assets/css/mode-atlas-page-shared.css');
  assert.match(sharedPage, /button:focus-visible,a:focus-visible/);
  assert.match(sharedPage, /prefers-reduced-motion:reduce/);
});


test('2.46 production boot keeps developer diagnostics lazy and revision-build owned', () => {
  const frontend = read('frontend_components.py');
  const builder = read('build_revision_assets.py');
  const loader = read('assets/app/mode-atlas-dev-console-loader.js');
  const version = read('assets/app/mode-atlas-version.js');
  const revision = (version.match(/CACHE_REVISION\s*=\s*['\"]([^'\"]+)/) || [])[1];

  assert.match(frontend, /assets\/app\/mode-atlas-dev-console-loader\.js/);
  assert.doesNotMatch(frontend, /['\"]assets\/app\/mode-atlas-dev-console\.js['\"]/);
  assert.doesNotMatch(frontend, /['\"]assets\/css\/mode-atlas-dev-console\.css['\"]/);
  assert.match(builder, /LAZY_ASSETS/);
  assert.match(builder, /assets\/app\/mode-atlas-dev-console\.js/);
  assert.match(builder, /assets\/css\/mode-atlas-dev-console\.css/);
  assert.match(loader, /document\.currentScript/);
  assert.match(loader, /kanaCloudSyncStatusChanged/);
  assert.match(loader, /admin@mode-atlas\.com/);
  assert.match(loader, /loadIfEligible/);

  for (const page of ['index.html','kana/index.html','reading/index.html','writing/index.html','results/index.html','wordbank/index.html']) {
    const html = read(page);
    assert.match(html, new RegExp(`mode-atlas-dev-console-loader\\.${revision}\\.js`));
    assert.doesNotMatch(html, new RegExp(`mode-atlas-dev-console\\.${revision}\\.js`));
    assert.doesNotMatch(html, new RegExp(`mode-atlas-dev-console\\.${revision}\\.css`));
  }
});


test('2.47 release candidate hardening keeps release tooling reproducible', () => {
  const lock = read('package-lock.json');
  assert.doesNotMatch(lock, /internal\.api\.openai|applied-caas|artifactory\/api\/npm/i,
    'package-lock must remain installable from public infrastructure');

  const build = read('build_revision_assets.py');
  assert.match(build, /BUILD_IGNORED_DIRS\s*=\s*\{[^}]*'node_modules'/,
    'revision builder must not treat installed dependencies as application source');
  assert.match(build, /def iter_project_html\(\):/,
    'revision builder must own project HTML discovery explicitly');

  const audit = read('audit_project.py');
  assert.match(audit, /AUDIT_IGNORED_DIRS\s*=\s*\{[^}]*'node_modules'/,
    'release audit must not treat installed dependencies as application source');

  const manifest = JSON.parse(read('site.webmanifest'));
  const resultsShortcut = (manifest.shortcuts || []).find((shortcut) => shortcut.url === '/results/');
  assert.ok(resultsShortcut, 'PWA manifest must keep the Test Results shortcut');
  assert.equal(resultsShortcut.name, 'Test Results');
  assert.equal(resultsShortcut.short_name, 'Test Results');

  const kana = read('kana/index.html');
  assert.doesNotMatch(kana, /<main[^>]*\bid=["']mainContent["'][^>]*\bid=/,
    'Kana Hub main landmark must not contain duplicate id attributes');
  assert.match(kana, /<main id=["']mainContent["'] class=["']kana-hub ma-page-section["']>/,
    'Kana Hub must keep the shared mainContent landmark');

  const wordBankPage = read('assets/pages/mode-atlas-wordbank-page.js');
  assert.match(wordBankPage, /^\(function ModeAtlasWordBankPage\(\)\{/,
    'Word Bank page declarations must stay in page-local scope and not collide with shared kana data');
  assert.match(wordBankPage, /\}\)\(\);\s*$/,
    'Word Bank page module scope must close cleanly');

  const smoke = read('tests/smoke.spec.js');
  assert.doesNotMatch(smoke, /window\.ModeAtlasSettings\?\.open/,
    'browser smoke must open Settings through the real user control');
  assert.match(smoke, /\[data-settings-open\]:visible/,
    'browser smoke must select the visible shared Settings trigger');
  assert.match(smoke, /toHaveAttribute\('data-settings-bound', 'shared'/,
    'browser smoke must wait for shared Settings binding readiness');
  assert.match(smoke, /modeAtlasOnboardingComplete[\s\S]*modeAtlasKanaSetupComplete/,
    'core browser smoke must seed a completed stable-user setup rather than be blocked by onboarding');
  assert.match(smoke, /maWhatsNewSeen["'], 'smoke'/,
    'core browser smoke must suppress release notes so unrelated interaction tests stay isolated');
  assert.doesNotMatch(smoke, /ma-trainer-card \.ma-pause-overlay/,
    'trainer smoke must validate canonical paused state rather than a presentation-only overlay');
  assert.match(smoke, /atlas-product__action\[href=\\?"\/kana\/\\?"\]/,
    'Atlas navigation smoke must use the current visible Kana product action');
  assert.match(smoke, /wordBankAddJumpBtn[\s\S]*kanaInput/,
    'Word Bank smoke must open the Add Word dialog before interacting with its form');
  assert.doesNotMatch(smoke, /details\.card\[data-id\]/,
    'Word Bank smoke must use the current wordbank-entry row markup');
  assert.match(smoke, /details\.wordbank-entry\[data-id\]/,
    'Word Bank smoke must verify the persisted entry through the current row markup');

  const gate = read('.github/workflows/release-check.yml');
  assert.match(gate, /npm ci --ignore-scripts --registry=https:\/\/registry\.npmjs\.org\//,
    'release gate must install from the public npm registry');
  assert.match(gate, /npm run release:check/, 'release gate must run static and Node release checks');
  assert.match(gate, /desktop-chromium/, 'release gate must exercise the desktop browser project');
  assert.match(gate, /mobile-chromium/, 'release gate must exercise the mobile browser project');
  assert.match(gate, /git diff --exit-code/, 'release gate must reject uncommitted generated assets');
});


test('2.47 final responsive polish keeps explicit display modes and Atlas rank milestones aligned', () => {
  const bindings = read('assets/ui/mode-atlas-profile-drawer-bindings.js');
  const navigation = read('assets/css/mode-atlas-navigation.css');
  const drawers = read('assets/css/mode-atlas-profile-settings.css');
  const study = read('assets/css/mode-atlas-study-shared.css');
  const home = read('assets/css/mode-atlas-home-page.css');
  const kana = read('assets/css/mode-atlas-kana-page.css');

  assert.match(bindings, /if \(level >= 75\) return 'teal'/);
  assert.match(bindings, /if \(level >= 50\) return 'violet'/);
  assert.match(bindings, /if \(level >= 25\) return 'gold'/);
  assert.match(bindings, /if \(level >= 10\) return 'silver'/);
  assert.doesNotMatch(bindings, /level >= (?:76|51|26|11)/,
    'Atlas rank colours must change on the milestone level itself');

  assert.match(navigation, /body\[data-effective-display-mode="phone"\] \.ma-nav__content/);
  assert.match(navigation, /body\[data-effective-display-mode="phone"\] \.ma-nav__links\{[\s\S]*grid-row:2/);
  assert.match(navigation, /body\[data-effective-display-mode="phone"\] \.ma-nav__actions\{[\s\S]*grid-row:1/);
  assert.match(navigation, /body\[data-effective-display-mode="tablet"\] \.ma-nav\{[\s\S]*display:flex/,
  'explicit Tablet navigation must stay a compact single-row composition');

assert.match(home, /body\[data-effective-display-mode="tablet"\] \.atlas-hero__stage/,
  'Atlas home must consume explicit Tablet mode directly');
assert.match(home, /body\[data-effective-display-mode="phone"\] \.atlas-hero/,
  'Atlas home must consume explicit Phone mode directly');
assert.match(kana, /body\[data-effective-display-mode="tablet"\] \.kana-hub-hero/,
  'Kana hub must consume explicit Tablet mode directly');
assert.match(kana, /body\[data-effective-display-mode="phone"\] \.kana-mastery-grid/,
  'Kana Phone mode must own compact progress density');

  assert.match(drawers, /body\[data-effective-display-mode="tablet"\] \.ma-drawer\{/);
  assert.match(drawers, /overflow-x:hidden;overflow-y:auto/);
  assert.doesNotMatch(drawers, /@media\(max-width:1180px\)\{\s*body\[data-effective-display-mode="tablet"\]/,
    'explicit Tablet drawer geometry must not depend on physical viewport width');
  assert.match(drawers, /\.ma-progression-footer\{display:flex;flex-wrap:wrap/);

  assert.match(study, /safe-area-inset-top/);
  assert.doesNotMatch(study, /padding:20px 14px 130px/,
    'idle mobile trainer must not retain the retired viewport-filling bottom padding');
  assert.doesNotMatch(study, /padding:18px 12px 126px/,
    'explicit Phone trainer must not retain the retired viewport-filling bottom padding');
  assert.match(study, /body\.trainer-session-active \.ma-trainer-prompt-wrap/,
    'focused active-session sizing must remain owned separately');
  assert.match(study, /body\[data-effective-display-mode="phone"\]:not\(\.trainer-session-active\) \.ma-trainer-prompt-wrap\{min-height:96px/,
  'idle Phone trainer must not reserve active-session prompt height');
assert.match(study, /@media\(min-width:980px\)[\s\S]*data-effective-display-mode="tablet"[\s\S]*grid-template-columns:minmax\(0,1fr\) minmax\(260px,300px\)/,
  'wide Tablet trainer must use the available workspace instead of a narrow centred desktop card');
});
