# Dock, feedback and Friends identity — 2.78.0

## User changes

- iOS has a single dock row. Profile stays beside the learning rail, including when the Kana submenu is open. Its account screen provides Profile, Your Atlas, Friends and Settings. A second tap closes that screen.
- Practice setup and Focus use their existing controls inside the practice header. Exit focus remains reachable. The web navigation keeps its existing placement.
- Ordinary buttons, links and changed settings share one short activation sound. Answers, session completion, achievements and status feedback have explicit outcome cues. Typing, cancelled presses and disabled controls are silent; the custom practice keyboard retains its haptics.
- Friends places Refresh beside My code and Add friend. Pending incoming requests have a visible shortcut outside the Requests list and a count on the Friends subtab when viewing Rankings. Counts update on open and refresh, without a new background listener.
- Friends profiles support existing Atlas symbols, a single emoji, or an explicitly selected linked Google account photo. This choice affects the Friends identity; the account/dock avatar continues to use the signed-in account image and earned frame.

## Source ownership

| Responsibility | Owner |
| --- | --- |
| iOS dock placement and measured height | `assets/platform/mode-atlas-ios-chrome.js` and its scoped stylesheet |
| Account screen selection and focus return | `assets/ui/mode-atlas-account-navigation.js` |
| Activation sounds, audio context and preferences | `assets/app/mode-atlas-sounds.js` |
| Toast status and explicit achievement cue | Existing toast/feedback and achievement owners |
| Shared name, emoji and photo URL validation | `assets/app/mode-atlas-social-identity.js` |
| Transactional name claims and legacy migration | `backend/functions/identity.cjs` |
| Authenticated identity writes and profile projection | Existing social service and projection owners |
| Friends presentation and request indicators | Existing social UI and stylesheet |

Controls are moved, not cloned. The extra iOS utility-row implementation was removed. Sound handling no longer guesses an action from button labels or randomises button tones. Backend packaging copies the canonical identity policy; generated revision files and HTML come from the normal build scripts.

## Backend rollout

Deploy the existing social backend before testing the new name rules or avatar choices. No new Firebase provider, capability or function is required. Use the repository's existing `social:install`, `social:deploy` and `social:status` commands. Source publication alone does not update Firebase.

Names are claimed by a normalised key: case, accents and approved separators do not create separate identities. The server rejects protected role/brand names and common disguised forms. Only the verified administrative account may choose the exact name `admin` (case-insensitive); client-supplied claims do not grant this exception.

On first use after deployment, a leased, bounded migration reserves existing names before accepting profile writes. Each batch can resume after interruption. Existing duplicate or disallowed names receive a unique temporary Learner name and an in-app request to choose another. Friend codes, connections and learning progress are preserved. The first caller may briefly see “Friends is updating”; retrying continues migration. Renaming, leaving Friends and account deletion release a name only if that account still owns its claim.

The photo choice is resolved from the authenticated user's Google provider record. The client cannot submit an arbitrary image URL. Only HTTPS Google photo hosts are accepted; no email is exposed in Friends projections. A failed image load falls back to the Atlas symbol.

## Verification

Regression coverage includes dock navigation and focus, practice layout, large text, web colour preservation, uniform sound activation, silent/off cases, incoming request visibility, emoji/photo selection, name collisions, reserved names, legacy migration and account deletion. Local service-emulator checks are supplemented by the release gate's callable/trigger emulator tests and native iPhone/iPad simulator builds.

Physical-device sound and layout judgement remains a device check. Request indicators are refreshed views, not push notifications. Photo changes follow a new profile save; this release does not add account-provider linking or an image uploader.
