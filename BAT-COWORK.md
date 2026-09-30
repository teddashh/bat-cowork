# bat-cowork

Server-first development workstation.

- The desktop is the BAT Tauri / React workflow. It is not imported yet.
- The daemon is this Paseo tree, locked at `53ee9cd9930d9479af318c1ed29713a0bfb5f47b`.
- Task rules will live in-process. There is no second Python task daemon.

This repository is not an official Paseo or Better Agent Terminal build.
Product name, app id, data directory, and update keys stay separate from both
upstreams. Automatic update is off until a new trust chain exists.

## Remotes

- `origin` — this product
- `upstream-paseo` — https://github.com/getpaseo/paseo

`baseline/paseo-w0` is the untouched snapshot. Product work lands on `main`
above that commit. Do not merge the BAT host back in.

## Status

W0 inventory is on `main`. W1 is not accepted:

- The imported App can subscribe to PTY events without starting a process. PTY writes still throw.
- A Node read-only view listed a workspace, a file, and a diff on a local test daemon. The Tauri window is not connected, and `cargo check` still fails.
- `send_agent_message_request` and `create_agent_request` call `authorizeCoworkWrite`. Unregistered traffic is unchanged. No provider is admitted.

Not done: a running Tauri client, a desktop connection, a managed task on the daemon, multi-user control, release. Do not point this tree at a running production daemon or an existing BAT session.
