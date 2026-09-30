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

W0 inventory is on `main`. W1 is not a Tauri session. W2 is one task on a local test daemon, not an admitted provider:

- A paused task is stored in `{paseoHome}/cowork/tasks.json`. Stopping the daemon and starting another on the same home restores it. A new client still cannot send.
- After the driver releases the pause, one fake-claude turn runs and commits. The verifier accepts only because HEAD moved and the worktree is clean.
- Daemon `start` loads that journal through the bundled reducer. See `docs/cowork/W2-STATUS.md`.

Not done: a Tauri window, a desktop connection, Claude/Codex/Grok admission, a cold start of a built daemon restoring the task. Do not point this tree at a running production daemon or an existing BAT session.
