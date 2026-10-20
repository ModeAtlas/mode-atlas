# Mode Atlas 2.109.0 — The approved identity in the real app

Version 2.109.0 · iOS build 2080031 · 20 October 2026.

## Changes

The approved design is implemented in the production website and the shared web payload packaged by Capacitor. It does not depend on the private prototype.

- The outlined あア symbol and spaced **Mode Atlas** name now identify the shared navigation, loading screen, default app icon and launch mark. Existing reward icons retain their collection artwork.
- Desktop navigation uses a persistent destination rail. iOS retains its native bottom dock, safe-area handling, profile access and keyboard behaviour. Light/dark are neutral defaults; owned collection themes keep their palettes.
- Home uses one responsive implementation for both platforms: live learning recommendation, full avatar, streak, level/XP, goals, reviews, weekly recap and a prominent practice entry. The separate iOS Home markup, renderer and stylesheet were removed.
- Learn presents Kana, Kanji and Word Bank as illustrated sibling branches. Shared test results and the real study recommendation remain accessible without repeating each branch's internal menu.
- Kana gives Learn and Practice equal prominence. Character tiles open real lessons, and the adjacent row path reflects actual unlocks. Practice offers the existing session families and a focused customization sheet. Returning to practice retains the last saved eligible rows, pace and feedback choice.
- The full shop gives collection artwork and individual items more room, while retaining the compact profile preview. Progress uses compact goal tiles and per-skill mastery indicators. Weekly rankings present the first three qualifying rows as a podium using server ranks, with profile actions, ties and pagination retained.
- Kanji, Word Bank, Results, profiles and account/settings panels consume the shared visual system. The existing learning and account controllers remain their functional owners.

## Ownership and functionality review

| Area | Presentation owner | Retained functional owner |
| --- | --- | --- |
| Brand/navigation | `frontend_components.py`, navigation/responsive CSS, `assets/brand/mode-atlas-symbol.svg` | Existing document routing, native dock and focus controls |
| Home and Learn | Home page; shared `mode-atlas-branch-library.js`; hub page | StudyPlan, Progress, RewardsUI, Portrait and AvatarArt |
| Kana lessons/path/practice | Kana page and its stylesheet | KanaLearning, KanaPlacement, KanaPractice, trainer controllers and review policy |
| Mastery and goals | Existing mastery and rewards UI components | Exact target rules, earned milestone retention and progression |
| Shop and themes | Existing ShopUI and full-shop CSS variant | Catalogue, entitlements, both currencies, theme-preview lifecycle and server purchases |
| Friends/rankings | Existing SocialUI and social CSS | Existing callable boundary, privacy, profile requests, weekly scoring and pagination |
| iOS package | Existing native bundle generator and chrome | Auth, sync, widgets, notifications, native keyboard and native routing |

No prototype account data, sample friends, fake wallet, progression engine or purchase controller was imported. Source assets are canonical; revisioned assets and native metadata are generated. Existing save schemas and Firebase behaviour are unchanged, so this release needs no Firebase deployment.

The review removed the superseded Home implementation and unused per-page brand configuration. It also removed broad light-mode element overrides that conflicted with semantic component colours. Desktop trainer panels now reserve their own column instead of overlapping navigation. Build scripts and source-only files remain excluded by the public runtime allowlist.

## Verification

The release runs the existing source audit, Python and Node suites, desktop/mobile website smoke, simulated native shell, full web/iOS polish matrix, Firebase emulator, iPhone/iPad build and unsigned archive gates. Additional regressions exercise remembered Kana settings and podium ties/pagination. Layout evidence covers light/dark, narrow devices, desktop, and larger text.

The historical pre-iOS website paint comparison was replaced because the user explicitly approved a website redesign. Its isolation requirement remains stricter: removing the native-only theme sheet must leave every visible web element's computed paint unchanged. Approved web palette and identity assertions cover all main routes. The unnecessary historical-baseline git fetch was removed; no test shard or release gate was removed.

Exact CI results and elapsed times belong to the final commit's GitHub run and handover. Physical iPhone/iPad review remains necessary for signed provider flows and touch/VoiceOver behaviour; simulated browser checks are not a physical-device claim.

## Mac update

Close Xcode. The command below preserves your local signing files and resolves Swift packages afresh.

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.109.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.109.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.109.0' &&
npm ci &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Select App and your iPhone, press Cmd+R, and confirm **2.109.0 / 2080031**.
