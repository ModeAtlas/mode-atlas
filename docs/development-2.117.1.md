# Mode Atlas 2.117.1 — Restore full-colour ranking banners

iOS build 2080040.

The 2.117.0 ranking artwork child used opacity .22 and a gradient mask, washing out owned banners. Ranking rows now use the existing banner scene directly, at full opacity and with the banner palette. Banner scenes still opt out of content-reservation padding, preserving the fixed narrow-column bug. The XP label gets a small solid surface using that palette; the artwork itself is not dimmed or masked. Removed the obsolete artwork-child markup and all three styling rules. No new network work or backend changes.

Validation includes the source gate, full Friends browser suite, full-colour banner assertions at 320/393/1280px, and visual review of Hunny, Skyline and the default theme. Final CI results are recorded in PR #46.

No Firebase deployment is required. Close Xcode, then update with:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.117.1-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.117.1" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
test "$(node -p "require('./package.json').version")" = '2.117.1' &&
npm ci &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Select App and your iPhone, press Cmd+R; confirm 2.117.1 / 2080040.
