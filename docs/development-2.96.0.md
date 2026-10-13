# Mode Atlas 2.96.0

Public version **2.96.0**, iOS build **2080018**, on
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Level coins and existing accounts

2.95.0 documented the proposal but did not award coins. This release implements
20 coins for each level after level 1, plus 50 extra at levels 5, 10, 15, etc.
Totals: level 5 = 130; 10 = 280; 12 = 320; 15 = 430; 19 = 510; 20 = 580.
7,003 XP on the current curve is level 12, so its catch-up is 320 coins.
Existing balances are increased, not replaced, and purchases/inventory are kept.

The server reads the canonical synced save and derives its current level with the
shared XP policy. Retired curve credits are ignored. The private wallet stores
`levelRewards.version`, `throughLevel` and cumulative `total`; awards and receipts
commit atomically with the wallet. Repeated calls, racing/out-of-order triggers,
resetting to a lower level and returning to an already rewarded level do not pay
again. The developer purchase reset retains this history and does not refund coins.
Account deletion barriers stop delayed work from recreating a deleted wallet.

The existing learning-save trigger and Shop calls reconcile awards. A bounded,
leased migration in the existing 15-minute engagement schedule scans 50 Auth
accounts per run, checkpoints pages, retries failed pages safely and stops when
complete. It covers dormant verified accounts and does not require joining Friends.
No existing customer is credited until the Firebase backend is deployed. Online
learners receive catch-up on their next Shop refresh/sync; dormant accounts receive
it during the scheduled sweep (allow one 15-minute interval per 50 accounts).
A failed coin sweep does not prevent weekly/notification maintenance from running.

**Trust boundary:** progress remains client-synced, as before. The server does not
accept a requested coin amount or level, but independently verified study answers
are not available for all existing/offline history. A forged higher XP save could
therefore earn the finite level rewards. Importing or editing higher XP cannot be
distinguished from legitimate offline progress here; the high-water mark prevents
repeat awards for the same levels, not all cheating. Before real-money coin packs
launch, add server-validated earning evidence/abuse monitoring and decide how to
handle imported progress. This release does not enable payments, paid XP or prize
redemption for cash.

## Avatar ownership and presentation

`avatarProfiles/{uid}` owns the private selection, revision and character loadout.
It works independently of Friends consent; public profiles and the ladder project
only the selected visible look. Existing photo, emoji and Atlas choices remain.
The client cache is account-bound, expires, coalesces reads, ignores late responses
from another account and is excluded from learning backups/cloud-save imports.
The server checks character schema, real entitlement and level, and rejects stale
revision edits rather than silently overwriting another device's changes.

Free options: seven skin tones, eight hairstyles, eight hair colours, five eye
colours, six basic clothing colours, plus the Everyday tee, Track top and Linen
shirt. Grove cardigan and Trail cap unlock at level 5; Explorer jacket and Trail
scarf at 10; Summit coat and beanie at 20; Atlas pin at 35.

Existing `shop-sakura`, `shop-midnight` and `shop-skyline` grants now include their
outfit and headwear; previous owners need no repeat purchase. Studio headphones
cost 200 coins; Round glasses cost 150. Products and clothing use permanent IDs in
the shared catalogue; sale availability stays separate from ownership. Revoked
items fall back to free options. Moderation resets the private and public selection,
and account deletion erases the private record; leaving Friends keeps it.

The shared editor lives in Profile → Edit avatar, Progress → Rewards → Your
wardrobe and the Friends profile editor. One layered SVG renderer supplies compact
portraits in Profile, navigation, Progress, Friends and rankings, with a larger
studio preview. No image downloads or per-second rendering loop are needed.

## Validation and deployment boundary

Required release gate: generated assets/source audit, Python and JavaScript suites;
web/iOS browser polish, native-shell and packaged-website smoke; real Firebase
emulator callable/rules/trigger tests; Swift widget/model and destination/router
checks, iPhone/iPad simulator build and unsigned device Release archive.
New coverage exercises catch-up with legacy balances/curve credits, concurrent
retries, spending, lower-progress resets, resumed migration, non-Friends trigger
awards, deletion barriers, invalid/locked wardrobe items, previous collection
ownership, revoked grants, stale/concurrent edits, portrait consistency and narrow
light/dark mobile layouts. Existing release gates remain mandatory.

GitHub uses Xcode 26.3. Physical Xcode 27 signing, installation and appearance remain
device checks. The agent does not deploy Firebase, publish the website, merge main
or upload TestFlight. No new Apple capability or provisioning profile is required.
Deploy the compatible backend before testing avatars and earned coins.

## Mac update

Close Xcode, then run:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.96.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.96.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.96.0' &&
npm ci &&
npm run social:install &&
npm run build:social &&
npm run social:deploy &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

This keeps the named signing backup and stash, including manual **Mode Atlas
Development** choices and ignored local signing/widget configuration. Swift
packages resolve afresh. In Xcode select App and your iPhone, press Cmd+R and check
**2.96.0 / 2080018**. Check the coin balance, create a character, equip a previous
collection outfit, visit Progress/Friends and sign out/in to verify the same look.
