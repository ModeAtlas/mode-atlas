# Mode Atlas 2.102.0

Public version **2.102.0**, iOS build **2080024**, on
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Changes

- Free A-line and pleated skirts, Everyday and Pinafore dresses. Bottoms now
  have their own colour choices, including Original to retain each item's palette.
  Premium Starfall skirt (240 coins) and Meadow dress (280) add embroidery,
  layered hems and colour choices. The Ocean waves kimono (350) uses wide sleeves,
  a woven obi and seigaiha motifs in teal, navy, cream or charcoal. Its palette
  excludes pink/plum/coral; Sakura keeps its own blossom styling.
- Companions appear with the full avatar on Home, in Friends profiles and in the
  editor. Milestones: Shiba inu at 10, calico cat at 15, rabbit at 20, tanuki at 40,
  red-crowned crane at 50. Premium Japanese Spitz (450), Moon fox (500) and Golden
  koi (350) have a dedicated Pets shop category. Owned pets remain available
  when their offer leaves rotation. Pet names are bounded to 24 characters and
  remembered per companion; names render as text, never interpolated SVG markup.
- The existing verified tester identity receives a complimentary Japanese Spitz.
  The first compatible backend access seeds **Shiro** once, using a private
  migration marker. Choosing another pet or No companion is respected. A server
  revocation overrides the gift. The email policy stays server-only, and token
  claims/client saves cannot award the pet. This takes effect after backend
  deployment; no live account mutation was performed during development.
- **Rewards** owns themes (including Light/Dark/System), icons, banners and frames.
  Settings links to this same surface. **Profile** and **Rewards** both open the
  one **Edit avatar & pet** editor. Appearance, Wardrobe and Pet tabs keep options
  together; display name and the tappable message at the top save with the look.
  Names still use the existing unique-name and moderation policy. Friends opt-in
  remains explicit; private editing does not join or publish a social profile.
- Friends profile bubbles sit above the avatar, with a pet name below. Accepted
  friends see the custom message; visitors keep the fixed invitation and cannot
  see private learning stats. My code contains code-sharing controls only.
  Leave Friends remains available under the collapsed Friends privacy control.

## Compatibility and validation

Character schema 3 adds bottoms colour and companion selection/name. Avatar
requests negotiate versions 1, 2 or 3. Older clients receive compatible clothing
and retain still-owned new choices on save; revoked items fall back safely.
Name, bio, pet names and appearance update atomically using the existing private
avatar revision. Unique-name collisions leave the previous look untouched.
No new Firebase index, Apple capability, entitlement or provisioning profile is
required. Deploy the backend before installing the new client.

The local release check covers generated assets, public packaging, Firebase
configuration, Python checks and JavaScript units. Targeted browser validation
covers narrow iOS light/dark, desktop, ownership, colours, per-pet names, shared
editing, friend/visitor profiles, large text and shop categories. SVG artwork
and changed layouts are visually inspected. The local Auth/Firestore direct
service suite covers 63 cases; it does not replace the exact-commit GitHub
callable transport, access rules, Auth and Firestore trigger gate. The whole CI
workflow must pass before handoff, including browser smoke, all polish shards,
Swift checks, iPhone/iPad simulator build and unsigned device Release archive.
CI uses Xcode 26.3; signed Xcode 27 / iOS 27 device validation remains separate.

## Release timing review

Measured main run `38553855571` took 15m27s including Pages publication. The browser
job spent 10m11s in polish, 1m25s in simulated iOS shell checks and 55s in website
smoke. Xcode ran in parallel and finished in 7m02s; Firebase took 2m23s.

Polish now runs in three file-based shards on separate checkouts/runners,
concurrently with audit, shell and website smoke. Worker counts, timing
assertions, test coverage and failure policy are unchanged. The original
required browser status aggregates all shards; failed/cancelled shards cannot
produce a green gate or publish Pages. Firebase and Xcode remain required.
Per-test timing and layout artifacts are retained for each shard. This targets
an approximately 8–10 minute main release, subject to runner queues and Pages
latency; the first exact-commit run supplies the observed development timing.

The agent pushes the authorized development branch only. It does not merge main,
deploy Firebase, publish Pages or upload TestFlight.

## Physical-device checks

1. Deploy Firebase, then open Evelyn's editor: verify Japanese Spitz / Shiro,
   rename it, select No companion, reopen and confirm the choice persists.
2. Buy a cosmetic/pet using test coins, equip it, switch devices and verify its
   colours and saved pet names. Confirm level-locked companions stay locked.
3. Save display name, message and outfit together; check a friend and weekly
   visitor profile. My code should have no editing form.
4. Switch themes from Rewards, check Home with a companion, and confirm narrow
   phone/large-text layouts scroll without clipped controls.

## Mac update

After the release gate passes for this commit, close Xcode and run:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.102.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.102.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.102.0' &&
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
your iPhone, press Cmd+R, and verify **2.102.0 / 2080024**.
