# Web and iOS polish / ownership review — 2.67.0

## Scope and conventions

Reviewed the six current study pages (Atlas, Kana, Reading, Writing, Results,
Words), shared Profile/Settings/About, trainer controls, copy and native runtime
boundaries. Australian English uses **practice** as a noun and **practise** as a
verb. Product names such as Reading Practice remain nouns. Storage keys, routes
and API identifiers are not renamed for editorial consistency.

User-facing copy now describes an action or useful consequence. Removed redundant
confirmation commentary, internal build/save-schema cards, future architecture
claims and repeated explanations. Destructive import/reset/account flows retain
their warnings and confirmations. Native Settings no longer offers the web update
checker, which cannot establish whether a newer signed iOS binary is available.

## Confirmed problems fixed at their owners

| Area | Finding | Source change |
| --- | --- | --- |
| Trainer persistence | Writing's shared setup tab wrote Reading's settings | Shared controller writes through its mode-specific storage API |
| Writing input controls | Page handlers and a document capture handler competed; the module replaced `applyPanelStates` at runtime | One input-controls module binds the five controls; the page calls its explicit `sync` entry point |
| Modifier controls | Shared and structured renderers competed; window capture suppressed local handlers and a wrapper replaced heatmap filtering | One explicit menu renderer, direct button calls into one control owner, shared confusable-kana set; preset definitions come from the preset owner |
| Sound | Runtime wrappers replaced trainer functions and toast | Trainer results/session endings and toast call the sound owner directly |
| Kana mastery | Hub repeated mastery thresholds and snapshot assembly | Hub consumes `ModeAtlasKanaMetrics` like other progress surfaces |
| About sync | About inferred cloud status from local timestamps | About presents `KanaCloudSync.getSyncStatus()` and separates local save time from last cloud sync |
| Developer access | Loader and console repeated account/host eligibility | Console delegates to loader's eligibility methods; missing owner fails closed |
| Display | Drawer repeated preference and class mutation fallback | Drawer delegates to `ModeAtlasDisplay` |
| Visibility | Component display rules could override hidden state | Shared semantic hidden-state rule wins over component presentation; `until-found` remains exempt |
| Profile/menu layout | Long counts and labels could force rigid tracks | Shared button wrapping and flexible Profile activity tracks |
| Menu behaviour | Repeat-tap closing differed between runtimes | Shared Profile/Settings bindings toggle consistently |

These are edits to canonical sources, not appended override styles or edits to
Capacitor's generated public bundle. Versioned assets and shared HTML are rebuilt
by `build_revision_assets.py`; native content is assembled by `build_ios_web.py`.

## Ownership and dependencies retained

- Firebase JS remains the account/data authority. Native authentication transports
  credentials; this release changes no account schema, merge rules or Firestore policy.
- Storage/progress/metrics own persistence and calculations. Page controllers own
  presentation and mode-specific study flow; native engagement projects these
  values without recalculating levels or holding account credentials.
- Native settings/notifications/widgets remain behind the platform facade. Web
  never gets native reminder controls. Default widget signing remains entitlement
  free; progress sharing still requires separately provisioned App Groups.
- Shared web/iOS UI improvements are deliberate. Native home, dock, keyboard and
  safe-area styles remain scoped to native runtime. No new runtime dependency.
- Installed Capacitor dependencies resolve to one core version (8.5.2); Firebase
  resolves to one version (12.12.1). Generated copies are distribution outputs,
  not independent source owners.

## Validation and limits

The release gate runs generated-source parity, the existing Node regressions,
simulated iOS shell and web smoke suites, native bundle checks, widget model checks
and Xcode simulator compilation. A new polish suite exercises six pages in both
themes at phone/tablet/desktop widths, including narrow 320px layouts, native
runtime simulation, long profile/word data, semantic visibility and independent
Reading/Writing settings. Screenshot artifacts supplement geometry assertions.

This is still a multi-document Capacitor application, not a native screen stack.
Trainer modules still use shared global page state; explicit calls reduce hidden
coupling but do not constitute an ES-module migration. Broad migration would be a
separate change with behavioural tests, not cosmetic cleanup.

The automated geometry checks cover common visible controls, not every possible
translation, accessibility text setting or device keyboard. Native simulation in
Chromium is not WKWebView. Physical-device safe areas, VoiceOver, large text,
haptics and signed notification/widget behaviour require device verification.
A clean release gate is evidence for this change, not a claim that no future
layout or ownership issue exists.
