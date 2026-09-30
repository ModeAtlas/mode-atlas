# Guided practice and learning routine — 2.71.0

This release makes an existing Kana session a coherent small activity: a suggested
next step, a bounded set, teaching after mistakes, and an actionable finish.
It is shared by the website and the locally bundled iOS app.

## Behaviour

- Atlas recommends a ten-question Reading or Writing set from the user's selected
  kana and saved per-mode answer counts. Four or more attempts, at least two
  mistakes and accuracy below 80% make a kana eligible for the difficulty cue.
  Unseen kana are not labelled weak. The recommended set captures those difficult
  kana at session start so its focus stays stable. Recommendations explain their reason; they
  do not claim a retention score, calendar review schedule or unfinished session.
- A fresh Reading recommendation uses the existing Starter preset. Experienced
  users keep their selected rows. Reading-heavy practice can suggest Writing.
- Reading/Writing setup offers Free practice or 10, 20 and 30 questions. Guided
  goals are mutually exclusive with Daily Challenge, Test Mode, timed, Endless
  and Combo modes. Those modes keep their existing rules.
- Guided mistakes and “I don’t know” answers save once through the existing
  answer path, then stop on a teaching panel until Continue. A correct answer
  keeps the quick feedback. Pausing/backgrounding does not dismiss teaching.
- Recognition notes compare seven easily confused kana pairs. Other kana show
  their reading with a short study prompt; joined kana stay together.
- Completion shows answered count, correct answers, accuracy, unique kana and
  earned XP. Stopping early still preserves scored answers. “Practise these
  kana” starts a ten-question set restricted to that session's mistakes.
- The iOS keyboard gives its space to the teaching panel and returns with the
  next question. Shared semantic colour roles preserve the native palette and
  the web theme. No new native plugin, entitlement or dependency is needed.

## Ownership

| Responsibility | Source owner |
| --- | --- |
| Canonical kana, readings and selected-row map | `assets/data/mode-atlas-kana-data.js` |
| Pure recommendation, goal and summary policy | `assets/app/mode-atlas-study-plan.js` |
| Original teaching copy | `assets/data/mode-atlas-kana-coaching.js` |
| Transient guided state and its UI | `assets/trainer/mode-atlas-study-session.js`, created by the existing trainer controller |
| Answer evaluation, scoring, SRS, save/cloud and progression | Existing Reading/Writing trainer, trainer core and progress owners |
| Feedback lifetime, locking, pause and cancellation | Existing `mode-atlas-session-controls.js` |
| Shared setup/progress/feedback markup | `frontend_components.py` |
| Shared study presentation | `assets/css/mode-atlas-study-shared.css` |
| Native keyboard and dock geometry | Existing native keyboard/chrome owners |
| Atlas rendering | Existing home-page owner; consumes shared policy |

No function wrapping, duplicate scoring/storage, second modal framework or second
navigation system is introduced. The shared row-map function replaces the trainer's
previous inline implementation so recommendations and questions cannot drift.
Generated revision files and native assets are regenerated from canonical source.
The only persistent addition is the selected `practiceCount` inside existing
per-mode settings. In-flight guided answers and the targeted follow-up list stay
in memory; individual answers persist as usual. No new save schema is required.

Navigation intents are consumed before notifying the UI, so synchronous refreshes
cannot apply the same study/daily/review request again. The skip-feedback call now passes the prompt element required by the feedback
owner. This fixes its existing argument mismatch for guided and ordinary practice.

## Tutorial plan — deliberately later

Build this once the routine and learning screens have settled. Extend the existing
visit/onboarding owner, not a second competing startup flow.

1. A skippable introduction to Atlas and its suggested activity.
2. Highlight the platform's real navigation: the iOS dock or website navigation.
3. Offer the first guided set and demonstrate the answer/Continue interaction.
4. Introduce Results after a completed activity, when real progress exists.
5. Offer account sync contextually, without requiring sign-in to practise.

Use stable semantic targets, not pixel coordinates. Keep step descriptions shared,
with platform-specific targets and wording. Show one tip at a time; respect reduced
motion, large text and VoiceOver. Do not put a popup over an active question or
stack it with legal/setup/sign-in/level dialogs. Route entry through the existing
onboarding owner and existing modal/focus owner. Make the tour replayable from
Help and store a separate versioned completion flag; do not reset existing legal
acceptance, save data or onboarding choices after upgrades. A feature that is not
present (for example paid-team Apple sign-in) must not appear in the tour.

## Follow-on learning work

Longer-term spaced review and Word Bank study remain separate planned work. The
current SRS is an in-session selector, with intervals up to twenty minutes. A real
days/weeks review queue requires a versioned item/event model, deterministic
scheduling, time-zone policy and cloud conflict tests; it must not be simulated by
renaming today's counts “due” or adding another local database.

## Content references and validation

The contrast copy is original. Shape/stroke distinctions were checked against:

- https://www.thejapanesepage.com/katakana-%E3%82%BD-so-%E3%83%B3-n-and-%E3%82%B7-shi-%E3%83%84-tsu-how-to-tell-them-apart/
- https://www.tofugu.com/japanese/learn-katakana/
- https://www.tofugu.com/japanese/learn-hiragana/

Node tests cover selection parity, goals, recommendations, evidence thresholds,
summary deduplication and canonical coaching readings. Browser scenarios cover
real Reading input and Writing choices on web and simulated iOS, finite endings,
pause, manual Continue, skip, early stop, targeted follow-up, save totals, both
native themes and existing special-mode behaviour. The normal release gates also
check source generation, web/native regressions and the Xcode simulator build.
Physical-device VoiceOver, touch comfort and coaching readability still need the
usual device pass; browser simulation cannot prove those.
