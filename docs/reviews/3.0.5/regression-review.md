# 3.0.5 regression review

Baseline: **2.121.0**, `a1c0c238600fc3d68307c9358dfcd8fad327f9e1`, after the
approved design overhaul. Regressed release: **3.0.4**, `e9a4a64`.
The user's four Duo screenshots supplied the short/wide and tall-window cases.

## Findings and corrections

| Finding | Evidence / cause | Correction |
| --- | --- | --- |
| Dock and web destinations reverted to older utility art | `b925f31` replaced `nav-learn/progress/friends/shop` with `book/chart/people/shop` in the native chrome and HTML generator. The SVG illustrations were never removed. | Restore the approved symbol choices in both owners; assert the actual rendered `<use>` targets on web and native. |
| Assistant-authored documentation treated the change as approved | `docs/visual-language.md` introduced a monochrome destination rule in 3.0.2. The PDF ledger repeated it. | Correct both records. Preserve monochrome utility icons, illustrated destinations and the existing brand mark. |
| Tall inner practice had misplaced columns and excessive empty space | The 3.0.4 container query considered only width. A scroll call cannot create space above a card at scroll position zero. | Native CSS composes the task from usable height; two columns require a wide window and sufficient content width. Tall windows stack. Remove native delayed-scroll ownership from the shared session controls. |
| A generic trainer grid constrained width | The shared `.app-shell` grid retained an intrinsic 640px track when native composition became a grid. | Native trainer declares its single `minmax(0,1fr)` track. The wide card occupies the available area, with a bounded answer field. |
| Kana's Start/Adjust sat too far down short windows | Desktop-sized section navigation, heading and session artwork accumulated vertical space. | Compact the existing navigation and Kana spacing only in short native windows; keep normal text and touch targets. |
| Exit focus sat at the left of the bottom dock | A grid alignment declaration was being applied to a block container. | Centre the existing control in its actual container; verify its position with the Recall layouts. |
| Kana Start opened another setup screen | `openSession()` persisted the selected settings but navigated without a start intent. | A consumed `start=1` intent activates the existing trainer once. Mixed direction and configuration remain intact. An existing checkpoint still presents recovery. |
| Home retained the outer width after expansion | Its old phone display-mode selector capped `.atlas-home` at 680px, preventing the native content query from reaching its wide composition. | Native Home explicitly takes its available width. Test outer-to-inner expansion with the personal overview visible. |
| Xcode window/theme changed across handovers | 3.0.4 created a timestamped worktree, omitted ignored workspace user state and opened the highest detected Xcode. Apple confirms Xcode 27 supports workspace-specific themes. | Keep the same project path and user data, back up project/theme files, preserve local changes, validate the selected Xcode without choosing a different one, and do not launch/resize the IDE. Global preference deletion was not found; the Mac's actual preference state is unverified. |

Source owners remain the existing page/style/generator modules; generated release
assets come from the existing build pipeline.

## Source comparison and retained work

The [source comparison](source-comparison.json) enumerates all **38** presentation
owners changed between the baseline and 3.0.4, plus the HTML generator. It also
records hashes for **24 unchanged identity assets/owners**, including web/native
theme tokens, fonts, brand assets, branch illustrations and avatar artwork. All
four illustrated destination symbols match the baseline. The only changed shared
SVG symbol is the requested flame correction, which is retained.

| Owners checked | Decision |
| --- | --- |
| Native chrome, navigation generator, visual-language record | Correct the icon selection and documentation regression; retain measured safe areas, labelled dock targets, occlusion handling and left/right/bottom adaptation. |
| Home CSS/page, branch library, shared branch components | Retain progressive new/starting/building/returning presentation and shared illustrations. Fix the native width cap. No palette or font rollback found. |
| Learn hub CSS/page | Retain the branch directory and removal of duplicated teaching/routine explanations. This follows the user's Home/Learn/Kana roles. |
| Kana CSS/page, practice and mastery presentation | Retain the course, progressive controls, full-path destination, skill separation and selected-row behavior. Correct short-window spacing and the duplicated Start step. |
| Reading/Recall page owners, shared study CSS, session controls | Retain shared scoring, server-issued prompts, independent skill saving, long-prompt sizing, mixed-choice correction and keyboard sizing. Correct native composition without adding another trainer engine. |
| Kana results page | Retain compact skill/outcome guidance and actual missed-character recommendations. No visual identity replacement found. |
| Kanji CSS/page, lesson, mastery, results | Retain corrected nested columns, contextual examples, reading/meaning separation, recent-readiness details and compact result rows. No illustration or palette substitution found. |
| Handwriting CSS/UI | Retain safe-area-aware dialog placement, larger wide drawing board, resizing without erasing strokes and large-text reflow. |
| Word Bank CSS/page, new word lessons, word review, pronunciation | Retain progressive empty/populated presentation, lesson/checkpoint flows, separate review skills and audio handling. Existing card/type tokens remain shared. |
| Profile/account bindings, navigation, portrait and profile menu | Retain deferred loading, account overlay order, first-use disclosure and additional learning totals. Avatar artwork is unchanged. |
| Avatar editor, rewards UI, Settings, Shop | Retain availability/category filters, direct appearance settings, learning backup controls and first-use rewards entry. Collection artwork and coin-purchase placeholders remain. |
| Social UI | The change requires recent sign-in for moderator assignment. It is an authorized security change, not a visual reversion; retain it. |
| Native theme/web theme, font owners, brand/illustration/collection artwork | Identity hashes match the approved baseline where compared; do not replace these assets. Existing collection appearance tests remain in the regression gate. |

No evidence of a whole-app checkout rollback was found. The specific artwork
substitution and incomplete responsive composition caused the reported regression;
reverting all 3.0 work would also discard requested learning and first-use fixes.

## Render and behavior review

The route matrix covers Home, Learn, Kana entry/path/practice/mastery/tests,
Handwriting, Read, Recall, Kanji, both results pages, Progress, Word Bank, Friends,
Shop, sources, Privacy and Terms. It checks document overflow and nested text
overflow at outer, wide inner and tall inner window proportions. Rendered screens
were inspected alongside the assertions. Friends uses its offline/account error
state in these isolated fixtures; this is not a production signed-in social audit.

Focused practice checks cover Light/Dark, setup, running, pause/resume, feedback,
recap, Daily/Test/timed/Endless, eight Recall choices, long sequences, mixed input,
keyboard visibility, all session actions, and folding while preserving an answer.
Portrait checks assert prompt-before-answer composition and placement within the
available vertical area. Home expansion asserts side-by-side overview and branch
visibility. Existing suites cover first use, collection themes, account sheets,
settings, phone/tablet behavior and learning/recovery journeys.

The local broad run found one stale test expecting a minimum 58px keyboard key
instead of the already-approved responsive 44–60px range. The assertion now checks
that range. The direct-start flow tests now assert an active session instead of
expecting a second Start button. No failures were removed by skipping tests.

A separate Home scroll assertion initially measured the old document height before
fonts/resize layout settled. Waiting for those conditions passed six repeat checks.
The final Exit focus alignment passed six additional cases.

Exact final results and screenshot paths are recorded in [evidence.json](evidence.json).
The dimensions are browser stress fixtures, not hardware specifications. Native
compilation is reported separately by GitHub CI; device occlusion behavior,
VoiceOver and the user's actual Xcode window/theme still need the Mac/device to
observe. No browser result is described as physical-device acceptance.
