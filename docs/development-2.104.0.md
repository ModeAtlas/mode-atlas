# Mode Atlas 2.104.0 — Kanji learning

Version 2.104.0, iOS build 2080026. Release date: 15 October 2026.

## Learning

Kanji is a separate learning branch with 2,383 characters in five approximate
study bands: N5 Foundations (84), N4 Everyday (169), N3 Connections (387),
N2 Fluency (398), and N1 Advanced (1,345). These are independent study estimates,
not an official JLPT syllabus or an endorsement by its organisers.

- **Learn:** character, English meanings, on’yomi and kun’yomi, kana/romaji toggle,
  bilingual reading guidance and dictionary-linked vocabulary where available.
- **Recall · Pronunciation:** type kana, or enter romaji that converts to kana.
  A real word supplies reading context. Characters without a suitable example
  explicitly ask for an on’yomi reading, or show a kun’yomi word with okurigana.
- **Recall · Meaning:** type an English meaning; dictionary alternatives, common
  spelling variants and numerical equivalents are accepted.
- **Meaning Match:** choose a meaning from four options, with shared-meaning and
  common near-synonym distractors excluded.
- Sets of 5, 10, 20 or 40 characters, new-character and due-review selections,
  hints, pause/resume, skips and mistake revisits. Twenty-question formal tests
  are available for all three practice variants.

A character completes its level requirement after three unassisted correct
answers in each typed skill, at 80% overall accuracy or better. Every character
in a band must be complete before the next band opens. Completed levels remain
open. Teaching and multiple-choice exposure do not substitute for typed recall.

Kanji mastery is deliberately separate from level completion. Reviewing requires
10 unassisted correct, 85% accuracy, two study days and two spaced successes.
Mastered requires 30 unassisted correct, 95% accuracy, four study days, four
spaced successes and a streak of three independent successes, in both skills.
Typing time is informative rather than a mastery gate. Thresholds use unrounded
values. Mistakes can reduce current mastery without closing an unlocked band.

## Shared app integration

Results now has a shared Kana/Kanji switch. The Kana engine and history remain
intact; Kanji has its own result schema and renderer, retaining the latest 30
tests. The Mastery Map has a separate Kanji section with level navigation,
per-skill evidence, progress counts and practice links.

Kanji contributes to account XP, Study Tokens, study streaks, rotating goals and
weekly recaps. Hints and multiple choice earn a reduced rate. New Kanji goals
join the rotation once the learner has started practising Kanji. Due Kanji
reviews appear on Home and Progress with direct links to the relevant skill.
The Learn hub, web homepage and native destination router include Kanji.

The live weekly ladder verifies Kanji answers on the server using the same
immutable dictionary and grading policy. It checks the declared pool, level,
answer order, elapsed time, ownership and duplicate receipts. Offline learning
continues to earn personal progress; it does not fabricate live competition
receipts. Existing personal-progress trust and shop authority remain unchanged.

## Ownership, persistence and data

Dedicated modules own curriculum building, content/grading, learning evidence,
sessions, result history, page rendering and mastery rendering. Shared owners
handle navigation, persistence, progress, goals and weekly competition.

Device-source cumulative evidence merges without counting a repeated save twice.
Session checkpoints are account-owned and device-local; the shared write-ahead
journal commits an answer, XP and checkpoint together. Recovery restores the
original committed answer after an interrupted write. Signing out/resetting
clears Kanji evidence, results and checkpoints with the existing account boundary.

Cloud encoding compresses only the Kanji evidence at the account sync boundary;
local state and portable backups remain plain. Completion markers stay available
to backend services. Five fully populated device histories round-trip within a
600 KB Kanji budget in the capacity test, leaving room in the account document.
Corrupt/unsupported compressed saves fail visibly instead of replacing progress.
Account identity is rechecked after asynchronous encoding and before writing.

The offline dataset is adapted from OpenJLPT, JMdict, KANJIDIC2 and Jonathan
Waller’s approximate level assignments under CC BY-SA 4.0. Attribution and the
full licence ship with web and iOS and are linked from Kanji → Learning sources.
`build_kanji_data.py --source /path/to/OpenJLPT` reproducibly refreshes the data;
see `assets/data/kanji-NOTICE.txt` for the pinned source revision and monthly
refresh procedure. No Tatoeba sentences are distributed.

## Validation and release

Focused tests cover curriculum integrity, accepted/rejected answers, romaji/IME,
level gates, exact mastery thresholds, convergent saves, storage failures,
account changes during sync, compression capacity, all three test modes,
shared Results and mastery navigation, due-review links, and small/large layouts.
Firebase checks exercise real Auth/Firestore rules and the Kanji receipt service.
The required exact-commit GitHub release gate also covers existing app regression
suites, callable transport, native intents, simulator builds and an unsigned
Release archive. Final check counts and measured workflow time are in the handoff. Independent progression and Kanji browser cases are sharded individually to reduce the measured imbalance between regression workers; all checks are retained.

Deploy Firebase before installing updated clients, so live Kanji competition and
shared reward rules are available. There are no new Apple entitlements, signing
capabilities, provisioning profiles or Firestore indexes. This handoff publishes
the development branch only; production merge, Firebase deployment and signed
device/TestFlight installation remain separate steps.

## Physical-device checks

1. Learn five N5 characters; toggle romaji, leave/reopen the app and resume.
2. Try Pronunciation with the Japanese keyboard and romaji. Confirm keyboard
   composition does not submit an unfinished answer.
3. Complete a test and switch between Kana and Kanji results. Check a character
   in the Kanji mastery map and follow its practice link.
4. Practise offline while signed in, reconnect and check sync, XP and tokens.
   On a second device, check the same character evidence and saved test history.
5. After deploying the backend, join the weekly ladder and complete a live
   Kanji set. Confirm its verified score appears once.

## Mac update

Close Xcode, then run:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.104.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.104.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.104.0' &&
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
Select App and your iPhone, press Cmd+R, and check **2.104.0 / 2080026**.
