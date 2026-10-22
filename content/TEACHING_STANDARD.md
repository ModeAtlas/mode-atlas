# Teaching content and approval

This is the content contract for the PDF work. Automated checks validate structure and dictionary restrictions. They do not approve teaching quality or establish learning effectiveness.

| Content | Required authored evidence | Acceptance |
| --- | --- | --- |
| Kanji word | Useful word containing the character; one clearly prompted reading; source entry and applicable spelling/reading/sense | Dictionary validation plus educator judgement of usefulness and band placement |
| Meaning task | Prompt distinguishes the character meaning from the example word meaning; ordinary accepted synonyms; plausible but incorrect distractors | Educator checks correct alternatives and misleading near-misses |
| Teaching | Memory cue identified as a learning aid; common confusion where relevant; short contextual use with reading and translation | Educator checks naturalness, accuracy, level and absence of invented etymology |
| Practical unit | One useful outcome; taught vocabulary/pattern; context; recognition, retrieval and productive use; error correction | Educator checks all words, translations, prompts and accepted answers |
| Audio | Correct expression, natural pronunciation, suitable normal/slow playback and redistribution rights | Japanese-competent listening review and recorded provenance; device synthesis alone is not this approval |
| Later review | Next-day retrieval and later weekly return; new context using taught material; hinted/corrected answers retry sooner | Automated scheduling and persistence checks, then actual learners tested after one and seven days |

`node audit_learning_content.cjs` checks every generated Kanji entry and every practical task. `--report` refreshes `teaching-coverage.json`. Missing examples must match the explicit isolated-reading exceptions in `kanji-example-coverage.json`; new omissions fail the gate. Coverage counts remain visible even when the structural gate passes.

The eight isolated-reading entries are reading practice, not complete contextual lessons. The dictionary-backed N4–N1 catalogue is not represented as fully authored teaching. Filling a field with a generic sentence does not meet the editorial requirement.

Independent review must cover all 30 unit words, six recognition tasks, six initial productive tasks and twelve delayed tasks. Sample every Kanji band, including tailored and generic teaching, ambiguous readings, added dictionary selections and each isolated-reading exception. Record entry/task ID, reviewer, date, finding, corrected answer/source and approval decision. The current repository contains no independent educator sign-off.

For learner acceptance, use the first-session and one-day/seven-day protocol in `docs/3.0.0-implementation.md`. Keep hint use, intervening practice and unaided transfer separate. Software tests cannot supply those observations.
