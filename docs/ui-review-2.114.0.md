# 2.114.0 design acceptance and rendered review

## Why Achievements was missed

The previous pass treated changed counters, spacing and overflow checks as completion of a design request. It did not replace or assess the outdated achievement collection and detail interaction against the new product direction. The source diff supports that narrower work; the earlier completeness claim was too broad.

A surface is now marked complete only when its design decision, real rendered states and functional checks are recorded. Cosmetic CSS changes and screenshots alone cannot close a system or interaction redesign. Unchanged routes are not labelled redesigned.

## Decisions and evidence

| Surface | Decision | Rendered states reviewed |
| --- | --- | --- |
| Achievement collection | Artwork-led two-column phone grid; closest six milestones first; branch and status controls | New account, next milestones, all active tracks, earned collection, all four live branches |
| Achievement details | One illustration, exact requirement/progress, direct rank selection and the existing shared close/back behavior | Locked first rank, earned ranks, final rank, return preserving selected branch |
| Achievement artwork | A shared SVG sprite with family illustrations and five rank frames; no emoji tiles | All 31 illustrations; frame ranks I–V; earned and unearned treatment |
| Session end | One level animation after answers stop; then normal recap and newly earned badge list | Kana and Kanji, one/multiple levels, no level gain, no new badges, new rank, resumed set, account change |
| Friends profile | Account-wide stats; strict mastered percentage plus stage distribution | Friend, self, non-friend privacy, legacy backend fallback, long names, dynamic branch totals |
| Accessibility | Labels accompany colour, existing modal focus management, direct rank controls, reduced motion | 320px large text, 393px phone, 1280–1440px desktop, both system appearances and all four collection themes |
| Existing shared modal surfaces | Preserve their owner and styles while replacing only achievement/level content | Mastery entry/details, rewards navigation and existing account tests remain in release gates |
| Brand exports | Export current source geometry, no redesign or font substitution | Light/dark horizontal and stacked logos, symbol, wordmark, tab/profile icons; transparent exports inspected |

The focused visual matrix contains 35 application states across seven viewport/theme combinations, plus the complete badge sheet and profile/recap evidence from browser tests. DOM checks cover page overflow and tile text; horizontal branch tabs intentionally scroll on narrow screens. Native screenshots use the Capacitor bridge fixture. Physical device animation smoothness remains an installation check.

## Functional acceptance

- Canonical app/server rules; exact mastery stages and full-curriculum denominators.
- Permanent earned IDs merge without duplicate rewards; archived/special milestones do not enter study completion.
- Compressed Kanji evidence is decoded with a bounded output size; invalid evidence omits unavailable totals instead of showing false zeroes.
- Source/save validation accepts old versions and rejects malformed scalar evidence.
- Account-wide stats remain friend-only; no raw learning evidence is added to public profiles.
- Session baselines prevent historic achievements appearing as newly earned; one presentation owner prevents repeated level dialogs.
- The existing lesson, practice, XP, wallet and unlock owners remain in place.
