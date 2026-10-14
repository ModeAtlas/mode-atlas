# Mode Atlas 2.101.0

Public version **2.101.0**, iOS build **2080023**, on
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Changes

- Home and shared portraits can paint the saved, account-bound avatar while
  Firebase restores sign-in. Returning to Home no longer discards that cache
  or waits for another profile request. Authenticated editing remains separate;
  sign-out, account changes and expired or mismatched caches retain their guards.
- **Evergreen** has deeper forest-green surfaces. **Sakura** has stronger rose
  backgrounds, coordinated inset controls and darker berry accents. Legacy web
  blue/green light-mode corrections no longer override a collection palette.
  Reading/Writing, Practice setup, neutral mastery cells and shop previews use
  those shared colours. Normal Light and Dark palettes retain their own styles.
- Eight free hair shades: Dark chocolate, Walnut, Mocha, Ash brown, Caramel,
  Dark blonde, Honey blonde and Champagne blonde. Three premium multi-tone dyes
  follow the existing owned-cosmetic and rotation policy.
- Pants are a separate wardrobe slot. Four defaults are Classic trousers,
  Everyday jeans, Sand chinos and Soft joggers. Trail trousers unlock at level 5,
  Explorer cargos at 10 and Alpine trousers at 20. Premium pinstripes and Aurora
  joggers add tailored and iridescent details. Sakura, Midnight, Skyline and
  Evergreen packs now include matching pants; existing owners receive access
  through their original permanent grant, without another purchase.
- Friends profile details show the full character alongside learning stats.
  Weekly competitors who are not friends see a larger character and a fixed
  invitation, while learning stats stay private. The small account portrait may
  still be a linked photo; the full character uses the canonical avatar record.
- **Friends → My code → Edit profile** includes a short avatar message, up to
  120 characters. Only accepted friends see the custom message. Lookup, public
  weekly rankings and pending requests omit it; the visitor bubble stays fixed.
  Messages render as text, reject markup/control characters and use the existing
  language policy. Reports now include an avatar-message reason and bounded
  evidence for the existing moderation workflow. Older name-only edits preserve
  the message, and clearing the field removes it.
- Goals, Recap, Rewards and Kana mastery controls use compact shared icon actions.
  Short visible labels, descriptive accessible names and a responsive grid keep
  them usable on narrow screens and with larger text. Profile's established
  sign-in/out, avatar and sign-in-method row retains its layout.

## New shop items

| Item | Atlas Coins |
| --- | ---: |
| Amber ombré hair colour | 100 |
| Rose gold hair colour | 120 |
| Moonlit silver hair colour | 120 |
| Tailored pinstripes | 220 |
| Aurora joggers | 240 |

Wardrobe filters include Hair colours, Tops and Pants. Existing level rewards,
exclusive Hunny ownership, shop receipts and sale-rotation rules remain shared.
Real-money coin purchasing retains its existing coming-soon prompt.

## Compatibility and release checks

Character schema 2 adds pants and hair shades without replacing saved identities.
Legacy schema 1 loads as Classic trousers. The backend serves schema 1 to older
clients and schema 2 when requested. Older edits preserve new pants and dyes when
still owned; removing a paid grant falls back to available items instead of
blocking future saves. The server validates all level and purchase entitlements;
clients cannot grant themselves wardrobe items.

Local checks cover 183 JavaScript tests, 15 Python tests, generated assets,
Firebase configuration, source ownership and native-web packaging. Targeted
browser cases cover pre-auth avatar restoration on repeated visits, account
clearing, wardrobe saves/retries, owned and locked items, public versus friends-only
messages, narrow/wide layouts, larger text and collection contrast. Changed
screens and avatar art are visually inspected. The backend suite has 60 cases,
including version compatibility, revoked items and greeting privacy/moderation.
The local direct-service suite excludes function transport and trigger delivery;
the exact-commit GitHub release gate must also pass its full callable/Auth/
Firestore/rules/trigger suite, complete web/iOS browser regressions, Swift checks,
iPhone/iPad builds and unsigned device archive before handoff.

Deploy the compatible backend before installing the client. No new Firebase
index, Apple capability or provisioning profile is required. The agent does not
merge main, deploy Firebase, publish the website or upload TestFlight builds.
CI uses Xcode 26.3; physical Xcode 27 / iOS 27 validation remains separate.

## Physical-device checks

1. Visit Home, another tab and Home again with an existing saved avatar, including
   a slow/offline connection. Confirm the appearance stays stable. Sign out and
   switch accounts to confirm the previous appearance clears.
2. Save free, level and purchased pants/hair colours. Reopen the editor and check
   another signed-in device after sync; existing theme-pack pants should unlock.
3. View an accepted friend and a global weekly competitor. Verify the full
   character, private stats and the two different speech-bubble behaviours.
   Edit and clear your message from My code → Edit profile.
4. Check Sakura and Evergreen in both trainers, Practice setup, Profile and Shop;
   check the compact progress actions with your preferred text size.

## Mac update

After the release gate passes for this commit, close Xcode and run:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.101.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.101.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.101.0' &&
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
your iPhone, press Cmd+R, and verify **2.101.0 / 2080023**.
