# Mode Atlas 2.97.0

Public version **2.97.0**, iOS build **2080019**, on
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Avatar saving and a single editor

The previous save awaited the entire `KanaCloudSync.syncNow()` promise before it
could call `avatarUpdate`. A queued Firestore write or repeated progress sync can
leave that promise pending while a small avatar update would succeed independently.
The private avatar owner now sends the selection directly through the existing
bounded callable transport. Level/ownership/revision checks remain on the server.
The editor uses the returned server level when signed in, so it does not offer an
unverified local level unlock. Newly earned level items appear after normal progress
sync and reopening the editor. No progress save is replaced or cancelled.

An avatar save also invalidates background reads instead of waiting on them. Late
reads cannot overwrite the newer portrait. Concurrent saves are rejected; network
errors release the lock and preserve the draft. A stale revision prompts reopening
to get the latest look, including when a response was lost after a successful save.
Account changes invalidate pending work and close the editor. Regression coverage
holds learning sync and an older avatar read indefinitely while saving succeeds.
This identifies and fixes a blocking code path; it is not a claim to have reproduced
the user's physical iPhone failure.

Only **Profile → Edit avatar** edits the portrait. Friends edits the display name
and consent; a name-only backend request preserves the canonical private avatar.
Rewards shows collected/earned wardrobe items in a collapsed, read-only category,
with a short pointer to Profile. Character and Account photo are the available
choices. Old Atlas/emoji portraits still render for existing users and older clients;
opening the editor starts a character draft without silently changing saved data.

## Wardrobe and earned artwork

The shared schema keeps existing IDs and version 1 compatibility. Free additions:
Curtains, Quiff, Short curls, Ponytail, Twin braids and Pixie; Ivory/Blush between
Porcelain and Peach, Apricot/Warm beige between Peach and Sand; Cosy jumper and
Striped tee with the existing clothing colours. The total is 14 free hairstyles
and 11 skin tones. Hairstyles are now an entitlement-aware wardrobe slot.

Shop additions: Textured fade 180 coins, Ribbon waves 200, Varsity jacket 250 and
Cable knit 250. Permanent grants use the existing rotation/ownership policy;
removing an offer never removes a purchased look. Purchase reset removes their
paid grants. Revoked hair falls back to the free Side sweep. Profile and public
portraits share the renderer and server checks. No payment feature is enabled.

Hunny jumper, bear ears and pendant share the existing `hunny-tester` entitlement
and its existing verified-account audience. Developer `allCustom` access includes
these exclusive pieces; it still does not unlock paid cosmetics. Ordinary accounts
cannot select them or obtain them through the shop. No new public grant path.

First light, Kana grove, Recall bridge, Memory summit, Lantern passage and Open
horizon gain small vector scenes in their original Atlas/bronze/silver/gold/amethyst/
diamond palette. The scenes use theme-aware masks at their original aspect ratio.
Premium collections keep more elaborate, full-colour illustrated backgrounds.

## Weekly first-place coins

Newly settled, qualifying first places earn **100 Atlas Coins + 500 personal XP**.
Second/third stay at 300/150 XP. First-place ties each receive the full prize under
the existing competition ranking. At least two learners need 100 weekly XP;
nonqualifying, inactive/restricted or deleting accounts do not receive prizes.

The weekly settlement asks the commerce owner to prepare a wallet update. Wallet,
coin operation receipt, XP save, weekly award/history and finalized entry commit in
one Firestore transaction. Concurrent settlement, spending or level rewards retry
safely without replacing each other's balances. Legacy wallets migrate through the
same wallet parser and keep purchases/inventory. Settled historical weeks are not
backfilled; old receipts without a coin field show only their original XP.
No client request accepts a weekly coin amount, and prizes do not feed ladder score.
Level-coin trust limits documented in 2.96.0 remain unchanged.

## Required validation and release boundary

Run release audit, Python/JavaScript regressions, relevant browser checks and the
complete GitHub release gate: web/iOS polish, simulated shell, packaged website;
real Firebase callable/rules/trigger tests; Swift widgets/navigation/router,
iPhone/iPad simulator build and unsigned Release archive. New tests cover stuck
sync, delayed reads, retry recovery, one editing entry, exclusive/paid wardrobe,
name-only updates, tied winners, retries, legacy wallets and settled-week behavior.
Use targeted local checks, then one full CI matrix; repeat only to fix a concrete
failure. Native CI uses Xcode 26.3; physical Xcode 27 remains a device check.

The agent pushes the development branch and provides source. It does not merge main,
deploy Firebase, publish the website or upload TestFlight. The Mac command below
deploys the compatible backend before packaging the app. No new Apple capability,
provisioning profile, Firestore index or client-writable collection is required.

## Mac update

Close Xcode, then run:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.97.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.97.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.97.0' &&
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
**2.97.0 / 2080019**. Save a character, rename the Friends profile, check the Hunny wardrobe on the entitled/developer account and verify the new earned banners. Physical iOS verification is still required; cloud and simulator checks cannot reproduce every device/network condition.
