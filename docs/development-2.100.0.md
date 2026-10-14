# Mode Atlas 2.100.0

Public version **2.100.0**, iOS build **2080022**, on
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Changes

- Web navigation includes **Shop** on every app page. The iOS dock retains its
  four destinations and existing profile Shop access.
- Weekly global profiles offer **Add friend**, pending/cancel and accept/decline
  actions. Requests use the existing limits, moderation and block policy. Both
  people must still participate in weekly rankings; private learning totals stay
  hidden until acceptance. Going back refreshes the list and request counts.
- Home shows the selected full-body character, a personal greeting, the shared
  study suggestion, daily goals, due reviews with help, level/XP, streak and a
  weekly recap. iOS scrolls normally, with shared dock clearance; web uses wider
  columns. Identity comes from account-bound owners, without another avatar
  editor, auth controller or leaderboard request. Review links and the recap
  use the existing learning/progress pages. Protected days preserve continuity
  but do not add to the actual study-day count.
- **Evergreen** costs 500 Atlas Coins and includes a forest theme, illustrated
  banner, frame, title, app icon, field jacket and laurel circlet. It uses the
  existing permanent entitlement and sale-rotation system. Sakura has warmer,
  pinker page and surface colours; collection previews and controls retain their
  own readable palettes.
- Six free hair choices: Classic side part, French crop, Messy fringe, Slick
  back, Medium flow and Bald. Premium additions are Sculpted pompadour (220 coins)
  and Braided undercut (240 coins). Existing saved looks and purchases retain
  their identifiers. Avatar and banner artwork extends the existing vector art.

## Streak protection and pricing

| Item | Coins | What it does | Inventory cap |
| --- | ---: | --- | ---: |
| Streak Freeze | 100 | Automatically covers one missed day when already owned | 2 |
| Streak Repair | 200 | Reconnects one eligible gap of up to three consecutive missed days; usable through seven calendar days after the last missed day, even after studying resumes | 3 |

Repair inventory shows the exact eligible dates and use-by date before confirming.
The server checks the current synced study record again when applying it. Repairs
cannot invent a streak without earlier study, cover today/future dates, or split
an uncovered gap longer than three days into smaller repairs. Items preserve
continuity without granting XP, actual study days or competitive score. Existing
inventory remains valid under the improved policy. No retroactive price refunds
or automatic repair spending occur.

One multi-day repair consumes one server-owned unit in one transaction. Retried
requests reuse the receipt. Late offline study removes unnecessary protection;
a partially needed repair stays spent, and a fully unnecessary repair returns
exactly one unit. The existing date-key and time-zone policies remain shared.

### Research and judgment

Reviewed these primary sources on 14 October 2026:

- [Duolingo's streak experiment](https://blog.duolingo.com/improving-the-streak/)
  separates the low-barrier streak action from a larger daily learning goal.
  Its reported retention improvement supports forgiving continuity; it does not
  establish prices for this app.
- [Mimo's repair policy](https://support.mimo.org/hc/en-us/articles/360017480779-I-ve-lost-my-Mimo-streak-How-can-I-repair-it)
  provides retrospective repair for one inactive day, limited to once monthly.
- [Knowt's freeze policy](https://help.knowt.com/en/articles/10298042-what-is-a-streak-freeze)
  uses automatic inventory freezes. Its coin economy is not directly comparable.

The 100/200 prices and three-day/seven-day rules are Mode Atlas design decisions,
not validated industry benchmarks. They make freezes convenient daily insurance
and repairs a more flexible rescue. Observe purchases, unused inventory and return
rates before adding more overlapping streak products. Good future shop options
are coordinated outfit/pose packs, optional profile scenes and sound packs;
learning access and competitive scoring should remain independent of purchases.
These future products are suggestions, not implemented items. Real-money coin
prices and transactions remain unset; coin-purchase buttons keep the existing
coming-soon prompt.

## Checks and release boundary

The local release check covers 180 JavaScript tests, 15 Python tests, Firebase
configuration, source/asset audits and deterministic native-web packaging.
Targeted browser coverage includes narrow phones, wider web layouts, large text,
intentional home scrolling, four native dock destinations, the web Shop link,
identity clearing, global profile request actions, collection first paint,
mixed-theme contrast and existing coin purchase/rotation flows. Artwork and
changed layouts are visually inspected. Backend additions cover opt-in/block/
restriction/rate-limit enforcement, private-stat isolation, repair eligibility,
calendar expiry, atomic retries and late-save refunds.

The [release gate](https://github.com/ModeAtlas/mode-atlas/actions/workflows/release-check.yml)
must pass for the exact published commit before handoff. It adds full web/iOS
browser regressions, the real callable/Auth/Firestore/rules/trigger suite, Swift
checks, iPhone/iPad simulator builds and an unsigned device archive. CI uses
Xcode 26.3; physical Xcode 27/iOS 27 checks remain separate.

Deploy the compatible backend before installing the client. There is no new
Firebase index, Apple entitlement or provisioning profile. Native sync adds the
Evergreen alternate icon. No main merge, Firebase deployment, website publication
or TestFlight upload is performed by the agent. The existing security findings
in the 2.98.0 review remain outside this release's scope; these changes do not
claim to make client-supplied lifetime XP tamper-proof.

## Physical-device checks

- Open Home after sign-in, avatar editing and sign-out; check the correct character
  and greeting, scrolling, review help and recap link. Check larger text.
- From the global weekly ladder, request a tester, cancel it, then send and accept
  a fresh request. Check private totals appear only after acceptance.
- Equip Evergreen, browse several pages and return from the background. Verify
  its native icon and theme; compare Sakura's pinker palette.
- Try all new hair shapes in the creator with different skin/hair colours and
  headwear. Confirm premium options require ownership.
- Test a pre-owned freeze and a qualifying repair on dedicated test data. Confirm
  shown dates, inventory and restored continuity after a late offline sync.

## Mac update

After the release gate passes for this commit, close Xcode and run:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.100.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.100.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.100.0' &&
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
your iPhone, press Cmd+R, and verify **2.100.0 / 2080022**.
