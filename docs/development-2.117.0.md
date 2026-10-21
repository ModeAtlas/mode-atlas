# Mode Atlas 2.117.0 — Friends composition and practice choices

iOS build 2080039.

## Changes and ownership

- Friend cards distinguish full-body characters (left) from circular profile photos (centred). The banner scene owns both positions. Status phrases appear in a two-line speech bubble inside the scene; long text is available in the full profile. Identity and title truncate within a consistent card footprint.
- Ranking rows have a separate decorative banner child. Hunny's artwork spacing and palette no longer constrain the identity column. On phones the weekly leaders are full-width rows; desktop keeps three equal-height leader cards. Real ranks, ties, profile actions and pagination remain unchanged.
- Banner scenes opt out of generic content-reservation padding at the original banner rule. No duplicate banner stylesheet or selector workaround was added.
- Kana practice presents Read, Recall, Read + Recall and Handwriting in one matching selector: two columns on phones, four on desktop. Handwriting uses the existing branch and row selection. The ambiguous practice icon is replaced with a play/plus symbol for starting or continuing a set.

## Performance requirements for subsequent releases

Preserve the 2.116 Friends ownership: save triggers own progress projection; ordinary state reads must not load private history; Back and list tabs reuse their short-lived account-bound snapshot. Refresh, relationship mutations and account changes invalidate it. Cosmetic rendering must not introduce new network calls or wait on rewards. Keep the backend private-history-read regression and browser list-reuse/account-change cases in the release gate. Do not trade privacy or stale-account protection for caching.

## Verification

Source audit and 15 Python / 239 JavaScript checks passed locally. Visual regressions cover 320/393/1280px, long phrases, centred photos, left-aligned characters, Hunny/Skyline banners, three weekly leaders and all four practice choices. Final browser and native CI outcomes are recorded in the PR.

## Update

This is a presentation-only release: no Firebase functions/rules deployment is needed. Close Xcode, then run the combined update below. Existing local signing is preserved. The website updates after merging the release PR.

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.117.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.117.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
test "$(node -p "require('./package.json').version")" = '2.117.0' &&
npm ci &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Select App and your iPhone, press Cmd+R, and confirm 2.117.0 / 2080039.
