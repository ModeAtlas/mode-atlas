# Mode Atlas 2.120.0 security review and activation guide

Reviewed 21 October 2026. This is a source, dependency, packaging and automated-test review. Production Firebase IAM, deployed rules, provider settings, billing, Apple account settings and physical-device attestation cannot be verified from this workspace. A new account on the public site is consistent with the current open registration policy; it is not evidence of an intrusion.

## Findings and changes

| Area | Finding and action |
| --- | --- |
| Account access | Callables now check revoked sign-in sessions against the actual Auth record. New Admin controls commit an immediate Firestore access barrier before revoking sessions or suspending/restoring an account. They require a fresh sign-in, a reason and real server-side administrator authority. Owner/self lockout is prohibited. Interrupted changes stay blocked and appear as pending in a 90-day audit log. |
| Firestore | Owner saves now require verified accounts. New app-data writes are limited to the current save document and known sections. Part IDs, total part references and part contents are bounded; new parts must be referenced by the same atomic save. Server-only collections, including monitoring and audit records, remain denied to all client SDK reads/writes. |
| Save processing | Client and server share part-name, part-count, size, nesting and JSON complexity limits. Reads are bounded to 20 parts per batch and 16 MiB per save. This avoids attacker-controlled read/memory amplification. Invalid saves stop projection retries, are skipped by scheduled per-account tasks and remain visible as a save-health issue to Admin. A malformed winner's save holds that prize for review without blocking other winners. Transient infrastructure errors still retry. |
| Browser | A shared Content Security Policy blocks arbitrary inline scripts, inline handlers, embedded objects and unapproved resource origins. All generated pages receive it. Legacy redirects use an external script and retain query/hash handling. A referrer policy limits information sent to other sites. Styles still permit inline values used by existing appearance components. GitHub Pages does not provide repository-defined response headers; a meta CSP cannot enforce `frame-ancestors`. If moving hosting, add response-header CSP framing protection and `X-Content-Type-Options: nosniff`. |
| Native sync | The iOS Firebase bundle was missing `runTransaction` and `updateProfile`. Both exports are restored. A contract test checks bundled SDK exports against every method cloud sync imports. The App Check plugin is integrated through Capacitor/Swift Package Manager with the existing shared Firebase app. |
| Dependencies | Targeted updates remove the reported gRPC and UUID issues from the app and deployed Functions trees, and MCP/basic-ftp issues from tooling. No forced framework downgrade was used. Weekly Dependabot checks cover all three npm trees and GitHub Actions. |
| Credentials | A CI guard rejects common private-key/token patterns and signing/environment files without printing credential values. The available full Git history scan checked 2,544 textual objects and found no matches for those patterns. Public Firebase application configuration is intentionally distributed and is not an Admin credential. Pattern scans cannot prove that no secret has ever been exposed. |
| Public files | The existing explicit publication allowlist excludes backend source, tests, documentation, signing files and source maps from both web delivery and the native web payload. Frontend code, shipped cosmetic assets and client-side developer UI code remain inspectable; server authorization protects the underlying data and actions. |
| Account boundaries | Existing sign-out confirmation, last-sync information, offline signed-in work, account-switch cancellation and device-save clearance were reviewed and regression-tested. Revocation stops subsequent cloud requests; it cannot recall data already downloaded to an offline device. |
| Economy and moderation | Existing server-owned wallets, validated answer receipts, exclusive grants, staff checks, mutual blocks and idempotent purchases remain in place. Personal learning saves are editable by their owner and are not proof of genuine study; they must not become a source of paid currency or verified competitive scores. |

## New developer tools

- **Accounts → Inspect:** reported level, Kana introduced/practised and answer totals, alongside save health, providers, wallet totals and verified receipt summaries. Raw saves, private Word Bank entries, passwords and tokens are not returned.
- **Accounts → access controls:** end all sessions, suspend, restore. Enter a reason and reconfirm sign-in. These actions do not delete accounts. Retry a pending action to finish the Auth change.
- **Security:** actual callable App Check enforcement status, recent access changes, held weekly reward reviews and a link to Firebase for provider logs and quotas. Held prizes require investigation; there is no automatic award bypass.
- **Usage:** opt-in guest installation counts over 24 hours / 7 days / 30 days, paginated latest summaries, level, XP, introduced/practised Kana, answer totals and last branch. These are reported metrics, not verified study receipts or a count of all people visiting.

Guest reporting creates no anonymous Auth accounts. It stores no email, Auth UID, IP address, fingerprints, typed answers or Word Bank content in its application records. Hosting/Firebase providers may still process network addresses in service logs. Guests choose **Settings → Share guest learning** when collection is activated. Reports are sent at most once per minute, expire after 30 inactive days, stop on account change/reset, and can be removed. Offline removal retries; a 35-day tombstone prevents late uploads from recreating a withdrawn report. Clearing browser/app data can lose the local removal identifier. Database TTL deletion is asynchronous.

Collection is initially **off**. The separate `modeAtlasUsage` endpoint always enforces App Check, even while the account endpoint remains in monitoring mode. The report service has per-device throttling plus shared ceilings of 60 accepted reports/minute, 3,000/day and 100 new report/removal identifiers/day. These are application write limits, not a guarantee of zero request charges or a complete bot defense. Existing guest activity cannot be reconstructed retroactively.

## Required Firebase activation

1. Deploy this release's Functions, rules and indexes using the combined command in `development-2.120.0.md`. The new Admin actions require that deployment. Confirm TTL policies for `securityAudit`, `usageReports` and `usageOptOuts` appear in Firestore.
2. In Firebase Console, select **mode-atlus → App Check**. Register the web app with **reCAPTCHA Enterprise**. Use the actual public domains (`mode-atlas.app`, and `www.mode-atlas.app` if served). Keep the public site key; it is not a secret credential.
3. Register the **app.modeatlas** iOS application with **App Attest**, using the correct Apple team. Complete Apple's App Attest capability/provisioning and production entitlement setup before enabling the native provider. Test on a real supported device. Debug providers/tokens are for trusted development builds only and must never ship or be committed. The plugin uses App Attest on the supported iOS versions.
4. In `firebase-config.js`, set `MODE_ATLAS_APP_CHECK.webSiteKey` to the registered public key and set `iosEnabled: true` only after the native setup is ready. Rebuild/release both clients. No private signing or service-account key belongs in this file. The Settings consent control appears only when its platform is configured.
5. Verify valid attested requests in Firebase App Check metrics, including web Google sign-in, iOS Apple/Google sign-in, save/reload, Friends, rewards and a consenting guest report. Verify that missing/invalid tokens are rejected by `modeAtlasUsage`.
6. Once supported client versions are attesting, enable App Check enforcement for **Cloud Firestore**, and set `MODE_ATLAS_ENFORCE_APP_CHECK=true` in the Functions environment (for example the untracked `backend/functions/.env.mode-atlus`), then redeploy Functions. Do not enforce against old supported app builds before updating them. The developer Security tab reports the actual Functions flag.
7. Review Auth authorized domains, enabled providers, quota/billing alerts, project IAM and API-key API restrictions. Firebase client API keys are public identifiers; restrictions must still permit the APIs used by Auth, Firestore, messaging and App Check. Keep Admin/service-account credentials private. Check any unused Storage buckets separately and deny client access if they are unused. None of those live settings was changed by this source release.
8. Update App Store Connect's privacy answers before distributing an iOS build that enables reporting. Product Interaction and Device ID analytics purposes are included in the native privacy manifest. No cross-company advertising tracking was added.

App Check complements authentication and access rules. It does not prove a human studied, prevent all abuse from a genuine app/device, or make a public sign-up page invite-only. Budget alerts notify; they are not a hard spending cap.

## Making the GitHub repository private

Current source repository: `ModeAtlas/mode-atlas`. Current hosting: GitHub Pages with the custom domain `mode-atlas.app`.

1. **Check the owning account's plan first.** Private-repository Pages requires GitHub Pro, Team or Enterprise. On GitHub Free, changing this repository to private automatically unpublishes Pages. Upgrade the personal account to Pro if appropriate, or migrate the already packaged public site to another host before switching. If moving hosting, update/verify the custom domain and DNS; do not leave dangling Pages DNS.
2. Confirm the connected Codex/GitHub app remains installed for the owning account and is authorized for `mode-atlas`. Retain its existing write permission. Private repositories are supported when the connection has access; privacy itself does not require ending development access. After changing visibility, verify repository access in this workspace. Do not replace the existing development connection with a read-only integration.
3. Open the repository → **Settings → General → Danger Zone → Change repository visibility → Private**, read the effects and confirm the repository name.
4. Check **Settings → Pages**, the latest Actions run, and the live custom domain. Verify the authenticated local clone can still pull and that the connected development workflow can access the private repository.
5. Review collaborators, enable strong account sign-in/2FA, retain dependency alerts and require the release CI checks on `main` through an appropriate branch rule. Some security features and private Actions usage depend on the plan; check them before switching.

The repository's visibility was not changed by this release. Existing public copies/forks cannot be recalled. A private repository hides source/history from casual browsing but not JavaScript/assets delivered to browsers or resources bundled in iOS. Public registration is a separate policy: an invitation-only beta needs a server-enforced invitation/allowlist design, not a hidden button or private GitHub setting. No unfamiliar account was removed or suspended automatically.

## Remaining dependency advisories

The root/app and deployed `backend/functions` npm trees report **zero known vulnerabilities** after the selected updates. The deployment/test tree retains **two distinct advisories**, represented by five npm dependency-chain entries:

- `braces <=3.0.3`, GHSA-vfj7-8cjw-p6xm: stack exhaustion on deeply nested patterns; no upstream patched release was available at review time.
- `@opentelemetry/core <2.8.0`, GHSA-8988-4f7v-96qf: inbound baggage parsing limits. The CLI dependency is on the older OpenTelemetry API line; forcing a major API override is not an appropriate security fix without an upstream-compatible update.

These packages belong to Firebase deployment/test tooling, not the published browser/iOS payload or deployed Functions dependency tree. Keep emulators bound to loopback, do not expose the CLI/MCP tooling as a public service, and do not feed untrusted glob patterns to build tools. Dependabot will surface upstream updates. This is a documented residual, not a claim that every dependency is vulnerability-free.

## Sources

- https://firebase.google.com/support/guides/security-checklist
- https://firebase.google.com/docs/auth/admin/manage-sessions
- https://firebase.google.com/docs/app-check
- https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
- https://firebase.google.com/docs/app-check/ios/app-attest-provider
- https://firebase.google.com/docs/projects/api-keys
- https://capawesome.io/docs/sdks/capacitor/firebase/app-check/
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt
- https://developer.apple.com/app-store/app-privacy-details/
- https://github.com/advisories/GHSA-8988-4f7v-96qf
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
