# Mode Atlas 3.0.0 handover

Version **3.0.0**, iOS build **2080046**. Branch:
`agent/mode-atlas-2.68.0-ios-theme`.

Completion correction: this handover describes implemented changes, not completion
of the entire PDF. The [3.0.1 PDF audit](reviews/3.0.1/pdf-completion-audit.md)
records the remaining implementation and validation gaps.

This update applies to the shared website and iOS web runtime, learning data,
Firebase services/rules and operational tools. The shared flame correction from
2.122.0 is included. Coin-purchase placeholders remain as requested.

## What changed

- **First use:** Home has introductory content and a first-five-Kana action instead
  of empty personal statistics. A returning learner gets the personal overview.
  Consent and tour flags do not determine learning state. Restored statistics,
  scheduled reviews and legacy aggregate learning are recognized.
- **Navigation:** Home remains the whole-app hub. Learn is the three-branch directory,
  ready for future branches. Kana has a focused first lesson and one next step.
  Modes, modifiers, full paths and placement are available through explicit choices.
  Automatic branch tours are removed; Settings can replay them.
- **Learning:** six original practical vocabulary units introduce 30 words with
  Japanese examples, translations, typed reading recall and an application question.
  Word Bank independently schedules meaning, reading and listening practice. Listening
  requires successful device-voice playback before an answer can be checked.
- **Kanji:** current readiness uses recent independent recall rather than lifetime
  accuracy. Earned milestones remain permanent. Dictionary-backed examples were
  added for 545 of the 553 entries missing them; eight remaining rare/name-related
  characters are explicitly taught as isolated readings, not invented contextual words.
  Placement, results and approximate N5–N1 bands explain what they assess.
- **Habits and rewards:** Kana, Kanji, Word Bank retrieval and independent handwriting
  participate in the same study-day policy. Five eligible attempts make a study day;
  bounded idempotent receipts prevent self-assessment from creating unlimited credit.
  Word Bank and handwriting do not mint competitive currency.
- **Consumer controls:** Settings has ordinary learning export and reviewed restore,
  with a contents/replacement preview and explicit confirmation. Guest backups can
  be restored into the current account; another signed-in account’s backup is rejected. Backups exclude
  authentication, staff state, wallet balances, purchases and reward outboxes.
  Appearance exposes System/Light/Dark directly; wardrobe categories and availability
  are disclosed one at a time. Explicit rewards links also work before any learning.
- **Runtime:** optional avatar, social and mastery interfaces load on demand. Large
  JSON transactions use verified compact journals when safe, preserving synchronous
  last-answer durability. Recent Kanji evidence is bounded across devices. Save-part
  limits agree across client, rules and backend.
- **Security:** verified rewards require an account-bound server-issued session,
  expiry, token and seeded question sequence. Arbitrary prompts, backdating, altered
  configuration and receipt replay are rejected. Suspicious timing can hold new
  rewards for review without erasing learning or existing balances. Administrator
  authority comes from a server Auth claim, not an email address. Moderator changes
  require recent sign-in; moderation/access actions have audit records.
- **Operations:** optional guest reporting includes bounded lesson/practice/review,
  exit, recovery and day-2/day-7 counters. No collection before consent, no typed
  answers or vocabulary contents, and withdrawal removes the local report and
  requests server deletion. App Check remains mandatory for guest reporting.

## Evidence and limits

`npm run release:check` passed the Python/build/security/package checks and 267
JavaScript tests. The Auth/Firestore/rules and service emulator suite passed all
83 tests, with the expanded five-test security suite also passing. Browser evidence is recorded in `3.0.0-implementation.md`; it includes
first-use and returning flows, account changes, all 15 current routes, keyboard
use, enlarged text, restore and interrupted large-save recovery.

The full Functions emulator did not reach its callable/trigger test suite: it
could not register the Firestore Eventarc trigger at its local emulator endpoint.
A loopback-only proxy exclusion did not resolve it. This is not counted as a pass.
The existing CI callable/trigger and native compile/archive gates remain required.
No Xcode, physical-device VoiceOver/APNs/WidgetKit, independent educator review,
real-learner retention study or production security-console inspection was performed
in this Linux workspace. The release implements the changes; it does not claim
those external validations have happened.

Home's initial script payload was reduced from 813,455 to 772,658 raw bytes in the
measured baseline (93 to 92 script requests; 265,725 to 254,472 gzip bytes). This is
about a 5% reduction, not a complete runtime rewrite. A 2.34-million-character
interrupted-save fixture used a 219-character recovery journal and recovered in
154 ms on desktop Chromium and 191 ms under mobile emulation. These are local
fixture measurements, not physical iPhone latency or guaranteed performance.

## Deployment and administrator migration

Deploy Firebase before distributing the 3.0 client. Older clients keep local study,
but their unissued reward receipts no longer earn currency. Export learning first
when rehearsing upgrades; do not reset an existing account to make a test pass.

Before the backend authority change, a trusted project operator must grant the
existing owner's verified Firebase Auth UID the `modeAtlasAdmin: true` custom
claim. `backend/tools/set-admin.cjs <UID> grant` performs that explicit migration
with Application Default Credentials and revokes refresh tokens. It neither finds
an administrator by request email nor grants access automatically. Sign in again.
Never commit service-account credentials or distribute them with the app.

With trusted project-operator Application Default Credentials, replace the UID
placeholder with the existing administrator's Firebase Authentication UID:

```bash
GOOGLE_CLOUD_PROJECT=mode-atlus node backend/tools/set-admin.cjs YOUR_EXISTING_ADMIN_UID grant
```

This is a one-time required migration, not a new account or a request to share
credentials. Firebase CLI login alone does not necessarily configure Admin SDK
Application Default Credentials.

The source includes App Check integration, but this checkout's web provider key is
blank and native attestation is not enabled. Do not switch enforcement on blindly.
Use `security-2.120.0.md` to register real providers and validate supported clients;
then enforce the account-call flag. Live IAM, quotas, alerts, TTL activation and
provider settings were inaccessible here. TTL configuration now includes study
sessions, reward-review records and security audits; deploying indexes does not
prove TTL cleanup has already executed.

Developer Security lists held study rewards. After investigating a false positive,
a project operator can use `backend/tools/release-study-hold.cjs <UID> <operator>
"<reason>"` with Admin credentials. It audits the release, resets the timing sample
and resumes future rewards; it does not invent rewards for previously held answers.

Server-issued prompts constrain receipts, but public client code, seeds and answer
keys can still be automated. This is abuse resistance, not proof of human learning.

## Mac update

Close Xcode and download `Mode-Atlas-3.0.0.bundle` to `~/Downloads`. This handover
delivers the source locally; it does not claim the GitHub branch, website or
Firebase deployment has been updated. The bundle contains both the 2.122.0 flame
fix and 3.0.0, based on the existing remote branch. Fetching origin first supplies
its prerequisite history. All merges below are fast-forward only.

Preserve the local project file, Info.plist and Package.resolved before the update.
Restore the project and Info.plist copies before `npm run ios:sync`; that script
reapplies this release's version and source registrations while preserving local
team/App Group/signing choices. Retain the backup and stash until the device build
is verified. Package resolution is regenerated for the current source.

Have trusted project-operator Application Default Credentials configured first.
The command asks for the existing verified administrator's Firebase UID locally
in Terminal; it grants the new claim before deploying the backend. Do not paste
credentials into the chat. A missing credential, failed migration or divergent
checkout stops the command. The original Xcode files remain in the backup and
stash if any step fails.

```bash
bash <<'MODE_ATLAS_3'
set -e
cd "$HOME/mode-atlas"
test -f "$HOME/Downloads/Mode-Atlas-3.0.0.bundle"
mode_atlas_backup=$(mktemp -d "$HOME/mode-atlas-xcode-3.0.0-XXXXXX")
cp ios/App/App.xcodeproj/project.pbxproj "$mode_atlas_backup/project.pbxproj"
cp ios/App/App/Info.plist "$mode_atlas_backup/Info.plist"
cp ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved "$mode_atlas_backup/Package.resolved"
git stash push -m "Mode Atlas Xcode backup before 3.0.0" -- ios/App/App.xcodeproj/project.pbxproj ios/App/App/Info.plist ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
git switch agent/mode-atlas-2.68.0-ios-theme
git fetch origin agent/mode-atlas-2.68.0-ios-theme
git fetch "$HOME/Downloads/Mode-Atlas-3.0.0.bundle" agent/mode-atlas-2.68.0-ios-theme
git merge --ff-only FETCH_HEAD
cp "$mode_atlas_backup/project.pbxproj" ios/App/App.xcodeproj/project.pbxproj
cp "$mode_atlas_backup/Info.plist" ios/App/App/Info.plist
test "$(node -p "require('./package.json').version")" = '3.0.0'
npm ci
npm run social:install
npm run build:social
printf 'Existing verified administrator Firebase UID: '
read -r mode_atlas_admin_uid < /dev/tty
GOOGLE_CLOUD_PROJECT=mode-atlus node backend/tools/set-admin.cjs "$mode_atlas_admin_uid" grant
npm run social:deploy
npm run ios:sync
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
npm run ios:open
MODE_ATLAS_3
```

Choose **App**, your iPhone, and **Cmd+R**. Confirm **3.0.0 / 2080046**.
Sign into the administrator account again after the claim migration.

Check a genuinely empty guest installation and your existing account separately:
first lesson without setup clutter; advanced Kana access; returning Home; a practical
word lesson and later reading review; offline practice/reconnect; export/restore;
account switching; the same study day in the app and widget. Verify native audio,
Japanese IME, VoiceOver, large text, permissions and notifications on the device.
