## 2.57.0 - 2026-09-27

- Provisioned the real Firebase Apple app registration for `app.modeatlas` in the existing `mode-atlus` project.
- Bundled the validated Firebase plist with the iOS target and derived the Google callback URL scheme from that single configuration owner.
- Routed the Google callback through the iOS scene delegate while retaining Capacitor navigation URL handling.
- Made Firebase configuration mandatory for release checks and verified the built simulator app's bundled plist and resolved URL scheme.

## 2.56.0 - 2026-09-27

- Route cold and warm iOS launches through Capacitor App to shared Mode Atlas destinations, with a dedicated `modeatlas://open/` navigation scheme.
- Activate the Reading Daily Challenge and weak-kana review setup from destination links, including the existing website review links.
- Keep native launch URL handling restricted to known Mode Atlas destinations and ignore unrelated authentication callbacks.
- Normalize Capacitor's generated Firebase SPM symlink to a repository-relative target during iOS sync so builds stay source-clean across checkout locations.

## 2.55.0 - 2026-09-27
- Added native Google sign-in transport for the iOS shell using Capacitor Firebase Authentication 8.5.2.
- Kept Firebase JavaScript Auth as the single authenticated session owner across web and iOS; native iOS owns only the Google account chooser and returns an OAuth credential to the existing cloud-sync owner.
- Configured the Capacitor Firebase plugin with `skipNativeAuth: true` and only the `google.com` provider to prevent duplicate native/web Firebase sessions.
- Updated `cloud-sync.js` to exchange the native Google credential through `GoogleAuthProvider.credential()` and `signInWithCredential()`, preserving the same Firebase UID, Firestore path, hydration, merge and sync logic used by the website.
- Added explicit native auth capabilities to the shared `AtlasPlatform` boundary instead of placing iOS-specific calls in trainer/page code.
- Added a Firebase Apple configuration validator and documented the required `app.modeatlas` registration in the existing `mode-atlus` Firebase project. Native Google sign-in remains intentionally unavailable until the real iOS `GoogleService-Info.plist` is provisioned; no placeholder client IDs are committed.
- Synchronized the real Capacitor iOS project and Swift Package Manager dependencies with the Google-only Firebase Authentication trait.
- Extended audit, regression and simulated native-shell coverage for the single-owner authentication boundary.

## 2.54.0 - 2026-09-27
- Added the first Mode Atlas iOS/native foundation without duplicating learning logic or creating a separate frontend implementation.
- Introduced one shared `AtlasPlatform` facade with explicit web and iOS adapters for native-capability boundaries such as app version, external links, destinations, notifications, badges, and widget snapshots.
- Added first-class native runtime detection to the shared head bootstrap. Native mode is now an explicit environment rather than an inferred browser special case.
- Browser-only PWA install prompts, deployed-version checks, document revision guards, and Service Worker/update ownership are explicitly disabled inside the native runtime.
- Kept browser Firebase authentication disabled inside the native WebView until the native Firebase authentication bridge owns that responsibility; existing web Firebase behaviour is unchanged.
- Added a deterministic `build_ios_web.py` builder that packages the validated revisioned web runtime for iOS while excluding Service Worker/PWA transport files and duplicate canonical JS/CSS sources.
- Restored the permanent release gate, removed the legacy duplicate changelog workflow, and added native-foundation source tests plus a simulated Capacitor/iOS lifecycle smoke test.
- No Reading, Writing, Kana, Results, Word Bank, SRS, mastery, achievement, scoring, or persistence logic was rewritten for iOS.

## 2.53.3 - 2026-09-27
- Corrected the phone navigation top-of-page state so it sits in normal document flow on first load and whenever the user returns to the page top.
- The nav now becomes a floating fixed control only after the user has left the top of the page and performs the deliberate upward reveal gesture.
- The existing shared spacer remains owned by the navigation component but is inactive at the page top and only reserves flow while the nav is floating, preventing overlap or content jumps.
- Preserved the 48px upward reveal threshold, downward hide behaviour, explicit Focus Mode, and tablet/desktop navigation.
- Updated browser/regression coverage for initial top layout, floating reveal away from the top, and clean restoration when returning to the top.

## 2.53.2 - 2026-09-27
- Reworked phone scroll navigation to match the intended reveal model instead of showing on any small upward adjustment.
- Removed the legacy mobile `.ma-nav { position: relative; top: auto; }` rule that was overriding the shared sticky navigation owner and preventing the nav from reappearing at the current viewport position.
- Phone navigation now hides after deliberate downward travel, stays hidden through small upward corrections, and only reappears after a longer upward scroll.
- When revealed away from the top of the page, the nav remains sticky at the top of the current viewport; reaching the page top always reveals it.
- Updated responsive browser coverage to verify minor upward adjustments do not reveal the nav, longer upward travel does, and the revealed nav is accessible while the page remains deeply scrolled.
- Preserved explicit Focus Mode, tablet/desktop navigation, trainer behaviour, Results, persistence, progression, and PWA/update ownership.

## 2.53.1 - 2026-09-27
- Fixed phone scroll-aware navigation on real touch devices by accumulating small scroll deltas instead of requiring a single scroll event to exceed the hide/reveal threshold.
- Downward scrolling now hides the phone navigation after a small cumulative movement, while reversing upward reveals it almost immediately.
- Updated browser coverage to reproduce touch-like incremental scrolling rather than relying on one large programmatic jump.
- Preserved the 2.53.0 phone trainer framing and keyboard-aware focus-mode behaviour.

## 2.53.0 - 2026-09-27
- Refined the phone Reading/Writing active-session frame so the session HUD, kana/prompt, and active input are framed together when the software keyboard opens instead of scrolling the score HUD above the visible viewport.
- Reduced active phone prompt height and oversized kana/prompt scaling so the interaction area sits more naturally in the available phone viewport without changing desktop/tablet trainer composition.
- Added shared software-keyboard state ownership to the trainer session controller so phone-only presentation can respond cleanly to the iOS visual viewport; the bottom Focus exit handle is suppressed while the keyboard is open to avoid overlapping the keyboard controls.
- Added phone-only scroll-aware shared navigation: scrolling down hides the sticky navigation, reversing direction reveals it immediately, and returning to the top keeps it visible.
- Kept automatic phone navigation separate from explicit Focus Mode so Focus remains user-controlled.
- Added regression/browser coverage for HUD visibility during keyboard-sized viewports and phone navigation hide/reveal direction behaviour.
- Preserved trainer scoring/SRS, Reading/Writing mode identity, cloud/local persistence, Results, progression, PWA/update ownership, and tablet/desktop layouts.

## 2.52.0 - 2026-09-27
- Polished the Results master-detail experience across desktop, tablet, and phone without changing assessment data or scoring.
- Kept Assessment history and Kana-level analysis side by side through tablet widths where both remain usable, instead of forcing every explicit Tablet view into a long stacked layout.
- Added a tablet-density pass for the history list, detail panel, metrics, and kana heatmap so the split view stays readable without oversized cards or wasted space.
- Changed narrow tablet/phone Assessment history into a horizontal, scrollable test selector rather than a long vertical block that pushes the selected assessment far below the fold.
- Reduced kana heatmap tile height, padding, type size, and badge size at each responsive tier while retaining five kana per row and the existing fastest/slowest markers.
- Added browser coverage for the real 1024px iPad master-detail layout, tablet heatmap density, and phone history/heatmap composition.
- Preserved formal Test Mode calculations, Results selection behaviour, storage, cloud/local persistence, navigation, trainer behaviour, and PWA/update ownership.

## 2.51.0 - 2026-09-27
- Fixed the remaining iPad Results dead-space issue at the owning Results tablet layout rule.
- Removed `.summary-grid` from the generic Tablet two-column group; the selected-assessment summary has one child and therefore must remain a single full-width column.
- This restores full-width use for the selected assessment card and its row-performance section while preserving the intended two-column Tablet layouts for metric, overview, and test grids.
- Added regression coverage that explicitly prevents Tablet mode from assigning two columns to `.summary-grid`.
- Updated the iPad browser test to assert the real Results summary is one column and that its content occupies the full available width.
- Preserved the 2.50.0 shared End session icon fix, trainer behaviour, navigation, persistence, progression, and PWA/update ownership.

## 2.50.0 - 2026-09-27
- Corrected Results row-performance layout at its canonical stylesheet so iPad/tablet widths keep all ten row cards across the available panel instead of dropping to an artificial five-column grid.
- Removed the obsolete 901–1180px five-column breakpoint that was reintroducing the large empty right-hand area on iPad.
- Updated the shared stop icon in the central Mode Atlas SVG sprite to a clearer circular stop control with a filled stop glyph; Reading and Writing continue to consume the same parent icon asset.
- Strengthened regression coverage to guard against reintroducing the tablet five-column Results rule and to verify the shared End session icon source.
- Updated the iPad browser test to exercise a 1024px viewport so the breakpoint that previously failed is now directly covered.
- Preserved trainer behaviour, shared navigation, cloud/local persistence, progression, PWA/update ownership, and existing responsive layouts outside this scope.

## 2.49.0 - 2026-09-27
- Unified Achievements and Mastery Map detail navigation so their shared dialog close control is the only back/close affordance: detail → parent menu, parent menu → originating page.
- Removed the duplicate Mastery Map instruction line while retaining one compact in-map explanation.
- Refined Focus Mode so the shared top-right control is clearly labelled on larger layouts, remains usable to exit Focus Mode, and keeps the extra bottom Exit control phone-only.
- Corrected trainer retry-state controls so End session remains available after an incorrect answer, while Pause and I don’t know are temporarily hidden, and all controls restore after Try again.
- Corrected Results row-performance responsiveness so wide iPad/tablet layouts use the available width instead of being forced into a five-column half-width block.
- Added regression and browser coverage for the corrected navigation hierarchy, Focus Mode toggle behaviour, retry-state restoration, and wide-tablet Results layout.
- Preserved trainer scoring/SRS, cloud/local persistence, save schemas, progression, PWA/update ownership, and existing Reading/Writing/Test behaviour.

## 2.48.0 - 2026-09-27
- Completed the phone/tablet UX hardening pass across Reading/Writing trainers, shared navigation, Results, Achievements, and the Kana Mastery Map.
- Made the Achievements detail close control return to the Achievements overview before dismissing the feature dialog, removing the duplicate Back to achievements action.
- Reworked Results row-performance charts so desktop, tablet, and phone layouts keep readable chart geometry instead of compressing row wheels.
- Kept Focus Mode icon-only and contained at phone/tablet sizes while preserving its accessible label and shared navigation ownership.
- Condensed and clarified the Mastery Map introduction so the kana grid appears immediately, with clearer stage summaries and kana-state accents.
- Added a shared trainer result state that keeps the correct answer and Try again action together in the visible practice frame and removes no-longer-useful session actions.
- Added responsive browser coverage for nested Achievements navigation, Mastery Map first-view visibility, Focus Mode containment, Practice Setup, keyboard framing, and trainer loss-state framing.
- Preserved scoring/SRS, cloud/local persistence, save schemas, PWA/update ownership, progression, Test Results data, and Reading/Writing mode identity.

## 2.47.0 - 2026-08-16
- Repaired package-lock package URLs so clean machines install Playwright dependencies from the public npm registry instead of an environment-specific internal registry.
- Restricted revision-build and release-audit HTML discovery to Mode Atlas source, preventing installed dependencies and browser-test output from being interpreted as application pages on clean CI machines.
- Isolated the Word Bank page controller in page-local module scope so its romaji helper maps cannot collide with the shared Kana Data module or block downstream Kana Metrics and Achievements startup.
- Hardened browser smoke state around completed onboarding, release notes, shared Settings readiness, current Atlas/Word Bank controls, and canonical trainer/drawer state so CI validates the real current user flows.
- Corrected the Kana Hub main landmark so it no longer emits duplicate id attributes while retaining the shared mainContent accessibility target.
- Added a permanent release gate covering the project audit, Node regressions, generated-asset cleanliness, and desktop/mobile Playwright smoke tests.
- Renamed the PWA assessment shortcut to Test Results so installed-app terminology matches the formal Test Mode reporting experience.
- Kept trainer behaviour, scoring/SRS, storage schemas, cloud sync, progression, onboarding, PWA install ownership, and update-check application logic unchanged.

## 2.46.0 - 2026-08-16
- Split Firebase startup so App/Auth still restore returning accounts immediately while Firestore loads only when an authenticated cloud operation actually needs it; signed-out visitors no longer download Firestore on every page.
- Replaced the always-loaded developer console JavaScript/CSS with a small eligibility loader that loads the full diagnostics only on localhost or for the developer account.
- Kept lazy developer assets revisioned and build-owned so production diagnostics remain cache-safe without adding unmanaged runtime files.
- Removed stray macOS metadata from the repository and added regression/audit guards for the new production dependency boundaries.
- Preserved auth restoration, cloud hydration/merge ownership, save schemas, PWA/update behaviour, trainer scoring/SRS, Test Results, Atlas Level, and achievement calculations.

## 2.45.0 - 2026-08-16
- Added a shared keyboard bypass link and stable main-content landmarks across the real application pages.
- Converted trainer Records, Mastery, Practice Setup, and mastery heatmap interactions to native keyboard-operable controls with shared ARIA state ownership.
- Improved shared dialog focus semantics and modal drawer scroll locking while retaining existing Escape/focus-return behaviour.
- Raised compact interactive touch targets on coarse-pointer devices without inflating passive pills, badges, or desktop-only presentation.
- Kept reduced-motion, focus-visible, trainer/scoring/progression/storage/cloud/PWA behaviour under their existing owners and added focused accessibility regression coverage.

## 2.44.0 - 2026-08-16
- Standardized app-wide action language so Start begins an actual practice session, destination links use Open/View/Back, and shared trainer controls use consistent sentence case.
- Renamed the Kana assessment destination to Test Results across navigation, Atlas, Kana, trainer links, and formal-assessment UI while preserving all Test Mode data and analysis behavior.
- Made Reading and Writing subpage branding return to Kana Trainer consistently and corrected shared brand accessibility labels to match their real destination.
- Standardized assessment correctness language to Correct/Incorrect across trainer HUDs, records, Test Results metrics, tooltips, heatmap legend, and kana detail dialogs.
- Normalized smaller UI vocabulary including Tablet display mode, Word Bank action casing and feedback tones, Data and app wording, and shared ellipsis treatment without changing stored preferences or schemas.

## 2.43.1 - 2026-08-16
- Rebalanced achievement tile composition so status, icon, title, requirement, and progress use the available card height without crowding the progress bar.
- Increased visual separation between bronze and gold rank accents while retaining the restrained five-rank palette.
- Replaced the ambiguous achievement detail Close / Back pairing with an icon-style dialog close control and an explicit Back to achievements action.
- Kept achievement categories, thresholds, rank progression, legacy unlock IDs, Atlas Level integration, and unlock history unchanged.

## 2.43.0 - 2026-08-16
- Reorganized Achievements into Mode Atlas, Kana Trainer, and Word Bank categories with placeholder sections for Listening, Grammar, and Reading Comprehension.
- Consolidated sequential milestones into ranked achievement tracks so one tile advances through its next rank instead of filling the menu with separate tier tiles.
- Added rank-aware visual progression and achievement detail navigation for reviewing earlier completed ranks or inspecting later requirements.
- Added the Atlas Level achievement track at Levels 5, 10, 20, 50, and 100, consuming the shared ModeAtlasProgress level rather than calculating progression locally.
- Preserved legacy per-rank unlock IDs so existing achievement history remains stable while the visible menu becomes substantially less cluttered.

## 2.42.0 - 2026-08-16
- Made the automatic install suggestion progression-aware: it becomes eligible after 100 lifetime correct Kana Reading/Writing answers and only appears at a natural break rather than interrupting the milestone answer.
- Kept install prompting under the single shared PWA owner, including manual browser/iPad instructions when `beforeinstallprompt` is unavailable, and made automatic prompt acknowledgement device-local rather than exported account state.
- Added XP gained to standard session summaries, formal Test Mode completion summaries, and Daily Challenge completion feedback.
- Added a queued Atlas Level-up dialog that waits for session/Test summaries to finish before appearing, then lets the install suggestion run afterwards when eligible.
- Added developer Progress / XP diagnostics with controlled Add XP and Remove XP actions through `ModeAtlasProgress`, including merge-safe signed debug adjustments and level-up testing without raw storage writes.

## 2.41.0 - 2026-08-16
- Added account-wide Atlas Level progression to Profile with XP, level progress, Reading correct, Writing correct, and lifetime correct totals.
- Added one shared `ModeAtlasProgress` owner with semantic Kana correct/Daily/Test events, one-time legacy seeding from existing trainer statistics, and centrally derived XP/levels.
- Added merge-safe per-device monotonic answer counters plus unique one-time completion events so cross-device sync cannot lose or double-award progression.
- Kept Atlas Level separate from Kana mastery and Test performance, and exposed lifetime correct as a stable engagement signal for future install eligibility.

## 2.40.0 - 2026-08-16
- Reframed Results as the formal assessment report for Reading and Writing Test Mode only.
- Preserved the full kana heatmap, row doughnut graphs, modifier-row analysis, fastest/slowest markers, pinned test averages, master/detail history, trends, and Recommended Review.
- Split improvement trends by assessment skill: Reading compares only with Reading tests and Writing only with Writing tests.
- Added a formal-test consumption guard so non-Test-Mode records cannot be interpreted as assessment results even if they appear in a results storage key.
- Improved empty states and assessment terminology without changing Test Mode scoring, stored result schemas, or trainer behavior.

## 2.39.0 - 2026-08-16
- Added one shared Reading/Writing trainer controller for common page lifecycle and persistence behavior while retaining thin mode-specific answer adapters.
- Consolidated trainer save/load refresh, cloud/bfcache/UI refresh coalescing, Daily/Test header and HUD state, shared panel state, score-history formulas, test-result persistence adapters, SRS-correct scheduling, session-summary plumbing, and debug element primitives.
- Removed duplicate controller-owned score formulas and refresh listeners from the Reading/Writing page files; both modes now consume the same implementation with explicit mode configuration.
- Kept Writing-only choice generation, repeat limiting, keyboard modes, accepted-answer handling, and prompt rendering local; Reading romaji input and its answer progression remain local as well.
- Preserved all existing trainer IDs, scoring/SRS weights, Daily/Test sequences and seeds, result schemas, save keys, cloud behavior, Practice Setup, and the 2.38 active-session UI.

## 2.38.0 - 2026-08-16
- Reworked active Reading and Writing sessions into a focused shared practice stage: compact mode context, session HUD, large prompt, answer area, and quieter session controls now form one clear hierarchy.
- Made the existing shared `trainer-session-active` state the sole presentation owner for active practice, removing duplicate CSS session detection based on `:has(#startWrap[hidden])`.
- Kept Records and Mastery reachable but visually secondary on desktop during practice, while tablet and phone sessions remove those side panels from the active question flow.
- Hid Practice Setup while a session is active and restored it automatically when the shared session state ends, without changing trainer settings or session lifecycle logic.
- Preserved all trainer IDs, Reading/Writing input modes, presets, modifiers, Daily Challenge, Test Mode, scoring, SRS, pause/skip/end behavior, result storage, save schema, and cloud sync.

## 2.37.0 - 2026-08-16
- Reworked Word Bank from nested hero/library/entry cards into an open, collection-first vocabulary surface with scan-friendly rows.
- Added collection-aware page copy: empty libraries explain how to begin, while established libraries lead with saved-word, favourite, and missing-meaning context instead of repeating product onboarding copy.
- Kept kana, meaning, and romaji as the primary scan targets while moving type, update date, notes state, favourite controls, and editing into quieter supporting positions.
- Added distinct empty-library and zero-filter-result states, including a one-click clear-search-and-filters action when the collection exists but the current view is empty.
- Preserved Word Bank schema, romaji generation, persistence order, duplicate handling, cloud sync, import/export ownership, and destructive-confirmation behavior.

## 2.36.1 - 2026-08-16
- Kept the full Kana orientation hero for zero-history learners, while regular learners now receive a compact state-aware header instead of repeated introductory marketing copy.
- Returning Kana headers now summarise saved coverage, mastered kana, streak state, and current weak-kana focus so the buffer is personal and useful without competing with the statistics below.
- Collapsed Reading / Writing / Results into a slim shortcut band for returning learners and tightened the progress intro so saved statistics arrive much sooner on repeat visits.
- Preserved the complete first-use Kana experience and all existing recommendation, mastery, Daily Challenge, preset, Results, storage, sync, and trainer behaviour.

## 2.36.0 - 2026-08-16
- Refined Kana Trainer into a clearer sub-homepage: a calm, action-first introduction now leads into practice destinations before any progress data appears.
- Replaced the three large pathway cards with a lighter Reading / Writing / Results navigation band so the top of Kana has more breathing room while keeping each destination distinct.
- Reorganized progress into a dedicated numerical layer for coverage, recommendation, Daily Challenge state, weak kana, mastery, presets, accuracy, records, and total practice volume.
- Removed nested page-specific card ownership from Kana progress rendering and replaced it with shared matrices, separators, and a smaller number of purposeful surfaces rather than hiding the old card wall with overrides.
- Preserved Kana metrics, mastery thresholds, recommendation rules, Daily Challenge behaviour, preset calculations, Results links, save schemas, storage, and cloud-sync behaviour.

## 2.35.0 - 2026-08-16
- Refined Atlas into a cleaner product homepage with an open editorial hero, product previews, and less card-heavy section framing.
- Replaced the abstract constellation with representative Reading, Writing, and Word Bank previews that show what the learning tools feel like without adding learner statistics to Atlas.
- Reworked Kana Trainer and Word Bank into alternating product feature sections with clearer learner-focused value, direct actions, and lighter visual hierarchy.
- Kept the returning-user homepage intentionally restrained: only the hero changes to a single Continue studying action while the rest of Atlas remains the same clean product homepage.
- Simplified Atlas-only CSS by removing the retired constellation/branch-card composition instead of layering new overrides on top of it.

## 2.34.2 - 2026-08-16
- Restored Kana Trainer as a direct navigation destination while retaining the compact Kana section flyout.
- Desktop/fine-pointer users can hover to inspect Kana sections and click Kana Trainer to go straight to the Kana overview.
- Touch users open the flyout on the first tap and navigate to Kana on a second tap of the Kana Trainer control, avoiding a fragile timed double-tap gesture.
- Centered Overview, Reading, Writing, and Results labels within the flyout controls.

## 2.34.1 - 2026-08-16
- Replaced the in-flow Kana Trainer secondary navigation row with a compact floating flyout so the shared header stays single-height on desktop.
- Kana Trainer now opens its Overview, Reading, Writing, and Results destinations on hover/focus with pointer devices and on tap/click for touch devices.
- Added one shared navigation interaction owner with outside-click and Escape dismissal plus synchronized `aria-expanded` state.
- Preserved the 2.34.0 product hierarchy and current-page semantics without changing trainer, results, storage, sync, or scoring behaviour.

## 2.34.0 - 2026-08-16
- Reworked shared navigation around product hierarchy: Atlas, Kana Trainer, and Word Bank are now the primary Mode Atlas destinations.
- Added one shared Kana-local navigation layer for Overview, Reading, Writing, and Results across the entire Kana branch.
- Keeps Kana Trainer visually active in the product navigation while the actual local page owns `aria-current="page"`, preserving clear hierarchy without duplicate current-page semantics.
- Simplified Atlas navigation copy and kept all navigation generated by the existing build-time shared component owner.

## 2.33.2 - 2026-08-16
- Moved Kana starting-level setup to the Kana/Reading/Writing destination page so Word Bank never has to host or load Kana preset logic.
- Fixed Word Bank → Kana first-use flow: after general Mode Atlas consent, navigation reaches Kana and Kana setup opens there before practice begins.
- Added the Kana-setup flag to the canonical Mode Atlas save/storage ownership registry and made pending onboarding destinations app-owned local state.
- Tightened legacy onboarding migration so old `modeAtlasStarterSeen` only migrates to Kana setup when real existing Kana configuration is present, instead of permanently bypassing the new branch-specific setup.

## 2.33.1 - 2026-08-16
- Split first-use setup into general Mode Atlas consent and Kana-specific starting-level setup so Word Bank no longer asks for irrelevant Kana presets.
- Preserved the chosen destination through setup and defers Kana starting-level selection until the learner actually enters Kana, Reading, or Writing.
- Fixed Word Bank first-use completion by removing its dependency on the Kana preset module rather than loading unrelated trainer code into Word Bank.
- Prevented the install prompt from overlapping visit/setup dialogs and corrected setup-error visibility so validation feedback only appears when a real save failure occurs.

## 2.33.0 - 2026-08-16
- Restructured Atlas into a clean ecosystem homepage with distinct visitor and returning-user hero states and no study-stat dashboard on the homepage.
- Changed first-use onboarding from an automatic homepage interruption into a destination-aware branch-entry gate that resumes the user’s chosen branch after setup.
- Reframed Kana as the Kana Trainer sub-homepage with a calmer action-first introduction, dedicated Reading/Writing/Results paths, and progress reporting moved below the introductory area.
- Preserved trainer algorithms, result storage, cloud/save ownership, Service Worker retirement, and update/version behavior while rebuilding revisioned assets and regression coverage.

## 2.32.0 - 2026-08-15
- Consolidated canonical CSS source without changing page design or application behaviour, removing only identical same-selector declarations while preserving differing cascade rules.
- Made the shared setting-row component the responsive geometry owner; Settings now supplies layout variables instead of overriding component geometry with a higher-specificity grid rule.
- Removed retired Profile sign-in/sign-out visibility selectors left behind by the single state-aware Google account action.
- Reduced duplicate CSS ownership in trainer, Achievements, Kana, Results, and shared theme sources where declarations were provably identical.
- Rebuilt revisioned assets and revalidated the project audit and full regression suite.

## 2.31.4 - 2026-08-15
- Fixed Settings preference-row overlap by giving labels a protected column and allowing segmented controls to size to the drawer.
- Removed empty Save Data status spacing so the backup controls no longer leave a large unused gap.
- Replaced separate profile Sign in / Sign out buttons with one state-aware Google account action that signs in when logged out and signs out when logged in.
- Extended the shared cloud UI binding with a single auth-button contract while preserving existing two-button bindings elsewhere.

## 2.31.3 - 2026-08-15
- Simplified basic Settings rows by removing unnecessary explanatory copy from Display, Sound, and Appearance.
- Fixed Atlas top framing by removing the oversized hero section top padding that created a large empty band below navigation.
- Removed Word Bank's duplicate page-specific JSON Export/Import system; the global Mode Atlas Save Data tools remain the sole backup/restore owner and continue to include Word Bank data.
- Replaced the bottom Collection Tools disclosure with a compact Word Bank settings action beside Add word; only the Word-Bank-specific Clear all words action remains there.
- Removed the retired Word Bank export/import handlers and related CSS/markup rather than hiding dead code.

## 2.31.2 - 2026-08-15
- Reworked Word Bank into a true library-first layout: the permanent Quick Capture rail is removed and Add word now opens the existing capture flow in the shared Mode Atlas dialog.
- Added an Add a word action to the empty library state and closes the capture dialog after a successful add while keeping storage, romaji generation, duplicate detection, and cloud sync unchanged.
- Fixed shared icon buttons so Safari no longer renders Favourite/Delete as native white controls; corrected Word Bank disclosure chevrons, focus styling, and Collection Tools spacing/wrapping.
- Moved forced tablet/phone Settings row stacking into the shared component owner and removed the drawer-specific duplicate workaround.
- Simplified the paused trainer state to a restrained cue, removed the oversized bottom pause surface, and switches the Pause/Resume SVG between pause and play correctly.

## 2.31.1 - 2026-08-15
- Fixed Settings drawer responsive ownership so coarse/tablet layouts stack setting copy above controls instead of collapsing descriptions into a narrow column; Display remains four-up on tablet and becomes two-by-two on narrow phones.
- Restored the trainer session-state contract so Start practice actually disappears while a session is active, removing the duplicated Start + Pause/End control stack and the extra vertical gap it created.
- Preserved the Pause button SVG/label structure when session state resets, preventing the pause icon from disappearing after start/end/retry transitions.
- Rebalanced the Atlas returning-user hero by reducing unnecessary viewport-height spacing, headline scale, card padding, and left/right imbalance while retaining the constellation identity and Continue Studying hierarchy.
- Rechecked the new Word Bank, Focus mode, Profile, Kana, and Results responsive patterns; no competing layout owner was found in those areas, so they remain behaviorally unchanged.

## 2.31.0 - 2026-08-14
- Introduced the first full visual-standardisation release: shared icons, page-introduction/setting/status/progress/trend/skeleton primitives, semantic UI tokens, and consistent utility controls now form one reusable visual vocabulary.
- Reworked Profile and Settings around their real jobs: Profile now owns account/sync/achievement information only, while Settings uses conventional preference rows with secondary Data & app actions instead of duplicating navigation or presenting every control at equal visual weight.
- Refocused Reading and Writing around active practice with a compact session HUD, Daily/Test progress bar, quieter skip action, Practice setup terminology, and intentional Focus mode while preserving every existing trainer controller ID and behavioural contract.
- Reframed Atlas as a returning-user study home with a Continue studying recommendation/status area, calmer branch discovery, retained constellation identity, and clearer future Reading Comprehension naming.
- Improved the Kana hub hierarchy without duplicating its existing mastery logic: Continue practice and the recommended next step are visually dominant, secondary surfaces are quieter, and dynamic dashboard regions use lightweight skeleton states.
- Added actionable Results guidance and a recent formal-test trend, plus a desktop master/detail layout so weak kana/rows lead directly back into focused Reading or Writing practice.
- Reworked Word Bank around the saved collection rather than the add form: library/search/sort/filter now lead the page, quick capture sits in a secondary rail, backup/destructive tools are disclosed on demand, and saved-word rows emphasise kana, meaning, and romaji with compact icon actions.
- Kept cloud sync, save formats, Service Worker/version checking, and core trainer scoring/SRS behaviour outside this visual release; UI changes consume the existing data owners instead of creating competing systems.

## 2.30.0 - 2026-08-14
- Centralized public-page JS/CSS dependency ownership in one build-time manifest, preserving each page's existing load order while eliminating hand-maintained shared stacks from individual HTML files.
- Made the early loading-screen markup a build-time shared component so every public page receives the same static loader without adding a runtime fragment request or changing loader timing.
- Generated the five legacy compatibility redirect documents from one destination map, preserving query/hash forwarding while removing five hand-maintained copies of the same redirect implementation.
- Added explicit build markers and regression/audit guards for dependency regions, required ordering, loader ownership, redirect generation, and future-release determinism. Runtime trainer, cloud, storage, Service Worker/update, and visual behaviour are unchanged.

## 2.29.0 - 2026-08-14
- Established the UI foundation for the next standardisation pass: canonical page geometry, typography, semantic accent, page-background, spacing, radius, and responsive tokens now live in the shared theme owner.
- Rebuilt the shared page stylesheet around document behaviour, typography, loader presentation, and small utilities only; removed duplicate backgrounds, stale navigation/profile selectors, duplicated responsive ownership, empty remnants, and the accidental global `--ma-radius-lg` override.
- Made the responsive stylesheet the single shared owner of display-mode/page-frame gutters while leaving page-internal grids with their page styles, and added shared `ma-page-frame`, `ma-page-hero`, `ma-page-section`, and page-stack composition primitives.
- Migrated Atlas, Kana, Results, Word Bank, navigation, shared modals, and key trainer status presentation toward semantic theme tokens; removed page-local legacy root palettes and Arial overrides, and moved light-mode page backgrounds onto semantic body classes.
- Tokenised Word Bank and the shared structural/component/modal/navigation layers so they no longer carry literal colours, while preserving page-specific data visualisation colours and trainer behaviour.
- Added regression and release-audit guards for token ownership, retired selectors, page-frame semantics, responsive boundaries, shared typography, and structural colour ownership. Backend, cloud sync, update/version behaviour, save formats, and trainer logic are unchanged.

## 2.28.0 - 2026-08-14
- Completed a full-project ownership, dead-code, lifecycle, accessibility, CSS, build-tooling, and runtime-efficiency audit from the stable 2.27.0 baseline.
- Fixed an unreachable release-audit guard, retired the duplicate GitHub workflow that independently rewrote `CHANGELOG.md`, and moved Visit Flow developer actions into the current Dev Diagnostics owner, eliminating a whole-document observer that was waiting for deleted UI.
- Removed production MutationObservers from the sound system in favour of explicit trainer/toast/session event boundaries, canonicalised sound preference storage to `modeAtlasSound`, and retained read-only migration from legacy sound keys.
- Added shared Profile/Settings drawer focus trapping and focus return, removed obsolete profile/page-state/loader/import compatibility globals and lifecycle owners, and removed verified dead runtime helpers.
- Corrected duplicate/stale CSS ownership including the light-theme drawer selector, trainer preset styling in Achievements, obsolete developer-panel rules, redundant responsive globals, empty page token blocks, and an unclosed Results mobile media block.
- Added accessible names to Reading/Writing answer inputs and updated browser smoke specifications for current drawers, Word Bank Add, cross-page theme persistence, heatmap/modifiers, and Pause.
- Strengthened the release audit so these ownership, accessibility, and canonical CSS-structure regressions cannot silently return; cloud sync, update/version, save-schema, and storage-boundary behaviour remain otherwise unchanged.

## 2.27.0 - 2026-08-13
- Consolidated Kana, Results, and Word Bank page-level cards, stats, pills, action rows, section headers, kickers, and empty states onto the shared Mode Atlas component primitives.
- Made the shared button primitive variable-driven for page-specific height, padding, radius, weight, border-hover, and hover-transform customisation without duplicating button mechanics.
- Migrated Kana hub actions, mastery/next/preset/record surfaces and headers to shared card/button/action primitives while keeping Kana data and mastery behaviour unchanged.
- Migrated Results hero/detail/stat/tag/row cards and dynamic result tiles onto shared surfaces and removed dead Results summary-row UI ownership.
- Simplified Word Bank page CSS around shared stat, pill, card, form, action, and empty-state ownership while preserving the fixed Add Word flow and storage/cloud behaviour.
- Added regression coverage that prevents these three pages from reintroducing local ownership of the shared page UI mechanics.

## 2.26.0 - 2026-08-13
- Completed the post-trainer-consolidation audit and fixed the remaining Pause overlay target so paused sessions mount their overlay on the shared trainer card.
- Moved Pause/session presentation out of the Achievements stylesheet and into the shared trainer stylesheet, restoring one visual owner per feature.
- Converted runtime modifier controls to real shared button elements and migrated generated empty-state cards/actions plus developer controls onto the shared card/button primitives.
- Removed obsolete app-polish, legacy display/save/settings control CSS, dead pre-shared modal rules, and the old display-button compatibility selector.
- Removed the temporary public feature-harness page used during dialog consolidation and added release guards preventing development harness pages from shipping.
- Updated browser smoke coverage to the current shared dialog shell and added regression guards for critical trainer IDs, heatmap/modifier mechanics, and Pause overlay ownership.

## 2.25.1 - 2026-08-13
- Fixed trainer-shell consolidation regressions in Reading and Writing.
- Restored score/history row layout, heatmap colour tokens and clickable detail popup geometry.
- Normalised Time Trial, Combo Kana and heatmap popup visibility to the shared HTML `hidden` state contract.
- Restored the modifiers tray as a fixed bottom control and removed the inappropriate card-surface class.
- Side panels now clear the sticky navigation on desktop and revert to in-flow panels on tablet/phone.
- Corrected shared-trainer selector specificity so responsive layouts are no longer overridden by desktop base rules.

## 2.25.0
- Added one build-time Reading/Writing trainer shell source so shared score strips, session controls, score panels, trial controls and modifier structure are no longer duplicated across both HTML pages.
- Migrated trainer buttons, inputs, score pills, cards and panel surfaces onto shared Mode Atlas component primitives while preserving Reading/Writing accent variants.
- Consolidated duplicated Reading/Writing shell CSS into mode-atlas-study-shared.css; page CSS now owns only mode-specific tokens and Writing-only answer-choice presentation.
- Added frontend audit/regression guards preventing duplicated trainer HTML/CSS ownership from returning.

## 2.24.1
- Fixed Appearance persistence across page navigation by applying the saved Dark / Light / System preference in the head bootstrap before CSS paints.
- Theme controller now falls back directly to localStorage until the shared storage module is available and reapplies changes from other tabs.

# Mode Atlas 2.23.0

- Added shared Card, Field/Input/Select/Textarea, Checkbox, and generic Drawer primitives to the frontend design system.
- Migrated Profile/Settings drawer shells and card surfaces onto the shared primitives instead of maintaining separate profile/settings surface ownership.
- Migrated Word Bank static and dynamically generated controls/cards onto shared form/card primitives and removed its duplicate global input/select/textarea styling.
- Extended the shared dialog owner with feature-content mode and moved Kana guide, mastery help, and Daily Challenge history onto that single modal/backdrop/focus owner.
- Moved onboarding/Welcome Back presentation out of runtime-injected JavaScript CSS and into the normal shared stylesheet pipeline; visit-flow actions/panels now consume shared UI primitives.
- Added frontend audit/regression rules preventing reintroduction of duplicate Kana modal shells, runtime visit-flow CSS injection, page-local Word Bank form ownership, and split Profile/Settings drawer shells.

# Mode Atlas 2.22.3

- Fixed Word Bank Add Word native form submission causing page reloads and `?kana_word=` URLs before the page controller was ready.
- Word Bank Add is now fully JavaScript-owned with a normal button, composition-safe Enter handling, and an initially disabled control that is enabled only after bindings are installed.
- Moved the Word Bank page controller earlier in the page's deferred script order so basic input ownership is not delayed by cloud/profile modules.

# Changelog

## 2.41.0 — Atlas Level & Account Progression

- Added one shared `ModeAtlasProgress` owner for account-wide semantic learning progress and Atlas Level XP.
- Correct Reading/Writing kana award progression centrally; official Daily Challenge completions and formal Test Mode completions award one-time bonuses.
- Existing trainer history seeds a one-time baseline so established learners do not restart at zero.
- Progress uses per-device monotonic counters plus mergeable one-time events so cloud sync can combine activity without last-write-losing XP.
- Profile now presents Atlas Level, XP progress, Reading/Writing correct-kana activity, achievements, and sync without adding progression clutter to Atlas or Kana.

## 2.22.1
- Fixed a cloud-sync race where a Firestore read started before a local edit could later overwrite that newer Word Bank/progress change using a stale captured section timestamp.
- Cloud sync now re-reads each live local section after the Firestore read returns and before deciding whether remote data is newer.
- Word Bank persistence now writes local data before stamping/scheduling cloud sync, reports success only after persistence succeeds, and leaves input intact on local-save failure.
- Added backend regression coverage for in-flight sync/local-edit races and frontend regression coverage for Word Bank Add persistence.

## 2.22.0
- Added one shared Mode Atlas dialog owner for destructive confirmations and blocking information, with Escape/backdrop handling, focus trapping, focus return, and shared button styling.
- Added a shared feedback facade defining Dialog vs Toast vs Inline Status behavior and migrated save/reset/import, Word Bank, cloud sign-in, Repair, and update status onto those primitives.
- Removed all remaining native runtime alert()/confirm() calls.
- Removed the obsolete Reading/Writing trainer Import/Reset modal and its duplicate page/controller/modifier-menu save ownership; Settings is now the sole app save-management UI.
- Moved the save/import status into the shared Settings drawer and migrated the import preview onto the shared dialog shell.
- Migrated Word Bank controls and inline feedback to shared button/status primitives and shared destructive dialogs.
- Removed duplicate Achievement and Writing toast implementations so transient notifications have one owner.
- Added frontend audit/regression rules preventing native prompts, duplicate trainer save UI, duplicate toast creation, and missing shared feedback/dialog dependencies.

## 2.21.2
- Fixed the Settings sound-mode state owner so On/Loud/Off persist and refresh correctly instead of failing on an out-of-scope storage reference.
- Removed Word Bank's remaining extra top spacing above the shared navigation.
- Returned the hidden-trainer Show navigation handle to the bottom-right safe-area position while keeping it above the modifiers overlay.

## 2.21.1
- Normalized shared navigation top spacing on Kana, Reading, Writing, and Results so page frame padding no longer adds a second top gap.
- Fixed Settings sound controls by giving the global sound module one direct, idempotent binding owner for On/Loud/Off.
- Moved the hidden-trainer Show navigation control above the modifiers overlay and into the top utility layer.

## 2.21.0
- Introduced the first shared frontend foundation: central spacing/radius/control/motion tokens plus semantic Button, Inline Status, Surface, Pill, and Toast primitives.
- Replaced the Atlas, Kana, Reading, Writing, Results, Word Bank, Privacy, and Terms navigation copies with one build-time navigation component source while keeping shipped HTML static and accessible.
- Moved Profile and Settings actions into the shared navigation parent; drawer bindings now only own drawer behaviour and no longer manufacture page-specific Settings controls.
- Removed the obsolete Atlas-only profile/cloud binding module so the shared Profile drawer binding is the single profile/avatar behaviour owner on every app page.
- Consolidated navigation styling into one canonical stylesheet and removed the old topbar/branch-nav/study-nav selector owners instead of overriding them.
- Standardized toast feedback to success/info/warning/error semantics with legacy alias normalization and ARIA live/status behaviour.
- Migrated shared Profile/Settings controls onto the new button/status primitives and centralized duplicated theme/font tokens.
- Added frontend regression tests and release-audit rules for shared navigation, drawer ownership, toast semantics, legacy selector removal, and future revision generation.

## 2.20.21
- Added one authoritative Mode Atlas browser-storage inventory with separate reset/runtime and backup/import boundaries.
- Replaced origin-wide localStorage/sessionStorage clearing with scoped Mode Atlas reset so unrelated same-origin data survives Reset.
- Backup export now includes only explicitly registered Mode Atlas backup keys rather than heuristic/prefix-matched origin storage.
- Emergency import fallback now accepts only registered backup keys and ignores unknown or unrelated keys.
- Added backend regression coverage for scoped reset, backup filtering, import whitelisting, and unrelated origin storage preservation.

## 2.20.20
- Fixed Settings → Repair save data when the shared Settings drawer is mounted after the save-repair module.
- Repair now uses one delegated document-level action owner, so dynamically mounted/re-mounted Settings drawers cannot miss or duplicate the handler.
- Manual repair still syncs to cloud only when the repair actually changes save data.

## 2.20.19
- Made `ModeAtlasKanaData` the single canonical kana inventory owner (240 kana) and moved Kana Metrics/Achievements to consume the same collections and mastery rules.
- Replaced per-page automatic save repair with explicit save-schema migrations; clean page loads no longer schedule cloud sync, while genuine repairs and post-hydration legacy fixes sync once.
- Made Firebase module/setup promises in-flight-only and retryable after transient startup failures, including the reconnect race where online returned while the failed setup was still settling.
- Centralized app version, cache revision, save schema, backup format, cloud snapshot format, and build date in `mode-atlas-version.js`; npm/README metadata now follows the release source.
- Moved formal test result date keys to the shared local-calendar date helper.
- Removed the unused loader compatibility bridge and unused dynamic-module bootstrap code; page-state and achievement lifecycle work is now BFCache/event driven instead of repeating on ordinary focus/pageshow.
- Extended backend tests and release audit rules for canonical kana counts, save-repair sync behavior, Firebase retry recovery, release metadata ownership, and shared dependency order.

## 2.20.18
- Removed obsolete Confusable Kana compatibility modules so trainer-controls.js is the single behavior owner for presets/confusable mode.
- Removed the dormant Results insights module/CSS whose missing metrics dependency meant it never rendered, preserving the current Results UI instead of enabling an unintended frontend change.
- Converted shared Kana metrics to one storage snapshot per calculation pass, eliminating repeated full stats/timing reads in shared mastery helpers.
- Added a shared local calendar-date helper and moved Daily Challenge/Kana streak date keys off UTC-based toISOString dates.
- Trimmed redundant trainer-controls lifecycle reinstalls; initial setup is once-only, pageshow work is BFCache-only, and preset changes only refresh active-state UI.
- Removed dead trainer-setting mutation code from modifier-menu.js so modifier-menu owns rendering while trainer-controls owns behavior.
- Extended the release audit/backend tests to enforce these ownership boundaries and verify snapshot reads plus local calendar dates.

## 2.20.16
- Fixed cloud-sync JSON fallbacks so missing ModeAtlasStorage falls back directly to localStorage instead of recursively calling itself.
- Made cloud UI binding idempotent so profile cloud-status updates cannot stack duplicate sign-in/sign-out listeners.
- Gave Firebase auth restoration sole ownership of initial cloud hydration, closing the slow-auth gap without page-level hydration retries.
- Separated cloud connection/status events from actual cloud save-data changes; Kana, Reading, Writing, Results and Word Bank now refresh only when relevant data is written locally.
- Removed focus/visibility/status-driven trainer hydration and kept BFCache/local UI refreshes local-only.
- Safely retired the destructive one-time clean_urls.py migration and added audit_project.py plus npm audit/release-check commands for future release validation.
- Removed obsolete version constants from the retirement-only Service Worker.
- Serialized Firestore save writes behind one in-flight sync owner and discard stale completions if the signed-in account changes mid-operation.
- Protected manual imports and full resets from overlapping hydration/sync races so authoritative local data cannot be overwritten during those mutations.
- Preserved first-visit/welcome-back decisions by letting visit flows await auth-owned initial hydration without starting their own cloud read.
- Made trainer runtime/import-preview bindings idempotent and removed duplicate initial pageshow boot work; cloud-loaded empty-state cards now add/remove from real data changes.

## 2.20.15
- Fixed cold Atlas → Kana startup stalls by making Firebase setup and cloud hydration single-owner/in-flight-deduplicated.
- Fixed cloud startup deadlines continuing after successful completion and later emitting false timeout/offline states.
- Removed duplicate cloud status dispatches and stopped Import/Export lifecycle events from rebroadcasting global UI refreshes.
- Coalesced Kana dashboard refresh bursts into one render and removed Kana's duplicate explicit hydration request.
- Returned normal internal navigation to clean canonical URLs; build/reload parameters are now used only for explicit update reloads.
- Kept Kana stats automatic: local data renders immediately and a fresh storage snapshot is taken after genuine cloud/BFCache/progress refreshes.

## 2.20.12
- Retired legacy Service Worker registrations/caches with a one-time migration and self-unregistering sw.js.
- Added build-revision document URLs for internal navigation so new builds cannot reuse stale page documents.
- Added BFCache restore handling for the once-per-4am-day version check without polling normal navigation.

## 2.20.11
- Replaced query-string-only JS/CSS cache busting with revisioned asset filenames so old Settings/page scripts cannot be reused under a new build.
- Deferred non-critical shared/page scripts while preserving execution order, so the first cold navigation no longer waits on sequential cloud/profile/achievement/script downloads before the page can render.
- Simplified automatic update checking to one successful 4am-day flag plus a per-session attempt guard; Settings and browser reload remain explicit retry paths.
- Kept Service Worker update/fetch logic out of Settings and normal navigation.

## 2.20.10
- Removed automatic Service Worker registration from normal page startup so SW lifecycle work cannot race page-to-page navigation.
- Automatic deployed-version checks now skip same-origin internal navigation and back/forward navigation entirely.
- A direct/external app entry checks only when the current reset-day flag is missing; a page reload forces a no-store version-file check.
- Settings checks always perform a fresh no-store version-file read after the previous check completes; only genuinely overlapping requests are deduplicated.


## 2.20.09
- Centralized deployed-version reads in one version-file checker shared by the 4am check and Settings.
- Deduplicated overlapping/repeat version checks and added a hard Promise deadline so the Settings control cannot remain stuck on Checking.
- Deferred Service Worker registration until after page load and limited it to once per build revision per tab session.
- Removed the progress cursor from the disabled Check for updates button.
- Restored single loader ownership: early-loader owns hide timing; loader.js is now only a compatibility bridge and no longer writes sync state.
- Revised local JS/CSS asset URLs to assets-2.20.09.

All notable changes to this project will be documented here.

## Versioning
- vX.0 = Major feature release
- vX.1 = Minor feature or improvement
- vX.1.1 = Bugfix/patch

---

## v2.0.2
### Fixed
- Fixed an issue with a broken file

### Changed
- Redefined versioning structure

---

## v2.0.1
### Fixed
- Corrected an issue where the wrong file was uploaded

---

## v2.0
### Added
- Score list for Combo Kana mode

### Improved
- Refactored and tightened code for better maintainability

### Fixed
- Fixed Combo Kana mode to function correctly

---

## v1.9
### Fixed
- Fixed a bug that caused Combo Kana mode to break

---

## v1.8
### Added
- Combo Kana mode

### Removed
- Only Mistakes mode (removed due to overlap and redundancy)

---

## v1.7
### Improved
- Moved Time Trials to the correct position in the menu
- Improved clarity of time units in Time Trials mode
- Updated page naming for better consistency

### Fixed
- Corrected ranking order in scores

---

## v1.6
### Added
- Time Trials mode (challenge users with time limits)
- Scores tab for tracking mode performance

### Fixed
- Menu overlap issues
- Scroll bar issues
- Prevented toggling modes during an active session

---

## v1.5
### Added
- Katakana row practice mode

### Fixed
- Additional menu formatting improvements

---

## v1.4
### Added
- Improved scoring system for Endless mode
- Reworked menu options for better usability

### Fixed
- Layout issues

---

## v1.3
### Added
- Endless mode (continuous learning without stop/start interruptions)
- Displays correct Hiragana when an answer is wrong

### Fixed
- Text centering issues
- Time measurement units
