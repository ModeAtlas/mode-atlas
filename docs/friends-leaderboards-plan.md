# Friends and leaderboards: proposed next stage

Implementation update: see [Friends and private rankings — 2.76.0](friends-leaderboards-2.76.0.md)
for the implemented, gated feature and its outstanding production activation.
The original design below remains context; weekly competitive XP is deferred.

Status: design review only, 2026-09-30. No social UI, collections, rules,
functions or billing changes are enabled by the 2.74.1 home-layout fix.

## Experience

Keep the six learning destinations in the iOS dock. Add a Friends entry inside
Your Atlas, opening a shared web/iOS social surface with Friends and Rankings
tabs. Use the same profile card and frame/title renderer across the friends
list, rankings and profile detail, with native spacing supplied by iOS styles.

Start with opt-in profiles and accepted friendships, rather than a global
directory. A friend code or share link opens a profile preview and request;
the recipient accepts or declines. Include cancel, remove and block. Start
with an app avatar and chosen display name; sharing a provider photo should be
an explicit choice. Never expose an email address as a public display name.

Suggested ranking choices:

| Choice | Comparison | Purpose |
| --- | --- | --- |
| This week | Validated XP earned during one common week | Gives newer learners a chance to lead |
| All time | Account XP, with level shown | Shows long-term progression |
| Study streak | Consecutive qualifying study days | Rewards routine, not an answer combo |
| Mastery | Number of mastered kana, Reading/Writing filter | Rewards breadth and retained recall |

Every row shows rank, display name, avatar/frame, title and the selected score.
Include the current learner; give equal scores equal rank and use a stable
secondary order. Use mastered counts across the canonical kana catalogue,
not percentages of a user-selected subset. Define the weekly boundary once
on the server and display its reset time. Do not reset any personal XP or
level when a ranking period changes. Empty states should invite a friend or
start practice, with no fabricated competitors.

## Existing sources and the missing backend

`cloud-sync.js` currently reads/writes the private save at
`users/{uid}/appData/kanaTrainer`. The repository contains no deployable
Firestore rules, indexes or Cloud Functions project. Deployed console rules
and the project's billing plan have not been inspected in this review.

Reuse the existing Firebase UID and provider-linking flow. Reuse the canonical
progress, routine, mastery and reward rules; do not create another XP/level
calculator in the social UI. Google/Apple linking continues to preserve the
same UID; a separate sign-in to an unlinked account does not imply a merge.

Separate responsibilities:

- **Private learning save:** existing sync owner; never readable by friends.
- **Social profile:** explicitly shared display fields, appearance IDs and
  derived statistics. Validate lengths, allowed values and unlocked frames.
- **Relationships:** accepted connections, pending requests and blocks. A
  server transaction owns both sides; clients cannot accept on another
  person's behalf. Codes need non-guessable values, lookup limits and rotation.
- **Rankings:** bounded, indexed projections derived by the server; clients
  cannot assign their rank or write a competitive XP total.
- **Presentation:** one shared social service/renderer; iOS supplies layout.

Firestore reads grant access to an entire document, so public/friends fields
must be stored separately from private account/save fields. Rules are not a
filter for a query over all users. Fetch accepted friends via authorised,
bounded reads or a server endpoint; paginate instead of loading every profile.

## Score integrity and offline behaviour

Current totals are client-calculated and deliberately support offline study,
backup import, reset and migration. Copying those values into a server-owned
document would not make the underlying scores verified.

For the first private friends release, historical level/mastery can be shown
as the learner's synced progress, with no claim that it is cheat-proof. Before
public competitive rankings, add a shared event contract and server validation:
authenticated UID, issued run/question identity, answer/completion rules,
idempotency keys, replay limits and bounded rewards. Server and client must
share the reward policy rather than maintain two diverging implementations.
App Check is additional abuse resistance, not evidence of a correct answer.

Keep personal study usable offline. Decide explicitly which offline events
can count competitively and their submission deadline; do not silently erase
personal gains or backfill imported XP into a weekly competition. The existing
daily activity buckets do not contain a trustworthy weekly XP ledger, so
weekly XP needs new event-derived accounting going forward.

## Release requirements

1. Confirm existing deployed Firestore rules and project plan, then check
   rules/indexes/backend source into the repository under one deployment owner.
2. Test with the Firebase emulators and multiple accounts: opt-in, request,
   accept, decline, block, account switch, duplicate requests and ranking ties.
3. Extend account deletion to revoke visibility immediately and reliably clean
   up profiles, requests, friendship edges and ranking entries, including
   retry handling. Opt-out must remove ranking visibility too.
4. Test attempts to read another learner's private save, forge rewards or
   mutate another person's relationships; enforce request and page limits.
5. Test offline/stale UI, restored backups, concurrent web/iOS sessions and
   ranking-period boundaries. Preserve the existing save schema and personal
   progression behaviour unless a reviewed migration explicitly changes them.
6. Review the concrete deployment and any billing change before enabling it.

The recommended server-functions approach can be built and tested with the
Firebase emulators first. Production Cloud Functions deployment requires the
Firebase Blaze plan; this is separate from Apple developer membership. No
Firebase billing change is included in this update.

## Official references checked

- [Firestore field access](https://firebase.google.com/docs/firestore/security/rules-fields)
- [Firestore rules and queries](https://firebase.google.com/docs/firestore/security/rules-query)
- [Cloud Functions setup and deployment](https://firebase.google.com/docs/functions/get-started)
- [App Check security guarantees](https://firebase.google.com/docs/app-check)
