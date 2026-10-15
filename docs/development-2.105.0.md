# Mode Atlas 2.105.0 — Guided learning and handwriting

Version 2.105.0, iOS build 2080027. Release date: 15 October 2026.

## Learning experience

Kanji Learn now teaches a character in three steps: Meet, Meaning, Reading.
A compact introduction pairs its shape with a useful word, pronunciation audio,
a short memory cue and a reading explanation. The learner checks the meaning
and pronunciation before continuing. Incorrect checks return to the lesson;
flipping through pages cannot mark an introduction complete.

The fixed opening sequence is 一 二 三 人 日 月 木 山 川 水, normally five
characters at a time. Completing the two recognition checks for all ten opens
the rest of N5. Later lessons remain ordered, favouring simpler stroke counts.
Existing studied characters and completed levels retain access. Introduction
checks are separate from typed completion and spaced mastery; the existing
three-per-skill band completion rules remain unchanged.

Recall and tests select familiar characters. The end of a lesson links directly
to pronunciation and meaning recall for the same set. Pronunciation questions
include the word's meaning to distinguish readings that depend on context.
Dictionary answer policy is unchanged, including compatibility with existing
weekly competition clients. There is no automatic speech recognition or pitch
accent scoring.

On’yomi and kun’yomi have plain-language explanations with an example. Extra
readings, dictionary notation and the Japanese explanation are expandable.
Kana/romaji preference persists. Spoken audio uses the device's Japanese voice:
AVSpeechSynthesizer on iOS and Japanese speech-synthesis voices on the web.
Listen and Slower are explicit actions; navigation/backgrounding stops playback.
A device without a Japanese voice receives instructions when playback is requested.

## Optional handwriting

Both branches use one handwriting tool: watch stroke order, advance one stroke
at a time, trace a guide, or write from memory. Mouse, finger and pen use the same
pointer input. Guidance checks stroke direction and shape with tolerance, with
Undo and Clear. This is stroke guidance, not general handwriting recognition;
handwriting does not gate learning, award XP or manufacture mastery evidence.

Kanji lessons open the tool through Write it. Kana has a dedicated Handwriting
page, linked from Learn and the Kana navigation, with separate basic, dakuten,
combined and extended rows. Multi-character kana are practised one character
at a time. Reduced-motion users can step through strokes without animation.

The six lazy-loaded, revisioned data shards cover all 2,383 Kanji characters plus
177 kana/marks, including ー. iOS packages them offline. Ordered SVG paths come
from KanjiVG at revision 70a0b7ae0c18ceb5cb358274b029cce0234a43bc, by Ulrich Apel
and contributors, under CC BY-SA 3.0. Attribution, adaptation details and the
full licence ship in both products. Regenerate using build_handwriting_data.py
with a reviewed checkout; no live third-party artwork requests are made.

## Branch ownership and persistence

Learn presents Kana, Kanji and Word Bank as three sibling branches. Kana owns
hiragana/katakana reading, sound-to-kana matching and handwriting. Kanji owns
character teaching, meaning/pronunciation recall and optional handwriting.
Word Bank owns the user's vocabulary, meanings and notes. Results stays shared.

Teaching content, lesson rendering, session state, stroke matching, the drawing
surface and platform audio each have a single owner. Old dictionary-only lesson
markup and its unused styles were removed. No separate iOS learning engine was
introduced. Native speech stays behind the existing platform adapter.

Checked introductions merge by character and sync with the existing Kanji save.
Lesson steps and feedback are checkpointed through the shared storage transaction
owner. Completed introduction checks do not create XP or independent mastery.
Account changes clear the checkpoint and close the writing surface. Existing
history, settings and mastery evidence remain intact.

## Validation

Focused coverage includes fixed ordering, introduction gating, wrong answers,
resuming a lesson, old-account access, convergent/cloud saves, accepted reading
alternatives, path coverage and safety, wrong-direction strokes, mouse/touch,
undo/reset, script/row switching, native audio calls, compact iPhone layouts,
branch navigation and existing test/result flows. Full release checks also run
existing web/iOS, Firebase and native build gates. Final counts and measured CI
time are included in the release handoff.

Physical device follow-up: listen at both speeds; trace a curved kana with a
finger; practise a compound kana; leave/reopen a lesson; compare synced progress
on a second device. Native voice availability, audio quality and pen feel need
the actual device. No Apple entitlement, provisioning profile, Firestore index
or account migration is required. This release publishes the development branch;
main, Firebase production and TestFlight are not changed by the agent.

## Mac update

Close Xcode, then run:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.105.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.105.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.105.0' &&
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
Select App and your iPhone, press Cmd+R, and check **2.105.0 / 2080027**.
