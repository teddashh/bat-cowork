# W0 report

Date: 2026-09-29.

## Baseline commits

| Source                         | Commit                                     | What this checkout did                                  |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------- |
| getpaseo/paseo                 | `53ee9cd9930d9479af318c1ed29713a0bfb5f47b` | Checked out as `baseline/paseo-w0`. `main` starts here. |
| tony1223/better-agent-terminal | `41ea2b1e9142c9383d4b7813d754cb4a03dd0ace` | Read `renderer/src/host-api.ts` only. Not imported.     |
| teddashh/bat-agent-connector   | `71337aa5133fc04bf332d3da15e819c16585c7a3` | Named in `upstream-lock.json`. No Python copied.        |

Paseo `HEAD` on GitHub at clone time was `4e9a4582` (`fix(app): stop connecting to a host removed during its first probe`). That is newer than the lock and is not the product baseline.

## Files added on top of the snapshot

- `upstream-lock.json`
- `THIRD_PARTY_NOTICES.md`
- `BAT-COWORK.md`
- `docs/cowork/W0-REPORT.md`
- `apps/bat-desktop/README.md` (path reserved, UI absent)
- `packages/cowork-core/` (not added to the npm workspaces list, so the Paseo lockfile is unchanged)

## Source ids used

P01, P02, P03, P04, P05, P08, P09, P10, P16 (protocol package present, schemas not re-audited), P18, B01, B05 (updater/app-id rule recorded, file not imported), T01 (cited, not implemented).

P12, P13, P14, P15 were not re-read line by line in this pass. They stay "located, not audited".

## Kept

- Paseo server, client, protocol, CLI, and provider adapters, on their original paths.
- Apache-2.0 `LICENSE` and upstream copyright.
- ACP catalog row for Grok: `["grok", "agent", "stdio"]`, catalog version `0.2.11`.
- `plugins/grok-usage-source/` as an upstream usage plugin, not as proof of quota.
- `DaemonClientConfig.transportFactory` on the internal entry `@getpaseo/client/internal/daemon-client`. The public `PaseoClientConfig` does not expose it.
- `defaultWebSocketFactory` does not take auth headers. `nativeWebSocketFactory` does. Confirmed in `packages/client/src/daemon-client-websocket-transport.ts`.

## Added

- A host-namespace disposition table for the 30 namespaces in BAT `createTauriHost`.
- A 162-row inventory of the `Session` inbound switch (`session.ts` lines 2300-3200). 90 are writes. Every row is `gate: "not-wired"`.
- `assertIngressGated` and `assertProviderAdmitted`. Both throw. They are refusals, not a gate.

## Removed

Nothing from the Paseo tree. BAT sidecar, updater, and local agent spawn are not in the tree, so there was nothing of theirs to delete.

## Tests

`packages/cowork-core` unit tests, Node's built-in test runner, no Paseo install:

- the ingress table equals the `case` labels in that line range
- `send_agent_message_request` is a write and `assertIngressGated` throws
- host dispositions for `pty`, `update`, `remote`, `claudeCli`, `runtime`, `app`
- no provider has `admittedForDispatch: true`
- the Grok command string is still in the catalog file
- the catalog has no `id: "antigravity"`

This is not a Paseo build, not a Tauri build, and not a live CLI test.

## What the tree actually shows

- Claude and Codex adapter directories exist. They were not executed.
- Grok is an ACP catalog command plus a usage plugin. It is not admitted.
- Antigravity is an editor target (`packages/desktop/src/features/editor-targets/targets/antigravity.ts`) and a community doc link. It is not an agent provider here.
- `docs/permissions.md` still says grants are daemon-wide and file preview can read any regular file the daemon user can read. Workspace scope is still a gap.
- `sendPromptToAgent` in `agent-prompt.ts` is still the stock prompt entry. Nothing in cowork-core wraps it.

## Limits

- Paseo was not built or typechecked in this pass.
- No Tauri shell, no transport adapter, no daemon connection.
- No task journal, reducer, verifier, or outbox.
- No credentials were created. No production VM, service, or BAT session was touched.
- Partial git clone (`--filter=blob:none`) was used to fetch the snapshot. `baseline/paseo-w0` must still point at `53ee9cd`.

## Next gate

W1: import the BAT renderer and a reduced Tauri shell, talk to a **non-production** Paseo daemon read-only, and show workspace / session / files / diff. The client still must not spawn or kill agents. Do not open mutations, and do not start the task loop, until that read-only path is real.
