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
