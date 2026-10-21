# Mode Atlas 2.119.0 — Achievable goals and smoother practice

iOS build **2080042**.

## Changes

- Goal eligibility uses unlocked Kana rows, actual formal-test access and the Kanji available for recall. A learner who has introduced only a few Kanji receives smaller answer goals, not full-set requirements. Automatic assignments contain at most one Kanji goal per period. Available characters are not confused with lifetime correct-answer totals.
- Existing impossible automatic goals are repaired when the current board is opened. Completed goals and their earned XP remain intact. Unfinished goals have a compact Change control; replacements share the original reward slot, so swapping or merging offline devices cannot multiply rewards. Personal-goal choices omit inaccessible tests and targets beyond the remaining Kana milestones.
- Ordinary cloud sync-status events no longer bypass the 20-answer / 15-second study-receipt batch. The native widget is recalculated at most every 30 seconds during practice, then refreshed at completion or backgrounding. Answer saves retain their synchronous recovery journal. Historical reward aggregation and repeated achievement-date checks do less work.
- The developer console now separates Overview, Testing, Accounts, Moderation, Storage and Runtime. It retains XP, wallet, backup, audio, notification and visit-flow tools. New bounded in-memory timing samples and reward-queue/error diagnostics help investigate slow devices without recording answers or identity data.
- Admin can browse every Firebase Auth account in pages of 25, including accounts that never joined Friends, and find an exact email/account ID. Inspection exposes provider names, save revision/partition metadata, profile sync, wallet totals, warning count and recent receipt summaries. It does not expose raw saves, passwords, tokens or answers. Members and moderators are rejected server-side. Account changes clear the directory from the UI. Existing moderation tools remain under their existing owner, reached directly from the console.
- The 2.118.0 commit did reach main. Website publication was blocked by one Firebase test that required an intermediate queue document to exist even when a delayed trigger had already refreshed the profile. The test now accepts either valid intermediate state and still requires the correct final projection. No release gate was removed.

## Hunny artwork

The proposed brown-bear artwork was rejected by the user and is **not included**. Two attempts to generate a new Pooh illustration were rejected by the image service. The existing Pooh artwork and exclusive access remain. Its reserved artwork width now adapts to larger banners, retaining proportional fit and a white canvas. **The requested newly illustrated Pooh banner is unfinished.** This release makes no claim that the existing artwork has new usage rights.

## Checks and limits

- Local source gate: 252 JavaScript tests, 15 Python tests, generated-asset audit, iOS Firebase configuration and deterministic web-bundle validation passed.
- Targeted browser checks cover reachable goals and replacement, account directory pagination/inspection, sign-out clearance, existing backup tools, light-theme contrast and responsive banner composition. Full browser, Firebase emulator and native build results are attached to the exact release commit in GitHub Actions.
- A local Chromium fixture with 180 days of goal history and 35 answers measured synchronous answer handling at median 13.9 → 12.2 ms and p95 23.7 → 20.8 ms. This is a single controlled desktop comparison, not an iPhone benchmark. Tests separately verify that repeated per-answer status events do not upload receipts and that widget publication is bounded during practice.
- No production Firebase credentials or physical iPhone are available in this environment. Production backend deployment and physical-device acceptance remain part of the update below. Real-money purchasing and TestFlight upload are not part of this release.

## Update

Close Xcode. This preserves local signing files, updates the source, deploys Firebase first, then prepares Xcode:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.119.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.119.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
test "$(node -p "require('./package.json').version")" = '2.119.0' &&
npm ci &&
npm run social:install &&
npm run build:social &&
npm run social:deploy &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Select **App**, choose the iPhone, press **Cmd+R** and confirm **2.119.0 / 2080042**. Update all devices using the account. If Firebase requests login, run `npm run social:login`, then resume from `npm run social:deploy` onward. The new account-directory endpoints require this Firebase deployment.

Allow roughly **10–20 minutes** for dependency installation, Firebase deployment and native preparation, plus the device build. This is an estimate. Actual CI durations and website publication status belong to the final handoff, not this estimate.

On device, check a short and an extended Kana run while signed in, including offline/reconnect, then stop and inspect queued rewards. Confirm a starter Kanji account gets achievable goals, completed goals stay completed, and a changed goal stays changed after sync. Check the updated widget after finishing a session. Administrator account browsing and moderation links should also be checked after Firebase deploys.
