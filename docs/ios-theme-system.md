# iOS colour system — 2.68.0

## Direction and scope

Light uses a soft-grey canvas, white cards and dark text. Dark uses a near-black
graphite canvas and progressively lighter charcoal surfaces, not navy gradients.
Reading green, Writing blue, Kana purple and Results gold remain small meaningful
accents. Progress rings, heatmaps, rank distinctions and correct/incorrect feedback
remain data, not decorative paint to be flattened.

The goal is clearer native hierarchy, not an imitation of another product. Apple's
[Dark Mode guidance](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
and Duolingo's [core-tabs design account](https://blog.duolingo.com/core-tabs-redesign/)
informed the separation of calm foundations from recognisable accents.

## Ownership and inventory

| Role group | Consumers | Authority |
| --- | --- | --- |
| Canvas, surface, elevated, inset | All six screens, cards, setup groups, profile/settings, sheets | `mode-atlas-ios-theme.css` |
| Primary/secondary text, headings | Labels, explanations, empty states, values, legal pages | Native tokens mapped to shared text roles |
| Control, hover, selected, primary, focus | Buttons, fields, tabs, setup toggles, dock, keyboard | Native palette; original component rules consume it |
| Success, danger, warning and soft fills | Practice answers, heatmaps, status messages, destructive actions | Semantic palette pairs |
| Reading/Writing/Kana/Results, rank colours | Charts, category labels, achievement ranks and progress | Semantic palette; data values remain with their existing owners |
| Shadows, scrim, key indentation | Sheets, dock, loading mark, keyboard touch state | Native palette |
| Preference and theme-change event | Dark/Light/System controls and Results canvas repaint | `mode-atlas-theme.js` |
| Native frame and status bar | Window, WebView, OS status text | `AtlasPlatform.setAppearance` → existing native plugin / SceneDelegate |
| System launch canvas | Static launch storyboard before the WebView exists | Adaptive `AppCanvas` asset, checked against CSS |
| Widgets | WidgetKit small/medium views | SwiftUI system surfaces/text and adaptive study accents |

The palette defines **values**, not page layout or component override selectors.
It is scoped to `html[data-ma-runtime="ios"]`. The web theme still owns its
existing defaults; its historical light repaint rules are now explicitly web-only
without increasing their specificity (`:where(:not(...))`).

Components already using semantic tokens require no duplicate native rules.
Legacy literal/gradient paint is converted at its original declaration to
`var(--ma-native-role, original-web-value)`. This is an explicit platform fallback,
not an appended stylesheet fighting page selectors. No CSS/JS is injected at runtime
to repaint the app, and generated `.assets-*` / Capacitor public files are outputs,
not independent source owners. Backend, Firebase, study state, routing and account
data are unchanged. No new runtime package is introduced.

## Adjusting the palette

1. Change the named Dark/Light values in `mode-atlas-ios-theme.css`.
2. Keep foreground/background pairs together; run the contrast tests. Stronger
   separators and secondary text are provided for `prefers-contrast: more`.
3. If changing the canvas, also update `AppCanvas.colorset`; a test prevents drift.
   WidgetKit's own system surfaces are deliberately independent of app preference.
4. Rebuild revisioned assets, sync iOS and inspect both themes on device.

The original preference storage key and default remain intact. UIKit stores only
a launch-frame mirror, not a second preference authority. System is passed through
as `.unspecified` rather than forcing whichever style happened to be active. The
OS-controlled launch screen uses device appearance, so a manually opposite in-app
theme may differ during that short system-to-app handoff.

## Verification

- Node tests cover native scoping, ownership, palette text pairs (4.5:1), the asset
  canvas, System/manual behavior and theme-change notification.
- The Playwright theme suite covers six populated/empty surfaces in both themes,
  settings/profile/setup, keyboard press depth, Writing feedback and canvas redraw.
- Website computed foreground/background/border/shadow paint is compared on the
  same DOM against a pinned 2.67.0 Git baseline in both themes; the existing polish
  matrix covers geometry at phone/tablet/desktop sizes in web and native modes.
- GitHub fetches the baseline named in `tests/fixtures/web-theme-baseline.txt`.
  Update that reference only for an intentional website visual change. For a local
  equivalent tree, `MODE_ATLAS_WEB_THEME_BASE=<ref>` can select the local baseline.

These checks are not a blanket accessibility certification. Chromium native
simulation is not WKWebView. Physical-device launch appearance, status bar,
increased contrast/text size, widget rendering and keyboard feel remain device QA.
