# Friends and private rankings — 2.76.0

Status: implemented behind `ModeAtlasSocialConfig.enabled = false`. No production
Firebase deployment, billing change, public directory or competitive weekly XP
is part of this release. The normal app remains usable while activation is pending.

## Experience

After activation, open **Profile → Your Atlas → Friends & rankings** on web or
iOS. A learner explicitly creates a friends profile with a display name and an
Atlas avatar. Their existing account, learning save, level and selected reward
frame/title are reused. Provider emails/photos are never copied into this profile.

- Exchange a random friend code; preview the person before sending a request.
- Accept/decline incoming requests, cancel sent requests, remove or block friends,
  and manage the blocked list. Unblocking does not restore a friendship.
- Replace a code without losing existing friends or pending requests.
- Compare Level & XP, Study streak, combined/Reading/Writing mastery, or total
  correct. The learner appears in their own ranking. Ties share rank (1, 1, 3).
- Leave Friends with confirmation. This removes the profile, code, connections,
  requests and blocks while preserving the private learning save.

Friends is online-only. Studying and existing local/cloud saves retain their
offline behaviour. Lists are fetched on opening/refresh, not kept in a background
listener or persisted in browser storage. Errors offer retry rather than invented
competitors or a misleading empty list. No invitations are sent outside the app.

## One owner per responsibility

| Owner | Responsibility |
| --- | --- |
| `cloud-sync.js` | Existing Firebase app/auth, private save sync and account deletion |
| `assets/app/mode-atlas-social-config.js` | Shared feature gate and Functions region |
| `assets/app/mode-atlas-social.js` | Authenticated callable transport and account-switch checks |
| `assets/ui/mode-atlas-social-ui.js` | Shared Friends screens, consent and confirmations |
| `assets/css/mode-atlas-social.css` | Responsive components using existing web/iOS colour tokens |
| `backend/functions/social.cjs` | Server authorization, requests, bilateral relationships, limits and cleanup |
| `backend/functions/projection.cjs` | Read-only save adapter and allowlisted profile projection |
| `backend/functions/index.cjs` | Callable, save-change, cleanup and Auth-deletion triggers |
| `build_social_backend.py` | Copies canonical policy modules into the ignored Functions package |

Progress, reward and review modules now expose their existing owners to Node as
well as the browser. The backend does not maintain another XP/level/mastery
calculator, execute source through a VM, or write through the browser storage
adapter. `ModeAtlasDates` owns calendar/time-zone helpers. Kana metrics delegates
combined mastery to the canonical review owner. Revisioned assets and native
metadata remain generated from their existing sources.

The Firebase Functions SDK loads lazily through the same Firebase app and pinned
SDK version as cloud sync. No second login session, iOS entitlement or native
Firebase SDK dependency is introduced. Apple account linking stays disabled as
before; friends use the existing Firebase UID, irrespective of linked provider.

## Data, trust and access

The existing `users/{uid}/appData/kanaTrainer` save remains private to its owner.
All social collections deny direct client reads/writes; authenticated callables
use the Admin SDK and enforce authorization themselves:

- `socialAccounts`: consent/profile, code, derived summary and bounded relationship
  maps. Accepted mutual friends receive allowlisted statistics. Code previews and
  pending requests receive only identity, level and reward appearance.
- `socialCodes`: SHA-256 lookup of an 80-bit random code, with rotation and no
  client listing. A code grants preview/request access, never acceptance rights.
- `socialBlocks`: pairwise blocks; transactions remove relationships in both
  directions. Blocked lists retain enough identity to identify whom to unblock.
- `socialLimits`: per-UID lookup/read/write counters. Opt-out preserves these
  counters so it cannot reset request limits. Auth deletion removes them.
- `socialDeleted`: SHA-256 account identifier plus deletion time only. This small
  security receipt prevents a request authorized just before account deletion
  from recreating the deleted profile. It contains no raw UID, display name,
  email, code, relationships or progress. Retention must be included in the
  production privacy policy.

Limits are 100 accepted friends, 50 incoming and 50 outgoing requests, 100 blocks,
and 20 displayed rows per page. Server reads are bounded to that circle. Per
minute, one UID can make 12 lookups/request submissions, 60 reads and 30 other
mutations. Limits are abuse friction, not a defence against multiple accounts or
a spending cap. App Check is not configured or claimed as enforced here.

The token UID is authoritative. The client sends an expected-UID precondition to
reject account changes during SDK initialization. Each callable checks that the
Auth user still exists, is enabled and has a verified email. Clients cannot write
social scores or choose a locked frame; the server derives these from the latest
private save and canonical rules. It clamps malformed/oversized progress and
ignores unknown kana when counting mastery.

**The underlying save is still client-owned.** These are friends-only rankings of
synced learning progress, not cheat-proof competitive scores. Imported/historical
progress remains visible. Weekly/public competitions require a separate validated
study-event ledger with server-issued runs, replay checks and explicit offline
submission rules. They are deliberately absent from this release.

## Refresh and deletion

Save triggers read the latest save inside a transaction instead of projecting an
event's potentially stale snapshot. Repeated delivery and unchanged snapshots do
not create extra projection writes. Profile setup and opening Friends refresh
the learner's own projection too. Streaks are derived at read time using the
profile's IANA time zone, so they expire even without a new study session.

Leaving Friends immediately hides the profile and removes its code. Cleanup
removes reciprocal edges and blocks before deleting the profile. A unique
deletion ID prevents delayed retries from deleting a later re-created profile.
The cleanup trigger retries if a callable disconnects or times out. Account
deletion waits for social opt-out after reauthentication and before deleting the
private save. A retrying Auth-deletion trigger also handles older app versions or
console deletions. An in-flight create is checked against the deletion receipt.

## Validation

```bash
npm ci
npm --prefix backend ci
npm --prefix backend/functions ci
npm run release:check
npm run test:social
npm run test:polish -- --project=desktop-chromium
```

The full backend suite requires Java 21 and Node 22, uses only
`demo-mode-atlas`, and exercises real callable HTTP/auth handling plus Firestore
and Auth triggers. GitHub's **Social backend, access rules, callable functions,
and deletion triggers** job is required alongside the existing browser/native
gates. No Firebase secrets or production project are used by CI.

For runtimes that cannot host Functions workers, `npm --prefix backend run
test:service` runs the same business cases directly against Auth/Firestore
emulators. Its output explicitly identifies that function transport and triggers
are not covered. This is not a substitute for the full CI job.

Coverage includes private-save isolation, direct social access denial, opt-in,
forged score fields, expected-UID mismatch, recipient-only acceptance, crossed
requests, duplicates, last-slot concurrency, block/unblock, code rotation/rate
limits, pagination/ties, projection/streak expiry, trigger refresh, opt-out,
deletion retries and an in-flight deletion race. Shared-app regressions cover
deletion failure ordering and stale account responses. Browser tests use an
explicit service fixture to check dark/light web/iOS layouts, 320px width, large
text, consent, confirmations, offline retry and sign-out clearing. Real-device
two-account checks follow production activation.

## Production activation — not performed

The existing project ID in the checked-in Firebase config is **`mode-atlus`**.
Do not create another project or replace the working Google iOS configuration.
Do not run deployment commands until the following review is complete:

1. Inspect the project's current billing plan, default Firestore database location,
   deployed rules and existing Functions. Cloud Functions deployment needs Blaze;
   this is separate from paid Apple Developer membership. Agree the billing
   change and budget alerts before enabling billing. Alerts are not a hard cap.
2. Set `region` in the canonical social config to a supported Functions region
   appropriate for that database. `us-central1` is a provisional default, not a
   claim about this project's location. The client and backend share this value.
3. Compare deployed Firestore rules with `backend/firestore.rules`. The checked-in
   policy supports the observed private-save path and denies all other client
   paths. Preserve any separately required existing access after review; never
   paste a broad authenticated-user allow rule over the social collections.
   No composite indexes are required. Do not deploy the empty indexes file over
   unrelated existing indexes.
4. Replace the existing placeholder privacy/terms pages with reviewed production
   policies covering account data, opt-in sharing, removal, the deletion receipt
   and support. Confirm the avatar/name policy before wider distribution.
5. Install dependencies and pass the commands above. Authenticate Firebase CLI
   with the owner's account. Deploy the reviewed rules and this named Functions
   codebase while `enabled` is still false:

   ```bash
   backend/node_modules/.bin/firebase login
   backend/node_modules/.bin/firebase deploy --project mode-atlus --only firestore:rules,functions:mode-atlas-social
   ```

   The predeploy hook packages the canonical policies. This command does not
   deploy Hosting, indexes, another codebase or the website.
6. Check all four named Functions deployed successfully. Set `enabled: true` in
   source, rebuild/test and redeploy this codebase. Publish the matching gated-on
   web/iOS build through the normal development branch. A separate activation
   commit makes the deployment boundary reviewable. Existing gated-off builds
   continue to work but do not show Friends.
7. With two real verified accounts, test web ↔ iPhone code exchange, acceptance,
   a study/save refresh, all rank filters, block/unblock, opt-out and deletion of
   a disposable test account. Confirm no private fields appear in responses and
   no console permission errors occur. Check Function logs and usage.

Keep production rules, region, policy and billing decisions in the activation
commit/review record. No step requires committing main or enabling Apple sign-in.
To suspend Friends, redeploy `enabled: false` and publish the corresponding app
build; keep cleanup triggers deployed so existing users can still delete accounts.

Official references:

- https://firebase.google.com/docs/functions/get-started
- https://firebase.google.com/docs/functions/callable
- https://firebase.google.com/docs/functions/firestore-events
- https://firebase.google.com/docs/rules/unit-tests
