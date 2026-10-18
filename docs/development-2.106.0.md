# Mode Atlas 2.106.0 — One Kana learning journey

Version 2.106.0, iOS build 2080028. Release date: 18 October 2026.

## Learning experience

Kana has four sections: Learn, Practise, Mastery and Tests. Read, Recall and
Handwrite are skills within the same learning path. Read identifies a kana's
sound; Recall finds or types the kana from its reading; Handwrite practises
its strokes from memory. Kana, Kanji and Word Bank remain sibling branches,
and Results remains shared.

First entry offers a starting-point test or Start as a beginner. Beginners
start with the hiragana A-row selected; the katakana A-row is also available.
Placement samples two characters per basic row, separately in Read and Recall,
and stops a track at the first gap. Learners can choose one script or both,
resume after leaving, or finish with the progress checked so far. Placement
opens rows; it does not award XP, answers, test results or mastery.

Rows unlock independently for each script and skill. Every character in the
current row must reach Familiar to open the next: basics, voiced sounds,
joined sounds, then extended katakana. Read/Recall familiarity requires at
least three correct unassisted answers and 80% unassisted accuracy in the
recent window. The next row opens without demanding full mastery first.
Tests become available when every basic row for that script and skill is
unlocked. Existing studied rows retain access when an older account migrates.

## Mastery and handwriting

One map shows New, Introduced, Learning, Familiar, Confident, Mastered and
Mastered+. Tapping a character explains Read, Recall and Handwrite separately.
Earned skill milestones are retained. Starting Recall does not subtract Read
progress, and later mistakes can suggest review without erasing an earned
milestone. A strong Read skill is visible even while Recall is still new.

Mastered requires both Read and Recall. Their existing strict performance
policy remains: 50 correct, at least 95% lifetime accuracy, average response
at most one second, plus the existing recent and spaced recall evidence
(eight unassisted attempts, 95% recent accuracy, four study days and four
spaced steps). Comparisons use unrounded values. Legacy evidence retains its
existing compatibility policy; older counters do not fabricate new recall events.

Mastered+ additionally requires Handwrite mastery. One clean independent
completion reaches Familiar, three across two days reach Confident, and five
across three days reach Mastered. Trace guides help learning but do not satisfy
independent writing. Watching or stepping through strokes awards nothing.
Multi-character kana require every part. Handwriting never gates Read, Recall,
tests or normal Mastered status, and does not award XP. Shape feedback remains
stroke guidance rather than general handwriting recognition.

## Session consolidation

One shared setup form replaces both copies of presets and mode-button menus.
Practice offers 10/20/30 answers or unlimited practice, with explanatory or
quick feedback. Hints are directly accessible. Daily sessions, timed challenges,
sequences and tests remain distinct because they train different outcomes.
Timed practice preserves both a 60-second score challenge and a configurable
answer-target challenge. Weak-character focus, confusable practice, row
selection, due review and both Recall input methods remain available.

All session pools respect the unlocked curriculum. Daily sessions use the
selected unlocked rows. Fixed assessments keep hints off. The existing session
engines, raw history identifiers and results are retained for save compatibility;
new navigation and shared configuration own the presentation. Old duplicated
row builders, preset UI and mastery rendering were removed at their owners.

## Persistence and backend

The bounded Kana learning section stores earned milestones, placement receipts,
introductions and handwriting evidence. Merges union offline progress instead
of allowing one device to erase another's milestones. Local checkpoints use the
existing transaction owner and are cleared on account changes/reset. Backups
include learning progress. XP, currency, items, historical sessions and raw
Read/Recall evidence are not reset or re-awarded.

The Firebase public-profile projection is version 5 and uses the same mastery
owner as the app, including Mastered+. The supplied Mac command rebuilds and
deploys that backend before syncing iOS. No new indexes, rules, entitlements,
plugins or provisioning profiles are required. This release publishes the
development branch and a draft PR; the agent does not merge main, deploy
Firebase production or upload TestFlight.

## Validation

Coverage checks fresh entry, placement resume and malformed checkpoints,
independent row access, exact mastery thresholds, hints, migration, convergent
saves, cloud backup/reset, public profile counts, real pointer handwriting,
compact web/iOS layouts and existing session behaviours. Release validation
also covers website packaging, Firebase emulators and unsigned native builds.
The local release gate passed 217 JavaScript tests and 15 Python packaging
tests. The long, isolated trainer matrix now runs across CI workers and shards
instead of serially within one file. Final CI counts and timings are recorded
in the release handoff.

Physical device follow-up: try both first-entry choices on a fresh guest;
finish an A-row without hints and check the next row in that skill; verify the
other skill retains its own path; trace and then write a kana; compare earned
milestones on another signed-in device. Device audio and drawing feel still
need an iPhone/iPad check.

## Mac update

Close Xcode, then run:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.106.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.106.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.106.0' &&
npm ci &&
npm run social:install &&
npm run build:social &&
npm run social:deploy &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

The backup preserves the local Mode Atlas Development signing choices. Package
resolution runs afresh; the old Package.resolved is backed up but not restored.
Select App and your iPhone, press Cmd+R, and check **2.106.0 / 2080028**.
