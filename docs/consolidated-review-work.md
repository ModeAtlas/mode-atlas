# Consolidated PDF work and GitHub publication

The release scope is the entire 22 October independent review, with the user's exception retaining coin-purchase placeholders. Home remains the whole-app personal hub, Learn the branch directory, and Kana the Kana-only course. First-use changes must reduce what is presented rather than add explanatory paragraphs. The PDF is **not signed off as fully complete**.

This continues the existing local 3.0.2 work. No new version was declared and no further partial release was published. The complete requirement ledger is `docs/reviews/3.0.2/pdf-status.md`; earlier 3.0.0/3.0.1 completion claims remain superseded by that ledger.

## Implemented in this continuation

- Word-lesson deep links complete first-use setup before opening the requested lesson, avoiding stacked setup/lesson dialogs.
- Scheduled contextual recall across all six practical units: twelve later situations, next-day/weekly spacing, short retries after mistakes or hints, early-practice protection, personal habit credit and Home/Word Bank entry points. Checkpoints and schedules merge independently and travel through backup/sync.
- A pure shared save schema and a privacy-limited learning event contract. Save observers run after the outer durable transaction; a failed write cannot announce an advanced lesson state.
- Kanji answer recording retains a private normalized snapshot and copies only changed evidence. Public readers receive detached copies; imports, rollback and account changes invalidate the snapshot correctly. Reordered bounded maps no longer require duplicating an entire large save in the recovery journal.
- Legacy Friends/Progress links route before Account is opened. Intermediate redirect documents do not opt into native page-transition animations.
- Native Read/Recall phone and tablet gutters consume the same independent safe-area values as other pages. Coin buttons remain present.
- An all-entry structural teaching gate, band-by-band authored coverage and a specific educator/audio/retention acceptance standard. These checks do not certify content quality.

## Verification

The final evidence is recorded in `docs/reviews/3.0.2/consolidated-evidence.json`. Source checks: 280 JavaScript and 20 Python tests pass. Auth/Firestore/rules/service emulators: 86 pass. Native web packaging and Capacitor sync pass. No Xcode compile or physical-device result is claimed.

The broad browser invocation ran all 768 cases: 750 passed and 18 failed. It identified the legacy-link and phone safe-area defects plus obsolete Account-loading/help-copy expectations. The corrected journeys and affected learning/storage paths are rerun on the final source; the evidence file lists each run separately rather than presenting several runs as one clean invocation. Across these runs, 770 distinct cases have a passing latest result; 0 remain unresolved.

`measure_kanji_answer.cjs` measures actual session answer calls for a mature save covering all 2,383 characters, two skills and three device sources. Twenty answers are recorded; the first four are discarded for timing. Local Chromium median/p95 improved from 149.35/183.8 ms to 53.5/75.0 ms. Both runs persisted 20 answers with no pending journal. This excludes DOM rendering and is not an iPhone result. The 50 ms p95 engineering goal remains unmet.

## Acceptance still outstanding

The original PDF requires independent Japanese educator approval, reviewed audio, uncoached learner observation and one-day/seven-day retention/transfer evidence. Those have not happened. The authored Kanji coverage remains uneven; the exact counts are in `content/teaching-coverage.json`.

Production Firebase access is unavailable here. App Check still has an empty web site key and iOS enablement is false. Live IAM/provider settings, quotas, cost alerts, retention/deletion execution and staged attestation therefore remain unverified. Full Functions/Eventarc behavior, real two-device offline/concurrent recovery and physical iPhone/Duo/VoiceOver/widget/push acceptance also remain open. Browser emulation and source tests do not close these requirements.

## GitHub state and publication block

Repository: `ModeAtlas/mode-atlas`. The connected account has push permission. `main` remains at `6d3f4988d67f4e8697a5bca890797ddac68741dc` (2.121.0); the development branch remains at `a1c0c238600fc3d68307c9358dfcd8fad327f9e1`.

Direct Git push has no login credentials in this workspace. The connected GitHub API could upload objects, but automatic approval review rejected the screenshot upload as bypassing a previously rejected public push. Six unreferenced screenshot blobs were created before that rejection. No tree, commit or branch reference was published, and no deployment was triggered. Publication was not retried through another mechanism after rejection.

The approval request must explicitly cover publishing the accumulated source changes, generated runtime assets, tests, development/review documents and review screenshots to the public repository's `agent/mode-atlas-2.68.0-ios-theme` branch. Publishing that development branch runs CI; GitHub Pages deploys only when the changes reach `main`. The user's previous reservation of `main`/production control remains in force.

## Publication authorization — 23 October 2026

The user explicitly approved publishing the accumulated code, generated assets, tests, review documents and screenshots to the public `ModeAtlas/mode-atlas` repository on `agent/mode-atlas-2.68.0-ios-theme`. The rejection and remote-state descriptions above record the state before this authorization. Publication is being resumed through the connected GitHub integration; successful publication must be verified against the committed source tree. Main/production remains under the user’s control.
