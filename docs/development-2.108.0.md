# Mode Atlas 2.108.0 — Clear choices and useful mastery targets

Version 2.108.0, iOS build 2080030. Handover: 19 October 2026 (Melbourne).

## Changes

- Study selection keeps two columns on phones at normal text sizes. Each script has an All unlocked checkbox with an indeterminate state for partial selection. It only changes eligible rows for that script and skill, and preserves the other script. Only available rows appear in study setup; the full learning path still shows locked rows. Large-text mode keeps the accessible single-column layout. Compact dropdown wording avoids clipped labels on phones.
- Kana detail shows Read, Recall and Handwrite milestones together, with one selected skill's evidence visible. Targets are shown immediately in a compact two-column layout: green Met, red To build, and neutral optional or earlier-practice evidence. Missing optional timing is not presented as a failure. Exact values determine status before display rounding.
- How mastery works gives the actual requirements and explains unassisted answers, recent evidence, separate-day practice, spaced steps, row unlocks and optional Mastered+ handwriting. The mastery map restores its position when returning from a kana.
- Starting-point Read questions reuse the native Reading keyboard. Letter entry, deletion, hardware keyboards and accessibility feedback share one owner. The keyboard remains available between questions, is disabled during feedback, and is removed when leaving the assessment. Web retains ordinary keyboard input.

## Source ownership

The existing curriculum and recall policy provide target data and pass/fail status. The mastery component only formats that evidence. Thresholds, earned milestone retention, row unlocks, assessment scoring, XP and currencies retain their existing rules.

The shared practice component owns script-wide row selection. The native keyboard exposes a mount/destroy lifecycle used by both its existing Reading adapter and the Kana page. Native styling remains scoped to iOS.

Canonical policy copies are regenerated for the backend, but this release adds presentation guidance only; there is no changed server projection, access rule, function behaviour or required Firebase deployment. The previous 2.106.0 backend projection still needs deployment if that earlier step has not been completed.

## UI and UX review

This is a review of Mode Atlas source, screenshots and browser flows against published official product documentation. It is not a claim of hands-on testing of competitors' signed-in apps.

| Reference | Useful pattern | Assessment for Mode Atlas |
| --- | --- | --- |
| Duolingo's documented learning path | A recommended next lesson combines new learning and review without requiring setup first. | The restored Overview is a good foundation. Keep Continue learning primary and custom practice optional. |
| Bunpro's July 2026 Cram beta redesign | Quick sessions sit beside a separate custom builder, with a live item count before starting. | Keep the ready-made session and its count. Bulk selection makes precise custom setup practical; do not expose every control on Overview. |
| WaniKani's SRS guide | Explains the relationship between answers, stages, reviews and unlocked content. | Stage labels alone do not explain progress. Show the learner's current result against the exact next target in context. |

### Task friction addressed

| Learner intent | Before | This release |
| --- | --- | --- |
| Deselect ten unlocked basic Hiragana rows after opening Study selection | Ten individual checkbox changes, with a long single-column phone list. | One All unlocked toggle; normal phone layout uses two columns. |
| Understand why a kana has not advanced | Open the character, expand another explanation, then compare text with stats. | Open the character to see targets immediately; select another skill if needed. |
| Answer consecutive placement questions on native iOS | Reopen the phone keyboard after each answer. | The app keyboard is available without tapping the answer field; Check and Continue retain deliberate feedback. |
| Inspect a character low down the map | Detail could appear at the old scroll position. | Detail opens at the top, and Back restores the map position and focus. |

### Current position and next priorities

Mode Atlas has useful depth: separate recognition, recall and handwriting, configurable short or timed sessions, and retained milestones. Its remaining UX weakness is continuity between those tools. A learner should always see the next useful action and understand what a result means without consulting terminology.

This release keeps the existing learning choices and puts the explanation next to the decision. Further work should focus on consistent task names across Kana, Kanji and Words, clearer resume behaviour for a custom session, and in-context practice suggestions from unmet targets. Those broader changes are review findings, not silently added scope in this patch.

Research sources:
- https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/
- https://blog.duolingo.com/new-duolingo-home-screen-design/
- https://community.bunpro.jp/t/new-beta-feature-cram-redesign-july-30th-2026/208271
- https://knowledge.wanikani.com/wanikani/srs-stages/

## Validation

Regression coverage checks script-wide selection and lock boundaries, exact mastery target status and earned retention, optional timing and earlier-practice evidence, consecutive native placement answers, keyboard cleanup, and existing Reading hardware/onscreen input. Layouts are inspected in light/dark and phone/web sizes. Final CI counts and elapsed times are recorded in the PR and handover. Physical iPhone/iPad touch and VoiceOver require device confirmation.

## Mac update

Close Xcode, then run the command below. It backs up signing files and resolves Swift packages afresh.

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.108.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.108.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.108.0' &&
npm ci &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Select App and your iPhone, press Cmd+R, and confirm **2.108.0 / 2080030**.
