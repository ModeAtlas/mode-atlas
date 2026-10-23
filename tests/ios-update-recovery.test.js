'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const plist = require('plist');
const recovery = require('../recover_ios_update.cjs');
const { PROJECT, INFO, parseProject, planFile, recover } = recovery;
const ROOT = path.resolve(__dirname, '..');
const project = fs.readFileSync(path.join(ROOT, PROJECT), 'utf8');
const info = fs.readFileSync(path.join(ROOT, INFO), 'utf8');
const releaseVersion = require('../package.json').version;
const versionSetting = `MARKETING_VERSION = ${releaseVersion};`;
const native = ['504EC3171FED79650016851F', '504EC3181FED79650016851F', 'B38642B646D48B23282596E8', '455E08ACD953DDD9D26784DF'];

function localProject(source) {
  return source.replaceAll(versionSetting, 'DEVELOPMENT_TEAM = LOCAL12345;\n                MARKETING_VERSION = 2.121.0;')
    .replaceAll('TARGETED_DEVICE_FAMILY = "1,2";', 'TARGETED_DEVICE_FAMILY = 1;');
}
function xml(values) { return plist.build(values) + '\n'; }
function git(root, ...args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function write(root, file, value) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), value); }

test('project recovery preserves signing, all UUID references and current release metadata', () => {
  const base = project.replaceAll(versionSetting, 'MARKETING_VERSION = 3.0.3;');
  const local = localProject(project);
  const result = parseProject(planFile(PROJECT, [base, project, local]).output);
  for (const id of native) {
    const settings = result.project.objects.XCBuildConfiguration[id].buildSettings;
    assert.equal(settings.DEVELOPMENT_TEAM, 'LOCAL12345');
    assert.equal(settings.MARKETING_VERSION, releaseVersion);
    assert.equal(settings.TARGETED_DEVICE_FAMILY, '"1,2"');
  }
  const expected = parseProject(project);
  for (const section of ['PBXBuildFile', 'PBXFileReference', 'PBXSourcesBuildPhase', 'PBXGroup']) {
    assert.deepEqual(result.project.objects[section], expected.project.objects[section]);
  }
  assert.ok(result.project.objects.PBXGroup.C7700313516F038757BAEF16.children.includes('269100000000000000000002'));
});

test('release-owned nested values remain current even when only the local side changed', () => {
  const result = planFile(PROJECT, [project, project, localProject(project)]);
  for (const id of native) assert.equal(parseProject(result.output).project.objects.XCBuildConfiguration[id].buildSettings.MARKETING_VERSION, releaseVersion);
});

test('plist merge preserves custom local fields and canonical Duo scenes and orientations', () => {
  const upstream = plist.parse(info);
  const base = { ...upstream, CFBundleVersion: '1' };
  const local = { ...base, CFBundleVersion: '77', LocalLabel: 'My Mac', UIRequiresFullScreen: true, UIApplicationSceneManifest: {}, UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'] };
  const merged = plist.parse(planFile(INFO, [xml(base), info, xml(local)]).output);
  assert.equal(merged.LocalLabel, 'My Mac');
  assert.equal(merged.CFBundleVersion, '$(CURRENT_PROJECT_VERSION)');
  assert.deepEqual(merged.UIApplicationSceneManifest, upstream.UIApplicationSceneManifest);
  assert.deepEqual(merged.UISupportedInterfaceOrientations, upstream.UISupportedInterfaceOrientations);
  assert.equal(Object.hasOwn(merged, 'UIRequiresFullScreen'), false);
});

test('unknown conflicting values are reported without choosing either setting', () => {
  assert.throws(() => planFile(INFO, [xml({ Name: 'base' }), xml({ Name: 'release' }), xml({ Name: 'local' })]), /Name[\s\S]*No files changed/);
});

test('unchanged native files retain their exact bytes and plist scalar types survive', () => {
  assert.equal(planFile(PROJECT, [project, project, project]).output, project);
  const source = xml({ Enabled: true, Count: 3, Date: new Date('2026-01-01T00:00:00Z') });
  assert.equal(planFile(INFO, [source, source, source]).output, source);
});

function fixture(t, { unknown = false, style = 'merge' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mode-atlas-recovery-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q'); git(root, 'config', 'user.name', 'Recovery Test'); git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'merge.conflictStyle', style);
  write(root, '.gitignore', '.build/\nnode_modules/\n*.local.xcconfig\nxcuserdata/\n');
  write(root, PROJECT, project.replaceAll(versionSetting, 'MARKETING_VERSION = 3.0.3;'));
  const baseInfo = { ...plist.parse(info), CFBundleVersion: '1', LocalLabel: 'base' };
  write(root, INFO, xml(baseInfo));
  const lock = 'ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved';
  write(root, lock, '{"version":2,"pins":[]}\n');
  git(root, 'add', '.'); git(root, 'commit', '-qm', 'base');
  const base = git(root, 'rev-parse', 'HEAD').trim();
  write(root, PROJECT, project);
  write(root, INFO, xml({ ...plist.parse(info), LocalLabel: unknown ? 'release' : 'base' }));
  git(root, 'add', '.'); git(root, 'commit', '-qm', 'release');
  const release = git(root, 'rev-parse', 'HEAD').trim();
  git(root, 'checkout', '-qb', 'local', base);
  write(root, PROJECT, localProject(project));
  write(root, INFO, xml({ ...baseInfo, CFBundleVersion: '77', LocalLabel: 'My Mac', UIRequiresFullScreen: true }));
  write(root, lock, '{"version":3,"pins":[]}\n'); git(root, 'add', lock);
  write(root, 'notes.txt', 'untracked user notes\n');
  const userState = 'ios/App/App.xcodeproj/project.xcworkspace/xcuserdata/user.xcuserdatad/UserInterfaceState.xcuserstate';
  write(root, userState, 'saved window and theme state\n');
  write(root, 'ios/signing.local.xcconfig', 'DEVELOPMENT_TEAM = LOCAL12345\n');
  git(root, 'stash', 'push', '--include-untracked', '-m', 'Before Mode Atlas update');
  const stash = git(root, 'rev-parse', 'refs/stash').trim();
  git(root, 'checkout', '-qb', 'update', release);
  const apply = spawnSync('git', ['stash', 'apply', '--index', stash], { cwd: root, encoding: 'utf8' });
  assert.notEqual(apply.status, 0);
  assert.deepEqual(git(root, 'diff', '--name-only', '--diff-filter=U').trim().split('\n').sort(), [PROJECT, INFO].sort());
  return { root, lock, stash, userState, release };
}

for (const style of ['merge', 'diff3', 'zdiff3']) test(`real stash conflict (${style}) preserves user state, notes, staged package lock and stash`, t => {
  const { root, lock, stash, userState, release } = fixture(t, { style });
  const originalIndex = fs.readFileSync(path.join(root, '.git/index'));
  assert.equal(recover(root).planned.length, 2);
  assert.deepEqual(fs.readFileSync(path.join(root, '.git/index')), originalIndex, 'dry run leaves index untouched');
  const result = recover(root, true);
  assert.equal(result.changed.length, 2);
  assert.equal(git(root, 'diff', '--name-only', '--diff-filter=U'), '');
  assert.equal(git(root, 'rev-parse', 'refs/stash').trim(), stash);
  assert.equal(git(root, 'rev-parse', 'HEAD').trim(), release);
  assert.equal(git(root, 'show', ':' + lock), '{"version":3,"pins":[]}\n');
  assert.equal(fs.readFileSync(path.join(root, 'notes.txt'), 'utf8'), 'untracked user notes\n');
  assert.equal(fs.readFileSync(path.join(root, userState), 'utf8'), 'saved window and theme state\n');
  assert.equal(fs.readFileSync(path.join(root, 'ios/signing.local.xcconfig'), 'utf8'), 'DEVELOPMENT_TEAM = LOCAL12345\n');
  assert.equal(plist.parse(fs.readFileSync(path.join(root, INFO), 'utf8')).LocalLabel, 'My Mac');
  if (process.platform === 'darwin') {
    for (const file of [PROJECT, INFO]) execFileSync('/usr/bin/plutil', ['-lint', path.join(root, file)], { stdio: 'pipe' });
  }
  assert.ok(fs.existsSync(path.join(result.backup, PROJECT, 'local')));
  assert.equal(recover(root, true).changed.length, 0, 'repeat is a no-op');
});

test('unknown plist conflict leaves BOTH native files and the index unchanged', t => {
  const { root } = fixture(t, { unknown: true });
  const paths = [PROJECT, INFO, '.git/index'];
  const before = paths.map(file => fs.readFileSync(path.join(root, file)));
  assert.throws(() => recover(root, true), /LocalLabel[\s\S]*No files changed/);
  paths.forEach((file, i) => assert.deepEqual(fs.readFileSync(path.join(root, file)), before[i]));
});

test('manual edits after a conflict are not overwritten', t => {
  const { root } = fixture(t);
  fs.appendFileSync(path.join(root, PROJECT), '\n// user edit after the conflict\n');
  const before = fs.readFileSync(path.join(root, PROJECT));
  assert.throws(() => recover(root, true), /changed after Git created the conflict/);
  assert.deepEqual(fs.readFileSync(path.join(root, PROJECT)), before);
});

test('an existing Git index lock stops recovery before either native file is written', t => {
  const { root } = fixture(t);
  write(root, '.git/index.lock', 'another Git operation');
  const before = [PROJECT, INFO, '.git/index'].map(file => fs.readFileSync(path.join(root, file)));
  assert.throws(() => recover(root, true), /index lock/);
  [PROJECT, INFO, '.git/index'].forEach((file, i) => assert.deepEqual(fs.readFileSync(path.join(root, file)), before[i]));
  assert.equal(fs.readFileSync(path.join(root, '.git/index.lock'), 'utf8'), 'another Git operation');
});

test('bootstrap can run outside the checkout and a helper-only fast-forward keeps recovered edits', t => {
  const { root, stash, lock } = fixture(t);
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  const helper = path.join(os.tmpdir(), 'recovery-helper-' + path.basename(root) + '.cjs');
  t.after(() => fs.rmSync(helper, { force: true }));
  fs.copyFileSync(path.join(ROOT, 'recover_ios_update.cjs'), helper);
  const result = spawnSync(process.execPath, [helper, '--apply'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  // A commit-tree update models fetching the repair without committing local edits.
  const parent = git(root, 'rev-parse', 'HEAD').trim();
  const tree = git(root, 'rev-parse', 'HEAD^{tree}').trim();
  const followup = execFileSync('git', ['commit-tree', tree, '-p', parent, '-m', 'handover correction'], { cwd: root, encoding: 'utf8' }).trim();
  git(root, 'merge', '--ff-only', followup);
  assert.equal(git(root, 'rev-parse', 'refs/stash').trim(), stash);
  assert.equal(git(root, 'show', ':' + lock), '{"version":3,"pins":[]}\n');
  assert.match(fs.readFileSync(path.join(root, PROJECT), 'utf8'), /DEVELOPMENT_TEAM = LOCAL12345;/);
});
