# Web and iOS architecture

Mode Atlas has one learning product, with two delivery targets. The website is
the canonical source of page markup, study behavior, local save format, Firebase
session and Firestore sync. The iOS app bundles those same pages and assets in a
Capacitor WebView. It does not load the live website at runtime.

## Source ownership

| Concern | Owner | Used by |
| --- | --- | --- |
| Page markup, shared navigation and trainer shell | `frontend_components.py`, page documents | Both |
| Page scripts, styles and asset order | `frontend_components.py` manifest, canonical `assets/` and root JS | Both |
| Save format, learning logic and cloud sync | `assets/app/`, `assets/trainer/`, `assets/pages/`, `cloud-sync.js` | Both |
| Version and build number | `assets/app/mode-atlas-version.js`, `sync_ios_project.py` | Both |
| Platform API and destination paths | `assets/platform/mode-atlas-platform.js` | Both |
| Web-only transport and installation | Web platform adapter, PWA and update modules | Web |
| Native sign-in chooser and app links | Native platform adapter and Capacitor plugins | iOS |
| Account UID, provider linking, cloud save and deletion | `cloud-sync.js`, shared Profile drawer | Both |
| Compact Atlas home | `index.html`, `assets/pages/mode-atlas-home-page.js`, native-gated home CSS | iOS |
| Bottom dock, setup drawer placement and native transition | `assets/platform/mode-atlas-ios-chrome.js`, `assets/css/mode-atlas-ios-chrome.css` | iOS |
| Reading letter pad and touch feedback | `assets/platform/mode-atlas-ios-keyboard.js`, native CSS, Capacitor Haptics; shared Reading handler scores the input event | iOS |
| Cold launch handoff | Static `LaunchScreen.storyboard`, shared early loader timing, native loading styles | iOS |
| Native launch screen and icon | `ios/App/App/Assets.xcassets`, `LaunchScreen.storyboard` | iOS |

`build_revision_assets.py` renders shared markup and makes revisioned assets.
`build_ios_web.py` copies that versioned runtime into `.build/ios-web`, excluding
the website's Service Worker and manifest. `npm run ios:sync` copies the payload
into the native project. The generated `ios/App/App/public` is never edited or
committed. The GitHub release gate checks the generated output, browser behavior,
native-web behavior, and an unsigned iPhone/iPad simulator build.

## Adding a feature

Implement study rules, account state, storage and shared presentation in their
canonical web owners. When the feature needs an OS capability, extend the
`AtlasPlatform` facade and implement adapters for both targets; the shared UI
calls the facade. Add iOS-specific layout only in the gated native chrome/CSS.
Use `AtlasPlatform.destinationPath` for native navigation links and app links.
This keeps a website feature available in the next iOS bundle without copying
its business logic.

The iOS bundle is a snapshot: changing the deployed website does not update an
installed app. Signed-in Firestore data still syncs through the same account.
Anonymous local storage belongs to each installation and is not shared across
web and iOS. Shipping new bundled UI or logic requires a version bump,
validated native bundle and a new signed iOS release.

The Atlas route remains one document. iOS displays its compact Today/Continue
composition from the same home controller, progress summary and Kana metrics as
the website. The web composition is hidden only under the native runtime flag.

Apple and Google are separate Firebase users until a signed-in user explicitly
links the second credential. Profile offers that link while retaining the
current UID; a credential already belonging to another UID is rejected without
merging or overwriting data. Native Apple sign-in requires the Apple capability
for `app.modeatlas` on the signing team and Apple enabled in Firebase Auth. The
app project contains the entitlement and provider integration; account and
data deletion use the shared Firebase JS session. Account deletion reauthenticates,
removes the one app-data document, revokes a fresh Apple authorization when
applicable, then deletes the Auth user; if Auth deletion
fails, it restores the document while the user is still signed in. This is a
client-side sequence, not an atomic server transaction; a production rollout
should verify Firestore delete permissions and Apple credential revocation on a
real signed device before App Store submission.

## Current navigation tradeoff

Pages remain separate HTML documents. This preserves the tested web page
controllers and avoids running two copies of initialization, auth or trainer
state in a synthetic single-page router. On supported iOS WebViews, a native-only
cross-document view transition keeps the previous page visible as the next
bundled page opens. It smooths the handoff but does not remove the reload cost.
If measured navigation remains too slow, profile the WebView and then consider a
shared, source-level routing change for both targets rather than injecting a
second runtime navigation system only into iOS.

The 1024-pixel AppIcon is an opaque export of the existing
`ModeAtlasLaunchMark` art. Its file lives in the Xcode asset catalog; the same
mark is displayed by the launch storyboard and the bundled loading screen.
The launch storyboard is static. The bundled loading surface shows the same
mark at rest, then spins it once after the first document is ready on a cold
native start. The animation completion triggers the splash fade, with a timeout
as a fallback. It never fades or shrinks the mark at the WebView handoff.
The splash colour belongs to that surface; normal pages use the theme's
`--ma-app-bg`. The iOS Reading pad uses a brief inset touch state and the native
Capacitor Haptics impact on keydown. It updates the existing answer input and
emits its normal input event. It does not own scoring, save data or Kana conversion.

## Personal Team testing (2.63.1)

Apple sign-in and linking are disabled in the native adapter, and the Capacitor
provider list contains only Google. The Xcode target does not request the Apple
sign-in entitlement or capability, allowing free Personal Team device builds.
The Apple integration and unused entitlement file remain available for later
activation. Enable all three together after paid membership and Firebase setup.
The compact home, Google sign-in and account deletion remain available.

## Ownership review through 2.64.0

Reviewed the native changes since 2.57.0 in the platform facade/adapters, native
chrome and keyboard, boot loader, shared account drawers, trainer session hooks,
Firebase Auth and release generators. The dock reuses existing controls; it does
not create a second Profile, Settings or practice controller. The Reading pad
emits the shared input event; it owns no scoring or save state. Firebase JS owns
the user session and cloud data while Capacitor provides provider UI.

The review found duplicate dock clearance in the Atlas page and iOS body. The
body now owns that space once. Repeated native trainer body/keyboard layout
rules were consolidated in the native stylesheet. Atlas now presents a compact
header, Continue action, progress, daily status and Reading/Writing shortcuts.
Word Bank remains in the dock. Normal phone sizes fit without forced clipping;
large text and short landscape windows can still scroll for accessibility.

Profile uses one native Sign in entry point and the shared dialog for provider
choices. Signed-in users have Sign-in methods; linking asks for explicit consent
and retains the current UID. Unavailable providers are not offered. Shared cloud
account operations serialize sign-in, link, sign-out and deletion so repeated
taps cannot create competing flows. Settings owns the Delete account and data
control beside Reset data. The deletion owner retains its confirmation and
reauthentication; cancellation performs no account or data mutation.

This remains a multi-document Capacitor app. Navigation can reload document
controllers; smoothing the transition does not turn it into a native screen
stack. Real-device testing remains required for provider UI and signed builds.


## Ownership review and engagement foundation (2.65.0)

The 2.64 trainer consolidation exposed an existing specificity conflict: the
shared phone body rule set padding-top to zero, beating the native body rule.
The shared trainer now consumes `--ma-page-inset-top/bottom` with the original
web fallbacks. Native chrome supplies these values once, including the measured
dock height. Keyboard framing also respects that top inset and visible dock/pad.
This fixes the competing layout inputs instead of adding another high-specificity
body override. Native display mode ignores the saved browser preference and
responds to the device width (including tablets and rotation).

Native home composition is isolated in `mode-atlas-ios-home.css`; web composition
stays in `mode-atlas-home-page.css`. Both use the same progress and Kana metrics.
Settings conditionally renders Display/Install controls only for web. Repair
save has one control in the existing Save data row on both platforms. The shared
repair, reset, import/export and account deletion handlers have not been copied.

`ModeAtlasNativeEngagement` projects the existing summary/metrics into a versioned
non-identifying snapshot: level, correct count, streak, level progress, daily
completion, timestamp and a whitelisted destination. It refreshes after progress,
cloud hydration, data clearing and returning to the foreground. It owns no
learning calculations, account session, save format or Firestore writes.
`ModeAtlasNativePlugin.swift` owns native preferences, local notifications and widget writes. The shared Foundation model in `ios/App/Shared/ModeAtlasWidgetData.swift` is compiled into the app and WidgetKit extension. It validates bounded snapshots, expires them after 24 hours and rolls daily completion over by local date. The extension has no Firebase/Capacitor dependency or account credentials.

### Reminders (2.66.0)

`mode-atlas-native-settings.js` binds the existing Settings drawer. It reads the pending schedule and authorization from iOS rather than maintaining another JavaScript preference store. Enabling asks for notification permission; disabling never asks. A stable notification identifier replaces the daily schedule when the time changes. Test notifications fire after five seconds. Taps open Reading through the existing destination whitelist, including cold launches. The plugin uses Capacitor's notification router rather than replacing its global delegate.

The schedule uses device-local calendar hours/minutes. Focus and iOS delivery settings still apply. There is no remote push/APNs service. Reset Data, account deletion and explicit sign-out cancel pending/delivered reminders, disable widget sharing and erase the shared snapshot. Mutations are serialized and a permission response cannot re-enable a reminder after a reset.

### Widgets and signing (2.66.0)

The App target embeds `ModeAtlasWidgets.appex`. Small widgets open Reading; medium widgets offer Reading and Writing. The default `ios/engagement.xcconfig` uses empty `Shared/LocalOnly.entitlements`, so shortcut widgets do not require App Groups. Apple sign-in remains disabled. Both targets must use the same signing team on a physical device.

For live progress, register an App Group with an eligible Apple Developer team and add it to the provisioning for both bundle IDs (`app.modeatlas` and `app.modeatlas.widgets`). Then run:

```bash
python3 configure_ios_widgets.py --app-group YOUR_REGISTERED_GROUP_IDENTIFIER
npm run ios:sync
```

This writes ignored `ios/widget-sharing.local.xcconfig`, inherited by both targets. It selects `Shared/WidgetSharing.entitlements`; it does not register or provision an App Group. Build/run again and enable **Show progress on widgets** in Settings. Use `python3 configure_ios_widgets.py --disable` to return to shortcut-only widgets. Never commit local signing overrides.

The app writes a protected, atomic, bounded JSON projection into the configured shared container only after opt-in. WidgetKit refresh requests are coalesced; iOS owns their delivery budget, so Home Screen updates are not guaranteed to be immediate. The timeline includes a local-midnight entry and requests another read after 30 minutes. Missing/stale data renders practice shortcuts. Disabling sharing removes the snapshot and requests an immediate timeline reload.

Research: Duolingo's unified next-step home and Headspace's Today recommendations
informed the focused continuation card, daily action and glanceable progress.
The dashboard uses actual Mode Atlas progress rather than invented recommendations.
- https://blog.duolingo.com/new-duolingo-home-screen-design/
- https://www.headspace.com/integrations/apple
- https://developer.apple.com/design/human-interface-guidelines/widgets
- https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app
- https://developer.apple.com/documentation/xcode/configuring-app-groups

Validation includes source/generated asset parity, shared web regressions,
phone safe-area geometry and native simulator compilation. A passing simulator
build does not establish signed physical-device notification behavior.
