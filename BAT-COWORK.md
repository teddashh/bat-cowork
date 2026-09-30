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

W0 inventory is on `main`. W1 is started, not accepted:

- BAT renderer is imported under `apps/bat-desktop`. The new Tauri id is `dev.teddashh.bat-cowork`. Cargo did not compile (`pkg-config` / glib missing). See `apps/bat-desktop/BUILD.md`.
- `@getpaseo/client/cowork` is a read-only facade plus a native transport wrapper. No daemon was connected.
- `packages/cowork-core` has an in-memory reducer. It is not wired into Paseo `Session`. No provider is admitted.

Not done: a window that stays up, a live read-only daemon connection, the mutation gate on real ingress, multi-user control, release. Do not point this tree at a running production daemon or an existing BAT session.
