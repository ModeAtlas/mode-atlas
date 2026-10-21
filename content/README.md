# Kanji teaching overlays

`kanji-lessons.json` is the sole source of editorial changes to generated N5/N4 lessons. `kanji_lessons.curate()` applies it during `build_kanji_data.py` and preserves earlier reading keys for in-flight clients. Do not edit revisioned data or backend shared copies.

The 253 word selections were checked against OpenJLPT vocabulary data at commit `0d1d3410bec90bd4098a7c72de820543cb4f707c`. Dictionary entry identifiers are retained where available; manually selected factual examples use the existing licensed dictionary readings. Existing EDRDG/JMdict and OpenJLPT attribution remains in `/kanji/sources/` and the repository notices. The 84 N5 shape/memory cues and curated English answer aliases are Mode Atlas teaching text.

Every displayed kana reading must pass the shared grader both as kana and as its displayed romaji. Alias changes must include ordinary valid synonyms and incorrect near-misses in the content tests. These bands are study groupings, not an official complete JLPT vocabulary/kanji specification. Further N4–N1 editorial work can extend this file without changing character identity or saved progress.
