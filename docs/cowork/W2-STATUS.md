# W2 status

One task on a local test daemon. Not a Tauri session, and not an admitted Claude, Codex, or Grok provider.

## What the test did

`packages/server/src/server/cowork/task-loop.e2e.test.ts` passed once.

| Step | Result |
| --- | --- |
| Daemon | `createTestPaseoDaemon` with the in-process fake `claude` client. No provider binary. |
| Workspace | A real git repo, opened as a directory workspace. |
| Agent | `createAgent({ provider: "claude", model: "test-model" })` on that fake client. |
| Journal | `openTask` writes `{paseoHome}/cowork/tasks.json` and registers the agent on the gate. |
| Early verify | Rejected. HEAD had not moved. |
| Pause | `sendAgentMessage` throws `cowork gate: held`. The fake turn does not start. |
| Restart | A second `createTestPaseoDaemon` on the same home, after the first process stopped, restored the journal during `start`. A new client send still threw `cowork gate: held`. The fake turn did not start. `task-restart.e2e.test.ts` passed. |
| Release | The driver can release their own pause. |
| One turn | The original client send is accepted. `onStartTurn` runs once and makes a real commit. |
| Verify | HEAD moved and the tree is clean, so the task phase is `verified` and a notify intent is emitted. Reloading the file still says `verified`. |

## Limits

`packages/server/src/server/cowork/reducer.js` is the bundled copy of `packages/cowork-core` that the server imports. Daemon `start` calls `openJournal`. Daemon `stop` drops the in-memory copy and leaves the file.

The git commit in the first test is made by the test double's `onStartTurn`, not by a product executor. The product code that decides `verified` only reads `git rev-parse` and `git status`.

No desktop window. No admitted Claude, Codex, or Grok binary. No production VM.
