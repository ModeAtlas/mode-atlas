# Recover a stopped 3.0.5 Mac update

The reported update fetched 3.0.5 successfully, then stopped at `git stash apply
--index` with conflicts in `ios/App/App.xcodeproj/project.pbxproj` and
`ios/App/App/Info.plist`. The stash remains. `Index was not unstashed` means Git
could not restore the previous staging state; it does not mean the stash was lost.
The cleanly restored `Package.resolved` change should be retained.

The original handover tested unrelated local changes but missed local Xcode edits
touching the same native metadata. This correction adds a field-by-field recovery
and makes the normal handover invoke it when needed. The helper preserves the
fetched release's version/build. The command below fetches the current branch;
see the [3.0.6 handover](development-3.0.6.md) for its changes and build number.

## Resume from the reported conflict

Quit Xcode while the files are being recovered. Use the same original checkout;
change only the `cd` line if its path differs. Do not run the old stash command
again, discard local changes, or copy an entire older project over this release.

```bash
bash <<'MODE_ATLAS_RECOVERY'
set -euo pipefail
cd "$HOME/mode-atlas"

mode_atlas_branch=agent/mode-atlas-2.68.0-ios-theme
git fetch origin "refs/heads/$mode_atlas_branch:refs/remotes/origin/$mode_atlas_branch"
mode_atlas_recovery_dir=$(mktemp -d "${TMPDIR:-/tmp}/mode-atlas-recovery.XXXXXX")
git show "origin/$mode_atlas_branch:recover_ios_update.cjs" > "$mode_atlas_recovery_dir/recover_ios_update.cjs"
npm ci
node "$mode_atlas_recovery_dir/recover_ios_update.cjs" --apply
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
- Resolves only the two known native metadata files. Other staged changes,
  untracked files, signing/widget configuration, `xcuserdata`, theme files, the
  current project directory and the stash remain intact.
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

Twelve automated checks cover release/signing preservation, numeric object
references, custom plist fields, unchanged-byte preservation, actual stash
conflicts in all three Git conflict styles, untouched user data and package
staging, refusal of ambiguous/manual edits and concurrent Git writes, and running the helper from a temporary
directory before a fast-forward. The macOS CI job runs the same tests and checks
the recovered project and plist with Apple's `plutil`.
