# Mode Atlas 2.93.0

Public version **2.93.0**, iOS build **2080015**. Branch:
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Shop and ownership

Profile → Shop spends **Atlas Coins** on Sakura/Midnight collections (500 coins),
Streak Freeze (150 coins, up to two ready) and Streak Repair (250 coins, up to
three held). Collection ownership is permanent and includes its theme, banner,
title/frame and native app icon. Themes can be selected in Settings or Rewards.
Only the **Purchase Atlas Coins** button explains that top-ups are coming soon.
No StoreKit transaction, payment sheet or real-money debit is enabled.

`mode-atlas-shop-catalogue.js` owns product IDs, types, coin prices and inventory
limits. `mode-atlas-reward-rules.js` owns unlocks and themes. Firebase commerce
transactions own balances, inventory, purchase receipts and reward grants;
client saves/imports cannot credit coins or grant products. A purchase reads the
current offer and confirms its price, then deducts coins and delivers the item
atomically. Duplicate request IDs return the committed result without charging
again. The client retains ambiguous request IDs for safe retries across reloads.
The v1 token wallet migrates without changing its balance; old v1 read-only
clients retain their response shape during the compatible backend rollout.

A new StoreKit integration must verify Apple transactions on the server, credit
coins using an immutable transaction receipt, and use this same wallet. Never
add a client-side credit path or accept client-provided prices. Production coin
pack prices and refund handling remain part of that later integration.

## Catalogue rotation

Keep published product/reward IDs permanent. Add new products in the canonical
catalogue and real cosmetic entries/palettes to their existing owners. Never
remove a reward definition to end its sale.

The private Firestore document `shopCatalogue/current` can override sale windows:

```json
{"offers":{"sakura":{"enabled":false},"midnight":{"enabled":true,"startsAt":1791763200000,"endsAt":1792368000000}}}
```

`startsAt` and `endsAt` are UTC Unix milliseconds; opening is inclusive and
closing exclusive. Omit dates for an ongoing offer. Set `enabled: true` and
remove/replace expired dates to return a product. The server filters offers and
rechecks availability on every purchase. Existing owners continue to find all
owned cosmetics in Rewards regardless of the current rotation. Do not change
live rotation documents without a separate release/operations decision.

## Streak items

A freeze is ready immediately and automatically covers a missed calendar day
when there was an existing streak and the item was owned before that day ended.
A repair reconnects **yesterday** to an earlier streak; use it before the next
local midnight. A longer unprotected gap is not repairable with one item.

Shared progression computes continuity. Covered days preserve the count but do
not add study days, answers, XP, goal completions, achievements or competitive
scores. Friends streak rankings continue to count actual study only. The server
uses synced study evidence and calendar dates in the account's current time zone.
Late offline evidence returns an item used on a day that was actually studied.
The client/widget can project held freezes while offline, with server
reconciliation on reconnect. Spending requires a connection; repair use also requires a successful study sync.

## Developer testing

The existing developer menu has **Shop / Coins**. Only the actual, verified
Firebase Auth admin can credit the currently signed-in account or reset its
purchases. Browser localhost eligibility does not grant server privileges.

Add 1–100,000 test coins, use the normal shop, then inspect Rewards. Reset purchases
requires confirmation and removes paid collections, themes, held items and item
coverage, retaining the coin balance, earned rewards and exclusive/event grants.
It does not refund coins spent. Receipts remain so replaying an old request cannot
mint currency. Active paid selections fall back; an earned native icon is kept.
Test credits and spent amounts are recorded in the private operation ledger.

## Widgets

Home Screen layouts show level and XP progress alongside the study streak and
rotating goals. The large layout separates Today and This Week and includes a
weekly rank/score if an opted-in account has a current server result; otherwise
it shows useful lifetime totals. Rank refreshes are throttled and hidden at the
server week boundary. Lock Screen widgets retain their compact streak focus.
The completed-day label is **Studied today**.

Snapshot v5 retains all v1–v4 decoding and adds total XP, abbreviated goal labels,
optional bounded ranking data and streak-item projection. UIKit mirrors the
chosen collection canvas supplied by the shared theme controller; the widget
continues to follow its system colour appearance independently.

## Update and deployment

**Deploy the compatible Firebase backend before building this client.** No new
Apple capabilities, App Group or signing profile is needed. Close Xcode and run:

```sh
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.93.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.93.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.93.0' &&
npm ci &&
npm run social:install &&
npm run build:social &&
npm run social:deploy &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Retain **Mode Atlas Development** signing and ignored local signing/widget
configuration files. Keep the backup and stash; do not restore the old
`Package.resolved`. The ZIP matches the pushed source, but using Git keeps the
existing local checkout and signing settings together.

## Validation and device acceptance

Run source/audit tests, the existing browser matrix with the new purchase/theme
journeys, real Firebase callable/rule tests, and the native simulator/archive
gates for the delivered commit. Unit tests cover duplicate requests, account
switches, offer boundaries and streak continuity. Firebase tests include actual
transactions, private rules, admin identity, retained ownership and deletion.

On the signed Xcode 27 device, confirm 2.93.0 / 2080015. Credit the admin account,
buy a collection and streak items, select its theme across Learn/Reading/Writing/
Progress/Friends, and reset purchases. Add small, medium and large Home Screen
widgets; compare numbers and larger-text/light/dark presentation. Check the
Lock Screen countdown, midnight/DST, an offline freeze and sign-out redaction.
The server's current ranking and WidgetKit refresh timing remain distinct;
a widget cannot present live second-by-second leaderboard changes.

The development handoff does not deploy Firebase, publish the website or upload
to TestFlight. Those deployment commands run in the user's existing environment.
