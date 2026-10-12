# Mode Atlas 2.92.0

Public version **2.92.0**, iOS build **2080014**. Development branch:
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Account shop and owned rewards

Open the avatar/account menu and choose **Shop**, alongside **Profile** and
**Settings**. Progress now has **Goals**, **Rewards** and **Recap**. The previous
Shop tab in Progress and the duplicate shop shortcut inside Profile are removed.
One account-navigation owner handles tabs, scrolling, focus and modal state.

The storefront uses larger Sakura and Midnight collection displays, their real
bundled app icons and frames, a compact Atlas Tokens wallet, and previews of the
actual banner/title/frame. It supports both appearances, small phones, tablets,
desktop, larger text and reduced motion. Existing shared reward styles remain
the authority for the real cosmetic appearance.

Browsing never equips an item. Owned collections say **In your Rewards**, and
**Open Rewards** takes the user to **Progress → Rewards** to choose the parts
they want to use. The shop footer also links directly to Rewards. The existing
server grant remains the only entitlement; unowned shop items stay hidden from
Rewards. Shop dialogs update if account access changes while they are open.
The hidden shop does not rerender for every learning-progress event.

Purchases and spending remain unavailable. Atlas Tokens, ownership rules and the
backend introduced in 2.91.0 are unchanged. Free learning, level rewards, XP,
streaks, rankings and saved progress are unchanged. No new native capabilities
or signing profiles are needed.

## Update

If the 2.91.0 backend is already deployed, this version requires **no Firebase
deployment**. If it is not deployed, complete the Firebase steps in
[2.91.0](development-2.91.0.md) before checking the shop wallet and shared premium
cosmetics.

Close Xcode. Preserve **Mode Atlas Development**, the ignored local signing and
widget configuration files, and the backup/stash made by these commands:

```sh
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.92.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.92.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.92.0' &&
npm ci &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Do not restore the old `Package.resolved`. Sync owns the native release metadata
and sources while preserving the signing team. For a ZIP checkout, copy the two
ignored local configuration files from the working checkout before syncing.

## Validation and device acceptance

Run the existing release gates for the exact commit: source checks, browser
polish/smoke, native shell, Firebase emulator, iOS simulator build and unsigned
Release archive. Updated journeys cover all three account tabs, keyboard and
popup focus, narrow and large-text layouts, previews without mutation, owned
items applied through Rewards, and navigation to Rewards from another page.
Inspect the changed shop screenshots before delivering the matching source ZIP.

Native CI uses Xcode 26.3. On the user's signed Xcode 27 build, confirm
**2.92.0 / 2080014**, open **Profile → Shop**, preview both collections and return
to the store. From an entitled account, follow **Open Rewards** and confirm
banner, title/frame and app-icon selection. Switching tabs and dismissing the
shop should return to the same underlying page.

No website publication, Firebase deployment or TestFlight upload is performed
by this development handoff.
