# Mode Atlas 3.0.1 handover

Version **3.0.1**, iOS build **2080047**. This corrects the excessive explanations
introduced in 3.0.0. It is a frontend update; it requires no new Firebase deployment,
administrator grant or data migration. Any unfinished 3.0.0 backend setup is a
separate task and is not completed by these commands.

This patch does not complete the original PDF. The
[requirement-by-requirement audit](reviews/3.0.1/pdf-completion-audit.md) corrects
the earlier completion claims and lists the implementation and validation gaps.

## Changes

- Home: remove both extra explanatory cards. New visitors see the first lesson
  and branch choices; returning users retain their personal information and goals.
- Learn: branch cards only, with one short description each and progress when present.
- Kana: show the five characters and **Start lesson**. Keep advanced options in
  the existing disclosure; remove repeated placement and row instructions.
- Lessons and reviews: shorten summaries to results, corrections and next actions.
  Keep Japanese examples and teaching feedback. Put the Word Bank usage tip and
  detailed Kanji progress behind optional disclosures.
- Profile and Progress: remove repeated proficiency explanations and shorten empty states.

Coin-purchase placeholders remain. Learning rules, earned progress, save behavior,
account security and backend source are unchanged. Changes were made in the source
components and styles; obsolete markup and styles were removed. Revisioned assets
and the native bundle are generated from those owners.

## Review and verification

Inspected 16 routes in the browser. For a fresh, consented mobile visitor:

| Main content | 3.0.0 words | 3.0.1 words |
| --- | ---: | ---: |
| Home | 178 | 48 |
| Learn | 102 | 17 |
| Kana | 46 | 19 |
| Word Bank | 66 | 37 |
| Progress | 43 | 21 |
| Kanji | 30 | 21 |

Counts split visible main-content text on whitespace, excluding global navigation.
They measure copy reduction, not learning effectiveness. Home's document height
fell from 1,837 to 966 CSS pixels in the same mobile viewport. None of the 16
reviewed routes had horizontal overflow. Desktop, mobile and simulated iOS light
screens were visually inspected, including new and returning Home.

- `npm run release:check`: passed build, metadata, security, native-web packaging,
  16 Python tests and 267 JavaScript tests.
- 196 distinct targeted browser cases passed across desktop/mobile Chromium and
  simulated iOS flows. Coverage includes first use, returning Home, navigation,
  Kana and Kanji lessons, enlarged text, session summaries, XP, word review
  scheduling, Profile and weekly recap.
- The first additional run had two failures from the weekly recap test expecting
  the removed wording. Updated that existing assertion; both cases passed on rerun.
- Xcode builds, physical-device testing and the full GitHub Actions workflow were
  not run for this patch. Browser iOS simulation is not a device build.

Screens: [Home desktop](reviews/3.0.1/screens/home-desktop.png),
[Home mobile](reviews/3.0.1/screens/home-mobile.png),
[Learn mobile](reviews/3.0.1/screens/learn-mobile.png),
[Kana mobile](reviews/3.0.1/screens/kana-mobile.png),
[Word Bank mobile](reviews/3.0.1/screens/words-mobile.png),
[iOS first visit](reviews/3.0.1/screens/home-ios-new-light.png),
[iOS returning](reviews/3.0.1/screens/home-ios-returning-light.png).

## Mac update

The incremental `Mode-Atlas-3.0.1.bundle` requires the previously imported 3.0.0
commit (`96ea537aa7a4cc531e0a9fd113f6ba78dd9bcc56`). Close Xcode, download the bundle
to `~/Downloads`, then run:

```bash
bash <<'MODE_ATLAS_301'
set -e
cd "$HOME/mode-atlas"
test -f "$HOME/Downloads/Mode-Atlas-3.0.1.bundle"
git bundle verify "$HOME/Downloads/Mode-Atlas-3.0.1.bundle"
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-3.0.1-XXXXXX")
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj"
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist"
if test -f ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved; then
  cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved"
fi
git stash push -m "Mode Atlas Xcode backup before 3.0.1" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
git switch agent/mode-atlas-2.68.0-ios-theme
git fetch "$HOME/Downloads/Mode-Atlas-3.0.1.bundle" agent/mode-atlas-2.68.0-ios-theme
git merge --ff-only FETCH_HEAD
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist
test "$(node -p "require('./package.json').version")" = '3.0.1'
npm ci
npm run ios:sync
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
npm run ios:open
MODE_ATLAS_301
```

Choose **App**, your iPhone and **Cmd+R**. Confirm **3.0.1 / 2080047**. Keep the
backup and stash until the device build is verified. The sync script reapplies
the current version while preserving local signing choices; package resolution
is regenerated instead of restoring the older resolved dependency file.

This bundle and these commands do **not** push to GitHub or publish the website.
The live web version still needs the normal publication workflow. The previous
automatic approval review rejected the source push; this patch does not retry it.
