# 3.2.0 learning redesign: independent acceptance

27 October 2026. Contract: [approved diagnosis and replacement design](../learning-redesign-2026-10-27.md). This record separates implementation checks from educational effectiveness. Release-wide command results belong in the release handover; this document covers the independent learner/UI review.

## Required observable outcomes

| Requirement | Falsifiable check | Evidence owner |
| --- | --- | --- |
| A new learner can follow the course without choosing modes | Begin with no exposed characters or scores; complete both A-row teaching chunks and the independent row check; the next primary action teaches か. No answer-handler calls or completion mutations. | `tests/learning-redesign.spec.js`, `tests/kana-depth.spec.js` |
| Listening assesses audio rather than remembered screen position | Before playback, no answer-bearing glyph, reading or accessible label appears; choices cannot be submitted before audio; the spoken target differs from the preceding answer; silent study creates no listening receipt. | `tests/kana-depth.spec.js`, `tests/personal-words.spec.js` |
| Corrections do not rewrite first attempts | A miss remains recorded after correction; retry follows intervening items; an assisted/immediate correction cannot pass an independent checkpoint. | Kana, Kanji and vocabulary model/browser suites |
| Completion is separate from retention | Immediate lesson and checkpoint completion do not claim delayed mastery; a later-day review has distinct evidence. | `tests/kanji.test.js`, `tests/kanji.spec.js`, vocabulary and Kana model suites |
| The path is a destination, not nested modal navigation | Opening the path and a unit preserves the document; only one course view exists; explicit and browser Back preserve the selected script. | `tests/learning-redesign.spec.js`, `tests/kanji.spec.js` |
| Words has two clear destinations | Exactly Learn words and Word Bank appear on its hub. Course has no Add word, search, bank settings or phrase list. Returning by Back restores the correct destination. | `tests/learning-redesign.spec.js`, `tests/vocabulary.spec.js` |
| Personal entries have an answerable teaching flow | Incomplete fields lead to editing; freeform meanings use explicit reveal/self-assessment; reading, meaning and listening schedules remain separate. | `tests/personal-words.test.js`, `tests/personal-words.spec.js`, `tests/security-logic.spec.js` |
| Existing content and permissions survive | Normalisation, duplicate checks, edit persistence, filters/sorts, script-injection protection, account-switch clearing, widget updates and existing phrase links continue working through the real new destinations. | Cross-branch regression specs listed below |
| Constrained screens keep useful actions visible | At 432×640 and 960×440, light/dark, 1×/1.5× text: primary actions and exit header are initially fully visible, inside safe bounds and actually hit-testable above the dock; glyphs do not overlap labels; no horizontal or control-text overflow. Internal teaching-body scroll is allowed. | `tests/learning-redesign.spec.js` |
| Typed answers survive reduced usable space | Enter a real Kana/Words typed task; shrink 960×440 to 960×300 and restore it. Input text, prompt and task position persist; input and primary action stay reachable without hiding the course header. | `tests/learning-redesign.spec.js` |
| Selected and hovered controls remain readable | Computed foreground/background contrast is at least 4.5:1 for the course Continue button and selected Kana/Kana + Kanji preferences, including hover. | `tests/learning-redesign.spec.js` |

## Independent method

The independent browser fixture seeds only dismissed legal/onboarding chrome, theme and sound preferences. It does not seed practice selections, introduced characters, learning receipts, completion or mastery. The A-row journey reads visible teaching prompts and uses the instrumented playback target when answering listening; it clicks the same controls as a learner. Read-only saved-state inspection verifies the resulting row check. Branch model tests may use constructed state to exercise merges and edge conditions; those are not presented as evidence of a completed human journey.

The native bridge is simulated. Reported dimensions are stress-case usable windows, not asserted hardware specifications. Native safe regions and dock occlusion are checked in rendered pages. The keyboard-sized resize cases reduce the browser viewport; they do not claim a real software keyboard or UIKit event sequence was exercised. Full visibility is checked before Playwright can scroll the control into view. Hit tests sample the centre and edge midpoints, avoiding rounded-card corners that are correctly outside the clickable shape. Content clipped by its own scroll container is distinguished from overlapping fixed actions.

Computed colour checks support the solid-colour button states covered here; they are not a universal accessibility certification. Screenshots are inspected as well as geometry, because geometric control tests alone miss overflowing text ink and poorly allocated vertical space.

## Defects found during independent review

- Initial 432×640 Kanji teaching put Continue completely below the screen, including ordinary text size. At 1.5× text, Kana teaching also lost its primary action in both constrained windows. The shared course now reserves header/action space and gives teaching content its own scroll area.
- The first revised layout still allowed large Kanji glyph ink to overlap its adjacent meaning label. This was detected in the screenshot, not by button bounds.
- The short/wide Kana screenshot exposed a clipped header after task entry. Header visibility is now part of the test contract, alongside footer visibility.
- Words' second destination was partially hidden by the bottom dock at 432×640 and 1.5× text. The redundant introduction above the two self-explanatory cards was removed to recover space.
- Personal Word Bank listening initially exposed the answer through pronunciation button accessible names. Listening assessment now uses neutral names; teaching retains descriptive pronunciation labels.
- A late full regression exposed an early Profile click lost during warm navigation. Instrumented pointer events showed both account navigation and its feature loader were still undefined while the visible button accepted clicks. Canonical Profile/Settings triggers now remain disabled until the delegated account handler is installed. A held-script regression verifies that the first enabled click opens the account sheet.
- WebKit exposed a shared-dialog focus race: deferred initial focus could steal focus from an already-used Help search field. The shared dialog now preserves focus inside its current panel; a deterministic pre-frame typing regression verifies this.
- Final CI log review exposed a queued Kana overview refresh running after lesson entry and replacing its controls. The canonical callback now rechecks whether it may refresh when the frame executes. A deterministic test failed on the original code with detached task/control nodes and lost focus, and checks those identities as well as saved session position; the existing layout assertion was not weakened.
- Central Settings Help was updated to describe guided first-answer checks, the Kanji invitation, later-day review and the separate Words course/collection. Removed references to the superseded mode dashboard and Kanji Mastery Map.
- Older regression tests still expected removed tabs, a Home branch dashboard, always-open bank filters and modal personal review. Migrations preserve the original functional assertions while navigating the replacement UI explicitly.

The final independent run verified the fixes above. The reviewed large-text screenshots show separated Kanji glyph/meaning, visible course headers and both Words destinations above the dock. Finding and resolving these issues is not evidence that every device or account state has been covered.

## Regression migration scope

`smoke.spec.js`, `ios-experience.spec.js`, `ios-shell.spec.js`, `duo-learning.spec.js`, `duo-space.spec.js`, `duo-practice.spec.js`, `duo-outcomes.spec.js`, `security-logic.spec.js`, `duo-compact.spec.js`, and `account-shop.spec.js` were migrated. Relevant checks still assert saved data, account isolation, input normalisation, native safe areas, existing phrases, real navigation and completion. Full-page course expectations replace obsolete modal/tab geometry only where the approved contract explicitly changed that composition.

The first targeted cross-branch run reported 22 passes and four outdated-interaction failures. After migration, the four cases plus the updated Home→Kana navigation passed (5/5). This combines to 27 distinct passing targeted cases. Later full-regression triage migrated and verified 23 additional cases: 12 compact shop/rail/rotation/Home cases, both compact Kanji library/wallet/About cases, and nine Kana custom-session starts. Shop amounts, coin placeholders, product controls and persistence assertions remain intact. The final release regression must still run the complete relevant suite against the final frozen assets.

## Final independent run

**15/15 passed, zero retries, skips or flaky results**, Chromium desktop project with native geometry simulated; duration 56.4 seconds. Run used the regenerated 3.2.0 assets.

```
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/workspace/browser-runtime/chromium \
MODE_ATLAS_TEST_REPORT=.build/reports/3.2.0-independent.json \
npx playwright test tests/learning-redesign.spec.js \
  --project=desktop-chromium --workers=2 --output=.build/independent-results
```

The report is `.build/reports/3.2.0-independent.json`; full-window screenshots are in `.build/independent-results/`. Screenshots inspected include closed/light/1.5× Kana, Kanji and Words; short/dark/1.5× Kana; and both 960×300 typed-answer states. Larger-text teaching may scroll inside the lesson while its header and actions stay in place. In the reduced viewport, the answer field can be scrolled into the teaching body without moving the task header or answer action.

**Help: 5/5 WebKit cases passed** in 28.5 seconds, including both sizes/appearances and deterministic deferred-focus coverage. Report: `.build/reports/3.2.0-help-webkit.json`. This is browser-engine evidence, not a physical iOS test.

**Early-account interaction: 10/10 executions passed** under three workers: five repetitions of the original large-text landscape shop case and five of the deterministic held-script case. No delays or retrying clicks were added. Report: `.build/reports/3.2.0-shop-race-fixed.json`.

Cross-branch reports: `.build/reports/3.2.0-crossbranch.json`, `3.2.0-crossbranch-retry.json`, `3.2.0-late-migrations.json` and `3.2.0-late-migrations-retry.json`. Initial reports retain the genuine failures or stale selectors for review; the retry reports record the corrected cases. Release-wide and WebKit totals must be reported separately.

Final Kana refresh regression: **30/30 Chromium cases passed**, the new case
passed **5/5 repeated executions**, and **5/5 focused WebKit cases passed**.
Reports are `.build/reports/3.2.0-kana-refresh-regression.json`,
`.build/reports/3.2.0-kana-refresh-repeat.json` and
`.build/reports/3.2.0-final-kana-webkit.json`. The WebKit launch used the existing
unpacked runtime libraries; no browser assertions were skipped. These runs
overlap the release-wide case totals rather than adding 40 unique cases.

## What these checks cannot establish

Automated runs do not establish that novices understand the interface without coaching or that the course improves long-term retention. Instrumented playback verifies requested audio and answer separation, not voice quality, listening comprehension or actual device speech output. The authored curriculum and progression thresholds remain product choices informed by the research in the approved review, rather than experimentally validated prescriptions. Physical-device accessibility, keyboard, speech and longitudinal learning observation remain distinct acceptance work and must not be described as completed by this browser review.
