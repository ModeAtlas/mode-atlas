# Mode Atlas iOS Firebase registration

The iOS shell uses the same Firebase project and the same Firebase user identities as the Mode Atlas website.

## Ownership model

- Native iOS owns the Google account chooser.
- The existing Firebase JavaScript Auth instance remains the single authenticated session owner used by `cloud-sync.js` and Firestore.
- The Capacitor Firebase Authentication plugin runs with `skipNativeAuth: true`; it returns the Google OAuth credential to the shared web session instead of maintaining a second Firebase session.
- SRS, results, mastery, achievements, Word Bank and cloud merge logic remain unchanged and JS-owned.

## Required Firebase Console registration

The native Google sign-in transport needs one Apple app registration in the existing Firebase project:

- Bundle ID: `app.modeatlas`
- Firebase project: `mode-atlus`

The resulting `GoogleService-Info.plist` belongs at:

`ios/App/App/GoogleService-Info.plist`

The file must contain the iOS-specific `GOOGLE_APP_ID`, `CLIENT_ID` and `REVERSED_CLIENT_ID`. These values cannot be safely inferred from the existing web Firebase app registration.

After the file is available, run:

`python3 validate_ios_firebase_config.py --require`

Google Sign-In also requires the plist's `REVERSED_CLIENT_ID` to be registered as an iOS URL scheme. That project setting should be generated from the real plist rather than checked in with a guessed or placeholder client ID.

The checked-in `modeatlas` URL scheme is reserved for Mode Atlas navigation, for example `modeatlas://open/reading?mode=daily`. It is separate from the Google callback scheme and does not replace the required `REVERSED_CLIENT_ID` registration. Capacitor's App plugin routes recognized Mode Atlas links into the shared web trainer setup; unrelated callback URLs are ignored by the navigation router.
