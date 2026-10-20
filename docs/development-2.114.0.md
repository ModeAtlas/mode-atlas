# Mode Atlas 2.114.0 — A collection worth building

Version 2.114.0 · iOS build 2080036 · 20 October 2026.

## Changes

- Friends profiles show account-wide XP, correct answers, streak, study days, daily and weekly goals, and completed daily challenges. Correct-answer totals now include Kanji. Achievement completion has its own summary.
- Kana and Kanji each show a strict mastered percentage against their full current curriculum. Separate coloured segments show Mastered, Confident and Building; Confident characters do not count as mastered. The small disclosure explains the denominator. Full learning stats remain restricted to accepted friends and the account owner.
- Achievements is a new collection layout shared by web and iOS, with a small Within reach selection, branch filters, Earned and All views, and direct rank selection. Five new Kanji achievement families cover introductions, readings, meanings, mastery and tests. Current study completion comprises 91 ranked milestones. Retired preset/cloud milestones and special rewards remain collectable history without inflating that percentage.
- All 31 current and historical achievement families have new vector badge artwork. Distinct illustrations and five rank frames replace the old glyph artwork. The collection, rank detail, friend achievement summary and session recap use the same artwork owner.
- Earned achievement ranks persist in progression state version 7, merge across devices and survive later changes to word counts or accuracy. Existing seen IDs and current qualifying evidence migrate without a burst of historic unlock toasts. This ledger awards no XP or currency and changes no wallet or item-access rule.
- Kana and Kanji display an animated level-up celebration at the end of a session. Multiple levels combine into one presentation; the recap follows and lists the achievements earned in that session. Resumed sessions retain their starting baseline. Reduced Motion removes the animation, and account changes discard pending presentations.
- Kanji assessments reuse their per-character evidence instead of recomputing both skills for each achievement field. The artwork is one small shared SVG sprite; no added image library or animation dependency.
- The separate logo download contains the current outlined SVG originals, transparent PNG exports, profile/app icons and font licences: 36 files in a 670 KiB ZIP.

## Ownership and review correction

2.113.0 changed achievement counters and tile spacing but retained the previous collection and rank presentation. Calling that a completed design review overstated the work. This release replaces that presentation and records design decisions and rendered states in [the review record](ui-review-2.114.0.md). A layout assertion alone is not evidence that a requested redesign is finished.

The achievement catalogue/evidence module is shared with Firebase profile projections. Its UI, artwork and persistence have separate owners. The backend projection version advances to 6; existing profiles refresh from their saved account data. No mastery thresholds, learning unlocks, auth/signing settings or shop prices change.

## Checks and release scope

Local source gates: 15 Python checks and 234 JavaScript tests. Browser regressions cover both recall directions, guided/daily/timed/test sessions, Kanji teaching and recall, resumed sessions, account changes, rank navigation, private profiles and large text. The PR records the final exact-commit website, full browser, Firebase emulator and native simulator/archive gate outcomes and timings. Local native layouts are bridge fixtures, not physical iPhone tests.

The enhanced profile statistics require the Functions deployment below. No new Firestore rule or index is required. Until that deployment, the client uses the existing account totals and Kana mastery rather than inventing unavailable Kanji or achievement values. Production deployment is not performed from this workspace.

## Mac update

Close Xcode. This command preserves your local signing files before updating the established development branch.

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.114.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.114.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.114.0' &&
npm ci &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Select App and your iPhone, press Cmd+R and confirm **2.114.0 / 2080036**.

Deploy the updated account-profile projection once from this checkout:

```bash
cd ~/mode-atlas &&
npm run social:install &&
npm run build:social &&
npm run social:deploy
```

On device, finish a session that crosses a level, inspect its achievement recap, open Achievements and a friend's profile, then confirm the broader totals after Functions is deployed.
