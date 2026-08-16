Mode Atlas
https://mode-atlas.app/


Official site: https://mode-atlas.app/
Support: support@mode-atlas.com
Admin: admin@mode-atlas.com
General: hello@mode-atlas.com
Version: 2.41.0
## 2.20.19
- Made `ModeAtlasKanaData` the single canonical kana inventory owner (240 kana) and moved Kana Metrics/Achievements to consume the same collections and mastery rules.
- Replaced per-page automatic save repair with explicit save-schema migrations; clean page loads no longer schedule cloud sync, while genuine repairs and post-hydration legacy fixes sync once.
- Made Firebase module/setup promises in-flight-only and retryable after transient startup failures, including the reconnect race where online returned while the failed setup was still settling.
- Centralized app version, cache revision, save schema, backup format, cloud snapshot format, and build date in `mode-atlas-version.js`; npm/README metadata now follows the release source.
- Moved formal test result date keys to the shared local-calendar date helper.
- Removed the unused loader compatibility bridge and unused dynamic-module bootstrap code; page-state and achievement lifecycle work is now BFCache/event driven instead of repeating on ordinary focus/pageshow.
- Extended backend tests and release audit rules for canonical kana counts, save-repair sync behavior, Firebase retry recovery, release metadata ownership, and shared dependency order.

