# TestFlight preparation — 2.79.0

This is a development release on the existing agent branch. Source publication
is separate from Firebase deployment, website publication, Apple signing and
TestFlight distribution. Nothing in this release merges into `main`.

## What changed

| Area | Implementation and owner |
| --- | --- |
| Audio | `mode-atlas-sound-cues.js` owns the scores and zero-ended envelopes. Web Audio remains in `mode-atlas-sounds.js`. `build_native_runtime.mjs` renders those scores to PCM WAVs for the native `ModeAtlasSoundPlayer` in `ModeAtlasNativePlugin.swift`. The platform adapter is the only bridge. |
| Native startup | The same native builder bundles the installed Firebase npm modules with shared ES module chunks. `mode-atlas-firebase-loader.js` chooses local iOS modules or the existing pinned web CDN. `cloud-sync.js` remains the only Firebase app/session owner. |
| Account deletion | `backend/functions/accounts.cjs` requires recent authentication, puts a write barrier in place, deletes Auth first, then removes every private user document and the social graph. The retrying Auth deletion trigger recovers interrupted cleanup, including deletion from older clients. A status action handles lost responses. |
| Account switching | Cloud sync tags the local save with its UID, preserves another account's offline save in a local cache, and restores only the selected account's cache. An active practice is suspended before the identity changes, without a completion award. Genuine guest work can still join the first signed-in account. Local caches remain on the device until Mode Atlas data is cleared. |
| Friends safety | Shared name policy filters obvious abuse. `moderation.cjs` owns scoped reports, duplicate suppression, five reports/hour, a verified-admin review queue, reset/restrict/restore actions and retention. Restrictions survive Leave Friends. Reports and restrictions are server-only. |
| First use | The existing visit-flow owner opens a three-step, skippable tour using the shared dialog. Settings can replay it. Initial setup has keyboard focus containment; release notes no longer follow immediately after first setup. |
| Support and policies | Settings opens an editable feedback email with version/platform/screen only. Privacy and Terms have source-based content, a contact address and readable layouts. The developer must verify the contact and policy details before public distribution. |
| Widgets | Signing out suspends publication across page/background refreshes until sign-in. The previous user's snapshot is not silently re-created. |
| Release packaging | App and widget have owned privacy manifests. `sync_ios_project.py` installs their project references without touching signing values. CI builds an unsigned device Release archive and checks the actual metadata, manifests, intents, SDK modules and audio files. |

No independent iOS progress calculator, account database, duplicated cue tuning,
new modal framework, polling loop or second Firebase registry was introduced.
Revisioned JS/CSS and native public assets remain generated outputs.

## Firebase rollout

Deploy before testing account deletion or reports in 2.79.0:

```sh
npm run social:install
npm run social:deploy
npm run social:status
```

The deploy command now includes Firestore field configuration for TTL expiry.
The existing four function names and region remain unchanged. New server-only
collections are `accountDeletions`, `accountOperationLimits`, `socialReports`,
`socialReportLimits` and `socialRestrictions`. Owner-only save rules additionally
reject requests for an account whose deletion is committing or complete.

- Reports expire after 90 days; request-limit records after one day.
- Completed deletion barriers and hashed social deletion receipts expire after
  seven days. TTL removal is asynchronous, so expiry is not an exact deletion time.
- Restrictions have no automatic expiry, but are removed by an admin or account
  deletion. Account deletion also removes reports involving that account.
- Identity migration v2 rechecks existing names against the new content policy.
  It retains the bounded lease/retry behavior of v1 and preserves learning data.
- The verified, enabled `admin@mode-atlas.com` account sees **Review reports** in
  Friends. Reporter identity is never included in the reported user's view.
- A filter is only the first layer. Review the queue and support inbox regularly;
  photo moderation is manual. There is no promise that every language or evasion
  is caught automatically.

The emulator suite tests private/deep data removal, failure before Auth deletion,
retry after Auth deletion, stale-token rules, report visibility and authorization,
restriction persistence, restoration and unique neutral profile replacement.

Account restoration uses the existing storage journal. A quota failure pauses
cloud sync until recovery on reopen. Account caches belong to the app's cleanup
boundary and are excluded from exported development backups.

## Before the first TestFlight upload

1. Enroll in the paid Apple Developer Program and create the App Store Connect
   record for `app.modeatlas`. Transfer local signing to the intended team and
   provision the app, widget extension and existing App Group together.
2. Configure Sign in with Apple in Apple/Firebase and enable the existing native
   provider/entitlement together. It remains disabled in this Personal Team build.
   Test explicit Google-to-Apple linking retains the same Firebase UID. Never
   treat matching email addresses as proof two existing accounts may be merged.
3. Verify that `support@mode-atlas.com` receives mail, review the Privacy/Terms
   text and publish the actual pages at their public URLs through the normal web
   release process. This branch does not publish the live website.
4. Generate Xcode's aggregate privacy report from the signed archive, review SDK
   disclosures and enter accurate App Store privacy/age/export answers. The app
   manifest declares linked sign-in identity, optional photos, Friends graph,
   installation IDs, study interactions, user content and support reports for
   functionality. Widgets do not transmit data. No ATT prompt is added because
   this implementation does not perform advertising tracking.
5. Set Firebase/Google Cloud billing alerts and check callable error/latency logs.
   Keep the existing instance caps and per-user limits. App Check is a separate
   enrollment and enforcement step; it is not silently enabled in this release.
6. Archive with the real team, run Organizer validation and upload. Supply beta
   description, feedback contact, review notes and any reviewer access needed.
   External beta approval and successful unsigned CI are different gates.

Official references: [Apple beta testing](https://developer.apple.com/testflight/),
[review guidelines](https://developer.apple.com/app-store/review/guidelines/),
[privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files),
[App Store privacy details](https://developer.apple.com/app-store/app-privacy-details/),
[Firebase App Check](https://firebase.google.com/docs/app-check).

## Device acceptance checks

Use the iPhone and iPad; keep a separate disposable account for deletion.

- Navigate quickly for 30 seconds; test correct/wrong/completion sounds, Off,
  Ring/Silent, another app playing music, background/foreground and an interruption.
  Native audio continuity and perceived sound quality require real-device listening.
- Cold-launch in airplane mode, practise, reconnect and confirm cross-device sync.
  Switch between two accounts after unsynced work; each must recover its own save.
- Cancel deletion, then delete the disposable account. Confirm its cloud save,
  Friends links and saved widget data are removed. A cleanup-pending response must finish
  without leaving a usable deleted account.
- Send a report from the second account, review it as admin, reset/restrict/restore
  the target, and check the reporter remains undisclosed.
- Check VoiceOver order, largest accessibility text, reduced motion, portrait/
  landscape and an iPad hardware keyboard in onboarding, account screens and both
  practice directions. Automated geometry/focus checks cannot replace this pass.
- Change reminder time and permissions; check delivery with the app closed, and
  after time-zone/DST changes. Test each widget size and its destinations. Sign out,
  navigate and background the app; the prior snapshot must stay cleared.
- Test feedback with and without a configured mail account. The action opens a
  draft; Mode Atlas does not silently transmit diagnostics or private study data.

## Remaining limits

Friends rankings project client-supplied saves. Server-owned display projection,
rate limits, disabled import UI and App Check do not make scores cheat-proof.
Keep these as private, friendly comparisons; a competitive public leaderboard
would need a server-validated learning-event design.

The npm audit at implementation time reports one moderate UUID advisory through
Capacitor CLI → xcode → uuid (three dependency entries), with no high/critical
findings. This is development tooling, not shipped app code. The installed xcode
helper uses UUID v4 without a supplied output buffer; the advisory concerns
v3/v5/v6 output-buffer bounds. No unsupported transitive major override or CLI
downgrade was introduced. Recheck the upstream fix before public distribution:
[maintainer advisory](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq).
