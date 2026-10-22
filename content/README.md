# Kanji teaching overlays

`kanji-lessons.json` is the sole source of editorial overlays across the generated Kanji bands. `kanji_lessons.curate()` applies it during `build_kanji_data.py` and preserves earlier reading keys for in-flight clients. Do not edit revisioned data or backend shared copies.

The 253 editorial word selections originate from OpenJLPT at commit `0d1d3410bec90bd4098a7c72de820543cb4f707c`. The complete generated example selection is now checked against JMdict spelling/reading/sense restrictions, with uncommon/archaic senses excluded from beginner selection. Dictionary IDs remain attached. The pinned JMdict SHA-256 and the four reselected entries are recorded in `kanji-example-coverage.json`; 2,375 of 2,383 characters have word examples and eight remain explicitly isolated readings.

The overlay contains 129 original cues, 215 accepted-meaning sets, 53 character comparison entries and 22 original context sentences. The 3.0.2 addition is 45 cues, the comparisons and the context sentences; it is not a complete authored course across all 2,383 characters. The context sentences and teaching notes have not received independent educator approval. Existing EDRDG/JMdict and OpenJLPT attribution remains in `/kanji/sources/` and repository notices.

Every displayed kana reading must pass the shared grader both as kana and as its displayed romaji. Alias changes must include ordinary valid synonyms and incorrect near-misses in the content tests. These bands are study groupings, not an official complete JLPT vocabulary/kanji specification. Further N4–N1 editorial work can extend this file without changing character identity or saved progress.
