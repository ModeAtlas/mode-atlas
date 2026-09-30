# Friends activation — 2.76.2

Status: activation source prepared after verifying the gated 2.76.1 deployment.
The matching backend redeployment and two-account production acceptance test
remain developer actions; source validation does not substitute for either.

## Verified deployment on 2026-09-30

The developer reported `Deploy complete!` from the validated 2.76.1 commit
`fa3e22ba4b44aa6af641d59a6c10bfe3dbb903b7`. The Firebase console independently
showed all four functions without deployment errors:

| Function | Generation | Location |
| --- | --- | --- |
| `modeAtlasSocial` | v2 callable | `australia-southeast1` |
| `modeAtlasSocialProgress` | v2 Firestore write | `australia-southeast1` |
| `modeAtlasSocialCleanup` | v2 Firestore write | `australia-southeast1` |
| `modeAtlasSocialAccountDeleted` | v1 Auth deletion | `australia-southeast1` |

All use Node.js 22 and 256 MiB. The existing default Firestore database remains
in `australia-southeast2`; the live rules match `backend/firestore.rules`,
preserving owner-only profile/app-data access and denying direct social access.
The developer configured seven-day build-image retention. First-use Eventarc
permission propagation and an initial Auth-trigger build failure cleared on a
bounded deployment retry; this release adds no IAM grants or trigger migration.

An unauthenticated request to the deployed callable returned HTTP 503 with
`UNAVAILABLE` and “Friends is not available yet.” This verifies reachability and
the old disabled gate, not an authenticated production social flow.

## Activation change

`assets/app/mode-atlas-social-config.js` now sets `enabled: true`. The existing
build pipeline copies this same source into the Functions package, so client and
backend use one activation switch and region. There is no secondary config,
runtime override, new Firebase app, save migration or duplicated scoring logic.
The version source generates web assets, package metadata and native version
2.76.2. Guest entry tests exercise the actual released gate on web and simulated
iOS, including the handoff to the existing sign-in screen without a social call.

## Activate on the developer Mac

First update the isolated Firebase checkout to the validated 2.76.2 commit
provided with the release handoff. Then run:

```bash
npm run social:deploy &&
npm run social:status
```

These scripts explicitly target `mode-atlus` and only Firestore rules plus the
`mode-atlas-social` Functions codebase. Backend lockfiles have not changed from
2.76.1; the existing installed dependencies can be reused. Deploy the backend
before installing the matching iOS build. Preserve local Xcode signing and App
Group settings when updating the original app checkout, run `npm ci` and
`npm run ios:sync`, and confirm version 2.76.2 before running from Xcode.

Publishing this development branch does not publish the public website. Its
release still follows the normal separate web publishing process; `main` is not
merged by this activation task.

## Live acceptance checks still required

1. Open **Profile → Your Atlas → Friends & rankings** with two verified accounts
   on the updated iPhone build and a matching web build.
2. Create each friends profile with the explicit sharing checkbox. Exchange a
   friend code, preview the profile, send a request and accept it on the other
   account. Emails and provider photos should not appear in friends profiles.
3. Complete practice, allow the existing cloud save to sync, and refresh Friends.
   Compare Level & XP, study streak, mastery and total-correct rankings.
4. Check remove, block/unblock and leave Friends. Leaving should remove social
   connections while keeping the private learning save. Exercise full account
   deletion only with an explicitly disposable test account.

The existing emulator suite covers authorization, rules, relationships, retries,
deletion and save projections. Live cross-device checks remain necessary before
wider distribution. Privacy/terms policy review remains the separate release
requirement recorded in the framework guide.

For rollback, set the same canonical gate to false, regenerate assets and redeploy
the backend. Authenticated opt-out and cleanup remain available with the gate
disabled. Do not remove functions or weaken rules to hide the feature.
