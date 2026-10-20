# Mode Atlas 2.110.0 — Finish the shared design and correct phone sizing

Version 2.110.0 · iOS build 2080032 · 20 October 2026.

## Changes

- Kana navigation fits one row at normal phone text sizes. Script and skill selectors use compact, shared segmented controls while keeping 44-point targets. Larger text can wrap.
- Lesson tile columns follow the actual row length. Combined kana such as きゃ stay on one line, including the practice illustration and path markers. The practice card uses explicit copy/art/action areas with bounded artwork, so Start practice is reachable without the old oversized card.
- Friends uses illustrated profile cards with a separate readable name, level, title and streak area. Full character artwork comes from the existing approved profile projection; the selected banner appears above the caption. Request handling, privacy, moderation, weekly rankings and profile actions retain the same controller and server checks.
- Progress groups goals into Today and This Week, with completion rings, real counts, XP and the original study links. Rewards has a live avatar studio entry and illustrated category controls. Recap uses a compact statistics grid. Progress and Friends headers no longer repeat a large explanatory subtitle.
- Kanji puts the next lesson before the first-ten reference, uses clear level tiles and distinct practice tools. Set length, focus, teaching, recall, meaning match, tests and handwriting remain available under their existing owners.
- Word Bank uses its branch illustration, a smaller responsive header and paired phone filters. Results replaces the old decorated nested heading with a compact test summary and removes redundant nested card shells. Accounts without test results see one illustrated starting point; completed assessments retain the full history, charts, rows and kana analysis.
- Profile/settings tabs, achievements and trainer surfaces follow the same shape, typography and restrained surfaces. Native Results places its back/profile controls before the branch selector.

## Ownership and review

Canonical page and component owners were edited directly. No overlay stylesheet, alternate router, second data controller, copied prototype logic or new dependency was added. The retired Results hero styles and obsolete inner card markup were removed. Revised runtime copies and native version metadata are generated from source.

Learning rules, auto-check/feedback, progression, saves, Firebase permissions, purchases, both currencies, exclusive rewards, themes, widgets, native sign-in and signing configuration retain their owners. No Firebase deployment is required.

The review uses all four supplied iPhone screenshots, plus desktop and simulated iOS layouts in light/dark at normal and enlarged text sizes. Existing-account checks include combined kana, illustrated/exclusive friend banners, goals, rewards, recap, profile and settings. A viewport screenshot is not a claim of physical-device validation.

## Validation

The normal release gate remains required: source audit, packaging, Python/Node tests, web smoke, native shell, all polish shards, Firebase emulator, iPhone/iPad simulator build, unsigned archive and widget/intent/routing checks.

New regressions cover combined-kana single-line geometry, reachable practice actions and retained study selection at 320/393 pixels; friend artwork/caption separation and real profile opening; and grouped goals retaining real targets, rewards and destinations. Existing assertions were updated for the replaced Results markup and friend-art placement. The narrow web density assertion now checks a complete pair of illustrated cards; wider/native density and all access/interaction checks remain.

Exact commit, final results and elapsed times are recorded in the PR and release handoff. Local visual and test logs stay outside the public runtime.

## Mac update

Close Xcode, preserve local signing, then update the development branch:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.110.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.110.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.110.0' &&
npm ci &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Select App and your iPhone, press Cmd+R, and confirm **2.110.0 / 2080032**.
