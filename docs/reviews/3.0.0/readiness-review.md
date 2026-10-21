# Mode Atlas — review before 3.0.0

Reviewed 21 October 2026. Source: **2.117.1**, commit **7205f05fc18141836d8e09cff3755acd952c0cff**, branch `agent/mode-atlas-2.68.0-ios-theme`. This is an audit and implementation plan, not a new application release. Findings describe that commit.

**Decision: keep developing toward 3.0.0; do not yet treat this build as the finished 3.0 foundation.** The design is more coherent and the existing test gate is green. However, this review reproduced learning and save-integrity defects and identified an economic trust problem. More visual redesign is not the next priority.

## What was reviewed and what the evidence means

The review covered the canonical web runtime, shared learning policies, Firebase rules and services, account/sync boundaries, native adapters and Swift components, packaging, and CI. Generated revision copies and bundled third-party dependencies were treated as build outputs, not independent implementations to refactor.

Work included:

- Source inventory and structural searches across the runtime, CSS, backend, native sources, tests and build scripts; deeper tracing of learning, answer grading, scheduling, persistence, rewards, social queries and account lifecycle.
- Local deterministic probes of the actual review, Kanji, currency-projection and cloud-merge owners. No real accounts or production data were modified.
- A content check across **all 2,383 Kanji entries**, including converting each configured pronunciation answer to the romaji displayed by the app and grading that output again.
- Browser inspection of **13 routes on each of desktop and simulated iPhone**: Atlas, Learn, Kana, Kanji, Word Bank, Progress, Friends, full Shop, Read, Recall, Kana Results, Kanji Results and handwriting. Also Profile, compact Shop and Settings on both surfaces. Local Firebase guest responses were used; external services were blocked.
- The browser checks found **no page JavaScript errors or horizontal document overflow** in those configurations. They reproduced the Kanji grading and Word Bank representation problems described below. Representative screenshots were inspected.
- The repository ownership audit passed: **22 HTML documents, 156 generated JS/CSS files, 144 referenced generated assets**.
- The existing CI run for the exact reviewed commit is green: [release gate](https://github.com/ModeAtlas/mode-atlas/actions/runs/39536516234). Its evidence includes 15 Python checks, 239 JavaScript tests, 71 Firebase emulator tests and 345 browser tests, plus native model/router checks, simulator compilation and an unsigned device archive. These are existing CI results, not a claim that every suite was rerun in this review. The native job took 8m55s; the backend job 2m33s; browser polish shards 3m50s–6m26s.

This is not a guarantee that every line is defect-free. Live Firebase latency/load, signed physical-device authentication, VoiceOver, actual Japanese voice quality, APNs delivery, App Store signing and dependency vulnerability scanning were **not certified by this review**. Simulated iOS uses Chromium with the native adapter environment; it is not an actual WKWebView device run. The historical attached screenshot paths were unavailable; visual observations here concern the current rendered source.

## Findings to resolve before the 3.0.0 release candidate

Priority definitions: **P1** means release-blocking correctness, integrity or trust work; **P2** means important product quality, scalability or maintainability work. None of the findings below is evidence that another person's private account has been accessed.

### R01 — P1: Kanji rejects romaji that the app itself displays

**Confirmed in the content owner and the browser.**

For 十, the expected answer is じゅう and the displayed romaji is `juu`. Entering `juu` converts it to **ぢゅう**, and the app marks it incorrect. Inverting the Kana map into a romaji map allows duplicate romanizations to overwrite one another. Base exceptions do not fix the contracted readings. In the full data check, **82 configured pronunciation answers failed the display → type → grade round trip**. This includes 十, 住, 京 and 工. These are answer cases, not 82 independently reviewed translation errors.

Other inconsistencies exist in the same owner: `まっちゃ` displays as `matcha`, but the parser does not handle that spelling symmetrically; `コーヒー` displays as `koーhiー`. Some distinctions, such as ず/づ, are inherently ambiguous in romaji and require an explicit accepted-input policy.

Source: `assets/app/mode-atlas-kanji-content.js`, especially construction of `romanPairs`, `romaji`, `kana` and `grade`.

**Fix at source:** establish one tested Japanese input/conversion owner, with explicit common IME aliases and canonical display rules. Keep the correct kana visible; accept ambiguous romanized answers against the specific prompt's approved readings. Share the policy with server verification. Do not add a separate exception in the page controller for 十.

**Acceptance:** every configured reading round-trips; `ju/ja/jo`, `ji/di`, `zu/du`, doubled consonants, syllabic n, long vowels, half-width input and IME composition have meaningful tests. Both the browser and backend agree on accepted answers.

### R02 — P1: valid everyday English meanings can be marked wrong

**Confirmed.** 男 accepts “male” but rejects “man”, even though its own example vocabulary gloss is “man”. The grader normalizes spelling and punctuation but otherwise relies on the raw character gloss list. The near-synonym groups used for multiple-choice distractors are not shared with typed grading.

Source: `assets/app/mode-atlas-kanji-content.js` (`meaningAnswers`, `grade`, `choices`), `assets/data/mode-atlas-kanji-data.js`.

**Fix:** curate approved answer aliases per character/word and review ambiguous prompts. Reuse those approved meanings for lessons, feedback, typed answers, distractor exclusion and server scoring. Do not simply copy every vocabulary gloss into its component character's answers: word and character meanings are not always interchangeable. Avoid permissive fuzzy matching that accepts a genuinely different word.

**Acceptance:** a Japanese-competent content review of N5/N4 and a regression corpus of ordinary valid synonyms, invalid near-misses and ambiguous questions. Offer a small “Report this answer” action in incorrect feedback if desired, rather than more permanent explanatory boxes.

### R03 — P1: independent offline work can overwrite other work at sync

**Confirmed with the real merge function.** Local Read statistics for あ and a local Word Bank entry for みず were merged with a newer remote section containing い and ねこ. The result contained only the remote statistics and remote word. The local additions disappeared.

Progress totals and Kanji evidence have convergent merge logic, but Kana statistics/times, Word Bank and older result sections still use whole-section timestamp selection. Consequently, XP can retain evidence while detailed Kana history loses it.

There is also a structural cross-device race: `performSyncOnce` reads the account document, merges locally and then uses `setDoc` to replace complete sections. Its promise serializes work within one browser, not across two devices. Concurrent clients can both read the same revision and overwrite one another's merged result. This race is identified from the read/write design; the offline section-loss reproduction above is the executed case.

Source: `cloud-sync.js:758` (`mergeCloudIntoLocal`), `cloud-sync.js:1215` (`writeAccountDocument`), `cloud-sync.js:1656` (`performSyncOnce`); `assets/app/mode-atlas-kanji-state.js` provides an existing example of mergeable evidence.

**Fix:** define a merge contract for each section. Use per-device monotonic counters or idempotent answer receipts for Kana evidence; item IDs, edit versions and deletion tombstones for Word Bank; result-ID union for history. Commit against a checked server revision/transaction or through a server merge operation. Preserve explicit reset/import as separate, intentional operations with a generation marker so old offline devices cannot resurrect deleted data.

**Acceptance:** two offline devices add different words and practise different/same kana; sync in either order and concurrently; both contributions survive exactly once. Test edit/delete conflicts, account changes, clock skew, retry, reset and old-client resumption. Do not use naive summation of whole historical snapshots.

### R04 — P1: the earliest Kana reviews are excluded from due study

**Confirmed.** A first unassisted correct answer creates level 1 with a ten-minute due time. A wrong answer creates level 0 with a one-minute due time. `ModeAtlasReview.due()` requires level 2 or higher, so neither appears as due even the next day.

This affects Atlas, Progress and Kana recommendations, which consume that function. In-session retries and ordinary random practice can still revisit the item; the defect is that the scheduled return prompts omit it.

Source: `assets/app/mode-atlas-review.js:78` (`answer`) and `:107` (`due`), plus `assets/app/mode-atlas-study-plan.js:88`.

**Fix:** include valid scheduled learning/relearning items in the due queue. Keep any stricter rule for rewarding a mature spaced review separate from which items a learner should see.

**Acceptance:** first success and first failure both become discoverable after their respective due time; unseen items do not; repeated early practice does not fast-forward the schedule; locked/unavailable rows remain filtered appropriately.

### R05 — P1: earned currency trusts client-editable learning totals

**Confirmed source-level trust boundary and local projection result.** Wallets, purchases, prices and exclusive entitlements are server-owned. However, `creditLevels` and `creditTokens` derive rewards from the user's ordinary save, which Firestore allows that same user to write.

A local synthetic save claiming 1,000,000 correct answers projected to level 59, 225 milestone Atlas Coins, 5,130 level Study Tokens and 125,000 answer Study Tokens. This did not contact Firebase or credit a real wallet. It demonstrates that normalization is not verification of earned learning activity; the commerce functions consume this projection to award real entitlements.

Source: `backend/firestore.rules:17`, `backend/functions/projection.cjs:55`, `backend/functions/commerce.cjs:83` (`creditLevels`) and `:93` (`creditTokens`).

**Fix:** separate personal/offline progress from economically trusted earnings. Use a server-owned, idempotent earnings ledger with validated events, bounded awards and a defined offline catch-up policy. Protect genuine historical balances and migrate them deliberately. Do not grant purchase value merely because a mutable account total increased.

Add App Check as another anti-abuse layer after monitoring compatible web/iOS clients, plus sensible write/rate budgets. App Check complements authentication; it does not prove an answer was learned and does not fix this trust boundary by itself [S6].

**Acceptance:** changing personal save counters, XP adjustments, dates or completion markers cannot manufacture spendable currency; legitimate retries and offline catch-up pay once; old balances and purchases remain valid. Include negative tests through the actual Firestore rules and callable service, not only direct denial of wallet writes.

### R06 — P1 capacity work: one growing account document and duplicated result history

**Confirmed structure; future capacity failure, not a measured production outage.** All account sections share one Firestore document. Reading results are still persisted to four aliases; writing results to two. Kana history is appended without a retention/archive bound. Word Bank is also unbounded. General metrics snapshots parse all these history aliases even when a consumer mainly needs progress counts.

Kanji compression is a good existing mitigation, with a test for five complete device histories. It does not bound the whole account save or fix duplicated Kana results. Firestore's document limit is 1 MiB [S5]. A long-term account will eventually exceed a single-document model unless data is archived or partitioned.

Source: `assets/results/mode-atlas-results-storage.js:37`, `assets/trainer/mode-atlas-trainer-core.js:145`, `cloud-sync.js:129`, `assets/app/mode-atlas-kana-metrics.js:48`, `assets/app/mode-atlas-kanji-codec.js`.

**Fix:** migrate legacy aliases into one canonical result store; keep alias reading in the migration layer only. Separate growing histories and Word Bank items from the small sync/profile summary. Keep lifetime counters separately from retained detailed results. Add payload-size diagnostics and a recoverable sync error before the service limit. Do not silently discard users' histories.

**Acceptance:** realistic multi-year history + all branches + several devices fits the storage design; deleted/archived details do not reduce earned lifetime achievements; the home page does not parse several copies of full test history.

## Important learning and experience changes

### R07 — P2: Kanji early practice continually moves the next review

The executed probe answered 水 correctly, producing a due time at +60 seconds, then answered again at +30 seconds. The new due time became +90 seconds although the spaced-success count stayed at zero. The implementation always assigns `due = now + interval`, even for an early correct response. At longer intervals, frequent voluntary practice can keep postponing the next qualifying spaced success.

Source: `assets/app/mode-atlas-kanji-state.js:119` (`record`). Kana already preserves an existing due time for an early independent success.

**Action:** separate rehearsal from due-review advancement. Keep branch-specific interval parameters if appropriate, but document a common scheduling contract. Early independent practice should not postpone the scheduled opportunity indefinitely. Test due, early, wrong, assisted and multi-device answers.

### R08 — P2: Kanji has broad dictionary coverage but uneven teaching depth

The first ten have bespoke memory cues and a useful Meet → Meaning → Reading sequence. That is a sound start. Beyond those ten, the memory cue is a generic template. All N5/N4 entries have an example field, but many are the isolated character rather than a richer word/context example.

| Study band | Entries | Entries with an example | Example identical to character |
|---|---:|---:|---:|
| N5 | 84 | 84 | 69 |
| N4 | 169 | 169 | 99 |
| N3 | 387 | 387 | 152 |
| N2 | 398 | 392 | 167 |
| N1 | 1,345 | 798 | 199 |

An isolated character can be a perfectly good word, such as 山. These counts are coverage indicators, not error counts. Nevertheless, **553 entries have no example**, and just ten bespoke cues is not the same as 2,383 authored lessons. Some beginner examples warrant editorial review, such as teaching 来 primarily as isolated らい with a suffix-like gloss. Keep the distinction between a kanji's meanings and a word's actual reading explicit.

Source: `assets/app/mode-atlas-kanji-teaching.js:7`, `assets/app/mode-atlas-kanji-content.js:47`, data catalogue.

**Action:** curate N5 first, then N4. Give each introduced item a useful reading in a common word, concise meaning, approved answer aliases, natural audio and one useful memory/shape cue where it helps. Add a short example with kana support; secondary readings stay behind “More”. This improves the current branch without adding grammar/comprehension branches or enlarging every lesson into a dictionary page.

The existing “approximate study bands” wording is appropriate: JLPT does not publish an official exhaustive vocabulary/kanji/grammar list [S3]. Do not claim that this catalogue or its internal “Fluency” label certifies JLPT competence.

### R09 — P2: the beginner/experienced journey is inconsistent between branches

Kana offers beginner entry, adaptive placement and a confident route. Kanji has no equivalent placement/experienced entry: every new save begins at the first ten and N5, regardless of existing knowledge. Its new-user screen also exposes all practice/test tools in disabled form, rather than progressively introducing the relevant next action. The help correctly explains that Meaning Match does not earn independent completion, but this is easy to miss during a long run of successful matching.

Source: `assets/app/mode-atlas-kana-placement.js`; `assets/pages/mode-atlas-kanji-page.js:22`; `assets/app/mode-atlas-kanji-state.js:91`.

**Action:** add an honest Kanji starting-point path. Beginner gets Learn, a short practice set and a visible next step. Experienced learners get adaptive sampling and a clear advanced-entry option. Placement opens access, not invented XP/mastery. Explain the next unmet reading/meaning requirement in the contextual progress view. Keep the requirement to complete a band before normally unlocking the next; give short milestones within that band so N3 is not one 387-item wall.

For Kana, improve placement resilience: it currently samples two items per row and ends that direction at the first mistake. A short confirmation probe for a likely typo or uncertain row would avoid gross under-placement. This is a product recommendation, not a claim that the existing algorithm is broken.

### R10 — P2: the tour and “Continue learning” still belong mostly to Kana

The global tour's seven steps enter `/reading/` repeatedly and omit a proper Kanji/Word Bank introduction. Settings exposes one Quick tour. Separate replayable branch tours requested earlier are not implemented by this tour owner.

The home recommendation considers only Kana settings, evidence and Read/Recall history. Kanji due links exist, but the primary Continue learning action cannot resume a Kanji lesson. Kanji sessions also do not use the existing last-activity recorder. A hub should recognise the branch a person actually studies.

Source: `assets/app/mode-atlas-tour.js:10`, `assets/ui/mode-atlas-settings-menu.js:24`, `assets/pages/mode-atlas-home-page.js:13`, `assets/app/mode-atlas-study-plan.js:66`, `assets/app/mode-atlas-visit-flows.js:47`.

**Action:** one branch registry supplies destinations, resumable activity, review summaries and tour definitions. Keep one tour renderer with a short hub tour and independently replayable branch tours. A learner's paused session should usually outrank an unrelated generic recommendation. Use contextual help rather than adding explanatory text strips to each screen.

### R11 — P2: Word Bank needs a proper word model and an optional recall loop

Word Bank is useful for collecting, editing, filtering, sorting and annotating words. It has good DOM-text handling and tests for malicious-looking input and stale-account confirmations. It remains a collection tool, with no scheduled retrieval/practice loop.

The model conflates written form with kana reading. In both browser configurations, entering 日本 stored `kana: 日本` and `romaji: 日本`; there is no separate editable reading such as にほん. This becomes more limiting as users learn Kanji. The page also owns a separate hard-coded kana transliterator, which has already diverged from Kanji's conversion behavior.

Source: `assets/pages/mode-atlas-wordbank-page.js` (`buildEntry`, `kanaToRomaji`, `makeEntryCard` and add/edit flows).

**Action:** represent written form, reading, meaning, example/context and notes separately; migrate existing kana-only records without inventing readings. Add “Save this word” from Kanji lessons and a lightweight optional review of chosen/saved words. Self-marked meaning recall is preferable to pretending arbitrary user notes have a reliable automatically generated answer key. Keep collection freely accessible; do not impose Kana-style progression gates on it.

### R12 — P2: mastery should distinguish knowledge, fluency and earned recognition

The unified Kana map and optional Mastered+ handwriting are good foundations. However, Mastered still requires lifetime accuracy of 95% and average response time at or below one second, alongside independent recall and spacing. Ten early wrong answers require 190 correct answers just to bring lifetime accuracy to 95%. Input method, response length and motor speed affect the timing measure.

This does not justify replacing the policy with an arbitrary easier score. **Recommendation:** use recent independent, delayed recall for current knowledge; keep lifetime accuracy as a historical statistic; treat speed as fluency evidence or a separate challenge. Preserve earned mastery badges and show “review due” separately. The user should not lose an accomplishment because they tried a weaker direction or returned after a break. Kanji and Kana should use comparable explanations even where thresholds differ.

Source: `assets/app/mode-atlas-review.js:9`, `assets/app/mode-atlas-kana-learning.js` (`earned`, `stage`, `guidance`), `assets/app/mode-atlas-kanji-state.js:76`.

Kanji's detail view still requires reading a paragraph of criteria; use the same met/missing requirement presentation as Kana, without making the panel longer. Do not present tracing guidance as proof of unrestricted handwriting ability.

### R13 — P2 performance guard: social query cost still grows unnecessarily

The recent first-page cache, coalesced reads and removal of ordinary full-save reads are meaningful improvements. Keep them.

Remaining costs:

- Friends reads all friend account documents before slicing a 20-row page; the configured cap is 100 friends.
- A global ladder page can run a separate count aggregation for every distinct displayed score: up to 40 count queries, plus entry/profile/block reads.
- A projection-version migration can refresh many friends synchronously before returning the list.

Source: `backend/functions/social.cjs:233`, `backend/functions/weekly.cjs:102`.

**Action:** use bounded list materialization/pagination and a rank strategy that avoids a count per visible row while preserving ties and privacy filtering. Move bulk projection migrations off the request's critical path. Add read/query-count assertions and production latency measurements with privacy-safe telemetry.

The local guest route timings were desktop median 455 ms (404–685 ms), simulated iPhone median 260 ms (210–1,782 ms, including first launch). These are single local observations, not production benchmarks or a promise about the user's device. Agree a repeatable warm-navigation and Friends latency budget, then compare every release under the same populated-account/network conditions.

### R14 — P2 integrity/hardening: weekly rewards need an explicit anti-abuse policy

The weekly service validates answer content, sequence, timing bounds and a daily score cap; awards are idempotent and server-owned. However, the client selects/reports prompts whose answer keys ship in public code. These checks cannot establish that a human actually recalled the answer. This matters now that first place awards Atlas Coins.

Source: `backend/functions/weekly.cjs` (`begin`, `scoreAnswers`, `submit`, `settle`), `backend/functions/index.cjs`, `assets/app/mode-atlas-weekly-rules.js`.

**Action:** before broadly promoting coin competition, define realistic earnings limits, suspicious-pattern review and eligibility/settlement controls; consider server-issued challenge sequences where appropriate. Preserve normal offline personal learning. Do not claim App Check or obscuring the JavaScript makes cheating impossible. Actual real-money coin purchasing remains intentionally disabled in this release and is a separate future StoreKit/payment-verification project.

## Code quality and ownership assessment

This is not uniformly messy code. There are several sound boundaries worth preserving:

| Area | Existing strength | Specific cleanup |
|---|---|---|
| Learning policy | Separate Kana curriculum/review/placement and Kanji content/state/session owners; server packages shared policy | One Japanese conversion/accepted-answer policy; one documented scheduling contract |
| Save recovery | Local write-ahead transaction and account-bound checkpoints | Convergent section schemas and a cross-device commit boundary |
| Authentication | One setup owner; restored vs signed-out states; account epoch checks; sign-out clears the previous account's device data | Keep these protections while extracting the large coordinator; never reintroduce a second auth owner |
| Commerce | Server transactions, receipts, server prices, entitlement checks, exclusive-audience checks | Move economic earning authority out of the user-editable save |
| UI | Shared account shell, dialog/portrait/theme owners; separated feature styles | Shared branch metadata and reusable feedback/requirements views; remove old vocabulary from active UI |
| Native | Shared web learning code with native adapters; router and widget models have tests | Physical-device acceptance for audio, IME, accessibility, auth and offline transitions |
| Distribution | Public-file allowlist, revision checks, backend shared-policy packaging and native bundle validation | Keep generated artifacts generated; do not edit both canonical and revisioned files by hand |

The biggest maintenance concentrations are `cloud-sync.js` (2,129 lines / about 91 KB), `mode-atlas-progress.js` (about 48 KB), social UI (about 45 KB), the Read/Recall controllers and the 737-line Word Bank page. Size alone is not a defect. The issue is responsibility: cloud sync also owns SDK loading, auth UI, import/export, legacy schemas, deletion and reset; Word Bank mixes conversion, model, persistence and rendering; Read/Recall still contain direction-specific answer pipelines despite shared session/controller helpers.

Refactor around those responsibilities, in small behavior-preserving changes:

1. Extract pure save codecs/migrations and per-section merge policies from cloud sync; keep one account coordinator and one transport.
2. Consolidate input conversion and grading before adding new aliases or learning branches.
3. Move Word Bank model/storage out of its page controller.
4. Consolidate remaining shared answer/feedback lifecycle behavior while keeping genuinely different Read and Recall inputs as adapters.
5. Remove legacy result aliases from active writes after a tested migration. Keep compatibility at import boundaries.
6. Format handwritten source consistently and add linting for accidental globals, unused code and unsafe patterns. Add JSDoc/schema contracts where global `window.ModeAtlas*` dependencies cross modules. A framework rewrite is not required to accomplish this.

The CSS inventory contains 33 canonical stylesheets and only 16 `!important` declarations. It would be misleading to diagnose the whole app as override-heavy based on its history. Feature owners and tokens exist; keep targeted cascade checks rather than another blanket stylesheet redesign. The native font stylesheet is large because it is generated font data, not because it needs hand-refactoring.

The static audit relies partly on source markers and exact text. Those guards are useful for known ownership regressions but cannot establish semantic correctness. Existing tests accept canonical Kanji answer keys without round-tripping every displayed romanization, and merge tests strongly cover single-client/account-switch races without covering all independent offline section conflicts. **Improve what tests assert, not just their count.**

## Japanese-learning judgment and research

**Kana: the strongest branch, close to a good foundation.** The small starting set, Read/Recall/both choices, optional handwriting, row progression and accessible practice paces serve beginners and returning learners. Fix the missing early reviews and revisit the mastery policy. Add focused listening/visual discrimination within Kana (for example シ/ツ, ソ/ン, small っ and long-vowel contrasts) where it improves transfer beyond typing isolated romaji. Do not expand this into another large mode menu.

**Kanji: promising structure, not yet equally strong teaching.** The fixed first ten, audio, reading/meaning separation, guided checks and optional stroke practice are sound. Grading correctness comes first. Then invest in authored beginner content, useful word context, better starting-point handling, explicit recall goals and scheduling. Broad catalogue size should not substitute for lesson quality.

**Word Bank: useful personal collection, incomplete as a repetition tool.** Respect its original role as the side-step for words encountered in real life. Separate reading from written form and add an optional recall loop and branch links. It should become the place knowledge is used and revisited, not another compulsory curriculum.

Research supports these directions, with limits:

- Kim and Webb's meta-analysis covers 48 experiments / 3,411 participants and finds a medium-to-large benefit from spaced second-language practice. It supports reliable delayed reviews; it does **not** validate Mode Atlas's exact intervals or one-second mastery cutoff [S1].
- Rice and Tokowicz's review supports combining retrieval and spacing with stronger form/meaning connections and elaboration. That informs a Word Bank recall loop and contextual Kanji examples; it does not prove a particular new UI will improve retention [S2].
- The Japan Foundation's Irodori materials emphasise practical use, audio and context, and allow optional handwriting practice for kanji. This fits the existing optional Mastered+ approach and useful-word-first Kanji teaching [S4].
- WaniKani's own documentation demonstrates deliberate meaning/reading separation, concise mnemonics and additional readings learned through vocabulary. Tofugu demonstrates row-sized Kana teaching followed by recall. These are product references, not controlled evidence that copying their layouts would work better [S7, S8].

My proposed product direction is therefore **learn a small amount → retrieve it → revisit it later → use it in a word/context → see what improved**. The current branches can support that without adding new branches before 3.0.0.

## The wider app experience

| Surface | Keep | Next action |
|---|---|---|
| Atlas / Learn | Clear branch identity, avatar, personal activity | Branch-aware continuation and a manageable next study task |
| Progress / goals | Rotating pools, repeatable personal goals, contextual actions | Use the repaired review queue; keep targets achievable for currently available content |
| Mastery / achievements | Distinct earned achievements; true mastered percentages rather than treating “Confident” as mastered | Separate current review need from earned recognition; consistent requirement explanations across branches |
| Friends / rankings | Privacy gates, friend requests, reporting/blocking, cached profiles | Query budgets, trustworthy competition rewards, populated-account regression tests |
| Profile / settings | One account surface; avatar/pet editing; save-state explanation | Account-wide summaries should include Kanji; replayable hub/branch tutorials in one place |
| Shop / rewards | Browse/buy in Shop, equip in Rewards; server entitlements; previews stay within shop UI | Preserve collection ownership after rotation; fix earning authority before more monetisation |
| Notifications / widgets | Opt-in preferences, quiet hours, shared streak/goal evidence, account cleanup | Device verification of stale snapshots, timezone changes and sign-out cleanup |
| Accessibility | Existing focus handling, labels, theme and large-text checks | Real VoiceOver, text enlargement, reduced motion, keyboard/IME and touch-target passes [S9] |

Do not spend this phase adding more currencies, cosmetics, menus or new learning branches. The useful additions are small and connected: correct answer feedback, a reliable review queue, Save to Word Bank, branch-aware continuation and replayable tutorials.

## Security boundaries to retain

Public JavaScript, answer keys, Firebase client configuration and shipped cosmetic artwork can be inspected on web and in an extracted app bundle. This is normal client distribution. Hiding a menu or renaming a file is not authorization. The public packaging allowlist excludes backend/admin source, general notes, arbitrary JSON and source maps; privileged data/actions still require server authorization.

The reviewed rules deny direct social/commerce collection access. Server services check identity, relationships, entitlements and moderation permissions. Private account saves are owner-scoped. Sign-out removes the previous signed-in account's device data and switches to guest state; remaining signed in while offline is a different supported case. Preserve those distinctions.

Outstanding hardening includes the economic evidence issue, App Check rollout, bounded raw-save writes, and the fact that the progress-version update guard does not protect a delete-and-recreate of an owned save. Treat resets as explicit generation changes, not as a route around schema compatibility. No private-account disclosure was reproduced in this audit.

## Work order and exit criteria

| Stage | Work | Done when |
|---|---|---|
| 1. Correctness | R01–R05 and the R07 scheduling inconsistency | Reproductions fail before the fix and pass after it; normal study/offline use remains intact |
| 2. Durable data | R06 and the structural parts of R03 | Multi-device, reset and large-account fixtures survive; histories have an archive/migration policy |
| 3. Learning quality | N5 content/aliases; R09–R12; Word Bank model and a small recall loop | Beginner can learn, practise and return without guidance; experienced learner reaches useful material quickly |
| 4. Release hardening | R13–R14; device/a11y checks; migration rehearsal | Stable populated-account performance, fair reward boundaries, clean web/iOS builds and reviewed migration evidence |

Do not bulk-reformat or rewrite the whole app in the same release as a save migration. Land focused changes with one owner and clear regression evidence. Update Firebase schema/rules/functions before releasing clients that depend on them; keep old-client compatibility or a deliberate upgrade path. Cosmetic/client-only changes do not require a backend deployment just because a release exists.

Use fast unit/content checks during implementation, focused browser checks for affected journeys, then one complete release gate on the final candidate. Preserve Firebase integration and native archive gates. Parallel CI already reduces wall time; avoid repeating every job after a documentation-only review or a change that has no native effect unless the required release gate calls for it.

Before naming the release 3.0.0, require:

- Correct answers are accepted consistently in all input forms; learning and test feedback agree.
- New/failed items return at the intended time; early practice cannot indefinitely postpone reviews.
- Two devices cannot silently lose independently created learning data or words.
- Personal save edits cannot mint spendable currency; reward retries are idempotent.
- A realistic long-term account remains syncable and responsive.
- Both beginner and experienced journeys are coherent across the available branches.
- Actual iPhone/iPad checks cover Google/Apple sign-in and linking, offline study/reconnect, sign-out/share-device behavior, IME, normal/slow audio, accessibility, widgets and notifications.

## Research sources

These sources were consulted on 21 October 2026. Scientific conclusions above use the available article abstracts/review summaries; no claim is made to have reproduced the underlying experiments. Product documentation informs design comparisons, not causal learning claims.

- **S1:** Kim, S. K. & Webb, S. (2022), *The Effects of Spaced Practice on Second Language Learning: A Meta-Analysis*, Language Learning 72, 269–319. [DOI / publisher](https://onlinelibrary.wiley.com/doi/abs/10.1111/lang.12479).
- **S2:** Rice, C. A. & Tokowicz, N. (2020; online 2019), *A Review of Laboratory Studies of Adult Second Language Vocabulary Training*, Studies in Second Language Acquisition 42, 439–470. [Publisher](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/abs/review-of-laboratory-studies-of-adult-second-language-vocabulary-training/18F0A5D1FFC829CE05931B2EEE83124A).
- **S3:** JLPT, official FAQ on test content specifications and the purpose of assessment. [Official FAQ](https://www.jlpt.jp/e/faq/).
- **S4:** The Japan Foundation, *Irodori: Elementary 1 — How to Use This Textbook*. [Official guide](https://www.irodori.jpf.go.jp/assets/data/elementary01/pdf/Y_howto_en.pdf).
- **S5:** Firebase, Firestore quotas: document size and related limits. [Official documentation](https://firebase.google.com/docs/firestore/quotas).
- **S6:** Firebase, App Check and its relationship to Firebase Authentication. [Official documentation](https://firebase.google.com/docs/app-check).
- **S7:** WaniKani, lesson progression, readings and meaning. [Unlocking Kanji](https://knowledge.wanikani.com/getting-started/unlocking-kanji/) and [reading versus meaning](https://knowledge.wanikani.com/wanikani/japanese/readings-vs-meanings/).
- **S8:** Tofugu, *Learn Hiragana*. [Publisher's guide](https://www.tofugu.com/japanese/learn-hiragana/).
- **S9:** Apple, Human Interface Guidelines: Accessibility. [Official guidelines](https://developer.apple.com/design/human-interface-guidelines/accessibility).

## Reproduction evidence

`probes.cjs` contains local policy checks using in-memory fixtures for the review scheduler, Kanji dataset/input, early Kanji scheduling and currency projection. `sync-probe.cjs` invokes the actual cloud merge function with in-memory storage. They do not contact Firebase. Run from the repository root with Node:

```sh
node docs/reviews/3.0.0/probes.cjs
node docs/reviews/3.0.0/sync-probe.cjs
```

`browser-findings.json` records the additional local route/panel observations and the two UI reproductions. Guest fixtures and local timing are intentionally distinguished from production checks. No application version, Firebase deployment, user balance, Xcode signing setting or production data was changed for this review.
