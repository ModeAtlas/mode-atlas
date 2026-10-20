# Mode Atlas 2.112.0 — Your path, your goals

Version 2.112.0 · iOS build 2080034 · 20 October 2026.

## Changes

- Kana’s inline path includes every row in the selected script and skill, grouped into Basics, Voiced, Joined and Extended sounds. The current group starts open. Earlier unlocked lessons can be revisited directly; progression gates remain enforced.
- Add one personal daily goal and one personal weekly goal from Progress. Choose new kana, combined mastery improvements, Kana/Kanji test accuracy or correct-answer targets. Repeat, edit and remove controls live in the goal editor; the main tour introduces the feature. Completed personal goals award 40 daily / 200 weekly XP, once per period.
- New kana means first reaching Familiar. Mastery improvements mean first reaching Confident, Mastered or Mastered+, counting each kana once per period. Test targets use the best finished unassisted score from a test with at least ten questions; Kanji uses Pronunciation or typed Meaning. Earlier undated learning is never fabricated as today’s progress.
- Confident is cyan, Mastered green and Mastered+ violet, consistently across the map, legend and skill detail. Labels remain visible alongside colour.
- Listen and Slower use clearly separated speech rates on native iOS and web. Native utterances explicitly use the selected playback setting. Perceived speech still requires an on-device listening check.
- Profile replaces the nested card stack with a compact banner identity, separate account actions, open progress rows and save status. Banner artwork no longer sits behind account controls. Readable actions remain consistent across collection themes.
- Progress navigation, Mastery Map and Achievement shortcuts have coordinated graphics. Due reviews use compact branch markers. Shared form-control typography now follows the app font, including achievement tiles.

## Ownership and data

Reward policy owns personal-goal templates and targets. Progress owns configuration, dated milestone evidence, completion and merge rules. Rewards UI owns the editor and rendering. Kana’s curriculum records milestone transitions; trainers keep owning answer receipts and test completion. No duplicate goal store, router, modal system or overlay stylesheet was added.

Progress schema 6 preserves existing XP/learning and lets the existing Firestore version rule block older clients from overwriting personal-goal settings. Last-write configuration and deletion tombstones converge across devices; milestone timestamps and period awards deduplicate. Personal goals appear in the existing widgets and notification projections. Widget snapshot schema 6 permits one personal goal per period and keeps older snapshots readable. Weekly prize settlement preserves these fields.

**Firebase Functions must be deployed for this release**, before relying on server reminders and weekly settlement. The command below includes that deployment. Update the clients you use together; older clients cannot overwrite a migrated schema-6 save.

## Review and checks

The three attached screenshots were reviewed directly. See [UI review coverage](ui-review-2.112.0.md) for the route and shared-menu inventory. Local browser checks cover real components with fixtures for account/cloud states; they are not physical iPhone testing. Final exact-commit CI counts, results and timings are recorded in the PR and release handoff.

The normal release gates remain required: source audit and logic tests, website smoke, browser polish, Firebase emulator/access/callable tests, native widget model/routing checks, simulator and archive builds. Tests cover repeat boundaries, one-off expiry, target validation, offline merges, deleted goals, duplicate rewards, test-score precision, existing-account migration, storage failure, old-client write rejection and native snapshot compatibility.

## Mac update

Close Xcode, then run:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.112.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.112.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.112.0' &&
npm ci &&
npm run social:install &&
npm run build:social &&
npm run social:deploy &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Select App and your iPhone, press Cmd+R, and confirm **2.112.0 / 2080034**. Listen to both speeds using a single kana and a longer Kanji reading on the physical device.
