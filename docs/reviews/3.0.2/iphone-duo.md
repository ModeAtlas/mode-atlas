# iPhone Duo readiness — 22 October 2026

**The source has been adapted and browser-tested. No Xcode build, Device Hub run or physical Duo test was performed here.** Do not advertise device certification from these screenshots.

## Research and implications

[Apple's preparation guide](https://developer.apple.com/iphone-duo/prepare/) distinguishes compatibility layouts: apps built with iOS 26 or earlier can be letterboxed; iOS 27 uses more of the inner display but excludes the status region; iOS 27.1 or later enables the full layout. The release therefore needs Xcode 27.1+ and its SDK, as well as layout fixes.

[Apple's technical session](https://developer.apple.com/videos/play/tech-talks/111461/) emphasizes current window/view size, independent safe areas, trait changes and continuous resizing. Device type and orientation are insufficient layout inputs. Mode Atlas already uses scene-based windows; the audited Swift owners do not use `UIScreen.main`, device idiom or orientation to choose their layouts.

[WIRED's first-hand review](https://www.wired.com/review/apple-iphone-duo/) describes poorly adapted apps appearing in small letterboxed areas or wasting the larger screen, alongside more useful layouts with navigation rails and multiple panes. These are the concrete failure modes considered here; this is not a claim that every early review agrees.

Mode Atlas uses custom HTML inside WKWebView. It cannot assume that native tab-bar adaptation will rearrange its web controls. That is an inference from its architecture, and is why the shared web layout was changed explicitly.

## Changes made

- All four safe-area values have independent CSS owners. Content, dialogs, Account and handwriting respect either side inset and changing available height.
- The native bottom bar becomes a right rail when usable space permits. Existing branch/card grids use the remaining width, while lessons keep readable widths.
- Account overlays sit above the rail. Testing caught and fixed a real obstruction of Settings switches by the rail.
- Lesson text remains intact during resizing. Saved word-lesson checkpoints survive closing/reopening and reload. In handwriting, a resize cancels the incomplete pointer stroke and preserves completed strokes.
- The build workflow uses the official `xcode-27` runner family and `select_ios_toolchain.py` checks the installed iPhone SDK for 27.1+. A runner label alone does not prove that minor SDK is installed. The selector fails with an actionable message if it is missing. [Runner announcement](https://github.blog/changelog/2026-10-15-xcode-27-runner-image-generally-available/).
- Both iPhone/iPad device families, supported orientations and existing scene handling remain in place. No full-screen-only workaround was added.

## Evidence collected

Thirteen routes were checked in a simulated native web runtime: Home, Learn, Kana, Kanji, handwriting, Read, Recall, both result pages, Progress, Word Bank, Friends and Shop. The geometry matrix was 390×680 (right inset 44), 1040×780 (right 52), 440×740 (left 48), and 740×390 (left 28), with top/bottom insets. These are stress fixtures, **not asserted Duo panel specifications**. Each route had no horizontal overflow, and main content remained inside the supplied safe areas.

Targeted interactions also covered Account controls above the rail, changing sides, typed lesson input, reload/backup continuation, an unfinished handwriting stroke, and enlarged Settings text. See `tests/duo-learning.spec.js` and the screenshots in `screens/`.

## Native launch gate still to execute

Use the selected Xcode 27.1+ toolchain, compile the app and widget extension, then run the Duo Device Hub simulator and a physical device. Record device/OS/build and attach evidence for each row; do not replace this with a browser pass.

| Exercise | Required observable result |
| --- | --- |
| Outer → inner → outer, including mid-answer and keyboard open | Same lesson/question and typed answer; usable controls; no reload or duplicated award. |
| Inner rotation and supported split/resize positions | Correct asymmetric safe areas; navigation changes with actual available size; no clipping or unnecessary empty strip. |
| Active handwriting | Completed strokes survive; unfinished stroke cancels safely; next stroke and Close remain reachable. |
| Japanese IME, hardware keyboard, VoiceOver, larger text | Composition does not prematurely submit; sensible reading/focus order; essential actions remain reachable. |
| Cold native launch offline, restored account, account switch | Bundled study opens; saves keep correct ownership; sync resumes accurately. |
| Widget sizes/tint and app-group refresh | Correct app/account data and routes after a change, without stale prior-account information. |
| Reminder/push permission changes and token refresh | Accurate status, correct delivery and cleanup on sign-out/deletion. |
| Large mature save on a modest supported iPhone | Record median/p95 answer-save latency and interrupted/near-full recovery; the desktop benchmark is not sufficient. |

The minimum supported iOS version remains 18.0. Requiring the new SDK to build the release does not require every user to run iOS 27.1.
