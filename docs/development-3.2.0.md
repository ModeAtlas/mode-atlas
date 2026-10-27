# Mode Atlas 3.2.0 — Learning course redesign

27 October 2026, Melbourne · iOS build **2080056**

## What changed

The previous update added learning activities inside the old dashboards. This
release replaces those compositions and their sequencing together. Home resumes
the exact saved task; Learn is the branch directory; each branch owns its course.
The illustrated destination icons, artwork, Light/Dark palettes and collection
themes remain in place.

- **Kana:** a focused course overview, in-place full learning path and one task
  per lesson screen. Small teaching chunks lead through supported practice,
  independent reading/reverse/listening, full-row checks and cumulative checks.
  The listening target cannot be solved by repeating the preceding answer.
  Teaching covers all 240 canonical Kana units. Long vowels, small っ and the
  katakana length mark have contrast listening and spelling/application tasks.
  Optional handwriting and deliberate custom practice remain accessible.
- **Kanji:** 28 authored foundation units covering 84 characters, with explicit
  goals, component/contrast cues and focused word senses. Guided lessons fade
  support and mix character meaning, word reading and word meaning. Unit checks,
  targeted repairs and later reviews are separate from immediate introductions.
  The advanced character library and existing custom tests remain available.
- **Words:** the branch opens to exactly **Learn words** and **Word Bank**. The
  curated course uses the existing 146 isolated words, gated by encountered Kana,
  Kanji and sound patterns. It saves the set and current task, gradually introduces
  all four requested response skills, and gives priority to repairs and due review.
  Word Bank has its own teaching and review flow for selected or all personal
  entries; a selection persists across five-word batches. Existing phrase lessons
  have a separate secondary entry under Learn.
- **Shared UI:** compact Home goals, one continuation action, consistent selected
  and hover colours, one page-back owner, and a shared focused lesson layout.
  Short screens keep the primary action reachable while teaching can scroll.
  Larger-text layouts adapt content and headings instead of stacking controls over
  the prompt. Full learning paths replace the current content without a reload or
  nested dialogs.
- **Data:** original first answers, assisted retries and delayed evidence stay
  distinct. Existing saves, earned access, word entries, schedules, phrase progress
  and purchase placeholders are retained. Manual save-file controls remain in
  Developer Console only. Account switches stop active audio and stale callbacks.
  An identical Word Bank merge does not trigger another cloud write.
  Meaningful guided Kana/Kanji attempts now count toward study days and streaks;
  these bounded habit receipts do not mint competitive answer XP.

The redesigned learning sequence is described in the
[diagnosis and replacement contract](reviews/learning-redesign-2026-10-27.md).
The [acceptance record](reviews/3.2.0/acceptance.md) maps the requested corrections
to implementation and observed checks.

## Validation

Latest outcomes across the broad regression runs and focused rechecks are
recorded in [the evidence manifest](reviews/3.2.0/evidence.json), with
[each deduplicated case](reviews/3.2.0/test-results.json) and ten inspected
screenshots in [the screenshot folder](reviews/3.2.0/screens/).

- **380 JavaScript tests and 23 Python tests passed** in the local release checks.
- **700 distinct browser cases passed; one was explicitly skipped.** Counts are
  deduplicated by file, browser project and full test title: desktop Chromium
  574 passed, mobile Chromium 31 passed, and WebKit 95 passed plus one skip.
  The skipped WebKit handwriting case requires Chromium CDP touch-drag injection;
  Chromium browser coverage and stroke-matching unit tests still run.
- A separate **scripted model traversal covered all 146 curated words**, through
  221 sessions and 778 responses, ending with all 146 covered by checkpoints.
  Character and sound prerequisites were introduced for this traversal; it is
  not a complete beginner UI journey or a human learning study.

The ten browser runs contain 786 original executions. Their nine initial failed
executions remain visible in the manifest, alongside the later passing results
for those cases. The 700-pass total reports the latest outcome for each unique
case; it does not relabel the earlier broad runs as wholly green.

GitHub validates the native simulator build, unsigned Release archive, backend
access rules and browser gates on the published commit. Its final status is
linked in the pull request and is separate from the local results above.

## Honest limits

The new authored Kanji course covers the 84-character foundation. The broader
catalogue is preserved, but this update does not claim that every advanced Kanji
entry has an equally authored course or independent Japanese editorial review.
Passing a row/unit check is immediate assessment evidence, not lasting mastery.
Exact chunk sizes, skill thresholds and invitation timing are product decisions.
Automated journeys verify implementation; they do not establish educational
outcomes or replace observation of learners using the app uncoached.

Responsive evidence uses browser and WebKit fixtures with the supplied window
proportions and simulated native safe regions. It is not physical Duo testing.
Audio tests verify the selected text, concealment, playback gating and native
routing; they do not certify the acoustic quality of each installed iOS voice.

No Xcode preference, window-state or signing change is part of this release.
Native project edits contain version/build metadata only. The update command
below uses the existing checkout and preserves local project adjustments.

## Mac update

Copy the whole block into Terminal. It backs up the existing Xcode project and
colour themes, retains local changes through the established recovery tool,
updates the shared backend policy, synchronizes the new web bundle and **opens Xcode**. It does not replace the new
project with an old project file or change your selected Xcode.

```bash
bash <<'MODE_ATLAS_UPDATE'
set -euo pipefail
cd "$HOME/mode-atlas"

mode_atlas_branch=agent/mode-atlas-2.68.0-ios-theme
mode_atlas_stamp=$(date +%Y%m%d-%H%M%S)
mode_atlas_backup="$HOME/ModeAtlas-backups/3.2.0-$mode_atlas_stamp"
mkdir -p "$mode_atlas_backup"
cp -R ios/App/App.xcodeproj "$mode_atlas_backup/"
if test -d "$HOME/Library/Developer/Xcode/UserData/FontAndColorThemes"; then
  cp -R "$HOME/Library/Developer/Xcode/UserData/FontAndColorThemes" "$mode_atlas_backup/"
fi

git fetch origin "refs/heads/$mode_atlas_branch:refs/remotes/origin/$mode_atlas_branch"
mode_atlas_stash=
if test -n "$(git status --porcelain --untracked-files=normal)"; then
  git stash push --include-untracked -m "Before Mode Atlas 3.2.0 $mode_atlas_stamp"
  mode_atlas_stash=$(git rev-parse refs/stash)
fi
if git merge-base --is-ancestor "origin/$mode_atlas_branch" HEAD; then
  :
elif git merge-base --is-ancestor HEAD "origin/$mode_atlas_branch"; then
  git merge --ff-only "origin/$mode_atlas_branch"
else
  git switch -c "update/mode-atlas-3.2.0-$mode_atlas_stamp" "origin/$mode_atlas_branch"
fi
if test -n "$mode_atlas_stash"; then
  npm ci
  node recover_ios_update.cjs --apply "--stash=$mode_atlas_stash"
fi

test "$(node -p "require('./package.json').version")" = '3.2.0'
python3 select_ios_toolchain.py
npm ci
npm run social:install
npm run build:social
npm run social:deploy
npm run ios:sync
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
npm run ios:open
printf '\nUpdated existing project: %s\nBackup: %s\n' "$PWD" "$mode_atlas_backup"
MODE_ATLAS_UPDATE
```

In Xcode select **App**, choose your device, and press **⌘R**. Confirm **3.2.0 /
2080056**. The requested branch push does not publish the website: website
publication follows a main merge and its successful release workflow.
