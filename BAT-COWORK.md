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

W0 inventory is on `main`. W1 and W2 are not accepted. W3's local checks are in `docs/cowork/W3-STATUS.md`.

- W1 is a browser read of workspace, files, and diff. It is not a Tauri session and not a remote server. See `docs/cowork/DESKTOP-READ.md`.
- W2 is not accepted. There is no official Codex run, and a second client does not watch the same run. The mutation gate and one fake-claude turn are only a slice. See `docs/cowork/W2-STATUS.md`.
- W3: a restarted daemon holds an in-flight command instead of leaving it running. A turn that does not commit is reworked. A later instruction is not closed by the old commit.

Not done: W1, W2, W4, W5, W6. Do not point this tree at a running production daemon or an existing BAT session.
