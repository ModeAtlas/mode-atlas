# Mode Atlas 2.90.0

Public version **2.90.0**, iOS build **2080012**. Development branch:
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Learn page

The previous Learn screen reintroduced the nested card layout that had already
been removed elsewhere. This release replaces its composition at the owning
page renderer and stylesheet:

- One open suggested-session area, with concise metadata, kana artwork and a clear Start action.
- Reading, Writing and Results as whole-row links separated by fine rules.
- A small Kana Overview link and a direct Word Bank row.
- A shorter header and one collapsed disclosure for planned branches.
- Existing Reading green, Writing blue, shared icons and light/dark themes.

The shared recommendation policy, saved learning state and destination URLs stay
in their existing owners. The layout adapts to phone, tablet and desktop widths;
larger text wraps and scrolls naturally. Progress, Friends and the persistent
four-tab navigation retain their current composition.

Design references reviewed: [Headspace's app overview](https://www.headspace.com/app),
[Bunpo's app listing](https://apps.apple.com/au/app/bunpo-language-learning/id1279720052)
and [Apple's lists and tables guidance](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables).
The applied direction is Mode Atlas's own interpretation: an obvious next session
followed by straightforward practice choices, using open space and typography.

## Firebase and signing

No additional Firebase deployment is required if the 2.89.0 backend has already
been deployed. No new capabilities, provisioning profiles or account migration.
Keep the working manual Debug profile **Mode Atlas Development** and ignored
`ios/signing.local.xcconfig` / `ios/widget-sharing.local.xcconfig` files.

## Update the Mac checkout

Close Xcode, then run:

```sh
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.90.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.90.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.90.0' &&
npm ci &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Keep the stash and backup folder. Do not restore the old `Package.resolved`.
The sync owner applies **2.90.0 / 2080012** and the native routing source while
preserving local signing. For a ZIP checkout, copy the two ignored local
configuration files from the working checkout before syncing and select the
working manual Debug profile.

Confirm the version/build in Xcode. On the phone, check Learn in your preferred
theme, open a suggested session, use each practice row and open Word Bank. Also
check your usual text size.

## Validation and delivery

Existing release gates cover shared/source checks, Firebase emulator tests,
browser journeys, native document routing, the simulator build and unsigned
Release archive. The Learn journeys cover a narrow light phone, dark iPhone,
light tablet, desktop and larger text. Review screenshots from the exact release
commit before delivering the matching source ZIP.

Native CI uses Xcode 26.3; signed physical-device acceptance remains on the user's
Xcode 27. This development handoff does not publish main, deploy Firebase or
upload to TestFlight.
