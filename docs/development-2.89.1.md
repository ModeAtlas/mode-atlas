# Mode Atlas 2.89.1

Public version **2.89.1**, iOS build **2080011**. Development branch:
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Correction

The installed iOS app's native router had a separate allowlist containing only
the older pages. Learn, Progress and Friends therefore received the homepage
from Capacitor's single-page fallback, at a nested URL where its relative scripts
and styles could not load. This caused the unstyled links and oversized Settings
icon reported after installing 2.89.0.

`ModeAtlasRouter.swift` now resolves clean document URLs from the actual bundled
`index.html` files. It retains Capacitor's existing handling for assets and unknown
routes. No native page allowlist remains. The bridge uses this one route owner.

The previous browser tests served pages through an HTTP server and did not execute
the native router; successful compilation also did not verify document delivery.
The native release gate now compiles the production Swift router with the installed
SDK's real routing source and checks every bundled page, its script/style paths,
future nested pages and fallback behavior. The same checks run against the final
Release archive. Project synchronization installs the new source reference even
when restoring the Mac's locally signed Xcode project.

## Firebase

No additional Firebase deployment or configuration is required if the 2.89.0
backend has already been deployed. This patch does not change account data, XP,
goals or notification policy. When upgrading from an earlier backend, follow the
Firebase deployment instructions in [2.89.0](development-2.89.0.md) first.

## Update the working Mac checkout

Close Xcode. Keep the working manual Debug profile **Mode Atlas Development** and
ignored `ios/signing.local.xcconfig` / `ios/widget-sharing.local.xcconfig` files.

```sh
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.89.1-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.89.1" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.89.1' &&
npm ci &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Keep the stash and backup folder. Do not restore the old `Package.resolved`.
The sync step applies the new native route source and **2.89.1 / 2080011** while
retaining personal signing settings. If using the ZIP, copy the two ignored local
configuration files from the working checkout, run dependency/sync commands and
select the working manual Debug profile.

Run the app on the phone and switch between Atlas, Learn, Progress and Friends.
Confirm their normal styling and bottom navigation, then open Reading and return
to Progress. No reinstall, data reset or sign-out is necessary.

## Release verification

The handoff includes the exact development commit and matching source ZIP after
the shared/browser, Firebase emulator and native release gates pass. Native CI
uses Xcode 26.3; the signed physical-device check remains on the user's Xcode 27.
This does not publish main, deploy Firebase or upload to TestFlight.
