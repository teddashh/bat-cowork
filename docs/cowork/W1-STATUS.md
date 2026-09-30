# W1 status

Not accepted as a Tauri session. The shell still does not compile (`pkg-config` / `glib-sys`, see `apps/bat-desktop/BUILD.md`). The desktop UI is not attached to a daemon.

## What is true now

| Check | Result |
| --- | --- |
| PTY subscribe | `onOutput` / `onExit` return an unsubscribe and deliver nothing, so the imported App can mount. `pty.create`, `pty.write`, and `pty.kill` still throw `UNSUPPORTED_CAPABILITY`. |
| Live read | `packages/server/src/server/cowork/read-only-connection.e2e.test.ts` started a local test daemon, created a directory workspace, and the read-only view listed that workspace, listed `README.md`, and fetched the uncommitted diff. 1 test passed. This was a Node client, not the Tauri window. |
| Writes on that view | `createWorkspace` and `sendAgentMessage` are not on the view. |
| Mutation gate | `authorizeCoworkWrite` is called from `handleSendAgentMessageRequest` and `handleCreateAgentRequest`. Unregistered agents still send. A registered target with a stale revision, the wrong writer, a held dispatch, or a replayed command id is denied. 3 tests passed. No product path registers a target yet, and providers are still not admitted. |

## Tests run

- `node --test test/host-unsupported.test.mjs` in `apps/bat-desktop` — 5 passed
- `node --experimental-strip-types --test src/cowork/*.test.ts` in `packages/client` — 7 passed
- `vitest run src/server/cowork/mutation-gate.test.ts` — 3 passed
- `vitest run src/server/cowork/read-only-connection.e2e.test.ts` — 1 passed

## Still closed

No Tauri window, no desktop connection, no managed task running on the daemon, no provider dispatch, no production VM.
