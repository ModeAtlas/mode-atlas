# Learning redesign: diagnosis and replacement contract

27 October 2026, Melbourne. Reviewed source: `bfc40d8` (3.1.0).
Evidence: all eight supplied screenshots, IMG_0643.PNG–IMG_0650.PNG;
canonical page, curriculum, session, save and test owners; primary research.

**Status:** design review, not an implementation or release handover. No app
code was changed or published during this review. The previous description of
3.1.0 as a complete connected foundations course overstated what was delivered.

## What failed

The implementation preserved the old dashboards and added activities above and
inside them. New lesson steps, counters and links increased the number of
decisions without giving learners a coherent course. The tests established many
useful data and runtime properties, but were treated as evidence of educational
quality and understandable navigation that they did not establish.

### Confirmed problems

| Area | Finding | Canonical source |
| --- | --- | --- |
| Words hierarchy | Add word belongs to the shared hero, so it appears inside the curated course. Three section buttons, two script choices and a skill dropdown precede useful learning. | `wordbank/index.html`; `assets/pages/mode-atlas-wordbank-page.js`; `assets/ui/mode-atlas-vocabulary.js` |
| Words state | Switching sections hides content without updating URL/history. Home can resume the wrong destination. The course does not persist its unfinished set/phase. | Word Bank page; vocabulary UI; `mode-atlas-visit-flows.js` |
| Words contrast | The selected button's inverted colours conflict with the more-specific shared hover background. This is consistent with the dark-on-dark selection in IMG_0643; touch-hover reproduction is still required. | `mode-atlas-wordbank-page.css`; `mode-atlas-components.css` |
| Kana hierarchy | Continue, mixed practice, sound workshop, mastery, two review entries, practice/handwriting cards, placement and full path compete on one page. Practice adds another selector below branch tabs. | `assets/pages/mode-atlas-kana-page.js`, `frontend_components.py` |
| Path navigation | The full-path link performs document navigation and drops current script/skill. Navigation and lesson exit have multiple competing controls. | Kana page |
| Beginner continuation | Guided progression is inferred from absence of a `skill` URL parameter, but the page writes that parameter itself. Reload can disable the balanced course recommendation. | Kana page: `followJourney`, `url`, `startBeginner` |
| Listening | The target is the same character just shown and selected. Choices keep the same order. A learner can repeat the prior answer without distinguishing audio. The listening screen itself does not show a separately marked correct answer; the sequence leaks it. | Kana page: `renderLesson` |
| Instructional depth | Specific shape descriptions cover the ten vowel characters, with a few additional contrasts. Most remaining characters receive generic guidance. Four stages around this content do not constitute a full teaching curriculum. | `assets/data/mode-atlas-kana-coaching.js` |
| Sound patterns | A single English-definition question introduces a broad sound-pattern flag. The lesson never assesses hearing the contrast or applying its spelling. | Kana page: `soundWorkshop` |
| Row completion | Starting on the last character can produce a whole-row completion message without learning earlier characters. A 10-question set cannot supply the minimum 15 independent successes required for a fresh five-character row to become Familiar. | Kana page; `assets/app/mode-atlas-kana-learning.js` |
| Recap | The existing trainer offers generic completion/mistake actions rather than the next course step. The learner has to infer how to advance. | `assets/trainer/mode-atlas-study-session.js` |
| Progress language | “Learned” counts introduced/attempted characters, while Familiar counts stronger evidence. Lesson “Recall” means kana→romaji, whereas other screens use Recall for the reverse direction. | Kana page and learning model |
| Kanji course | A recommendation card sits above the previous mode dashboard. Character ordering is largely introductory ordering followed by stroke count, without authored units and cumulative checkpoints. | Kanji page, lesson and session owners |
| Kanji evidence | Completion can be earned from repeated immediate successes without delayed reviews. Confident-entry access can populate normal practice with characters the recommendation model still considers unseen. | `mode-atlas-kanji-state.js`; `mode-atlas-kanji-session.js` |
| Home goals | Home requests compact goals, but the renderer does not apply the compact host class that its CSS requires. This predates 3.1.0 and should have been caught in the wider review. | Home page; rewards UI; rewards CSS |

Kanji typed recall did not show a verified direct reading-answer leak in this
review. Its problems should not be conflated with the confirmed Kana sequence
defect. Current hints and matching already have some valid evidence separation.

## Replacement information architecture

Preserve the approved illustrated identity, colours, themes and dock. Replace
the learning composition and its navigation. Retain Home as the app/user hub,
Learn as the branch directory and each branch as the owner of its curriculum.

| Surface | Learner's job | Required composition |
| --- | --- | --- |
| Home | Resume and see personal overview | One specific continuation; compact daily progress; broader user overview below. Goals use the canonical shared presentation. |
| Learn | Choose a branch | Kana, Kanji, Words and appropriate other branches. Readiness invitations are concise and optional. |
| Kana / Kanji overview | Continue this course | Current unit, next useful activity and one primary action. Secondary access to the full path and custom practice. No catalogue of every learning mode. |
| Full learning path | Understand progress and choose a unit | A dedicated full-screen view with current/completed/future units, meaningful skill evidence and one clear return. Unit details replace the content of this view; they do not open another stacked modal. |
| Lesson | Learn or answer one task | Compact progress, one teaching/exercise area, one primary action and one exit. Task instructions sit beside the task. The lesson uses the available content rectangle. |
| Custom practice | Deliberately configure a drill | One organised setup surface for content, response type and modifiers. Existing advanced tools remain accessible here. |
| Words hub | Choose course or collection | Exactly two destinations: Learn words and Word Bank. |
| Learn words | Follow curated isolated-word learning | Small next set, clear objective and Continue. No Add word, bank counters or personal-bank settings. |
| Word Bank | Manage and learn saved words | Searchable collection, Add word and contextual Learn these words. Avoid large statistics blocks before the list. |

The path view must open in place and preserve the underlying position and
selection. Browser Back, native Back and explicit return must agree. Navigation
must not infer learner intent from whether a URL parameter happens to exist.

A shared button system must define primary, secondary, selection, disabled,
hover and focus states together. Page-specific overrides must not produce
incompatible pairs of foreground/background colours. Resolve this in canonical
owners and remove superseded compositions; do not add another override layer.

## Replacement learning contract

The proposed default is **guided sessions**, with optional custom drills.
The learner should not have to design the lesson by choosing several modes.
Activity changes should be predictable, grouped where useful, and explicitly
label the answer expected. Mixed practice does not mean arbitrary mode switching.

### Kana

1. Teach a small chunk of a row with specific shape, sound and stroke examples.
   Initially two or three characters is a product starting point, not a
   research-established optimal number.
2. Offer supported discrimination among characters already taught. Optional
   handwriting goes from demonstration to a partial guide and blank attempt.
3. Remove support and revisit items after intervening items. Draw listening
   targets independently of the preceding teaching/answer; do not use a fixed
   answer position or predictable row order.
4. Complete a balanced row check covering the required items and skills. Record
   first attempts, assistance and correction separately. A copied correction
   requires a later independent revisit.
5. Add introduced characters to the practice pool with truthful status. Compose
   mixed reviews from prior rows, recent learning and due items.
6. Insert cumulative checkpoints and sound-pattern units at meaningful points.
   Teach long vowels and small っ through contrasts, audible examples and
   application, rather than an English definition alone.
7. End every session with the actual result and one next action: finish the row,
   repair specific gaps, review, or continue. Finishing a bounded session is
   distinct from demonstrating retention or becoming Mastered.

Audio-unavailable or silent study must not fabricate listening success or impose
a listening penalty. Handwriting remains optional and does not block reading.
Existing introduced/earned/placed records retain their meaning; old timestamps
must not be relabelled as new independent assessment evidence.

The Kana curriculum needs authored teaching coverage across basic hiragana,
katakana, voiced/joined/extended sounds and relevant spelling patterns. A content
audit must reject generic fallback text as the sole teaching for a new row.

### Kanji

Use authored small units with an observable learning goal. Connect shape,
meaning and a focused word's reading and meaning. Highlight components where
accurate, and label mnemonic aids as remembering aids rather than invented
etymology. Use purposeful contrasts such as 人/入 and 土/士.

The guided session should connect demonstration, supported recognition and
independent retrieval across the taught set. Delayed review and cumulative
checks provide separate evidence of retention. Character meaning, word reading,
word meaning and optional handwriting must not collapse into one score.

Keep deliberate early entry and experienced access, but distinguish assessment
of unknown material from ordinary continuation through encountered material.
Kanji's invitation should follow a clear demonstrated Kana checkpoint; the exact
threshold remains a product decision, not a scientific claim.

### Words

The curated course retains Kana and Kana + Kanji, with suitable small sets drawn
from actually encountered characters/patterns. Teach each word's sound, spelling
and sense. Progressively introduce the four requested response tasks within the
course; preserve separate evidence for decoding, meaning and production.

Save the unfinished set and lesson phase so Continue is meaningful. Prioritise
due retrieval and incomplete teaching before presenting an ever-growing eligible
count. Script and custom-response preferences should appear only where useful.

Word Bank needs an explicit teaching flow for selected personal entries. Missing
reading/meaning fields should lead to completing the entry, not an unanswerable
question. Freeform personal English is not a reliable list of accepted typed
translations: use self-assessment unless accepted answers are explicitly supplied
or a curated sense match is confirmed. Editing tested content must invalidate
only the dependent evidence. Preserve existing entries, schedules and tombstones.

Existing phrase lessons belong outside the isolated-word course. The proposed
default is a secondary Phrase lessons destination under Learn, preserving saved
progress and legacy links without pretending to supply a complete Grammar branch.

## Research and its practical implications

- [Renkl, Atkinson and Maier: fading worked examples](https://psycharchives.org/en/item/869bfeac-4b1c-4114-9d44-bb61a198cfbe)
  supports gradually removing help as learners move toward independent work.
  Its findings concern near transfer; it does not validate our exact lesson recipe.
- [Karpicke and Roediger: repeated retrieval](https://learninglab.psych.purdue.edu/downloads/2008/2008_Karpicke_Roediger_Science.pdf)
  found improved delayed foreign-vocabulary recall from continued retrieval
  after first success. Immediate recognition and completion counts are inadequate
  substitutes for later recall.
- [IES practice guide](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)
  supports spacing, retrieval and alternating demonstrations with independent
  exercises. Exact intervals and progression thresholds need product validation.
- [Hirata and colleagues: Japanese vowel-length training](https://www.isca-archive.org/interspeech_2006/hirata06_interspeech.pdf)
  separates auditory questions from answer-revealing feedback and checks
  generalisation. Its fast-rate-only training did not produce robust overall
  improvement; adding playback alone does not establish auditory learning.
- [Japan Foundation Minato Hiragana A1](https://www.minato-jf.jp/CourseDetail/Index/KC26_HRGS_A100_EN01)
  connects character sounds to reading and typing, with optional handwriting.
  It is a curriculum example, not proof of an optimal app design.
- [Irodori FAQ, Q15](https://www.irodori.jpf.go.jp/en/faq.html)
  teaches Kanji through useful words, meaning and pronunciation. This supports
  a word-based connection rather than isolated character labels alone.
- [Apple onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)
  favours contextual, interactive instruction; [modality guidance](https://developer.apple.com/design/human-interface-guidelines/modality)
  warns about navigation hierarchies within modal tasks. Apply this by making
  progress a coherent full-screen destination and keeping lessons focused.

## Acceptance must test the learner's experience

- Run an actual beginner journey through teaching, practice, correction, recap,
  reload, return and the next unit. Do not seed completion or call answer handlers
  directly as a substitute for this flow.
- A strategy that repeats the previous answer cannot solve listening. Verify the
  actual spoken target, distractors, accessible names and pre-answer content.
- Starting at the last character cannot complete an unstudied row. A session's
  goal, coverage and advancement rule must agree.
- Assess audio contrasts with audio. English definitions cannot award listening
  evidence. Retain first attempts and distinguish assisted correction.
- Test accurate continuation after interrupted lessons, account changes, sync,
  browser Back and resizing. A reload must not change beginner guidance.
- Verify first-use, partly learned and established accounts with realistic data.
  A list of large seeded statistics is not an adequate returning-user fixture.
- Inspect full screens at the attached screenshot geometry, narrow phones,
  short/wide windows, both appearances, themes, larger text and keyboard states.
  Check touching/overlapping controls, selected/hover contrast, hierarchy and
  whether the useful action is apparent. Scrolling a target into view is not
  evidence of a good default composition.
- Verify that Words course has no collection controls, and bank practice stays
  inside its own context. Preserve existing words and phrase links.
- Check delayed independent performance separately from immediate completion.
  Human uncoached observation is still necessary to validate clarity; automated
  tests cannot certify educational effectiveness.

## Scope and defaults

The two optional questions raised during this review concern automatic guided
sessions versus separate activity selection, and where existing phrase lessons
should live. No answers were returned. The proposal therefore uses guided
sessions and a separate secondary Learn destination for phrases. Those are
explicit proposed defaults, not recorded user approvals.

The implementation must replace the affected learning compositions and task
sequencing together, while preserving the approved visual identity, account/save
boundaries, earned access, coins and developer-only manual save controls. It must
not ship a small spacing patch labelled as this redesign.
