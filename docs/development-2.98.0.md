# Mode Atlas 2.98.0

Public version **2.98.0**, iOS build **2080020**, on
`agent/mode-atlas-2.68.0-ios-theme` in `ModeAtlas/mode-atlas`.

Public publication of this release's source and artwork was explicitly approved on
14 October 2026. The [GitHub release gate](https://github.com/ModeAtlas/mode-atlas/actions/workflows/release-check.yml)
records the full Firebase, browser and native build results for each commit. Use the
successful run for the exact downloaded commit when assessing release readiness.

## Changes

Sign-out now removes the departing account's local learning save, Words, app-owned
preferences, drafts and legacy per-account caches. Signed-in offline work remains
available and syncs on reconnect. Before clearing, sign-out tries to confirm the
current save online; otherwise it asks whether to keep studying or discard the
unconfirmed device copy. A failed Firebase sign-out retains the save. Reloading
drops private module state and Firestore's memory cache. UID/epoch guards prevent
late work from a previous session being applied, including A → signed out → A.
Cross-tab ownership changes stop practice without checkpointing into the new save.
Native widget/reminder reset no longer waits behind network push-token deletion,
and reset removes delivered app notifications as well as the widget snapshot.
Genuine guest-progress adoption on first sign-in remains unchanged.

Writing ignores unfinished Japanese IME composition and evaluates the committed
character once. Both keyboard formats show a romaji cue; the conversion format
explains kana conversion and Enter. Words validates malformed saved rows, safely
edits arbitrary IDs, normalizes halfwidth kana, improves syllabic-n romanization,
and rejects delayed deletion confirmations after the account changes. Moderation
report snapshots now include the reported character's exact normalized wardrobe.

The Hunny pendant sits above the bear face. Hunny jumper and pendant are **10 coins
each** and require both the existing private audience and their own purchase grant.
The banner/ears keep existing access; developer preview remains available. Previously
selected unpaid pieces fall back until bought. Hidden offers, server purchase checks,
ownership/revocation and receipt retry behavior are covered. No real-money payment
functionality is enabled.

Web and native builders share a strict runtime-file allowlist. Code, rules and
security limitations are documented in [the security and logic review](security-and-logic-2.98.0.md).
In particular, client-writable XP can still influence earned coins, and fabricated
study receipts remain a weekly competition risk. The repository is public; shipped
and publicly committed art cannot be treated as secret. These findings are not
represented as fixed by UI restrictions or packaging.
Production-dependency audits also identify gRPC/uuid advisory chains; the review
records their observed reachability and a compatible-upgrade follow-up. Dependencies
were not force-updated or downgraded.

## Validation and release boundary

Completed locally: **177 JavaScript, 15 Python, 258 unique browser checks** (208
polish + 12 simulated iOS shell + 38 packaged web smoke), and **53 real Auth/
Firestore/rules tests using direct service calls**. Browser coverage was reconciled
against the complete release test list across main and focused runs. The full
callable/trigger emulator encountered an environment `EPERM` connecting to its local
worker socket; full callable/trigger verification therefore runs in GitHub CI,
alongside native Swift/Xcode validation. No simulator/archive result from an earlier
release is counted for this source.

The local release gate covers audit, JavaScript/Python regressions, generated assets,
Firebase configuration and the deterministic native web payload. Targeted browser
checks cover the 112-case preset/session/direction/platform matrix, modifiers, IME,
Words and the Hunny artwork. Full GitHub release validation additionally runs the
web/iOS polish and shell checks, packaged website smoke tests, real Firebase
callable/rules/deletion-trigger tests, Swift widget/navigation/router tests,
iPhone/iPad simulator builds and an unsigned Release archive. Test outputs and final
job conclusions accompany the handoff; targeted harness failures are corrected before
the full gate, without weakening the product assertions.

Native CI uses Xcode 26.3. The physical Xcode 27/iOS 27 checklist is in the review.
The agent pushes the development branch and provides source; it does not merge main,
deploy Firebase, publish the website or upload TestFlight. Deploy the backend before
installing this client so the exclusive offers and moderation snapshots are current.
No new Apple capability, provisioning profile, Firestore index or client-writable
collection is required. App Check enforcement is not enabled by this release.

## Mac update

After the release gate passes for this commit, close Xcode and run:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.98.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.98.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.98.0' &&
npm ci &&
npm run social:install &&
npm run build:social &&
npm run social:deploy &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

The named backup and stash preserve manual **Mode Atlas Development** signing
choices, alongside ignored local signing/widget configuration. Packages resolve
afresh. Select App and your iPhone, press Cmd+R and verify **2.98.0 / 2080020**.
Then run the privacy, keyboard and exclusive-purchase checks in the review.
