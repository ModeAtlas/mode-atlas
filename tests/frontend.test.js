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
  assert.match(wordbankHtml, /class="stat ma-stat ma-card ma-card--flat"/);
  assert.match(wordbankHtml, /class="panel [^"]*ma-card"/);
  assert.match(wordbankJs, /field-small ma-field/);
  assert.match(wordbankJs, /input\.className = "ma-input"/);
  assert.match(wordbankJs, /notes\.className = "ma-textarea"/);
  assert.match(wordbankJs, /card ma-card ma-card--soft/);
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
  assert.match(trainerCss, /body\[data-effective-display-mode="phone"\] \.ma-trainer-card\{[\s\S]*?padding:18px 12px 126px;/,
    'phone trainer card must retain compact responsive padding');
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

  assert.match(kanaHtml, /kana-hub-hero glass ma-card/);
  assert.match(kanaHtml, /kana-hero-actions ma-action-row/);
  assert.match(kanaHtml, /kana-head-actions ma-action-row/);
  assert.match(kanaJs, /kana-next-card primary ma-card ma-card--flat ma-card--interactive/);
  assert.match(kanaJs, /kana-stage-card ma-card ma-card--flat ma-card--interactive/);
  assert.match(kanaJs, /kana-record-card ma-card ma-card--flat/);
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

  assert.match(wordbankHtml, /stats ma-stat-grid/);
  assert.match(wordbankHtml, /hero ma-card ma-page-hero ma-page-intro/);
  assert.match(wordbankHtml, /ma-toolbar-shared ma-toolbar-shared--sticky/);
  assert.match(wordbankHtml, /id="wordBankActionsBtn"/);
  assert.doesNotMatch(wordbankHtml, /<details class="wordbank-tools">/);
  assert.match(wordbankJs, /empty ma-card ma-empty-state/);
  const wordbankStatBlock = wordbankCss.match(/\.stats?\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(wordbankStatBlock, /(^|\n)\s*border\s*:/,
    'Word Bank stats should not re-own shared stat card mechanics');
  const wordbankEmptyBlock = wordbankCss.match(/\.empty\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(wordbankEmptyBlock, /(^|\n)\s*border\s*:/,
    'Word Bank empty state should configure variables instead of re-owning its border');
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
  assert.match(settings, /Data & app/);
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

  const libraryIndex = wordbank.indexOf('class="panel library-panel ma-card"');
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

  assert.match(homeCss, /font-family:\s*var\(--ma-font-ui\)/);
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
  const homeCss = read('assets/css/mode-atlas-home-page.css');
  const wordbankHtml = read('wordbank/index.html');
  const wordbankJs = read('assets/pages/mode-atlas-wordbank-page.js');
  const wordbankCss = read('assets/css/mode-atlas-wordbank-page.css');
  assert.doesNotMatch(settings, /Let Mode Atlas adapt automatically|Choose feedback volume|Use the dark or light Atlas palette/);
  assert.match(homeCss, /padding-block:var\(--ma-space-3\) clamp\(24px,3vw,36px\)/);
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
  assert.match(css, /grid-template-columns:minmax\(96px,120px\) minmax\(0,1fr\)/);
  assert.match(css, /\.ma-settings-status:empty\{display:none;\}/);
});
