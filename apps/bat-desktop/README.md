# BAT Cowork desktop

Not an official Better Agent Terminal release. Not an official Paseo release.
The renderer is imported from tony1223/better-agent-terminal `41ea2b1e9142c9383d4b7813d754cb4a03dd0ace` (MIT, Copyright (c) 2024 TonyQ, see `BAT-LICENSE`).
The Tauri shell is a new crate: identifier `dev.teddashh.bat-cowork`, product name `BAT Cowork`. It is not `org.tonyq.better-agent-terminal`. There is no updater plugin, no updater public key, and no BAT update endpoint.

## Status

- UI imported. Visual panels (WorkspaceView, TerminalPanel, ClaudeAgentPanel, FileTree, GitPanel, and the rest of `renderer/src/components`) are still in the tree.
- Host split is done in `renderer/src/host-api.ts`.
- No live daemon was connected. `WorkspaceReadPort` defaults to `DisconnectedWorkspaceReadPort`, which rejects every read with `WORKSPACE_READ_DISCONNECTED`. It does not read or write a local workspace JSON file.
- The shell crate did not compile here. See `BUILD.md`. Do not claim this shell builds.

## What the host does

Local Tauri commands, only when `window.__TAURI_INTERNALS__.invoke` exists:

- `app_set_title`
- `dialog_confirm`, `dialog_select_folder`, `dialog_select_files`, `dialog_select_images`
- `clipboard_write_text`
- `shell_open_external`, `shell_open_path`, `shell_reveal_path`

`installTauriShim()` assigns that same host to `window.batAppAPI`. It does not install a permissive proxy. Unported calls throw `UNSUPPORTED_CAPABILITY`. `workspace.getDetachedId()` returns `null`. `debug.log` is a no-op. `debug.isDebugMode` is `false`.

Device-only settings (`settings.load` / `settings.save`) use `localStorage` key `bat-cowork.device-settings.v1`. That is chrome on this machine, not shared workspace authority. `settings.getShellPath` throws, because it would feed a process spawn.

`workerBuffer` init/append/read/clear is an in-memory scrollback. `loadProcfile` only parses text returned by the read port. `startProcess` and `stopProcess` throw.

## Unsupported in this milestone

These namespaces always throw `UNSUPPORTED_CAPABILITY` (they are not successful invokes): `runtime`, `update`, `claude`, `claudeChannel`, `claudeCli`, `codex`, `remote`, `remoteTunnel`, `tunnel`.

Also thrown: pty create/write/kill/restart and every other pty method, worktree create/remove/merge/rehydrate, git commit/checkout/merge, file writes (`fs.mkdir`, `fs.deletePath`, `fs.uploadToDir`, `fs.downloadFile`, `fs.writeFile`), `workspace.save`, and any other method that is not a local shell command or a read-port call. That includes profile, snippet, notification, github, image, and agent.

Workspace reads (list workspaces, files, git status, git diff, and the other read methods on the port) reject until something calls `setWorkspaceReadPort`. Nothing in this tree does that.

## Startup

`host.pty.onOutput` and other `on*` listeners return an unsubscribe function and deliver no data. That lets the imported `App` mount. `pty.create`, `pty.write`, and `pty.kill` still throw `UNSUPPORTED_CAPABILITY`. No terminal is started. `workspace.load()` still rejects until a read port is connected. No daemon was attached from this UI.

CSP is set in `src-tauri/tauri.conf.json` and is not null. It allows the Vite dev server on `127.0.0.1:5173` (HMR on `5174`) and loopback `ws:` / `wss:` for a local daemon. It does not allow an arbitrary remote daemon host, and no daemon URL was configured.

`shared/transfer-redaction.mjs` is a local stub. The upstream helper was not in the renderer copy. The renderer imports it.

## Commands

UI dependencies were installed only inside this directory:

```
cd apps/bat-desktop && npm install --no-audit --no-fund
```

Forbidden packages are not dependencies: `@anthropic-ai/*`, `@openai/codex`, `@modelcontextprotocol/sdk`, `better-sqlite3`, `node-pty`, `ws`.

Test (node:test, no extra runner):

```
cd apps/bat-desktop && node --test test/host-unsupported.test.mjs
```

Result (exit 0):

```
TAP version 13
# Subtest: unsupported list names the dropped capabilities
ok 1 - unsupported list names the dropped capabilities
  ---
  duration_ms: 0.880715
  type: 'test'
  ...
# Subtest: unsupportedCapability throws UNSUPPORTED_CAPABILITY and does not resolve
ok 2 - unsupportedCapability throws UNSUPPORTED_CAPABILITY and does not resolve
  ---
  duration_ms: 1.40971
  type: 'test'
  ...
# Subtest: host-api refuses dropped capabilities instead of invoking them
ok 3 - host-api refuses dropped capabilities instead of invoking them
  ---
  duration_ms: 0.714546
  type: 'test'
  ...
# Subtest: workspace reads go through a disconnected port, not a local JSON file
ok 4 - workspace reads go through a disconnected port, not a local JSON file
  ---
  duration_ms: 0.17405
  type: 'test'
  ...
1..4
# tests 4
# suites 0
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 62.745401
```

Vite production build ran and succeeded (exit 0, `✓ built in 14.28s`):

```
cd apps/bat-desktop && npx vite build
```

Output directory: `dist-tauri/`. No dev server was started. Port 8080 was not used.

`cargo check` did not succeed. See `BUILD.md`. The shell is not built.
