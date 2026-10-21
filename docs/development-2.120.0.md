# Mode Atlas 2.120.0 — Security and developer monitoring

iOS build **2080043**.

## Changes

- Hardened verified-owner Firestore access, atomic save-part references, aggregate save limits, JSON nesting and revoked-session handling. Malformed personal saves cannot hold up profile retries or other learners' weekly awards; Admin can inspect their save-health problem.
- Added confirmed Admin controls to end sessions and suspend/restore access, with recent sign-in, reason, owner protection and a 90-day audit trail. Security also lists held weekly rewards.
- Expanded account diagnostics with reported level, answer totals and introduced/practised Kana. Added a separate guest Usage dashboard with opt-in, bounded snapshots, retention and withdrawal. It creates no anonymous Auth accounts and never collects private words or typed answers.
- Added shared browser CSP/referrer protection, credential/signing-file guards and weekly dependency update checks. Targeted dependency updates leave no known npm advisories in the app or deployed Functions trees; two toolchain advisories remain documented.
- Fixed missing `runTransaction` and `updateProfile` exports in the bundled iOS Firebase SDK. Added a native/browser SDK contract check and official native App Check integration.
- Updated privacy copy and the native privacy manifest. Existing study, social, reward, avatar and account behaviour is retained.

## Activation and limits

Deploy Firebase before using the new developer controls. Guest collection remains **off until App Check is configured**. Register the web and iOS providers, update the public provider configuration, then release/verify the clients before enforcing account traffic. Repository privacy and public registration were not changed.

See [security-2.120.0.md](security-2.120.0.md) for the reviewed boundaries, residual risks, App Check setup, privacy updates and safe GitHub-private steps. Live Firebase settings and physical iPhone attestation were not accessible here.

## Verification

Local release validation includes 256 JavaScript tests, Python packaging checks, credential scanning, native web bundling and targeted mobile/desktop browser checks. Auth/Firestore/rules service tests run against real emulators. The full callable/trigger suite and native simulator/archive builds run on the exact GitHub commit: the local Functions emulator is blocked by this environment's Unix-socket restriction. CI gates remain in place.

## Update

Close Xcode. This preserves local signing files, updates the source, deploys Firebase first, then prepares Xcode:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.120.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.120.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
test "$(node -p "require('./package.json').version")" = '2.120.0' &&
npm ci &&
npm run social:install &&
npm run build:social &&
npm run social:deploy &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Select **App**, choose the iPhone, press **Cmd+R** and confirm **2.120.0 / 2080043**. Update all devices using the account. If Firebase requests login, run `npm run social:login`, then resume from `npm run social:deploy` onward. The new account-directory endpoints require this Firebase deployment.

Allow roughly **10–20 minutes** for dependency installation, Firebase deployment and native preparation, plus the device build. This is an estimate. Actual CI durations and website publication status belong to the final handoff, not this estimate.

On device, verify Google/Apple sign-in, save/reload, offline study and sign-out; then check Admin directory access, inspection, fresh-sign-in controls and a test-account suspension/restore. Confirm guest reporting remains absent until configured and never interferes with study. Once App Check is registered, verify genuine web/iOS requests, opt-in reporting and withdrawal on real devices before turning on wider enforcement.
