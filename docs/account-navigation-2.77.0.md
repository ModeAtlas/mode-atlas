# Shared account navigation — 2.77.0

Profile, Your Atlas, Friends and Settings are peer sections in one persistent
account surface. The reference screenshot's useful pattern is the clear set of
labelled destinations. Mode Atlas keeps its existing learning dock and branding.

## Navigation

- The profile control opens Profile. Your Atlas and Friends are each one section
  tap away; Friends is no longer reached through a Your Atlas popup.
- The settings control opens Settings directly. Both controls retain their
  tap-again-to-close behaviour. The close button and Escape return focus to the
  control that opened the account surface.
- The same header and section navigation remain visible while content scrolls.
  Section changes are immediate and do not create another overlay.
- Your Atlas retains Goals/Rewards, frames, titles, icons and Mastery Map access.
  The homepage shortcut opens its section directly.
- Settings has Preferences, native Reminders, Data and account, and Application
  groups. There is no extra Data and app disclosure to navigate.
- Sign-in choices, achievements, Mastery Map and confirmations still use the
  shared dialog owner. While a dialog is open, account navigation is inert and
  hidden from accessibility; closing the dialog restores the section and focus.

The shared structure applies to web and iOS. iOS sheet geometry uses the existing
safe-area, visible-viewport and dock measurements. Desktop retains a side panel;
phone/tablet sizing and large text remain supported. Existing theme tokens own
colours. The learning dock, practice modes and web palette are unchanged.

## Ownership

| Source | Responsibility |
| --- | --- |
| `assets/ui/mode-atlas-account-navigation.js` | Single shell, section state, focus, open/close and feature lifetime |
| `assets/ui/mode-atlas-account-bindings.js` | Existing auth/progress/sync presentation and settings actions |
| `assets/ui/mode-atlas-profile-menu.js` | Profile content only |
| `assets/ui/mode-atlas-settings-menu.js` | Settings content only |
| `assets/ui/mode-atlas-rewards-ui.js` | Mount/unmount goals and reward content; shared progress owns earned values |
| `assets/ui/mode-atlas-social-ui.js` | Mount/unmount Friends content; shared transport/server own data and relationships |
| `assets/app/mode-atlas-dialog.js` | Feature/confirmation dialogs and a generic open/closed lifecycle event |
| `assets/css/mode-atlas-profile-settings.css` | Account shell and profile/settings presentation |

The old drawer-binding source is replaced, not loaded beside a new controller.
Profile and Settings no longer construct their own shells. Your Atlas and Friends
no longer create feature dialogs. Leaving Friends disposes its host and invalidates
pending UI responses; account changes still clear social state through the existing
UID/generation checks. No duplicate Firebase app, listener or score calculator is
introduced.

## Verification and handoff

The account navigation suite covers phone widths 320/393, iPad width 820, desktop,
light/dark themes, large text, safe areas, dock clearance, keyboard navigation,
single-surface ownership and cancellation of Reset data. Existing Friends tests
cover account switching, delayed responses, relationships and consent; a new case
checks delayed data after navigating away. The normal release gate also checks
practice, rewards, native auth, web colours and iOS compilation.

This is a frontend release. It does not change Firebase functions, access rules,
schema or dependencies, and requires no backend redeployment. Live two-account
testing reported as planned by the developer remains a separate acceptance check.
Install 2.77.0 through the development branch with local signing settings preserved.
