# Mode Atlas 2.111.0 — Finish the details and unify the identity

Version 2.111.0 · iOS build 2080033 · 20 October 2026.

## Changes

- Rewards category marks stay inside their tiles. App icons now show the real asset, including the default icon, and category headings use less vertical space.
- Kanji uses compact phone level selectors, a selected-level summary and a clear unlock information button. The next lesson has bounded artwork and concise copy. The existing level gates, set lengths, focus choices, lessons, practice and tests are retained.
- The Shop removes repeated introductions, aligns the two currency balances, and brings collections into the first screen. Both currencies, balance refresh, earning information, categories and the 500-coin prompt retain their existing owners.
- About replaces the old nested cards and gradient logo with the brand identity, side-by-side version/date, simple save-status rows and compact tabs. What’s new describes the current experience.
- The wider review brings the avatar editor onto the active theme and fits its character beside the message/name controls on phones. Kanji Results shares the illustrated empty-report presentation and native navigation order with Kana Results. Populated history, filters, analysis and practice links remain.
- Small dialogs respect the top and bottom safe areas. The loading screen uses the neutral app canvas.

## Identity

The connected あア symbol is retained and made consistent across navigation, loading, About, default and collection icons. An outlined Sora wordmark with optical spacing makes **Mode Atlas** read as two words. Horizontal, stacked, dark-surface and single-colour vectors are included. A simplified あ-and-fold micro mark remains legible at browser-tab sizes. The primary Home Screen icon has an opaque canvas; iOS launch text uses a template image that follows light/dark appearance.

See [Brand identity](brand-identity.md) for assets, usage and generation ownership.

## Ownership and validation

Changes are in the existing component, page and stylesheet owners. Shared empty assessment styling lives in the Results navigation stylesheet; there is no new overlay stylesheet, router, learning engine or account controller. The two canonical brand sources are outlined geometry; platform outputs and lockups are generated. Collection icon palettes and reward entitlements remain unchanged.

The four supplied device screenshots were reviewed directly. The wider visual pass covers Home, Learn, Kana, Kanji, Word Bank, both Results branches, Progress, Rewards, Recap, Friends, Shop, Profile, Settings, About, avatar and mastery dialogs. Normal/light/dark, desktop and narrow/enlarged-text layouts are included. A simulated safe area is not physical-device validation.

The existing release gates remain required: source audit, Python/JavaScript tests, runtime/native packaging, browser smoke, all polish shards, Firebase emulator and simulator/archive builds. Added geometric regressions exercise 320/393-pixel level selectors, app-icon containment, aligned wallet figures, visible collection content, About tab/close behavior and safe-area containment. Final results, commit and elapsed times are recorded in the PR and handoff.

No save schema, Firebase rules, rewards pricing or native signing policy changed. No Firebase deployment is required.

## Mac update

Close Xcode, preserve local signing, then update the development branch:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.111.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.111.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.111.0' &&
npm ci &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Select App and your iPhone, press Cmd+R, and confirm **2.111.0 / 2080033**.
