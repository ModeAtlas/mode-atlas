# Mode Atlas 2.107.0 — A clearer Kana hub

Version 2.107.0, iOS build 2080029. Release date: 18 October 2026.

## What changed

Kana opens on an Overview again. A recommended row, its characters and familiar
count lead to one Continue learning action. Explore your path opens the full
row roadmap when wanted. A compact progress summary and short practice links
replace the initial wall of curriculum controls. Beginner entry and optional
placement remain available.

Practise now presents a ready-to-use session, a brief explanation of Read,
Recall or Handwrite, and a directly accessible hint toggle. Adjust this session
opens the shared settings in a sheet. Row selection, length, feedback, focus,
sequence pattern and both timed goals remain available there. Daily sessions,
timed challenges and character sequences have concise activity rows instead
of starting with five drop-down menus. Handwriting remains optional.

Switching sections preserves the chosen script and skill. Re-selecting the
current section scrolls up without reloading it; selecting Overview from a
lesson returns to the hub even when the page address is the same.

The accuracy grid now uses the requested practice targets, including before a
session starts, and checks them against the current account's unlocked rows
for that skill. Previously a targeted launch could display the trainer's old
selection until the session began. A row launch also updates the saved row
selection; choosing different rows clears the old target. Account changes
clear pending targets, and obsolete locked selections cannot populate the grid
or appear checked in the row picker. Empty selections have a small inline prompt.

## Ownership and compatibility

The shared study-session owner exposes its eligible focus set to the accuracy
display and question pool. The trainer navigation owner keeps a targeted row
launch and its settings consistent. The existing curriculum remains the owner
of eligibility; no parallel unlock or mastery policy is introduced.

The Kana page owns the overview and practice presentation, the shared practice
component owns configuration, and frontend_components.py owns the branch labels.
Light and dark web/iOS layouts use the existing theme tokens. Learning evidence,
mastery thresholds, row unlock rules, XP, coins and historical results retain
their existing behaviour.

This is a frontend update. No Firebase production deployment, rules/index
change, Apple capability or provisioning change is required. The development
branch is published for testing; main and TestFlight are separate release steps.

## Validation

Focused browser checks cover first entry, placement resume, existing mastery,
handwriting, small iOS and desktop layouts, targeted accuracy in both skills,
locked old selections, account changes, and saving the optional configuration
into real sessions. The release gate also checks source packaging, existing
session behaviours, Firebase emulators, simulated iOS and native builds.
Final pass counts and CI timings are recorded in the PR and release handover.
Physical iPhone/iPad touch and scrolling still need a device check.

## Mac update

Close Xcode and run:

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.107.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.107.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
node -p "require('./package.json').version" &&
test "$(node -p "require('./package.json').version")" = '2.107.0' &&
npm ci &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

This preserves local signing choices and resolves Swift packages afresh.
Select App and your iPhone, press Cmd+R, and check **2.107.0 / 2080029**.
