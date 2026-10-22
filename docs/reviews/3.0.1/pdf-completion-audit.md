# PDF completion audit at Mode Atlas 3.0.1

Source: **Mode-Atlas-Independent-Review-2026-10-22.pdf**, all 22 pages.
Reviewed source: `3e8f9fd92ed9a71552b812aa7f762749aa8a1f8c` (3.0.1), compared
with `96ea537` (3.0.0) and `08237e5` (the flame-only 2.122.0 baseline).

**The PDF has not been fully implemented.** 3.0.0 contains substantial changes;
3.0.1 mainly removes excessive interface copy and rearranges its presentation.
Neither the release number nor the number of passing tests closes the remaining
requirements. The original 3.0.0 acceptance checklist incorrectly marked broad
requirements complete and has been corrected.

This audit distinguishes code implementation from acceptance evidence. It does
not claim a fresh production inspection, educator review, user study or physical
device run. It uses the PDF, commit differences, current source, data inventories
and the recorded local browser/test evidence.

## Scope fixed by the user's instructions

- Keep coin-purchase placeholders. The PDF's recommendation to remove them is
  explicitly excluded, not an unresolved defect in this work.
- Home is the broad personal app hub, Learn is the branch directory, Kana is
  exclusively Kana. Future branches belong in Learn.
- The PDF's comparisons with full language courses establish a scope limitation;
  they do not specify a complete new grammar/speaking curriculum for this release.
  They do require a small, connected, properly taught beginner learning outcome.
- Human studies, educator review and production/device checks remain incomplete
  until actually performed. Writing a protocol does not complete them.

## What 3.0.1 actually changed

| PDF pages | 3.0.1 change | Limit |
| --- | --- | --- |
| 3, 9, 17 | Removed two Home explanation cards; removed Learn's introductory/scope panel; simplified branch cards. | Does not redesign the returning-user decision hierarchy or the onboarding transition. |
| 4, 9 | Five-character Kana entry with Start lesson; shorter placement and row guidance. | Does not change learning rules or fix every legacy trainer label. |
| 5–7, 9 | Shorter Kanji/Kana session summaries, Profile and Progress copy; detailed Kanji metrics moved into disclosures. | Does not deliver the PDF's complete results/next-review experience. |
| 6, 15 | Shorter Word Bank entry and review instructions; usage tip optional. | No new vocabulary units, reviewed recordings or curriculum depth added in 3.0.1. |
| 10 | Removed obsolete presentation markup/styles. | No broad module, storage or backend restructuring in 3.0.1. |

The 3.0.1 data/schema/backend policies are unchanged. The eight isolated Kanji
reading instructions and word/character question wording received copy changes,
not new teaching content.

## Design and first-use requirements

| ID / PDF | Status at 3.0.1 | Evidence and remaining work |
| --- | --- | --- |
| D1 · pp. 3, 17 — distinct, gradual beginner experience | **Partial** | `mode-atlas-learning-experience.js` distinguishes new/starting/returning. Home hides empty stats; Kana hides advanced tools. But a single correct or wrong answer makes `hasLearning` true, and Home reveals all established sections. The first-use unit test explicitly expects this. A staged transition based on meaningful progress is still needed. |
| D2 · p. 3 — Home/Learn/Kana have distinct jobs | **Implemented in source** | Home has personal overview, Learn renders the branch library, Kana owns Kana. 3.0.1 removes duplicate explanatory panels. |
| D3 · p. 3 — one useful next learning action | **Partial** | Home has one primary recommendation; existing `ModeAtlasBranches.recommend()` respects the last branch. It is not a completed, consistent lesson/review journey across branches: Word Bank returns to the collection and its new lessons have no durable continuation state. First-session completion without coaching remains untested with learners. |
| D4 · p. 4 — compact Kana path and advanced options on request | **Implemented in source** | `mode-atlas-kana-page.js` has a focused next row, explicit full-path access, optional placement and tools. First-use and Kana browser evidence covers access. |
| D5 · p. 4 — consistent Read/Recall terminology | **Incomplete** | `mode-atlas-reverse-page.js` still contains Writing Practice, Writing Daily Challenge and Writing Test Mode labels. The 3.0.1 captured `/writing/` main text contains “Press Start to begin Writing Practice.” This exact PDF finding was missed. |
| D6 · p. 7 — one achievable early commitment, reveal other goals later | **Partial** | Empty Progress is simplified and goals are hidden on fresh Home. After one answer, Home renders the normal daily-goal collection; a gradual beginner commitment flow was not implemented. |
| D7 · pp. 5–6, 15 — clear assessment scope beside labels | **Partial** | Sources/help describe approximate bands; some session wording changed. Formal Kanji results still use N5–N1 plus Pronunciation/Meaning labels without an adjacent content-band qualification. 3.0.1 removed long explanations but did not replace every one with concise, sufficient labels. |
| D8 · pp. 8–9 — coherent wardrobe and appearance | **Implemented changes; acceptance partial** | Avatar editor defaults to available items and one clothing category; Shop supports type/owned/affordable filters; System/Light/Dark is directly available. No realistic new-user earning/spending walkthrough is recorded. Coin purchase remains intentionally unchanged. |
| D9 · p. 9 — shared visual grammar and consistent journeys | **Incomplete** | The shared flame was fixed in 2.122.0. 3.0.0/3.0.1 did not establish and apply the proposed icon/illustration roles or comprehensively align Kana, Kanji, Word Bank and results layouts. Removing copy is only part of this requirement. |
| D10 · pp. 9, 19 — measured accessibility acceptance | **Partial / device evidence absent** | Keyboard, focus, narrow-screen and enlarged-text fixtures exist. Real VoiceOver, Japanese reading order, IME, touch and task completion on physical devices were not verified. No WCAG conformance claim is justified. |

## Learning, results and progress requirements

| ID / PDF | Status at 3.0.1 | Evidence and remaining work |
| --- | --- | --- |
| L1 · pp. 5, 7, 18 — remove lifetime-accuracy mastery penalty | **Implemented in source** | `mode-atlas-kanji-state.js` uses a bounded recent independent-answer window and retains earned milestones. Tests cover recovery after early mistakes and migration. This is a substantive 3.0.0 fix. |
| L2 · pp. 5, 18 — missing example-word coverage | **Implemented field coverage; quality review open** | Added 545 dictionary-backed examples. Current dataset: 2,375 of 2,383 entries have examples; eight are explicitly isolated readings. This satisfies the fill-or-scope-out part, not the broader reviewed teaching standard. |
| L3 · pp. 5, 15 — reviewed Kanji teaching standard across bands | **Incomplete** | There are still only 84 custom cues, all N5; N4–N1 have zero custom cue fields. Most use a generic “Find this character inside this word” template. Tailored confusion guidance, contextual use, accepted-meaning review and educator sampling across bands are not complete. A dictionary word is not a complete lesson. |
| L4 · pp. 6, 15–16 — small complete practical learning outcome | **Partial** | Six original units teach 30 words with examples, reading recall and one application question per unit. They save words for review. They do not form a durable, sequenced course connected to the learner's Kana/Kanji progress; the lesson index/phase lives only inside the open dialog. Audio remains device synthesis rather than reviewed recordings. Delayed transfer/retention has not been tested with learners. |
| L5 · p. 6 — useful Word Bank recall modes | **Implemented in source** | Meaning self-rating, typed reading and listening transcription have separate schedules; listening checks require playback. Personal words retain reading/context. This is a real 3.0.0 addition. It is not a full listening or sentence-use curriculum. |
| L6 · p. 6 — consistent “tested / difficult / next / when” results | **Incomplete** | Immediate summaries and mistakes actions exist. Canonical Kana and Kanji formal-results owners were not overhauled in 3.0.0/3.0.1. Kanji history still primarily presents score, accuracy, speed, answers and Revisit mistakes; no consistent next-review timing is shown. |
| L7 · pp. 4, 6–7, 18 — all-branch study-day recognition | **Implemented in source** | `habitUnits()` includes Kana/Kanji attempts plus bounded distinct word/handwriting receipts. Five eligible units qualify; mistakes participate. Self-marked word/handwriting activity does not mint competitive currency. |
| L8 · p. 7 — account overview includes non-Kana work | **Implemented in source** | Profile now displays Kanji correct answers, reviewed words and recent completed handwriting, in addition to Read/Recall. Weekly habit computation includes the wider activity policy. |
| L9 · pp. 5, 15, 19 — educator review and learning outside the UI | **Not performed** | A protocol was written. No independent educator assessment, recruited learner baseline, next-day/week recall or transfer study was performed. Those cannot be reported as completed implementation or proven learning value. |

## Code, storage and security requirements

| ID / PDF | Status at 3.0.1 | Evidence and remaining work |
| --- | --- | --- |
| T1 · p. 10 — reduce common eager page work | **Partial** | Avatar/social/mastery interfaces load on demand. Recorded Home dependencies fell from 93 to 92 scripts and 813,455 to 772,658 raw bytes, about 5%. This is not completion of task-based loading for account, shop and other optional systems. |
| T2 · p. 10 — clearer interfaces, policy/render separation, readable source | **Partial** | Learning presentation and prompt policies have owners, and event contracts are documented. Large globals/event coupling and dense source remain. Current progression is 867 lines and cloud sync 1,966; file length alone is not a defect, but the requested boundary/refactoring work was not completed. |
| T3 · pp. 10–11, 19 — measured answer/save performance | **Partial** | Compact checked recovery journals reduce duplicate durable payloads for suitable large objects. A local interrupted-save fixture was measured. Authoritative writes remain synchronous. No modest-iPhone median/p95 hot-path trace, agreed performance budget or realistic device comparison exists. The PDF makes asynchronous storage conditional on evidence; migrating storage blindly is not required. |
| T4 · pp. 11–12 — consistent save size limits | **Implemented in source** | Shared part count is bounded to 32; part/rules/backend checks are aligned to the decoder budget. This does not guarantee browser free storage. |
| T5 · pp. 11, 17–18 — consumer export and reviewed restore | **Implemented in source** | Settings exposes learning export/restore, preview, confirmation and account checks. Backups exclude wallet/auth/staff/competitive receipts. Tests cover guest-to-account restore and foreign-owner rejection. |
| T6 · pp. 11, 19 — real two-device and mature-save durability | **Not validated on real devices** | Merge, account-switch, interrupted-write and large-save fixtures exist. The specified two-device offline/concurrent edits, nearly-full storage and production-like deletion/recovery exercise was not completed. |
| S1 · pp. 8, 12, 18 — stronger reward authority and review policy | **Implemented source controls; deployment unverified** | 3.0.0 adds account-bound server-issued session tokens/seeds, expiry, prompt sequencing, replay rejection and implausible-timing holds with an operator release tool. Public answers can still be automated; this is not proof of human study. |
| S2 · p. 13 — privileged identity and auditing | **Implemented source controls; operations incomplete** | Admin authority uses a server Auth claim rather than an email comparison. Staff changes require recent auth; moderation actions are audited. Strong operator authentication, recovery arrangements and routine audit review were not verified in production. |
| S3 · pp. 12, 18–19 — active attestation rollout | **Not configured in shipped source** | `MODE_ATLAS_APP_CHECK` remains `{webSiteKey:'', iosEnabled:false}`. Main callable enforcement depends on an environment flag whose live value was not inspected. App Check integration code is not an activated deployment. |
| S4 · pp. 12–13, 18–19 — deployed rules, quotas, IAM, alerts and retention | **Not verified** | Rules, TTL configuration and controls exist in source. Actual project settings, provider rollout, deletion retries, TTL execution, alerts/cost limits and staged abuse exercises were not inspected or completed here. |

## Monitoring, native behavior and acceptance evidence

| ID / PDF | Status at 3.0.1 | Evidence and remaining work |
| --- | --- | --- |
| M1 · p. 13 — consented lesson/review/abandonment/recovery measurement | **Partial and contains a missed implementation item** | Added bounded guest counters and route classifications. `reviewCompleted` is whitelisted but has no event emission in canonical source. Lesson exits are only inferred on pagehide, not all in-app departures. Counts lack a completed per-branch analysis path. |
| M2 · pp. 13, 17 — operational learning/retention evidence | **Not established** | Reporting depends on App Check and is unavailable with shipped settings. Guest device counters are not all-user retention, and no actual day-two/day-seven or learning outcomes were measured. |
| N1 · p. 14 — accurate offline/audio promise | **Implemented disclosure; capability unchanged** | About explains loaded-page web practice versus installed native assets and device-generated speech. No new cold-offline web cache or reviewed recording library was added. The PDF asks for an accurate promise, not an unconditional offline rewrite. |
| N2 · pp. 14, 19 — widgets, notifications and real native checks | **Not physically verified in this work** | Existing projection/policy tests and simulated iOS checks are retained. App Groups, real refresh/delivery, tint/sizes, permission changes, token refresh and account cleanup require physical evidence. Prior user reports of individual working features do not replace this release's specified matrix. |
| V1 · pp. 3, 9, 17–19 — uncoached first-session study | **Not performed** | No beginners/rusty learners were observed completing the revised journeys. Automated clicks do not establish that a person can discover the correct path. |
| V2 · pp. 18–20 — complete release/deployment evidence | **Incomplete** | Local release checks and browser/service tests passed as recorded. Full local Functions callable/trigger startup was blocked. Xcode compilation/archive and a live web deployment were not established for these bundles. |

The pages describing competitor offerings, research references and source ownership
(pp. 16, 21–22) inform these requirements; they are not extra features to implement.
The PDF's P3 condition remains: further curriculum/cosmetic/monetization expansion
should be justified by evidence. Retaining the user's coin placeholders does not
close or excuse unrelated work.

## What must change before claiming completion

1. Finish gradual onboarding and the remaining scope/terminology issues. Preserve
   the user's hub roles and experienced-user access; do not substitute paragraphs
   of explanation for the flow.
2. Complete the small practical learning sequence: durable continuation, explicit
   sequencing, contextual transfer, reviewed audio/content and connected reviews.
   Raise Kanji teaching quality beyond automatic example-word supplementation.
3. Make session and formal results consistently provide the tested skill, mistakes,
   a useful next action and review timing through compact UI.
4. Complete the targeted interface/loading cleanup and visual grammar; measure
   performance under the PDF's device/large-save conditions before making a broader
   storage decision.
5. Finish event instrumentation and its aggregate analysis; configure and inspect
   production attestation, privileges, retention, quotas and alerting.
6. Execute and record educator, learner, device, durable-data and release validation.
   Identify any access/person/device dependency explicitly instead of checking it off.

These are remaining work categories, not a claim that another small patch will
complete them. No completion percentage is assigned: splitting broad requirements
into many small code tasks would create a misleading score.
