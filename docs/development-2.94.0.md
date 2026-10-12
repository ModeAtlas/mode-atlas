# Mode Atlas 2.94.0

Public version **2.94.0**, iOS build **2080016**. Development branch:
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Changes and causes

**Widgets.** Streak expiry used a seconds-based SwiftUI timer, while last activity
already used minute/hour/day precision. Both now use the same allowed units.
The final minute reads “Less than a minute”. WidgetKit gets entries at meaningful
boundaries, including that final-minute transition and expiry, with no app polling
or recurring second/minute timeline entries. Home and Lock Screen share this owner.

**Themes.** The original page bootstrap applied only Light/Dark. The deferred theme
owner then waited for the signed-in account before accepting its collection,
causing a base-theme flash on each page. Reward rules, cached presentation access
and the existing theme owner now execute before CSS and page content. The build
generator preserves this critical order instead of adding `defer` again. A valid,
unexpired cache for the last account can restore presentation during Auth loading;
resolved account changes/sign-out remove it. Purchases and actual reward controls
still require the authenticated account and server authorization. No grants,
balances, prices or product ownership come from this appearance-only path.

**Web practice.** Body overflow created a scrolling ancestor that broke sticky
navigation. Fixed side panels also covered the full-width secondary menu, and old
bottom spacing extended the setup behind its dock. The root owns vertical scroll,
Kana navigation fits between desktop panels and setup spacing clears the dock.
Short windows can still scroll to reach content while the primary navigation stays
visible. Active sessions keep their existing focused layout.

**Profile image.** Progress created its avatar once from the immediate Firebase
user, before account restoration, and did not consult the selected Friends avatar.
The shared social identity policy now renders selected emoji/Atlas avatars or the
validated account photo. Linked Google provider photos also work after an Apple
sign-in. An account-bound private profile cache is refreshed through the existing
social transport, coalesced and throttled; profile/account events refresh the UI.
That cache is excluded from backups/cloud saves and cleared on account changes.

**Sakura.** Replaced stretched gradient blobs with a blossom branch, layered petals
and fine gold details. The vector sits on the right at its original proportions;
the pale background fills the full banner. The same asset serves shop previews,
Progress and social banners. Existing ownership/product IDs are unchanged.

## Mastery policy

Spaced-review status previously bypassed overall accuracy and speed. The canonical
review policy now checks both performance and recall evidence, using raw values
before display rounding. Reading and Writing remain separate; Both requires each
direction to qualify.

| Stage | Overall performance | Spaced recall for current records |
| --- | --- | --- |
| Reviewing | 10+ correct, at least 85%, average at most 2.5s when timing is available | 4 unassisted attempts in the last 12, at least 75% recent accuracy, 2 independent-recall days, 2 review steps |
| Mastered | 50+ correct, at least 95%, measured average at most 1.0s | 8 unassisted attempts in the last 12, at least 95% recent accuracy, 4 independent-recall days, 4 review steps |

The reported 52/55 at 1.1s and 86% at 1.6s cannot be Mastered. Their actual Reviewing
status also depends on spaced recall. Older records without review history use the
same overall performance thresholds; new answers build their recall evidence.
Missing timing cannot qualify for Mastered. Help and per-kana guidance show each
requirement, including the overall correct count, accuracy and speed.

This recalculates the displayed stage; it does not delete answers, deduct XP or
reissue historical mastery milestone XP. Friends projection version 3 refreshes
older cached summaries when viewed without requiring another study session.

## Validation and release boundary

Required release gate: source audit, generated asset consistency, Python and JS
regressions; full Firebase emulator callable/rules/trigger tests; simulated native
shell, web/iOS polish and packaged-site smoke tests; native Swift widget/model and
navigation/router checks, iPhone/iPad simulator builds and unsigned Release archive.

New regressions cover exact mastery boundaries and the reported examples, stale
Friends mastery projections, delayed Auth with first-paint theme persistence across
Progress/Reading/Writing, profile photo/emoji/account changes, desktop clipping and
short-window navigation, and final-minute widget timeline transitions. Sakura is
visually reviewed at iPhone and web widths. These extend the existing suites;
unchanged test matrices are not duplicated in a separate release workflow.

GitHub runs the actual Firebase functions emulator and Xcode 26.3 checks. Local
Linux cannot replace a signed Xcode 27 device check. Confirm the widget text/layout
and theme transitions on the user's device after installing. No main merge,
Firebase deployment, website publication or TestFlight upload is performed by the
agent as part of this source handoff.

## Update and deployment

Deploy the compatible Firebase backend so Friends uses the corrected mastery
projection. No new signing profile, capability or App Group is needed. Close Xcode
and run the complete block:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.94.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.94.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.94.0' &&
npm ci &&
npm run social:install &&
npm run build:social &&
npm run social:deploy &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

This preserves the existing manual signing settings (including **Mode Atlas
Development**), keeps ignored local signing/widget configuration and generates
the current version/build. The old Swift package resolution is backed up, then
resolved afresh. The backup and named stash are retained. Select the App scheme
and connected iPhone, press Cmd+R, then confirm **2.94.0 / 2080016**.

On device: check a streak that still needs study, navigate repeatedly with Sakura
and Midnight selected, view Progress with the chosen photo/emoji, inspect both
reported kana and check Sakura in the profile banner. On web: try both practice
pages in a short desktop window and expand/collapse their setup controls.
