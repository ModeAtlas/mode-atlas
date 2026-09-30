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
| Native colour palette | `assets/css/mode-atlas-ios-theme.css`; components consume roles with existing web fallbacks | iOS |
| Appearance preference | Shared theme controller; platform adapter mirrors the preference into UIKit | Both / iOS boundary |

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
The launch surface and normal pages consume the neutral native canvas role.
The system launch storyboard follows device appearance; after launch, the
WebView and UIKit frame follow the saved Dark/Light/System preference. Widgets
follow Home Screen appearance independently. See `ios-theme-system.md` for the
palette inventory and cross-boundary checks. The iOS Reading pad uses a brief inset touch state and the native
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
`ModeAtlasNativePlugin.swift` owns native preferences, local notifications and widget writes. The shared Foundation model in `ios/App/Shared/ModeAtlasWidgetData.swift` is compiled into the app and WidgetKit extension. It validates bounded snapshots, retains last-known totals and rolls daily completion over by local date. Snapshots older than 24 hours can be identified as older totals without hiding the statistics. The extension has no Firebase/Capacitor dependency or account credentials.

### Reminders (2.66.0)

`mode-atlas-native-settings.js` binds the existing Settings drawer. It reads the pending schedule and authorization from iOS rather than maintaining another JavaScript preference store. Enabling asks for notification permission; disabling never asks. A stable notification identifier replaces the daily schedule when the time changes. The native-only Test notification action lives in the existing authorised developer menu and fires after five seconds without requesting permission. Settings contains only the reminder toggle, time and an always-visible iPhone Settings link; status text appears only for errors. Taps open Reading through the existing destination whitelist, including cold launches. The plugin uses Capacitor's notification router rather than replacing its global delegate.

The schedule uses device-local calendar hours/minutes. Focus and iOS delivery settings still apply. There is no remote push/APNs service. Reset Data, account deletion and explicit sign-out cancel pending/delivered reminders and erase the shared snapshot. Mutations are serialized and a permission response cannot re-enable a reminder after a reset.

### Widgets and signing (2.66.0)

The App target embeds `ModeAtlasWidgets.appex`. Small, medium and large widgets present statistics. Tapping a widget opens the Kana dashboard for more detail. The default `ios/engagement.xcconfig` uses empty `Shared/LocalOnly.entitlements`, so the app and extension compile without App Groups. Statistics remain unavailable until sharing is provisioned. Apple sign-in remains disabled. Both targets must use the same signing team on a physical device.

For live progress, configure an App Group in Xcode and add it to the provisioning for both bundle IDs (`app.modeatlas` and `app.modeatlas.widgets`). Apple's [current iOS capability table](https://developer.apple.com/help/account/reference/supported-capabilities-ios/) lists App Groups for free Apple Developer accounts as well as paid teams (checked 2026-09-29). Do not treat paid membership as an automatic prerequisite for widget progress. Actual Personal Team provisioning and shared-container access must still be confirmed on the device; the default build keeps optional sharing disabled until configured. Then run:

```bash
python3 configure_ios_widgets.py --app-group YOUR_REGISTERED_GROUP_IDENTIFIER
npm run ios:sync
```

This writes ignored `ios/widget-sharing.local.xcconfig`, inherited by both targets. It selects `Shared/WidgetSharing.entitlements`; it does not register or provision an App Group. Build/run again; progress publication is automatic when a shared container is available. There is no user-facing widget preference. Use `python3 configure_ios_widgets.py --disable` to disable shared progress. The widget then shows an unavailable state. Never commit local signing overrides.

The app writes a protected, atomic, bounded JSON projection into the configured shared container automatically when the App Group is provisioned. WidgetKit refresh requests are coalesced; iOS owns their delivery budget, so Home Screen updates are not guaranteed to be immediate. The timeline includes a local-midnight entry and requests another read after 30 minutes. Missing data renders an honest empty state. Old but valid data retains its totals; last activity and last update are distinct timestamps. Reset/sign-out erase the snapshot and request an immediate timeline reload. Subsequent study or navigation publishes the current local progress again; widgets never receive account identity. The removed 2.66.0 opt-in preference no longer gates publication.

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

## Source polish and explicit ownership (2.67.0)

The [polish review](polish-ownership-review-2.67.0.md) records the reviewed owners,
confirmed defects and remaining limits. Writing input controls now expose an
explicit sync method instead of replacing page functions; trainer/toast sound
events call the sound owner directly. The shared trainer persists to its actual
mode. Kana hub mastery, About sync, developer access and Display preferences
delegate to their existing authorities. Shared semantic visibility is independent
of component display style. No additional runtime dependency or native signing
capability is introduced.


## Native daily use and progress widgets (2.69.0)

- The existing session-controls owner now owns pause state and answer-feedback
  scheduling for both trainers. It reuses the shared timed-mode tick and adjusts
  question/session/daily/test clocks by the paused duration. The native adapter
  forwards Capacitor app state; only iOS automatically pauses on inactivity.
  Returning never resumes without the learner choosing Resume. Ending a session
  cancels pending feedback so it cannot advance a new session.
- Backup generation/import/reset remain in the shared save owner. Only export
  transport moved behind `AtlasPlatform.exportBackup`: web uses a Blob download;
  iOS presents `UIActivityViewController`, protects and removes its temporary
  JSON, anchors the iPad popover, and returns completion/cancellation accurately.
- The font loader chooses one transport per document. Website font requests stay
  in their web stylesheet. iOS loads bundled, licensed Inter/Sora/Noto Sans JP
  subsets from `assets/fonts`; `build_ios_fonts.py` prepares them from the exact Fontsource build dependencies
  verified by npm ci. Release/native builds themselves perform no font download;
  generated binaries stay out of Git. See the font README.
- UIKit Dynamic Type is projected as a native root text scale on document load
  and preference changes. Native CSS owns reflow, including the dock, home and
  settings. Larger layouts can scroll. Japanese prompts/choices declare their
  language; Kana navigation transfers focus out of the hidden rail, and custom
  keyboard accessibility activation retains key focus. VoiceOver on a physical
  device is still a required manual check.
- Static Home Screen quick actions open Reading, Writing and Daily Challenge.
  SceneDelegate and notification taps feed one whitelisted, consume-once queue;
  the existing JS platform destination map owns navigation paths. This does not
  require Siri or App Intents entitlements.
- Visit flows remain the owner of the last-study timestamp and continuation
  destination. Successful trainer/Word Bank actions call that owner explicitly.
  Opening pages, exporting, cloud hydration and widget refreshes do not pretend
  that a learner has studied. Last activity is local to this installation; cloud
  learning totals use the existing shared progress and storage authorities.

### Statistics widget contract

The v2 projection contains level, level XP/requirement, total/Reading/Writing
correct counts, current Word Bank count, daily streak/completion and last study
activity. It includes no UID, email, vocabulary contents, credentials or Firebase
SDK. The extension reads only the bounded shared file. v1 snapshots remain
readable until replaced; unknown fields show unavailable values, not invented
zeros. The first v2 write migrates the legacy file name; reset clears both names.

| Size | Content |
| --- | --- |
| Small | Level and level progress, total correct, words banked, activity recency |
| Medium | Level/progress, total correct, words banked, daily status, activity recency |
| Large | All medium statistics plus Reading/Writing totals, daily streak, XP detail and older-snapshot update date |

WidgetKit owns refresh timing. The app publishes after study/Word Bank changes,
cloud hydration, navigation and backgrounding; it coalesces timeline reloads.
Activity recency uses “Less than a minute ago” for the first 60 seconds, then
at most two units from days/hours/minutes. `WidgetActivity.swift` owns the
first-minute transition and local-midnight timeline dates, only in the extension.
On the iOS 18 minimum, SwiftUI's system `DateOffset` format excludes seconds and updates
the archived text without app timers or data reloads. Custom live format types
are avoided because the system renderer must decode them outside the extension.
The existing 30-minute reload request remains unchanged; iOS controls actual
delivery timing. One extra entry ends the first-minute message. Daily completion
and streak are interpreted for the displayed local day, while lifetime totals
remain visible even after weeks of inactivity. Empty/unprovisioned builds show
an unavailable state instead of practice buttons or fictional sample statistics.

### Device checks before enabling sharing in a release

1. Use the same signing team for App (`app.modeatlas`) and ModeAtlasWidgets
   (`app.modeatlas.widgets`). Register/provision one App Group for both targets
   in Xcode, then run `configure_ios_widgets.py --app-group` with that real ID.
2. Build/run, complete an answer and add a word. Add each Home Screen widget size
   and compare level, mode totals and word count with Atlas/Kana/Word Bank.
3. Leave the app. Confirm the relative activity time advances without reopening;
   opening Atlas alone must not reset that timestamp. WidgetKit may defer totals
   refreshes; this is not a continuously running extension.
4. Check both appearances, large text, device lock/relaunch, midnight rollover,
   sign-out and Reset Data. Reset must remove the previous account's projection.
5. Exercise the native Share Sheet (Save to Files, cancel, failure), Home Screen
   actions on cold/warm launch, and practice interruption during answer feedback.

Automated browser simulation and unsigned simulator builds cannot establish that
this Personal Team has provisioned a real shared container. The default build
continues to use local-only entitlements until that device setup is complete.


## iOS 18 platform baseline (2.70.0)

The project Debug/Release configurations own the minimum deployment target of
18.0. App and ModeAtlasWidgets inherit it; neither target overrides it.
Capacitor reads that project value when generating CapApp-SPM/Package.swift,
so `ios:sync` retains the minimum without rewriting CLI or dependency files.
The release gate explicitly selects Xcode 26.3 / SDK 26.2 and verifies both
built products' MinimumOSVersion and extracted App Intents metadata.
The SDK version and minimum OS are separate: the same binary runs on iOS 18+.

Removed compatibility paths: pre-iOS-18 widget labels/refresh entries,
pre-iOS-17 widget backgrounds, and pre-iOS-16 notification-settings URLs.
The native controller observes appearance traits directly instead of using
the deprecated broad traitCollectionDidChange callback. There is no save-data
migration, entitlement change, new service or additional product dependency.

### System navigation ownership

`Shared/ModeAtlasDestination.swift` owns typed native destination IDs and the
main-actor consume-once queue previously inside ModeAtlasNativePlugin. The
queue stays in the foreground app process; it is not persisted to a shared
container. Cold-launch requests survive until the bridge loads. Latest wins;
foreground and bridge events cannot replay a consumed request.

`Shared/ModeAtlasStudyIntent.swift` is compiled into both app and extension.
Its OpenIntent asks the OS to foreground the app and sends a destination through
that queue. There are no custom-URL control workarounds or Associated Domains.
The bridge, local notification and Home Screen quick actions use the same queue.
JS still resolves the existing AtlasPlatform destination paths. No intent,
control or widget starts a session or owns practice scoring/data.

The app target's single AppShortcutsProvider exposes a parameterised Open screen
action for Siri/Spotlight/Shortcuts. Examples: “Open Reading in Mode Atlas”,
“Open Daily Challenge in Mode Atlas”, and “Open Words in Mode Atlas”. Users can
save a destination in Shortcuts and assign it to an available Action button.
This uses App Intents, not a SiriKit extension or Siri entitlement.

The extension's WidgetBundle retains the existing Study progress kind, adds
circular/rectangular/inline Lock Screen families, and registers one configurable
Open Mode Atlas control. The control can target any existing native destination,
defaulting to Reading. It needs no shared stats container. Lock Screen progress
uses exactly the same bounded snapshot and timeline as Home Screen widgets:

| Lock Screen family | Content |
| --- | --- |
| Circular | Atlas level and progress ring |
| Rectangular | Level, correct count, words banked and daily completion |
| Inline | Level and correct count |

Missing progress has an honest empty state. Accessory layouts use system styling
and privacy-sensitive presentation for locked-device redaction. Existing Home
Screen themes, snapshot format and widget IDs remain stable.

The dock's current-screen test now includes the query string, allowing a tap on
Reading to leave Daily Challenge/Review. Exact-screen taps still scroll without
reloading. Existing Dynamic Type, reduced-motion and focus handling remain in
the canonical native owners; no synthetic page router was introduced.

### Device validation

- On iOS 18+ add Open Mode Atlas from Control Centre's gallery, edit its Open
  destination, and launch Reading, Writing, Daily Challenge and Words with the
  app closed and already running. Add a Lock Screen control if desired.
- In Shortcuts find Mode Atlas → Open screen, choose a screen and run it. Test
  the matching Siri phrase. Discovery/indexing remains system-managed.
- Add each Lock Screen progress layout after publishing real progress. Compare
  it with the app; check Always-On/locked appearance, midnight and reset.
- Check Reading → Daily Challenge → Reading, both colour appearances, larger
  system text and VoiceOver on device. Automated browser simulation and an
  unsigned build do not replace those physical-device checks.

### Further native work

Useful next candidates are native Japanese pronunciation/replay, camera text
capture into the shared Word Bank, and a layered Icon Composer asset. These
should each reuse the current learning/data owners. On-device language-model
assistance can be a later optional iOS 26+ feature using Foundation Models
availability checks; device model alone must never gate core learning. An
unavailable model, disabled Apple Intelligence or unsupported hardware must
leave deterministic practice usable. No AI dependency is added in this release.

## Guided practice (2.71.0)

The shared learning loop, state owners, persistent settings contract and future
tutorial plan are documented in [guided-practice-2.71.0.md](guided-practice-2.71.0.md).
Native presentation continues to consume shared session state; it does not own
a separate scorer, save format or recommendation policy.


### Trainer modes (2.72.0)

[Trainer review and source ownership](trainer-review-2.72.0.md) documents the shared mode rules, unified completion/summary flow, atomic kana handling and accessible Practice Setup sheet. iOS presentation remains separate from shared learning and saving.

## Your Atlas and finite-session recovery (2.74.0)

The iOS home replaces its duplicate Reading/Writing shortcuts with compact daily
progress from `ModeAtlasRewardsUI.renderGoals`. That renderer also presents the
full goals in Your Atlas; `ModeAtlasProgress.routine` remains the data owner.
Profile progression precedes sync status. Reward selection applies the same
frame to the account avatar and the navigation avatar, which iOS moves into the
dock. Achievement rank colours are defined once in the shared theme, with the
existing native light/dark rank tokens resolving their iOS appearance.

Your Atlas separates Goals and Rewards in keyboard-accessible tabs. Its header
and tabs stay visible while each panel scrolls. Titles/frames are selectable
rows with avatar previews; UIKit app icon selection is a separate device action.
There is no duplicate progression state or alternative rewards controller.

Checkpoint version 2 extends the existing recovery owner to Reading and Writing
Daily Challenge and Test Mode. It saves the original sequence and current
unanswered question, active session time and active question time. Scores and
sequence position are derived from the saved session counters, not maintained
as a second checkpoint tally. The existing write-ahead journal commits each
answer and checkpoint together; finalization commits its result, XP receipt and
checkpoint removal together. Legacy version 1 guided checkpoints still resume.

| Mode | Recovery window | Completion rule |
| --- | --- | --- |
| Guided set | Seven days | Original question goal |
| Daily Challenge | Original local calendar day | Original 20-question sequence, including legitimate repeats |
| Test Mode | Seven days | Original shuffled sequence; one formal result after completion |
| Speed Run / Time Trial | No persisted resume | Existing in-session pause only |
| Free practice / Endless | No persisted resume | Individual answers are already saved |

Recovery is local to the installation/browser and account, not a cloud session
handoff. Starting a new run in that direction replaces its pending checkpoint.
Discarding a checkpoint keeps already earned answer progress but creates no
completion result or completion XP. Browser page navigation now captures the
same pause/checkpoint boundary as native app suspension. Idle time while the
app/page is closed does not increase active time or average answer timing.

Tests exercise both directions, partial and final-answer interruptions, exact
question order, pause time exclusion, single-result finalization, account/day
validation, discard and browser navigation, alongside home safe-area geometry,
large text, tab keyboard navigation and frame persistence.
