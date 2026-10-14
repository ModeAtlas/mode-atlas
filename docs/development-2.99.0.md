# Mode Atlas 2.99.0

Public version **2.99.0**, iOS build **2080021**, on
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Changes

Friends no longer waits for reward refresh before showing the list. The initial
state response can include the selected first page, avoiding a second callable.
Identical in-flight reads share a request and remain bound to the account epoch;
private lists are not cached across sessions. Existing moderation, audience and
relationship checks still apply. The self banner is removed from the list and
**Edit name** now lives in **My code**.

Sign-out opens its confirmation immediately while any needed sync continues in
the background. It shows the last confirmed cloud-save time, explains device
clearing, and updates when the save is confirmed. **Keep studying** preserves the
local save. Late results cannot change a subsequent dialog. The profile shows
clear saving, queued, offline, slow-connection and retry states; cached or missing
cloud documents no longer advance the confirmed-save time. Profile actions use
one compact row, including native sign-in methods.

The profile Shop is a short selection of featured items with a pinned wallet,
**Buy 500 coins** and **See full shop**. The full shop has Featured, Wardrobe,
Theme packs, Streak items and Atlas Coins categories, plus wardrobe filters.
Both surfaces share the catalogue, wallet, offers and purchase owner, preserving
ownership, rotation and exclusive audiences. Coin packs are 500, 1,200, 2,500 and
6,000. Their buttons show the existing coming-soon prompt; real-money prices and
transactions remain unset. Existing coin spending is unchanged. No developer
status notices are placed in the storefront.

## Validation and release boundary

Local checks cover **180 JavaScript and 15 Python tests**, build/asset audits,
38 targeted browser cases across the new account/shop work and existing social,
profile, purchase and theme regressions, and the Firebase direct-service suite.
The browser coverage includes immediate sign-out during a stalled sync, live save
confirmation, cancelled-dialog isolation, three compact iOS profile actions,
320/393/820-pixel native layouts, desktop layout, large text, pinned navigation,
category persistence and private-offer hiding. Visual captures were reviewed.

The [GitHub release gate](https://github.com/ModeAtlas/mode-atlas/actions/workflows/release-check.yml)
is the authority for the exact commit's full browser, callable/rules/trigger,
Swift, iPhone/iPad simulator and unsigned archive results. Do not count results
from an earlier version. CI uses Xcode 26.3; a physical Xcode 27/iOS 27 check remains
necessary. Production network latency was not measured; this release removes the
observed unnecessary waits rather than promising a fixed load time.

Deploy the backend before installing the client to enable the combined Friends
response. No new Firebase index, Apple capability or provisioning profile is
needed. Existing security findings in the 2.98.0 review remain documented and
are not changed by this UI/performance release. The agent publishes the authorized
development branch and source, without merging main, deploying Firebase,
publishing the website or uploading TestFlight.

## Physical-device checks

- Open Friends on a normal and weak connection; check Friends, requests and blocked
  lists, then confirm My code can edit the shared username.
- Study offline, open Profile and verify local-save wording plus the last confirmed
  cloud-save time. Reconnect and confirm the status updates.
- Tap Sign out during a slow sync. The prompt should appear immediately; cancelling
  keeps progress. After a confirmed save, sign out and check the clean guest state.
- Check the compact profile controls on iPhone, including Sign-in methods.
- Browse the shop categories, purchase an affordable item with existing coins,
  check Rewards ownership, and verify the coin prompt does not charge money.

## Mac update

After the release gate passes for this commit, close Xcode and run:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.99.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.99.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.99.0' &&
npm ci &&
npm run social:install &&
npm run build:social &&
npm run social:deploy &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

The named backup and stash preserve manual **Mode Atlas Development** signing
choices, alongside ignored local signing/widget configuration. Packages resolve
freshly; the old Package.resolved is backed up but not restored. Select App and
your iPhone, press Cmd+R, and verify **2.99.0 / 2080021**.
