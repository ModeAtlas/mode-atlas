# Mode Atlas 2.116.0 — Friends loading and connected Kana practice

iOS build 2080038.

## Source and ownership review

The review traced startup/auth restoration, SDK loading, save hydration, event subscriptions, commerce/appearance refreshes, Friends transport and server projections, trainer scoring/persistence/recovery, curriculum rendering and pronunciation. The project audit checks the generated web/iOS asset graph and source ownership contracts. This is not a claim that every unrelated feature was manually exercised or that production Firebase latency was measured.

| Finding | Source change |
| --- | --- |
| Friends loaded a complete private save and rebuilt progress on every visit, duplicating the saved-data trigger. It then read the account and entitlements again. | The trigger owns ordinary projection updates. One transactional self snapshot reads current permissions, restrictions and grants. Only a projection-policy or entitlement change rebuilds the summary from the save. Existing synced timestamps remain visible. |
| Back from a friend profile called the full initial loader; returning to list tabs repeated identical reads. | The mounted Friends screen owns a 30-second first-page snapshot. Back uses that screen. Refresh, relationship actions, account changes and unmount invalidate it. No private friend list is persisted on disk. |
| Full path and preview maintained separate row markup, and native inherited the narrow desktop list. | One path renderer serves both locations. Native adds a winding route through every row; web retains its list. Obsolete full-path CSS was removed. |
| Combined practice was absent, despite shared session/progression owners. | Practice exposes Read, Recall and Read + Recall. The existing trainer coordinator alternates input direction; evidence and XP go to the relevant skill. Both directions must have a row unlocked. Formal tests/daily challenges retain their separate directions and records. |
| Speech rate alone did not reliably lengthen isolated kana. | A dedicated native pronunciation owner renders Japanese speech and applies pitch-preserving waveform stretching. Browser teaching rates are reduced, with a distinct slower setting. Kana spelling is unchanged, including vowel length. |

Firebase app/auth ownership remains in cloud-sync; native Firebase bundles already share one component registry. Wallet awards remain with save/commerce owners. No permissions, privacy checks, rate limits or entitlement enforcement were relaxed. The existing Read and Recall page adapters retain their established test and input options; combined practice reuses the existing coordinator rather than creating a second scoring engine.

## User-visible changes

- Friend cards place the character toward the right and show the saved custom phrase below their identity. Empty phrases produce no placeholder.
- Kana practice exposes three clear choices; handwriting remains directly accessible. Combined sets alternate shape-to-sound typing and sound-to-shape choices, with the existing feedback and session-length controls. Timed and continuous practice remain available.
- Combined answers contribute to the relevant skill and weekly competition. The server determines direction from answer order, rather than trusting a submitted direction. Separate-direction high-score records are preserved.
- Native path markers wind across the available width. All row groups remain available, including locked rows and lessons that can be revisited.
- Native speech buffers stop on cancellation, completion and app inactivity. Short characters receive a deliberate teaching pace; Slower stretches the actual sound without lowering its pitch.

## Verification

Release verification includes the source audit, JavaScript/Python checks, targeted browser cases, the Firebase emulator suite and the native iOS compile/archive gate. Added regressions cover per-skill combined answers on web/iOS, server-side mixed scoring, ordinary Friends reads avoiding private history, list reuse, status/portrait layout and native path geometry. Final counts and timings are recorded in the release PR.

Browser timing does not establish production Firebase latency. Function cold starts and network latency still apply. Physical-device listening remains necessary to judge the installed Japanese voice and audio clarity. Browser speech timing depends on the browser's selected voice.

## Update command

Close Xcode. This command preserves local signing files, updates Firebase first, then opens the updated iOS project. It does not merge the website PR.

```bash
cd ~/mode-atlas &&
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-2.116.0-XXXXXX") &&
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj" &&
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist" &&
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved" &&
git stash push -m "Mode Atlas Xcode backup before 2.116.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved &&
git switch agent/mode-atlas-2.68.0-ios-theme &&
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme &&
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj &&
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist &&
test "$(node -p "require('./package.json').version")" = '2.116.0' &&
npm ci &&
npm run social:install &&
npm run build:social &&
npm run social:deploy &&
npm run ios:sync &&
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App &&
npm run ios:open
```

Choose App and the iPhone, press Cmd+R, and confirm 2.116.0 / 2080038. Check Friends initial loading and Back, the native Kana path, a combined set, and Listen versus Slower on a single kana. Production deployment/website merge is performed separately by the owner.
