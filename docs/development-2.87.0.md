# Mode Atlas 2.87.0

Public version **2.87.0**, iOS build **2080008**. Development branch:
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

## Changes

- **Friends:** weekly ranking no longer sends its filter to Friends, Requests, Sent or Blocked. The server also ignores irrelevant ranking filters for these lists, fixing older installed clients after deployment. Returning to Rankings retains the chosen metric.
- **Mastery:** Reading is the initial view, with Writing and Both alongside it. Each detail shows lifetime accuracy/timing, each direction’s stage, canonical next-stage evidence and its next due review. Both is Learning until both directions qualify for Reviewing; Mastered requires both to be Mastered. This removes the old inconsistency where beginning the second direction could lower a combined badge. Individual thresholds, saved answers, earned peaks and XP remain intact. Legacy directional stages persist until new recall evidence arrives, as in 2.85.0. Cached social summaries migrate when viewed.
- **Practice:** a kana, Learning group, due group or unfinished goal opens an appropriate existing trainer. Script goals use the matching pool; no-hint goals disable hints; Daily Challenge and formal-test goals select their own modes. Targeted practice is a one-session pool with real pool-based XP. It does not start automatically or rewrite selected kana rows.
- **Weekly ranking:** Global, Near me and Friends views, the gap to a visible competitor above, a shared reset time and private previous finishes. Nearby results respect blocking. Settlements freeze eligibility, preserve shared ranks across 100-entry pages, and write each learner’s result/prize idempotently. All positive-score participants can receive a result; prize eligibility is unchanged. Results are recorded after this backend is deployed. Older prize receipts remain visible; unrecorded historical finishes are not reconstructed.
- **Recap:** Your Atlas → Recap shows current/previous local study week, study days, Reading/Writing correct, unique kana and completed goals from dated activity. Undated historical totals and weekly XP are not estimated. This local Monday week can differ from the global ranking’s UTC Monday boundary.
- **Notifications:** separate switches remain. Add a goal/streak alert time and quiet hours in 15-minute steps. Defaults are 8 pm alerts and 10 pm–9 am quiet hours. The scheduler checks every 15 minutes; goal/streak alerts may arrive within two hours of the chosen time, outside quiet hours. Ranking alerts are at most once a local day outside quiet hours. Alert expiry follows real instants across DST and stops at midnight/quiet hours. A device with a daily reminder within an hour of its goal-alert time skips that goal/streak push; other devices keep their own behavior. Delivery is best effort; unsynced offline answers/settings cannot affect server decisions until reconnected.
- **iOS audio:** session activation, decoding and players have one serial audio owner off the UI thread. Ambient audio retains the silent switch and other-audio behavior. UIKit and bridge responses stay on the main queue.

Deferred: Word Bank practice, Listening and seasonal content.

## Firebase update

Project **mode-atlus**, region **australia-southeast1**. Deploy the backend before installing the new app: new clients use notification schedule fields, nearby queries and result history that older functions do not understand.

From the updated checkout:

```sh
npm run social:install &&
npm run build:social &&
npm run social:deploy
```

This deploys the existing `mode-atlas-social` codebase, rules and indexes. It adds the reverse-order nearby index; wait for indexes to become ready before testing Near me. Existing Auth providers, APNs keys, app IDs and provisioning profiles do not need replacing. Scheduled engagement uses the existing function. No Firebase production deployment is performed by the source handoff itself.

Results reuse the existing private `weeklyAwards` owner, keeping up to 52 finish records separately from 52 prize receipts. Both are erased with the account. Weekly entries/individual awards retain their existing 90-day expiry. The Privacy Policy includes the additional history and notification timing fields.

## Update the working Mac checkout

Close Xcode. Keep the working **manual Debug profile `Mode Atlas Development`** and existing ignored `ios/signing.local.xcconfig` / `ios/widget-sharing.local.xcconfig`.

```sh
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.87.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.87.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.87.0' &&
npm ci
```

Then run the Firebase update above, followed by:

```sh
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

The sync owner reapplies 2.87.0 / 2080008 while preserving local signing. Keep the stash and backup folder. Do not restore the old Package.resolved over the new resolution. If using the ZIP, transfer the two ignored local configuration files from the working checkout, then run the dependency/sync commands and select the working manual Debug profile.

Confirm version/build in Xcode before running on the phone. If Xcode still reports a stale Firebase module after resolution, use Product → Clean Build Folder, then build again.

## Validation and testing efficiency

Use focused unit/browser cases while editing, one consolidated release audit, then the independent GitHub release jobs. Re-run only failed or materially affected local cases. The release gate retains its full browser, Firebase transport/security, native simulator and unsigned archive checks. New coverage exercises weekly → Friends navigation with a pending request badge, direction-specific mastery, target pools outside selected rows, recap tabs, timing controls, DST/quiet-hour expiry, device overlap, stale social projections and tie settlement across the durable cursor.

The runner’s Xcode 26.3 simulator/archive checks are distinct from the user’s Xcode 27.0 signed-device run. Before sharing the build, check on the iPhone: correct/wrong sounds while answering rapidly, silent mode, background/resume/interruption; a real timed push and its destination; quiet hours and local-reminder coordination. Production APNs configuration is still required for TestFlight; simulator/stub checks do not establish live APNs delivery.

No website publication, main-branch merge or TestFlight upload is part of this development-branch handoff.
