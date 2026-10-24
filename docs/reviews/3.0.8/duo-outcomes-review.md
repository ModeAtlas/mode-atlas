# Duo outcomes, Help and save-file review — 3.0.8

24 October 2026 · iOS build 2080054

## Findings and source fixes

**Low outcomes had two layout causes.** The narrow shared dialog rule bottom-aligned
all dialogs. The 3.0.6 native overlay geometry also chose the full-width rectangle
below a side status region whenever at least 240 pixels remained. Together these
put long results unnecessarily low. Results and level-up presentations now opt
into the full-height safe rectangle beside system UI and centre within it.
Ordinary dialogs keep their previous presentation. Short, wide level-ups use two
columns; sufficiently wide Kana summaries separate learning from rewards. The
shared dialog resets its old scroll position when reused. Word Bank completion
switches placement only at completion, preserving the wider activity layout.
Kanji recap and Kana handwriting live in the page rather than a completion sheet.

**Rewards did not change font declarations on toggle.** Open categories span both
grid columns, while closed categories use one column. The collection left mobile
text adjustment at the browser default. Width-based iOS text inflation is the
likely cause of the screenshot's selectively enlarged headings and metadata.
The collection now sets prefixed and standard `text-size-adjust:100%`; this is
scoped to that responsive collection, preserving rem/Dynamic Type and zoom.
No selection, unlock, artwork or theme rule changed. Tests compare actual glyph
heights as well as computed type sizes through mixed toggle sequences and resize.

Apple documents that iOS calculates text scale from block width and offers CSS
percentage control when automatic adjustment is unsuitable:
[Safari Web Content Guide](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/AdjustingtheTextSize/AdjustingtheTextSize.html).
The current property behavior and inheritance are also documented by
[MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-size-adjust).
The diagnosis remains an inference: Linux WebKit is built without iOS text
inflation and cannot reproduce that engine-specific cache behavior. Device
confirmation is still needed; browser success is not described as a physical run.

**Save/load was an assistant policy regression.** Commit
[5f4dda6](https://github.com/ModeAtlas/mode-atlas/commit/5f4dda6) moved file tools to
developer diagnostics in 2.75.0. Commit
[96ea537](https://github.com/ModeAtlas/mode-atlas/commit/96ea537) added public learning
backup controls and a `PERSONAL_BACKUP` exception in 3.0.0. The 3.0.2 accumulated
restoration retained them. Old tests checked different selectors; new tests
expected the unapproved public feature. This release removes its UI, click
handlers, APIs and importer exception, and removes stale public-backup advice.
The existing developer guard still checks eligibility and account identity around
async operations. Manual saves remain client-owned testing tools; this change does
not claim new server enforcement of ordinary personal learning data.

## Explanation inventory

Settings → Help is searchable and opens one topic at a time. It has seven topics:
reviews/study days; Kana mastery; Kanji levels; achievements/profile percentages;
weekly competition; currencies/rewards; saving/offline use. Kana thresholds read
the existing learning/review constants rather than duplicating numeric rules.

| Former location | Decision |
| --- | --- |
| Home review `(i)` | Move review timing to Help |
| Progress Goals review `(i)` | Use the same Help topic |
| Kana Mastery Map “How mastery works” | Move stage reference; retain each character's exact targets |
| Kanji path `(i)` | Move unlocking reference to Help |
| Kanji character “How Kanji mastery works” | Move general explanation; retain personal evidence |
| Achievements “How milestones count” | Move counting reference to Help |
| Friend profile “How mastery is counted” | Move percentage definition to Help |
| Weekly “Rules & prizes” | Move rules to Help; keep Leave weekly competition on the board |
| Shop Study Tokens `(i)` | Move earning explanation to Help; keep balances and coin placeholders |
| Lesson hints, usage tips, character comparisons | Keep: they teach the current task |
| Practice rows/modes, reward categories, all lessons, Word Bank records | Keep: these disclose functional choices or saved records |
| Session details/rewards, Kanji evidence, weekly past results | Keep: these show the user's actual results |
| Alert schedules and Friends privacy/leave | Keep: actionable settings |
| Feedback diagnostics, destructive actions, data-sharing consent | Keep: information needed before a deliberate action |

No repetitive help labels are added back to the cleared pages. Existing first-use
lessons and tours remain intact. Home, Learn and Kana keep their separate roles.

## Verification and limits

- Release checks: 297 JavaScript tests, 23 Python tests, generated assets,
  project/security/content audits and native web packaging passed.
- Chromium sweep: 283 cases; 281 passed initially. Two ordinary About-dialog
  checks caught an over-broad centering change. The rule was limited to outcomes.
  The final 81-case run passed, including both corrected cases and the affected
  activities. Across those runs, **311 distinct cases have a passing latest
  result**. The separate mobile iOS-shell run passed all 12 cases.
- All **20 WebKit cases passed**. The release workflow now includes a dedicated WebKit outcomes/rewards/Help job
  and requires it in the combined regression gate. Run locally with
  `npx playwright install --with-deps webkit`, then `npm run test:webkit`.
- New cases complete ten-answer sets with mistakes, scroll through actions, show
  level-ups, rotate while results remain open, exercise larger text, compare
  reward typography after toggles, navigate/search Help and verify normal-account
  file access is rejected. Existing tests cover developer exports/imports,
  access loss during import, account changes, first-use flows, sync and scoring.
- Native safe-area fixtures model narrow, short, wide and tall windows, including
  asymmetric status regions. Their dimensions are stress cases, not hardware specs.
- [Evidence manifest](evidence.json) records engine results and screenshot hashes.
  Screenshots are generated fixtures. The supplied device images were inspected
  as references and are not republished.
- Native simulator/archive results and public branch commit are recorded on
  [PR #68](https://github.com/ModeAtlas/mode-atlas/pull/68). No main merge or website
  deployment is performed by this update.

Physical acceptance still includes the user's exact rewards toggle sequence,
real Dynamic Type, touch scrolling, VoiceOver and Duo system-region movement.
The code is delivered now; these external checks are not represented as completed.
