# Mode Atlas — consolidated work record

Version **3.0.2**, iOS build **2080048**. Prepared 22 October 2026.

This records the accumulated local implementation and validation. The user requires one update covering the whole PDF, except removal of the coin-purchase placeholders. **This is not a completed-release announcement: the full PDF remains open, the live website has not changed, and iPhone Duo has not passed native/device acceptance.** The earlier 3.0.0 completion claim remains withdrawn. No additional version was declared during this continuation.

## What changed

- **A gradual Home:** new, starting, building and established states. One wrong or correct answer no longer exposes the full personal dashboard. Starting learners receive one five-item commitment; experienced learners retain their overview. Home, Learn and Kana keep their separate jobs.
- **Lessons that keep your place:** vocabulary unit, word, phase and application task survive close/reload, cloud merge and learning backups. Home and Word Bank recommend unfinished work and the next unit. All six existing units now include a typed phrase task after recognition, with a new situation, retry feedback and optional pattern support. Completion links to review and relevant Kanji. This adds depth to the existing 30-word sequence; it is not a new full Japanese course.
- **Later contextual recall:** twelve new situations revisit all six units on next-day/weekly schedules. Hints and mistakes cause a short retry, followed by a day before returning to weekly review. Home and Word Bank surface due situations; checkpoint and review schedules merge independently. A first-use lesson link completes setup before opening the lesson.
- **Better Kanji examples:** dictionary spelling/reading/sense restrictions now validate every selected example. Selection prioritizes suitable vocabulary difficulty. Added 45 cues, 53 character comparison entries and 22 original contextual sentences across bands. Eight entries still explicitly teach isolated readings. No independent educator endorsement is implied.
- **Useful results:** remaining Kana Read/Recall labels corrected, including native shortcuts. Immediate and formal results share compact Practised/Revisit/When rows, actual review timing and clear skill/content-band labels. Perfect results no longer identify correct answers as weak.
- **Less common-page work:** Profile, Settings, native Settings, account bindings and Shop UI load when activated. Functional navigation icons share one monochrome system. The existing brand, branch and reward artwork keep distinct roles; the previously corrected shared flame remains.
- **More reliable continuation and measurement:** review completions and in-app lesson departures now emit the consented events; branch counters and cohort denominators have validation and a read-only reporting tool. Large-save commits avoid redundant parsing/serialization while retaining the durable recovery journal and checksum-verified interrupted recovery.
- **Explicit runtime boundaries:** approved learning events carry only a branch and transition; live/import/restore use the same pure save schema. Save observers run only after a durable transaction. Kanji answer recording reuses a private normalized snapshot and changes only touched evidence; imported data, failed transactions and account changes invalidate it. Legacy links route independently of lazy Account loading.
- **Duo preparation:** independent safe areas, continuous usable-width layout, wide-screen right navigation rail, safe Account/dialog/handwriting bounds and preserved input/strokes during resizing. CI selects an installed iOS 27.1+ SDK and fails clearly if unavailable. This requires a native build and device testing before a compatibility claim.

Coin-purchase placeholders remain, as requested. The interface changes do not add explanatory panels to the learning hubs.

## Evidence

| Check | Result |
| --- | --- |
| Source release gate | Build/revision/security/metadata/native-web/content checks and 280 JavaScript tests passed; 20 Python tests passed. The teaching gate validates every entry's structure and dictionary restrictions, not educator approval. |
| Browsers | All 768 existing cases were run; the first run had 18 failures. Corrections and targeted reruns, including two new first-use cases, leave 770 distinct cases with passing latest results and no unresolved failure. This is combined evidence, not one green final invocation. Chromium and simulated native runtime are not Safari/WKWebView execution. |
| Backend service/rules | 86 tests passed with Auth/Firestore emulators and the direct service harness. The full Functions/Eventarc trigger environment was not run successfully here. |
| Native assets | `npm run ios:sync` passed. This packages/synchronizes web assets and plugins; it is not an Xcode compilation. |
| Mature-save answer benchmark | Actual session answer/next calls, all 2,383 Kanji, two skills and three device sources; 20 answers with the first four excluded from timing. Median/p95 improved from 149.35/183.8 ms to 53.5/75.0 ms. No pending journal remained. Local Chromium, excludes DOM rendering; the 50 ms p95 engineering target remains unmet. This is a different probe from the earlier storage-only measurement. |
| Home eager scripts | Same script-tag measurement at 3.0.1 `61cf9a9` versus this source: 92 → 91 scripts, 771,457 → 726,364 raw bytes, 253,895 → 242,274 summed gzip bytes. The new contract modules add some bytes to the earlier lazy-loading result. Not total transfer/startup timing. |
| New-account economy | Zero-wallet account, actual issued guided prompts, ten answers/day with eight correct. After three days/30 answers: 156 Study Tokens, Rose purchased for 120, 36 remain. Server ownership granted and retry did not charge twice. No developer credit or paid coins. |

The full-suite continuation exposed legacy-link routing and native phone trainer-inset defects, plus outdated expectations for lazy Account loading and compact help copy. These were corrected. A first-use deep-link check also exposed stacked setup/lesson dialogs; setup now finishes before the requested lesson opens. The evidence records each invocation and latest distinct-case result rather than counting retries as extra coverage.

Evidence: [final consolidated checks](reviews/3.0.2/consolidated-evidence.json), [continuation and publication record](consolidated-review-work.md), [earlier measurements](reviews/3.0.2/measurements.json), [screenshots](reviews/3.0.2/screens/), [Duo research and launch matrix](reviews/3.0.2/iphone-duo.md), [all 35 PDF requirements](reviews/3.0.2/pdf-status.md), [teaching coverage](../content/teaching-coverage.json), [runtime contracts](runtime-contracts.md).

## What remains open

The PDF status table is the authoritative list. The largest gaps are substantive: independently reviewed teaching/audio and more tailored Kanji curriculum, educator/learner retention and transfer studies, remaining legacy coupling, modest-device save latency, and two-device/physical-native acceptance. Automated content checks and browser tests do not close those requirements.

Production Firebase access was checked read-only and failed authentication. The shipped configuration still has an empty web App Check site key and `iosEnabled:false`; live enforcement, IAM, provider settings, alerts, quotas, retention and deletion behavior were not inspected or changed. Those need the authenticated project/operator environment. No live learner metrics were collected. Human recordings also require reviewed recordings and redistribution rights; the Japan Foundation's downloadable teaching audio was not copied into this app.

The new report is available with authorized server credentials as `node backend/tools/usage-summary.cjs`. It only reads `usageReports` and outputs aggregate unexpired, opted-in guest-installation cohorts. It is not all-user retention, and an empty report is not evidence of successful onboarding. Deploy the matching backend validator before activating the new reporting payload in production.

## GitHub update path and publication state

GitHub is the requested update path. The old bundle instructions are withdrawn: those files do not contain this continuation and cannot update the website.

**Not pushed or deployed.** The public repository is `ModeAtlas/mode-atlas`. At verification, `main` remained at `6d3f4988d67f4e8697a5bca890797ddac68741dc` (2.121.0) and `agent/mode-atlas-2.68.0-ios-theme` at `a1c0c238600fc3d68307c9358dfcd8fad327f9e1`. The connected account has push permission, but CLI Git has no credentials. Automatic approval review rejected a connected-API screenshot upload as bypassing a previously rejected public push. Six unreferenced screenshot blobs were created; no tree, commit or branch reference was published. No alternate publication mechanism was attempted after that rejection.

The pending publication action covers the accumulated source, generated runtime assets, tests, development/review documents and review screenshots on the development branch. The automatic rejection requires explicit approval of that public action before retrying. A development-branch push triggers CI; **GitHub Pages changes only after the user's main-branch merge and successful deployment**. Firebase deployment is separate. The user's prior reservation of main/production control remains in force.

After publication is confirmed, an existing Mac checkout should fetch and fast-forward from that GitHub branch, preserving local signing settings before `npm ci` and `npm run ios:sync`. The native toolchain selector requires an installed iOS 27.1+ SDK. No current pull command is presented as an update while the remote still contains 2.121.0. Physical Duo/VoiceOver/widget/push acceptance remains part of the launch matrix.

## Publication authorization — 23 October 2026

The user explicitly approved publishing the accumulated code, generated assets, tests, review documents and screenshots to the public `ModeAtlas/mode-atlas` repository on `agent/mode-atlas-2.68.0-ios-theme`. The rejection and remote-state descriptions above record the state before this authorization. Publication is being resumed through the connected GitHub integration; successful publication must be verified against the committed source tree. Main/production remains under the user’s control.

## GitHub CI correction — 23 October 2026

The approved accumulated source was published as `b925f313d127466629f153f03fec1d4216b09cfa`; its Git tree exactly matched the local source. In push run `39792120102`, source validation, backend checks, native iOS compilation and two browser shards passed. Browser shard 3 failed one account-retry test; the dependent aggregate gate correctly failed and publication was skipped.

The test assumed an aborted module download could never be retried within the same document. GitHub Chromium made another request and recovered successfully, so its fixed request-count assertion failed. The corrected fixture keeps the SDK offline during manual sync, then brings it online immediately before the explicit retry. It verifies unresolved account state while offline, a fresh document after Try again, a new SDK request and resolved account state afterward. Required checks remain intact. All 14 stability cases pass locally across desktop and mobile Chromium. The correction's GitHub checks must pass before merging PR #64.
