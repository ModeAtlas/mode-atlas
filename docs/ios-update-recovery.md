# Recover a stopped Mac update

The 3.0.6 screenshot shows `patch does not apply` and `conflicts in index. Try
without --index.` for `project.pbxproj`. Git stopped before restoring the working
files, so there were no unmerged files for the previous recovery condition to
detect. The update was fetched; the saved local files remain in the stash.

The earlier 3.0.5 failure created actual conflicts in the project and plist. Both
cases are now handled by the same helper. The normal handover invokes it with the
saved stash hash. It first attempts indexed restoration; if that exact index
failure leaves a clean checkout, it restores the saved files without reinstating
the incompatible old index, then resolves known native fields. It does not retry
a partial restoration or overwrite edits made after the failure.

The app remains **3.0.6 / build 2080052**. This correction changes the Mac update
tooling, tests and handover. See the [3.0.6 handover](development-3.0.6.md) for the
app changes. Git documents the distinction between restoring file changes and
restoring the index in [git-stash](https://git-scm.com/docs/git-stash#Documentation/git-stash.txt---index).

## Resume from either reported failure

Quit Xcode while the files are being recovered. Use the same original checkout;
change only the `cd` line if its path differs. Use this recovery command instead
of rerunning the old full handover.

```bash
bash <<'MODE_ATLAS_RECOVERY'
set -euo pipefail
cd "$HOME/mode-atlas"

mode_atlas_branch=agent/mode-atlas-2.68.0-ios-theme
git fetch origin "refs/heads/$mode_atlas_branch:refs/remotes/origin/$mode_atlas_branch"
mode_atlas_recovery_dir=$(mktemp -d "${TMPDIR:-/tmp}/mode-atlas-recovery.XXXXXX")
git show "origin/$mode_atlas_branch:recover_ios_update.cjs" > "$mode_atlas_recovery_dir/recover_ios_update.cjs"
npm ci
if test -n "$(git diff --name-only --diff-filter=U)"; then
  node "$mode_atlas_recovery_dir/recover_ios_update.cjs" --apply
else
  mode_atlas_stash=$(git stash list --format='%H %gs' | awk 'index($0, ": Before Mode Atlas 3.0.6 ") && !found {print $1; found=1}')
  if test -z "$mode_atlas_stash"; then
    printf 'The saved 3.0.6 update stash was not found. No stash was applied.\n' >&2
    exit 1
  fi
  node "$mode_atlas_recovery_dir/recover_ios_update.cjs" --apply "--stash=$mode_atlas_stash"
fi
git merge --ff-only "origin/$mode_atlas_branch"
python3 select_ios_toolchain.py
npm ci
npm run ios:sync
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
npm run ios:open
printf '\nRecovered and synchronized Mode Atlas in %s\n' "$PWD"
MODE_ATLAS_RECOVERY
```

The temporary helper is read from the fetched repository without trying to check
out a branch over unresolved files. The second dependency install follows the
fast-forward so it uses the final lockfile. The final two steps resolve Swift
packages and open the original project through the normal macOS file association.
Select **App** and the device/simulator, and press **⌘R**.

## What the recovery preserves

- Reads the base, release and saved-local versions from Git's conflict stages.
  Merges non-conflicting local settings, including signing teams and custom plist
  keys. Keeps the current release version/build and supported device/window setup.
- Backs up all three versions, the conflicted working copies and the Git index
  under `.build/ios-update-recovery/` before applying a validated recovery.
- Resolves only the two known native metadata files. Saved file contents,
  untracked files, signing/widget configuration, `xcuserdata`, theme files, the
  current project directory and the stash are retained. When the index cannot be
  reinstated, tracked edits may become unstaged; their original staging layout
  remains in the retained stash. Ordinary indexed restoration keeps its staging.
- Refuses unknown conflicting settings, unrelated conflicts, ordinary merges or
  rebases, and files manually edited after the stash conflict. It plans both
  native files before writing either. An ambiguity is reported by setting name;
  local values are not printed or uploaded.
- Uses the existing Capacitor CLI parsers. Numeric Xcode object references are
  protected from JavaScript number conversion, and the serialized result is
  parsed again to check that no settings or references changed.

The recovery helper itself does not launch/select Xcode or write its preferences;
the full handover opens the existing project after synchronization. The helper
cannot inspect the user's exact local edits from a screenshot; if an unknown
setting conflict is reported, both original versions remain available for an
explicit resolution.

## Validation

Seventeen automated checks cover release/signing preservation, numeric object
references, custom plist fields, unchanged-byte preservation, actual stash
conflicts in all three Git conflict styles, untouched user data and package
staging, refusal of ambiguous/manual edits and concurrent Git writes, and running
the helper from a temporary directory before a fast-forward. The added cases
reproduce the staged-project failure with no unmerged files, restore all saved
contents, retain unknown conflicts and reject post-failure edits. The macOS CI job
runs the same tests and checks the recovered project and plist with Apple's `plutil`.
