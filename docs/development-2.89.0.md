# Mode Atlas 2.89.0

Public version **2.89.0**, iOS build **2080010**. Development branch:
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Changes

- **Stable destinations:** Atlas, Learn, Progress and Friends are directly reachable. Learn groups Kana and Word Bank with a recommended session. Kana retains page-level Reading, Writing and Results links. The iOS avatar opens only Profile and Settings; their existing focus, destructive-action confirmation and signing flows remain shared.
- **Full pages:** existing rewards, goals, recap and social owners mount on `/progress/` and `/friends/`. Old `?section=atlas` and `?section=friends&ranking=weekly` links redirect to the corresponding pages. Existing `yourAtlas` widget/notification/Shortcut identifiers remain valid and open Progress.
- **Suitable goals:** recorded kana variety and independent practice determine eligible templates. New late-week learners receive achievable study-day targets. A plan is fixed once assigned; changing presets or enabling hints does not rotate it. Started periods from the previous release retain their goals. Offline conflicts select the earliest plan deterministically, and each slot can contribute only one reward amount. Existing earned answer XP and the level curve are unchanged.
- **Alert time zone:** account alerts and quiet hours use the explicit zone shown in Settings. Reconnecting another device preserves it. “Use this device’s time zone” changes it deliberately. Each daily reminder stays device-local, and overlap checks compare zones. Review the displayed account zone when travelling.
- **Publication gate:** the reusable Pages workflow is called only after every release job succeeds on the exact main commit. Main publication and development validation stay separate.

## Firebase

**Deploy the updated backend before installing this release.** Project
`mode-atlus`, region `australia-southeast1`. The Functions update carries the
shared goal policy and notification time-zone handling; Auth, APNs, indexes and
security rules retain their existing configuration. No manual database migration
is required. Existing save schema/claim formats remain compatible; update web
and iOS clients together when promoting the release so both show the new goal
assignment and navigation.

## Update the working Mac checkout

Close Xcode. Preserve the working **manual Debug profile `Mode Atlas Development`** and ignored `ios/signing.local.xcconfig` / `ios/widget-sharing.local.xcconfig` files.

```sh
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.89.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.89.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.89.0' &&
npm ci &&
npm run social:install &&
npm run build:social &&
npm run social:deploy &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

The sync owner applies 2.89.0 / 2080010 while preserving local signing. Keep the stash and backup folder. Do not restore the old Package.resolved over the new package resolution. If using the ZIP, copy the two ignored local configuration files from the working checkout, run dependency/sync commands, and select the working manual Debug profile.

Confirm the version/build in Xcode before running on the phone. If package resolution succeeds but Xcode reports a stale Firebase module, use Product → Clean Build Folder and build again.

## Validation

The release gate covers source/audit checks, browser journeys, Firebase emulator
rules/callables, the simulator build and the unsigned Release archive. Focused
regressions cover goal suitability/rollover/migration/offline convergence, explicit
time-zone changes, device overlap, legacy links and the new full-page navigation.
Browser evidence covers 320/393px iOS layouts, desktop, light/dark themes and large
text. Existing auth, reward, social, tour and practice tests follow the new routes.

Run focused checks during iteration and one consolidated final release gate.
CI's native builds use Xcode 26.3; the signed device acceptance run remains on the
user's Xcode 27.0. On the phone, verify the four destinations, avatar and Settings,
goal shortcuts, notification zone display and a real reminder/push delivery.

The handoff provides the validated development commit and matching source ZIP.
It does not publish main, deploy production Firebase or upload to TestFlight.
