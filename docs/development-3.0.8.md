# Mode Atlas 3.0.8 — Duo outcomes, Help and save-file policy

Prepared 24 October 2026. iOS build **2080054**.

## What changed

- Completion and level-up dialogs centre in the taller native safe area beside
  system UI. Wide Kana results place learning and rewards side by side; short
  landscape level-ups place the emblem beside the message. Word Bank completion
  uses the same safe placement. Scrolling, actions and content survive rotation.
- Rewards explicitly use 100% mobile text adjustment within the collection.
  Opening full-width categories no longer asks iOS to recalculate a larger text
  scale. The existing rem sizes and native Dynamic Type scale remain in charge.
- Settings → Help provides seven searchable topics, with one article open at a
  time. Nine repeated explanation controls were removed from their former pages.
  Lesson hints, progress evidence, functional categories and confirmations stay
  beside the task. Weekly opt-out remains directly available on its board.
- Settings no longer offers learning-file export or restore. The three public
  learning-backup APIs and their import bypass are removed. Developer Console →
  Storage → Save files retains the existing guarded testing tools. Automatic
  saving, cloud sync, repair and confirmed reset remain available.
- Approved illustrations, collectible themes, coin-purchase placeholders and the
  existing Mac update/recovery workflow are retained. No backend deployment or
  data migration is required.

## Why save/load came back

The restriction was implemented in **2.75.0**, commit `5f4dda6`. In **3.0.0**,
commit `96ea537`, the assistant added a separate consumer portability feature:
new Settings buttons, new public backup methods and a `PERSONAL_BACKUP` exception
inside the guarded importer. That contradicted the user's earlier restriction.
It was not caused by Xcode or a server rollback. The accumulated 3.0.2 restoration
retained that code.

The old test checked only the original file-button selectors. The new 3.0 tests
explicitly expected public backups, so the conflicting expectations passed
together. The regression tests now reject the new controls and alternate API,
exercise direct calls as an ordinary account, and retain developer import/export
and access-revocation coverage.

These are application access controls. Client-owned learning data has not become
server-authoritative; the existing server-validated competitive/reward boundaries
are unchanged. No broader security guarantee is claimed.

## Validation

- Release checks: **297 JavaScript tests and 23 Python tests passed**, plus project,
  security, learning-content and native-web packaging checks.
- **311 distinct desktop Chromium regression cases passed across the sweep and
  final verification**, plus **12 mobile Chromium iOS-shell cases**.
- **20 WebKit outcome, reward and Help cases passed** and are now in the release gate; engine
  results and rendered evidence are listed in [the review](reviews/3.0.8/duo-outcomes-review.md).
- GitHub CI checks the native simulator build and unsigned Release archive. Its
  final status is attached to the pull request; Xcode cannot run locally here.

The screenshots use simulated native geometry. Linux WebKit lacks iOS text
inflation, so the exact persistent-font symptom still needs confirmation on the
physical Duo. The autosizing diagnosis is an inference from the supplied image,
width-changing categories, unchanged font rules and Apple's documented behavior.
This is implemented and regression-tested work, not a claim of physical-device
acceptance.

## Mac handover code

Run in Terminal in the existing checkout. This backs up the Xcode project and
colour themes, retains local work in a stash when needed, uses the established
field-level recovery, and **opens Xcode**. Ignored workspace/window preferences
remain in place. If an earlier update is still stopped with conflicts, use the
[existing recovery command](ios-update-recovery.md) first.

```bash
bash <<'MODE_ATLAS_UPDATE'
set -euo pipefail
cd "$HOME/mode-atlas"

mode_atlas_branch=agent/mode-atlas-2.68.0-ios-theme
mode_atlas_stamp=$(date +%Y%m%d-%H%M%S)
mode_atlas_backup="$HOME/ModeAtlas-backups/3.0.8-$mode_atlas_stamp"
mkdir -p "$mode_atlas_backup"
cp -R ios/App/App.xcodeproj "$mode_atlas_backup/"
if test -d "$HOME/Library/Developer/Xcode/UserData/FontAndColorThemes"; then
  cp -R "$HOME/Library/Developer/Xcode/UserData/FontAndColorThemes" "$mode_atlas_backup/"
fi

git fetch origin "refs/heads/$mode_atlas_branch:refs/remotes/origin/$mode_atlas_branch"
mode_atlas_stash=
if test -n "$(git status --porcelain --untracked-files=normal)"; then
  git stash push --include-untracked -m "Before Mode Atlas 3.0.8 $mode_atlas_stamp"
  mode_atlas_stash=$(git rev-parse refs/stash)
fi
if git merge-base --is-ancestor "origin/$mode_atlas_branch" HEAD; then
  :
elif git merge-base --is-ancestor HEAD "origin/$mode_atlas_branch"; then
  git merge --ff-only "origin/$mode_atlas_branch"
else
  git switch -c "update/mode-atlas-3.0.8-$mode_atlas_stamp" "origin/$mode_atlas_branch"
fi
if test -n "$mode_atlas_stash"; then
  npm ci
  node recover_ios_update.cjs --apply "--stash=$mode_atlas_stash"
fi

test "$(node -p "require('./package.json').version")" = '3.0.8'
python3 select_ios_toolchain.py
npm ci
npm run ios:sync
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
npm run ios:open
printf '\nUpdated existing project: %s\nBackup: %s\n' "$PWD" "$mode_atlas_backup"
MODE_ATLAS_UPDATE
```

In Xcode, select **App**, choose the Duo and press **⌘R**. Confirm **3.0.8 /
2080054**. This updates the approved GitHub branch; production web deployment
follows the main merge and its deployment workflow.
