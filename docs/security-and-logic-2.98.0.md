# Mode Atlas security and learning-logic review

Reviewed 14 October 2026. Baseline: `ebfd33bb0ec0dc2c9600f17d1e5112995a375710`
(2.97.0). Fixes ship in **2.98.0 / 2080020** on
`agent/mode-atlas-2.68.0-ios-theme`.

## Result and limits

The account boundary needed a material privacy change: signing out previously kept
the departing account's learning data on the device. This release clears that data,
removes old per-account caches, and prevents late asynchronous results from restoring
it. Signed-in offline work is preserved. The review also fixes Writing input, Words
handling, moderation evidence and publication boundaries described below.

The reviewed server paths enforce account ownership, moderation roles and private
wallet writes. **The economy is not yet trustworthy against a modified client:**
level coins derive from owner-writable XP, and weekly answer receipts do not prove
that a human answered the questions. Resolve those trust gaps before enabling real
money purchases or attaching significant value to competition rewards.

This is a source review with unit and browser checks, not a
production penetration test or a claim that every possible settings combination
has been exhausted. No live user records were changed. Repository code cannot prove
the current Firebase console configuration or the rules deployed to production.
Browser tests emulate the native environment; real iPhone input, Apple/Google auth,
push delivery and signing still need the checks at the end of this document.
Public publication of this source and artwork was explicitly approved on 14 October
2026. The [release gate for each commit](https://github.com/ModeAtlas/mode-atlas/actions/workflows/release-check.yml)
is the authoritative record of full Firebase callable/trigger and native Xcode checks.

| Validation | Evidence |
| --- | --- |
| Release audit and JavaScript regressions | 177 passed; generated release/native payload checks passed. |
| Python/build/publication regressions | 15 passed. |
| Browser checks | All 258 unique release cases passed across main and focused runs: 208 polish, 12 simulated iOS shell, 38 packaged desktop/mobile smoke. The expected test list was reconciled with passing results; none were omitted. |
| Real Auth/Firestore/rules with direct service calls | 53 passed, including Hunny purchases and moderation snapshots. |
| Full callable transport and triggers | Required in GitHub CI. Local emulator workers fail to connect to their Unix socket (`EPERM`); the service-only result does not replace this gate. |
| Swift tests, simulator builds and unsigned Xcode archive | Required on the Mac CI runner for the same commit. Physical iOS testing remains separate. |

Checks initially caught a missing stable version-check endpoint in the new packaging
allowlist; it was restored and packaged update checking passed. The missing historical
stylesheet fixture was fetched at its exact commit, and shop mocks were updated to
omit ineligible offers just as the server does. Product assertions were not relaxed.

## What a user can inspect or influence

| Surface | Exposure or influence | Authority and review outcome |
| --- | --- | --- |
| Public GitHub repository | Source, development branches, assets, configuration and committed history | The repository was public when checked. Packaging changes cannot conceal unreleased work committed there. |
| Website | Downloaded HTML, JS, CSS, artwork, Firebase client configuration and network requests | Expected for a browser app. Local scripts, UI state and storage can be modified. They cannot be an authorization boundary. |
| iOS app | Bundled web assets, shipped artwork, native code/configuration and the device's app data | Native packaging does not make client code or assets secret. App sandboxing separates ordinary apps; a controlled/instrumented client can still alter its own requests. |
| Own learning save | XP, answers, SRS, Words and other personal save fields | Firestore allows the authenticated owner to write them. Suitable for personal offline learning; unsafe as proof of competitive performance or currency earnings. |
| Other users' private data | Direct reads/writes of another UID, wallets, reports, staff records and grants | Reviewed Firestore rules deny them. Callables validate real Auth identity and the operation's permissions. |
| Friends and weekly profiles | Whitelisted name, portrait and learning/ranking summary | Relationship, opt-in and block rules govern projections; private Words, email, grants, wallet and reports are not returned in public profiles. |
| Coins and shop | Local display can be changed; users can call purchase endpoints directly | Server transaction owns price, eligible offer, balance, inventory and receipts. Direct wallet writes are denied. XP-derived earnings remain the exception described below. |
| Exclusive/paid/unreleased art | Any shipped or publicly committed image/SVG can be viewed or copied | Server ownership controls legitimate purchase, equip and public projection, not access to the image bytes. Hidden UI is not protection. |
| Moderation/admin | Client menu/code can be inspected or made visible locally | Actual operations check the verified account and server-owned staff records. Members cannot obtain report queues, assign themselves roles or invoke developer coin controls. |
| Logs and diagnostics | Users can inspect their own browser console, client diagnostics and requests | Server logs require Cloud IAM. Avoid secrets in client logs regardless of whether a developer menu is hidden. |

Firebase client API keys identify the project; they are not passwords. Authorization
comes from Auth, Security Rules, server checks and IAM. Check the key's actual API
restrictions and authorized domains in the console. See the official
[Firebase API key guidance](https://firebase.google.com/docs/projects/api-keys).

The publication builders now share `public_runtime.py`: only release JS/CSS,
runtime HTML, supported media/fonts and specific attribution files are copied from
runtime directories. Hidden paths, arbitrary JSON, notes, logs, source maps and
unversioned duplicate scripts are excluded. Native packaging also rejects symlinks.
The stable version-check endpoint and explicit root compatibility scripts remain
public. Backend source, tests, native
project files, development docs and dependencies are outside the published runtime.
A scan of 448 tracked text files found no private-key/service-account/GitHub/AWS
credential patterns; this was not a full-history secret audit.

## Fixed findings

| Priority | Finding | Change and evidence |
| --- | --- | --- |
| High | Sign-out retained private learning data and old account caches | `cloud-sync.js` clears the canonical app-storage boundary and starts a guest save. Regression tests cover cancellation, confirmed discard, online save, failed sign-out and switching accounts. |
| High | Late cloud work could outlive a sign-out or A → B → A transition | UID plus account epoch guards cover hydration and sync. Old stalled work is detached; it cannot clear a new promise, render an old response or start a new write for another account. |
| Medium | Offline push-token deletion could block local iOS privacy cleanup | Network token deletion no longer occupies the widget/reminder queue. Reset also removes delivered app notifications, including account push messages. Native compilation and physical checks remain required. |
| Medium | Another tab could checkpoint a departing account after storage was cleared | Account-change suspension no longer captures a checkpoint. Explicit pre-sign-out suspension still saves a checkpoint, allowing cancellation to resume later. Owner changes stop and reload other tabs. |
| Medium | A confirmed Words clear/delete could resolve after an account switch | The operation captures the account revision and rejects a stale confirmation. Drafts and open edit state clear at the boundary. |
| Medium | Malformed Words data or quoted IDs could break editing | Load validates entries, repairs duplicate/missing IDs, uses local element references instead of interpolated selectors, and treats note content as text. |
| Medium | Writing could grade an unfinished Japanese IME composition | Intermediate composition events do not score. Committed kana is evaluated once, including the trailing input event. |
| Medium | The romaji-conversion Writing keyboard displayed the kana answer | Both Writing keyboard formats show the romaji cue. The conversion format explains that the user must convert to kana and press Enter. |
| Medium | A moderation report omitted the reported character's wardrobe | Reports now preserve the canonical character configuration alongside the name/photo. Staff can compare the reported look with the current look; report hashing includes the character. |
| Low | Equivalent halfwidth/fullwidth Words created inconsistent entries | NFKC normalization precedes validation and duplicate checks. Romaji uses an apostrophe for syllabic n before a vowel or y, e.g. `shin'you`. |
| Low | Runtime directories could accidentally publish arbitrary support files | Shared publication allowlist is covered by Python packaging regressions and both production builders. |

## Account lifecycle after this release

| Situation | Intended behavior |
| --- | --- |
| Signed in, connection lost | Retain the account's local save and continue learning. Reconnect retries cloud synchronization. |
| Explicit sign-out, confirmed online sync | Suspend the active run, flush answered work, sign out, clear app-owned local/session data and legacy account caches, then reload into guest mode. The cloud account remains. |
| Explicit sign-out, offline or sync not confirmed within eight seconds | Explain that unconfirmed work would be lost. “Keep studying” preserves the account; “Sign out and clear” discards its device copy. |
| Firebase sign-out fails | Stay signed in and show a retry message; do not clear the learning save. |
| Another account signs in | Do not restore the previous account's cache or merge it into the new UID. Hydrate the selected account's cloud data. |
| Auth restores signed out while a private local owner remains | Remove the private local save and reload. |
| Another browser tab changes ownership | Stop in-memory practice, invalidate pending work and reload through shared Firebase auth. |
| Guest studies and then signs in | Existing guest-adoption behavior remains: genuine guest work may merge into the chosen account. Consider a future “Keep guest progress?” choice for shared devices. |

The JS Firestore SDK uses its default memory cache here, not persistent Firestore
storage. Reloading also drops that cache and module-held private snapshots. Local
learning persistence uses the app's explicit storage layer. See the official
[Firestore offline documentation](https://firebase.google.com/docs/firestore/manage-data/enable-offline).
Native account-change handlers clear widget/reminder state and retire push-token
ownership. Physical offline push cleanup and WidgetKit refresh timing need testing;
they are not proven by browser mocks.

## Remaining security work, in priority order

1. **High — move currency earnings to a server-owned ledger.**
   `backend/firestore.rules` permits owner writes to `users/{uid}/appData`, including
   XP. `commerce.cjs` calls `levelFromSave` and credits new levels using a high-water
   mark. That prevents duplicate credits, but an edited XP total can advance the
   high-water mark and mint unearned coins (up to 29,910 at the current level cap).
   Lifetime rankings and level cosmetics also inherit the editable save's trust.
   Separate personal offline data from accepted earning events. Establish a vetted,
   one-time legacy baseline; accept bounded, idempotent offline study batches and
   calculate earnings on the server. Purchased currency needs independently verified
   StoreKit transactions. This release preserves existing earnings rather than
   silently confiscating coins or disabling offline work.
2. **High — strengthen weekly competition against automation.**
   The server checks ordered receipts, correct answers, declared/observed pools,
   timing, run expiry, daily caps and duplicate submissions. Those checks block
   direct score assignment and replay, but a modified client can fabricate valid
   study receipts. Introduce server-issued prompts/challenges, plausible rate limits
   and abuse monitoring before raising prize value. Current first-place awards are
   100 coins. App attestation can help but cannot establish that a human learned.
3. **High if unreleased work must be confidential — repository visibility.**
   Move the repository/private designs behind appropriate access controls and review
   Pages hosting implications before changing visibility. Public history may already
   have been copied. Any artwork intentionally shipped to clients remains readable.
4. **Medium — verify production configuration and roll out App Check.**
   The source does not initialize/enforce App Check. Configure web/native providers,
   monitor supported clients, then enforce on protected callables and Firestore.
   Review Auth providers/domains, API restrictions, IAM, deployed rules and log access.
   Do not turn enforcement on blindly for installed clients. Official guidance:
   [App Check for callable functions](https://firebase.google.com/docs/app-check/cloud-functions).
5. **Medium — narrow legacy personal-save schemas.**
   Owner access is broad across `users/{uid}` and arbitrary `appData/{docId}`. Inventory
   deployed client needs, then constrain document names, sizes and fields. The existing
   progress-version guard does not validate the truth of XP or answer counts.
6. **Medium — dependency maintenance (registry audit completed).**
   `npm audit --omit=dev` reported six high-severity dependency entries in the client
   lockfile and two moderate entries in the functions lockfile. These are dependency
   chains, not eight independently demonstrated app exploits. The client entries
   trace to Node `@grpc/grpc-js` 1.9.16: the
   [certificate-context advisory](https://github.com/advisories/GHSA-m9gg-hp2v-232j)
   and [error-message advisory](https://github.com/advisories/GHSA-f596-whhp-79r4).
   They concern gRPC server behavior. Mode Atlas uses the Firebase browser build
   on web and builds iOS vendor code with `platform:'browser'`; this review found
   no Mode Atlas gRPC server or `getAuthContext` use. Treat that as a reachability
   assessment, not proof that vulnerable dependencies should remain indefinitely.
   The functions chain is `gaxios` → `uuid` 9.0.1, with a
   [buffer-bounds advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq) affecting
   v3/v5/v6 with supplied buffers. The inspected gaxios call uses v4. Plan compatible
   upstream dependency updates and rerun native/auth/emulator checks; do not apply
   the audit tool's suggested major downgrades of Firebase/Capacitor plugins.
   No dependency version was changed in this review.
7. **Medium — defense in depth and history review.**
   Add a tested Content Security Policy and appropriate hosting headers; the current
   source has no CSP. Review full repository history with a
   dedicated secret scanner. Rotate any actual secrets found, not public Firebase IDs.

Existing controls worth retaining: verified, non-disabled Auth accounts checked on
the server; protected staff hierarchies; private moderation warnings/reports;
transactional purchases and weekly settlement; bounded avatar schemas and optimistic
revisions; account-deletion reauthentication, write barriers and retry cleanup; and
private notification/token ownership. Developer preview access never substitutes for
server authorization.

## Learning coverage and behavior

The added matrix covers **112 distinct preset/session/direction/platform cases**:
four presets × seven flows × Reading/Writing × web/simulated iOS. Each starts a run,
answers correctly and incorrectly through the relevant input, and stops cleanly.
Writing rotates four/six/eight choices and both keyboard formats across these cases.
This is a representative matrix, not the full Cartesian product of every setting.

| Dimension | Coverage |
| --- | --- |
| Presets | Starter 5 kana; Intermediate 46; Advanced 142; Pro 240. Expected pool and selected mode checked. |
| Sessions | Guided, Free, Endless, Speed Run, Time Trial, Daily Challenge, Test Mode. |
| Completion rules | Existing tests cover finite completion, partial Daily/Test not counting as completed, first Daily result retained on replay, timer pause/resume, partial timed runs not ranking and full Test results. |
| Writing | Choice counts 4/6/8; kana keyboard; Japanese romaji-to-kana conversion with Enter; IME draft/commit handling. |
| Modifiers | Empty rows; mixed scripts; joined kana; SRS; Focus Weak; hints; confusables; Combo same-row/random at two/three/four units. Sixty sampled prompts per modifier test check valid units and unique bounded choices containing the answer. |
| Small pools | Single-item Writing Combo cannot hang trying to manufacture eight unique answers. |
| Words | Add, duplicate rejection, halfwidth/voiced kana, romanization, notes/meaning edits, favourites, all seven filters and seven sorts, reload, malformed rows, quoted IDs, safe text rendering and account-switch deletion. |
| Privacy | Offline retention, explicit discard/cancel, failed sign-out, stale hydration, stalled sync, account ABA transition and another-tab practice suspension. |

Words is currently a collection/edit/search feature. It does **not** yet contain a
separate Words quiz or spaced-review session; those cannot be described as tested
learning modes. Choosing a review-biased Kana session does not mean every selected
character must already be due: the existing selection rules can fall back to the
selected pool. This remains an area for concise product explanation if testers find
it surprising.

## Hunny wardrobe

The pendant now sits at the neckline, above the jumper's bear face. The jumper and
pendant cost **10 Atlas Coins each** through separate permanent purchase grants.
Both eligibility (`hunny-tester`) and the relevant paid grant are required to equip
them. The existing entitled account and authorized developer preview keep access;
other accounts do not see offers and cannot purchase/equip them via direct calls.
Bear ears and the banner retain their existing access. Already-selected unpaid
pieces fall back until purchased, allowing the tester to unlock them as requested.
Offer rotation does not remove ownership; losing audience eligibility removes access.

## Follow-up tests on real devices and deployed services

- **Offline continuity:** sign in as A, study Reading/Writing and edit Words offline,
  force-close/reopen, reconnect and verify the same work on another signed-in device.
- **Shared-device sign-out:** cancel an offline sign-out and verify the save remains;
  then confirm discard. Check Progress, Words, profile drafts, back navigation,
  widgets and notifications. Sign in as B, then A; neither should inherit the other.
- **Two web tabs:** keep an active practice session in one tab and sign out in the
  other. Verify the old tab cannot display or save A's data after ownership changes.
- **Google and Apple:** test existing linked accounts, provider cancellation and
  reauthentication on Xcode 27/iOS 27. Browser automation cannot reproduce Apple UI.
- **Japanese keyboards:** try kana and romaji conversion, composition, prediction,
  paste, deletion and Enter on physical iPhone and iPad. Intermediate drafts must not
  count as wrong answers; one committed answer must score only once.
- **Hunny purchase:** eligible tester starts with at least 20 coins, buys each piece
  for 10, retries after an interrupted response, and checks ownership on a second
  device. Other accounts must not see offers or equip the items. Check the bear's
  face and necklace at portrait/full-body sizes in light and dark themes.
- **Multi-device conflicts:** make different offline Words edits/deletions on two
  devices and reconnect in both orders. Existing section-level conflict resolution
  has no per-entry deletion ledger; validate the preferred UX before changing it.
- **Production security:** verify deployed rules, Auth providers/domains, API-key
  restrictions, staff/IAM access and App Check settings. Emulator success proves the
  committed policy, not which version is currently deployed.

See [the release handoff](development-2.98.0.md) for build gates and the Mac command.
