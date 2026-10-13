# Mode Atlas 2.95.0

Public version **2.95.0**, iOS build **2080017**. Development branch:
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Changes

Midnight now has a detailed moon, a soft glow, small stars and distant ridges.
Skyline adds the upper floors of layered skyscrapers with warm illuminated windows.
Both SVG illustrations keep their aspect ratio on the right, with a full-width
background and clear space for the profile identity. Existing Midnight ownership
and selections receive the new art automatically.

Skyline costs **500 Atlas Coins**, matching the existing collections. It includes
its banner, gold frame, **City Dreamer** title, dark blue-grey app theme and matching
iOS app icon. Its stable product ID is `skyline`, grant `shop-skyline`. The shared
catalogue and existing server purchase transaction own the price and entitlement.
Sale windows can hide/return it without removing access from existing owners.
The icon generator supports `--only=Skyline` to avoid regenerating unrelated PNGs.

The contrast bug combined a banner's background with the enclosing app theme's
foreground or button colours. Illustrated banners now supply a complete set of
semantic surface, text and control roles; primary buttons honor those local roles.
Theme previews and theme-selection buttons also own their matching foreground.
The shared owners apply this consistently to web and the native shell. There is
no image-brightness guessing or per-page style patch.

Theme normalization and availability use the reward catalogue rather than a
hardcoded pair of collection names. Skyline is included in the early bootstrap,
UIKit appearance boundary, alternate app icons and bounded widget frame validator.
The existing account-bound appearance cache and grant checks remain in place.

## Validation

Required release gate: generated asset/source audit, Python and JavaScript suites;
web/iOS browser polish, native-shell and packaged-website smoke; real Firebase
emulator callable/rules/trigger tests; Swift widget/model and destination/router
checks, iPhone/iPad simulator build and unsigned device Release archive.

New browser coverage checks rendered text (including WebKit text-fill colour)
against each collection's own background with Light, Dark, Sakura, Midnight and
Skyline applied. It covers product cards, detailed previews and actual sign-in/
sign-out button states for Hunny and every premium banner. Assertions wait for
existing control transitions to settle. Skyline joins the slow-Auth first-paint
and navigation checks. Firebase tests buy Skyline, hide and return its offer,
reject purchases outside sale windows and retain the owner's theme entitlement.
Widget validation accepts its frame; all collection palettes share contrast tests.

The existing GitHub workflow runs all required jobs concurrently. Local targeted
checks cover changed behaviour; the full browser/Firebase/native matrix runs once
against the published source commit. GitHub uses Xcode 26.3. Physical Xcode 27
iPhone appearance, app icon selection and signed installation remain device checks.
No main merge, Firebase deployment, website publication or TestFlight upload is
performed by the agent as part of this source handoff.

## Economy and avatar recommendations — not enabled in this version

Keep Atlas Coins as the future purchasable currency and use the same wallet for
small earned grants. Proposed baseline: **20 coins per level gained**, with an
**additional 50 at each fifth level** (5, 10, 15, ...). Starting from level 1:

| Reached level | Total level-reward coins |
| --- | ---: |
| 5 | 130 |
| 10 | 280 |
| 15 | 430 |
| 19 | 510 |
| 20 | 580 |

At current prices this buys a first collection at level 19 if no coins are spent.
A streak freeze costs 150 and a repair 250, so these compete with cosmetic saving.
This is an initial design proposal, to be tuned using real level-up cadence before
choosing real-money pack prices. No answer-by-answer coin farming or paid XP boost.
An implementation should track the highest rewarded level and grant receipts on
the server, once per account, including a deliberate one-time existing-level
backfill. Local save imports, resets, account changes and retries must not mint
coins. Current progress is client-synced; server-side level/award validation needs
a concrete policy before earned currency goes live. This release adds no grants.

A dress-up avatar is a useful future cosmetic system: free skin tones, hair and
core appearance; earned starter/milestone clothing; optional collection outfits,
headwear and accessories. Keep the existing photo and emoji options. Use a readable
head-and-shoulders portrait in compact navigation and social rows, plus a larger
wardrobe preview. Inventory should use permanent item IDs and slots separate from
the equipped loadout, sharing the existing entitlement and sale-window rules.
Agree the character art direction before building the creator and wardrobe. No
avatar creator, clothing inventory or level reward is claimed in this release.

## Update and deployment

Deploy the compatible Firebase catalogue before testing Skyline purchases. No new
Apple capability, signing profile or App Group is required. Close Xcode and run:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.95.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.95.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.95.0' &&
npm ci &&
npm run social:install &&
npm run build:social &&
npm run social:deploy &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

The command backs up manual signing (including **Mode Atlas Development**), retains
ignored local signing/widget settings and regenerates the current project/version.
The Swift package resolution is backed up and resolved afresh. The named stash and
backup remain available. Select App and the connected iPhone, press Cmd+R and
confirm **2.95.0 / 2080017**.

On device, inspect Midnight and Skyline in Shop and after equipping their banners.
Try Sakura previews under Dark/Midnight and Hunny's account buttons under both
Light and Dark. Select Skyline's theme and navigate through Learn, Progress and
Friends; select its app icon in Rewards. Existing developer coin controls can fund
a test purchase. These checks do not require purchasing coins with real money.
