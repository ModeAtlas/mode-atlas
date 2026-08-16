from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text()


def write(path, text):
    (ROOT / path).write_text(text)


def one(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


# Release metadata
version_path = 'assets/app/mode-atlas-version.js'
text = read(version_path)
text = one(text, "var VERSION = '2.40.0';", "var VERSION = '2.41.0';", 'version')
text = one(text, "var CACHE_REVISION = 'assets-2.40.0';", "var CACHE_REVISION = 'assets-2.41.0';", 'cache revision')
write(version_path, text)

for filename in ['package.json', 'package-lock.json']:
    path = ROOT / filename
    data = json.loads(path.read_text())
    data['version'] = '2.41.0'
    if filename == 'package-lock.json' and isinstance(data.get('packages'), dict) and isinstance(data['packages'].get(''), dict):
        data['packages']['']['version'] = '2.41.0'
    path.write_text(json.dumps(data, indent=2) + '\n')

readme = read('README.md')
if '2.40.0' in readme:
    readme = readme.replace('2.40.0', '2.41.0')
write('README.md', readme)

changelog = read('CHANGELOG.md')
entry = '''## 2.41.0 — Atlas Level & Account Progression

- Added one shared `ModeAtlasProgress` owner for account-wide semantic learning progress and Atlas Level XP.
- Correct Reading/Writing kana award progression centrally; official Daily Challenge completions and formal Test Mode completions award one-time bonuses.
- Existing trainer history seeds a one-time baseline so established learners do not restart at zero.
- Progress uses per-device monotonic counters plus mergeable one-time events so cloud sync can combine activity without last-write-losing XP.
- Profile now presents Atlas Level, XP progress, Reading/Writing correct-kana activity, achievements, and sync without adding progression clutter to Atlas or Kana.

'''
if '## 2.41.0 — Atlas Level & Account Progression' not in changelog:
    marker = '# Changelog\n\n'
    if marker in changelog:
        changelog = changelog.replace(marker, marker + entry, 1)
    else:
        changelog = entry + changelog
write('CHANGELOG.md', changelog)


# Shared progression owner
progress_source = r'''(function ModeAtlasProgressOwner(root){
  'use strict';
  if (root.ModeAtlasProgress) return;

  const STORAGE_KEY = 'modeAtlasProgress';
  const UPDATED_AT_KEY = 'modeAtlasProgressUpdatedAt';
  const DEVICE_KEY = 'modeAtlasProgressDeviceId';
  const STATE_VERSION = 1;
  const LEGACY_SOURCE = 'legacy-baseline';

  const COUNTER_XP = Object.freeze({
    'kana.reading.correct': 1,
    'kana.writing.correct': 1
  });
  const EVENT_XP = Object.freeze({
    'kana.reading.dailyComplete': 5,
    'kana.writing.dailyComplete': 5,
    'kana.reading.testComplete': 10,
    'kana.writing.testComplete': 10
  });

  function store(){ return root.ModeAtlasStorage; }
  function finiteCount(value){
    const number = Number(value || 0);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
  }
  function object(value){ return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }

  function normalizeSource(source){
    const out = {};
    Object.entries(object(source)).forEach(([type, value]) => {
      if (!(type in COUNTER_XP)) return;
      const count = finiteCount(value);
      if (count) out[type] = count;
    });
    return out;
  }

  function normalizeEvent(event, fallbackKey = ''){
    if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
    const type = String(event.type || '');
    if (!(type in EVENT_XP)) return null;
    const id = String(event.id || fallbackKey.split('|').slice(1).join('|') || '');
    if (!id) return null;
    return { type, id, at: finiteCount(event.at) || Date.now() };
  }

  function normalizeState(input){
    const value = object(input);
    const sources = {};
    Object.entries(object(value.sources)).forEach(([sourceId, counters]) => {
      const normalized = normalizeSource(counters);
      if (Object.keys(normalized).length) sources[String(sourceId)] = normalized;
    });
    const events = {};
    Object.entries(object(value.events)).forEach(([key, event]) => {
      const normalized = normalizeEvent(event, key);
      if (normalized) events[`${normalized.type}|${normalized.id}`] = normalized;
    });
    return {
      version: STATE_VERSION,
      legacySeeded: value.legacySeeded === true,
      sources,
      events,
      updatedAt: finiteCount(value.updatedAt)
    };
  }

  function mergeStates(left, right){
    const a = normalizeState(left);
    const b = normalizeState(right);
    const merged = {
      version: STATE_VERSION,
      legacySeeded: a.legacySeeded || b.legacySeeded,
      sources: {},
      events: {},
      updatedAt: Math.max(a.updatedAt, b.updatedAt)
    };
    const sourceIds = new Set([...Object.keys(a.sources), ...Object.keys(b.sources)]);
    sourceIds.forEach((sourceId) => {
      const source = {};
      const types = new Set([...Object.keys(a.sources[sourceId] || {}), ...Object.keys(b.sources[sourceId] || {})]);
      types.forEach((type) => {
        const value = Math.max(finiteCount(a.sources[sourceId]?.[type]), finiteCount(b.sources[sourceId]?.[type]));
        if (value) source[type] = value;
      });
      if (Object.keys(source).length) merged.sources[sourceId] = source;
    });
    Object.assign(merged.events, a.events);
    Object.entries(b.events).forEach(([key, event]) => {
      if (!merged.events[key] || finiteCount(event.at) < finiteCount(merged.events[key].at)) merged.events[key] = event;
    });
    return merged;
  }

  function makeDeviceId(){
    try { if (root.crypto?.randomUUID) return `device-${root.crypto.randomUUID()}`; } catch {}
    return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function getDeviceId(){
    const storage = store();
    let id = String(storage?.get?.(DEVICE_KEY, '') || '').trim();
    if (!id) {
      id = makeDeviceId();
      storage?.set?.(DEVICE_KEY, id);
    }
    return id;
  }

  function readState(){
    return normalizeState(store()?.json?.(STORAGE_KEY, {}) || {});
  }

  function emit(summary, source = 'local'){
    try { root.dispatchEvent(new CustomEvent('modeAtlasProgressChanged', { detail: { ...summary, source } })); } catch {}
  }

  function persistState(input, options = {}){
    const storage = store();
    if (!storage?.setJSON) return normalizeState(input);
    const state = normalizeState(input);
    state.updatedAt = Math.max(Date.now(), finiteCount(state.updatedAt));
    storage.setJSON(STORAGE_KEY, state);
    storage.set(UPDATED_AT_KEY, String(state.updatedAt));
    if (options.sync !== false) {
      try { root.KanaCloudSync?.markSectionUpdated?.('progress'); } catch {}
      try { root.KanaCloudSync?.scheduleSync?.(); } catch {}
    }
    const summary = getSummary(state);
    if (options.emit !== false) emit(summary, options.source || 'local');
    return state;
  }

  function correctFromStats(mode){
    const stats = store()?.readModeJSON?.(mode, 'charStats', {}) || {};
    return Object.values(object(stats)).reduce((sum, row) => {
      if (!row || typeof row !== 'object') return sum;
      return sum + finiteCount(row.correct ?? row.right);
    }, 0);
  }

  function ensureSeeded(options = {}){
    let state = readState();
    if (state.legacySeeded) return state;
    const readingCorrect = correctFromStats('reading');
    const writingCorrect = correctFromStats('writing');
    const legacy = {};
    if (readingCorrect) legacy['kana.reading.correct'] = readingCorrect;
    if (writingCorrect) legacy['kana.writing.correct'] = writingCorrect;
    if (Object.keys(legacy).length) state.sources[LEGACY_SOURCE] = legacy;
    state.legacySeeded = true;
    return persistState(state, { sync: options.sync === true, emit: options.emit !== false, source: 'legacy-seed' });
  }

  function award(type, amount = 1){
    if (!(type in COUNTER_XP)) return false;
    const increment = finiteCount(amount);
    if (!increment) return false;
    const state = ensureSeeded({ sync: false, emit: false });
    const sourceId = getDeviceId();
    const source = state.sources[sourceId] || {};
    source[type] = finiteCount(source[type]) + increment;
    state.sources[sourceId] = source;
    persistState(state, { source: type });
    return true;
  }

  function awardOnce(type, eventId){
    if (!(type in EVENT_XP)) return false;
    const id = String(eventId || '').trim();
    if (!id) return false;
    const state = ensureSeeded({ sync: false, emit: false });
    const key = `${type}|${id}`;
    if (state.events[key]) return false;
    state.events[key] = { type, id, at: Date.now() };
    persistState(state, { source: type });
    return true;
  }

  function counterTotal(state, type){
    return Object.values(normalizeState(state).sources).reduce((sum, source) => sum + finiteCount(source[type]), 0);
  }

  function getLifetimeCorrect(input){
    const state = input ? normalizeState(input) : ensureSeeded({ sync: false, emit: false });
    return counterTotal(state, 'kana.reading.correct') + counterTotal(state, 'kana.writing.correct');
  }

  function getXP(input){
    const state = input ? normalizeState(input) : ensureSeeded({ sync: false, emit: false });
    let xp = 0;
    Object.values(state.sources).forEach((source) => {
      Object.entries(source).forEach(([type, count]) => { xp += finiteCount(count) * (COUNTER_XP[type] || 0); });
    });
    Object.values(state.events).forEach((event) => { xp += EVENT_XP[event.type] || 0; });
    return Math.max(0, Math.floor(xp));
  }

  function levelRequirement(level){
    const current = Math.max(1, Math.floor(Number(level || 1)));
    return 100 + ((current - 1) * 50);
  }

  function getLevelFromXP(value){
    const xp = Math.max(0, Math.floor(Number(value || 0)));
    let level = 1;
    let floor = 0;
    let required = levelRequirement(level);
    while (xp >= floor + required && level < 999) {
      floor += required;
      level += 1;
      required = levelRequirement(level);
    }
    return { level, floor, required, intoLevel: xp - floor, nextAt: floor + required };
  }

  function getSummary(input){
    const state = input ? normalizeState(input) : ensureSeeded({ sync: false, emit: false });
    const xp = getXP(state);
    const levelInfo = getLevelFromXP(xp);
    const readingCorrect = counterTotal(state, 'kana.reading.correct');
    const writingCorrect = counterTotal(state, 'kana.writing.correct');
    return {
      level: levelInfo.level,
      xp,
      levelXp: levelInfo.intoLevel,
      levelRequirement: levelInfo.required,
      nextLevelAt: levelInfo.nextAt,
      progress: levelInfo.required ? Math.min(1, levelInfo.intoLevel / levelInfo.required) : 0,
      readingCorrect,
      writingCorrect,
      lifetimeCorrect: readingCorrect + writingCorrect
    };
  }

  root.ModeAtlasProgress = Object.freeze({
    STORAGE_KEY, UPDATED_AT_KEY, DEVICE_KEY, STATE_VERSION,
    COUNTER_XP, EVENT_XP,
    normalizeState, mergeStates, readState, persistState, ensureSeeded,
    award, awardOnce, getXP, getLifetimeCorrect, getLevelFromXP, getSummary
  });

  // Seed locally before cloud hydration. The cloud owner will merge/push this
  // baseline rather than progression initiating a competing startup sync.
  ensureSeeded({ sync: false, emit: false });
})(typeof window !== 'undefined' ? window : globalThis);
'''
write('assets/app/mode-atlas-progress.js', progress_source)


# Storage ownership
path = 'assets/app/mode-atlas-storage.js'
text = read(path)
text = one(
    text,
    "    wordBank: 'kanaWordBank'\n",
    "    wordBank: 'kanaWordBank',\n    progress: 'modeAtlasProgress', progressUpdatedAt: 'modeAtlasProgressUpdatedAt'\n",
    'storage progress keys'
)
text = one(
    text,
    "    'modeAtlasPendingDestination',\n    'modeAtlasSectionTimestamps',",
    "    'modeAtlasPendingDestination',\n    'modeAtlasProgressDeviceId',\n    'modeAtlasSectionTimestamps',",
    'local-only progress device id'
)
write(path, text)


# Load progression once on every interactive app page, before cloud/profile owners.
path = 'frontend_components.py'
text = read(path)
text = one(
    text,
    "INTERACTIVE_SCRIPTS_AFTER_STORAGE = (\n    'assets/app/mode-atlas-save-repair.js',",
    "INTERACTIVE_SCRIPTS_AFTER_STORAGE = (\n    'assets/app/mode-atlas-progress.js',\n    'assets/app/mode-atlas-save-repair.js',",
    'progress script manifest'
)
write(path, text)


# Cloud sync: add a canonical progression section and merge it as a grow-only state.
path = 'cloud-sync.js'
text = read(path)
text = one(
    text,
    "  wordBank: {\n    updatedAtKey: 'kanaWordBankUpdatedAt',\n    scalar: {},\n    json: {\n      items: keyOr('wordBank', 'kanaWordBank')\n    }\n  }\n};",
    "  wordBank: {\n    updatedAtKey: 'kanaWordBankUpdatedAt',\n    scalar: {},\n    json: {\n      items: keyOr('wordBank', 'kanaWordBank')\n    }\n  },\n  progress: {\n    updatedAtKey: keyOr('progressUpdatedAt', 'modeAtlasProgressUpdatedAt'),\n    scalar: {},\n    json: {\n      state: keyOr('progress', 'modeAtlasProgress')\n    }\n  }\n};",
    'cloud progress section'
)
text = one(
    text,
    "  wordBank: 'profileUpdatedAt'\n};",
    "  wordBank: 'profileUpdatedAt',\n  progress: keyOr('progressUpdatedAt', 'modeAtlasProgressUpdatedAt')\n};",
    'progress section timestamp alias'
)
text = one(
    text,
    "  wordBank: []\n};",
    "  wordBank: [],\n  progress: []\n};",
    'progress extra timestamps'
)
text = one(
    text,
    "    wordBank: { items: [] }\n  };",
    "    wordBank: { items: [] },\n    progress: { state: { version: 1, legacySeeded: true, sources: {}, events: {}, updatedAt: now } }\n  };",
    'empty progress cloud snapshot'
)
text = one(
    text,
    "  if (sectionName === 'wordBank') return arrayHasItems(data.items);\n  if (sectionName === 'readingTests' || sectionName === 'writingTests') {",
    "  if (sectionName === 'wordBank') return arrayHasItems(data.items);\n  if (sectionName === 'progress') return deepHasProgress(data.state?.sources) || deepHasProgress(data.state?.events);\n  if (sectionName === 'readingTests' || sectionName === 'writingTests') {",
    'progress meaningful data rule'
)
merge_anchor = """    const baselineUpdatedAt = localBaseline ? normalizeTimestamp(localBaseline[name]) : 0;\n\n    if (localBaseline && localUpdatedAt > baselineUpdatedAt) {"""
merge_block = """    const baselineUpdatedAt = localBaseline ? normalizeTimestamp(localBaseline[name]) : 0;\n\n    if (name === 'progress') {\n      const mergeProgress = window.ModeAtlasProgress?.mergeStates;\n      const localState = localData.state || {};\n      const remoteState = remoteData.state || {};\n      const mergedState = typeof mergeProgress === 'function' ? mergeProgress(localState, remoteState) : remoteState;\n      const localSig = JSON.stringify(localState);\n      const remoteSig = JSON.stringify(remoteState);\n      const mergedSig = JSON.stringify(mergedState);\n      if (mergedSig !== localSig) {\n        applyRemote(name, { state: mergedState }, Math.max(localUpdatedAt, remoteUpdatedAt, Date.now()));\n      }\n      if (mergedSig !== remoteSig) localPreferred = true;\n      return;\n    }\n\n    if (localBaseline && localUpdatedAt > baselineUpdatedAt) {"""
text = one(text, merge_anchor, merge_block, 'progress CRDT merge')
text = one(
    text,
    "  wordBank: 'Word Bank'\n};",
    "  wordBank: 'Word Bank',\n  progress: 'Atlas Level'\n};",
    'progress cloud label'
)
write(path, text)


# Profile: progression replaces the old achievement-only summary card.
path = 'assets/ui/mode-atlas-profile-menu.js'
text = read(path)
old = '''          <section class="ma-card ma-card--soft ma-profile-card ma-achievement-card-summary" aria-label="Achievements">
            <div class="ma-profile-card-head">
              <div>
                <div class="ma-menu-kicker">Progress</div>
                <div class="ma-profile-card-title">Achievements</div>
              </div>
              ${icon(href,'achievement','ma-icon--lg')}
            </div>
            <div class="ma-achievement-summary"><strong id="profileAchievementCount">0</strong><span>unlocked milestones</span></div>
            <button class="ma-button ma-button--primary ma-button--wide" type="button" data-ma-achievements-open>${icon(href,'achievement')}<span>Open achievements</span></button>
          </section>'''
new = '''          <section class="ma-card ma-card--soft ma-profile-card ma-progression-card" aria-label="Atlas Level and learning activity">
            <div class="ma-profile-card-head">
              <div>
                <div class="ma-menu-kicker">Account progression</div>
                <div class="ma-profile-card-title">Atlas Level <span id="profileAtlasLevel">1</span></div>
              </div>
              ${icon(href,'achievement','ma-icon--lg')}
            </div>
            <div class="ma-level-xp-line">
              <strong id="profileAtlasXp">0 XP</strong>
              <span id="profileAtlasXpNext">0 / 100 XP</span>
            </div>
            <div class="ma-level-progress" role="progressbar" aria-label="Atlas Level progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="profileAtlasProgress">
              <span id="profileAtlasXpBar"></span>
            </div>
            <div class="ma-level-activity" aria-label="Learning activity">
              <div><span>Reading</span><strong id="profileReadingCorrect">0</strong><small>correct kana</small></div>
              <div><span>Writing</span><strong id="profileWritingCorrect">0</strong><small>correct kana</small></div>
            </div>
            <div class="ma-progression-footer">
              <div class="ma-achievement-summary"><strong id="profileAchievementCount">0</strong><span>achievements</span></div>
              <button class="ma-button ma-button--ghost ma-button--small" type="button" data-ma-achievements-open>${icon(href,'achievement')}<span>Achievements</span></button>
            </div>
          </section>'''
text = one(text, old, new, 'profile progression card')
write(path, text)


# Profile bindings consume progression; they do not calculate XP themselves.
path = 'assets/ui/mode-atlas-profile-drawer-bindings.js'
text = read(path)
anchor = """  function updateSyncStatus(){\n    const status = window.KanaCloudSync?.getSyncStatus?.() || { state:'local', tone:'neutral', text:'Progress saves on this device · sign in to sync', lastSync: Number(storageGet('modeAtlasLastCloudSyncAt', '0') || 0), user: null };"""
replacement = """  function updateProgressStatus(){\n    const summary = window.ModeAtlasProgress?.getSummary?.();\n    if (!summary) return;\n    const level = document.getElementById('profileAtlasLevel');\n    const xp = document.getElementById('profileAtlasXp');\n    const next = document.getElementById('profileAtlasXpNext');\n    const progress = document.getElementById('profileAtlasProgress');\n    const bar = document.getElementById('profileAtlasXpBar');\n    const reading = document.getElementById('profileReadingCorrect');\n    const writing = document.getElementById('profileWritingCorrect');\n    const percent = Math.max(0, Math.min(100, Math.round(Number(summary.progress || 0) * 100)));\n    if (level) level.textContent = String(summary.level || 1);\n    if (xp) xp.textContent = `${summary.xp || 0} XP`;\n    if (next) next.textContent = `${summary.levelXp || 0} / ${summary.levelRequirement || 100} XP`;\n    if (progress) progress.setAttribute('aria-valuenow', String(percent));\n    if (bar) bar.style.width = `${percent}%`;\n    if (reading) reading.textContent = String(summary.readingCorrect || 0);\n    if (writing) writing.textContent = String(summary.writingCorrect || 0);\n  }\n\n  function updateSyncStatus(){\n    const status = window.KanaCloudSync?.getSyncStatus?.() || { state:'local', tone:'neutral', text:'Progress saves on this device · sign in to sync', lastSync: Number(storageGet('modeAtlasLastCloudSyncAt', '0') || 0), user: null };"""
text = one(text, anchor, replacement, 'profile progress consumer')
text = one(
    text,
    "    updateProfileDot();\n    const ach = document.getElementById('profileAchievementCount');",
    "    updateProfileDot();\n    updateProgressStatus();\n    const ach = document.getElementById('profileAchievementCount');",
    'profile progress refresh'
)
text = one(
    text,
    "  window.addEventListener('online', updateSyncStatus);\n  window.addEventListener('offline', updateSyncStatus);",
    "  window.addEventListener('modeAtlasProgressChanged', updateProgressStatus);\n  window.addEventListener('modeAtlasCloudDataChanged', (event) => {\n    const sections = Array.isArray(event.detail?.sections) ? event.detail.sections : [];\n    if (!sections.length || sections.includes('progress')) updateProgressStatus();\n  });\n  window.addEventListener('online', updateSyncStatus);\n  window.addEventListener('offline', updateSyncStatus);",
    'profile progress listeners'
)
write(path, text)


# Profile presentation
path = 'assets/css/mode-atlas-profile-settings.css'
text = read(path)
css_anchor = ".ma-achievement-summary span{color:var(--ma-muted);font-size:13px;font-weight:800;}\n"
css_add = css_anchor + r'''
.ma-progression-card{--ma-card-bg:linear-gradient(145deg,color-mix(in srgb,var(--ma-results) 8%,var(--ma-surface-soft)),var(--ma-surface-soft));}
.ma-progression-card .ma-profile-card-title span{color:var(--ma-results);}
.ma-level-xp-line{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:2px 0 9px;}
.ma-level-xp-line strong{font-size:1.45rem;line-height:1;color:var(--ma-text-strong);}
.ma-level-xp-line span{font-size:12px;font-weight:800;color:var(--ma-muted);}
.ma-level-progress{height:8px;overflow:hidden;border-radius:999px;background:var(--ma-surface-inset);border:1px solid var(--ma-border);}
.ma-level-progress>span{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--ma-results),color-mix(in srgb,var(--ma-results) 62%,var(--ma-writing)));transition:width var(--ma-motion-medium) ease;}
.ma-level-activity{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;}
.ma-level-activity>div{display:grid;grid-template-columns:1fr auto;align-items:baseline;gap:2px 10px;padding:10px 12px;border-radius:var(--ma-radius-md);background:var(--ma-surface-inset);border:1px solid var(--ma-border);}
.ma-level-activity span{font-size:12px;font-weight:800;color:var(--ma-muted);}
.ma-level-activity strong{grid-row:1 / span 2;grid-column:2;font-size:1.25rem;color:var(--ma-text-strong);}
.ma-level-activity small{font-size:10px;color:var(--ma-muted);}
.ma-progression-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid var(--ma-border);}
.ma-progression-footer .ma-achievement-summary{margin:0;}
.ma-progression-footer .ma-achievement-summary strong{font-size:1.35rem;}
'''
text = one(text, css_anchor, css_add, 'progress profile CSS')
write(path, text)


# Correct kana award one XP each; combo questions award for each correctly recalled kana.
for mode, path in [('reading', 'assets/pages/mode-atlas-default-page.js'), ('writing', 'assets/pages/mode-atlas-reverse-page.js')]:
    text = read(path)
    old = "    window.ModeAtlasTrainerControls?.recordPresetCorrect?.(1);\n    sessionStats.timings.push(timeTaken);"
    new = f"    window.ModeAtlasTrainerControls?.recordPresetCorrect?.(1);\n    window.ModeAtlasProgress?.award?.('kana.{mode}.correct', Math.max(1, currentChar.length));\n    sessionStats.timings.push(timeTaken);"
    text = one(text, old, new, f'{mode} correct progression award')
    daily_old = "    if (!existing) {\n        dailyChallengeHistory[dateKey] = {"
    daily_new = f"    if (!existing) {{\n        window.ModeAtlasProgress?.awardOnce?.('kana.{mode}.dailyComplete', dateKey);\n        dailyChallengeHistory[dateKey] = {{"
    text = one(text, daily_old, daily_new, f'{mode} daily progression award')
    write(path, text)


# Formal Test Mode completion bonus is owned by the shared trainer core.
path = 'assets/trainer/mode-atlas-trainer-core.js'
text = read(path)
old = """    if (typeof cfg.persistResults === \"function\") cfg.persistResults(list);\n    else persistTestResults(mode, list);\n    return result;"""
new = """    if (typeof cfg.persistResults === \"function\") cfg.persistResults(list);\n    else persistTestResults(mode, list);\n    window.ModeAtlasProgress?.awardOnce?.(`kana.${mode}.testComplete`, result.id);\n    return result;"""
text = one(text, old, new, 'formal test progression award')
write(path, text)


# Regression contract
path = 'tests/frontend.test.js'
text = read(path)
contract = r'''

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
  assert.doesNotMatch(storage.match(/const APP_BACKUP_EXACT[\s\S]*?\];/)?.[0] || '', /modeAtlasProgressDeviceId/,
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
'''
if "test('2.41 Atlas Level uses one mergeable semantic progression owner" not in text:
    text += contract
write(path, text)

print('Applied Mode Atlas 2.41.0 source changes')
