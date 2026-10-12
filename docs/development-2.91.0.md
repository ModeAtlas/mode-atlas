# Mode Atlas 2.91.0

Public version **2.91.0**, iOS build **2080013**. Development branch:
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Study routine widgets

Lock Screen widgets now show the app-wide study streak. The rectangular widget
also shows daily goal completion. An active streak that needs study displays a
live countdown to local midnight; a completed study day says **Safe for today**.
No streak says **Start with 5 correct**, and older snapshots without study-day
data ask the user to open the app. Answer streaks are never substituted.

Home Screen widgets prioritise the streak and daily/weekly goals. The large size
lists the current tasks, with level kept as quiet secondary information. All
sizes use the existing shared snapshot and progression owner. Calendar-based
deadlines handle 23-hour and 25-hour daylight-saving days. The timeline contains
both rollover and actual expiry so it can stop displaying a stale streak even
if the next background refresh is delayed. Open the app once after installing
to publish a fresh snapshot.

## Progress review help

An information button beside **Spaced reviews** opens the existing accessible
dialog. It explains due kana, separate Reading/Writing schedules, and the
difference between a suggested review and a deadline. Counts refresh from the
canonical review owner after local or cloud changes. This changes presentation,
not scheduling, mastery or XP policy.

## Optional shop

Open **Progress → Shop**, or **Profile → Shop · optional looks**. Sakura and
Midnight each include a profile banner, title/frame and a bundled iOS app icon.
Previews do not change the account. Users with a server-issued grant can apply
the banner/frame and choose the app icon on iOS. Admin retains access to all
custom looks through the existing account entitlement policy.

All current learning, spaced reviews, Word Bank, progress, goals and social
features remain free. Existing level rewards remain earnable. Shop grants do
not award collection achievements or XP; money cannot affect streaks or rankings.
No subscriptions, learning limits or premium learning tools are introduced.

**Purchases are unavailable in this release.** The catalogue records stable
product IDs, cosmetic references, direct/token payment options and a separate
non-expiring currency, **Atlas Tokens**. Prices and token packs are deliberately
unconfigured. The UI never displays an invented cash price, opens a payment
sheet, credits tokens or spends a balance.

The shared Firebase callable accepts a read-only `shop` action for the verified
signed-in account, independent of Friends enrolment. `commerceAccounts/{uid}`
is private to the server and holds `{version:1,currency:'atlas-tokens',balance}`.
An absent wallet reads as zero; invalid records fail closed. Wallet responses
are kept only in account-bound memory, cleared on account changes, and hidden
when offline or unavailable. Client progress imports cannot change the balance.
Social opt-out preserves it; account deletion recursively removes it and any
nested transaction records. Existing `rewardEntitlements` remain the single
authority for cosmetic grants.

Before enabling purchases, implement StoreKit product loading and verified
transactions, idempotent server receipts and atomic token debits/grants,
restoration for restorable products, refund/revocation handling, and StoreKit
sandbox/TestFlight acceptance. Store prices must come from the storefront.
Purchased tokens must not expire. The current server exposes no transaction
mutation, so flipping a client flag cannot enable spending. This development
preview is not a completed App Store purchasing integration.

References reviewed: [Apple In-App Purchase](https://developer.apple.com/in-app-purchase/),
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
and [SwiftUI timer text](https://developer.apple.com/documentation/swiftui/text/init(timerinterval:pausetime:countsdown:showshours:)).

## Firebase, signing and update

Deploy the updated social backend for shop wallet reads and premium cosmetic
grants in shared profiles. No new Apple capability or provisioning profile is
required. Keep **Mode Atlas Development** and the ignored local signing/widget
configuration files. Close Xcode, then run:

```sh
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.91.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.91.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.91.0' &&
npm ci &&
npm run social:install &&
npm run build:social &&
npm run social:deploy &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Keep the backup and stash; do not restore the old `Package.resolved`. Sync owns
the native version, sources and alternate-icon catalogue and reapplies them
without changing your signing team. For a ZIP checkout, copy the two ignored
local configuration files from the working checkout before syncing.

## Validation and device acceptance

Release gates cover source checks, shared/browser journeys, Firebase callable
and security-rule tests, native snapshot/calendar tests, the iOS simulator build
and unsigned archive. Added checks cover account-switch wallet races, direct
write denial, cosmetic grants and revocation, deletion, and no paid XP benefit.
Shop previews and review-help dialogs are checked at narrow-phone, iPhone and
desktop widths, including larger text. Native icon metadata is checked against
the reward catalogue rather than a second hard-coded list.

Review screenshots from the release commit before delivering the matching ZIP.
Native CI uses Xcode 26.3. Signed device acceptance remains on the user's Xcode
27: confirm 2.91.0 / 2080013, open the app to refresh widgets, check each installed
widget size, tap the due-review information button, preview both shop looks, and
test banner/frame and icon application from an entitled account.

No website publication, live Firebase deployment or TestFlight upload is
performed by this development handoff.
