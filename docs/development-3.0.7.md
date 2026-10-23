# Mode Atlas 3.0.7 — room for the shop and closed-Duo landscape

Prepared 24 October 2026. iOS build **2080053**.

## What changed

- The account Shop no longer pins its wallet and full-shop link over the items.
  Balances use a compact row; Buy 500 coins and See full shop sit side by side
  when they fit, and all of it scrolls with the products. Coin placeholders,
  token information, product previews and purchasing behavior remain available.
- Closed landscape can use a side dock with a phone-width content area. It first
  uses the clear system-side strip. Short strips use tighter spacing with the
  original illustrations and labels, and targets of at least 52 pixels. The
  normal rail keeps its 64-pixel minimum. Expanding system UI or larger text can
  move the dock inside the safe area or return it to the bottom.
- Native Kana tabs stay compact after rotation. Short, sufficiently wide Kana
  Practice views place skill selection beside the session card so the primary
  action fits on screen. Wider text and narrower windows return to one column.
- Native geometry and font metrics choose the layout. There is no device-name
  detection, fixed Duo specification, save migration or backend change.

The causes were a sticky wallet/header, a 600-pixel minimum content width for a
side dock, and a viewport-width breakpoint that restored oversized desktop Kana
tabs after rotation. These are fixed in their source owners. The established
artwork, theme system and Xcode preference handling are retained.

## Validation

Release checks passed: **297 JavaScript tests and 23 Python tests**, including the
existing Mac stash-recovery tests. **184 browser regression cases and 12 mobile iOS-shell cases passed**. CI results and evidence are recorded
in [the review](reviews/3.0.7/duo-compact-review.md).

The supplied photos were assessed, and browser fixtures reproduce their
proportions. Their system-area labels are test annotations. These checks are not
a physical Duo run; Device Hub/device presentation and touch feel still need to
be checked on the Mac/device. This environment cannot run Xcode locally.

## Mac handover code

Run this in Terminal in your existing checkout. It keeps local signing edits,
ignored Xcode workspace state and themes, retains a backup/stash, and ends by
opening Xcode. It does not deploy the backend. If an earlier update is still
stopped with conflicts, use [the recovery command](ios-update-recovery.md) first.

```bash
bash <<'MODE_ATLAS_UPDATE'
set -euo pipefail
cd "$HOME/mode-atlas"

mode_atlas_branch=agent/mode-atlas-2.68.0-ios-theme
mode_atlas_stamp=$(date +%Y%m%d-%H%M%S)
mode_atlas_backup="$HOME/ModeAtlas-backups/3.0.7-$mode_atlas_stamp"
mkdir -p "$mode_atlas_backup"
cp -R ios/App/App.xcodeproj "$mode_atlas_backup/"
if test -d "$HOME/Library/Developer/Xcode/UserData/FontAndColorThemes"; then
  cp -R "$HOME/Library/Developer/Xcode/UserData/FontAndColorThemes" "$mode_atlas_backup/"
fi

git fetch origin "refs/heads/$mode_atlas_branch:refs/remotes/origin/$mode_atlas_branch"
mode_atlas_stash=
if test -n "$(git status --porcelain --untracked-files=normal)"; then
  git stash push --include-untracked -m "Before Mode Atlas 3.0.7 $mode_atlas_stamp"
  mode_atlas_stash=$(git rev-parse refs/stash)
fi
if git merge-base --is-ancestor "origin/$mode_atlas_branch" HEAD; then
  :
elif git merge-base --is-ancestor HEAD "origin/$mode_atlas_branch"; then
  git merge --ff-only "origin/$mode_atlas_branch"
else
  git switch -c "update/mode-atlas-3.0.7-$mode_atlas_stamp" "origin/$mode_atlas_branch"
fi
if test -n "$mode_atlas_stash"; then
  npm ci
  node recover_ios_update.cjs --apply "--stash=$mode_atlas_stash"
fi

test "$(node -p "require('./package.json').version")" = '3.0.7'
python3 select_ios_toolchain.py
npm ci
npm run ios:sync
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
npm run ios:open
printf '\nUpdated existing project: %s\nBackup: %s\n' "$PWD" "$mode_atlas_backup"
MODE_ATLAS_UPDATE
```

In Xcode, select **App**, choose the Duo, then press **⌘R**. Confirm **3.0.7 /
2080053**. The branch push is separate from the production website; the web update
follows your main merge and deployment workflow.
