# Runtime contracts

These interfaces keep learning policy, presentation, saves and account transport separate. They retain the current runtime rather than introducing a framework migration.

| Boundary | Owner and interface | Required behavior |
| --- | --- | --- |
| Learning transitions | `ModeAtlasLearningEvents.emit(type, branch)` / `subscribe(listener)` | Five approved transition types, three branch IDs. Subscribers receive only type and branch; never an answer, user ID or lesson content. The returned unsubscribe function removes the listener. |
| Optional measurement | `ModeAtlasUsage` subscribes to learning transitions | Consent and account checks remain in the measurement owner. Stopping sharing clears local counters and requests report deletion. Storage failure/recovery are operational events, separate from learning transitions. |
| Save projection | `ModeAtlasSaveSections.definitions`, `empty(section, field)`, `project(section, reader)` | One field/key/type schema supplies live snapshots, old-format import and restoration defaults. No network, UI or storage effects occur in this owner. Empty values are newly allocated. |
| Merge | `ModeAtlasSaveMerge.section` and each branch's normalize/merge owner | Branch semantics determine convergence. A lesson checkpoint and its contextual review have separate merge timestamps; restarting a lesson cannot discard a newer review. |
| Account transition | `cloud-sync.js` emits `modeAtlasAccountWillChange` before switching local ownership | Active sessions close and clear pending UI work synchronously. Auth owns the transition; page controllers do not start their own hydration. |
| Account transport | `ModeAtlasAccountTransport.create({valid, ...})` | Cloud sync supplies a guard checking UID, account epoch and local-save readiness. Reads and transaction writes check the guard after asynchronous work; a UID alone is insufficient after sign-out/sign-in. |
| Durable answer | `ModeAtlasStorage.transaction(action)` | Evidence, personal progress and checkpoint commit through the synchronous recovery journal. A rejected write does not advance the question; retry cannot award twice. |
| Kanji normalization | `ModeAtlasKanjiState.read/save/record` | Public saves normalize untrusted input. Read returns a detached copy. Internal answer updates normalize the changed row and bound receipts; the exact stored serialization invalidates the private cache after replacement or rollback. |

`tests/release-integrity.test.js` exercises the event and projection contracts plus contextual scheduling/merge. `tests/backend.test.js` exercises account changes, cloud concurrency, backup/reset and late asynchronous work. `tests/kanji.test.js` covers normalization equivalence, replacement, rollback, idempotency and bounded answer receipts. Browser tests cover the rendered journeys and lazy-loading boundaries.

Account-sheet presentation loads on activation. Legacy Friends/Progress URL routing runs before that activation, so opening a bookmark does not depend on opening Account.
