# Firebase activation preparation — 2.76.1

Status: production configuration inspected; deployment still pending. Friends
remains disabled in the shared web/iOS configuration. This release does not
claim that any production function or security rule has been deployed.

## Observed on 2026-09-30

| Setting | Verified value |
| --- | --- |
| Existing Firebase project | `mode-atlus` (Mode Atlas) |
| Billing | Blaze, through a Google Cloud free trial |
| Trial end shown by the console | 2026-12-30; console requests a paid billing account to continue after the trial |
| Default Firestore location | `australia-southeast2` (Melbourne) |
| Functions console | Get started screen; no deployed functions displayed |
| Existing user access | Owner-only `users/{userId}` and `users/{userId}/appData/{docId}` |

The existing deployed rules were:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/appData/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

The checked-in rules now preserve exactly those access boundaries and add an
explicit default denial. Tests cover owner access, denied cross-account and
anonymous reads/writes, denied deeper paths, and denied direct social access.
Private saves stay in the same database and paths. No data migration is needed.

## Deployment choices

`assets/app/mode-atlas-social-config.js` sets **Sydney (`australia-southeast1`)**
for both client calls and deployed functions. Sydney supports both generations
needed by this backend. Melbourne supports v2 but not the v1 Auth-deletion
trigger. This keeps all four functions in one supported nearby region without
moving the existing database. See the official
[Functions locations](https://firebase.google.com/docs/functions/locations).

`firebase.json` deploys the named `mode-atlas-social` codebase. The predeploy hook
packages the canonical progress/review/reward modules. No alternative score
engine, additional Firebase project, iOS entitlement or sign-in session is added.
The deployment includes owner-only Firestore rules, not indexes or Hosting.
The existing rate limits and two-instance maximum per function remain in place;
neither is a spending cap. No billing settings were changed during this review.

Firebase console sign-in succeeded during preparation. Cloud Shell returned
“Site Unavailable” both embedded and directly, and the execution workspace has
no Firebase CLI credentials. Deployment must therefore run from an authenticated
developer machine. Do not copy passwords, CLI tokens or service-account keys into
chat, source files or GitHub.

## Deploy from the Mac

Use the validated 2.76.1 development commit in `~/mode-atlas`. No Xcode build is
needed for this backend deployment. Use Node.js 22, npm and Python 3, then run:

```bash
cd ~/mode-atlas &&
npm run social:install &&
npm run social:login &&
npm run social:status &&
npm run social:deploy &&
npm run social:status
```

Sign in with the Google account that manages Mode Atlas when the CLI opens the
browser. No `firebase init` is needed. Every project operation names `mode-atlus`
explicitly. `social:install` installs the locked backend dependencies;
`social:status` reads the database details and function list; `social:deploy`
runs this exact scoped command:

```bash
backend/node_modules/.bin/firebase deploy --project mode-atlus --only firestore:rules,functions:mode-atlas-social
```

Firebase may enable the required Google APIs and prepare its service agents on
this first deployment. If it asks for container-image retention, **7 days** is a
reasonable development setting; these are build images, not learner saves. If
the CLI reports a permission or provisioning failure, preserve the error text
and retry only after addressing its stated cause. Do not add `--force`, broaden
the deploy target, create another database or replace the Google iOS plist.

Confirm `Deploy complete!` and these four rows in the final function list, all
in `australia-southeast1`:

| Function | Generation | Purpose |
| --- | --- | --- |
| `modeAtlasSocial` | v2 | Authenticated profiles, requests and private rankings |
| `modeAtlasSocialProgress` | v2 | Refresh derived stats after a private save |
| `modeAtlasSocialCleanup` | v2 | Retry removal of opted-out social data |
| `modeAtlasSocialAccountDeleted` | v1 | Clean up after Firebase Auth account deletion |

The source feature gate remains false in this first deployment. The new backend
therefore exists for validation, but Friends is not yet offered in the app.

## Activate after successful deployment

1. Record the actual deployment result and verify all four functions, the region
   and the deployed rules. Do not infer success just from a build or CLI login.
2. In a separate activation commit, set `enabled: true` in the canonical social
   config, regenerate release assets and pass the release gates. Redeploy the
   same codebase, then install the matching web/iOS build. Old gated builds stay
   usable and do not expose Friends.
3. Test two verified accounts across web and iPhone: exchange/accept a code,
   study and refresh statistics, compare ranking filters, block/unblock and
   leave Friends. Test full account deletion only with a disposable test account.
4. Replace the placeholder privacy/terms pages with reviewed policies before
   wider distribution, including the social deletion receipt described in the
   [framework guide](friends-leaderboards-2.76.0.md).

This deployment does not publish the website, merge `main`, enable Apple sign-in
or require paid Apple Developer membership.
