# W1 status

Not accepted as a Tauri session. The shell still does not compile (`pkg-config` / `glib-sys`, see `apps/bat-desktop/BUILD.md`).

The browser shell can attach read-only. See `docs/cowork/DESKTOP-READ.md`. A managed task is restored from `{paseoHome}/cowork/tasks.json` on daemon start. See `docs/cowork/W2-STATUS.md`.

## What is true now

| Check               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PTY subscribe       | `onOutput` / `onExit` return an unsubscribe and deliver nothing, so the imported App can mount. `pty.create`, `pty.write`, and `pty.kill` still throw `UNSUPPORTED_CAPABILITY`.                                                                                                                                                                                                                                                                                                                                        |
| Live read           | `packages/server/src/server/cowork/read-only-connection.e2e.test.ts` started a local test daemon, created a directory workspace, and the read-only view listed that workspace, listed `README.md`, and fetched the uncommitted diff. 1 test passed. This was a Node client, not the Tauri window.                                                                                                                                                                                                                      |
| Writes on that view | `createWorkspace` and `sendAgentMessage` are not on the view.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Mutation gate       | `syncManagedAgent(managedWriteFields(task))` registers the reducer onto an agent. A paused task makes `Session.handleMessage(send_agent_message_request)` return `accepted: false` / `cowork gate: held` and does not call the agent run. An open task and an unregistered agent are accepted. That accept path stops at a stub `tryRunOutOfBand`; no provider process starts. `create_agent_request` calls the same gate, but only the send path was exercised on a Session. 2 Session tests and 3 gate tests passed. |

## Tests run

- `node --test test/host-unsupported.test.mjs` in `apps/bat-desktop`: 5 passed
- `npx vitest run src/cowork` in `packages/client`: 7 passed (this round ran the same 7 tests with `node --experimental-strip-types --test`; they now run under Vitest so CI picks them up)
- `vitest run src/server/cowork/mutation-gate.test.ts`: 3 passed
- `vitest run src/server/cowork/session-gate.test.ts`: 2 passed
- `node --experimental-strip-types --test test/*.test.ts` in `packages/cowork-core`: 13 passed
- `vitest run src/server/cowork/read-only-connection.e2e.test.ts`: 1 passed

## Still closed

No Tauri window, no provider process, no production VM. The git panel got commit history from the daemon later, in W5 (see `docs/cowork/DESKTOP-READ.md`).
