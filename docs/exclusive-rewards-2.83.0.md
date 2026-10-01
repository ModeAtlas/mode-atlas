# Exclusive rewards — 2.83.0

Web and iOS use the same catalogue, entitlement policy, progression selection and
account UI. This release adds the supplied Hunny artwork for the designated
verified tester account and verified Admin. Only eligible owners see that choice.
Friends see equipped artwork without receiving its entitlement. The public asset
and catalogue are not secret; exclusivity controls selection and server projection.
The supplied artwork is bundled as a 1024-pixel WebP (about 52 KB) for profile
cards, keeping both website loading and the native payload small.

## Ownership

| Concern | Canonical owner |
| --- | --- |
| Reward IDs, presentation metadata, level or grant requirements | `assets/app/mode-atlas-reward-rules.js` |
| Private verified-account audience and UID grants | `backend/functions/rewards.cjs` |
| Authenticated, rate-limited transport | Existing `modeAtlasSocial` callable, `rewards` action |
| Expiring account-bound presentation cache | `assets/app/mode-atlas-reward-access.js` |
| Banner and title/frame selection, independent cloud clocks | Existing `ModeAtlasProgress` appearance |
| Atlas avatar selection and validation | Existing Friends profile owner |
| Device app icon | Existing `AtlasPlatform.setAppIcon` / native bridge |
| Accessible collapsible collections | `assets/ui/mode-atlas-rewards-ui.js` |

No new Firebase function, dependency, Apple capability or app group is required.
No private email or audience hash is shipped in web/iOS assets. The initial audience
uses an exact normalized verified-email digest checked against Firebase Admin's
current user record, never request fields or token email. No administrator UI or
client save field can grant itself access. Moderator status grants no extra rewards.
Admin's `allCustom` access applies only to grant-backed items; normal levels remain
earned normally. The existing title/frame bundles remain compatible with old saves.

## Adding exclusive or event rewards

1. Add the item to the relevant shared catalogue (`banners`, `frames` via
   `landmarks`, `icons`, or `avatars`). Use a stable ID no longer than 24 characters.
   Level rewards have `level`; custom rewards have `grant` and `kind: 'exclusive'`
   or `kind: 'event'`. A shared grant key can unlock a coordinated set across types.
2. Add the artwork/presentation in its existing category owner. Image banner CSS
   belongs in the existing rewards stylesheet; Atlas avatar symbols come from the
   catalogue. Images are packaged with both website and native assets.
3. Award a grant through trusted backend code/Admin SDK to
   `rewardEntitlements/{firebaseUid}`. Example private document:

   ```json
   {"grants":{"spring-2027":{"awardedAt":1800000000000,"startsAt":1800000000000,"expiresAt":0}}}
   ```

   All timestamps are epoch milliseconds. Omit `startsAt` for immediate access;
   omit/zero `expiresAt` for a permanent earned reward. `revoked: true` disables it.
   Time-limited access ends at `expiresAt`. An event's claim window is separate:
   a future event-awarding service should check that window and award a permanent
   grant if the reward should remain after the event. There is no public redemption
   endpoint or event campaign UI in this framework release.
4. Future iOS app icons also need their named appiconset committed before release.
   Project synchronization derives the alternate names from the shared catalogue
   and refuses missing assets. The Swift bridge accepts only icons present in the
   compiled app metadata. New icon artwork requires an app update; changing grant
   eligibility for an already bundled reward does not.
5. Build canonical assets/backend, validate both clients and backend, deploy backend
   before releasing clients, and inspect both light/dark layouts.

The Hunny seed may be revoked using the same private UID record with
`grants.hunny-tester.revoked = true`. Audience membership alone cannot override that
revocation. Admin retains testing access to custom rewards.

## Cache, sync and privacy

- The private grant action works before Friends enrolment and survives leaving
  Friends. Full account deletion removes UID grant records through existing cleanup.
- Firestore denies direct client access to entitlement documents, including the
  owner. Account saves, backup imports and forged claims cannot award server access.
- The cache contains only a UID, grant keys, admin testing flag and bounded times.
  It is excluded from exports and cloud learning saves and cleared on account
  transitions/sign-out. Delayed responses cannot populate another account's cache.
- Offline presentation lasts at most 24 hours and never beyond an access expiry.
  Online reads refresh on return/open, with concurrent reads deduplicated and a
  one-minute throttle. Failed/older backends retain normal rewards and show Retry.
  The cache is a presentation convenience, not proof of ownership. Public Friends
  responses validate selected custom cosmetics with fresh server access, so local
  modifications do not grant public custom rewards.
- Revoked/expired selections safely render the default without overwriting the
  user's saved selection or XP. If access returns, the selection can display again.
- Ordinary friend cards do not incur extra grant reads; only equipped custom items
  need entitlement revalidation. Role lookup still uses the existing batched owner.

## Rollout and verification

Public version **2.83.0**, native build **2080003**. Run `social:install`,
`build:social`, and `social:deploy` before syncing the native app. The initial tester
banner is automatic after deployment/sign-in; no manual Firebase grant is required.
Use Your Atlas → Rewards → Profile banners → Hunny to select it.

Coverage includes grant/level isolation, UID switches, delayed responses, offline
expiry, normal-user hiding, admin access, keyboard disclosure controls, large text,
both themes/targets, Friends viewing, forged token/save rejection, private rules,
grant activation/revocation and full-account cleanup. Existing XP, merge, emulator,
public-site packaging and native simulator/archive gates remain required.
The guided tour highlights the visible Profile banners collection heading, so its
controls stay reachable while other reward collections are collapsed.
