# Reading and Writing review — 2.72.0

This release builds on the guided sets in 2.71.0. The shared website and iOS trainers use the same mode selection, answer evaluation, scoring, storage and summaries. The iOS dock and setup sheet geometry remain native presentation concerns.

## Session behaviour

| Session | Feedback | Finish and records |
| --- | --- | --- |
| Guided set | Explicit Incorrect or Skipped panel; Continue after a mistake | 10, 20 or 30 answers; summary and focused follow-up |
| Free practice | Same teaching panel, without a question target | Stop whenever ready; answers retained |
| Endless | Brief, labelled answer feedback keeps the rhythm | Shared summary; best total/correct record retained |
| Speed Run | Brief feedback, continuous clock | Full 60 seconds required for the leaderboard |
| Time Trial | Brief feedback, continuous clock | User time limit and target; completed timer required for records |
| Daily Challenge | Brief feedback | All 20 answers required; first completed score stays official; replay increments attempts |
| Test Mode | Brief feedback | Full shuffled sequence required for a formal result; summary links to Results |

Every session summary includes answered/correct/accuracy, XP, expandable timing/streak details and a guided follow-up for missed kana. Follow-ups can include missed kana from a full Test or Daily Challenge even if those kana are outside the user's regular row selection. They do not overwrite those row selections.

Combo Kana, hints, Smart repetition (the existing SRS selection), Focus Weak and Confusable Kana remain learning options. They do not become competing session types. Fixed Daily/Test pools disable irrelevant controls; choosing a new session resolves incompatible flags. Existing per-mode settings remain readable; no save migration or new backend is required.

## Confirmed problems fixed

- Incorrect guided feedback inherited a green Reading accent and used a vague heading. Feedback now says **Incorrect** with a cross and semantic danger colours; kana examples are neutral. Skips have a distinct neutral label. Continue describes the result and answer to assistive technology.
- Writing could store incomplete Daily/Test runs as completed when End session was tapped. Both directions now share one finalizer with completion checks. Stopping retains individual answers without a completed record or completion XP.
- Separate Reading/Writing/Daily/Test result surfaces duplicated presentation and natural-break behaviour. All now use the existing shared dialog framework and one session summary renderer.
- Timed runs could enter records after early stopping. Leaderboards now require an expired timer and at least one answer. Late answers after a deadline are rejected. Pause preserves the remaining clock.
- Test button metadata could report the user's ordinary choice count while presenting six buttons. Saved test metadata now reflects the forced six-choice layout.
- Reading and Writing split joined kana such as きゃ into Unicode characters for reading, statistics, XP and choice generation. Canonical longest-match kana units now drive these operations. Existing recorded history is not rewritten.
- Joined kana could be mistaken for multi-question combinations in Writing choices. A joined kana is one unit. Same-row Combo selection now uses one canonical row resolver for base, voiced, joined and extended kana in both directions. Distractor generation for genuine combinations is bounded, including a one-item pool.
- Time Trial numeric values are bounded, saved with the mode's settings and locked during practice. Configuration controls disappear during an active session.
- A synchronous UI refresh could reload settings into a running session. The controller now preserves the active session; existing cloud deferral remains the sync owner.
- Daily runs crossing a date boundary keep the date/sequence they started with.
- Practice Setup mixed exclusive modes with modifiers and inherited competing button/drawer geometry. It now has seven described session cards, grouped options and a real modal dialog. The old drawer-specific style rules were removed. The component stylesheet loads after shared button primitives.

## Ownership

| Responsibility | Source owner |
| --- | --- |
| Mode catalogue, transitions, compatibility, time limits | `assets/trainer/mode-atlas-practice-modes.js` |
| Existing settings mutation and persistence | `assets/trainer/mode-atlas-trainer-controls.js` |
| Setup control rendering | `assets/trainer/mode-atlas-modifier-menu.js` |
| Setup opening/closing, focus and modal lifecycle | `assets/trainer/mode-atlas-practice-setup.js` |
| Shared setup surface and controls | `assets/css/mode-atlas-modifier-menu.css` |
| iOS bottom sheet and safe-area geometry | `assets/css/mode-atlas-ios-chrome.css` |
| Kana unit boundaries | `assets/data/mode-atlas-kana-data.js` |
| Prompt evaluation and Writing choices | Existing Reading/Writing page controllers |
| Pause, deadline guard, feedback scheduling | `assets/trainer/mode-atlas-session-controls.js` |
| Session finish, scoring hooks and completion guard | `assets/trainer/mode-atlas-trainer-shared.js` |
| Progress, correction panel, summary and focused follow-up | `assets/trainer/mode-atlas-study-session.js` |
| Formal result format and speed-score calculation | `assets/trainer/mode-atlas-trainer-core.js` |
| Trainer markup and asset registration | `frontend_components.py` |

No runtime wrapper replaces another controller. No generated HTML, revisioned assets or native web payload is edited by hand. Profile, settings, accounts, widgets and the website palette retain their established owners. The new Practice Setup and learning behaviour intentionally apply to both platforms; the bottom-sheet shape, handle and safe areas apply only to iOS.

## Validation

Regression coverage exercises mode transitions, completion vs stopping, official Daily replay, full formal tests, correct button metadata, deadline/pause behaviour, joined kana, bounded choices, Focus Weak, hints, confusable selection, Combo feedback, review outside selected rows, feedback focus, light/dark themes and larger text. Existing browser, native-shell and source-clean release gates remain required.

Browser tests simulate the Capacitor runtime, not real iPhone performance or VoiceOver. The native release gate compiles the app/widgets for the iPhone/iPad simulator. Device acceptance should check setup opening/closing, the custom keyboard, timing and the new feedback in both orientations.

Design references: [Apple sheets](https://developer.apple.com/design/human-interface-guidelines/sheets), [Apple feedback](https://developer.apple.com/design/human-interface-guidelines/feedback), [Apple accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), and [HTML dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog). The shared modal uses platform focus containment and Escape cancellation, a visible Done control, backdrop dismissal, reduced motion, and an iOS handle swipe that does not intercept content scrolling.

The first-use tutorial remains deferred until these learning flows settle. Longer-term spaced review and Word Bank study remain separate work.
