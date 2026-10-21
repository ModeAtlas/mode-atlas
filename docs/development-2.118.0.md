# Mode Atlas 2.118.0 — Learning and account reliability

iOS build **2080041**. This implements the four engineering stages from the 3.0.0 readiness review. It remains a pre-3.0 release until the physical-device acceptance pass is complete.

## Changes

1. **Correctness and trust:** one Japanese conversion policy for accepted input; all 2,383 configured readings round-trip through kana and displayed romaji; curated everyday meaning aliases; failed/early reviews stay reachable. Earned currencies now use a private server receipt ledger, with answer validation, retry deduplication and daily limits, rather than editable personal-save totals. Existing server wallet balances and purchases are retained.
2. **Durable data:** atomic account revisions, per-device Kana contribution merges, word/result unions, deletion tombstones and reset generations. Large save sections move into bounded Firestore documents. Canonical result storage replaces redundant legacy writes. Unchanged saves avoid writes. Sync confirmation follows server acknowledgement; sign-out also identifies queued study rewards.
3. **Learning quality:** authored shape/recognition cues for all 84 N5 characters, 253 curated N5/N4 example words, Kanji beginner/check/confident entry, optional Word Bank recall with separate written form and kana reading, branch-aware continuation and replayable branch tours. Modern Kana mastery emphasizes recent accurate recall across days; lifetime accuracy and speed remain visible diagnostics. Earned milestones stay earned. Handwriting remains optional for Mastered+.
4. **Release hardening:** Friends fetches a 20-profile page before materializing documents; stale projection refreshes move to the scheduled worker. Global ranking uses two rank-count queries per page. Weekly rewards have a daily answer allowance and a hold for sustained suspicious timing. App Check attestation is monitored without silently blocking unconfigured clients. Regression coverage includes large saves, independent offline devices, reset protection, grading, receipts, query budgets and new learning journeys.

Source ownership is explicit: Japanese conversion, Kana evidence, save merge, cloud transport, Word Bank model, branch metadata and server economic evidence have dedicated modules. Cloud sync remains the single account/authentication coordinator. Generated assets and server shared policy are rebuilt from canonical files.

## Validation and release evidence

- Local source/native-web gate: 245 JavaScript tests and 15 Python tests passed, including a save larger than 1 MiB, no-op partition writes, stale-device reset protection and forged-save currency isolation.
- Content validation covers every configured Kanji reading; editorial work covers N5 cues and N5/N4 word choices, not an expert linguistic review of the entire N1–N5 dictionary.
- Browser checks exercise mobile and desktop entry, study, results, account boundaries, tours and Word Bank review. Exact final browser/Firebase/native job outcomes and durations are in the GitHub Actions run for this release's branch head.
- The release workflow retains Firebase emulator rules/callable/deletion checks, simulator compilation, Swift widget/navigation/router tests and an unsigned Release archive. A successful unsigned archive is not an App Store upload or a signed-device test.

Deployment and migration details: [account migration](reviews/3.0.0/implementation-2.118.0.md).

## Update

**Firebase must be deployed before running this client.** Version 2.118.0 introduces partitioned saves and the `earnStudy` callable. Once an account has migrated, old clients may read only part of that save and their writes are deliberately rejected. Update every device using the account. Do not roll the client back after migration.

Close Xcode, then run this combined update. It backs up local Xcode files, preserves your signing configuration, deploys Firebase, then prepares the app:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.118.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.118.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
test "$(node -p "require('./package.json').version")" = '2.118.0' &&
npm ci &&
npm run social:install &&
npm run build:social &&
npm run social:deploy &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Select **App**, choose your iPhone and press **Cmd+R**. Confirm **2.118.0 / 2080041**. If Firebase reports that login is required, run `npm run social:login`, then resume from `npm run social:deploy` onward. The command does not upload to TestFlight or publish the website from the development branch.

Allow roughly **10–20 minutes** on the Mac for dependency installation, Firebase deployment and native preparation, depending on caches/network, plus the device build. This is an estimate, not a measured deployment time.

## Device acceptance before 3.0.0

Use two updated devices: study offline on each, reconnect and confirm both sets of new answers/words/results; delete a result and confirm it stays deleted; verify sign-out and switching accounts removes the previous account's data. On iPhone/iPad check Google/Apple sign-in and linking, kana IME/app keyboard, normal/slow audio, VoiceOver, enlarged text, widgets and notifications. None of these physical-device outcomes is claimed by browser simulation.

App Check provider provisioning/enforcement and real-money coin purchases are not enabled by this release. Cloud capacity is expanded, but localStorage remains bounded by device quota; a multi-year IndexedDB archive is a separate migration, not an implied guarantee of unlimited storage.
