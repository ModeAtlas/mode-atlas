# UI review — Mode Atlas 2.112.0

Reviewed 20 October 2026. Scope: the complete public route inventory and shared menus, using the current app design. The three supplied screenshots were opened directly and used to check Profile density, save status and Progress shortcuts.

## Changes from this review

- **Profile:** replaced nested cards with a banner identity, compact account actions, open level/progress rows and a separate save-status section. Long account names, email addresses and activity counts wrap within their sections. Banner colour no longer affects the account buttons.
- **Kana:** the inline path now contains every row for the selected script and skill. Expandable sound groups, completion counts and current-row markers replace the small preview. Previously unlocked lessons remain reachable.
- **Progress:** personal daily/weekly goals use the existing goal list and shared dialog. Mastery Map, Achievements and recap shortcuts use coordinated illustrations; the navigation symbol now depicts progress. Review links retain their compact branch markers and help control.
- **Mastery:** Confident, Mastered and Mastered+ use cyan, green and violet across the map, legend and detail view, with text labels retained.
- **Shared controls:** form controls inherit the app typeface, including achievement tiles. Settings segments have appropriate horizontal padding so short labels remain readable at increased text sizes.

## Route inventory

All 16 public routes were reviewed. A reviewed surface is not necessarily rewritten: existing components that already use the design are retained, with shared fixes applied through their owners.

| Surface | Review coverage and outcome |
| --- | --- |
| Home `/` | Learning artwork, avatar, practice entry, goals, review/help links and recap. Personal goals appear in the existing compact list. |
| Learn `/learn/` | Branch illustrations, separation and entry links, starting-point card and Results access. Existing design retained. |
| Kana `/kana/` | Learn, Practice, script/skill controls, full inline path, earlier-lesson access, placement and locked rows. Updated path and activity symbols. |
| Read `/reading/` | Setup, active session, feedback, app keyboard, modifiers, row picker and result flow. Existing design retained. |
| Recall `/writing/` | Choice/keyboard inputs, practice settings, feedback and result flow. Existing design retained. |
| Handwriting `/kana/handwriting/` | Character selection, practice canvas and controls. Existing design retained. |
| Kanji `/kanji/` | Level selector, starter set, learning presentation, pronunciation, practice tools and Results links. Shared typography retained. |
| Kanji sources `/kanji/sources/` | Shared identity, text measure, attribution links and readable document layout. |
| Word Bank `/wordbank/` | Add-word entry, summary, search/filter controls, empty and long-entry states. Existing design retained. |
| Kana Results `/results/` | Illustrated empty state, populated reports, filters and practice links. |
| Kanji Results `/results/kanji/` | Illustrated empty state and shared branch switch. Existing result behaviour retained. |
| Progress `/progress/` | Goals, new goal editor, Rewards, Recap and review information. Updated shortcut art and colours. |
| Friends `/friends/` | Guest entry, Friends/Rankings controls, profiles and existing ranking/account regression coverage. Shared navigation icon updated. |
| Shop `/shop/` | Featured view, collections, wardrobe, items and coins; preview/purchase controls covered by existing browser regressions. Shared controls retained. |
| Privacy `/privacy/` | Shared identity, text measure and navigation. |
| Terms `/terms/` | Shared identity, text measure and navigation. |

## Shared surfaces

| Surface | Coverage |
| --- | --- |
| Profile | Guest and account fixtures, account actions, selected banners, progress, save status, long names/email/counts and collection contrast. |
| Settings | Web/native preferences, notifications, data controls and increased text size. |
| Avatar & pet | Appearance, wardrobe/pet navigation, bio/name presentation and existing save/entitlement regressions. |
| Rewards | App themes, banners, frames, titles and app icons; existing selection and entitlement checks retained. |
| Mastery | Kana and Kanji dialogs, stage legend, character details and colour separation. |
| Achievements | Categories, tiles and progress; corrected inherited typography. |
| About/help | Overview, version/save details, tabs, legal links and feedback dialog. |
| Goal editor | Daily/weekly templates and targets, repeat, edit, remove, reload persistence and field labels. |
| Shared dialog/navigation | Account drawer, keyboard focus, native dock clearance, scroll containment and web navigation. |
| Tours and onboarding | Personal goals added to the Progress tour step. Existing optional/replay and starting-point behaviour retained. |

## Evidence and limits

The visual pass captured 111 route/menu views across simulated iOS light/dark, a 320-pixel increased-text layout and 1440-pixel desktop. These captures reported no document-width overflow or page JavaScript errors. They were reviewed as contact sheets and detailed views, with follow-up captures after corrections. Browser layout regressions additionally exercise web/native phone, tablet and desktop sizes, both base themes, long text, account states and collection contrast.

The final release gate validates the exact published commit. Local exploratory runs and their timings are not substituted for that gate. Results and CI links are recorded in the release handoff and PR.

Native layout fixtures simulate the bridge and safe areas; they do not constitute testing on a physical iPhone. A physical listening check remains necessary for the perceived difference between normal and slower pronunciation. Live Firebase deployment is a separate release step, included in the Mac instructions. This review covers the complete route/menu inventory, not every possible combination of account history, network state, entitlement and device setting.
