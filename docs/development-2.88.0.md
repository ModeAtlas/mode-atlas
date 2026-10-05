# Mode Atlas 2.88.0

Public version **2.88.0**, iOS build **2080009**. Development branch:
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Changes

- **Friends / Rankings first:** the switch is the first control in the Friends screen. The editable Friends profile appears only in Friends. Add friend, My code, request badges, list filters and moderation remain available there.
- **Weekly ladder up front:** opening Rankings initially shows This week. All time sits alongside it, with its existing friend-comparison metrics. Switching periods retains the selected all-time metric and weekly scope until the account screen is reopened. Existing weekly notification/recap links still open the ladder directly.
- **Compact weekly summary:** rank and weekly XP sit together, followed by one local reset time. Rules & prizes and Past results are collapsed side by side. Global and Friends are the only weekly scope controls. The repeated last-prize line and synced-data explanatory text are removed; prize receipts remain in Past results.
- **Shared implementation:** layout and behavior live in the existing social UI and stylesheet, using the current web/iOS tokens. No separate native component, storage migration, scoring change or new dependency.

Near me is removed from this client, including its target-gap copy. The deployed 2.87.0 API remains compatible with older installed clients; this release does not remove its server query or index.

## Firebase

**No new Firebase deployment is needed when the 2.87.0 backend is already deployed.**
Project `mode-atlus`, region `australia-southeast1`, existing Auth/APNs configuration and account data are unchanged. If upgrading from a backend older than 2.87.0, follow the Firebase update in [the previous handoff](development-2.87.0.md) before installing this app.

## Update the working Mac checkout

Close Xcode. Preserve the working **manual Debug profile `Mode Atlas Development`** and ignored `ios/signing.local.xcconfig` / `ios/widget-sharing.local.xcconfig` files.

```sh
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.88.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.88.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.88.0' &&
npm ci &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

The sync owner applies 2.88.0 / 2080009 while preserving local signing. Keep the stash and backup folder. Do not restore the old Package.resolved over the new package resolution. If using the ZIP, copy the two ignored local configuration files from the working checkout, run dependency/sync commands, and select the working manual Debug profile.

Confirm the version/build in Xcode before running on the phone. If package resolution succeeds but Xcode reports a stale Firebase module, use Product → Clean Build Folder and build again.

## Validation

Focused browser coverage checks Friends/profile placement, direct weekly entry, all-time metric retention, Global/Friends switching, opt-in/out, past finishes, delayed-response isolation and keyboard navigation. The shared layouts are checked at 320px and 393px phone widths, on desktop, in light/dark themes and with larger text. Screenshots are reviewed for the changed screens.

Run one consolidated `npm run release:check`, then the existing independent GitHub browser, Firebase and native gates for the final commit. No backend changes require a duplicate local emulator run. The native gate builds the simulator and unsigned Release archive with Xcode 26.3; the user’s signed iPhone run uses Xcode 27.0.

On the phone, check that Rankings opens the weekly ladder, Friends restores the editable profile, and both weekly scopes fit at the preferred text size. No production deployment, main-branch merge or TestFlight upload is part of this handoff.
