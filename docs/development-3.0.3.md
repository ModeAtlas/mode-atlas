# Mode Atlas 3.0.3 — adaptive iPhone layout

Prepared 23 October 2026. iOS build 2080049.

The supplied Duo screenshots showed two concrete problems: the bottom dock consumed useful height, and Home enlarged the illustration while its learning branches fell below the first screen. The old rail required 900 points after safe-area deductions, so it missed smaller expanded windows.

## Changes

- Native navigation can share the side strip below the status bar, camera and Live Activities. UIKit supplies the actual web-view bounds, independent safe areas and occlusion frames. Changes are observed without reloading the lesson. Split View can place the strip on the left.
- If the system cannot provide a suitable strip, a wide, short window gets a rail inside its safe area. A tall window keeps the bottom dock. Controls retain their labels and at least 44-point targets; an insufficient side region falls back instead of covering system UI.
- Home has a smaller banner and bounded artwork. At the 960×680 test size, all three learning cards fit in the initial screen. Returning users retain their personal summary; new users retain the simpler experience.
- Home and Learn choose card columns from their actual content width. The explicit full Kana path places the current row beside the path when both fit. Beginner entry remains focused on its first lesson.
- Handwriting uses a larger drawing surface beside its controls in a wide dialog. Narrow layouts stack again, preserving completed strokes. The answer keyboard's rows stop growing at a comfortable width.

## Research

[Apple's bar guidance](https://developer.apple.com/videos/play/tech-talks/111462/) places controls at the side on the outer display and inner landscape display, and horizontally in inner portrait. Standard navigation containers adapt automatically; Mode Atlas has a custom HTML dock, which needs explicit coordination.

[UIView.ReservedRegion](https://developer.apple.com/documentation/uikit/uiview/reservedregion) provides view-local obstruction frames, including their margins. Reading them in `updateConstraints()` subscribes to changes. The custom WKWebView uses this mechanism and converts the scene's [status-bar frame](https://developer.apple.com/documentation/uikit/uistatusbarmanager/statusbarframe) into the same coordinate system. The web layout ignores snapshots that do not yet match its current viewport during resizing.

[Apple's preparation guide](https://developer.apple.com/iphone-duo/prepare/) calls for current view geometry, independent safe areas and testing continuous resizing. Layout decisions here do not use device names, a list of panel specifications or physical orientation.

## Verification and handover

Browser fixtures simulate native geometry; their sizes are stress cases, not claimed Duo specifications. They cover changing occlusions without resizing, outer/inner changes, a left system strip, Account overlays, touch targets, branch visibility and thirteen route layouts. The 148-case browser regression run passed across desktop/mobile Chromium projects. After refining the full Kana path, all 106 Duo/Kana follow-up cases passed against 3.0.3, including the new visible-action and larger-board checks. These runs include lesson, handwriting, keyboard and larger-text regressions. The release check passed: 280 JavaScript tests, 20 Python tests, project/security/content audits and native web-bundle validation.

Screens in `reviews/3.0.3/screens/` are browser renders with simulated native insets. They do not include the system status bar or camera. Native compilation and Device Hub/physical-device results must be recorded separately; a browser screenshot is not device acceptance.

On the Mac, update the development checkout from `agent/mode-atlas-2.68.0-ios-theme`, run `npm ci` and `npm run ios:sync`, and open `ios/App/App.xcodeproj` with Xcode 27.1 or later. Use build 2080049 to distinguish this implementation from the earlier screenshots. Verify both displays, inner portrait, Split View, an expanded Live Activity, VoiceOver, larger text and typing while opening/closing. The production website changes only after the user's main-branch merge and successful deployment.

The [original PDF status](reviews/3.0.2/pdf-status.md) remains a separate, open acceptance ledger. This layout update does not claim to complete it.
