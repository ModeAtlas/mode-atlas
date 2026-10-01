# Mode Atlas 2.81.0 — beta preparation

This release prepares the existing shared website and iOS app for a small beta. It does not enable Apple sign-in, change Firebase configuration, deploy the backend, or publish an App Store build.

## Source ownership

- `ios/release.xcconfig` owns the upload build sequence. `mode-atlas-version.js` still owns the public version. Both Xcode targets inherit the same upload number; the audit and archive validator check that relationship.
- `configure_ios_signing.py` moves the local Apple team into an ignored configuration included at project level. App Group entitlements remain in their existing owner, `widget-sharing.local.xcconfig`.
- `mode-atlas-diagnostics.js` owns the bounded technical log. It keeps at most 20 events in session storage, excludes message/stack/account/input data, expires events after 24 hours and clears them on account changes. Feedback includes the previewed technical details only with explicit checkbox consent. There is no telemetry service or automatic transmission.
- `cloud-sync.js` still owns save state and retries. The debounce now counts as pending work. Profile consumes that status and delegates retry to the existing serialized sync operation. Retry also recovers failed database initialization and a failed first cloud read; recovered sections are applied locally before confirming sync.
- `mode-atlas-tour.js` finishes first-use guidance at the existing StudyPlan recommendation and trainer start screen. It does not start a session, award XP or override a chosen preset. Replayed tours retain their normal return path.
- The platform facade/adapters own friend-code sharing. UIKit presents a standard iPhone/iPad share sheet; browsers offer Web Share when available. Copy remains available and cancellation never reports success.
- The iOS keyboard owns input only. Hardware letters and deletion use the same input event as its on-screen keys; shared trainer code continues to evaluate answers.

## Local signing, once on each Mac

After choosing a team in Xcode, close Xcode and run:

```sh
npm run ios:signing
```

Or supply the real 10-character team ID:

```sh
npm run ios:signing -- --team YOURTEAMID
```

The script refuses missing, invalid or conflicting team selections. It preserves unrelated Xcode settings, keeps a pre-migration project backup in `.build/signing-migration/project.pbxproj`, and writes `ios/signing.local.xcconfig`. It does not provision profiles, request capabilities or replace App Group configuration. Use the local file for future team changes. If Xcode writes a team into the project again, rerun the command before committing.

Do not copy an entire older `project.pbxproj` over an updated project. Preserve local signing/App Group configuration and bring in the current project resources and targets.

## Beta upload sequence

2.81.0 starts at build 2080001, above the prior 2080000 build. Before each additional upload:

```sh
npm run ios:next-build
npm run ios:sync
```

Commit the changed release configuration to the development branch and let the release gate pass. Record the build number, commit and tester notes together. Build numbers are never allocated automatically by an ordinary sync or rebuild. Two people preparing uploads must coordinate the sequence. The iOS Settings version and feedback email include the installed build number.

## Automated checks

The release gate includes Python build/signing/website-packaging tests, JavaScript regressions, the web/iOS polish matrix and packaged website smoke tests. Native CI builds iPhone/iPad Simulator and an unsigned Release archive, checking app/widget metadata, Firebase resources and privacy manifests. These do not validate distribution provisioning or actual Apple account capabilities.

## Device acceptance before external testing

- Complete the first-use tour, enter the short set without signing in, leave/resume, and finish once. Verify the selected starting level is respected.
- Test hardware typing and VoiceOver key activation on Reading; check large text, reduced motion, focus order and iPad rotation across practice, Friends, reports and feedback.
- Test Share code: cancel, send, return to app and Copy. Check the iPad popover.
- Turn off connectivity during practice. Verify pending/offline status, reconnect, retry a failed save, then compare the same account on a second device. Verify no repeated completion XP.
- Switch between two disposable accounts; check save isolation, sign-out, account deletion and cleared widgets.
- Send feedback with and without technical details. Verify preview/privacy, cancellation, no Mail account fallback and actual receipt in the support mailbox.
- Check three widget sizes, stale snapshots, time-zone/midnight changes and reminders with the app closed and permissions changed.
- Check cold/warm launch, rapid navigation, background interruptions and audio alongside other apps.

## External prerequisites

Apple Developer Program enrolment, distribution signing and App Store Connect remain required for TestFlight. Enable and validate the existing Apple sign-in path after configuring the real Apple/Firebase credentials. Verify production backend deployment, support/legal URLs, moderation operations and beta review/compliance details. Roll out App Check across web and native separately, monitoring legitimate clients before enforcement.
