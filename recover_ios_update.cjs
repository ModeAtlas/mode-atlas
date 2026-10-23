#!/usr/bin/env node
'use strict';

// Resolve the two native metadata files after a failed handover stash apply.
// Reuse Capacitor CLI's installed parsers; never replace a whole file with one side.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { isDeepStrictEqual: equal } = require('node:util');
const requireProject = createRequire(path.join(process.cwd(), 'package.json'));
const parser = requireProject('xcode/lib/parser/pbxproj');
const Writer = requireProject('xcode/lib/pbxWriter');
const plist = requireProject('plist');
const MISSING = Symbol('missing');
const PROJECT = 'ios/App/App.xcodeproj/project.pbxproj';
const INFO = 'ios/App/App/Info.plist';
const ALLOWED = new Set([PROJECT, INFO]);
const RELEASE_BUILD_KEYS = new Set(['MARKETING_VERSION', 'CURRENT_PROJECT_VERSION', 'TARGETED_DEVICE_FAMILY']);
const RELEASE_INFO_KEYS = new Set([
  'CFBundleShortVersionString', 'CFBundleVersion', 'UIApplicationSceneManifest',
  'UISupportedInterfaceOrientations', 'UISupportedInterfaceOrientations~ipad', 'UIRequiresFullScreen'
]);

function object(value) {
  return value !== MISSING && value !== null && typeof value === 'object'
    && [null, Object.prototype].includes(Object.getPrototypeOf(value));
}

// cordova-node-xcode treats unquoted, entirely numeric UUID references as JS
// numbers. Shield them before parsing so a 24-digit reference never loses digits.
function parseProject(source) {
  const prefix = 'MODE_ATLAS_NUMERIC_UUID_';
  if (source.includes(prefix)) throw new Error('Unexpected UUID placeholder in project; no files changed.');
  const parsed = parser.parse(source.replace(/\b([0-9]{24})\b/g, prefix + '$1'));
  function restore(value) {
    if (typeof value === 'string') return value.replaceAll(prefix, '');
    if (Array.isArray(value)) return value.map(restore);
    if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replaceAll(prefix, ''), restore(item)]));
    return value;
  }
  return restore(parsed);
}

function merge(base, upstream, local, trail, releaseOwned, conflicts, retainedRelease) {
  if (releaseOwned(trail)) {
    if (!equal(local, upstream)) retainedRelease.push(trail.join('.'));
    return upstream;
  }
  // Recurse even if one whole dictionary is unchanged: canonical release keys
  // nested inside it must not inherit a stale local version or phone-only layout.
  if (object(upstream) && object(local) && (object(base) || base === MISSING)) {
    const merged = {};
    for (const key of new Set([...Object.keys(upstream), ...Object.keys(local), ...Object.keys(base === MISSING ? {} : base)])) {
      const get = value => object(value) && Object.hasOwn(value, key) ? value[key] : MISSING;
      const value = merge(get(base), get(upstream), get(local), [...trail, key], releaseOwned, conflicts, retainedRelease);
      if (value !== MISSING) Object.defineProperty(merged, key, { value, enumerable: true, writable: true, configurable: true });
    }
    return merged;
  }
  if (equal(local, base) || equal(local, upstream)) return upstream;
  if (equal(upstream, base)) return local;
  // Display comments do not control native behavior. Keep the release comment
  // if both sides changed its wording; all actual settings use strict merging.
  if (trail.at(-1)?.endsWith('_comment') || trail.at(-1) === 'headComment') return upstream;
  conflicts.push(trail.join('.'));
  return upstream;
}

function planFile(file, versions) {
  const parse = file === PROJECT ? parseProject : value => plist.parse(value);
  const [base, upstream, local] = versions.map(parse);
  const conflicts = [], retainedRelease = [];
  const releaseOwned = file === PROJECT
    ? trail => trail.at(-2) === 'buildSettings' && RELEASE_BUILD_KEYS.has(trail.at(-1))
    : trail => trail.length === 1 && RELEASE_INFO_KEYS.has(trail[0]);
  const merged = merge(base, upstream, local, [], releaseOwned, conflicts, retainedRelease);
  if (conflicts.length) throw new Error(`${file}: settings changed differently on both sides:\n  ${conflicts.join('\n  ')}\nNo files changed. The stash is retained; these settings need an explicit resolution.`);
  // Preserve the release's exact formatting whenever no local settings survive.
  const output = equal(merged, upstream) ? versions[1]
    : file === PROJECT ? new Writer(merged).writeSync() : plist.build(merged) + '\n';
  if (!equal(parse(output), merged)) throw new Error(`${file}: serialization changed settings; no files changed.`);
  return { file, output, retainedRelease };
}

function git(root, args, options = {}) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

function unchangedConflict(root, versions, working) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mode-atlas-conflict-'));
  const normalize = text => text.replace(/^(<{7}|\|{7}|={7}|>{7})[^\n]*$/gm, '$1');
  try {
    const inputs = ['base', 'upstream', 'local'].map((name, i) => {
      const file = path.join(directory, name);
      fs.writeFileSync(file, versions[i], { mode: 0o600 });
      return file;
    });
    for (const style of ['merge', 'diff3', 'zdiff3']) {
      let output;
      try {
        output = git(root, ['-c', 'merge.conflictStyle=merge', 'merge-file', '-p', ...(style === 'merge' ? [] : ['--' + style]), inputs[1], inputs[0], inputs[2]]);
      } catch (error) {
        // merge-file returns the conflict count rather than zero for this input.
        if (error.status > 0 && error.status < 128) output = error.stdout;
      }
      if (typeof output === 'string' && normalize(output) === normalize(working.toString())) return true;
    }
    return false;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function recover(root = process.cwd(), apply = false) {
  root = git(root, ['rev-parse', '--show-toplevel']).trim();
  const records = git(root, ['ls-files', '--unmerged', '-z']).split('\0').filter(Boolean);
  if (!records.length) return { changed: [], message: 'No unresolved iOS update conflicts.' };
  for (const marker of ['MERGE_HEAD', 'rebase-merge', 'rebase-apply']) {
    if (fs.existsSync(path.resolve(root, git(root, ['rev-parse', '--git-path', marker]).trim()))) {
      throw new Error('This is a merge or rebase, not the handover stash conflict. No files changed.');
    }
  }
  const files = new Map();
  for (const record of records) {
    const [metadata, file] = record.split('\t');
    if (!ALLOWED.has(file)) throw new Error(`Unrecognised conflicted file: ${file}. No files changed.`);
    const [mode, sha, stage] = metadata.split(' ');
    if (mode !== '100644') throw new Error(`Unsupported file mode for ${file}. No files changed.`);
    if (!files.has(file)) files.set(file, {});
    files.get(file)[stage] = sha;
  }
  const indexPath = path.resolve(root, git(root, ['rev-parse', '--git-path', 'index']).trim());
  if (fs.existsSync(indexPath + '.lock')) throw new Error('Another Git operation holds the index lock. No files changed.');
  const originalIndex = fs.readFileSync(indexPath);
  const plans = [], originals = new Map(), stages = new Map();
  for (const [file, entries] of files) {
    if (!['1', '2', '3'].every(stage => entries[stage])) throw new Error(`Missing conflict ancestor for ${file}. No files changed.`);
    const target = path.join(root, file);
    if (!fs.lstatSync(target).isFile()) throw new Error(`Expected a regular file: ${file}. No files changed.`);
    const working = fs.readFileSync(target);
    if (!/^<<<<<<< /m.test(working.toString())) throw new Error(`${file} appears manually edited. No files changed; review it before staging.`);
    const versions = ['1', '2', '3'].map(stage => git(root, ['cat-file', 'blob', entries[stage]]));
    if (git(root, ['rev-parse', `HEAD:${file}`]).trim() !== entries['2']) throw new Error(`${file}: the update side is not HEAD. No files changed.`);
    if (!unchangedConflict(root, versions, working)) throw new Error(`${file} changed after Git created the conflict. No files changed; review the manual edits first.`);
    originals.set(file, working);
    stages.set(file, versions);
    plans.push(planFile(file, versions));
  }
  if (!apply) return { changed: [], planned: plans.map(plan => plan.file), message: 'Recovery validated. Run with --apply to save it.' };

  const backup = path.join(root, '.build', 'ios-update-recovery', new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid);
  fs.mkdirSync(backup, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(backup, 'index'), originalIndex, { mode: 0o600 });
  for (const [file, versions] of stages) {
    const directory = path.join(backup, file);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    ['base', 'release', 'local'].forEach((name, i) => fs.writeFileSync(path.join(directory, name), versions[i], { mode: 0o600 }));
    fs.writeFileSync(path.join(directory, 'conflicted'), originals.get(file), { mode: 0o600 });
  }
  // Refuse a concurrent Xcode/Git edit between planning and applying.
  if (fs.existsSync(indexPath + '.lock') || !fs.readFileSync(indexPath).equals(originalIndex) || [...originals].some(([file, data]) => !fs.readFileSync(path.join(root, file)).equals(data))) {
    throw new Error('Project changed during recovery. No files changed; quit Xcode and retry.');
  }
  const preparedIndex = path.join(backup, 'prepared-index');
  fs.writeFileSync(preparedIndex, originalIndex, { mode: 0o600 });
  const indexLock = indexPath + '.lock';
  let lock = fs.openSync(indexLock, 'wx', fs.statSync(indexPath).mode & 0o777);
  try {
    if (!fs.readFileSync(indexPath).equals(originalIndex)) throw new Error('Git index changed during recovery.');
    for (const plan of plans) fs.writeFileSync(path.join(root, plan.file), plan.output);
    git(root, ['add', '--', ...plans.map(plan => plan.file)], { env: { ...process.env, GIT_INDEX_FILE: preparedIndex } });
    if (plans.some(plan => fs.readFileSync(path.join(root, plan.file), 'utf8') !== plan.output)) throw new Error('Xcode edited a file during recovery.');
    fs.writeFileSync(lock, fs.readFileSync(preparedIndex));
    fs.closeSync(lock);
    lock = undefined;
    fs.renameSync(indexLock, indexPath);
  } catch (error) {
    // Never overwrite a concurrent manual edit or another Git process's index.
    for (const plan of plans) {
      if (fs.readFileSync(path.join(root, plan.file), 'utf8') === plan.output) fs.writeFileSync(path.join(root, plan.file), originals.get(plan.file));
    }
    if (lock !== undefined) fs.closeSync(lock);
    fs.unlinkSync(indexLock);
    throw new Error(`Recovery could not be saved; the Git index was not replaced. Backup: ${backup}\n${error.message}`);
  }
  return { changed: plans.map(plan => plan.file), backup,
    retainedRelease: plans.flatMap(plan => plan.retainedRelease),
    message: 'Recovered native metadata. Local settings, other staged files, ignored Xcode user data and the stash are retained.' };
}

module.exports = { parseProject, planFile, recover, PROJECT, INFO };
if (require.main === module) {
  try {
    if (process.argv.slice(2).some(arg => arg !== '--apply')) throw new Error('Usage: node recover_ios_update.cjs [--apply]');
    const result = recover(process.cwd(), process.argv.includes('--apply'));
    console.log(result.message);
    if (result.backup) console.log(`Backup: ${result.backup}`);
    if (result.changed.length) console.log(`Resolved: ${result.changed.join(', ')}`);
    if (result.retainedRelease?.length) console.log('Kept current release values for:\n  ' + result.retainedRelease.join('\n  '));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
