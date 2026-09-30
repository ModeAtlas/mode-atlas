# Practice and progression — 2.73.0

Shared Reading/Writing learning behaviour applies to the website and iOS. Native focus, haptics, short question motion and alternate app icons are gated by the existing platform boundary. The website palette is unchanged. No new runtime dependency or entitlement is required.

## Learning routine

A guided set retains its question goal, correction panel and deliberate Continue after a mistake. With other eligible kana available, a missed kana returns after three intervening questions. A single-kana follow-up can still repeat that kana. The short correction queue and long-term recall schedule have distinct responsibilities under the same session coordinator.

Recall schedules now progress through ten minutes, one day, three days, one week, two weeks, one month, two months and three months after independent correct answers when due. A mistake schedules a one-minute revisit and resets the interval. Early repeats do not accelerate the schedule. Showing a hint counts as assistance and cannot promote mastery or earn a spaced-recall bonus.

Each direction has its own latest twelve recall outcomes, up to eight successful local dates, current interval and highest milestone. Reviewing requires four independent outcomes, at least 75% accuracy, two successful days and interval stage two. Mastered requires eight independent outcomes, at least 90% accuracy, four days and interval stage four. These are product rules to evaluate through use, not claims of a clinically validated retention model.

Previously earned mastery is visible until new recall evidence is collected; its highest milestone remains retained. The legacy peak is captured before a new answer changes counts or timing averages. Current confidence can fall after mistakes. Combined mastery requires both directions; a single practised direction reaches at most Reviewing in the combined map. Detailed mastery shows Reading and Writing separately. Existing achievement acknowledgements are not reset.

Due reviews appear in the home recommendation and Your Atlas. They can include previously learned kana outside current setup rows without modifying those row selections. The existing answer-map owner resolves those kana in both directions.

## XP policy

| Activity | New reward | Limit or qualification |
| --- | --- | --- |
| Correct kana | 2 XP per canonical kana unit | Historical counters retain their original 1 XP weight; new answers add a separate 1 XP credit |
| Guided completion | 5 / 10 / 15 XP | 10 / 20 / 30 answers; complete the set |
| Accuracy | 5 / 10 / 15 XP | 80 / 90 / 100%; completed finite run with no hints |
| Best answer streak | 5 / 10 / 15 XP | 10 / 25 / 50; highest tier once per run; no hints |
| Daily completion | 10 XP plus accuracy | Maximum reward per direction and local day; better replays can earn only the difference |
| Formal test | 10–30 XP plus accuracy | Scope increases every 50 distinct kana, capped at 30; same daily cap/top-up rule |
| Independent due recall | 2 XP | Five distinct due kana per direction/day, at least twelve hours since previous encounter |
| New Reviewing / Mastered milestone | 10 / 25 XP | Once per kana, direction and stage |
| Daily goals | 10 XP each | 20 correct; five Reading + five Writing; five distinct due recalls |
| Weekly goal | 25 XP | Five correct on each of four days, Monday–Sunday |

Completion, accuracy and streak bonuses require at least ten answers, three distinct kana and 25% accuracy. Stopping a set does not award finite completion/accuracy. Answers and achieved streak rewards still count. A guided session's XP total is the sum of its own award breakdown, not a difference in global XP affected by cloud changes.

New next-level cost is `min(800, 100 + 25 × (level − 1))`; the old slope was 50 with no cap. Stored XP, correct-answer totals, legacy completion events and developer adjustments are preserved exactly. For every XP total, the new level is the same or higher. An existing account may gain levels immediately because the curve changed.

| Level | Cumulative XP required |
| --- | ---: |
| 2 | 100 |
| 5 | 550 |
| 10 | 1,800 |
| 20 | 6,175 |
| 35 | 17,050 |
| 50 | 29,050 |

For calibration, a perfect unassisted ten-question set covering at least three kana earns 45 XP before review/mastery/goals. Two such sets earn 100 XP including the 20-correct daily goal. This makes the first level attainable in a short routine without repeating introductory levels for days. Real usage should inform later balancing; the current release is an initial policy, not a final economy.

A study streak counts days with at least five correct answers across both directions. Recorded historical Daily Challenges and completed formal tests also count. Yesterday's streak remains available until the current day ends. Profile, Kana and widgets consume this same owner.

## Rewards

Your Atlas is available from Profile and the session summary. Levels 1, 5, 10, 20, 35 and 50 reveal collection landmarks with profile titles and frames. Levels 5, 20 and 50 also unlock Grove, Summit and Horizon app icons on iOS. Selection is cosmetic; no practice mode or essential learning option is locked. Profile appearance syncs; the chosen Home Screen app icon remains a device preference managed by UIKit.

The icons use one outlined Noto Sans JP brand mark with palette variants. Source previews live in `assets/rewards`; compiled catalogues live in `ios/App/App/Assets.xcassets`. `build_ios_reward_icons.cjs` renders them from the outlined SVG using Playwright. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` if using a system Chromium. The normal release build verifies the committed catalogues; it does not recreate raster icons. Xcode's catalogue compiler generates alternate-icon metadata, and CI inspects the built product.

## Recovery and save compatibility

Guided sets have one local checkpoint per direction, expiring after seven days. Resume keeps the run receipt, answers, XP breakdown, active elapsed time and follow-up queue. Answered questions are not awarded twice. If the final answer was committed before the completion UI appeared, resuming finalizes the run once. Timed and ranked tests are intentionally not checkpointed. Checkpoints are account-bound and excluded from cloud snapshots and exported backups.

The storage owner uses a synchronous write-ahead journal for answer statistics, review evidence, XP and checkpoint writes. It replays an interrupted commit before progression loads. Run receipts are capped at 64 without trimming lifetime counters. Account switches invalidate checkpoint reuse. A manual import that replaces the run ledger also makes incompatible checkpoints ineligible.

Progress state v3 retains v1/v2 fields and adds per-device additive credits, semantic max-value claims, activity, run receipts and appearance. The merge owner reconciles goals after combining offline activity. Outgoing sync and hydration both use semantic progression merging; recall evidence unions while the newest answer chooses the schedule. Recall histories use objects inside arrays because Firestore does not support directly nested arrays. Existing timestamp-based policies for other save sections remain unchanged.

Manual imports remain authoritative and explicitly normalize missing v3 fields to empty. Reset writes a complete empty state before clearing local data. A build older than this release does not understand the new reward policy: update both web and iOS before expecting identical XP presentations. No production website deployment or main-branch merge is included here.

Activity/claim history grows by day and milestone rather than by every answer. Recall evidence and run receipts are bounded; the overall cloud document still contains existing result/history records and is not infinitely bounded. Cloud-document budget monitoring remains a pre-publication task as historical data grows.

## Source ownership

| Responsibility | Owner |
| --- | --- |
| Recall intervals, confidence and evidence merge | `assets/app/mode-atlas-review.js` |
| XP policy and cosmetic milestone catalogue | `assets/app/mode-atlas-reward-rules.js` |
| Durable XP, levels, claims, activity, appearance and semantic merge | `assets/app/mode-atlas-progress.js` |
| Atomic local answer commit | `assets/app/mode-atlas-storage.js` |
| Guided checkpoint validation and Resume/Discard UI | `assets/trainer/mode-atlas-session-recovery.js` |
| Answer coordination, retry queue and completion UI | `assets/trainer/mode-atlas-study-session.js` |
| Trainer persistence and page lifecycle | `assets/trainer/mode-atlas-trainer-controller.js` |
| Native haptic policy and question motion | `assets/app/mode-atlas-feedback.js` |
| Temporary focus and manual preference | `assets/ui/mode-atlas-study-nav-hidden.js` |
| Goals/collection/title/frame interface | `assets/ui/mode-atlas-rewards-ui.js` |
| Session XP/level presentation | `assets/app/mode-atlas-progress-ui.js` |
| Native icon API | Existing platform facade → native adapter → `ModeAtlasNativePlugin.swift` |

Superseded per-page answer XP calls, legacy Daily/Test reward calls, old SRS mutation functions and Writing immediate-repeat variables were removed. Generated documents and revisioned assets come from `frontend_components.py` and the existing release builders; no runtime wrappers replace controllers.

## Validation and device follow-up

Automated checks cover legacy XP/levels, idempotent awards, completion caps, offline merges, Firebase-compatible payloads, import/reset, recall intervals and confidence, bounded receipts, journal recovery, both-direction guided resumption, final-answer recovery, delayed retries, due kana outside setup, account boundaries, cosmetic selection, large text, haptic preference and Reduce Motion. The broader trainer, theme, shell and smoke suites remain release gates. Native CI compiles the iPhone/iPad target and validates icon metadata.

On a physical phone verify the feel of answer/completion haptics, suspend/relaunch a partially completed guided set, complete a set that crosses a level, and change/reset an unlocked Home Screen icon. UIKit icon prompts and real haptic quality cannot be validated by browser emulation. The tutorial, pronunciation scoring and handwriting recognition remain later work.
