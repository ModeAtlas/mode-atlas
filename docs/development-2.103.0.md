# Mode Atlas 2.103.0

Public version **2.103.0**, iOS build **2080025**, on
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Changes

- **Study Tokens** are the earned currency. Atlas Coins remain the currency for
  coin packs and rare awards. Both balances appear together in the shop.
  Every purchase opens a large item preview with an explicit payment button
  and remaining balance for each supported currency. Theme packs use Atlas
  Coins; individual wardrobe items, pets and streak items accept either.
- The starter wardrobe has five hairstyles plus Bald, three tops/dresses,
  three bottoms/skirts and six hair colours. Every skin tone stays available.
  Remaining wardrobe choices and all companions are in the shop. Existing
  purchases, gifts and qualifying equipped items are retained. No audience-facing
  item tiers or explanatory restriction panels were added.
- Pet names sit below the pet in Friends profiles. A profile uses its owner's
  selected collection theme, scoped to that profile. Friend/visitor privacy,
  entitlement checks and theme revocation still apply.
- Product pictures are created only for visible shop cards. The expanded
  catalogue does not build all avatar SVGs inside the small Top picks view.
  The developer shop tools can credit either currency; purchase reset preserves
  gifts and migrated equipped items.

## Economy

Study Tokens: 60 per level gained, plus 150 at every fifth level. Correct-answer
credits use the shared pool/hint weighting at one token per eight answer-XP
units, retaining fractional progress across sessions. Completion, goal and
manual XP bonuses do not count as answer earnings. Each actual study day earns
10 tokens, rising by 5 for each seven days of the streak, up to 30 per day.
Freeze/repair days bridge continuity but do not themselves earn daily tokens.

Atlas Coin milestones: level 10 = 25, 20 = 40, 35 = 60, 50 = 100, then 100 every
25 levels. Global weekly first place retains its 100-coin award and existing
eligibility rules. Already-awarded coins remain spendable and are not paid again.

| Example | Atlas Coins | Study Tokens |
| --- | ---: | ---: |
| Everyday hairstyle | 50 | 300 |
| Everyday top | 90 | 550 |
| Everyday bottoms | 70 | 400 |
| Rabbit | 120 | 900 |
| Shiba inu | 200 | 1,500 |
| Japanese Spitz | 680 | 5,440 |
| Streak Freeze | 150 | 900 |
| Streak Repair | 300 | 1,800 |
| Theme collection | 750 | — |

Private audience eligibility and shop rotation remain independent of payment
currency. Owned items remain usable when their offer leaves rotation.

## Migration and security

Wallet schema 3 preserves prior balances, inventory and receipts. A transaction
credits earned tokens, validates the current offer and entitlement, debits the
chosen balance and grants the item together. Retry keys include payment currency;
old coin-only requests remain supported. No wallet amount or grant is accepted
from a client save. Token balances never appear in public profile responses.

A bounded, resumable `study-currency-v2` backfill reaches dormant accounts as well
as active users. Token award components keep independent high-water marks so
retries, duplicate saves, progress resets and replay cannot repeat an award.
Eligible saved historical progress receives tokens. Existing equipped wardrobe
migration reads the canonical server avatar and current level, runs once, and
respects explicit revocations. The verified tester keeps the gifted Spitz/Shiro.

Earnings use the app's existing saved-progress trust model. Purchase authority is
server-owned; this change does not make imported/offline progress fully
server-verified. The global weekly competition continues using verified answers.

Deploy Firebase before updating clients. No new index, Apple capability,
entitlement or provisioning profile is required. Older clients keep coin-only
shop compatibility and receive current prices from the server.

## Validation and timings

Local checks cover packaging, Firebase configuration, Python gates, JavaScript
units, Auth/Firestore access rules and service behaviour. Browser checks cover
starter/owned wardrobe, token payment and retry, large previews, themed public
profiles, pet-name positioning, phone/tablet/desktop layouts and large text.
The required exact-commit GitHub workflow additionally covers all browser smoke
and polish shards, callable transport and triggers, Swift checks, simulator
builds and an unsigned device Release archive. Signed Xcode 27 / iOS 27 device
checks remain the final physical-device step.

The existing parallel CI layout is retained. Previous release 2.102.0's exact
commit completed in 9m15s. Allow roughly 10–12 minutes for a main release including
Pages, plus runner queue variation. This release's measured development CI time
is supplied in the handoff after it finishes. The agent pushes the development
branch, not main, Firebase production or TestFlight.

## Device checks

1. Deploy the backend, open the shop, and confirm both balances and retroactive
   Study Tokens. Reopen/sign out/sign in and confirm no duplicate award.
2. Buy an everyday item with tokens, then a theme with test Atlas Coins. Confirm
   the selected balance alone changes and the item appears in Rewards/editor.
3. Confirm the current outfit and gifted Shiro survive the upgrade. An unowned
   shop pet must not be selectable from the avatar editor.
4. View a friend's profile: their theme appears inside the profile and the pet's
   name sits below the companion. Return to Friends and check your app theme.

## Mac update

After the release gate passes for this commit, close Xcode and run:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.103.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.103.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.103.0' &&
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
your iPhone, press Cmd+R, and verify **2.103.0 / 2080025**.
