Mode Atlas
https://mode-atlas.app/


Official site: https://mode-atlas.app/
Support: support@mode-atlas.com
Admin: admin@mode-atlas.com
General: hello@mode-atlas.com
Version: 3.2.0

3.2.0 learning course redesign: [handover and Xcode update code](docs/development-3.2.0.md) · [review and acceptance](docs/reviews/3.2.0/acceptance.md).

3.1.0 connected Kana, Kanji and Words foundations: [handover and Xcode update code](docs/development-3.1.0.md).

3.0.8 Duo results, stable rewards text, Settings Help and developer-only save files: [handover and Xcode update code](docs/development-3.0.8.md).

3.0.3 adaptive iPhone layout and update notes: [development notes](docs/development-3.0.3.md).

3.0.2 implementation and original PDF status: [development notes](docs/development-3.0.2.md).
3.0.1 interface cleanup and update commands: [development notes](docs/development-3.0.1.md).
3.0.0 handover and administrator migration: [development notes](docs/development-3.0.0.md).

Account recovery, repeating goals, navigation performance and logo consistency: [2.115.0](docs/development-2.115.0.md).
Achievement collection and artwork, account-wide profiles, and session celebrations: [2.114.0](docs/development-2.114.0.md).
Faster navigation, redesigned Settings and Shop, and complete UI review: [2.113.0](docs/development-2.113.0.md).
Complete Kana path, personal goals, Profile and UI review: [2.112.0](docs/development-2.112.0.md).
Personal home, Evergreen, weekly friend discovery and streak balance: [2.100.0](docs/development-2.100.0.md).
Friends, sync and full shop: [2.99.0](docs/development-2.99.0.md).
Development and release requirements for both platforms: [Web and iOS architecture](docs/ios-web-architecture.md).
Avatar saving, wardrobe expansion and weekly coins: [2.97.0](docs/development-2.97.0.md).
Level coin catch-up and character avatars: [2.96.0](docs/development-2.96.0.md).
Moonlit Midnight, Skyline collection and mixed-theme contrast: [2.95.0](docs/development-2.95.0.md).
Mastery, theme, profile, web layout and widget corrections: [2.94.0](docs/development-2.94.0.md). Coin shop, themes, streak items and widget update: [2.93.0](docs/development-2.93.0.md). Account shop redesign and update steps: [2.92.0](docs/development-2.92.0.md). Widgets, review help and shop framework: [2.91.0](docs/development-2.91.0.md). Learn page redesign and update steps: [2.90.0](docs/development-2.90.0.md). Native routing correction: [2.89.1](docs/development-2.89.1.md). Learning hub, goals and account alert timing: [2.89.0](docs/development-2.89.0.md).
Friends and Rankings layout, with the weekly ladder up front: [2.88.0](docs/development-2.88.0.md).
Mastery, targeted practice, weekly results and notification timing: [2.87.0](docs/development-2.87.0.md).

Weekly competition, notification setup and corrected account levels: [2.86.0](docs/weekly-competition-2.86.0.md).
XP, rotating goals and achievements: [2.85.0](docs/progression-2.85.0.md) (level preservation superseded by 2.86.0).
Shared reward catalogue and backend setup: [2.83.0](docs/exclusive-rewards-2.83.0.md).
Paid Apple developer setup, Firebase activation and device checks: [2.84.0](docs/apple-developer-2.84.0.md).

## 2.20.19
- Made `ModeAtlasKanaData` the single canonical kana inventory owner (240 kana) and moved Kana Metrics/Achievements to consume the same collections and mastery rules.
- Replaced per-page automatic save repair with explicit save-schema migrations; clean page loads no longer schedule cloud sync, while genuine repairs and post-hydration legacy fixes sync once.
- Made Firebase module/setup promises in-flight-only and retryable after transient startup failures, including the reconnect race where online returned while the failed setup was still settling.
- Centralized app version, cache revision, save schema, backup format, cloud snapshot format, and build date in `mode-atlas-version.js`; npm/README metadata now follows the release source.
- Moved formal test result date keys to the shared local-calendar date helper.
- Removed the unused loader compatibility bridge and unused dynamic-module bootstrap code; page-state and achievement lifecycle work is now BFCache/event driven instead of repeating on ordinary focus/pageshow.
- Extended backend tests and release audit rules for canonical kana counts, save-repair sync behavior, Firebase retry recovery, release metadata ownership, and shared dependency order.
