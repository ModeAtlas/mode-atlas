# Mode Atlas visual roles

Applied in 3.0.2; this is a maintained design rule, not a claim that every legacy component has been redesigned.

| Element | Role and treatment |
| --- | --- |
| Global navigation and account controls | Monochrome shared SVG icons; colour communicates the active destination. Functional controls keep their text labels and at least 44 CSS-pixel targets. |
| Atlas mark | Brand identity. It retains its colour in the navigation and About. |
| Branch illustrations | Introduce Kana, Kanji and vocabulary. Use the existing common illustration family on branch cards and the Home recommendation. Do not turn these illustrations into tiny utility icons. |
| Streak flame | One shared vector silhouette, already corrected in 2.122.0. No second Home-only asset. |
| Avatar, themes and earned artwork | Collectible appearance; retained within the wardrobe/rewards context. Coin-purchase placeholders remain by the user's instruction. |
| Lesson presentation | One active teaching/recall task. Optional pattern notes, comparisons and other units use disclosures. The interface carries the next action rather than an introductory essay. |
| Results | Shared compact rows: Practised, Revisit, When. Existing answer history remains available below the result. Review time comes from the relevant saved schedule. |
| Responsive native navigation | Four bottom destinations at compact usable widths; right rail when usable width is at least 900 and height at least 500 CSS pixels. Independent safe insets bound content and overlays. |

Home remains the personal app hub. Learn remains the branch directory, including future branches. Kana owns only Kana. A new or just-starting learner does not receive the established personal dashboard after one answer. Established learners retain direct access to their existing work.

The wide layout uses existing card grids and preserves comfortable reading widths. It does not stretch a single answer input across the entire display. No fold or resize event reloads the page or restarts the lesson. Account sheets cover the navigation, including the wide rail; critical controls cannot sit behind it.

See `reviews/3.0.2/screens/` for local browser evidence. Real VoiceOver, device text sizing and uncoached discovery remain acceptance work.
