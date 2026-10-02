# Mode Atlas 2.84.0 — Apple developer activation

iOS upload build: **2080005**. This release enables native Sign in with Apple alongside Google. Firebase JS remains the only account/session owner. Existing users link Apple from their signed-in Profile to keep the same UID, progress, Friends identity and account-specific rewards.

## Code included

- Native Apple sign-in, first-authorization name preservation, normal cancellation, and the existing explicit provider-linking flow.
- The Apple action uses Apple's original logo artwork, a black-and-white button, and the approved “Continue with Apple” title. The existing linking confirmation still explains which account will be connected.
- Account deletion reauthenticates the same user, obtains the JS Firebase ID token, revokes Apple authorization, then calls the existing server deletion owner. A failed revocation or changed account stops deletion and retains the device save.
- The native bridge sends revocation to Firebase's documented `accounts:revokeToken` endpoint, using the bundled Firebase project and native bundle header. It has a bounded network timeout and does not persist or log credentials. The native Firebase SDK's revocation method requires a native currentUser, so it cannot be used with our `skipNativeAuth` architecture. The native SDK itself omits redirectUri for a native Apple authorization code; the bridge follows that native request shape.
- App-only Apple entitlements and separate widget entitlements. `ios:sync` migrates existing local App Group settings without changing the registered group or unrelated local settings. No team ID, private key or App Group is invented.
- Explicit paid-team selection can replace the prior local Personal Team setting. Mixed signing teams in the app/widget project still require correction.

## Apple Developer configuration — complete yourself

1. In Certificates, Identifiers & Profiles, open the existing explicit App ID **app.modeatlas**. Enable **Sign in with Apple**, configure it as the primary App ID, and save. Do not add Apple sign-in to **app.modeatlas.widgets**.
2. Confirm the existing App Group is registered on the paid team and assigned to both bundle IDs. Use the actual group from your working widget configuration.
3. Create a **Services ID** for the Firebase Apple provider, or reuse the appropriate existing one. Suggested new identifier: **app.modeatlas.signin**. Record the actual identifier you register.
4. Enable Sign in with Apple on that Services ID. Select **app.modeatlas** as its primary App ID. Add the domain **mode-atlus.firebaseapp.com** and return URL **https://mode-atlus.firebaseapp.com/__/auth/handler**. Save the configuration.
5. In Keys, create a key with Sign in with Apple enabled for **app.modeatlas**. Download its `.p8` file and record its Key ID and your paid Team ID. Enter the key only into Firebase's provider configuration; keep it out of Git, release ZIPs and chat.

## Firebase configuration — complete before using Apple sign-in

Open project **mode-atlus** → Authentication → Sign-in method → Apple. Enable the provider and enter the actual Services ID. Under OAuth code flow configuration, enter the paid Apple Team ID, Key ID and private key from the previous steps, then save.

The OAuth code flow settings are needed for the authorization-code revocation used during account deletion. If Firebase Authentication emails are used, also configure Apple's private email relay with `noreply@mode-atlus.firebaseapp.com` or the actual custom sender domain.

The bundled GoogleService-Info.plist and shared Firebase project remain the same. There are no new Functions, rules or indexes in this release; the compatible 2.83.0 backend must already be deployed.

## Install on the Mac

Close Xcode. Preserve your ignored `ios/signing.local.xcconfig` and `ios/widget-sharing.local.xcconfig` when updating the source. Use the development branch or this version's complete source ZIP. Do not replace the current project with an older saved project.pbxproj.

```sh
cd ~/mode-atlas
git switch agent/mode-atlas-2.68.0-ios-theme
git pull --ff-only origin agent/mode-atlas-2.68.0-ios-theme
npm ci
npm run ios:sync
npm run ios:open
```

If Git reports uncommitted Xcode project changes, review and preserve those changes before pulling; do not force-reset them. `npm run ios:signing` moves an unambiguous team selection out of the project. If an old local Personal Team conflicts with the newly selected paid team, use the current version's explicit `npm run ios:signing -- --team YOUR_PAID_TEAM_ID` after selecting the same paid team for both targets.

`ios:sync` automatically updates an existing local App Group selection. To configure one on a new Mac, run `python3 configure_ios_widgets.py --app-group YOUR_REGISTERED_GROUP_ID`. Both targets must be provisioned for that actual group. Confirm **Automatically manage signing**, the paid team, and a physical device in Xcode, then build and run.

## Device acceptance before TestFlight

1. Existing Google account: sign in normally → Profile → Sign-in methods → Link Apple. Confirm the same progress, Friends identity, Admin access if applicable, and exclusive rewards. Signing in with an unlinked Apple identity creates a separate account; email similarity is not used to merge accounts.
2. Sign out and sign in with Apple. Verify persistence after relaunch and sync to the same account. Test Hide My Email with a disposable account. On the website, Google remains the sign-in option; link Google in the app if that account also needs website access.
3. Cancel the Apple sheet; the account and progress should stay unchanged with no failure dialog.
4. With a disposable account, test deletion cancellation, offline refusal and confirmed deletion. Confirm Apple authorization is revoked and the existing Firebase deletion process completes. Never use a valued account for a destructive acceptance test.
5. Confirm widget progress after a study session and after sign-out, including the paid team's shared container. Recheck reminders and native shortcuts after installing the signed build.

Automated checks validate code, UI, configuration, simulator builds and an unsigned archive. They cannot confirm your private Apple/Firebase settings, signed provisioning, the live Apple sheet, or successful provider revocation. No TestFlight upload or production console change is performed by this code release.

## References

- Firebase Apple setup: https://firebase.google.com/docs/auth/ios/apple
- Apple capability setup: https://developer.apple.com/help/account/identifiers/enable-app-capabilities/
- Apple button design and original artwork: https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple and https://developer.apple.com/design/resources/
- Firebase token revocation: https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/accounts/revokeToken
- Native request shape: https://github.com/firebase/firebase-ios-sdk/blob/12.7.0/FirebaseAuth/Sources/Swift/Backend/RPC/RevokeTokenRequest.swift
- Native session requirement: https://github.com/firebase/firebase-ios-sdk/blob/12.7.0/FirebaseAuth/Sources/Swift/Auth/Auth.swift
