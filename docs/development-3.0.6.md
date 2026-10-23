# Mode Atlas 3.0.6 — use the clear Duo workspace

Prepared 23 October 2026. iOS build **2080052**.

## What changed and why

The four reported screenshots exposed three source problems: a whole-height
system inset remained even below the camera/status region, a resumed session
occupied only one column of the setup grid, and Home hid its illustration while
retaining the illustration column. The navigation artwork and theme system are
unchanged.

- Running Kana practice expands its card and keyboard into the clear side strip.
  Only rows beside the system region or Exit focus control retain a side inset.
  Hiding a non-shared navigation rail also releases its reserved width.
- Profile, Shop and Settings use the clear width below their protected header and
  tabs. Their existing scrolling, focus handling and bottom-dock clearance remain.
- Shared popups, practice setup and handwriting use the clear rectangle below
  system UI. If a short window or software keyboard leaves too little height,
  shared popups retain the ordinary safe rectangle. Handwriting places its board
  and supporting controls beside each other where they fit. Completed strokes
  survive region changes; only an unfinished stroke is cancelled.
- First-use consent, guided tours and the developer console also respect that
  clear rectangle. Tour cards reposition when native system regions move.
- Word lessons pair the word/audio with its example in wider native dialogs.
  Wide Kanji teaching pairs the character with its reading/context. Narrow
  layouts retain the same learning sequence and actions.
- Resume/Discard span the complete setup grid. Home restores its existing Kana
  illustration when two columns fit, and uses three branch cards when their
  content fits. First-use statistics remain hidden.

The native bridge now explicitly reports whether UIKit reserved-region data has
been read. Older shells, missing data and stale resize snapshots retain safe-area
insets. No device dimensions or device-name detection determine the expansion.
The upper system strip remains protected even when the hardware camera is not
listed separately from the status UI.

## Validation

Local checks passed: **297 JavaScript tests, 23 Python tests, 148 distinct browser
cases across the regression runs, and 12 mobile iOS-shell checks**. The final
49-case run covers the popup changes and their existing user flows. Results and rendered evidence are recorded in
[the review](reviews/3.0.6/duo-space-review.md).

Browser fixtures simulate native geometry; their labelled system areas are test
annotations, not screenshots of UIKit. Native compilation is checked separately
by GitHub CI. Actual Device Hub/device presentation remains a Mac acceptance
check. No backend deployment, save migration or Xcode preference change is needed.

## Mac handover code

Use your original `~/mode-atlas` folder. If an earlier update is still stopped at
a native-file conflict, use [the recovery command](ios-update-recovery.md) first.
This updates in place, preserves local settings and finishes by opening Xcode.
The recovery helper also handles an indexed stash patch failing before Git
creates conflicts; it retains the stash and reports any staging-state fallback.

```bash
bash <<'MODE_ATLAS_UPDATE'
set -euo pipefail
cd "$HOME/mode-atlas"

mode_atlas_branch=agent/mode-atlas-2.68.0-ios-theme
mode_atlas_stamp=$(date +%Y%m%d-%H%M%S)
mode_atlas_backup="$HOME/ModeAtlas-backups/3.0.6-$mode_atlas_stamp"
mkdir -p "$mode_atlas_backup"
cp -R ios/App/App.xcodeproj "$mode_atlas_backup/"
if test -d "$HOME/Library/Developer/Xcode/UserData/FontAndColorThemes"; then
  cp -R "$HOME/Library/Developer/Xcode/UserData/FontAndColorThemes" "$mode_atlas_backup/"
fi

git fetch origin "refs/heads/$mode_atlas_branch:refs/remotes/origin/$mode_atlas_branch"
mode_atlas_stash=
if test -n "$(git status --porcelain --untracked-files=normal)"; then
  git stash push --include-untracked -m "Before Mode Atlas 3.0.6 $mode_atlas_stamp"
  mode_atlas_stash=$(git rev-parse refs/stash)
fi
if git merge-base --is-ancestor "origin/$mode_atlas_branch" HEAD; then
  :
elif git merge-base --is-ancestor HEAD "origin/$mode_atlas_branch"; then
  git merge --ff-only "origin/$mode_atlas_branch"
else
  git switch -c "update/mode-atlas-3.0.6-$mode_atlas_stamp" "origin/$mode_atlas_branch"
fi
if test -n "$mode_atlas_stash"; then
  npm ci
  node recover_ios_update.cjs --apply "--stash=$mode_atlas_stash"
fi

test "$(node -p "require('./package.json').version")" = '3.0.6'
python3 select_ios_toolchain.py
npm ci
npm run ios:sync
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
npm run ios:open
printf '\nUpdated existing project: %s\nBackup: %s\n' "$PWD" "$mode_atlas_backup"
MODE_ATLAS_UPDATE
```

In Xcode, select **App**, choose your device/simulator, then press **⌘R**.
Confirm **3.0.6 / 2080052**. The branch push does not itself publish the production
website; that follows your main merge and deployment workflow.
