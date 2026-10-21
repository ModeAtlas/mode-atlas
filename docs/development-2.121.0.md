# Mode Atlas 2.121.0 — Widgets that keep up

iOS build **2080044**.

## Changes

- Fixed a snapshot-contract mismatch: account correct-answer totals included Kanji, while the widget validator required them to equal Kana Reading + Writing alone. This rejected the entire update, leaving stale streaks and goals on screen. Schema 7 carries Kanji counts and allows the progression owner to supply its actual goal pool. Older installed snapshots remain readable.
- Publish final progress when study finishes or the app backgrounds; flush pending native reloads before suspension. Account switching clears shared snapshots and avatar files before another account can publish. Signing out no longer permanently disables guest widget updates.
- Updated every Home Screen size with the Mode Atlas mark, current light/dark colours, clear streak/XP hierarchy and compact goal summaries. Medium and large widgets include the existing full avatar and pet. Added an extra-large iPad layout with a dedicated avatar panel beside daily/weekly goals and ranking.
- Lock Screen widgets retain their streak focus. Streaks, freeze protection, expired goals and rankings move at calendar boundaries, including daylight saving. Countdown and update text use minutes, never seconds.
- The avatar comes from the existing web renderer, not a separate native wardrobe. A bounded transparent PNG is cached in the App Group, replaced only when appearance changes and removed on account reset. It contains no login data, email, bio or private word-bank content. Invalid artwork cannot block progress updates.

## Ownership and performance

Progression owns XP, study days and goals; Shop owns protection and inventory; Avatar owns the account-bound character. Native engagement produces a small projection, the native bridge writes it, and WidgetKit presents it. No new Firebase reads or widget-specific account/session are introduced. Existing optional weekly ranking refreshes remain throttled. Active practice still batches the projection at 30-second intervals and publishes at completion/background; artwork is not re-rendered for every answer.

The snapshot byte limit is bounded at 16 KiB, with avatar PNGs stored separately (512 KiB maximum, at most 1024 × 1024). Only the current content-addressed avatar file is retained. Native project synchronization registers the shared source and brand catalogue so retaining local Xcode signing settings does not omit them.

## Checks and limits

- JavaScript release tests and Python generation/signing checks, including a real progression → JavaScript widget → Swift contract fixture containing both Kana and Kanji study.
- Browser tests for full avatar/pet rasterization, caching, appearance edits, delayed decoding after sign-out, native background publishing, saves and navigation.
- Native tests cover legacy snapshots, variable/personal goals, midnight and daylight-saving rollover, freezes, weekly expiry, bounded artwork storage and account cleanup.
- The release gate compiles the actual SwiftUI widget views and renders small, medium, large and extra-large layouts in light/dark at compact device sizes, then builds the iOS simulator app and archive. Native screenshots are workflow artifacts.

The app must open and receive the latest cloud save before study performed on another device can reach this device's widget. WidgetKit controls when reload requests appear; this release does not promise continuous background Firebase syncing. A physical iPhone/iPad check remains necessary for App Group provisioning, real Home/Lock Screen placement and OS-managed refresh/tint behaviour.

## Update

**No Firebase deployment is needed for this release.** Close Xcode, then run:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.121.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.121.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
test "$(node -p "require('./package.json').version")" = '2.121.0' &&
npm ci &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Choose **App**, select the device and press **Cmd+R**. Confirm **2.121.0 / 2080044**, open Progress once, finish a short Kana or Kanji session and return to the Home Screen. Check that the same study streak appears in the app and widget; also change the avatar and check the medium/large widget. Extra-large appears in the iPad widget picker. Existing widgets keep their configuration.

Allow roughly **5–10 minutes** for installation/sync and the device build, depending on caches and Mac speed. Actual CI/publication timings are reported in the handoff.
