# Mode Atlas 2.115.0 — Account recovery and responsive pages

Version 2.115.0 · iOS build 2080037.

## What caused the regressions

- Firebase startup conflated an unresolved/failed sign-in restore with a confirmed signed-out account. Friends and Profile could present the wrong state. A browser also retains a failed SDK import until the document reloads, so repeating the same import is insufficient recovery.
- Firestore map ordering made unchanged saves compare unequal. Sync then repeated uploads, downstream projection work and UI refreshes. Empty Kanji test history also used the wrong fallback type. Recursive merge writes could retain fields removed from a saved map.
- Read-only UI consumers repeatedly parsed and normalized the same progression history. Multiple reward redraws and an unnecessary social-profile call added work to each page. Wallet and entitlement request throttles were lost between documents.
- Personal goals already retained their repeat setting, but an open/suspended page had no shared calendar-rollover notification to refresh the visible goal cycle.
- Existing installed web apps retained old icon URLs. Browser tabs also selected the full app symbol instead of the small-size mark. The provided screenshots were inspected; they show different cached logo generations.

## Changes and ownership

Cloud sync now distinguishes restoring, unavailable and confirmed guest states. A failed SDK restore preserves the local account save; an explicit Retry reloads the document to clear the failed module import. Ordinary sync retries keep the current page. Account identity and save activation still belong to the Firebase auth callback. Startup registers its pending attempt before notifying observers; readiness checks join it and do not restart a failed setup.

Canonical value comparisons suppress unchanged writes and redraws. Full owned save fields replace obsolete nested fields, while unrelated top-level fields are retained. Arrays remain order-sensitive, including test history. Live local edits made during a cloud read, account-switch guards and confirmed-server-save checks remain covered by regressions.

Progress exposes an immutable read snapshot, invalidated by the exact saved bytes. Editors retain independent mutable state. UI summary consumers share that validated snapshot, and reward UI refreshes coalesce within a frame. Wallet and entitlement caches reuse a recent result for at most 60 seconds, only after the matching account is authenticated. Explicit refresh, purchase authority, stale-data refresh and account invalidation remain intact. Cached reads do not hide an earlier refresh error.

Friends no longer fetches the full social state solely for an avatar or performs wallet-award transactions during the social read. Saved-account events and Shop remain the wallet-award owners. Profile decoration still checks live reward and staff access. No access rule or rate limit was relaxed.

One local-midnight timer updates goals, home summaries and widgets, with a foreground check after suspension. It uses calendar dates, including the local Monday boundary, and stops while hidden. Repeating goals reset their current-period progress; one-off goals expire. This introduces no second-by-second polling.

The shared page generator now chooses the micro favicon, touch icon and full install icon. Content fingerprints change when the artwork changes, with a stable installed-app ID. Native default and collection icons retain the current brand artwork. Previously installed Chrome apps may ask for approval through **Review app update** after the website release; old installation metadata is not an account-data issue.

## Verification

Source gate: 15 Python checks and 239 JavaScript tests. Added coverage checks unordered Firestore maps, no-op writes/redraws, fresh-versus-stale account caches, save isolation during failed authentication, repeat preservation and real browser import recovery. Browser checks cover Melbourne midnight/Monday rollover, suspension, slow/failed restoration, usable navigation and shared logo metadata. An emulator integration regression verifies that removed fields stay removed while repeat settings and unrelated document fields survive.

The final PR records the exact-commit full browser, Firebase callable/rules/trigger and native simulator/archive outcomes and timings. Local native browser checks simulate the bridge; they do not substitute for a physical iPhone run. No production account was modified or used for tests.

Performance measurements use Chromium at 4× CPU throttling with 120 days of seeded study history. They measure local startup and main-thread work, not production Firebase network latency. 

| Page | DOM ready before → after | Long-task time before → after |
| --- | ---: | ---: |
| / | 1064 → 802 ms | 605 → 366 ms |
| /learn/ | 839 → 506 ms | 405 → 58 ms |
| /kana/ | 741 → 607 ms | 368 → 215 ms |
| /progress/ | 926 → 535 ms | 574 → 115 ms |
| /friends/ | 645 → 694 ms | 231 → 97 ms |

These are single controlled samples; small differences can be noise. Friends document readiness did not improve in this sample, although its main-thread blocking fell. Actual server latency must be checked after deploying the Functions optimisation. Remaining physical-device checks are switching Atlas/Learn/Progress/Friends with the developer's real account, recovering from airplane mode, and confirming the installed icon after updating.

## Deployment

The client fixes are included in both web and the bundled iOS payload. The Friends server read optimisation requires the Functions deployment below. There is no new Firestore rule or index. Deploy the compatible backend before publishing either client. This branch does not deploy production or merge main automatically.

## Mac update

Close Xcode. This command preserves your local signing files before updating the established development branch.

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.115.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.115.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.115.0' &&
npm ci &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Select App and your iPhone, press Cmd+R and confirm **2.115.0 / 2080037**.

Deploy the updated Friends service once from this checkout:

```bash
cd ~/mode-atlas &&
npm run social:install &&
npm run build:social &&
npm run social:deploy
```

On device, switch between Atlas, Learn, Progress and Friends with your usual account; check the profile sync status and an offline/online return. Confirm repeating goals reset at their next boundary. Existing Chrome installations may need their prompted icon update accepted.
