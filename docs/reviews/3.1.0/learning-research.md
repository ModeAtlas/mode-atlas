# Learning depth review — Kana, Kanji and Words

Research checked 27 October 2026. Baseline code inspected: `ec6d2ff` (3.0.8).
This document separates educational evidence, product choices and acceptance
criteria. The criteria below are a review checklist, not a claim that every
check has already passed; release evidence belongs in the handover.

## What the existing experience was missing

The existing Kana introduction displayed a character, romanisation and playback,
then recorded introduction when Next was pressed. Its practice, mastery, row
unlocking and handwriting owners were more capable than this thin lesson flow
communicated. More explanation would not fix the missing guided learning steps.

Kanji already offered a focused example word, meaning, sound, a memory cue,
handwriting and recognition checks. The opportunity is to connect those lessons
to independent recall of the taught set, spaced review and an appropriate test,
instead of making learners choose among a full difficulty band's controls.

Word Bank combined personal records, self-assessed review and phrase situations.
It lacked a clear, script-aware isolated-vocabulary course. The shared branch
recommendation still directed Words learners toward phrase lessons. Those are
useful existing features, but do not meet the requested new Words journey.

## Evidence and examples

| Source | What it supports | Product implication |
| --- | --- | --- |
| [Japan Foundation Minato, Hiragana A1](https://www.minato-jf.jp/CourseDetail/Index/KC26_HRGS_A100_EN01) | Its public course outline connects individual sounds, simple words, reading and typing. Handwriting is available as an additional activity. | Teach a sound and shape, check recognition, then retrieve it; connect familiar characters into small words. Keep handwriting available without making it a universal gate. |
| [Japan Foundation, Memory Hint resources](https://lo.jpf.go.jp/suggested-free-resources-for-learning-japanese-writing/) | The Foundation's description combines mnemonic pictures, quizzes and pronounceable character tables. | A useful memory cue, sound and check belong together. A mnemonic is an optional remembering aid, not a linguistic origin claim. |
| [Japan Foundation Irodori FAQ, Q15](https://www.irodori.jpf.go.jp/en/faq.html) | Kanji are taught through words used in the course, with meanings and pronunciation learned gradually. | Preserve a focused word reading for each Kanji lesson. Knowing a character does not prove that the learner knows every reading of a new compound. |
| [WaniKani: vocabulary lessons](https://knowledge.wanikani.com/getting-started/unlocking-vocabulary/) | Vocabulary can depend on known component kanji, while each word still has its own reading/meaning lesson and quiz. Lessons feed a review queue. | Use known script to select eligible words, then teach the actual word. Eligibility is permission to learn, not mastery. |
| [WaniKani: readings and meanings](https://knowledge.wanikani.com/wanikani/japanese/readings-vs-meanings/) | Meaning and pronunciation are asked separately, with explicit task and response-language cues. | Clearly label the required answer language. Keep decoding, meaning recall and Japanese production as separate evidence. |
| [Karpicke & Roediger, 2008, original paper](https://learninglab.psych.purdue.edu/downloads/2008/2008_Karpicke_Roediger_Science.pdf) | In a foreign-vocabulary experiment, continued retrieval after first correct recall improved delayed retention compared with dropping the item from retrieval. | A correct first lesson should add the item to practice/review, not remove it from learning. A single good session is not lasting mastery. |
| [Karpicke & Bauernschmidt, 2011, original paper](https://learninglab.psych.purdue.edu/downloads/2011/2011_Karpicke_Bauernschmidt_JEPLMC.pdf) | Spacing repeated retrieval benefited delayed retention; no expanding/equal/contracting schedule was inherently superior in that experiment. | Preserve spaced reviews. Do not claim that a newly invented interval ladder or unlock threshold is scientifically optimal. |
| [Apple HIG: onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding) | Guidance favours learning through the experience, brief optional onboarding and instructions close to the relevant interface. | Begin the first useful activity quickly; introduce the next task when it becomes relevant. Avoid a compulsory tour of every mode. |

These sources inform the activity design. They do not independently validate
Mode Atlas's curriculum, content, scoring, unlock thresholds or learning outcomes.
Product examples are examples of implementation, not controlled efficacy studies.
No source assets or lesson copy need to be copied into the app.

## Recommended learning contract

### Kana

Use a compact sequence within a row: meet the shape and sound, recognise it,
retrieve it, then practise the taught row. Offer handwriting from the lesson and
row so that learners can connect movement and shape. Guided traces are supported
practice, not independent handwriting evidence. Listening checks must require
successful audio playback; a failed voice cannot silently become a wrong answer.

The next action should follow evidence: resume a lesson, practise the current
row, review earlier material, or learn the next row. A mixed pool should use
characters actually introduced or established by placement/legacy evidence.
An unlocked row is not automatically a taught row. Row checks provide a short
milestone before broader script tests; tests should report what they actually
assess and offer a direct way to revisit mistakes.

Dakuten, small kana combinations, the small っ/ッ and long vowels need deliberate
teaching or eligibility checks. A list of familiar base characters does not
prove knowledge of these sound patterns. Romaji recognition and independent
recall must not be conflated with handwriting.

### Kanji

Use a visible, evidence-based invitation from Kana once the learner has several
familiar rows; keep an intentional early entry available. The precise row count
is a product decision to evaluate with learners, not a research-derived cutoff.
Account XP, tour completion and raw attempts are poor substitutes for familiarity.

Keep small character sets and a focused example word. After recognition, offer
independent meaning and reading recall on taught characters. A full-band test
should be a deliberate choice, not the beginner's next suggested action. An
optional handwriting activity should reinforce the current character without
blocking reading progress.

### Words

The branch contains a curated course and the learner's personal bank. Start with
isolated words as requested; preserve previous phrase material in a distinct,
secondary place. Do not make sentence production an invisible prerequisite.

| Task | Evidence it provides | Presentation |
| --- | --- | --- |
| Kana → romaji | Decoding a written pronunciation | Initial task; describe it as reading, not translation |
| Kana → English | Recalling a meaning from Japanese | Introduce after the first word lessons/reading evidence |
| English → romaji | Retrieving the Japanese word without kana input burden | Later productive task, distinct from meaning recognition |
| English → kana | Retrieving and spelling the Japanese word | Later productive task with Japanese input support |

The last three need not be advertised as a universal strict difficulty ranking:
typing experience, prior knowledge and the word affect difficulty. Progressive
unlocking is an interface choice. Decoding may unlock an opportunity to study
meaning, but must not manufacture meaning or production mastery.

The two script choices should mean what they say. Kana mode must not present
unseen kanji. Kana + Kanji mode may show a word only when all displayed kanji are
known and its reading is supported by introduced kana/patterns. Newly eligible
words still need their own introduction. The empty-pool state must point to a
concrete Kana step; it must not silently add unseen characters to fill a session.

For typed grading, use reviewed sense-specific answers and explicit synonyms.
An English cue such as “wear (on feet)” is fairer than a bare ambiguous “wear”.
Normalise harmless casing, spacing and supported romanisation variants. Avoid
substring matching or broad fuzzy matches that accept unrelated words. Keep
accepted answers available in corrective feedback. Curated words and user-added
personal entries have different editorial guarantees and should retain that
distinction.

## Integration risks found in the baseline

- `ModeAtlasKanaLearning.available()` returns unlocked rows, including the next
  row before instruction. It must not be used as the sole “seen kana” predicate.
- `wordBank` save sections contained only `items`, `lessons` and `deleted`.
  `ModeAtlasSaveMerge.section()` reconstructed those fields. A new local course
  key would be silently omitted from sync unless the schema and merge owner are
  extended together.
- Every new persistent key needs the existing storage boundary so reset,
  sign-out, account changes and recovery treat it as user learning data.
- `ModeAtlasLearningExperience` counted personal words and phrase lessons only.
  New course progress must inform returning-user presentation and continuation.
- `ModeAtlasBranches.recommend()` preferred the previous phrase lesson routes.
  Home, Learn and Words must use the same intended next step.
- Existing structural content audits explicitly do not constitute independent
  pedagogical approval. New tests should exercise curriculum correctness and
  grading contracts without claiming a fluent human editorial review.

## Acceptance criteria for this release

1. A fresh learner chooses beginning or assessment/experienced entry and reaches
   a useful activity without reading an essay or choosing among all modes.
2. A Kana lesson checks learning before handing its row to practice. Returning
   after interruption preserves real progress and offers a clear continuation.
3. Taught-only mixed practice excludes unseen next-row characters. Earned access
   survives upgrade without falsely awarding mastery to existing accounts.
4. Corrected mistakes and assisted answers remain distinguishable from first-try
   independent evidence. Rapid repeats cannot advance scheduled mastery as if
   days had passed. Timed speed is not the sole mastery criterion.
5. Kanji has a named invitation milestone and intentional early access. Lessons,
   taught practice, due reviews and tests have concrete next actions.
6. Words covers both script choices, all four typed modes, mode-specific progress,
   a small beginner pool, expanding eligibility and a useful empty-pool action.
7. The Words course and taught-only Kana mix exclude unintroduced characters
   and required sound patterns, including after a script switch, direct URL,
   pool refresh or account switch. Deliberately exploring a new Kana lesson is
   separate from this taught-only practice contract.
8. Test sessions use a stable pool; hints and study feedback do not change a
   recorded test answer after the fact. Results lead to targeted practice.
9. Personal word editing, deletion and review still work. New course progress
   survives reload and merge, and clears appropriately on account transition.
10. Native and web flows are inspected at narrow, wide and short usable windows,
    with light/dark themes, larger text, keyboard/IME input and rotation during
    lessons and results. Continue, Back and answer controls remain reachable.
11. Existing visual identity, coin placeholders, developer-only manual saves,
    Home/Learn/Kana roles and Mac update preferences remain intact.
12. Completion means a coherent bounded foundations course with continued review,
    not a claim of Japanese fluency. Independent Japanese-content review and
    learner observation should inform later revisions.

## Implementation review findings

The release review caught three state issues in the initial Words implementation:
empty Kanji statistic rows were being treated as character exposure; replaying
only the most recent 16 answers could regress a mature review schedule; and
trimming early successful answers could revoke an already earned practice mode.
The implementation now requires actual Kanji exposure, stores schedules
independently of bounded answer history, and preserves earned skill evidence.
The Words unit tests cover these cases.

Cross-branch review also identified that an aggregate “words due” count must
select a skill that actually has due words. A decoding-only default cannot
service a meaning or production review. The Words owner added a specific
browser regression for a meaning-only due queue.

The existing personal-bank and phrase tests were migrated to explicit course,
bank and phrase entry points. The focused migration run passed 48 tests across
desktop and mobile Chromium on 27 October 2026, retaining checks for account
changes, safe grading and editing, saved schedules, folding and reachable
completion screens. This is browser evidence, not a physical-device claim.
