# Mode Atlas 3.0.4 — Duo practice and layout corrections

Prepared 23 October 2026. iOS build **2080050**.

The supplied screenshots showed Start practice below the screen, session actions underneath the keyboard, an oversized empty prompt before starting, a Kanji card overlapping its neighbour, and a cramped side dock. The earlier width-only checks did not catch these vertical and internal-column failures.

## Changes

- Native setup shows the session configuration and Start action without an empty question or disabled answer field. Existing lesson/session logic and saved settings remain shared.
- Running practice uses two columns when the actual content area has room: question on the left, input or choices on the right. Narrow windows stack. Skip, Pause and End stay together above the custom keyboard at the tested Duo proportions.
- Keyboard keys adapt to available height within a 44–60 point height range. Scroll alignment includes the session actions and ignores the side dock when calculating bottom obstruction. Larger text and very short windows retain document scrolling; delayed input alignment cannot reset that scroll when the complete frame cannot fit.
- Daily and Test show their live Correct/Incorrect scores and question progress without repeating the question count, practice streaks or previous official score in extra rows. Scoring and recap records are unchanged.
- Four-kana sequences size from their text length and actual question-column width. Mixed Read + Recall hides the romaji keyboard while choices are active, and those choices use their intended three-column grid.
- The side dock uses 64-point minimum item heights, 12-point labels, larger icons and more spacing. Its group is centred in the available strip below system occlusions. Exit focus has a dedicated stacked layout. The existing fallback to a bottom dock remains when a side strip cannot fit.
- Kanji columns reflow from available width. The first-ten preview cannot force the lesson card into the neighbouring panel. Before practice unlocks, the first-ten preview occupies the second column instead of an empty practice section.
- Native Kana pages use available content width immediately when a window expands; the path no longer waits for the older phone/tablet width cap to change.

The native layout remains in `mode-atlas-ios-chrome.css` and its coordinator. Shared Kanji and mixed-choice fixes live in their existing page owners. No backend deployment or save migration is needed.

## Validation

The final 134-case browser regression passed across desktop and mobile Chromium, after correcting the larger-text scroll regression found by the initial broad run (385 passed, one failed). That specific case also passed six repeat runs. The final release check passed: 280 JavaScript tests, 20 Python tests, project/security/content audits and native web-bundle validation.

`tests/duo-practice.spec.js` is part of the release polish gate. It checks control hit testing and viewport bounds, both themes, setup/running/pause/feedback/recap, eight Writing choices, Daily/Test/timed/Endless modes, long sequences, mixed input, folding mid-answer, larger text and 20 page/section views at both window proportions. The Kanji checks inspect nested column overflow, not just document width.

Browser fixtures simulate UIKit geometry at 480×680 and 960×680, plus resize and larger-text cases. These dimensions are stress cases, not advertised hardware specifications. The accompanying screenshots are browser renders without system UI. Simulator/device verification of the camera, expanded Live Activities, VoiceOver, and real system keyboard transitions remains required on the Mac.

The implementation follows [Apple's current-window sizing guidance](https://developer.apple.com/iphone-duo/prepare/). No device-name detection, physical-orientation assumptions or hardcoded list of Duo display sizes was added.

## Mac update commands — superseded

The fresh-worktree handover changed the project path and forced another Xcode app.
Use the [3.0.5 handover](development-3.0.5.md#mac-handover-code), which updates the
original folder and preserves the user’s workspace state and Xcode selection.
The old commands have been removed to prevent repeating that regression.

Select the **App** scheme and Duo simulator/device in Xcode, then press **⌘R**. Check build **2080050**. Open and close the display during an answer, then test Daily, Test, eight-choice Recall, Read + Recall, and a four-kana sequence. Check Pause/Resume and the setup dialog at both sizes.

The development branch is `agent/mode-atlas-2.68.0-ios-theme`. Production website publication follows a main-branch merge and successful deployment. This release does not close the separate [original PDF acceptance ledger](reviews/3.0.2/pdf-status.md).
