# Mode Atlas 2.113.0 — Faster pages, clearer controls

Version 2.113.0 · iOS build 2080035 · 20 October 2026.

## What changed

- Page startup no longer builds the hidden account Shop. Shop computes level/access once for a refresh and builds only the products needed for its featured selection. An unopened Shop does no catalogue rendering on progress updates. Unopened Rewards and Recap panels are deferred until selected.
- Progress summaries use the already-normalized state internally instead of normalizing the whole history again for XP and each correct-answer total. Public reads still validate their input; there is no shared mutable cache or alternate persistence layer.
- The outgoing native view-transition snapshot remains opaque while the incoming document fades in over it. Warm navigation still bypasses the launch loader. No second router or artificial loading overlay was introduced.
- Settings uses open preference rows, compact controls, a separate alert-times/quiet-hours disclosure, and consistent support/data actions. Existing notification, sound, haptic, repair, reset, deletion, tour and support behavior remains connected to its original owner.
- Both Shop views use larger artwork, product grids and a cleaner wallet. The compact preview keeps See full shop pinned; the full shop retains Featured, Wardrobe, Pets, Theme packs, Streak items and Atlas Coins. Enlarged purchase previews, both currencies, permanent ownership, rotation and audience restrictions remain intact.
- Dock and desktop navigation use coordinated illustrated symbols; Kana practice tools and streak products now have distinct pictograms. Learning is coral, Familiar amber, Confident blue, Mastered green and Mastered+ violet. Labels remain visible, and Kanji uses the corresponding learning/review/mastery colours.
- Achievement summaries use open counters; friend profiles lose unnecessary panel framing. Results open with tested kana only, with Show unused kana retained. Obsolete light-mode card overrides and Results blur no longer compete with the component-owned layouts.

## Performance evidence

Measured in Chromium at 393 × 852 with the native bridge fixture and 4× CPU throttling, using the same synthetic account before/after: 120 study days, 21,000 correct answers, 360 daily goal claims and 240 kana. These are local browser measurements, not physical iPhone timings. The dominant before-profile was the hidden Shop rebuilding XP ownership for each catalogue product.

| Route | Before: DOM ready | After: DOM ready |
| --- | ---: | ---: |
| `/` | 5.11s | 0.93s |
| `/learn/` | 5.09s | 0.67s |
| `/kana/` | 5.06s | 0.60s |
| `/progress/` | 5.50s | 0.95s |
| `/friends/` | 5.10s | 0.65s |

Largest main-thread task across these loads: 4.32s before, 0.26s after.

Before, the hidden Shop added 849 DOM nodes to every route. It now adds zero until opened. Progress initially creates its visible Goals panel instead of a full hidden wardrobe and recap. The regression check enforces zero progress projections for hidden-shop refreshes and one for a visible catalogue refresh, as well as first-open/return behavior of the Progress tabs.

## Ownership, validation and release

No learning, XP, wallet or account schema changed. No Firebase rules/index deployment or data migration is required. The generated Functions copy contains the equivalent progress-summary optimization and can follow the normal backend release cycle; this client does not depend on a Functions deployment.

The full route and shared-surface review is recorded in [UI review](ui-review-2.113.0.md). Local source gates passed (15 Python and 231 JavaScript tests), with targeted browser checks for account navigation, shop, social and hub behavior. Full exact-commit browser, website, Firebase emulator and native simulator/archive outcomes and CI timings are recorded in the PR and handoff. Physical iPhone navigation and responsiveness should be checked after installing this build; simulated native fixtures cannot establish on-device performance.

## Mac update

Close Xcode, then run the following. It backs up the three local Xcode files, preserves your signing project and Info.plist, and resolves the current Swift packages after synchronization.

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.113.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.113.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.113.0' &&
npm ci &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Select App and your iPhone, press Cmd+R, and confirm **2.113.0 / 2080035**. Try Atlas → Learn → Progress → Friends with your existing study history, then open Settings and both Shop views.
