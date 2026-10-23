# Mode Atlas 3.0.5 — design regression and Duo corrections

Prepared 23 October 2026. iOS build **2080051**.

For the current update and Xcode commands, use the [3.0.6 handover](development-3.0.6.md).

## Why the regressions happened

1. **Unapproved artwork substitution in 3.0.2.** Commit `b925f31` changed the native
   and generated web navigation from the approved `nav-learn`, `nav-progress`,
   `nav-friends` and `nav-shop` illustrations to older monochrome utility symbols.
   It then recorded that substitution as a design rule. That was an assistant
   decision, not user approval. The subsequent Duo changes inherited it. The SVG
   artwork, neutral palettes, collection themes and fonts were still present.
2. **Incomplete layout checks.** 3.0.4 covered short outer/inner windows but did
   not exercise a running trainer in a tall inner window. Its width-only two-column
   rule produced the wrong composition there. Scroll alignment could not add the
   space needed to centre a short task. Home also retained a narrow display-mode
   width cap after expansion. Bounds-only checks missed the visual identity change.
3. **A changed Mac workflow.** The recent handover created a new project path and
   forced the highest discovered Xcode app. It copied signing settings but not
   workspace user state. Xcode 27 supports a theme per workspace, so this explains
   how a fresh checkout can show a different theme as well as a different window
   layout. No repository command was found that deletes or resets global theme
   preferences. The user's actual Mac preferences were not available to inspect.

The [full regression review](reviews/3.0.5/regression-review.md) records source
owners, retained changes, corrected visual roles and validation.

## Changes

- Restored the approved illustrated destinations in iOS and the website; utility
  controls keep their existing icon family. Corrected the erroneous visual rule
  and the corresponding PDF ledger entry.
- Native running practice stacks in tall windows and uses two columns only when
  the window is wide and its content can support them. The task is centred in the
  measured usable area above the keyboard. Actions and long prompts reflow; large
  text retains scrolling. Removed the competing native delayed-scroll alignment.
  Exit focus is centred in the bottom dock instead of relying on an ineffective grid rule.
- Reduced Kana section/setup height in short native windows. Start and Adjust
  remain reachable together, with the same approved controls and colour tokens.
- Kana's explicit Start now enters the configured session directly through the
  existing trainer. It preserves Read, Recall, mixed input, rows and modifiers.
  An unfinished checkpoint still offers Resume/Discard instead of being overwritten.
- Native Home uses available width immediately after expansion, including the
  returning-user personal overview. Existing first-use disclosure is retained.
- Local toolchain validation respects `DEVELOPER_DIR` or the user's `xcode-select`
  choice. Automatic discovery is explicit `--ci` only. The handover updates the
  original project directory and opens it through the normal macOS file association,
  without selecting a different toolchain or writing IDE preferences.

No backend deployment, data reset or save migration is required by this update.
Coin-purchase placeholders remain. This release addresses the reported regressions;
it does not claim completion of the separate outstanding educator, learner,
production and physical-device acceptance items in the PDF ledger.

## Mac handover code

If the previous command stopped with conflicts in `project.pbxproj` and
`Info.plist`, use the [recovery command](ios-update-recovery.md) first. The original
handover covered unrelated local edits but missed simultaneous native metadata
changes. This command now invokes the tested recovery when those files conflict.

Use the **original project folder that had your preferred Xcode layout/theme**.
The usual path is `~/mode-atlas`; change only that `cd` line if your original
project is elsewhere. This updates that folder, backs up its Xcode project/user
state and theme files, and preserves local edits. A local update branch is created
only if the current branch cannot fast-forward; the project path stays the same.

```bash
bash <<'MODE_ATLAS_UPDATE'
set -euo pipefail
cd "$HOME/mode-atlas"

mode_atlas_branch=agent/mode-atlas-2.68.0-ios-theme
mode_atlas_stamp=$(date +%Y%m%d-%H%M%S)
mode_atlas_backup="$HOME/ModeAtlas-backups/3.0.5-$mode_atlas_stamp"
mkdir -p "$mode_atlas_backup"
cp -R ios/App/App.xcodeproj "$mode_atlas_backup/"
if test -d "$HOME/Library/Developer/Xcode/UserData/FontAndColorThemes"; then
  cp -R "$HOME/Library/Developer/Xcode/UserData/FontAndColorThemes" "$mode_atlas_backup/"
fi

git fetch origin "refs/heads/$mode_atlas_branch:refs/remotes/origin/$mode_atlas_branch"
mode_atlas_stash=
if test -n "$(git status --porcelain --untracked-files=normal)"; then
  git stash push --include-untracked -m "Before Mode Atlas 3.0.5 $mode_atlas_stamp"
  mode_atlas_stash=$(git rev-parse refs/stash)
fi
if git merge-base --is-ancestor "origin/$mode_atlas_branch" HEAD; then
  :
elif git merge-base --is-ancestor HEAD "origin/$mode_atlas_branch"; then
  git merge --ff-only "origin/$mode_atlas_branch"
else
  git switch -c "update/mode-atlas-3.0.5-$mode_atlas_stamp" "origin/$mode_atlas_branch"
fi
if test -n "$mode_atlas_stash"; then
  if ! git stash apply --index "$mode_atlas_stash"; then
    if test -z "$(git diff --name-only --diff-filter=U)"; then
      printf 'Stash restoration stopped without a native merge conflict. Your stash is retained.\n' >&2
      exit 1
    fi
    npm ci
    node recover_ios_update.cjs --apply
  fi
fi

python3 select_ios_toolchain.py
npm ci
npm run ios:sync
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
npm run ios:open
printf '\nUpdated existing project: %s\nBackup: %s\n' "$PWD" "$mode_atlas_backup"
MODE_ATLAS_UPDATE
```

The stash is retained as a backup. Native metadata conflicts are merged by field,
with current release versions and Duo configuration retained. An ambiguous custom
setting or a conflict outside those two files stops before writing either file;
do not replace the whole project with an older backup or run
a destructive reset. Ignored signing/widget configuration and `xcuserdata` stay
in the original directory. The final two steps resolve Swift packages and open
the existing project with the normal `ios:open` command. They do not select a
different toolchain or write Xcode theme/window preferences.

The original `~/mode-atlas/ios/App/App.xcodeproj` opens automatically. If an older
timestamped checkout is also open, use the original project's window. Select
**App**, then your simulator/device, and press **⌘R**. Confirm **3.0.5 / 2080051**.

If a theme was already changed in Xcode itself, use **Settings → Appearance →
Theme → Choose** to select your saved theme for the original workspace. Apple's
theme documentation describes importing older `.xcolortheme` files from
`~/Library/Developer/Xcode/UserData/FontAndColorThemes`. This update preserves
those files; it does not guess or overwrite your preferred theme.

Apple references: [workspace themes](https://developer.apple.com/documentation/xcode/customizing-your-workspace-using-themes),
[Xcode 27 workspace themes demonstration](https://developer.apple.com/videos/play/wwdc2026/258/),
[command-line tool selection](https://developer.apple.com/documentation/xcode/configuring-command-line-tools-settings).

## Publication and validation

The release check passed **280 JavaScript tests and 23 Python tests**, plus the
project/security/content audits and native bundle validation. All **114 Duo cases**
passed. The wider 332-case browser run passed 331 cases; one Home scroll test
measured before font/resize settling. Its corrected version passed six repeats.
The final focus-dock correction passed six further cases. The preceding broad
292-case run exposed one obsolete key-height assertion, corrected and passing in
the final release run. Both isolated Git handover cases passed, with dependency
installation and Mac toolchain validation stubbed only in those fixtures. Exact
results are recorded in `reviews/3.0.5/evidence.json`. Browser geometry is a stress fixture, not a claim of physical Duo testing.
Xcode window/theme preservation on the user's Mac cannot be verified from this
Linux workspace. The branch push does not itself publish the production website;
that follows an approved main merge and the deployment workflow.
