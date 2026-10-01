# Account safety and guidance — 2.80.0

## Source ownership

- `mode-atlas-overlay.js` owns the scroll lock and visual viewport coordinates for account panels and shared dialogs. It restores the original page position after the last overlay closes. Account content remains the one scrollable panel; report forms do not carry a second scrolling workaround.
- `staff.cjs` owns official roles. Admin is the enabled, email-verified Firebase Auth account `admin@mode-atlas.com`. `socialStaff/roles` records only moderator assignments. Privileged transactions read that registry again, so revoking a role invalidates existing sessions without waiting for token renewal. Admin’s Moderators list also permits revoking a role after the member leaves Friends or is disabled.
- `moderation.cjs` owns reports, restrictions and warnings. Admin can dismiss any report, including their own. Moderators may action member accounts only; Admin, peers and self are protected. Admin cannot accidentally reset or restrict their own profile through a report.
- `socialWarnings/{uid}` stores the persistent count, 50 most recent messages and up to 20 unread notices. Warning retries use a request ID. Acknowledging a notice only removes it from the unread list. Leaving Friends keeps warnings; Admin clearing warnings or account deletion removes them. Roles and warnings are inaccessible to direct Firestore clients.
- `mode-atlas-account-notices.js` checks for private notices on authenticated visits and app foregrounding. The expected UID binds delivery and acknowledgement. A changed account clears the notice. Presentation waits until an active practice, tour or setup flow has finished. Warning counts never enter public profiles, rankings or widgets.
- `mode-atlas-tour.js` highlights actual navigation and opens the existing practice setup, goals, rewards and account views. It never starts practice or changes a selection. Session storage carries the tour across bundled page transitions; completion/skip returns to the original route.
- `mode-atlas-help.js` owns the feedback form and native legal reader. Terms/Privacy HTML is fetched locally from the canonical bundled documents. No duplicate policy copy is maintained.
- The feedback form prepares a plain-text email. iOS uses MessageUI when Mail is configured; other email apps and copying the draft remain available. The user reviews and sends the email. There is no SMTP credential, server email queue or claim of confirmed email delivery.
- Widget schema 3 reads the shared progression/routine/reward policy. Small: level, daily goal count, totals and activity. Medium: title and study streak too. Large: four goals and the next reward. Existing v1/v2 snapshots remain readable. Daily/weekly values reset on local calendar boundaries; study streaks expire after a missed day. Tapping opens Your Atlas. Sign-out still clears and suspends widget publishing.

## Deployment and device checks

Deploy the updated Firebase functions using `npm run social:deploy` before checking roles or warnings. No new entitlement or paid email service is required. `npm run ios:sync` regenerates the native bundle and normalizes Xcode sources without replacing local signing settings.

On two real accounts:

1. Admin opens a friend's profile or finds their code, opens Moderation & warnings, then assigns Moderator. Confirm the badge and that the moderator has no developer menu.
2. Check member report review, protected official accounts, Admin self-report dismissal, independent warnings, acknowledgement, count persistence, Admin clearing and role revocation.
3. Open report/feedback text fields, scroll with the iPhone keyboard visible, switch account sections and close. Check both iPhone and iPad.
4. Replay Quick tour, including Back and Skip. Try Terms/Privacy while offline. Cancel a feedback email and confirm the draft remains in the form.
5. Open the app, then check all widget sizes, a completed goal, daily rollover and the Your Atlas link. Native Home Screen rendering and keyboard animation remain real-device acceptance checks.

The existing Personal Team restriction on Apple Sign-In remains unchanged. This release does not publish to TestFlight or merge `main`.
