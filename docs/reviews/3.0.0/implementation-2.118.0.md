# 2.118.0 implementation and migration record

The historical readiness review describes 2.117.1. Its probes are audit evidence, not the current release gate. The maintained regression tests now live under `tests/` and `backend/tests/`.

| Findings | Implementation owner | Evidence |
|---|---|---|
| R01, R02 grading | `mode-atlas-japanese`, Kanji content/lesson catalogue | All configured readings round-trip; curated aliases tested |
| R03 offline conflicts | Kana evidence, save merge, account transport | Opposite merge orders, retry idempotence, word/result unions and tombstones |
| R04, R07 reviews | Kana review and Kanji state | Failed/early reviews remain available without pushing due dates out |
| R05 earning authority | Server study earnings and commerce | Personal-save forgery cannot mint currency; receipts validate answers and deduplicate |
| R06 capacity/history | Results storage, client/server account transport | >1 MiB fixture, bounded root/parts, no-op writes, reset cleanup |
| R08 teaching | `content/kanji-lessons.json`, teaching/lesson view | 84 authored N5 cues; 253 N5/N4 selected example words |
| R09 placement | Kana/Kanji placement owners | Kana confirmation question; Kanji access assessment without fake mastery/XP |
| R10 branch flow | Branch registry, tours and Home continuation | Hub/branch replay, current branch continuation |
| R11 words | Word Bank model and recall dialog | Reading separated from written form, repeatable self-marked review |
| R12 mastery | Review policy and both mastery views | Recent evidence requirements; diagnostic speed/lifetime accuracy; met/missing indicators |
| R13 performance | Social list/projection queue and weekly rank owner | At most 20 profile materializations for Friends page; two global rank counts |
| R14 rewards/abuse | Weekly settlement, study ledger, callable monitor | Answer budgets, suspicious-pattern reward hold, private collection rules |

## Save migration and compatibility

Deploy rules/functions/indexes before clients. A v1 save is read normally and converted on its next successful client write. Sections above 24 KB are split into `users/{uid}/appData/kanaTrainer/parts/section-{name}-{index}`. A root manifest, all changed parts and obsolete-part deletes commit atomically. Parts contain at most 120,000 UTF-16 code units; the root is guarded below 750 KB and a changed transaction below 8 MiB. Total parts are bounded to 350. The server resolves the same manifests before projecting data.

Each write reads the current cloud version in a transaction and merges the latest local snapshot. Independent post-migration Kana contributions are per device and merge monotonically. Older aggregate-only histories use a conservative common baseline: exact historical overlap between devices cannot be reconstructed. New words/results merge by stable ID; deletion tombstones prevent resurrection. A reset/import changes generation so older offline snapshots cannot restore erased data.

Old clients are deliberately prevented from overwriting a migrated v2 account. Do not revert rules or resume an older app on such an account. Forward fixes preserve the manifest. In an incident, preserve the root and every referenced part together before repairing; restoring only the root loses section data. Account deletion recursively removes parts.

Kana legacy result aliases are read once, assigned deterministic identities where needed, deduplicated and removed from active writes. Canonical Kana history is not silently truncated. Existing Kanji result retention remains 30 runs. Local storage still has a device quota: write failures remain visible and must not be reported as confirmed cloud saves. This release does not claim unlimited offline history capacity.

## Economic migration

`studyEarnings/{uid}` and its run/day receipts are server-only. The first ledger preserves already-awarded wallet level/token offsets; existing purchased items and balances are untouched. Imported or edited personal XP is not economic evidence. Subsequent earnings come from validated online or queued offline answer receipts, bounded to seven days and daily allowances. Signing out clears device data, so its confirmation displays queued study rewards as unsynced.

Personal learning XP and economic evidence have different trust boundaries. The server uses observed answered content and does not accept claimed mastery/review milestones; economic accrual may therefore lag personal/imported XP. Never migrate by copying raw user-save totals into the private ledger. Developer grants remain explicitly authorized server operations.

## Reward review and App Check rollout

Weekly settlement records `rewardStatus: review` and a private `weeklyRewardReviews/{week-uid}` record for sustained suspicious timings. Do not issue the prize automatically while held. An authorized operator inspects the submitted sequence and timing in server records, then resolves entitlement/reward through an audited administrative workflow; this release does not add a public moderation view or claim automated proof of cheating. Timing signals flag review; they do not prove wrongdoing.

The callable records only action, authentication presence and App Check presence. It does not log tokens, email addresses or answer payloads. `MODE_ATLAS_ENFORCE_APP_CHECK` defaults off. Register and integrate the web and iOS providers, confirm valid tokens from both current production clients, inspect monitor metrics, then enable enforcement in a separate rollout. Turning it on before provider integration would block legitimate users. App Check is one signal, not a proof of human study.

## Performance and release acceptance

Keep the warm cached Friends path, request coalescing and account-bound cache invalidation. Ordinary Friends list loading does not hydrate every friend's private save. Projection refreshes are queued and processed in bounded scheduled batches; migration can temporarily show a previous summary until that refresh completes.

Use a populated 100-friend fixture for read-count assertions. For production timing acceptance, compare the same account/device/network before and after deployment: first Friends open, warm reopen, next page, global ladder, route switch, sign-out prompt and offline reconnect. Browser timings are local observations, not production latency guarantees.

The GitHub release gate verifies the exact published commit, including Firebase emulators and the native archive. Physical device, provider configuration and production latency evidence remain explicit operator acceptance tasks; they cannot be certified by this workspace.
