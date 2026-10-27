# Mode Atlas 3.1.0 — Connected learning foundations

27 October 2026 · iOS build **2080055**

## Scope and decisions

This release connects Kana, Kanji and Words into a usable foundations course.
It does not equate finishing lessons or transliterating kana with knowing
Japanese. Recognition, independent recall, listening and handwriting remain
separate evidence. Home stays the app-wide hub; Learn remains the directory;
each branch owns its learning activities.

- Kana: staged character teaching, recognition/listening/typed checks, resumable
  row lessons, Learn → Read → Recall guidance, mixed practice from encountered
  characters, optional handwriting and sound-pattern workshops.
- Kanji: invitation after three Familiar hiragana Read rows, with early access
  retained. Small lessons lead to meaning/reading recall, due review and tests;
  completed bands offer the next band. Mistakes lead back to retrieval practice.
- Words: a curated 146-word isolated vocabulary course beside the existing personal Word Bank.
  Kana and Kana + Kanji pools depend on encountered characters and sound patterns.
  Four independently tracked tasks open progressively: kana → romaji, kana →
  English, English → romaji, English → kana. Existing phrases remain secondary.
- Shared UI: consistent Words naming, branch-aware continuation and reminders,
  concise next actions and larger-text layouts for short screens. Approved art,
  themes, purchase placeholders and developer-only manual saves stay intact.

Kana → romaji is decoding, not translation. Unlocking the next task gives access
to learn it; it does not award its progress. Three familiar rows is a transparent
product milestone for suggesting Kanji, not a research-established cutoff.
Handwriting strengthens character study but does not block reading progression.

Research, educational rationale and release acceptance criteria are in
[the learning review](reviews/3.1.0/learning-research.md).

## Validation

- Release audits, **319 JavaScript tests and 23 Python tests passed**.
- Full **500-case Chromium regression suite passed**; the subsequent final Kana
  account/lesson checks passed all 11 cases. Existing personal-bank and phrase
  migrations also passed 48 cases across desktop/mobile Chromium.
- **40 targeted WebKit cases passed**, followed by all 11 final Kana cases;
  five Kanji flow/layout cases also passed in WebKit.
- Rendered fixtures were inspected at narrow, wide and short dimensions, in both
  appearances and larger text. Eight screenshots and run counts are recorded in
  [the evidence manifest](reviews/3.1.0/evidence.json).
- GitHub checks the native simulator build, unsigned Release archive and final
  merged-source workflows. Final CI links and status are attached to the PR.

The sweep preceded two final Kana correctness fixes and the Kanji due-session
telemetry fix; those affected flows were rechecked afterward. No failed case is
being counted as passing without its corrective verification.

## Scope of completion

The first-use path, lessons, practice pools, review schedules, tests and next-step
navigation form a connected foundations course. Tests check the taught skill;
neither completed lessons nor a single successful test claim lasting mastery.

Kanji's N5 foundation has 84 focused example words and individually written
memory cues. The advanced catalogue remains available, but most later memory
cues use general guidance and eight N1 characters use a character-reading
fallback instead of a focused example word. This release does not claim that
advanced content has received a complete independent Japanese editorial review.
Vocabulary has 146 selected isolated words with sense cues and accepted reading
variants. Real learner observation and human Japanese review remain useful
acceptance work; browser fixtures do not constitute tests on a physical Duo.

## Data and compatibility

Existing learning, personal words and phrase lessons are retained. New Kana
checkpoints use the existing kanaLearning section. Vocabulary evidence travels
inside the existing wordBank lesson section with its normal account reset,
cloud and merge ownership; no second vocabulary save store is introduced.
Word practice is personal learning; it does not mint verified competitive XP.

## Mac update

Run in Terminal in the existing checkout. The command backs up the project and
Xcode colour themes, retains local changes with the established recovery tool,
then opens Xcode. If a previous update has unresolved Git conflicts, use the
[existing recovery guide](ios-update-recovery.md) first.

```bash
bash <<'MODE_ATLAS_UPDATE'
set -euo pipefail
cd "$HOME/mode-atlas"

mode_atlas_branch=agent/mode-atlas-2.68.0-ios-theme
mode_atlas_stamp=$(date +%Y%m%d-%H%M%S)
mode_atlas_backup="$HOME/ModeAtlas-backups/3.1.0-$mode_atlas_stamp"
mkdir -p "$mode_atlas_backup"
cp -R ios/App/App.xcodeproj "$mode_atlas_backup/"
if test -d "$HOME/Library/Developer/Xcode/UserData/FontAndColorThemes"; then
  cp -R "$HOME/Library/Developer/Xcode/UserData/FontAndColorThemes" "$mode_atlas_backup/"
fi

git fetch origin "refs/heads/$mode_atlas_branch:refs/remotes/origin/$mode_atlas_branch"
mode_atlas_stash=
if test -n "$(git status --porcelain --untracked-files=normal)"; then
  git stash push --include-untracked -m "Before Mode Atlas 3.1.0 $mode_atlas_stamp"
  mode_atlas_stash=$(git rev-parse refs/stash)
fi
if git merge-base --is-ancestor "origin/$mode_atlas_branch" HEAD; then
  :
elif git merge-base --is-ancestor HEAD "origin/$mode_atlas_branch"; then
  git merge --ff-only "origin/$mode_atlas_branch"
else
  git switch -c "update/mode-atlas-3.1.0-$mode_atlas_stamp" "origin/$mode_atlas_branch"
fi
if test -n "$mode_atlas_stash"; then
  npm ci
  node recover_ios_update.cjs --apply "--stash=$mode_atlas_stash"
fi

test "$(node -p "require('./package.json').version")" = '3.1.0'
python3 select_ios_toolchain.py
npm ci
npm run ios:sync
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
npm run ios:open
printf '\nUpdated existing project: %s\nBackup: %s\n' "$PWD" "$mode_atlas_backup"
MODE_ATLAS_UPDATE
```

In Xcode select **App**, choose your Duo, and press **⌘R**. Confirm **3.1.0 /
2080055**. The branch push does not deploy the public website; deployment follows
the main merge and its release workflow.
