# Mode Atlas 2.85.0 — Progression and Kana sessions

iOS build **2080006**. Shared web/iOS release on `agent/mode-atlas-2.68.0-ios-theme`.

## XP and existing saves

XP stays generous, while advancing through later levels takes more practice.

| Current level | XP needed for the next level |
| --- | ---: |
| 1 | 100 |
| 5 | 300 |
| 10 | 1,000 |
| 20 | 4,600 |
| 30 | 11,800 |
| 50 | 37,000 |

Levels 1–5 cost `100 + 50 × (level − 1)`. Levels 6–10 cost `300 + 140 × (level − 5)`. Above 10, the cost is `1000 + 180 × (level − 10) + 18 × (level − 10)²`, rounded to the nearest 10.

Existing earned XP and correct-answer counts are unchanged. A one-time threshold credit preserves the old level and fractional progress (rounded down by less than one new-curve XP). It is not an XP award. It remains fixed as new XP is earned, and follows the account through cloud saves, merges and backups. An explicit progress reset clears it. Previously earned level cosmetics stay available.

| Actual practice pool | XP per correct kana | With hints enabled |
| --- | ---: | ---: |
| 1–9 | 2 | 1 |
| 10–19 | 3 | 1 |
| 20–44 | 4 | 2 |
| 45–89 | 6 | 3 |
| 90–149 | 7 | 3 |
| 150+ | 8 | 4 |

Presets use their actual enabled pool. Focused weak/due/mistake practice uses the focused pool; Daily Challenge and Test Mode use their own pools. Joined sounds count as kana units, not individual Unicode code points. Hint-enabled sessions earn the reduced rate even when answered before the hint appears. Recall/mastery evidence still distinguishes an actually shown hint. A restored session retains its original pool and hint setting; older checkpoints derive the missing settings on resume.

Completion, accuracy and streak bonuses scale with pool difficulty. Eligible sessions need at least 10 answers, three different kana and 25% accuracy. At the highest rate: guided completion earns twice the question count; completed finite sessions earn 20/35/50 accuracy XP at 80/90/100%; streaks of 10/25/50 earn 15/35/60 XP. Accuracy and streak bonuses require hints off and no shown hints. Daily completion earns up to 110 XP; formal tests earn up to 200 XP. Daily/test completion claims are capped per direction and date, with only an improvement topping up the claim. Review and mastery bonuses retain their existing limits. Summaries show the pool, rate and earned breakdown.

## Goals and achievements

Three daily goals and two weekly goals rotate from 24 templates. Rotation is deterministic for the local calendar day and Monday-based week, so an account's devices agree when using the same local calendar. Tasks include recall totals, Reading/Writing balance, script variety, broad practice, unassisted streaks, guided sets, challenges, tests and active days. Daily goals award 40–60 XP; weekly goals award 200–300 XP. Completions are durable dated claims, including when evidence from offline devices is merged.

Activity is namespaced by branch. Future branches can add templates to the shared catalogue, enable their branch and report metrics through the existing run-receipt API. Unreleased branch tasks are not presented. No separate goal store or scheduler was added.

Twelve new achievement tracks add 42 milestones: Daily Dedication, Weekly Wayfinder, Full Circle, Steady Steps, Special Delivery, Seasonal Souvenir, Keepsakes, Set Builder, Independent Recall, Wider Horizons, Precision Practice and On a Roll. There are now 26 tracks and 79 milestones. Existing goal claims and known study days count; new session/independence metrics accumulate from this release, without inventing historical evidence.

Exclusive/event achievements require actual account grants. Developer catalogue previews do not count. A received grant set counts once even if it contains several cosmetics. The achievement can remain after an event expires; it does not grant continued access to expired cosmetics. Reward access remains server-owned.

iOS shows one achievement branch at a time, with All/In progress/Unlocked filters and two-column cards. Large text uses a readable single column. Detail/rank navigation and existing unlock IDs remain intact. Web retains its branch sections and receives the same new milestones.

Widgets accept the new five-goal snapshot and higher XP requirements. They hide expired rotating tasks until the app publishes the new period's labels and targets. Last-known level/totals remain visible. Older widget snapshots remain readable.

## Session review

Reading and Writing retain the shared scoring, feedback, retry, pause, active clock and recovery owners. Non-Daily sessions finishing after midnight credit completion to the finish date; Daily Challenge retains its original official date. No changes were made to provider linking or account deletion.

Focused checks cover pool/hint rates in both directions, older checkpoint recovery, XP breakdowns, migration/offline merge behaviour, date rotation, achievement receipts, iOS layout in both appearances and large text, and narrow web layout. The existing guided, finite/timed mode, pause, skip, retry, summary and recovery cases remain release gates. Firebase emulator checks exercise the real save permissions; Xcode CI builds simulator and unsigned device Release targets and runs native widget tests. Automated results are reported with the handoff; they do not establish a signed physical-device pass.

## Deploy and install

1. From this release's root, deploy the compatible Firebase backend before using the new clients:

   ```sh
   npm ci
   npm run build:social
   npm run social:install
   npm run social:login
   npm run social:deploy
   ```

   Project: `mode-atlus`. This updates the existing social functions, Firestore rules and indexes. The new rule prevents a client with an older progression schema from overwriting a migrated save. Update the website and each installation to 2.85.0 together; an older client may be unable to save after the account migrates. No Firebase Apple-provider changes are needed.

2. Keep the working Mac signing configuration. In a fresh extracted folder, copy the existing ignored `ios/signing.local.xcconfig` and `ios/widget-sharing.local.xcconfig` if present. Keep the same real team and App Group. Never commit those local files or Apple credentials.

3. Build and open the bundled iOS app:

   ```sh
   npm ci
   npm run ios:sync
   npm run ios:open
   ```

4. In Xcode, retain the successful **App target → Debug** manual signing selection with **Mode Atlas Development**. A fresh source project may need that selection reapplied. Preserve the widget target's working signing configuration. Do not switch the working Debug setup back to automatic signing. The source has not changed bundle IDs or Apple sign-in entitlements. Confirm version **2.85.0**, build **2080006**.

5. On the phone, compare the level/progress before and after the upgrade, try a hinted A-row session and a broad unassisted session, resume an interrupted set, inspect goals/achievements and refresh the widget. Apple linking and Apple login were already confirmed on 2.84.0; a brief sign-in regression check is still useful. Account deletion remains the deferred next task.

Main, website publication, Firebase production deployment and signed device/TestFlight upload remain user-operated. The development handoff is a source release, not a claim that those deployments have occurred.
