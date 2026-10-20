# UI and responsiveness review — 2.113.0

The supplied IMG_0551.PNG was opened directly. This review checks rendered layouts and populated states in addition to the existing automated layout assertions. The earlier empty-account checks missed the main performance problem.

## Routes

| Route | States inspected | Outcome |
| --- | --- | --- |
| Atlas `/` | Guest and 120-day history, full avatar, goals, recommendation, desktop and native phone | Retain composition; remove hidden Shop startup and update dock/navigation art. |
| Learn `/learn/` | Three branches, returning learner recommendation, Results entry | Retain branch art and route structure; faster startup and new navigation symbols. |
| Kana `/kana/` | Beginner, progressed rows, Learn/Practice, path, script/skill controls | Distinct practice-tool pictograms; complete path retained. |
| Read `/reading/` | Setup, active practice, input and result flow | Retain session layout; regression gates cover auto-check/continuation and settings. Shared startup is faster. |
| Recall `/writing/` | Setup, choice/keyboard and result flow | Retain learning tools; shared startup/navigation changes. |
| Handwriting `/kana/handwriting/` | Row/character choices, canvas and feedback | Retain layout and optional progression; new entry pictogram. |
| Kanji `/kanji/` | N5 starter, learning card, reading/audio controls, recall entry | Retain learning composition; shared startup/navigation improvements. |
| Kanji sources `/kanji/sources/` | Native and desktop document layout | Retain readable attribution page and shared navigation. |
| Word Bank `/wordbank/` | Empty and populated saved collection, long notes, search, edit controls | Retain collection/form layout. |
| Kana Results `/results/` | Empty and populated Read/Recall reports and averages | Default to tested kana; preserve unused-character toggle. Remove old light surface/shadow overrides and blur. |
| Kanji Results `/results/kanji/` | Empty view and existing test-result regression flows | Retain shared branch navigation and separate result owner. |
| Progress `/progress/` | Goals, personal-goal editor, Rewards and Recap, populated history | Lazy hidden panels; distinct mastery palette; improved achievement summaries. |
| Friends `/friends/` | Guest, populated list, long-name themed profile with avatar/pet, ranking entry; existing weekly/request regression flows | Simplify back controls, character framing and stat tiles. Preserve themed profiles and relationship controls. |
| Shop `/shop/` | Every category, enlarged item detail, wallet states, light/dark and increased text | Rebuild presentation around artwork, product grids and category controls. |
| Privacy `/privacy/` | Native/desktop text and links | Retain document layout and shared identity. |
| Terms `/terms/` | Native/desktop text and links | Retain document layout and shared identity. |

## Shared surfaces

| Surface | Review and action |
| --- | --- |
| Profile | Account/guest identity, long-name fixture, auth controls, XP and sync information. Existing compact account layout retained; obsolete web light-mode surface rules removed. |
| Settings | Native/web, sound, haptics, display, notifications, scheduling, data and application controls. New source-owned layout, keyboard/focus and large-text checks. |
| Compact Shop | Pinned full-shop link, visible wallet, featured art and items, first-open rendering and subsequent refresh. Reworked alongside full Shop. |
| Rewards | Themes, banners, frames, titles, icons and wardrobe. Controls mount on first selection and remain refreshed when revisited. |
| Avatar/pet editor | Character/photo tabs, name/bio, appearance, wardrobe, pets and save flow. Existing editor preserved. |
| Kana mastery | Populated stages, stage legend, skill markers and character targets. Coral/amber/blue/green/violet distinguish progression without relying on colour alone. |
| Kanji mastery | N5–N1 navigation, counts and character detail. Shared milestone colours replace unrelated branch colours. |
| Achievements | Categories, filters, progress and rank detail. Open summary counters and compact tiles. |
| About, feedback, tours and dialogs | Existing shared dialog, account focus trap, close/reopen and scroll containment. Tour replay remains in Settings. |

## Evidence and limits

The initial visual pass captured 103 route/menu views across 393-pixel native dark, 1440-pixel desktop light and 320-pixel increased-text native light layouts. A separate populated-state pass captured 24 additional views using saved study history, reports, words and social fixtures. These passes found no document-width overflow or page JavaScript exceptions. Detailed follow-up views verify corrected Results, Friends, Settings, Shop, mastery, achievement and practice graphics. Browser regression suites exercise further themes, tablet widths and account/network states.

The full release gate additionally caught a clipped Desktop display option at 320 pixels on web. Settings now declares the shared segmented control's two-column count directly, so later generic component CSS cannot restore three columns. Both affected light/dark route-and-drawer checks pass after the source correction; the existing clipping assertion remains unchanged.

Screenshots were inspected as route/state sheets and detailed views; pass counts alone were not used as design approval. Measured performance before/after is in the release notes. Native browser fixtures are not physical-device tests, and fixture account data is not a claim to have accessed a real user's cloud account. This inventory records the surfaces reviewed; it does not claim every possible account/device combination is defect-free.
