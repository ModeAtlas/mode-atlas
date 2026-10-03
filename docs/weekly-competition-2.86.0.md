# Mode Atlas 2.86.0 — Weekly competition, notifications and aligned levels

iOS build **2080007**. Shared website/iOS source release on `agent/mode-atlas-2.68.0-ios-theme`.

## What changed

Friends → Rankings → **This week** adds an optional global competition, with a Friends filter. Joining explicitly shares the chosen public profile and weekly score with other participants. Private learning totals remain visible only to accepted friends. Mutual blocking, profile reports, restrictions and account deletion apply to the new board too. Leaving the competition hides the entry; rejoining during the same week restores its score.

Everyone resets at **Monday 00:00 UTC**. The screen shows that deadline in the device's local time, including the time-zone abbreviation. Local daily/weekly goals retain their existing local-calendar reset; they are independent of the global competition.

| Place | Personal XP prize |
| --- | ---: |
| 1 | 500 |
| 2 | 300 |
| 3 | 150 |

At least two participants must each reach 100 weekly XP. Ties share a rank and prize, using competition ranking: 1, 1, 3. The first settlement freezes the podium score thresholds. Withdrawn/restricted entries can forfeit a prize; they do not promote a lower score after that freeze. The scheduled worker starts settling five minutes after the reset, normally on the following quarter-hour check. Durable receipts make retries safe. Prizes enter the private cloud progression ledger once and appear after cloud sync. They do not feed the next competition.

Weekly XP comes from new online Reading/Writing answer receipts. The server checks the canonical answer, selected pool, hints, sequence, expiry and account-bound token. Its rate follows the same Kana rate table as personal XP, using the number of different kana actually encountered in that session, bounded by the selected pool. Repeating only an easy row cannot claim the full-pool rate. Hints reduce the rate. This is a separate competition score: goal, completion, accuracy, streak and prize bonuses remain personal XP only. Existing XP, imports, developer adjustments and offline sessions cannot manufacture a weekly score.

One ranked session per account is active at a time. Sessions expire after one hour or the weekly deadline, whichever comes first. Starting another session replaces the previous server receipt. Temporary upload failures retry with the same answer sequence; submissions received after expiry/reset cannot count. The client keeps at most 200 pending answers. The session summary distinguishes confirmed weekly XP from pending or expired uploads. Personal/offline practice continues independently. The daily safety cap is 20,000 weekly XP. A one-minute timing allowance covers cold-start/network delay; the service also rejects out-of-order and implausibly fast answer sequences. These are abuse limits, not device attestation or proof of unaided study. Automated/fabricated submissions still require moderation.

## One XP curve for all accounts

Progress schema 5 removes the old threshold-only `curveCredit`. It keeps earned XP and correct-answer totals intact and recalculates levels from the current curve during load, merge and import. Cached public profiles calculate the displayed level from XP immediately after the backend update, even if their owner has not opened the new client.

**7,003 XP = level 12**, with 1,203 / 1,430 XP towards level 13; 227 XP remain. Level-based cosmetics now follow the corrected level and fall back when ineligible. Exclusive/event grants retain their existing account rules. This supersedes the level-preservation policy in the 2.85.0 notes.

The existing monotonic schema rule prevents an older client from overwriting a schema-5 save. Update the website and active app installations together; older installations may need updating before they can save again. There is no production batch rewrite or XP deduction.

## Notifications

The existing local daily reminder stays available. Four account choices start off and are independent: daily goals ending, weekly goals ending, streak at risk, and overtaken in the weekly ranking.

- Goal/streak checks use the latest cloud save and last registered device time zone. Incomplete daily goals, Sunday weekly goals and a streak still needing five correct kana are combined into at most one evening alert, checked between 8 pm and 10 pm. Completed work suppresses its alert. Offline work cannot suppress an alert until it syncs.
- Ranking alerts compare global rank, establish a silent initial/reset baseline, and are limited to one per local day between 9 am and 8 pm. Tapping opens the weekly board; goal/streak alerts open Your Atlas. A notification from another account cannot navigate into its account context.
- Reading Settings does not prompt for permission. Enabling a new option requests access and registers the device. Disabling an option does not request access. Sign-out unregisters the known token where connected and deletes the native token; account choices persist for next sign-in. Failed registration is shown in Settings.
- One token has one account owner, with up to five current registrations per account. Tokens expire after 30 days without renewal and delivery receipts after eight days. The scheduler claims an alert before sending, preferring a missed alert after a crash to a duplicate alert. APNs/FCM delivery is best effort, not an exact-time guarantee.

The scheduled function checks every 15 minutes and processes up to 1,000 enabled accounts per invocation, with a durable continuation and small concurrent batches. Monitor execution duration and backlog before scaling beyond that initial audience. Firestore reads, Functions, Scheduler and messaging infrastructure are part of the Firebase deployment; this is no longer solely a local reminder feature.

Weekly entry/award records expire 90 days after the week ends. The private prize history keeps up to 52 weeks. One-hour session receipts and all new private collections are denied to direct client access. Account deletion cleans up these records. The Privacy Policy and Terms describe the opt-in public visibility, processing and retention.

## Update the existing Mac checkout safely

Close Xcode. These commands preserve the known local project and Info.plist settings and retain a backup of Package.resolved. The 2.86.0 sync owner reapplies the new version, messaging setting and push environment to the preserved project. Keep the existing ignored signing and widget configuration files. This procedure is specifically for the 2.85.0 → 2.86.0 update.

```sh
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.86.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.86.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
npm ci &&
npm run build:social &&
npm run social:install &&
npm run social:deploy &&
npm run ios:sync &&
npm run ios:open
```

Keep the stash and the `mode-atlas-xcode-2.86.0-*` backup folder. Do not restore the old Package.resolved over the new dependency resolution. If using the source ZIP instead, copy the ignored `ios/signing.local.xcconfig` and `ios/widget-sharing.local.xcconfig` from the working checkout and reselect the working manual App Debug profile in Xcode.

Firebase project: **mode-atlus**; region: **australia-southeast1**. If authentication is needed, run `npm run social:login`, then rerun deployment. Deploy Functions, rules and indexes before the new clients. Wait for new Firestore indexes to finish building. The deployment adds the scheduled **modeAtlasEngagement** function alongside the existing callable/progress/cleanup/deletion functions. Confirm the Firebase project supports scheduled Functions, billing is enabled and Cloud Scheduler API is enabled if the CLI requests it. Do not manually create a duplicate scheduler job: the scheduled Function deployment owns it.

## One-time Apple / Firebase push activation

1. In Apple Developer → Certificates, Identifiers & Profiles → Identifiers, open **app.modeatlas**, enable **Push Notifications**, and save. Keep Sign in with Apple and the existing App Group. The widget App ID does not need push.
2. Edit/regenerate the existing **Mode Atlas Development** iOS App Development profile so it includes the updated App ID, working development certificate and registered devices. Download/install it. In Xcode retain **App target → Debug → manual signing → Mode Atlas Development**. Do not switch the working Debug setup back to automatic signing. Preserve the widget target's working signing.
3. Create or use an APNs authentication key for the same Apple team, authorized for this app and the required development/production environments. Download its `.p8` file and note the Key ID and Team ID. Keep the key out of Git, the ZIP and chat. This is separate from configuring Firebase's Apple sign-in provider.
4. In Firebase **mode-atlus** → Project settings → Cloud Messaging → the Apple app **app.modeatlas**, upload the APNs authentication key with its Key ID and Team ID. Configure the relevant development and production credentials as offered by the console. Development credentials cover physical Xcode Debug testing; production credentials are needed for TestFlight/App Store distribution.
5. For later TestFlight uploads, regenerate the App Store Connect distribution profile if needed so it also includes Push Notifications. Debug uses `aps-environment=development`; Release uses `production`. The app already contains the notification callbacks and opt-in Firebase Messaging configuration. No further Google/Apple sign-in provider change is required.

## Verification and device acceptance

Release gates cover shared regression tests, save migration, replay/account-bound weekly receipts, blocking, ties/idempotent awards, token reassignment, quiet hours/completed goals, opt-in UI, both appearances and large text. GitHub runs the full Firebase callable/trigger transport suite and native simulator/unsigned Release archive builds. The local environment supports the direct-service emulator suite; its Functions-to-Firestore trigger registration is unreliable, so the real transport gate runs on GitHub. Native CI uses its available Xcode 26.3; the user's signed installation uses Xcode 27.0.

On two consenting test accounts, join This week, complete a short online Reading/Writing session, refresh Global/Friends and compare confirmed weekly XP. Confirm the main account at 7,003 XP displays level 12 from both accounts. Check a blocked competitor disappears. Inspect every notification toggle and confirm denial/disable paths. After APNs activation, send a Firebase test notification to a registered test device or wait for an eligible scheduled alert, with the app backgrounded; verify the correct destination and no previous-account navigation after switching accounts. Check the scheduled Function's logs after a weekly reset and that each prize appears once.

Automated checks cannot establish signed device provisioning or real APNs delivery. Main, website publication, production Firebase deployment and TestFlight upload remain user-operated. Account deletion implementation is unchanged apart from cleanup of the new records.

References: [Firebase Apple messaging setup](https://firebase.google.com/docs/cloud-messaging/ios/get-started), [scheduled Functions](https://firebase.google.com/docs/functions/schedule-functions), [Capacitor Firebase Messaging](https://capawesome.io/docs/sdks/capacitor/firebase/cloud-messaging/), [Apple capabilities](https://developer.apple.com/help/account/identifiers/enable-app-capabilities/).
